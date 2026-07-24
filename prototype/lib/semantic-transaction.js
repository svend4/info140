(function(global){
'use strict';

var VERSION='1.0.0';
var STRUCTURAL='STRUCTURAL';
var UNVERIFIED='UNVERIFIED';
var NOT_COMPUTED='NOT_COMPUTED';
var EPSILON=1e-12;

var STATUSES={
  READY:'READY',
  GATED:'GATED',
  BLOCKED:'BLOCKED',
  ROLLBACK:'ROLLBACK',
  COMMITTED:'COMMITTED',
  ALREADY_COMMITTED:'ALREADY_COMMITTED',
  ROLLED_BACK:'ROLLED_BACK'
};

var ERROR_CODES={
  TX_INVALID_ARGUMENT:'TX_INVALID_ARGUMENT',
  TX_CORE_UNAVAILABLE:'TX_CORE_UNAVAILABLE',
  TX_CORE_ANALYSIS_FAILED:'TX_CORE_ANALYSIS_FAILED',
  TX_DECISION_NOT_APPLY:'TX_DECISION_NOT_APPLY',
  TX_PROGRAM_NOT_COMPOSED:'TX_PROGRAM_NOT_COMPOSED',
  TX_EMPTY_INSERT_LINE:'TX_EMPTY_INSERT_LINE',
  TX_STALE_PREPARE_SOURCE:'TX_STALE_PREPARE_SOURCE',
  TX_DECISION_SOURCE_HASH_MISMATCH:'TX_DECISION_SOURCE_HASH_MISMATCH',
  TX_CANDIDATE_MISMATCH:'TX_CANDIDATE_MISMATCH',
  TX_DECISION_AFTER_MISMATCH:'TX_DECISION_AFTER_MISMATCH',
  TX_VERIFICATION_NOT_STRUCTURAL:'TX_VERIFICATION_NOT_STRUCTURAL',
  TX_VERIFICATION_CHECK_FAILED:'TX_VERIFICATION_CHECK_FAILED',
  TX_GUARD_ZONE_UNSAFE:'TX_GUARD_ZONE_UNSAFE',
  TX_GUARD_U_OUT_OF_RANGE:'TX_GUARD_U_OUT_OF_RANGE',
  TX_GUARD_DROP_EXCEEDED:'TX_GUARD_DROP_EXCEEDED',
  TX_CONFLICT_PRESENT:'TX_CONFLICT_PRESENT',
  TX_THEME_UNCONFIRMED:'TX_THEME_UNCONFIRMED',
  TX_NEWNESS_UNCONFIRMED:'TX_NEWNESS_UNCONFIRMED',
  TX_MOVEMENT_UNCONFIRMED:'TX_MOVEMENT_UNCONFIRMED',
  TX_INVALID_TRANSACTION:'TX_INVALID_TRANSACTION',
  TX_TRANSACTION_INTEGRITY:'TX_TRANSACTION_INTEGRITY',
  TX_NOT_READY:'TX_NOT_READY',
  TX_STALE_SOURCE:'TX_STALE_SOURCE',
  TX_STALE_TARGET:'TX_STALE_TARGET'
};

var ERROR_MESSAGES={};
ERROR_MESSAGES[ERROR_CODES.TX_INVALID_ARGUMENT]='prepare requires a source string and a decision object.';
ERROR_MESSAGES[ERROR_CODES.TX_CORE_UNAVAILABLE]='MRDSemanticCore with hash, analyzeText and stabilityGuard is required.';
ERROR_MESSAGES[ERROR_CODES.TX_CORE_ANALYSIS_FAILED]='MRDSemanticCore could not structurally analyze the transaction.';
ERROR_MESSAGES[ERROR_CODES.TX_DECISION_NOT_APPLY]='Only an apply decision can open a transaction.';
ERROR_MESSAGES[ERROR_CODES.TX_PROGRAM_NOT_COMPOSED]='The typed program must have status composed.';
ERROR_MESSAGES[ERROR_CODES.TX_EMPTY_INSERT_LINE]='The decision must expose a non-empty insertLine.';
ERROR_MESSAGES[ERROR_CODES.TX_STALE_PREPARE_SOURCE]='The decision was prepared for a different source snapshot.';
ERROR_MESSAGES[ERROR_CODES.TX_DECISION_SOURCE_HASH_MISMATCH]='The decision source hash does not match the preparation source.';
ERROR_MESSAGES[ERROR_CODES.TX_CANDIDATE_MISMATCH]='The selected candidate does not match insertLine.';
ERROR_MESSAGES[ERROR_CODES.TX_DECISION_AFTER_MISMATCH]='The decision afterText does not match source plus candidate.';
ERROR_MESSAGES[ERROR_CODES.TX_VERIFICATION_NOT_STRUCTURAL]='The decision verification must be STRUCTURAL.';
ERROR_MESSAGES[ERROR_CODES.TX_VERIFICATION_CHECK_FAILED]='One or more decision verification checks failed.';
ERROR_MESSAGES[ERROR_CODES.TX_GUARD_ZONE_UNSAFE]='The candidate leaves the guard outside safe/thin.';
ERROR_MESSAGES[ERROR_CODES.TX_GUARD_U_OUT_OF_RANGE]='The candidate leaves u outside the strict open interval (0.18, 0.82).';
ERROR_MESSAGES[ERROR_CODES.TX_GUARD_DROP_EXCEEDED]='The candidate drops the guard score by more than 0.12.';
ERROR_MESSAGES[ERROR_CODES.TX_CONFLICT_PRESENT]='The candidate leaves a semantic conflict.';
ERROR_MESSAGES[ERROR_CODES.TX_THEME_UNCONFIRMED]='Existing structural checks do not confirm theme continuity.';
ERROR_MESSAGES[ERROR_CODES.TX_NEWNESS_UNCONFIRMED]='Existing structural checks do not confirm novelty.';
ERROR_MESSAGES[ERROR_CODES.TX_MOVEMENT_UNCONFIRMED]='Existing structural checks do not confirm semantic movement.';
ERROR_MESSAGES[ERROR_CODES.TX_INVALID_TRANSACTION]='A transaction object is required.';
ERROR_MESSAGES[ERROR_CODES.TX_TRANSACTION_INTEGRITY]='The transaction snapshot or hashes were modified.';
ERROR_MESSAGES[ERROR_CODES.TX_NOT_READY]='Only a READY transaction can be committed.';
ERROR_MESSAGES[ERROR_CODES.TX_STALE_SOURCE]='The current source hash differs from the prepared source hash.';
ERROR_MESSAGES[ERROR_CODES.TX_STALE_TARGET]='The current target differs from the prepared target snapshot.';

function core(){ return global.MRDSemanticCore||null; }
function hasOwn(value,key){ return Object.prototype.hasOwnProperty.call(value,key); }
function isRecord(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function text(value){ return value==null?'':String(value); }
function trimmed(value){ return text(value).trim(); }
function finite(value){ return typeof value==='number'&&isFinite(value); }
function number(value,fallback){ value=Number(value); return isFinite(value)?value:fallback; }
function lower(value){ return trimmed(value).toLowerCase(); }

function appendLine(source,line){
  source=text(source); line=trimmed(line);
  if(!source) return line;
  if(!line) return source;
  return source+(/\r?\n$/.test(source)?'':'\n')+line;
}

function canonicalAfter(source,line){
  source=trimmed(source); line=trimmed(line);
  return source?(line?source+'\n'+line:source):line;
}

function hashWith(c,value){
  var result=Number(c.hash(text(value)));
  if(!isFinite(result)) throw new Error('MRDSemanticCore.hash returned a non-finite value.');
  return result>>>0;
}

function hex(value){ return ('00000000'+((Number(value)||0)>>>0).toString(16)).slice(-8); }

function error(code,phase,checkId,expected,actual,detail){
  return {
    code:code,
    phase:phase||'transaction',
    check:checkId||null,
    message:ERROR_MESSAGES[code]||code,
    expected:expected,
    actual:actual,
    detail:detail||null
  };
}

function addCheck(list,phase,id,ok,code,expected,actual,source){
  var item={
    id:id,
    phase:phase,
    ok:!!ok,
    code:ok?null:code,
    expected:expected,
    actual:actual,
    source:source||'transaction',
    evidence:STRUCTURAL,
    soundness:NOT_COMPUTED
  };
  list.push(item);
  return item;
}

function failedErrors(checks){
  var out=[];
  for(var i=0;i<checks.length;i++){
    var item=checks[i];
    if(item.ok||!item.code) continue;
    out.push(error(item.code,item.phase,item.id,item.expected,item.actual,null));
  }
  return out;
}

function groupChecks(checks){
  var groups={gate:[],pre:[],inv:[],post:[]};
  for(var i=0;i<checks.length;i++){
    var phase=checks[i].phase;
    if(!groups[phase]) groups[phase]=[];
    groups[phase].push(checks[i]);
  }
  return groups;
}

function phaseOk(checks,phase){
  var found=false;
  for(var i=0;i<checks.length;i++){
    if(checks[i].phase!==phase) continue;
    found=true;
    if(!checks[i].ok) return false;
  }
  return found;
}

function verificationCheck(verification,ids){
  var checks=verification&&Array.isArray(verification.checks)?verification.checks:[];
  for(var i=0;i<checks.length;i++){
    var id=lower(checks[i]&&checks[i].id);
    if(ids.indexOf(id)>=0) return checks[i];
  }
  return null;
}

function allVerificationChecksPass(verification){
  var checks=verification&&Array.isArray(verification.checks)?verification.checks:[];
  if(!checks.length) return false;
  for(var i=0;i<checks.length;i++) if(!checks[i]||checks[i].ok!==true) return false;
  return true;
}

function decisionSourceOf(decision){
  if(typeof decision.source==='string') return decision.source;
  if(typeof decision.sourceText==='string') return decision.sourceText;
  if(decision.interpretation&&typeof decision.interpretation.text==='string') return decision.interpretation.text;
  if(decision.verification&&typeof decision.verification.source==='string') return decision.verification.source;
  return null;
}

function decisionSourceHashOf(decision){
  var verification=decision.verification||{}, typedProgram=decision.typedProgram||{};
  if(finite(decision.sourceHash)) return decision.sourceHash>>>0;
  if(finite(verification.sourceHash)) return verification.sourceHash>>>0;
  if(finite(typedProgram.sourceHash)) return typedProgram.sourceHash>>>0;
  return null;
}

function candidateEvidence(decision){
  var typedProgram=decision.typedProgram||{}, values=[];
  if(hasOwn(decision,'candidate')) values.push({source:'decision.candidate',value:trimmed(decision.candidate)});
  if(hasOwn(typedProgram,'candidate')) values.push({source:'decision.typedProgram.candidate',value:trimmed(typedProgram.candidate)});
  return values;
}

function conflictCount(analysis,guard){
  var count=analysis&&analysis.conflicts&&analysis.conflicts.length||0;
  var graphCount=analysis&&analysis.graph&&analysis.graph.metrics&&number(analysis.graph.metrics.conflictCount,0)||0;
  count=Math.max(count,graphCount);
  if(lower(guard&&guard.zone)==='conflict'||lower(guard&&guard.risk)==='conflict') count=Math.max(count,1);
  return count;
}

function movementEvidence(decision,candidate){
  var verification=decision.verification||{};
  var direct=verificationCheck(verification,['movement','move','motion']);
  if(direct&&direct.ok===true){
    return {ok:true,value:number(direct.value,1),source:'decision.verification.checks.'+lower(direct.id)};
  }

  var best=decision.best;
  if(best&&trimmed(best.line)===candidate&&lower(best.status)==='accept'){
    var bestMove=number(best.move,NaN);
    return {ok:isFinite(bestMove)&&bestMove>=.25,value:bestMove,source:'decision.best.move'};
  }

  var protocol=decision.protocol;
  if(protocol&&trimmed(protocol.line||protocol.insertLine)===candidate&&lower(protocol.status)==='accept'){
    var protocolMove=number(protocol.after&&protocol.after.move,NaN);
    var protocolPost=!!(protocol.contract&&protocol.contract.post===true);
    return {ok:protocolPost&&isFinite(protocolMove)&&protocolMove>=.25,value:protocolMove,source:'decision.protocol.after.move'};
  }
  return {ok:false,value:null,source:'decision'};
}

function baseTransaction(fields,status,checks,errors,evidence){
  var groups=groupChecks(checks);
  var pre=phaseOk(checks,'pre'), inv=phaseOk(checks,'inv'), post=phaseOk(checks,'post');
  return {
    version:VERSION,
    kind:'MRDSemanticTransaction',
    status:status,
    transactionId:fields.transactionId||null,
    witness:fields.witness||null,
    decisionWitness:fields.decisionWitness||null,
    source:fields.source,
    sourceHash:fields.sourceHash,
    candidate:fields.candidate,
    insertLine:fields.insertLine,
    afterText:fields.afterText,
    afterHash:fields.afterHash,
    target:fields.target,
    targetHash:fields.targetHash,
    beforeGuard:fields.beforeGuard||null,
    afterGuard:fields.afterGuard||null,
    checks:checks,
    checkGroups:groups,
    errors:errors,
    contract:{
      pre:pre,
      inv:inv,
      post:post,
      structural:status===STATUSES.READY,
      verification:fields.verification||UNVERIFIED,
      evidence:evidence,
      soundness:NOT_COMPUTED
    },
    verification:fields.verification||UNVERIFIED,
    evidence:evidence,
    evidenceLevel:evidence,
    soundness:NOT_COMPUTED
  };
}

function prepare(source,decision,target){
  if(arguments.length===1&&isRecord(source)&&(hasOwn(source,'source')||hasOwn(source,'decision'))){
    target=source.target;
    decision=source.decision;
    source=source.source;
  }

  var sourceValid=typeof source==='string';
  var sourceText=sourceValid?source:text(source);
  var targetText=trimmed(target);
  var decisionValid=isRecord(decision);
  decision=decisionValid?decision:{};
  var typedProgram=isRecord(decision.typedProgram)?decision.typedProgram:{};
  var verification=isRecord(decision.verification)?decision.verification:{};
  var insertLine=trimmed(decision.insertLine);
  var candidate=insertLine;
  var afterText=appendLine(sourceText,candidate);
  var checks=[];

  addCheck(checks,'gate','arguments',sourceValid&&decisionValid,ERROR_CODES.TX_INVALID_ARGUMENT,'source string and decision object',{sourceType:typeof source,decisionType:typeof decision},'prepare');
  addCheck(checks,'gate','decision_apply',lower(decision.decision)==='apply',ERROR_CODES.TX_DECISION_NOT_APPLY,'apply',decision.decision||null,'decision.decision');
  addCheck(checks,'gate','typed_program_composed',lower(typedProgram.status)==='composed',ERROR_CODES.TX_PROGRAM_NOT_COMPOSED,'composed',typedProgram.status||null,'decision.typedProgram.status');
  addCheck(checks,'gate','insert_line_nonempty',candidate.length>0,ERROR_CODES.TX_EMPTY_INSERT_LINE,'non-empty insertLine',candidate,'decision.insertLine');

  var c=core();
  var coreReady=!!c&&typeof c.hash==='function'&&typeof c.analyzeText==='function'&&typeof c.stabilityGuard==='function';
  var fields={
    source:sourceText,
    sourceHash:null,
    candidate:candidate,
    insertLine:insertLine,
    afterText:afterText,
    afterHash:null,
    target:targetText,
    targetHash:null,
    transactionId:null,
    witness:null,
    decisionWitness:verification.witness||null,
    verification:verification.evidenceLevel||verification.evidence||UNVERIFIED
  };

  var gateErrors=failedErrors(checks);
  if(gateErrors.length) return baseTransaction(fields,STATUSES.GATED,checks,gateErrors,UNVERIFIED);

  addCheck(checks,'pre','core_available',coreReady,ERROR_CODES.TX_CORE_UNAVAILABLE,'MRDSemanticCore hash/analyzeText/stabilityGuard',coreReady?'available':'unavailable','MRDSemanticCore');
  if(!coreReady) return baseTransaction(fields,STATUSES.BLOCKED,checks,failedErrors(checks),UNVERIFIED);

  try{
    fields.sourceHash=hashWith(c,sourceText);
    fields.afterHash=hashWith(c,afterText);
    fields.targetHash=hashWith(c,targetText);
    var seed=sourceText+'\u0000'+candidate+'\u0000'+targetText+'\u0000'+trimmed(fields.decisionWitness);
    fields.transactionId='tx-'+hex(hashWith(c,seed));
    fields.witness='#'+hex(hashWith(c,fields.transactionId+'|'+fields.sourceHash+'|'+fields.afterHash));

    var decisionSource=decisionSourceOf(decision);
    var sourceFresh=decisionSource!==null&&trimmed(decisionSource)===trimmed(sourceText);
    addCheck(checks,'pre','source_fresh',sourceFresh,ERROR_CODES.TX_STALE_PREPARE_SOURCE,trimmed(decisionSource),trimmed(sourceText),'decision source snapshot');

    var suppliedSourceHash=decisionSourceHashOf(decision);
    if(suppliedSourceHash!==null){
      var canonicalSourceHash=hashWith(c,trimmed(sourceText));
      var sourceHashMatches=suppliedSourceHash===fields.sourceHash||suppliedSourceHash===canonicalSourceHash;
      addCheck(checks,'pre','decision_source_hash',sourceHashMatches,ERROR_CODES.TX_DECISION_SOURCE_HASH_MISMATCH,[fields.sourceHash,canonicalSourceHash],suppliedSourceHash,'decision source hash');
    }

    var candidates=candidateEvidence(decision), candidatesMatch=candidates.length>0, candidateActual=[];
    for(var i=0;i<candidates.length;i++){
      candidateActual.push({source:candidates[i].source,value:candidates[i].value});
      if(candidates[i].value!==candidate) candidatesMatch=false;
    }
    addCheck(checks,'pre','candidate_matches_insert_line',candidatesMatch,ERROR_CODES.TX_CANDIDATE_MISMATCH,candidate,candidateActual,'decision candidate fields');

    if(typeof verification.afterText==='string'){
      var expectedDecisionAfter=canonicalAfter(sourceText,candidate);
      addCheck(checks,'pre','decision_after_text',verification.afterText===expectedDecisionAfter,ERROR_CODES.TX_DECISION_AFTER_MISMATCH,expectedDecisionAfter,verification.afterText,'decision.verification.afterText');
    }

    var preErrors=failedErrors(checks);
    if(preErrors.length) return baseTransaction(fields,STATUSES.BLOCKED,checks,preErrors,UNVERIFIED);

    var beforeAnalysis=c.analyzeText(sourceText);
    var beforeGuard=c.stabilityGuard(sourceText)||{};
    var afterAnalysis=c.analyzeText(afterText);
    var afterGuard=c.stabilityGuard(afterText)||{};
    fields.beforeGuard=beforeGuard;
    fields.afterGuard=afterGuard;

    var beforeScore=number(beforeGuard.score,0), afterScore=number(afterGuard.score,0);
    var u=number(afterGuard.u,NaN), zone=lower(afterGuard.zone);
    var conflicts=conflictCount(afterAnalysis,afterGuard);
    addCheck(checks,'inv','guard_zone',zone==='safe'||zone==='thin',ERROR_CODES.TX_GUARD_ZONE_UNSAFE,'safe or thin',zone||null,'MRDSemanticCore.stabilityGuard(afterText)');
    addCheck(checks,'inv','guard_open_interval',isFinite(u)&&u>.18&&u<.82,ERROR_CODES.TX_GUARD_U_OUT_OF_RANGE,'0.18 < u < 0.82',isFinite(u)?u:null,'MRDSemanticCore.stabilityGuard(afterText)');
    addCheck(checks,'inv','guard_drop',afterScore+EPSILON>=beforeScore-.12,ERROR_CODES.TX_GUARD_DROP_EXCEEDED,'after >= before - 0.12',{before:beforeScore,after:afterScore,drop:beforeScore-afterScore},'MRDSemanticCore.stabilityGuard');
    addCheck(checks,'inv','no_conflict',conflicts===0,ERROR_CODES.TX_CONFLICT_PRESENT,0,conflicts,'MRDSemanticCore.analyzeText(afterText)');

    var verificationStructural=(verification.evidenceLevel||verification.evidence)===STRUCTURAL;
    addCheck(checks,'post','verification_structural',verificationStructural,ERROR_CODES.TX_VERIFICATION_NOT_STRUCTURAL,STRUCTURAL,verification.evidenceLevel||verification.evidence||null,'decision.verification');
    addCheck(checks,'post','verification_checks',allVerificationChecksPass(verification),ERROR_CODES.TX_VERIFICATION_CHECK_FAILED,'all existing checks ok',verification.checks||null,'decision.verification.checks');

    var theme=verificationCheck(verification,['theme','topic','theme_continuity']);
    var newness=verificationCheck(verification,['newness','novelty']);
    var movement=movementEvidence(decision,candidate);
    var recomputedMove=number(afterAnalysis&&afterAnalysis.move,NaN);
    var movementOk=movement.ok&&isFinite(recomputedMove)&&recomputedMove>=.25;
    addCheck(checks,'post','theme_confirmed',!!theme&&theme.ok===true,ERROR_CODES.TX_THEME_UNCONFIRMED,'existing theme check ok',theme||null,'decision.verification.checks');
    addCheck(checks,'post','newness_confirmed',!!newness&&newness.ok===true,ERROR_CODES.TX_NEWNESS_UNCONFIRMED,'existing newness/novelty check ok',newness||null,'decision.verification.checks');
    addCheck(checks,'post','movement_confirmed',movementOk,ERROR_CODES.TX_MOVEMENT_UNCONFIRMED,'accepted existing movement >= 0.25',{existing:movement,recomputed:recomputedMove},movement.source);

    var invOk=phaseOk(checks,'inv'), postOk=phaseOk(checks,'post');
    var status=invOk?(postOk?STATUSES.READY:STATUSES.GATED):STATUSES.ROLLBACK;
    var evidence=(invOk||status===STATUSES.ROLLBACK)?STRUCTURAL:UNVERIFIED;
    return baseTransaction(fields,status,checks,failedErrors(checks),evidence);
  }catch(cause){
    checks.push({
      id:'core_analysis',phase:'pre',ok:false,code:ERROR_CODES.TX_CORE_ANALYSIS_FAILED,
      expected:'successful structural analysis',actual:cause&&cause.message?cause.message:String(cause),
      source:'MRDSemanticCore',evidence:UNVERIFIED,soundness:NOT_COMPUTED
    });
    return baseTransaction(fields,STATUSES.BLOCKED,checks,failedErrors(checks),UNVERIFIED);
  }
}

function commit(transaction,currentSource,currentTarget){
  var current=text(currentSource);
  var targetSupplied=arguments.length>=3, currentTarget=trimmed(currentTarget);
  var base={
    version:VERSION,
    kind:'MRDSemanticTransactionCommit',
    transactionId:isRecord(transaction)?transaction.transactionId||null:null,
    witness:isRecord(transaction)?transaction.witness||null:null,
    text:current,
    changed:false,
    currentSourceHash:null,
    sourceHash:isRecord(transaction)?transaction.sourceHash:null,
    afterHash:isRecord(transaction)?transaction.afterHash:null,
    targetHash:isRecord(transaction)?transaction.targetHash:null,
    currentTargetHash:null,
    evidence:UNVERIFIED,
    evidenceLevel:UNVERIFIED,
    soundness:NOT_COMPUTED,
    errors:[]
  };

  if(!isRecord(transaction)){
    base.status=STATUSES.BLOCKED;
    base.code=ERROR_CODES.TX_INVALID_TRANSACTION;
    base.errorCode=base.code;
    base.errors=[error(base.code,'commit','transaction','transaction object',transaction,null)];
    return base;
  }
  if(transaction.status!==STATUSES.READY){
    base.status=STATUSES.BLOCKED;
    base.code=ERROR_CODES.TX_NOT_READY;
    base.errorCode=base.code;
    base.errors=[error(base.code,'commit','transaction_ready',STATUSES.READY,transaction.status,null)];
    return base;
  }

  var c=core();
  var coreReady=!!c&&typeof c.hash==='function';
  if(!coreReady){
    base.status=STATUSES.BLOCKED;
    base.code=ERROR_CODES.TX_CORE_UNAVAILABLE;
    base.errorCode=base.code;
    base.errors=[error(base.code,'commit','core_available','MRDSemanticCore.hash','unavailable',null)];
    return base;
  }

  try{
    base.currentSourceHash=hashWith(c,current);
    if(targetSupplied) base.currentTargetHash=hashWith(c,currentTarget);
    var sourceHash=hashWith(c,transaction.source);
    var afterHash=hashWith(c,transaction.afterText);
    var targetHash=hashWith(c,transaction.target||'');
    var intact=sourceHash===transaction.sourceHash&&afterHash===transaction.afterHash&&targetHash===transaction.targetHash;
    if(!intact){
      base.status=STATUSES.BLOCKED;
      base.code=ERROR_CODES.TX_TRANSACTION_INTEGRITY;
      base.errorCode=base.code;
      base.errors=[error(base.code,'commit','transaction_integrity',{sourceHash:sourceHash,afterHash:afterHash,targetHash:targetHash},{sourceHash:transaction.sourceHash,afterHash:transaction.afterHash,targetHash:transaction.targetHash},null)];
      return base;
    }

    if(current===transaction.afterText){
      base.status=STATUSES.ALREADY_COMMITTED;
      base.code=null;
      base.errorCode=null;
      base.text=transaction.afterText;
      base.evidence=STRUCTURAL;
      base.evidenceLevel=STRUCTURAL;
      return base;
    }

    if(targetSupplied&&(base.currentTargetHash!==transaction.targetHash||currentTarget!==transaction.target)){
      base.status=STATUSES.BLOCKED;
      base.code=ERROR_CODES.TX_STALE_TARGET;
      base.errorCode=base.code;
      base.errors=[error(base.code,'commit','target_hash',transaction.targetHash,base.currentTargetHash,{textUnchanged:true})];
      return base;
    }

    if(base.currentSourceHash!==transaction.sourceHash||current!==transaction.source){
      base.status=STATUSES.BLOCKED;
      base.code=ERROR_CODES.TX_STALE_SOURCE;
      base.errorCode=base.code;
      base.errors=[error(base.code,'commit','source_hash',transaction.sourceHash,base.currentSourceHash,{textUnchanged:true})];
      return base;
    }

    base.status=STATUSES.COMMITTED;
    base.code=null;
    base.errorCode=null;
    base.text=transaction.afterText;
    base.changed=true;
    base.evidence=STRUCTURAL;
    base.evidenceLevel=STRUCTURAL;
    return base;
  }catch(cause){
    base.status=STATUSES.BLOCKED;
    base.code=ERROR_CODES.TX_CORE_ANALYSIS_FAILED;
    base.errorCode=base.code;
    base.errors=[error(base.code,'commit','hash','finite source hashes',cause&&cause.message?cause.message:String(cause),null)];
    return base;
  }
}

function rollback(transaction,reason){
  var valid=isRecord(transaction);
  var source=valid&&typeof transaction.source==='string'?transaction.source:'';
  return {
    version:VERSION,
    kind:'MRDSemanticTransactionRollback',
    status:STATUSES.ROLLED_BACK,
    transactionId:valid?transaction.transactionId||null:null,
    witness:valid?transaction.witness||null:null,
    reason:trimmed(reason)||'rollback requested',
    previousStatus:valid?transaction.status||null:null,
    text:source,
    source:source,
    changed:false,
    code:null,
    errorCode:null,
    errors:valid?[]:[error(ERROR_CODES.TX_INVALID_TRANSACTION,'rollback','transaction','transaction object',transaction,null)],
    evidence:valid&&transaction.evidence===STRUCTURAL?STRUCTURAL:UNVERIFIED,
    evidenceLevel:valid&&transaction.evidence===STRUCTURAL?STRUCTURAL:UNVERIFIED,
    soundness:NOT_COMPUTED
  };
}

global.MRDSemanticTransaction={
  version:VERSION,
  statuses:STATUSES,
  errorCodes:ERROR_CODES,
  STATUS:STATUSES,
  STATUSES:STATUSES,
  ERROR_CODES:ERROR_CODES,
  prepare:prepare,
  commit:commit,
  rollback:rollback
};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
