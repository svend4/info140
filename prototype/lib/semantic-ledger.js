(function(global){
'use strict';

var VERSION='1.0.0';
var STRUCTURAL='STRUCTURAL';
var UNVERIFIED='UNVERIFIED';
var NOT_COMPUTED='NOT_COMPUTED';
var DEFAULT_LIMIT=8;
var MAX_LIMIT=32;

var STATUSES={
  COMMITTED:'COMMITTED',
  ALREADY_COMMITTED:'ALREADY_COMMITTED',
  ROLLED_BACK:'ROLLED_BACK',
  BLOCKED:'BLOCKED'
};

var ERROR_CODES={
  LEDGER_INVALID_ENTRY:'LEDGER_INVALID_ENTRY',
  LEDGER_NOT_ROLLED_BACK:'LEDGER_NOT_ROLLED_BACK',
  LEDGER_TRANSACTION_UNAVAILABLE:'LEDGER_TRANSACTION_UNAVAILABLE',
  LEDGER_ENTRY_INTEGRITY:'LEDGER_ENTRY_INTEGRITY'
};

function transactionEngine(){ return global.MRDSemanticTransaction||null; }
function recordLike(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function text(value){ return value==null?'':String(value); }
function trimmed(value){ return text(value).trim(); }
function number(value,fallback){ value=Number(value); return isFinite(value)?value:fallback; }
function boundedLimit(value){ return Math.max(1,Math.min(MAX_LIMIT,Math.floor(number(value,DEFAULT_LIMIT)))); }
function evidence(value){ return value===STRUCTURAL?STRUCTURAL:UNVERIFIED; }

function cloneData(value,seen){
  if(value==null||typeof value!=='object') return value;
  seen=seen||[];
  for(var i=0;i<seen.length;i++) if(seen[i].source===value) return seen[i].copy;
  var copy=Array.isArray(value)?[]:{};
  seen.push({source:value,copy:copy});
  Object.keys(value).forEach(function(key){ copy[key]=cloneData(value[key],seen); });
  return copy;
}

function create(limit){
  return {
    version:VERSION,
    kind:'MRDSemanticLedger',
    limit:boundedLimit(limit),
    nextSeq:1,
    lastRecordedSeq:null,
    entries:[],
    evidence:STRUCTURAL,
    evidenceLevel:STRUCTURAL,
    soundness:NOT_COMPUTED
  };
}

function normalizeLedger(ledger){
  if(!recordLike(ledger)||!Array.isArray(ledger.entries)) return create();
  return {
    version:VERSION,
    kind:'MRDSemanticLedger',
    limit:boundedLimit(ledger.limit),
    nextSeq:Math.max(1,Math.floor(number(ledger.nextSeq,ledger.entries.length+1))),
    lastRecordedSeq:ledger.lastRecordedSeq==null?null:number(ledger.lastRecordedSeq,null),
    entries:ledger.entries.slice(),
    evidence:STRUCTURAL,
    evidenceLevel:STRUCTURAL,
    soundness:NOT_COMPUTED
  };
}

function phaseSummary(transaction,phase){
  var groups=transaction&&transaction.checkGroups, checks=groups&&Array.isArray(groups[phase])?groups[phase]:null;
  if(!checks&&transaction&&Array.isArray(transaction.checks)){
    checks=transaction.checks.filter(function(item){ return item&&item.phase===phase; });
  }
  checks=checks||[];
  var passed=checks.filter(function(item){ return item&&item.ok===true; }).length;
  return {passed:passed,total:checks.length,ok:checks.length>0&&passed===checks.length};
}

function typedPath(plan){
  return trimmed(plan&&(
    plan.portPath||
    plan.typedProgram&&plan.typedProgram.portPath||
    plan.decision&&plan.decision.typedProgram&&plan.decision.typedProgram.portPath
  ))||'ID -> STATE -> EFFECT -> STATE';
}

function actionValue(plan,meta,key,fallback){
  var action=plan&&plan.action||{};
  if(meta&&meta[key]!=null&&trimmed(meta[key])) return trimmed(meta[key]);
  if(action&&action[key]!=null&&trimmed(action[key])) return trimmed(action[key]);
  return fallback;
}

function record(ledger,payload){
  var state=normalizeLedger(ledger), transaction=payload&&payload.transaction, result=payload&&payload.result;
  if(!recordLike(transaction)||!recordLike(result)||[STATUSES.COMMITTED,STATUSES.ALREADY_COMMITTED].indexOf(result.status)<0) return state;
  var meta=payload.meta||{}, plan=payload.plan||{}, seq=state.nextSeq;
  var entry={
    version:VERSION,
    kind:'MRDSemanticLedgerEntry',
    seq:seq,
    transactionId:transaction.transactionId||null,
    status:result.status,
    actionId:actionValue(plan,meta,'id',transaction.transactionId||'semantic-action'),
    actionLabel:actionValue(plan,meta,'label','semantic action'),
    origin:actionValue(plan,meta,'origin','p78'),
    replayOf:meta.replayOf==null?null:number(meta.replayOf,null),
    beforeText:text(transaction.source),
    afterText:text(transaction.afterText),
    target:trimmed(transaction.target),
    line:trimmed(transaction.insertLine||transaction.candidate),
    sourceHash:number(transaction.sourceHash,0)>>>0,
    afterHash:number(transaction.afterHash,0)>>>0,
    targetHash:number(transaction.targetHash,0)>>>0,
    witness:transaction.witness||null,
    portPath:typedPath(plan),
    contract:{
      pre:phaseSummary(transaction,'pre'),
      inv:phaseSummary(transaction,'inv'),
      post:phaseSummary(transaction,'post')
    },
    transaction:cloneData(transaction),
    evidence:evidence(transaction.evidence||result.evidence),
    evidenceLevel:evidence(transaction.evidenceLevel||transaction.evidence||result.evidenceLevel||result.evidence),
    soundness:NOT_COMPUTED
  };
  var entries=state.entries.concat([entry]);
  if(entries.length>state.limit) entries=entries.slice(entries.length-state.limit);
  state.entries=entries;
  state.nextSeq=seq+1;
  state.lastRecordedSeq=seq;
  return state;
}

function markRolledBack(ledger,transactionId,seq){
  var state=normalizeLedger(ledger), entries=state.entries.slice(), wantedSeq=seq==null?null:number(seq,null), index=-1;
  for(var i=entries.length-1;i>=0;i--){
    var entry=entries[i];
    if(!entry||entry.status===STATUSES.ROLLED_BACK) continue;
    if(wantedSeq!=null&&entry.seq===wantedSeq){ index=i; break; }
    if(wantedSeq==null&&transactionId!=null&&entry.transactionId===transactionId){ index=i; break; }
  }
  if(index<0) return state;
  var updated=cloneData(entries[index]);
  updated.previousStatus=updated.status;
  updated.status=STATUSES.ROLLED_BACK;
  updated.evidence=evidence(updated.evidence);
  updated.evidenceLevel=evidence(updated.evidenceLevel||updated.evidence);
  updated.soundness=NOT_COMPUTED;
  entries[index]=updated;
  state.entries=entries;
  return state;
}

function entryIntegrity(entry){
  var transaction=entry&&entry.transaction;
  return recordLike(entry)&&recordLike(transaction)&&
    text(entry.beforeText)===text(transaction.source)&&
    text(entry.afterText)===text(transaction.afterText)&&
    trimmed(entry.target)===trimmed(transaction.target)&&
    (number(entry.sourceHash,-1)>>>0)===(number(transaction.sourceHash,-2)>>>0)&&
    (number(entry.afterHash,-1)>>>0)===(number(transaction.afterHash,-2)>>>0)&&
    (number(entry.targetHash,-1)>>>0)===(number(transaction.targetHash,-2)>>>0);
}

function canReplay(entry,currentSource,currentTarget){
  return !!entry&&entry.status===STATUSES.ROLLED_BACK&&entryIntegrity(entry)&&
    text(currentSource)===text(entry.beforeText)&&trimmed(currentTarget)===trimmed(entry.target);
}

function blocked(code,currentSource){
  return {
    version:VERSION,
    kind:'MRDSemanticLedgerReplay',
    status:STATUSES.BLOCKED,
    code:code,
    errorCode:code,
    text:text(currentSource),
    changed:false,
    errors:[{code:code,phase:'replay'}],
    evidence:UNVERIFIED,
    evidenceLevel:UNVERIFIED,
    soundness:NOT_COMPUTED
  };
}

function replay(entry,currentSource,currentTarget){
  if(!recordLike(entry)||!recordLike(entry.transaction)) return blocked(ERROR_CODES.LEDGER_INVALID_ENTRY,currentSource);
  if(entry.status!==STATUSES.ROLLED_BACK) return blocked(ERROR_CODES.LEDGER_NOT_ROLLED_BACK,currentSource);
  if(!entryIntegrity(entry)) return blocked(ERROR_CODES.LEDGER_ENTRY_INTEGRITY,currentSource);
  var engine=transactionEngine();
  if(!engine||typeof engine.commit!=='function') return blocked(ERROR_CODES.LEDGER_TRANSACTION_UNAVAILABLE,currentSource);
  return arguments.length>=3?engine.commit(entry.transaction,text(currentSource),trimmed(currentTarget)):engine.commit(entry.transaction,text(currentSource));
}

function recent(ledger,count){
  var state=normalizeLedger(ledger), take=Math.max(0,Math.floor(number(count,state.limit)));
  return state.entries.slice(Math.max(0,state.entries.length-take)).reverse();
}

global.MRDSemanticLedger={
  version:VERSION,
  statuses:STATUSES,
  STATUSES:STATUSES,
  errorCodes:ERROR_CODES,
  ERROR_CODES:ERROR_CODES,
  create:create,
  record:record,
  markRolledBack:markRolledBack,
  canReplay:canReplay,
  replay:replay,
  recent:recent
};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
