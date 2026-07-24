(function(global){
'use strict';

var VERSION='1.0.0';
var KIND='MRDP78SemanticActionController';
var STRUCTURAL='STRUCTURAL';
var UNVERIFIED='UNVERIFIED';
var NOT_COMPUTED='NOT_COMPUTED';
var RECEIPT_LIMIT=8;
var LOG_LIMIT=5;

var STATUSES={
  READY:'READY',
  GATED:'GATED',
  BLOCKED:'BLOCKED',
  ROLLBACK:'ROLLBACK',
  COMMITTED:'COMMITTED',
  ALREADY_COMMITTED:'ALREADY_COMMITTED',
  ROLLED_BACK:'ROLLED_BACK',
  INVALIDATED:'INVALIDATED'
};

var ERROR_CODES={
  INVALID_ARGUMENT:'ACTION_CONTROLLER_INVALID_ARGUMENT',
  DECISION_UNAVAILABLE:'ACTION_DECISION_UNAVAILABLE',
  ACTION_GATE_UNAVAILABLE:'ACTION_GATE_UNAVAILABLE',
  TRANSACTION_UNAVAILABLE:'ACTION_TRANSACTION_UNAVAILABLE',
  LEDGER_UNAVAILABLE:'ACTION_LEDGER_UNAVAILABLE',
  EVALUATION_FAILED:'ACTION_EVALUATION_FAILED',
  PLAN_FAILED:'ACTION_PLAN_FAILED',
  COMMIT_FAILED:'ACTION_COMMIT_FAILED',
  COMMIT_INCONSISTENT:'ACTION_COMMIT_INCONSISTENT',
  LEDGER_RECORD_FAILED:'ACTION_LEDGER_RECORD_FAILED',
  PREPARED_MISMATCH:'ACTION_PREPARED_MISMATCH',
  STALE_SOURCE:'ACTION_STALE_SOURCE',
  STALE_TARGET:'ACTION_STALE_TARGET',
  UNDO_UNAVAILABLE:'UNDO_UNAVAILABLE',
  ROLLBACK_CONFLICT:'ROLLBACK_CONFLICT'
};

function own(value,key){ return Object.prototype.hasOwnProperty.call(value,key); }
function recordLike(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function text(value){ return value==null?'':String(value); }
function trimmed(value){ return text(value).trim(); }
function lower(value){ return trimmed(value).toLowerCase(); }
function boundedEvidence(value){ return value===STRUCTURAL?STRUCTURAL:UNVERIFIED; }

function cloneData(value,seen){
  if(value==null||typeof value!=='object') return value;
  seen=seen||[];
  for(var i=0;i<seen.length;i++) if(seen[i].source===value) return seen[i].copy;
  var copy=Array.isArray(value)?[]:{};
  seen.push({source:value,copy:copy});
  Object.keys(value).forEach(function(key){ copy[key]=cloneData(value[key],seen); });
  return copy;
}

function copyRecord(value){
  var copy={};
  if(!recordLike(value)) return copy;
  Object.keys(value).forEach(function(key){ copy[key]=value[key]; });
  return copy;
}

function clearList(list){ list.splice(0,list.length); }
function capList(list,limit){ if(list.length>limit) list.splice(0,list.length-limit); }

function firstErrorCode(value){
  if(!value) return null;
  if(value.code) return value.code;
  if(value.errorCode) return value.errorCode;
  if(value.error&&value.error.code) return value.error.code;
  if(value.errors&&value.errors.length&&value.errors[0]&&value.errors[0].code) return value.errors[0].code;
  return null;
}

function decisionCode(decision){
  if(!recordLike(decision)||decision.decision==='apply') return null;
  if(Array.isArray(decision.reasonCodes)&&decision.reasonCodes.length) return decision.reasonCodes[0];
  return firstErrorCode(decision)||decision.decision||null;
}

function resultRecord(status,code,current,transactionId,evidence){
  return {
    version:VERSION,
    kind:'MRDP78SemanticActionControllerResult',
    status:status,
    changed:false,
    text:text(current),
    code:code||null,
    errorCode:code||null,
    transactionId:transactionId||null,
    evidence:boundedEvidence(evidence),
    evidenceLevel:boundedEvidence(evidence),
    soundness:NOT_COMPUTED,
    errors:code?[{code:code,phase:'controller'}]:[]
  };
}

function operation(fields){
  fields=fields||{};
  return {
    version:VERSION,
    kind:'MRDP78SemanticActionOutcome',
    status:fields.status||STATUSES.BLOCKED,
    changed:fields.changed===true,
    text:own(fields,'text')?fields.text:'',
    code:fields.code||null,
    plan:fields.plan||null,
    decision:fields.decision||null,
    transaction:fields.transaction||null,
    receipt:fields.receipt||null,
    replayOf:fields.replayOf==null?null:fields.replayOf,
    evidenceLevel:boundedEvidence(fields.evidenceLevel||fields.evidence),
    soundness:NOT_COMPUTED
  };
}

function chooseEngine(engines,names,globalName){
  engines=recordLike(engines)?engines:{};
  for(var i=0;i<names.length;i++) if(engines[names[i]]) return engines[names[i]];
  return global[globalName]||null;
}

function create(options){
  options=recordLike(options)?options:{};
  var semanticState=options.semanticState;
  var uiState=options.uiState;
  if(!recordLike(semanticState)||!recordLike(uiState)){
    throw new TypeError('P78_SEMANTIC_ACTION_CONTROLLER_STATE_REQUIRED');
  }

  var supplied=options.engines;
  var engines={
    decision:chooseEngine(supplied,['decision','semanticDecision','decisionEngine'],'MRDSemanticDecision'),
    actionGate:chooseEngine(supplied,['actionGate','semanticActionGate','gate'],'MRDSemanticActionGate'),
    transaction:chooseEngine(supplied,['transaction','semanticTransaction','transactionEngine'],'MRDSemanticTransaction'),
    ledger:chooseEngine(supplied,['ledger','semanticLedger','ledgerEngine'],'MRDSemanticLedger')
  };

  if(!Array.isArray(uiState.portalUndo)) uiState.portalUndo=[];
  if(!Array.isArray(uiState.portalLog)) uiState.portalLog=[];
  capList(uiState.portalUndo,RECEIPT_LIMIT);
  capList(uiState.portalLog,LOG_LIMIT);
  if(!semanticState.ledger&&engines.ledger&&typeof engines.ledger.create==='function'){
    semanticState.ledger=engines.ledger.create(RECEIPT_LIMIT);
  }

  function latestReceipt(){
    return uiState.portalUndo.length?uiState.portalUndo[uiState.portalUndo.length-1]:null;
  }

  function exactReceipt(receipt,transaction){
    return recordLike(receipt)&&recordLike(transaction)&&
      receipt.transactionId===(transaction.transactionId||null)&&
      text(receipt.beforeText)===text(transaction.source)&&
      text(receipt.afterText)===text(transaction.afterText);
  }

  function expectedValue(meta,explicit,key,current,trimValue){
    var value=explicit;
    if(value==null&&recordLike(meta)&&own(meta,key)) value=meta[key];
    if(value==null) value=current;
    return trimValue?trimmed(value):text(value);
  }

  function actionDescriptor(decision,meta){
    meta=recordLike(meta)?meta:{};
    var id=trimmed(meta.id)||'semantic-decision';
    return {
      id:id,
      label:trimmed(meta.label)||id,
      line:trimmed(decision&&decision.insertLine),
      origin:trimmed(meta.origin)||'p78'
    };
  }

  function preparedPlan(decision,transaction,meta){
    var status=transaction&&transaction.status||STATUSES.BLOCKED;
    var evidence=status===STATUSES.READY&&decision&&decision.decision==='apply'?STRUCTURAL:UNVERIFIED;
    return {
      version:VERSION,
      kind:'SemanticDecisionAction',
      ok:status===STATUSES.READY&&decision&&decision.decision==='apply',
      status:status,
      action:actionDescriptor(decision,meta),
      decision:decision||null,
      transaction:transaction||null,
      typedProgram:decision&&decision.typedProgram||null,
      portPath:decision&&decision.typedProgram&&decision.typedProgram.portPath||'ID -> STATE -> EFFECT -> STATE',
      errors:transaction&&transaction.errors||[],
      evidence:evidence,
      evidenceLevel:evidence,
      soundness:NOT_COMPUTED
    };
  }

  function setPreparedState(decision,transaction,plan){
    semanticState.decision=decision||null;
    semanticState.continuationProtocol=decision&&decision.protocol||null;
    semanticState.action=plan||null;
    semanticState.transaction=transaction||null;
  }

  function blocked(current,code,fields){
    fields=fields||{};
    var stateResult=resultRecord(fields.status||STATUSES.BLOCKED,code,current,
      fields.prepared&&fields.prepared.transactionId,fields.evidenceLevel);
    if(fields.writeTransaction!==false) semanticState.transaction=stateResult;
    return operation({
      status:fields.status||STATUSES.BLOCKED,
      changed:false,
      text:text(current),
      code:code,
      plan:fields.plan||semanticState.action,
      decision:fields.decision||semanticState.decision,
      transaction:fields.transaction||stateResult,
      receipt:fields.receipt||null,
      replayOf:fields.replayOf,
      evidenceLevel:fields.evidenceLevel||UNVERIFIED
    });
  }

  function evaluate(source,target){
    var current=text(source), currentTarget=trimmed(target);
    if(!engines.decision||typeof engines.decision.decide!=='function'){
      setPreparedState(null,null,null);
      return blocked(current,ERROR_CODES.DECISION_UNAVAILABLE,{plan:null,decision:null});
    }
    try{
      var decision=engines.decision.decide(current,currentTarget);
      var transaction=decision&&decision.transaction||null;
      var plan=preparedPlan(decision,transaction,{});
      setPreparedState(decision,transaction,plan);
      var status=transaction&&transaction.status||decision&&decision.status||STATUSES.BLOCKED;
      var code=status===STATUSES.READY?null:(decisionCode(decision)||firstErrorCode(transaction)||firstErrorCode(decision)||status);
      return operation({
        status:status,
        changed:false,
        text:current,
        code:code,
        plan:plan,
        decision:decision,
        transaction:transaction,
        evidenceLevel:status===STATUSES.READY?STRUCTURAL:UNVERIFIED
      });
    }catch(cause){
      setPreparedState(null,null,null);
      return blocked(current,ERROR_CODES.EVALUATION_FAILED,{plan:null,decision:null});
    }
  }

  function preparedError(decision,transaction){
    if(!recordLike(decision)||!recordLike(transaction)) return ERROR_CODES.INVALID_ARGUMENT;
    if(decision.decision!=='apply') return decisionCode(decision)||'TX_DECISION_NOT_APPLY';
    if(transaction.status!==STATUSES.READY) return firstErrorCode(transaction)||'TX_NOT_READY';

    if(decision.transaction&&recordLike(decision.transaction)){
      var nested=decision.transaction;
      if((nested.transactionId||null)!==(transaction.transactionId||null)||
        text(nested.source)!==text(transaction.source)||
        text(nested.afterText)!==text(transaction.afterText)||
        trimmed(nested.target)!==trimmed(transaction.target)) return ERROR_CODES.PREPARED_MISMATCH;
    }
    if(typeof decision.source==='string'&&trimmed(decision.source)!==trimmed(transaction.source)) return 'TX_STALE_PREPARE_SOURCE';
    if(trimmed(decision.insertLine||decision.candidate)!==trimmed(transaction.insertLine||transaction.candidate)) return 'TX_CANDIDATE_MISMATCH';

    var guard=transaction.afterGuard||{};
    var zone=lower(guard.zone), u=Number(guard.u);
    if(zone!=='safe'&&zone!=='thin') return 'TX_GUARD_ZONE_UNSAFE';
    if(!isFinite(u)||!(u>.18&&u<.82)) return 'TX_GUARD_U_OUT_OF_RANGE';
    return null;
  }

  function ledgerMeta(meta,replayOf){
    var copy=copyRecord(meta);
    if(replayOf!=null) copy.replayOf=replayOf;
    return copy;
  }

  function exactRecordedEntry(state,transaction,previousLast){
    if(!recordLike(state)||!Array.isArray(state.entries)||state.lastRecordedSeq==null||state.lastRecordedSeq===previousLast) return null;
    for(var i=state.entries.length-1;i>=0;i--){
      var entry=state.entries[i];
      if(entry&&entry.seq===state.lastRecordedSeq&&
        entry.transactionId===(transaction.transactionId||null)&&
        text(entry.beforeText)===text(transaction.source)&&
        text(entry.afterText)===text(transaction.afterText)) return entry;
    }
    return null;
  }

  function recordCommit(transaction,result,plan,meta,replayOf){
    if(!engines.ledger||typeof engines.ledger.record!=='function') return null;
    var previous=semanticState.ledger;
    var previousLast=previous&&previous.lastRecordedSeq;
    var next;
    try{
      next=engines.ledger.record(previous,{
        transaction:transaction,
        result:result,
        plan:plan,
        meta:ledgerMeta(meta,replayOf)
      });
    }catch(cause){ return null; }
    var entry=exactRecordedEntry(next,transaction,previousLast);
    if(!entry) return null;
    return {state:next,entry:entry};
  }

  function makeReceipt(transaction,result,entry,meta){
    return {
      beforeText:text(transaction.source),
      afterText:text(result.text),
      transactionId:transaction.transactionId||null,
      ledgerSeq:entry.seq,
      origin:trimmed(meta&&meta.id)||'action'
    };
  }

  function pushLog(meta,transaction){
    var line=meta&&meta.log!=null?text(meta.log):'action '+(trimmed(meta&&meta.id)||transaction.transactionId||'commit');
    uiState.portalLog.unshift(line);
    capList(uiState.portalLog,LOG_LIMIT);
  }

  function alreadyCommitted(transaction,current){
    return {
      version:VERSION,
      kind:'MRDSemanticTransactionCommit',
      status:STATUSES.ALREADY_COMMITTED,
      transactionId:transaction.transactionId||null,
      witness:transaction.witness||null,
      text:text(transaction.afterText),
      changed:false,
      code:null,
      errorCode:null,
      currentText:text(current),
      evidence:STRUCTURAL,
      evidenceLevel:STRUCTURAL,
      soundness:NOT_COMPUTED,
      errors:[]
    };
  }

  function finishCommit(current,plan,decision,transaction,result,meta,replayOf){
    semanticState.action=plan||null;
    semanticState.transaction=result||null;
    var status=result&&result.status||STATUSES.BLOCKED;
    var code=firstErrorCode(result);

    if(status===STATUSES.ALREADY_COMMITTED){
      if(result.changed===true||text(result.text)!==text(transaction.afterText)){
        return blocked(current,ERROR_CODES.COMMIT_INCONSISTENT,{plan:plan,decision:decision,prepared:transaction,replayOf:replayOf});
      }
      return operation({
        status:status,changed:false,text:text(result.text),code:null,plan:plan,decision:decision,
        transaction:result,receipt:exactReceipt(latestReceipt(),transaction)?latestReceipt():null,
        replayOf:replayOf,evidenceLevel:STRUCTURAL
      });
    }

    if(status!==STATUSES.COMMITTED){
      return operation({
        status:status,changed:false,text:text(result&&result.text!=null?result.text:current),
        code:code||status,plan:plan,decision:decision,transaction:result,
        replayOf:replayOf,evidenceLevel:result&&result.evidenceLevel
      });
    }

    if(result.changed!==true||text(result.text)!==text(transaction.afterText)){
      return blocked(current,ERROR_CODES.COMMIT_INCONSISTENT,{plan:plan,decision:decision,prepared:transaction,replayOf:replayOf});
    }

    var recorded=recordCommit(transaction,result,plan,meta,replayOf);
    if(!recorded){
      return blocked(current,ERROR_CODES.LEDGER_RECORD_FAILED,{plan:plan,decision:decision,prepared:transaction,replayOf:replayOf});
    }

    semanticState.ledger=recorded.state;
    var receipt=makeReceipt(transaction,result,recorded.entry,meta);
    uiState.portalUndo.push(receipt);
    capList(uiState.portalUndo,RECEIPT_LIMIT);
    pushLog(meta,transaction);
    return operation({
      status:STATUSES.COMMITTED,changed:true,text:text(result.text),code:null,plan:plan,decision:decision,
      transaction:result,receipt:receipt,replayOf:replayOf,evidenceLevel:STRUCTURAL
    });
  }

  function commitPrepared(source,target,decision,transaction,meta){
    var current=text(source), currentTarget=trimmed(target);
    meta=recordLike(meta)?meta:{};
    var plan=recordLike(meta.plan)?meta.plan:preparedPlan(decision,transaction,meta);
    setPreparedState(decision,transaction,plan);

    var invalid=preparedError(decision,transaction);
    if(invalid) return blocked(current,invalid,{plan:plan,decision:decision,prepared:transaction});
    if(!engines.transaction||typeof engines.transaction.commit!=='function'){
      return blocked(current,ERROR_CODES.TRANSACTION_UNAVAILABLE,{plan:plan,decision:decision,prepared:transaction});
    }
    if(!engines.ledger||typeof engines.ledger.record!=='function'){
      return blocked(current,ERROR_CODES.LEDGER_UNAVAILABLE,{plan:plan,decision:decision,prepared:transaction});
    }

    var receipt=latestReceipt();
    if(exactReceipt(receipt,transaction)&&current===text(transaction.source)&&currentTarget===trimmed(transaction.target)){
      return finishCommit(current,plan,decision,transaction,alreadyCommitted(transaction,current),meta,null);
    }

    var result;
    try{ result=engines.transaction.commit(transaction,current,currentTarget); }
    catch(cause){ return blocked(current,ERROR_CODES.COMMIT_FAILED,{plan:plan,decision:decision,prepared:transaction}); }
    return finishCommit(current,plan,decision,transaction,result,meta,null);
  }

  function staleAction(current,target,line,meta,code){
    var descriptor={
      id:trimmed(meta&&meta.id)||'p78-action',
      label:trimmed(meta&&meta.label)||trimmed(meta&&meta.id)||'action',
      line:trimmed(line),
      origin:trimmed(meta&&meta.origin)||'p78'
    };
    var plan={
      version:VERSION,kind:'SemanticActionPlan',ok:false,status:STATUSES.BLOCKED,
      action:descriptor,target:target,errors:[{code:code,phase:'cas'}],
      evidence:UNVERIFIED,evidenceLevel:UNVERIFIED,soundness:NOT_COMPUTED
    };
    semanticState.action=plan;
    return blocked(current,code,{plan:plan,decision:semanticState.decision});
  }

  function commitLine(source,target,line,meta,expectedSource,expectedTarget){
    var current=text(source), currentTarget=trimmed(target);
    meta=recordLike(meta)?meta:{};
    var expectedCurrent=expectedValue(meta,expectedSource,'expectedSource',current,false);
    var expectedGoal=expectedValue(meta,expectedTarget,'expectedTarget',currentTarget,true);
    if(current!==expectedCurrent) return staleAction(current,currentTarget,line,meta,ERROR_CODES.STALE_SOURCE);
    if(currentTarget!==expectedGoal) return staleAction(current,currentTarget,line,meta,ERROR_CODES.STALE_TARGET);
    if(!engines.actionGate||typeof engines.actionGate.plan!=='function'||typeof engines.actionGate.commit!=='function'){
      return blocked(current,ERROR_CODES.ACTION_GATE_UNAVAILABLE,{decision:semanticState.decision});
    }
    if(!engines.ledger||typeof engines.ledger.record!=='function'){
      return blocked(current,ERROR_CODES.LEDGER_UNAVAILABLE,{decision:semanticState.decision});
    }

    var id=trimmed(meta.id)||'p78-action';
    var descriptor={
      id:id,
      label:trimmed(meta.label)||id,
      line:line,
      origin:trimmed(meta.origin)||'p78',
      contract:recordLike(meta.contract)?meta.contract:{}
    };
    if(meta.fullText!=null) descriptor.fullText=text(meta.fullText);

    var plan;
    try{ plan=engines.actionGate.plan(current,descriptor,currentTarget); }
    catch(cause){ return blocked(current,ERROR_CODES.PLAN_FAILED,{decision:semanticState.decision}); }
    semanticState.action=plan||null;
    semanticState.transaction=plan&&plan.transaction||null;
    var planDecision=plan&&plan.decision||semanticState.decision;
    if(!plan||plan.status!==STATUSES.READY||!recordLike(plan.transaction)){
      return operation({
        status:plan&&plan.status||STATUSES.BLOCKED,changed:false,text:current,
        code:firstErrorCode(plan)||(plan&&plan.status)||ERROR_CODES.PLAN_FAILED,
        plan:plan,decision:planDecision,transaction:plan&&plan.transaction,
        evidenceLevel:plan&&plan.evidenceLevel
      });
    }

    var transaction=plan.transaction, receipt=latestReceipt();
    if(exactReceipt(receipt,transaction)&&current===text(transaction.source)&&currentTarget===trimmed(transaction.target)){
      return finishCommit(current,plan,planDecision,transaction,alreadyCommitted(transaction,current),meta,null);
    }

    var result;
    try{ result=engines.actionGate.commit(plan,current,currentTarget); }
    catch(cause){ return blocked(current,ERROR_CODES.COMMIT_FAILED,{plan:plan,decision:planDecision,prepared:transaction}); }
    return finishCommit(current,plan,planDecision,transaction,result,meta,null);
  }

  function commitText(source,target,fullText,meta,expectedSource,expectedTarget){
    var current=text(source), currentTarget=trimmed(target);
    meta=recordLike(meta)?meta:{};
    if(!engines.actionGate||typeof engines.actionGate.additionFromText!=='function'){
      return blocked(current,ERROR_CODES.ACTION_GATE_UNAVAILABLE,{decision:semanticState.decision});
    }
    var expectedCurrent=expectedValue(meta,expectedSource,'expectedSource',current,false);
    var expectedGoal=expectedValue(meta,expectedTarget,'expectedTarget',currentTarget,true);
    var extraction;
    try{ extraction=engines.actionGate.additionFromText(expectedCurrent,text(fullText)); }
    catch(cause){ return blocked(current,ERROR_CODES.PLAN_FAILED,{decision:semanticState.decision}); }
    if(!extraction||!extraction.ok){
      return operation({
        status:extraction&&extraction.status||STATUSES.BLOCKED,changed:false,text:current,
        code:firstErrorCode(extraction)||(extraction&&extraction.status)||ERROR_CODES.PLAN_FAILED,
        plan:extraction||null,decision:semanticState.decision,transaction:semanticState.transaction,
        evidenceLevel:UNVERIFIED
      });
    }
    var nextMeta=copyRecord(meta);
    nextMeta.fullText=text(fullText);
    return commitLine(current,currentTarget,extraction.line||extraction.addition,nextMeta,expectedCurrent,expectedGoal);
  }

  function ledgerEntryForReceipt(receipt){
    var ledger=semanticState.ledger, entries=ledger&&ledger.entries;
    if(!Array.isArray(entries)) return null;
    for(var i=entries.length-1;i>=0;i--){
      var entry=entries[i];
      if(entry&&entry.seq===receipt.ledgerSeq&&
        entry.transactionId===receipt.transactionId&&
        text(entry.beforeText)===text(receipt.beforeText)&&
        text(entry.afterText)===text(receipt.afterText)&&
        entry.status!==STATUSES.ROLLED_BACK) return entry;
    }
    return null;
  }

  function rollbackConflict(current,receipt){
    clearList(uiState.portalUndo);
    semanticState.decision=null;
    semanticState.continuationProtocol=null;
    var result=resultRecord(STATUSES.BLOCKED,ERROR_CODES.ROLLBACK_CONFLICT,current,
      receipt&&receipt.transactionId,UNVERIFIED);
    var plan={
      version:VERSION,kind:'SemanticActionUndo',status:STATUSES.BLOCKED,
      receipt:receipt||null,evidence:UNVERIFIED,evidenceLevel:UNVERIFIED,soundness:NOT_COMPUTED
    };
    semanticState.action=plan;
    semanticState.transaction=result;
    return operation({
      status:STATUSES.BLOCKED,changed:false,text:current,code:ERROR_CODES.ROLLBACK_CONFLICT,
      plan:plan,decision:null,transaction:result,receipt:receipt||null,evidenceLevel:UNVERIFIED
    });
  }

  function canUndo(currentSource){
    var receipt=latestReceipt();
    return recordLike(receipt)&&typeof receipt.afterText==='string'&&text(currentSource)===receipt.afterText;
  }

  function undo(currentSource){
    var current=text(currentSource), receipt=latestReceipt();
    if(!receipt) return blocked(current,ERROR_CODES.UNDO_UNAVAILABLE,{receipt:null,writeTransaction:false});
    if(!recordLike(receipt)||typeof receipt.beforeText!=='string'||typeof receipt.afterText!=='string'||current!==receipt.afterText){
      return rollbackConflict(current,receipt);
    }
    if(!engines.ledger||typeof engines.ledger.markRolledBack!=='function'){
      return blocked(current,ERROR_CODES.LEDGER_UNAVAILABLE,{receipt:receipt,writeTransaction:false});
    }
    var entry=ledgerEntryForReceipt(receipt);
    if(!entry) return rollbackConflict(current,receipt);

    var next;
    try{ next=engines.ledger.markRolledBack(semanticState.ledger,receipt.transactionId,receipt.ledgerSeq); }
    catch(cause){ return rollbackConflict(current,receipt); }
    var marked=null;
    for(var i=next&&next.entries?next.entries.length-1:-1;i>=0;i--){
      if(next.entries[i]&&next.entries[i].seq===receipt.ledgerSeq&&next.entries[i].transactionId===receipt.transactionId){
        marked=next.entries[i]; break;
      }
    }
    if(!marked||marked.status!==STATUSES.ROLLED_BACK) return rollbackConflict(current,receipt);

    semanticState.ledger=next;
    uiState.portalUndo.pop();
    var log='\u043e\u0442\u043a\u0430\u0442 '+(receipt.transactionId||'tx')+': '+
      '\u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d \u043f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0438\u0439 \u0442\u0435\u043a\u0441\u0442';
    uiState.portalLog.unshift(log);
    capList(uiState.portalLog,LOG_LIMIT);

    semanticState.decision=null;
    semanticState.continuationProtocol=null;
    var result={
      version:VERSION,kind:'MRDP78SemanticActionRollback',status:STATUSES.ROLLED_BACK,
      transactionId:receipt.transactionId||null,text:receipt.beforeText,changed:true,code:null,errorCode:null,
      evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED,errors:[]
    };
    var plan={
      version:VERSION,kind:'SemanticActionUndo',status:STATUSES.ROLLED_BACK,
      receipt:receipt,entry:marked,evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
    };
    semanticState.action=plan;
    semanticState.transaction=result;
    return operation({
      status:STATUSES.ROLLED_BACK,changed:true,text:receipt.beforeText,code:null,
      plan:plan,decision:null,transaction:result,receipt:receipt,evidenceLevel:STRUCTURAL
    });
  }

  function replay(entry,currentSource,currentTarget){
    var current=text(currentSource), target=trimmed(currentTarget);
    var action={
      id:trimmed(entry&&entry.actionId)||'ledger-replay',
      label:trimmed(entry&&entry.actionLabel)||trimmed(entry&&entry.actionId)||'ledger replay',
      origin:'ledger-replay'
    };
    var plan={
      version:VERSION,kind:'SemanticLedgerReplay',status:entry&&entry.status||STATUSES.BLOCKED,
      transaction:entry&&entry.transaction||null,action:action,
      portPath:entry&&entry.portPath||'ID -> STATE -> EFFECT -> STATE',
      evidence:entry&&entry.evidence===STRUCTURAL?STRUCTURAL:UNVERIFIED,
      evidenceLevel:entry&&entry.evidenceLevel===STRUCTURAL?STRUCTURAL:UNVERIFIED,
      soundness:NOT_COMPUTED
    };
    semanticState.action=plan;
    semanticState.transaction=entry&&entry.transaction||null;
    if(!engines.ledger||typeof engines.ledger.replay!=='function'||typeof engines.ledger.record!=='function'){
      return blocked(current,ERROR_CODES.LEDGER_UNAVAILABLE,{plan:plan,replayOf:entry&&entry.seq});
    }

    var transaction=entry&&entry.transaction;
    var eligible=engines.ledger.canReplay&&recordLike(entry)?
      engines.ledger.canReplay(entry,text(entry.beforeText),trimmed(entry.target)):false;
    var receipt=latestReceipt();
    var result;
    if(eligible&&exactReceipt(receipt,transaction)&&current===text(entry.beforeText)&&target===trimmed(entry.target)){
      result=alreadyCommitted(transaction,current);
    }else{
      try{ result=engines.ledger.replay(entry,current,target); }
      catch(cause){ return blocked(current,ERROR_CODES.COMMIT_FAILED,{plan:plan,replayOf:entry&&entry.seq}); }
    }
    plan.status=result&&result.status||STATUSES.BLOCKED;
    var meta={
      id:action.id,label:'replay: '+action.label,origin:'ledger-replay',
      log:'replay #'+(entry&&entry.seq!=null?entry.seq:'?')+': '+action.label
    };
    return finishCommit(current,plan,semanticState.decision,transaction,result,meta,entry&&entry.seq);
  }

  function invalidate(){
    semanticState.decision=null;
    semanticState.continuationProtocol=null;
    semanticState.action=null;
    semanticState.transaction=null;
    clearList(uiState.portalUndo);
    return operation({
      status:STATUSES.INVALIDATED,changed:false,text:null,code:null,
      plan:null,decision:null,transaction:null,receipt:null,evidenceLevel:STRUCTURAL
    });
  }

  function snapshot(){
    var receipt=latestReceipt();
    return cloneData({
      version:VERSION,
      kind:'MRDP78SemanticActionControllerSnapshot',
      decision:semanticState.decision||null,
      continuationProtocol:semanticState.continuationProtocol||null,
      action:semanticState.action||null,
      transaction:semanticState.transaction||null,
      ledger:semanticState.ledger||null,
      portalUndo:uiState.portalUndo,
      portalLog:uiState.portalLog,
      receipt:receipt,
      canUndo:!!receipt,
      evidenceLevel:semanticState.ledger?STRUCTURAL:UNVERIFIED,
      soundness:NOT_COMPUTED
    });
  }

  return {
    version:VERSION,
    kind:KIND,
    evaluate:evaluate,
    commitLine:commitLine,
    commitText:commitText,
    commitPrepared:commitPrepared,
    undo:undo,
    replay:replay,
    invalidate:invalidate,
    canUndo:canUndo,
    snapshot:snapshot
  };
}

global.MRDP78SemanticActionController={
  version:VERSION,
  kind:KIND,
  statuses:STATUSES,
  STATUSES:STATUSES,
  errorCodes:ERROR_CODES,
  ERROR_CODES:ERROR_CODES,
  create:create
};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
