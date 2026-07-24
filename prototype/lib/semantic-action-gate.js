(function(global){
'use strict';

var VERSION='1.0.0';
var STRUCTURAL='STRUCTURAL';
var UNVERIFIED='UNVERIFIED';
var NOT_COMPUTED='NOT_COMPUTED';
var STATUSES={READY:'READY',GATED:'GATED',BLOCKED:'BLOCKED',ROLLBACK:'ROLLBACK'};
var ERROR_CODES={
  ACTION_INVALID:'ACTION_INVALID',
  ACTION_EMPTY:'ACTION_EMPTY',
  ACTION_SOURCE_TOO_SHORT:'ACTION_SOURCE_TOO_SHORT',
  ACTION_SOURCE_UNRECOGNIZED:'ACTION_SOURCE_UNRECOGNIZED',
  ACTION_SOURCE_AMBIGUOUS:'ACTION_SOURCE_AMBIGUOUS',
  ACTION_SOURCE_NEGATED:'ACTION_SOURCE_NEGATED',
  ACTION_VERIFY_FAILED:'ACTION_VERIFY_FAILED',
  ACTION_DSL_UNAVAILABLE:'ACTION_DSL_UNAVAILABLE',
  ACTION_COMPOSE_FAILED:'ACTION_COMPOSE_FAILED',
  ACTION_UNSAFE_RING:'ACTION_UNSAFE_RING',
  ACTION_PREFIX_MISMATCH:'ACTION_PREFIX_MISMATCH',
  ACTION_NO_DELTA:'ACTION_NO_DELTA',
  ACTION_TRANSACTION_UNAVAILABLE:'ACTION_TRANSACTION_UNAVAILABLE',
  ACTION_PLAN_INVALID:'ACTION_PLAN_INVALID'
};

function core(){ return global.MRDSemanticCore||null; }
function semantic(){ return global.MRDSemanticDecision||null; }
function dsl(){ return global.MRDSemanticCommandDSL||null; }
function transactions(){ return global.MRDSemanticTransaction||null; }
function record(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function text(value){ return value==null?'':String(value); }
function trimmed(value){ return text(value).trim(); }
function lower(value){ return trimmed(value).toLowerCase(); }
function error(code,phase,detail){ return {code:code,phase:phase||'action',detail:detail||null}; }
function firstError(errors){ return errors&&errors.length?errors[0]:null; }
function evidenceFor(ok){ return ok?STRUCTURAL:UNVERIFIED; }

function additionFromText(source,fullText){
  source=text(source); fullText=text(fullText);
  if(fullText===source) return {ok:false,status:STATUSES.GATED,addition:'',line:'',errors:[error(ERROR_CODES.ACTION_NO_DELTA,'extract')]};
  if(!source){
    var only=trimmed(fullText);
    return only?{ok:true,status:STATUSES.READY,addition:only,line:only,fullText:fullText,errors:[]}:
      {ok:false,status:STATUSES.GATED,addition:'',line:'',errors:[error(ERROR_CODES.ACTION_NO_DELTA,'extract')]};
  }
  var prefix=source+'\n';
  if(fullText.indexOf(prefix)!==0){
    return {ok:false,status:STATUSES.BLOCKED,addition:'',line:'',fullText:fullText,errors:[error(ERROR_CODES.ACTION_PREFIX_MISMATCH,'extract',{expectedPrefix:prefix})]};
  }
  var addition=fullText.slice(prefix.length);
  if(!trimmed(addition)) return {ok:false,status:STATUSES.GATED,addition:'',line:'',errors:[error(ERROR_CODES.ACTION_NO_DELTA,'extract')]};
  return {ok:true,status:STATUSES.READY,addition:addition,line:addition,fullText:fullText,errors:[]};
}

function normalizeAction(source,action){
  if(typeof action==='string') action={line:action};
  if(!record(action)) return {ok:false,errors:[error(ERROR_CODES.ACTION_INVALID,'normalize')]};
  var line=action.line!=null?action.line:(action.addition!=null?action.addition:action.insertLine);
  var extraction=null;
  if(line==null&&action.fullText!=null){ extraction=additionFromText(source,action.fullText); line=extraction.line; }
  line=trimmed(line);
  var id=trimmed(action.id||action.action||action.kind||action.type||'semantic-action');
  var normalized={
    id:id||'semantic-action',label:trimmed(action.label)||id||'semantic action',line:line,
    origin:trimmed(action.origin||action.sourceModule||action.kind||action.type||'p78'),
    contract:record(action.contract)?action.contract:{},fullText:action.fullText==null?null:text(action.fullText),
    extraction:extraction
  };
  if(extraction&&!extraction.ok) return {ok:false,action:normalized,errors:extraction.errors||[]};
  if(!line) return {ok:false,action:normalized,errors:[error(ERROR_CODES.ACTION_EMPTY,'normalize')]};
  if(action.fullText!=null){
    var exact=additionFromText(source,action.fullText);
    if(!exact.ok||trimmed(exact.line)!==line) return {ok:false,action:normalized,errors:(exact.errors||[]).concat([error(ERROR_CODES.ACTION_PREFIX_MISMATCH,'normalize')])};
  }
  return {ok:true,action:normalized,errors:[]};
}

function descriptor(id,inputPort,outputPort,contract){
  return {ok:true,kind:'TypedActionDescriptor',id:id,inputPort:inputPort,outputPort:outputPort,
    contract:contract,evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED};
}

function typedProgram(action,verification){
  var engine=dsl();
  if(!engine||typeof engine.compose!=='function') return {ok:false,status:'blocked',portPath:'ID -> STATE -> EFFECT -> STATE',
    errors:[error(ERROR_CODES.ACTION_DSL_UNAVAILABLE,'compose')],evidence:UNVERIFIED,evidenceLevel:UNVERIFIED,soundness:NOT_COMPUTED};
  var contract=action.contract||{};
  var stages=[
    descriptor('interpret-action','ID','STATE',{
      pre:contract.pre||'source interpretation gates passed',
      inv:'source snapshot and token provenance remain observable',
      post:'typed semantic STATE is available',
      proof:'structural interpretation only'
    }),
    descriptor(action.id,'STATE','EFFECT',{
      pre:contract.pre||'action line is non-empty and independently verified',
      inv:contract.inv||'action cannot bypass the open-ring guard',
      post:contract.post||'one declarative EFFECT is selected',
      proof:contract.proof||'action descriptor and verification trace only'
    }),
    descriptor('commit-action','EFFECT','STATE',{
      pre:'effect matches the prepared action line',
      inv:'source and target CAS snapshots remain exact',
      post:'next semantic STATE equals source plus action line',
      proof:(verification&&verification.witness||'no-witness')+'; mathematical truth was not computed'
    })
  ];
  var first=engine.compose(stages[0],stages[1]);
  var composed=first&&first.ok?engine.compose(first,stages[2]):first;
  composed=composed||{ok:false,errors:[error(ERROR_CODES.ACTION_COMPOSE_FAILED,'compose')]};
  return {ok:!!composed.ok,status:composed.ok?'composed':'blocked',portPath:'ID -> STATE -> EFFECT -> STATE',
    stages:stages,composition:composed,contract:composed.ok?composed.contract:null,errors:composed.errors||[],
    candidate:action.line,evidence:evidenceFor(!!composed.ok),evidenceLevel:evidenceFor(!!composed.ok),soundness:NOT_COMPUTED};
}

function gatedPlan(source,target,action,status,errors,interpretation,verification,typed){
  var txEngine=transactions(), decisionLike={decision:'reject',source:source,candidate:'',insertLine:'',
    interpretation:interpretation||null,verification:verification||{checks:[],evidenceLevel:UNVERIFIED,soundness:NOT_COMPUTED},
    typedProgram:typed||{status:'gated',candidate:'',evidence:UNVERIFIED,evidenceLevel:UNVERIFIED,soundness:NOT_COMPUTED}};
  var tx=txEngine&&typeof txEngine.prepare==='function'?txEngine.prepare(source,decisionLike,target):null;
  return {version:VERSION,kind:'SemanticActionPlan',ok:false,status:status,action:action||null,typedProgram:typed||null,
    verification:verification||null,transaction:tx,errors:errors||[],error:firstError(errors),
    evidence:UNVERIFIED,evidenceLevel:UNVERIFIED,soundness:NOT_COMPUTED};
}

function plan(source,action,target){
  source=text(source); target=trimmed(target);
  var normalized=normalizeAction(source,action);
  if(!normalized.ok) return gatedPlan(source,target,normalized.action,STATUSES.GATED,normalized.errors);
  action=normalized.action;
  var sem=semantic(), c=core(), txEngine=transactions();
  if(!sem||typeof sem.interpret!=='function'||typeof sem.verify!=='function'||!c||typeof c.analyzeText!=='function'||typeof c.stabilityGuard!=='function'){
    return gatedPlan(source,target,action,STATUSES.BLOCKED,[error(ERROR_CODES.ACTION_INVALID,'dependencies')]);
  }
  var interpretation=sem.interpret(source), sourceErrors=[];
  if((interpretation.contentCount||0)<3) sourceErrors.push(error(ERROR_CODES.ACTION_SOURCE_TOO_SHORT,'gate'));
  if((interpretation.coverage||0)<.30) sourceErrors.push(error(ERROR_CODES.ACTION_SOURCE_UNRECOGNIZED,'gate'));
  if((interpretation.ambiguities||[]).some(function(item){return !item.resolved;})) sourceErrors.push(error(ERROR_CODES.ACTION_SOURCE_AMBIGUOUS,'gate'));
  if((interpretation.negatedOperators||[]).length&&!(interpretation.positiveOperators||[]).some(function(item){return (interpretation.blockedDirections||[]).indexOf(item.direction)<0;})){
    sourceErrors.push(error(ERROR_CODES.ACTION_SOURCE_NEGATED,'gate'));
  }
  var verification=sem.verify(source,action.line,target,interpretation), afterText=source?(source.replace(/\s+$/,'')+'\n'+action.line):action.line;
  var after=c.analyzeText(afterText), move=Number(after&&after.move)||0;
  verification={
    evidenceLevel:verification.evidenceLevel||UNVERIFIED,evidence:verification.evidenceLevel||UNVERIFIED,
    soundness:NOT_COMPUTED,checks:(verification.checks||[]).slice(),witness:verification.witness||null,
    metrics:verification.metrics||{},afterText:verification.afterText||afterText
  };
  verification.checks.push({id:'movement',ok:move>=.25,value:move});
  var typed=typedProgram(action,verification), guard=c.stabilityGuard(afterText)||{}, unsafe=['center','edge','conflict'].indexOf(lower(guard.zone))>=0;
  if(unsafe) return gatedPlan(source,target,action,STATUSES.ROLLBACK,[error(ERROR_CODES.ACTION_UNSAFE_RING,'inv',{zone:guard.zone})],interpretation,verification,typed);
  if(sourceErrors.length) return gatedPlan(source,target,action,STATUSES.GATED,sourceErrors,interpretation,verification,typed);
  if(verification.evidenceLevel!==STRUCTURAL||verification.checks.some(function(item){return !item.ok;})){
    return gatedPlan(source,target,action,STATUSES.GATED,[error(ERROR_CODES.ACTION_VERIFY_FAILED,'verify')],interpretation,verification,typed);
  }
  if(!typed.ok) return gatedPlan(source,target,action,STATUSES.BLOCKED,typed.errors||[error(ERROR_CODES.ACTION_COMPOSE_FAILED,'compose')],interpretation,verification,typed);
  if(!txEngine||typeof txEngine.prepare!=='function') return gatedPlan(source,target,action,STATUSES.BLOCKED,[error(ERROR_CODES.ACTION_TRANSACTION_UNAVAILABLE,'prepare')],interpretation,verification,typed);
  var snapshot={
    version:VERSION,decision:'apply',status:'apply',source:source,candidate:action.line,insertLine:action.line,
    interpretation:interpretation,verification:verification,typedProgram:typed,
    best:{id:action.id,status:'accept',line:action.line,text:afterText,move:move},
    evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
  };
  var transaction=txEngine.prepare(source,snapshot,target), ready=transaction&&transaction.status==='READY';
  return {version:VERSION,kind:'SemanticActionPlan',ok:ready,status:transaction&&transaction.status||STATUSES.BLOCKED,
    action:action,decision:snapshot,typedProgram:typed,verification:verification,transaction:transaction,
    errors:transaction&&transaction.errors||[],error:firstError(transaction&&transaction.errors),
    portPath:typed.portPath,evidence:evidenceFor(ready),evidenceLevel:evidenceFor(ready),soundness:NOT_COMPUTED};
}

function commit(actionPlan,currentSource,currentTarget){
  var txEngine=transactions(), transaction=actionPlan&&actionPlan.transaction;
  if(!record(actionPlan)||!transaction||!txEngine||typeof txEngine.commit!=='function'){
    return {version:VERSION,kind:'SemanticActionCommit',status:STATUSES.BLOCKED,changed:false,text:text(currentSource),
      code:ERROR_CODES.ACTION_PLAN_INVALID,errorCode:ERROR_CODES.ACTION_PLAN_INVALID,
      errors:[error(ERROR_CODES.ACTION_PLAN_INVALID,'commit')],evidence:UNVERIFIED,evidenceLevel:UNVERIFIED,soundness:NOT_COMPUTED};
  }
  return arguments.length>=3?txEngine.commit(transaction,currentSource,currentTarget):txEngine.commit(transaction,currentSource);
}

global.MRDSemanticActionGate={
  version:VERSION,plan:plan,prepare:plan,commit:commit,additionFromText:additionFromText,
  statuses:STATUSES,STATUSES:STATUSES,errorCodes:ERROR_CODES,ERROR_CODES:ERROR_CODES
};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
