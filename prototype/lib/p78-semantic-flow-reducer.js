(function(global){
'use strict';

var VERSION='1.1.0';
var SCHEMA='meridian.semantic-flow-frame/1';
var DELTA_SCHEMA='meridian.semantic-flow-delta/1';
var Canonical=global.MRDP78CanonicalJSON;
var Work=global.MRDP78SemanticWorkContracts;
var Evidence=global.MRDP78EvidenceContracts;
var ClaimIR=global.MRDP78ClaimIR;

if(!Canonical||!Work||Work.status!=='READY'||!Evidence||Evidence.status!=='READY'||!ClaimIR||ClaimIR.status!=='READY'){
  global.MRDP78SemanticFlowReducer=Object.freeze({version:VERSION,status:'BLOCKED',code:'SEMANTIC_FLOW_DEPENDENCY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var STATES={REVIEW_QUEUE:true,PARKED:true,ABSTAIN:true};
var SOURCE_STATUSES={READY:true,AMBIGUOUS:true,OOV:true,ABSTAIN:true};
var RESOLUTION_STATUSES={RESOLVED:true,AMBIGUOUS:true,OOV:true};
var FORBIDDEN_KEYS={accepted:true,acceptedEvidence:true,commit:true};
var OPERATOR_ORDER=['INPUT','PARSE','DISCOVER','ALIGN','REVIEW'];
var LANES={INPUT:'SOURCE',PARSE:'STRUCTURE',DISCOVER:'EVIDENCE',ALIGN:'EVIDENCE',REVIEW:'REVIEW'};
var DEPENDENCIES={INPUT:[],PARSE:['INPUT'],DISCOVER:['PARSE'],ALIGN:['DISCOVER'],REVIEW:['ALIGN']};
var POLICY=freeze({
  schema:'meridian.semantic-flow-policy/1',version:VERSION,executionModel:'POST_HOC_AG4_PROJECTION',
  operatorOrder:OPERATOR_ORDER,lanes:LANES,dependencies:DEPENDENCIES,
  workStates:['PLANNED','INFLIGHT','PARKED','SHIPPED','DISCARDED'],frameStates:['REVIEW_QUEUE','PARKED','ABSTAIN'],
  reasonCodes:['CANDIDATE_BUDGET_EXCEEDED','EVIDENCE_NOT_COMPUTED','HUMAN_REVIEW_REQUIRED','NO_ALIGNED_CANDIDATES','OPERATION_BUDGET_EXCEEDED','PARSE_NOT_READY','UPSTREAM_NOT_READY'],
  authority:'ROUTING_DIAGNOSTIC_ONLY',terminalStatus:'ABSTAIN',reviewAuthority:'HUMAN_REQUIRED',
  budgetSemantics:{maxOperations:'sum(trace.steps.operationCount)',maxCandidates:'aligned candidate admission cap',maxMilliseconds:'inherited cap; projector reads no clock'},
  metricDefinitions:{
    stageCompletion:{version:'1',formula:'SHIPPED(INPUT..ALIGN)/4'},
    reviewLoad:{version:'1',formula:'min(candidateCount/capacity,1)'},
    upstreamBlock:{version:'1',formula:'PARKED(INPUT..ALIGN)/4'},
    relationDispersion:{version:'1',formula:'(activeProposedRelationKinds-1)/3; NOT_COMPUTED when candidateCount=0'},
    relationConcentration:{version:'1',formula:'maxProposedRelationCount/candidateCount; NOT_COMPUTED when candidateCount=0'}
  }
});
var POLICY_HASH=Canonical.hashCanonical(POLICY);
var DEFAULT_BUDGET=freeze({maxOperations:50000,maxCandidates:32,maxMilliseconds:1000});

function fail(code,path,detail){
  var error=new TypeError(code+(path?' at '+path:'')+(detail?': '+detail:''));
  error.name='P78SemanticFlowError'; error.code=code; error.path=path||'$'; throw error;
}
function object(value,path){ if(!Canonical.isPlainObject(value)) fail('OBJECT_REQUIRED',path); return value; }
function text(value,path){ if(typeof value!=='string'||!value.length) fail('NON_EMPTY_STRING_REQUIRED',path); return value; }
function hash(value,path){ if(!Canonical.isSha256(value)) fail('HASH_REQUIRED',path); return value; }
function integer(value,min,max,path){ if(!Number.isInteger(value)||value<min||value>max) fail('BOUNDED_INTEGER_REQUIRED',path); return value; }
function bounded(value,path){ if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1) fail('BOUNDED_NUMBER_REQUIRED',path); return value; }
function exactShape(value,required,optional,path){
  var allowed={},actual=Object.keys(value),i;
  required.forEach(function(key){ allowed[key]=true; });
  (optional||[]).forEach(function(key){ allowed[key]=true; });
  for(i=0;i<actual.length;i++){
    if(FORBIDDEN_KEYS[actual[i]]) fail('AUTHORITY_FIELD_FORBIDDEN',path+'.'+actual[i]);
    if(!allowed[actual[i]]) fail('UNKNOWN_FIELD',path+'.'+actual[i]);
  }
  for(i=0;i<required.length;i++) if(!own.call(value,required[i])) fail('MISSING_FIELD',path+'.'+required[i]);
}
function exactKeys(value,keys,path){ exactShape(value,keys,[],path); }
function assertPlainData(value,path,depth,state){
  var names,keys,symbols,i,name,descriptor;
  if(depth>64) fail('DATA_DEPTH_EXCEEDED',path);
  state.nodes++; if(state.nodes>250000) fail('DATA_NODE_LIMIT_EXCEEDED',path);
  if(value===null||typeof value==='string'||typeof value==='boolean') return;
  if(typeof value==='number'){ if(!Number.isFinite(value)) fail('FINITE_NUMBER_REQUIRED',path); return; }
  if(Array.isArray(value)){
    if(value.length>100000) fail('ARRAY_LIMIT_EXCEEDED',path);
    symbols=Object.getOwnPropertySymbols(value); if(symbols.length) fail('SYMBOL_FIELD_FORBIDDEN',path);
    names=Object.getOwnPropertyNames(value); if(names.length!==value.length+1) fail('ARRAY_PROPERTY_FORBIDDEN',path);
    for(i=0;i<value.length;i++){
      descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||descriptor.get||descriptor.set) fail('SPARSE_OR_ACCESSOR_ARRAY_FORBIDDEN',path+'['+i+']');
      assertPlainData(descriptor.value,path+'['+i+']',depth+1,state);
    }
    return;
  }
  symbols=Object.getOwnPropertySymbols(value); if(symbols.length) fail('SYMBOL_FIELD_FORBIDDEN',path);
  names=Object.getOwnPropertyNames(value); keys=Object.keys(value); if(names.length!==keys.length) fail('NON_ENUMERABLE_FIELD_FORBIDDEN',path);
  for(i=0;i<keys.length;i++){
    name=keys[i]; if(FORBIDDEN_KEYS[name]) fail('AUTHORITY_FIELD_FORBIDDEN',path+'.'+name);
    descriptor=Object.getOwnPropertyDescriptor(value,name); if(!descriptor||descriptor.get||descriptor.set) fail('ACCESSOR_FORBIDDEN',path+'.'+name);
    assertPlainData(descriptor.value,path+'.'+name,depth+1,state);
  }
  object(value,path);
}
function hashArray(value,path){
  var i; if(!Array.isArray(value)) fail('ARRAY_REQUIRED',path);
  for(i=0;i<value.length;i++){ hash(value[i],path+'['+i+']'); if(i&&value[i-1]>=value[i]) fail('ARRAY_NOT_SORTED_UNIQUE',path); }
  return value;
}
function sameHashes(left,right){
  var a=left.slice().sort(),b=right.slice().sort(),i; if(a.length!==b.length) return false;
  for(i=0;i<a.length;i++) if(a[i]!==b[i]) return false; return true;
}
function verifyContentHash(value,field,path){
  var copy=Canonical.deepCopy(value),expected=copy[field]; hash(expected,path+'.'+field); delete copy[field];
  if(Canonical.hashCanonical(copy)!==expected) fail('CONTENT_HASH_MISMATCH',path+'.'+field);
}
function round4(value){ return Math.round(value*10000)/10000; }
function clamp(value){ return Math.max(0,Math.min(1,value)); }
function reasonCode(value,fallback){
  var code=String(value||fallback||'NOT_COMPUTED').toUpperCase().replace(/[^A-Z0-9_]+/g,'_').slice(0,64);
  return /^[A-Z][A-Z0-9_]*$/.test(code)?code:String(fallback||'NOT_COMPUTED');
}
function copyBudget(value,path){
  object(value,path); exactKeys(value,['maxOperations','maxCandidates','maxMilliseconds'],path);
  return {maxOperations:integer(value.maxOperations,1,Work.limits.maxOperations,path+'.maxOperations'),maxCandidates:integer(value.maxCandidates,1,Work.limits.maxCandidates,path+'.maxCandidates'),maxMilliseconds:integer(value.maxMilliseconds,1,Work.limits.maxMilliseconds,path+'.maxMilliseconds')};
}
function assertTrace(trace,result){
  var i,step; object(trace,'$.trace');
  exactKeys(trace,['schema','version','parserRef','lexiconHash','patternSetHash','steps','finalStatus','contentHash'],'$.trace');
  if(trace.schema!=='meridian.claim-analysis-trace/1'||trace.version!=='1.0.0') fail('TRACE_SCHEMA_MISMATCH','$.trace');
  if(trace.lexiconHash!==result.lexiconHash||trace.patternSetHash!==result.patternSetHash) fail('TRACE_IDENTITY_MISMATCH','$.trace');
  if(trace.finalStatus!=='ABSTAIN') fail('AUTHORITY_BOUNDARY_VIOLATION','$.trace.finalStatus');
  if(!Array.isArray(trace.steps)||!trace.steps.length||trace.steps.length>16) fail('TRACE_STEPS_INVALID','$.trace.steps');
  for(i=0;i<trace.steps.length;i++){
    step=object(trace.steps[i],'$.trace.steps['+i+']');
    exactKeys(step,['ordinal','stage','inputHashes','outputHashes','status','reasonCodes','operationCount'],'$.trace.steps['+i+']');
    integer(step.ordinal,0,15,'$.trace.steps['+i+'].ordinal'); if(step.ordinal!==i) fail('TRACE_ORDER_INVALID','$.trace.steps['+i+'].ordinal');
    text(step.stage,'$.trace.steps['+i+'].stage'); text(step.status,'$.trace.steps['+i+'].status');
    hashArray(step.inputHashes,'$.trace.steps['+i+'].inputHashes'); hashArray(step.outputHashes,'$.trace.steps['+i+'].outputHashes');
    if(!Array.isArray(step.reasonCodes)||!step.reasonCodes.length||step.reasonCodes.length>16) fail('REASON_CODES_INVALID','$.trace.steps['+i+'].reasonCodes');
    step.reasonCodes.forEach(function(code,index){ text(code,'$.trace.steps['+i+'].reasonCodes['+index+']'); });
    integer(step.operationCount,0,Work.limits.maxOperations,'$.trace.steps['+i+'].operationCount');
  }
  verifyContentHash(trace,'contentHash','$.trace');
}
function parseStep(result){ var i; for(i=0;i<result.trace.steps.length;i++) if(result.trace.steps[i].stage==='PARSE_STRUCTURE') return result.trace.steps[i]; return null; }
function operationCount(result){
  var total=0,i; for(i=0;i<result.trace.steps.length;i++){ total+=result.trace.steps[i].operationCount; if(total>Work.limits.maxOperations) return Work.limits.maxOperations; } return total;
}
function relationCounts(candidates){
  var counts={SUPPORTS:0,REFUTES:0,QUALIFIES:0,MENTIONS:0},i,item,report;
  for(i=0;i<candidates.length;i++){
    item=candidates[i]; report=Evidence.validateEvidenceCandidate(item);
    if(report.status!=='VALID') fail('EVIDENCE_CANDIDATE_INVALID','$.evidenceCandidates['+i+']',report.code);
    counts[item.proposedRelation]++;
  }
  return counts;
}
function recordHashes(values,path){
  var hashes=[],i,item; if(!Array.isArray(values)||values.length>Work.limits.maxCandidates) fail('SOURCE_ARRAY_INVALID',path);
  for(i=0;i<values.length;i++){ item=object(values[i],path+'['+i+']'); hashes.push(hash(item.contentHash,path+'['+i+'].contentHash')); }
  return hashes;
}
function assertCascade(cascade,result,counts){
  var candidateHashes,cascadeCandidateHashes,passageHashes,cascadePassageHashes,metrics,reported;
  object(cascade,'$.evidenceCascade');
  exactKeys(cascade,['schema','version','status','code','targetClaimRef','sourceSetHash','linguisticIndexHash','query','lexicalResult','locatedPassages','passageClaims','alignments','evidenceCandidates','metrics','evidenceStatus','reviewStatus','finalStatus','finalRelation','semanticTruth','soundness','resultHash'],'$.evidenceCascade');
  if(cascade.status!=='READY'||cascade.reviewStatus!=='REQUIRES_REVIEW'||cascade.finalStatus!=='ABSTAIN'||cascade.finalRelation!=='NOT_COMPUTED'||cascade.semanticTruth!==false||cascade.soundness!=='NOT_COMPUTED') fail('AUTHORITY_BOUNDARY_VIOLATION','$.evidenceCascade');
  hash(cascade.sourceSetHash,'$.evidenceCascade.sourceSetHash'); hash(cascade.linguisticIndexHash,'$.evidenceCascade.linguisticIndexHash');
  candidateHashes=result.evidenceCandidates.map(function(item){ return item.contentHash; });
  cascadeCandidateHashes=recordHashes(cascade.evidenceCandidates,'$.evidenceCascade.evidenceCandidates');
  if(!sameHashes(candidateHashes,cascadeCandidateHashes)) fail('CASCADE_CANDIDATE_MISMATCH','$.evidenceCascade.evidenceCandidates');
  passageHashes=recordHashes(result.corpusMatches,'$.corpusMatches'); cascadePassageHashes=recordHashes(cascade.passageClaims,'$.evidenceCascade.passageClaims');
  if(!sameHashes(passageHashes,cascadePassageHashes)) fail('CASCADE_PASSAGE_MISMATCH','$.evidenceCascade.passageClaims');
  metrics=object(cascade.metrics,'$.evidenceCascade.metrics'); reported=object(metrics.relationCounts,'$.evidenceCascade.metrics.relationCounts');
  if(metrics.evidenceCandidateCount!==result.evidenceCandidates.length||reported.SUPPORTS!==counts.SUPPORTS||reported.REFUTES!==counts.REFUTES||reported.QUALIFIES!==counts.QUALIFIES||reported.MENTIONS!==counts.MENTIONS) fail('CASCADE_METRIC_MISMATCH','$.evidenceCascade.metrics');
  verifyContentHash(cascade,'resultHash','$.evidenceCascade');
}
function assertSourceResult(value){
  var required=['schema','version','status','code','resolutionStatus','lexiconHash','patternSetHash','inputHash','claimAst','surfaceBySpanId','structuralMatches','corpusMatches','issues','evidenceCandidates','evidenceStatus','reviewStatus','semanticTruth','soundness','finalStatus','trace','traceHash','resultHash'];
  var candidates,counts,cascade,claimReport;
  assertPlainData(value,'$',0,{nodes:0}); object(value,'$'); exactShape(value,required,['evidenceCascade','evidenceError'],'$');
  if(value.schema!=='meridian.controlled-claim-result/1'||value.version!=='1.0.0') fail('SOURCE_SCHEMA_MISMATCH','$.schema');
  if(!SOURCE_STATUSES[value.status]||!RESOLUTION_STATUSES[value.resolutionStatus]) fail('SOURCE_STATUS_INVALID','$.status');
  hash(value.lexiconHash,'$.lexiconHash'); hash(value.patternSetHash,'$.patternSetHash'); hash(value.inputHash,'$.inputHash');
  if(value.semanticTruth!==false||value.soundness!=='NOT_COMPUTED'||value.finalStatus!=='ABSTAIN'||value.reviewStatus!=='REQUIRES_REVIEW') fail('AUTHORITY_BOUNDARY_VIOLATION','$');
  if(!Array.isArray(value.structuralMatches)||!Array.isArray(value.corpusMatches)||!Array.isArray(value.issues)||!Array.isArray(value.evidenceCandidates)) fail('SOURCE_ARRAY_REQUIRED','$');
  if(value.structuralMatches.length>Work.limits.maxCandidates||value.corpusMatches.length>Work.limits.maxCandidates||value.issues.length>Work.limits.maxCandidates||value.evidenceCandidates.length>Work.limits.maxCandidates) fail('SOURCE_ARRAY_LIMIT_EXCEEDED','$');
  recordHashes(value.structuralMatches,'$.structuralMatches'); recordHashes(value.corpusMatches,'$.corpusMatches');
  candidates=value.evidenceCandidates; counts=relationCounts(candidates);
  if(value.evidenceStatus!==(candidates.length?'EVIDENCE_CANDIDATE':'NOT_COMPUTED')) fail('EVIDENCE_STATUS_MISMATCH','$.evidenceStatus');
  if(value.claimAst!==null){ claimReport=ClaimIR.validateClaimAst(value.claimAst); if(claimReport.status!=='VALID') fail('CLAIM_AST_INVALID','$.claimAst',claimReport.code); }
  else if(candidates.length) fail('CLAIM_AST_REQUIRED','$.claimAst');
  object(value.surfaceBySpanId,'$.surfaceBySpanId'); assertTrace(value.trace,value);
  if(value.traceHash!==value.trace.contentHash) fail('TRACE_HASH_MISMATCH','$.traceHash');
  cascade=own.call(value,'evidenceCascade')?value.evidenceCascade:null;
  if(cascade!==null){
    if(own.call(value,'evidenceError')&&value.evidenceError!==null) fail('EVIDENCE_STATE_CONFLICT','$.evidenceError');
    assertCascade(cascade,value,counts);
  }else{
    if(candidates.length||value.corpusMatches.length) fail('CASCADE_REQUIRED','$.evidenceCascade');
    if(own.call(value,'evidenceError')&&value.evidenceError!==null){ object(value.evidenceError,'$.evidenceError'); exactKeys(value.evidenceError,['code','detail'],'$.evidenceError'); text(value.evidenceError.code,'$.evidenceError.code'); text(value.evidenceError.detail,'$.evidenceError.detail'); }
  }
  verifyContentHash(value,'resultHash','$'); return counts;
}
function sourceSetHash(result){
  if(result.evidenceCascade) return result.evidenceCascade.sourceSetHash;
  return Canonical.hashCanonical({schema:'meridian.semantic-flow-source-set/1',version:VERSION,evidenceStatus:result.evidenceStatus,lexiconHash:result.lexiconHash,patternSetHash:result.patternSetHash});
}
function makeItem(run,operatorId,ordinal,previous,inputRef,state,outputHash,reasons,epoch){
  return Work.createWorkItem(run,{operatorId:operatorId,lane:LANES[operatorId],ordinal:ordinal,dependsOn:previous?[previous.workId]:[],inputRefs:[inputRef],state:state,epoch:epoch,outputHash:outputHash,reasonCodes:reasons.slice().sort()});
}
function metricRecord(status,numerator,denominator){ return {status:status,numerator:numerator,denominator:denominator,value:status==='COMPUTED'?round4(clamp(numerator/denominator)):null}; }
function metricsFor(items,counts,capacity,candidateCount,state){
  var shipped=0,parked=0,active=0,max=0,key,i;
  for(key in counts) if(own.call(counts,key)){ if(counts[key]) active++; if(counts[key]>max) max=counts[key]; }
  for(i=0;i<4;i++){ if(items[i].state==='SHIPPED') shipped++; if(items[i].state==='PARKED') parked++; }
  return {candidateCount:candidateCount,supportCount:counts.SUPPORTS,refuteCount:counts.REFUTES,qualifyCount:counts.QUALIFIES,mentionCount:counts.MENTIONS,queueLength:state==='REVIEW_QUEUE'?candidateCount:0,stageCompletion:metricRecord('COMPUTED',shipped,4),reviewLoad:metricRecord('COMPUTED',candidateCount,capacity),upstreamBlock:metricRecord('COMPUTED',parked,4),relationDispersion:candidateCount?metricRecord('COMPUTED',active-1,3):metricRecord('NOT_COMPUTED',0,0),relationConcentration:candidateCount?metricRecord('COMPUTED',max,candidateCount):metricRecord('NOT_COMPUTED',0,0)};
}
function reduce(result,rawOptions){
  var options=rawOptions||{},epoch=1,capacity=16,budget=DEFAULT_BUDGET,run,items=[],input,parse,discover,align,review;
  var parsed,parseReady,cascade,counts,candidateCount,operations,state,frame,alignHash;
  object(options,'$.options'); exactShape(options,[],['epoch','capacity','budget'],'$.options'); counts=assertSourceResult(result);
  if(own.call(options,'epoch')) epoch=integer(options.epoch,1,Work.limits.maxEpoch,'$.options.epoch');
  if(own.call(options,'capacity')) capacity=integer(options.capacity,1,Work.limits.maxCandidates,'$.options.capacity');
  budget=own.call(options,'budget')?copyBudget(options.budget,'$.options.budget'):Canonical.deepCopy(DEFAULT_BUDGET);
  run=Work.createRun({inputHash:result.resultHash,policyHash:POLICY_HASH,sourceSetHash:sourceSetHash(result),budget:budget});
  input=makeItem(run,'INPUT',0,null,result.resultHash,'SHIPPED',result.inputHash,[],epoch); items.push(input);
  parsed=parseStep(result); parseReady=!!(result.claimAst&&parsed&&parsed.status==='READY');
  parse=makeItem(run,'PARSE',1,input,input.outputHash,parseReady?'SHIPPED':'PARKED',parseReady?result.claimAst.contentHash:null,parseReady?[]:[reasonCode(result.code,'PARSE_NOT_READY')],epoch); items.push(parse);
  cascade=result.evidenceCascade||null; operations=operationCount(result);
  if(parse.state!=='SHIPPED') discover=makeItem(run,'DISCOVER',2,parse,parse.contentHash,'PARKED',null,['UPSTREAM_NOT_READY'],epoch);
  else if(operations>budget.maxOperations) discover=makeItem(run,'DISCOVER',2,parse,parse.outputHash,'PARKED',null,['OPERATION_BUDGET_EXCEEDED'],epoch);
  else if(!cascade) discover=makeItem(run,'DISCOVER',2,parse,parse.outputHash,'PARKED',null,[reasonCode(result.evidenceError&&result.evidenceError.code,'EVIDENCE_NOT_COMPUTED')],epoch);
  else discover=makeItem(run,'DISCOVER',2,parse,parse.outputHash,'SHIPPED',cascade.resultHash,[],epoch);
  items.push(discover); candidateCount=result.evidenceCandidates.length;
  alignHash=Canonical.hashCanonical(result.evidenceCandidates.map(function(item){ return item.contentHash; }).sort());
  if(discover.state!=='SHIPPED') align=makeItem(run,'ALIGN',3,discover,discover.contentHash,'PARKED',null,['UPSTREAM_NOT_READY'],epoch);
  else if(candidateCount>budget.maxCandidates||candidateCount>capacity) align=makeItem(run,'ALIGN',3,discover,discover.outputHash,'PARKED',null,['CANDIDATE_BUDGET_EXCEEDED'],epoch);
  else align=makeItem(run,'ALIGN',3,discover,discover.outputHash,'SHIPPED',alignHash,candidateCount?[]:['NO_ALIGNED_CANDIDATES'],epoch);
  items.push(align);
  review=makeItem(run,'REVIEW',4,align,align.outputHash||align.contentHash,'PARKED',null,[align.state!=='SHIPPED'?'UPSTREAM_NOT_READY':candidateCount?'HUMAN_REVIEW_REQUIRED':'NO_ALIGNED_CANDIDATES'],epoch); items.push(review);
  state=parse.state!=='SHIPPED'?'ABSTAIN':align.state==='SHIPPED'&&candidateCount?'REVIEW_QUEUE':'PARKED';
  frame={schema:SCHEMA,version:VERSION,executionModel:'POST_HOC_AG4_PROJECTION',run:run,workItems:items,state:state,authority:'ROUTING_DIAGNOSTIC_ONLY',metricNotice:'OPERATIONAL_AND_RELATION_STATISTICS_NOT_SEMANTIC_TRUTH',semanticTruth:false,finalStatus:'ABSTAIN',reviewStatus:'REQUIRES_REVIEW',sourceResultHash:result.resultHash,epoch:epoch,capacity:capacity,metrics:metricsFor(items,counts,capacity,candidateCount,state)};
  frame.contentHash=Canonical.hashCanonical(frame); return freeze(frame);
}
function assertMetricRecord(value,path){
  object(value,path); exactKeys(value,['status','numerator','denominator','value'],path);
  if(value.status!=='COMPUTED'&&value.status!=='NOT_COMPUTED') fail('METRIC_STATUS_INVALID',path+'.status');
  integer(value.numerator,0,Work.limits.maxCandidates,path+'.numerator'); integer(value.denominator,0,Work.limits.maxCandidates,path+'.denominator');
  if(value.status==='NOT_COMPUTED'){ if(value.numerator!==0||value.denominator!==0||value.value!==null) fail('METRIC_NOT_COMPUTED_INVALID',path); }
  else{ if(value.denominator<1) fail('METRIC_DENOMINATOR_INVALID',path+'.denominator'); bounded(value.value,path+'.value'); if(value.value!==round4(clamp(value.numerator/value.denominator))) fail('METRIC_VALUE_MISMATCH',path+'.value'); }
}
function assertMetrics(value,path){
  var countKeys=['candidateCount','supportCount','refuteCount','qualifyCount','mentionCount','queueLength'],recordKeys=['stageCompletion','reviewLoad','upstreamBlock','relationDispersion','relationConcentration'],i;
  object(value,path); exactKeys(value,countKeys.concat(recordKeys),path);
  for(i=0;i<countKeys.length;i++) integer(value[countKeys[i]],0,Work.limits.maxCandidates,path+'.'+countKeys[i]);
  for(i=0;i<recordKeys.length;i++) assertMetricRecord(value[recordKeys[i]],path+'.'+recordKeys[i]);
  if(value.supportCount+value.refuteCount+value.qualifyCount+value.mentionCount!==value.candidateCount) fail('METRIC_COUNT_MISMATCH',path);
}
function assertFlowFrame(value){
  var keys=['schema','version','executionModel','run','workItems','state','authority','metricNotice','semanticTruth','finalStatus','reviewStatus','sourceResultHash','epoch','capacity','metrics','contentHash'];
  var i,item,previous,counts,expectedMetrics,expectedState;
  assertPlainData(value,'$',0,{nodes:0}); object(value,'$'); exactKeys(value,keys,'$');
  if(value.schema!==SCHEMA||value.version!==VERSION||value.executionModel!=='POST_HOC_AG4_PROJECTION') fail('SCHEMA_MISMATCH','$.schema');
  if(Work.validateRun(value.run).status!=='VALID'||value.run.policyHash!==POLICY_HASH) fail('RUN_INVALID','$.run');
  if(!Array.isArray(value.workItems)||value.workItems.length!==OPERATOR_ORDER.length) fail('WORK_ITEM_COUNT_INVALID','$.workItems');
  for(i=0;i<value.workItems.length;i++){
    item=value.workItems[i]; previous=i?value.workItems[i-1]:null;
    if(Work.validateWorkItem(item).status!=='VALID') fail('WORK_ITEM_INVALID','$.workItems['+i+']');
    if(item.operatorId!==OPERATOR_ORDER[i]||item.lane!==LANES[item.operatorId]||item.ordinal!==i) fail('WORK_ITEM_ORDER_INVALID','$.workItems['+i+']');
    if(item.runId!==value.run.runId||item.epoch!==value.epoch||Canonical.canonicalize(item.budget)!==Canonical.canonicalize(value.run.budget)) fail('WORK_ITEM_RUN_MISMATCH','$.workItems['+i+']');
    if(previous){ if(item.dependsOn.length!==1||item.dependsOn[0]!==previous.workId) fail('WORK_DEPENDENCY_MISMATCH','$.workItems['+i+'].dependsOn'); }
    else if(item.dependsOn.length) fail('WORK_DEPENDENCY_MISMATCH','$.workItems[0].dependsOn');
  }
  if(!STATES[value.state]) fail('STATE_INVALID','$.state');
  if(value.authority!=='ROUTING_DIAGNOSTIC_ONLY'||value.metricNotice!=='OPERATIONAL_AND_RELATION_STATISTICS_NOT_SEMANTIC_TRUTH'||value.semanticTruth!==false||value.finalStatus!=='ABSTAIN'||value.reviewStatus!=='REQUIRES_REVIEW') fail('AUTHORITY_BOUNDARY_VIOLATION','$');
  hash(value.sourceResultHash,'$.sourceResultHash'); if(value.run.inputHash!==value.sourceResultHash) fail('SOURCE_RESULT_MISMATCH','$.sourceResultHash');
  integer(value.epoch,1,Work.limits.maxEpoch,'$.epoch'); integer(value.capacity,1,Work.limits.maxCandidates,'$.capacity'); assertMetrics(value.metrics,'$.metrics');
  counts={SUPPORTS:value.metrics.supportCount,REFUTES:value.metrics.refuteCount,QUALIFIES:value.metrics.qualifyCount,MENTIONS:value.metrics.mentionCount};
  expectedState=value.workItems[1].state!=='SHIPPED'?'ABSTAIN':value.workItems[3].state==='SHIPPED'&&value.metrics.candidateCount?'REVIEW_QUEUE':'PARKED'; if(value.state!==expectedState) fail('FRAME_STATE_MISMATCH','$.state');
  expectedMetrics=metricsFor(value.workItems,counts,value.capacity,value.metrics.candidateCount,value.state); if(Canonical.canonicalize(value.metrics)!==Canonical.canonicalize(expectedMetrics)) fail('METRIC_VALUE_MISMATCH','$.metrics');
  verifyContentHash(value,'contentHash','$'); return true;
}
function validateFlowFrame(value){ try{ assertFlowFrame(value); return freeze({status:'VALID',code:null,path:null}); }catch(error){ return freeze({status:'INVALID',code:error&&error.code||'INVALID_VALUE',path:error&&error.path||'$'}); } }
function createDelta(previous,current){
  var prior={},changed=[],i,item,delta;
  if(validateFlowFrame(previous).status!=='VALID') fail('PREVIOUS_FRAME_INVALID','$.previousFrame');
  if(validateFlowFrame(current).status!=='VALID') fail('CURRENT_FRAME_INVALID','$.currentFrame');
  if(current.epoch<previous.epoch) fail('EPOCH_REGRESSION','$.currentFrame.epoch');
  for(i=0;i<previous.workItems.length;i++) prior[previous.workItems[i].workId]=previous.workItems[i].contentHash;
  for(i=0;i<current.workItems.length;i++){ item=current.workItems[i]; if(prior[item.workId]!==item.contentHash) changed.push(item.workId); }
  delta={schema:DELTA_SCHEMA,version:VERSION,fromFrameHash:previous.contentHash,toFrameHash:current.contentHash,fromEpoch:previous.epoch,toEpoch:current.epoch,changedWorkIds:changed.sort()};
  delta.contentHash=Canonical.hashCanonical(delta); return freeze(delta);
}
function validateFlowDelta(value){
  try{
    assertPlainData(value,'$',0,{nodes:0}); object(value,'$'); exactKeys(value,['schema','version','fromFrameHash','toFrameHash','fromEpoch','toEpoch','changedWorkIds','contentHash'],'$');
    if(value.schema!==DELTA_SCHEMA||value.version!==VERSION) fail('SCHEMA_MISMATCH','$.schema');
    hash(value.fromFrameHash,'$.fromFrameHash'); hash(value.toFrameHash,'$.toFrameHash'); integer(value.fromEpoch,1,Work.limits.maxEpoch,'$.fromEpoch'); integer(value.toEpoch,1,Work.limits.maxEpoch,'$.toEpoch');
    if(value.toEpoch<value.fromEpoch) fail('EPOCH_REGRESSION','$.toEpoch'); hashArray(value.changedWorkIds,'$.changedWorkIds'); verifyContentHash(value,'contentHash','$');
    return freeze({status:'VALID',code:null,path:null});
  }catch(error){ return freeze({status:'INVALID',code:error&&error.code||'INVALID_VALUE',path:error&&error.path||'$'}); }
}

global.MRDP78SemanticFlowReducer=freeze({version:VERSION,status:'READY',schema:SCHEMA,deltaSchema:DELTA_SCHEMA,policy:POLICY,policyHash:POLICY_HASH,defaultBudget:DEFAULT_BUDGET,reduce:reduce,validateFlowFrame:validateFlowFrame,createDelta:createDelta,validateFlowDelta:validateFlowDelta});
})(typeof globalThis!=='undefined'?globalThis:this);
