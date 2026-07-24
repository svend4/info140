(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var SearchContracts=global.MRDP78SearchContracts;
var LocalTextIndex=global.MRDP78LocalTextIndex;
var ClaimIR=global.MRDP78ClaimIR;
var EvidenceContracts=global.MRDP78EvidenceContracts;

if(!Canonical||!SearchContracts||SearchContracts.status!=='READY'||
   !LocalTextIndex||LocalTextIndex.status!=='READY'||!ClaimIR||ClaimIR.status!=='READY'||
   !EvidenceContracts||EvidenceContracts.status!=='READY'){
  global.MRDP78ClaimCountersearch=Object.freeze({
    version:VERSION,status:'BLOCKED',code:'CLAIM_COUNTERSEARCH_DEPENDENCY_UNAVAILABLE'
  });
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var SCHEMAS=freeze({
  projection:'meridian.claim-query-projection/1',
  projectionItem:'meridian.claim-query-projection-item/1',
  attempt:'meridian.countersearch-attempt/1',
  run:'meridian.countersearch-run/1'
});
var REQUIRED_PURPOSES=freeze([
  'SUPPORT','POLARITY_COUNTER','QUALIFIER_SCOPE','ALTERNATE_DEFINITION','SOURCE_DEPENDENCY'
]);
var PURPOSE_SET=freeze({
  SUPPORT:true,POLARITY_COUNTER:true,QUALIFIER_SCOPE:true,
  ALTERNATE_DEFINITION:true,SOURCE_DEPENDENCY:true
});
var RUN_STATUSES=freeze({EXECUTED:true,ABSTAIN:true,INVALID:true});
var ATTEMPT_STATUSES=freeze({HITS:true,EMPTY:true,ABSTAIN:true});
var REASON_CODES=freeze({
  COUNTERSEARCH_RESULTS_REQUIRE_REVIEW:'COUNTERSEARCH_RESULTS_REQUIRE_REVIEW',
  NO_COUNTEREVIDENCE_FOUND_WITHIN_SCOPE:'NO_COUNTEREVIDENCE_FOUND_WITHIN_SCOPE',
  HITS_LOCATED_REVIEW_REQUIRED:'HITS_LOCATED_REVIEW_REQUIRED',
  SEARCH_ATTEMPT_ABSTAINED:'SEARCH_ATTEMPT_ABSTAINED',
  CLAIM_UNRESOLVED:'CLAIM_UNRESOLVED',
  INVALID_CLAIM:'INVALID_CLAIM',
  INVALID_INDEX:'INVALID_INDEX',
  INVALID_OPTION:'INVALID_OPTION',
  UNKNOWN_OPTION:'UNKNOWN_OPTION',
  STALE_SOURCE_SET:'STALE_SOURCE_SET',
  STALE_INDEX:'STALE_INDEX',
  STALE_CLAIM:'STALE_CLAIM',
  STALE_PROJECTION_RULE_SET:'STALE_PROJECTION_RULE_SET',
  STALE_THESAURUS:'STALE_THESAURUS',
  CYCLE_DETECTED:'CYCLE_DETECTED',
  BUDGET_EXCEEDED:'BUDGET_EXCEEDED',
  REQUIRED_PURPOSES_INCOMPLETE:'REQUIRED_PURPOSES_INCOMPLETE',
  PROJECTION_INVALID:'PROJECTION_INVALID',
  RUN_INVALID:'RUN_INVALID'
});
var ID=/^[A-Za-z0-9][A-Za-z0-9._:@\/-]{0,255}$/;

var RULE_DEFINITIONS=freeze([
  {purpose:'SUPPORT',ruleId:'p78:countersearch:support.exact',strategy:'CLAIM_LEMMA_WITH_TARGET_POLARITY',mode:'EXACT',expansionClass:'EXACT'},
  {purpose:'POLARITY_COUNTER',ruleId:'p78:countersearch:polarity-counter.exact',strategy:'CLAIM_LEMMA_WITH_OPPOSITE_POLARITY',mode:'TOKEN',expansionClass:'EXACT'},
  {purpose:'QUALIFIER_SCOPE',ruleId:'p78:countersearch:qualifier-scope.exact',strategy:'CLAIM_LEMMA_WITH_EXPLICIT_QUALIFIERS',mode:'TOKEN',expansionClass:'EXACT'},
  {purpose:'ALTERNATE_DEFINITION',ruleId:'p78:countersearch:alternate-definition.curated',strategy:'CURATED_TERMS_ONLY',mode:'TOKEN',expansionClass:'CURATED'},
  {purpose:'SOURCE_DEPENDENCY',ruleId:'p78:countersearch:source-dependency.exact',strategy:'PINNED_SOURCE_FILTER_ONLY',mode:'TOKEN',expansionClass:'EXACT'}
]);

function countersearchError(code,message,path){
  var error=new TypeError(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78ClaimCountersearchError';
  error.code=code;
  error.path=path||'$';
  return error;
}
function reject(code,message,path){ throw countersearchError(code,message,path); }
function isObject(value){ return Canonical.isPlainObject(value); }
function has(value,key){ return value!==null&&value!==undefined&&own.call(value,key); }
function assertObject(value,path){ if(!isObject(value)) reject(REASON_CODES.INVALID_OPTION,'plain object required',path); }
function assertExactKeys(value,allowed,path){
  var keys=Object.keys(value),i;
  for(i=0;i<keys.length;i++) if(allowed.indexOf(keys[i])===-1) reject(REASON_CODES.UNKNOWN_OPTION,keys[i],path+'.'+keys[i]);
}
function assertString(value,path,options){
  options=options||{};
  if(typeof value!=='string') reject(REASON_CODES.INVALID_OPTION,'string required',path);
  if(options.nonEmpty&&!value.length) reject(REASON_CODES.INVALID_OPTION,'non-empty string required',path);
  if(options.trimmed&&value.trim()!==value) reject(REASON_CODES.INVALID_OPTION,'surrounding whitespace forbidden',path);
  if(options.max!==undefined&&value.length>options.max) reject(REASON_CODES.INVALID_OPTION,'string too long',path);
  if(options.pattern&&!options.pattern.test(value)) reject(REASON_CODES.INVALID_OPTION,'string format rejected',path);
}
function assertId(value,path){ assertString(value,path,{nonEmpty:true,trimmed:true,max:256,pattern:ID}); }
function assertHash(value,path){ if(!Canonical.isSha256(value)) reject(REASON_CODES.INVALID_OPTION,'SHA-256 required',path); }
function assertInteger(value,min,max,path){
  if(!Number.isInteger(value)||value<min||value>max) reject(REASON_CODES.INVALID_OPTION,'integer out of range',path);
}
function assertEnum(value,values,path){ if(typeof value!=='string'||!has(values,value)) reject(REASON_CODES.INVALID_OPTION,'enumeration value rejected',path); }
function without(value,keys){
  var result={},names=Object.keys(value),i;
  for(i=0;i<names.length;i++) if(keys.indexOf(names[i])===-1) result[names[i]]=value[names[i]];
  return result;
}
function shortHash(hash){ return String(hash).replace(/^sha256:/,'').slice(0,24); }
function sameArray(left,right){
  var i;
  if(!Array.isArray(left)||left.length!==right.length) return false;
  for(i=0;i<left.length;i++) if(left[i]!==right[i]) return false;
  return true;
}
function uniqueSorted(values){
  var seen={},result=[],i;
  for(i=0;i<values.length;i++) if(!has(seen,values[i])){ seen[values[i]]=true; result.push(values[i]); }
  return result.sort();
}

function makeRuleRef(definition){
  var identity={ruleId:definition.ruleId,version:VERSION,purpose:definition.purpose,strategy:definition.strategy};
  return freeze({ruleId:definition.ruleId,version:VERSION,contentHash:Canonical.hashCanonical(identity)});
}
var RULE_REFS=freeze(RULE_DEFINITIONS.map(makeRuleRef));
var RULE_BY_PURPOSE=(function(){
  var value={},i;
  for(i=0;i<RULE_DEFINITIONS.length;i++) value[RULE_DEFINITIONS[i].purpose]={definition:RULE_DEFINITIONS[i],ref:RULE_REFS[i]};
  return freeze(value);
})();
var PROJECTION_RULE_SET_HASH=Canonical.hashCanonical({
  schema:'meridian.claim-countersearch-rule-set/1',version:VERSION,rules:RULE_REFS
});
var PROJECTOR_REF=(function(){
  var base={projectorId:'p78.claim-countersearch',version:VERSION,projectionRuleSetHash:PROJECTION_RULE_SET_HASH};
  base.contentHash=Canonical.hashCanonical(base);
  return freeze(base);
})();

function normalizeText(value,path){
  var normalized,tokens;
  assertString(value,path,{nonEmpty:true,max:2048});
  normalized=value.normalize('NFC').trim().toLowerCase();
  if(!normalized) reject(REASON_CODES.INVALID_OPTION,'blank term',path);
  tokens=LocalTextIndex.tokenize(normalized);
  if(!tokens.length) reject(REASON_CODES.INVALID_OPTION,'term has no searchable tokens',path);
  return normalized;
}
function normalizeTerms(values,path){
  var result=[],i;
  if(values===undefined) return result;
  if(!Array.isArray(values)||values.length>64) reject(REASON_CODES.INVALID_OPTION,'zero to 64 terms required',path);
  for(i=0;i<values.length;i++) result.push(normalizeText(values[i],path+'['+i+']'));
  return uniqueSorted(result);
}
function normalizeSourceIds(values,path){
  var result=[],i;
  if(values===undefined) return result;
  if(!Array.isArray(values)||values.length>256) reject(REASON_CODES.INVALID_OPTION,'zero to 256 source IDs required',path);
  for(i=0;i<values.length;i++){ assertId(values[i],path+'['+i+']'); result.push(values[i]); }
  return uniqueSorted(result);
}
function normalizeVisited(values,path){
  var result=[],i;
  if(values===undefined) return result;
  if(!Array.isArray(values)||values.length>4096) reject(REASON_CODES.INVALID_OPTION,'visited hash array rejected',path);
  for(i=0;i<values.length;i++){ assertHash(values[i],path+'['+i+']'); result.push(values[i]); }
  return uniqueSorted(result);
}

var PROJECTION_OPTION_KEYS=freeze([
  'curatedTerms','dependencySourceIds','expectedClaimHash','expectedProjectionRuleSetHash','expectedThesaurusHash'
]);
var RUN_OPTION_KEYS=freeze(PROJECTION_OPTION_KEYS.concat([
  'expectedSourceSetHash','expectedIndexHash','visitedQueryHashes','maxQueries','maxOperations','maxHits','contextChars'
]));

function parseProjectionOptions(options,allowedKeys){
  var result;
  options=options===undefined?{}:options;
  assertObject(options,'$.options');
  assertExactKeys(options,allowedKeys,'$.options');
  result={
    curatedTerms:normalizeTerms(options.curatedTerms,'$.options.curatedTerms'),
    dependencySourceIds:normalizeSourceIds(options.dependencySourceIds,'$.options.dependencySourceIds'),
    expectedClaimHash:has(options,'expectedClaimHash')?options.expectedClaimHash:null,
    expectedProjectionRuleSetHash:has(options,'expectedProjectionRuleSetHash')?options.expectedProjectionRuleSetHash:null,
    expectedThesaurusHash:has(options,'expectedThesaurusHash')?options.expectedThesaurusHash:null
  };
  if(result.expectedClaimHash!==null) assertHash(result.expectedClaimHash,'$.options.expectedClaimHash');
  if(result.expectedProjectionRuleSetHash!==null) assertHash(result.expectedProjectionRuleSetHash,'$.options.expectedProjectionRuleSetHash');
  if(result.expectedThesaurusHash!==null) assertHash(result.expectedThesaurusHash,'$.options.expectedThesaurusHash');
  return result;
}
function parseRunOptions(options){
  var projection=parseProjectionOptions(options,RUN_OPTION_KEYS),source=options||{};
  projection.expectedSourceSetHash=has(source,'expectedSourceSetHash')?source.expectedSourceSetHash:null;
  projection.expectedIndexHash=has(source,'expectedIndexHash')?source.expectedIndexHash:null;
  projection.visitedQueryHashes=normalizeVisited(source.visitedQueryHashes,'$.options.visitedQueryHashes');
  projection.maxQueries=has(source,'maxQueries')?source.maxQueries:REQUIRED_PURPOSES.length;
  projection.maxOperations=has(source,'maxOperations')?source.maxOperations:100000;
  projection.maxHits=has(source,'maxHits')?source.maxHits:256;
  projection.contextChars=has(source,'contextChars')?source.contextChars:96;
  if(projection.expectedSourceSetHash!==null) assertHash(projection.expectedSourceSetHash,'$.options.expectedSourceSetHash');
  if(projection.expectedIndexHash!==null) assertHash(projection.expectedIndexHash,'$.options.expectedIndexHash');
  assertInteger(projection.maxQueries,1,64,'$.options.maxQueries');
  assertInteger(projection.maxOperations,1,10000000,'$.options.maxOperations');
  assertInteger(projection.maxHits,1,100000,'$.options.maxHits');
  assertInteger(projection.contextChars,0,4096,'$.options.contextChars');
  return projection;
}

function term(value){ return {node:'Term',value:value,normalization:'LOWER'}; }
function expressionForText(value){
  var tokens=LocalTextIndex.tokenize(value),terms=tokens.map(function(tokenValue){ return term(tokenValue.lower); });
  if(terms.length===1) return terms[0];
  return {node:'Phrase',terms:terms,slop:0};
}
function combine(node,items){ return items.length===1?items[0]:{node:node,items:items}; }
function negatedExpression(base){
  if(base.node==='Term') return {node:'Phrase',terms:[term('не'),base],slop:0};
  if(base.node==='Phrase') return {node:'Phrase',terms:[term('не')].concat(base.terms),slop:0};
  reject(REASON_CODES.PROJECTION_INVALID,'negation requires a term or phrase','$.claim.predicate.lemma');
}
function applyPolarity(base,polarity){
  return polarity==='NEGATIVE'?negatedExpression(base):base;
}
function oppositePolarity(base,polarity){
  return polarity==='POSITIVE'?negatedExpression(base):base;
}
function qualifierExpressions(claim){
  var keys=Object.keys(claim.qualifiers).sort(),result=[],i;
  for(i=0;i<keys.length;i++) result.push(expressionForText(normalizeText(claim.qualifiers[keys[i]],'$.claim.qualifiers.'+keys[i])));
  return result;
}
function alternateExpression(base,curatedTerms){
  var expressions=curatedTerms.map(expressionForText);
  return expressions.length?combine('Or',expressions):base;
}
function thesaurusHash(curatedTerms){
  return Canonical.hashCanonical({schema:'meridian.bounded-curated-terms/1',version:VERSION,terms:curatedTerms});
}
function claimRef(claim){ return EvidenceContracts.claimRef(claim); }
function queryRef(query){ return {queryId:query.queryId,revision:query.revision,contentHash:query.contentHash}; }
function indexRef(index){
  return {indexId:index.manifest.indexId,version:index.version,contentHash:index.indexHash};
}
function projectionRef(projection){
  return {
    projectionId:projection.projectionId,contentHash:projection.contentHash,
    projectionRuleSetHash:projection.projectionRuleSetHash,thesaurusHash:projection.thesaurusHash
  };
}

function createQuery(targetRef,purpose,expression,filters,rule,thesaurusIdentity){
  var seed={
    schema:'meridian.claim-countersearch-query-seed/1',targetClaimHash:targetRef.contentHash,
    purpose:purpose,ruleHash:rule.ref.contentHash,expression:expression,filters:filters,
    expansionClass:rule.definition.expansionClass,thesaurusHash:thesaurusIdentity
  };
  return SearchContracts.createSemanticQuery({
    queryId:'counterquery:'+shortHash(Canonical.hashCanonical(seed)),revision:VERSION,
    mode:rule.definition.mode,expression:expression,filters:filters,
    origin:{kind:'CLAIM_AST',claimId:targetRef.claimAstId,astPath:'$'},
    expansionClass:rule.definition.expansionClass
  });
}
function createProjectionItem(purpose,query,completenessClaim,reasonCodes){
  var rule=RULE_BY_PURPOSE[purpose],base,value,identityHash;
  base={
    schema:SCHEMAS.projectionItem,purpose:purpose,projectionRuleRef:rule.ref,
    query:query,completenessClaim:completenessClaim,reasonCodes:reasonCodes
  };
  identityHash=Canonical.hashCanonical(base);
  value={
    schema:base.schema,itemId:'projection-item:'+shortHash(identityHash),purpose:base.purpose,
    projectionRuleRef:base.projectionRuleRef,query:base.query,
    completenessClaim:base.completenessClaim,reasonCodes:base.reasonCodes
  };
  value.contentHash=Canonical.hashCanonical(value);
  return freeze(value);
}

function buildProjection(claim,options){
  var report=ClaimIR.validateClaimAst(claim),targetRef,baseExpression,qualifiers,thesaurusIdentity,filters,dependencyFilters,items=[],base,value,identityHash;
  if(report.status!=='VALID') reject(REASON_CODES.INVALID_CLAIM,report.code||'Claim AST rejected','$.claim');
  if(claim.resolutionStatus!=='RESOLVED') reject(REASON_CODES.CLAIM_UNRESOLVED,'resolved Claim AST required','$.claim.resolutionStatus');
  targetRef=claimRef(claim);
  thesaurusIdentity=thesaurusHash(options.curatedTerms);
  if(options.expectedClaimHash!==null&&options.expectedClaimHash!==targetRef.contentHash) reject(REASON_CODES.STALE_CLAIM,'Claim AST hash changed','$.options.expectedClaimHash');
  if(options.expectedProjectionRuleSetHash!==null&&options.expectedProjectionRuleSetHash!==PROJECTION_RULE_SET_HASH) reject(REASON_CODES.STALE_PROJECTION_RULE_SET,'projection rules changed','$.options.expectedProjectionRuleSetHash');
  if(options.expectedThesaurusHash!==null&&options.expectedThesaurusHash!==thesaurusIdentity) reject(REASON_CODES.STALE_THESAURUS,'curated term set changed','$.options.expectedThesaurusHash');

  baseExpression=expressionForText(normalizeText(claim.predicate.lemma,'$.claim.predicate.lemma'));
  qualifiers=qualifierExpressions(claim);
  filters={language:'ru',requiredSourceStatus:'ADMITTED'};
  dependencyFilters={language:'ru',requiredSourceStatus:'ADMITTED'};
  if(options.dependencySourceIds.length) dependencyFilters.sourceIds=options.dependencySourceIds;

  items.push(createProjectionItem(
    'SUPPORT',
    createQuery(targetRef,'SUPPORT',applyPolarity(baseExpression,claim.polarity),filters,RULE_BY_PURPOSE.SUPPORT,thesaurusIdentity),
    'EXACT_PREDICATE_LEMMA_AND_EXPLICIT_POLARITY_ONLY',['EXACT_PROJECTION']
  ));
  items.push(createProjectionItem(
    'POLARITY_COUNTER',
    createQuery(targetRef,'POLARITY_COUNTER',oppositePolarity(baseExpression,claim.polarity),filters,RULE_BY_PURPOSE.POLARITY_COUNTER,thesaurusIdentity),
    claim.polarity==='POSITIVE'?'EXPLICIT_NEGATION_TOKEN_ONLY':'POSITIVE_COUNTER_APPROXIMATION_REQUIRES_REVIEW',
    [claim.polarity==='POSITIVE'?'EXPLICIT_NEGATION_PROJECTION':'POSITIVE_COUNTER_APPROXIMATION']
  ));
  items.push(createProjectionItem(
    'QUALIFIER_SCOPE',
    createQuery(targetRef,'QUALIFIER_SCOPE',qualifiers.length?combine('Or',[baseExpression].concat(qualifiers)):baseExpression,filters,RULE_BY_PURPOSE.QUALIFIER_SCOPE,thesaurusIdentity),
    qualifiers.length?'EXPLICIT_CLAIM_QUALIFIER_TOKENS_ONLY':'NO_EXPLICIT_QUALIFIERS_FALLBACK_TO_PREDICATE',
    [qualifiers.length?'QUALIFIERS_PROJECTED':'QUALIFIER_FALLBACK_REQUIRES_REVIEW']
  ));
  items.push(createProjectionItem(
    'ALTERNATE_DEFINITION',
    createQuery(targetRef,'ALTERNATE_DEFINITION',alternateExpression(baseExpression,options.curatedTerms),filters,RULE_BY_PURPOSE.ALTERNATE_DEFINITION,thesaurusIdentity),
    options.curatedTerms.length?'CURATED_TERMS_ONLY':'NO_CURATED_ALTERNATES_FALLBACK_TO_PREDICATE',
    [options.curatedTerms.length?'CURATED_PROJECTION':'CURATED_VARIANTS_UNAVAILABLE']
  ));
  items.push(createProjectionItem(
    'SOURCE_DEPENDENCY',
    createQuery(targetRef,'SOURCE_DEPENDENCY',baseExpression,dependencyFilters,RULE_BY_PURPOSE.SOURCE_DEPENDENCY,thesaurusIdentity),
    options.dependencySourceIds.length?'PINNED_SOURCE_IDS_ONLY':'NO_DEPENDENCY_SOURCE_IDS_FALLBACK_TO_SOURCE_SET',
    [options.dependencySourceIds.length?'SOURCE_FILTER_PINNED':'SOURCE_DEPENDENCY_UNBOUND']
  ));

  base={
    schema:SCHEMAS.projection,targetClaimRef:targetRef,projectorRef:PROJECTOR_REF,
    projectionRuleSetHash:PROJECTION_RULE_SET_HASH,thesaurusHash:thesaurusIdentity,
    requiredPurposes:REQUIRED_PURPOSES,items:items,
    completenessClaim:'FIVE_BOUNDED_DETERMINISTIC_PROJECTIONS_NO_MODEL_EXPANSION',semanticTruth:false
  };
  identityHash=Canonical.hashCanonical(base);
  value={
    schema:base.schema,projectionId:'claim-query-projection:'+shortHash(identityHash),
    targetClaimRef:base.targetClaimRef,projectorRef:base.projectorRef,
    projectionRuleSetHash:base.projectionRuleSetHash,thesaurusHash:base.thesaurusHash,
    requiredPurposes:base.requiredPurposes,items:base.items,
    completenessClaim:base.completenessClaim,semanticTruth:false
  };
  value.contentHash=Canonical.hashCanonical(value);
  if(validateProjection(value).status!=='VALID') reject(REASON_CODES.PROJECTION_INVALID,'projection self-validation failed','$');
  return freeze(value);
}

function projectionOutcome(status,code,projection,detail){
  var value={
    schema:'meridian.claim-query-projection-outcome/1',status:status,code:code||null,
    projection:projection||null,finalStatus:'ABSTAIN',reviewStatus:'REQUIRES_REVIEW',
    finalRelation:'NOT_COMPUTED',semanticTruth:false,detail:detail||''
  };
  value.resultHash=Canonical.hashCanonical(value);
  return freeze(value);
}
function project(claim,options){
  try{
    return projectionOutcome('READY',null,buildProjection(claim,parseProjectionOptions(options,PROJECTION_OPTION_KEYS)),null);
  }catch(error){
    return projectionOutcome(error&&error.code===REASON_CODES.INVALID_OPTION||error&&error.code===REASON_CODES.UNKNOWN_OPTION?'INVALID':'ABSTAIN',error&&error.code||REASON_CODES.PROJECTION_INVALID,null,error&&error.path||'$');
  }
}

function createAttempt(ordinal,item,index,result){
  var status=result.status==='READY'?'HITS':result.status==='EMPTY'?'EMPTY':'ABSTAIN';
  var reason=status==='HITS'?REASON_CODES.HITS_LOCATED_REVIEW_REQUIRED:
    status==='EMPTY'?REASON_CODES.NO_COUNTEREVIDENCE_FOUND_WITHIN_SCOPE:REASON_CODES.SEARCH_ATTEMPT_ABSTAINED;
  var base={
    schema:SCHEMAS.attempt,ordinal:ordinal,purpose:item.purpose,
    projectionRuleRef:item.projectionRuleRef,queryRef:queryRef(item.query),indexRef:indexRef(index),
    resultHash:result.resultHash,hitIds:result.hits.map(function(hit){ return hit.hitId; }).sort(),
    passageClaimIds:[],evidenceCandidateIds:[],status:status,reasonCodes:[reason],
    operationCount:result.operationCount
  };
  var identityHash=Canonical.hashCanonical(base),value={
    schema:base.schema,attemptId:'countersearch-attempt:'+shortHash(identityHash),ordinal:base.ordinal,
    purpose:base.purpose,projectionRuleRef:base.projectionRuleRef,queryRef:base.queryRef,
    indexRef:base.indexRef,resultHash:base.resultHash,hitIds:base.hitIds,
    passageClaimIds:base.passageClaimIds,evidenceCandidateIds:base.evidenceCandidateIds,
    status:base.status,reasonCodes:base.reasonCodes,operationCount:base.operationCount
  };
  value.contentHash=Canonical.hashCanonical(value);
  return freeze(value);
}

function safeClaimRef(claim){
  try{ return claimRef(claim); }catch(error){ return null; }
}
function safeIndexState(index){
  try{
    if(LocalTextIndex.validateIndex(index).status!=='VALID') return {sourceSetHash:null,indexRef:null};
    return {sourceSetHash:index.manifest.sourceSetHash,indexRef:indexRef(index)};
  }catch(error){ return {sourceSetHash:null,indexRef:null}; }
}
function makeRun(definition){
  var base={
    schema:SCHEMAS.run,status:definition.status,code:definition.code,
    targetClaimRef:definition.targetClaimRef,sourceSetHash:definition.sourceSetHash,
    indexRef:definition.indexRef,projectionRef:definition.projection?projectionRef(definition.projection):null,
    projection:definition.projection,requiredPurposes:REQUIRED_PURPOSES,attempts:definition.attempts,
    visitedQueryHashes:definition.visitedQueryHashes,completenessClaim:definition.completenessClaim,
    operationCount:definition.operationCount,reasonCodes:definition.reasonCodes,
    finalStatus:'ABSTAIN',reviewStatus:'REQUIRES_REVIEW',finalRelation:'NOT_COMPUTED',
    semanticTruth:false,soundness:'NOT_COMPUTED',commitAllowed:false
  };
  var identityHash=Canonical.hashCanonical(base),value={
    schema:base.schema,runId:'countersearch-run:'+shortHash(identityHash),status:base.status,code:base.code,
    targetClaimRef:base.targetClaimRef,sourceSetHash:base.sourceSetHash,indexRef:base.indexRef,
    projectionRef:base.projectionRef,projection:base.projection,requiredPurposes:base.requiredPurposes,
    attempts:base.attempts,visitedQueryHashes:base.visitedQueryHashes,
    completenessClaim:base.completenessClaim,operationCount:base.operationCount,
    reasonCodes:base.reasonCodes,finalStatus:base.finalStatus,reviewStatus:base.reviewStatus,
    finalRelation:base.finalRelation,semanticTruth:base.semanticTruth,soundness:base.soundness,
    commitAllowed:base.commitAllowed
  };
  value.contentHash=Canonical.hashCanonical(value);
  return freeze(value);
}
function refusal(code,claim,index,projection,visited,attempts,operationCount,status){
  var state=safeIndexState(index);
  return makeRun({
    status:status||'ABSTAIN',code:code,targetClaimRef:safeClaimRef(claim),
    sourceSetHash:state.sourceSetHash,indexRef:state.indexRef,projection:projection||null,
    attempts:attempts||[],visitedQueryHashes:visited||[],
    completenessClaim:attempts&&attempts.length?'PARTIAL_REQUIRED_PURPOSES_ONLY':'NOT_COMPUTED',
    operationCount:operationCount||0,reasonCodes:[code]
  });
}

function run(index,claim,options){
  var parsed,report,projection,visited,attempts=[],operations=0,i,item,remaining,result,attempt,allEmpty,code;
  try{
    parsed=parseRunOptions(options);
    report=LocalTextIndex.validateIndex(index);
    if(report.status!=='VALID') return refusal(REASON_CODES.INVALID_INDEX,claim,index,null,parsed.visitedQueryHashes,[],0,'ABSTAIN');
    if(parsed.expectedSourceSetHash!==null&&parsed.expectedSourceSetHash!==index.manifest.sourceSetHash) return refusal(REASON_CODES.STALE_SOURCE_SET,claim,index,null,parsed.visitedQueryHashes);
    if(parsed.expectedIndexHash!==null&&parsed.expectedIndexHash!==index.indexHash) return refusal(REASON_CODES.STALE_INDEX,claim,index,null,parsed.visitedQueryHashes);
    projection=buildProjection(claim,parsed);
    if(parsed.maxQueries<projection.items.length) return refusal(REASON_CODES.BUDGET_EXCEEDED,claim,index,projection,parsed.visitedQueryHashes);
    visited=parsed.visitedQueryHashes.slice();
    for(i=0;i<projection.items.length;i++){
      if(visited.indexOf(projection.items[i].query.contentHash)!==-1) return refusal(REASON_CODES.CYCLE_DETECTED,claim,index,projection,visited,attempts,operations);
    }
    for(i=0;i<projection.items.length;i++){
      item=projection.items[i];
      remaining=parsed.maxOperations-operations;
      if(remaining<1) return refusal(REASON_CODES.BUDGET_EXCEEDED,claim,index,projection,visited,attempts,operations);
      result=LocalTextIndex.search(index,item.query,{
        maxOperations:remaining,maxHits:parsed.maxHits,contextChars:parsed.contextChars,
        expectedSourceSetHash:index.manifest.sourceSetHash,expectedIndexHash:index.indexHash,
        visitedQueryHashes:visited
      });
      attempt=createAttempt(i,item,index,result);
      attempts.push(attempt);
      operations+=result.operationCount;
      visited=uniqueSorted(visited.concat([item.query.contentHash]));
      if(result.status==='ABSTAIN'){
        code=result.code==='BUDGET_EXCEEDED'?REASON_CODES.BUDGET_EXCEEDED:REASON_CODES.SEARCH_ATTEMPT_ABSTAINED;
        return refusal(code,claim,index,projection,visited,attempts,operations);
      }
    }
    if(attempts.length!==REQUIRED_PURPOSES.length) return refusal(REASON_CODES.REQUIRED_PURPOSES_INCOMPLETE,claim,index,projection,visited,attempts,operations);
    allEmpty=attempts.every(function(value){ return value.status==='EMPTY'; });
    code=allEmpty?REASON_CODES.NO_COUNTEREVIDENCE_FOUND_WITHIN_SCOPE:REASON_CODES.COUNTERSEARCH_RESULTS_REQUIRE_REVIEW;
    return makeRun({
      status:'EXECUTED',code:code,targetClaimRef:projection.targetClaimRef,
      sourceSetHash:index.manifest.sourceSetHash,indexRef:indexRef(index),projection:projection,
      attempts:attempts,visitedQueryHashes:visited,
      completenessClaim:'ALL_REQUIRED_PURPOSES_ATTEMPTED_IN_PINNED_LOCAL_INDEX',
      operationCount:operations,reasonCodes:[code]
    });
  }catch(error){
    code=error&&error.code||REASON_CODES.RUN_INVALID;
    return refusal(code,claim,index,projection||null,visited||[],attempts,operations,
      code===REASON_CODES.INVALID_OPTION||code===REASON_CODES.UNKNOWN_OPTION?'INVALID':'ABSTAIN');
  }
}

function assertClaimRef(value,path){
  assertObject(value,path);
  if(Object.keys(value).sort().join(',')!=='claimAstId,contentHash,parserRef,resolutionStatus') reject(REASON_CODES.PROJECTION_INVALID,'claim ref keys changed',path);
  assertId(value.claimAstId,path+'.claimAstId');
  assertHash(value.contentHash,path+'.contentHash');
  if(value.resolutionStatus!=='RESOLVED') reject(REASON_CODES.PROJECTION_INVALID,'resolved claim ref required',path+'.resolutionStatus');
}
function assertHashArray(value,path){
  var i,seen={};
  if(!Array.isArray(value)||value.length>4096) reject(REASON_CODES.RUN_INVALID,'hash array rejected',path);
  for(i=0;i<value.length;i++){
    assertHash(value[i],path+'['+i+']');
    if(has(seen,value[i])) reject(REASON_CODES.RUN_INVALID,'duplicate hash',path+'['+i+']');
    seen[value[i]]=true;
  }
}
function assertProjectionItem(value,index){
  var expectedHash,expectedId,report,path='$.items['+index+']';
  assertObject(value,path);
  if(Object.keys(value).sort().join(',')!=='completenessClaim,contentHash,itemId,projectionRuleRef,purpose,query,reasonCodes,schema') reject(REASON_CODES.PROJECTION_INVALID,'projection item keys changed',path);
  if(value.schema!==SCHEMAS.projectionItem||value.purpose!==REQUIRED_PURPOSES[index]) reject(REASON_CODES.PROJECTION_INVALID,'purpose order changed',path);
  if(value.projectionRuleRef.contentHash!==RULE_BY_PURPOSE[value.purpose].ref.contentHash) reject(REASON_CODES.PROJECTION_INVALID,'rule ref changed',path+'.projectionRuleRef');
  report=SearchContracts.validateSemanticQuery(value.query);
  if(report.status!=='VALID') reject(REASON_CODES.PROJECTION_INVALID,'query rejected',path+'.query');
  if(value.query.origin.kind!=='CLAIM_AST') reject(REASON_CODES.PROJECTION_INVALID,'claim origin required',path+'.query.origin');
  expectedId='projection-item:'+shortHash(Canonical.hashCanonical(without(value,['itemId','contentHash'])));
  if(value.itemId!==expectedId) reject(REASON_CODES.PROJECTION_INVALID,'item ID changed',path+'.itemId');
  expectedHash=Canonical.hashCanonical(without(value,['contentHash']));
  if(value.contentHash!==expectedHash) reject(REASON_CODES.PROJECTION_INVALID,'item hash changed',path+'.contentHash');
}
function assertProjection(value){
  var keys='completenessClaim,contentHash,items,projectionId,projectionRuleSetHash,projectorRef,requiredPurposes,schema,semanticTruth,targetClaimRef,thesaurusHash',i,queryHashes=[],expectedId,expectedHash;
  assertObject(value,'$');
  if(Object.keys(value).sort().join(',')!==keys) reject(REASON_CODES.PROJECTION_INVALID,'projection keys changed','$');
  if(value.schema!==SCHEMAS.projection||value.semanticTruth!==false) reject(REASON_CODES.PROJECTION_INVALID,'projection boundary changed','$');
  assertClaimRef(value.targetClaimRef,'$.targetClaimRef');
  if(value.projectorRef.contentHash!==PROJECTOR_REF.contentHash||value.projectionRuleSetHash!==PROJECTION_RULE_SET_HASH) reject(REASON_CODES.PROJECTION_INVALID,'projector identity changed','$.projectorRef');
  assertHash(value.thesaurusHash,'$.thesaurusHash');
  if(!sameArray(value.requiredPurposes,REQUIRED_PURPOSES)||!Array.isArray(value.items)||value.items.length!==REQUIRED_PURPOSES.length) reject(REASON_CODES.PROJECTION_INVALID,'required purposes changed','$.requiredPurposes');
  for(i=0;i<value.items.length;i++){
    assertProjectionItem(value.items[i],i);
    if(value.items[i].query.origin.claimId!==value.targetClaimRef.claimAstId) reject(REASON_CODES.PROJECTION_INVALID,'query claim origin changed','$.items['+i+'].query.origin.claimId');
    queryHashes.push(value.items[i].query.contentHash);
  }
  if(uniqueSorted(queryHashes).length!==queryHashes.length) reject(REASON_CODES.PROJECTION_INVALID,'duplicate query hash','$.items');
  expectedId='claim-query-projection:'+shortHash(Canonical.hashCanonical(without(value,['projectionId','contentHash'])));
  if(value.projectionId!==expectedId) reject(REASON_CODES.PROJECTION_INVALID,'projection ID changed','$.projectionId');
  expectedHash=Canonical.hashCanonical(without(value,['contentHash']));
  if(value.contentHash!==expectedHash) reject(REASON_CODES.PROJECTION_INVALID,'projection hash changed','$.contentHash');
  return true;
}
function assertAttempt(value,index,projection){
  var keys='attemptId,contentHash,evidenceCandidateIds,hitIds,indexRef,operationCount,ordinal,passageClaimIds,projectionRuleRef,purpose,queryRef,reasonCodes,resultHash,schema,status',expectedId,expectedHash;
  assertObject(value,'$.attempts['+index+']');
  if(Object.keys(value).sort().join(',')!==keys) reject(REASON_CODES.RUN_INVALID,'attempt keys changed','$.attempts['+index+']');
  if(value.schema!==SCHEMAS.attempt||value.ordinal!==index||value.purpose!==projection.items[index].purpose) reject(REASON_CODES.RUN_INVALID,'attempt order changed','$.attempts['+index+']');
  assertEnum(value.status,ATTEMPT_STATUSES,'$.attempts['+index+'].status');
  assertHash(value.resultHash,'$.attempts['+index+'].resultHash');
  if(value.queryRef.contentHash!==projection.items[index].query.contentHash) reject(REASON_CODES.RUN_INVALID,'attempt query changed','$.attempts['+index+'].queryRef');
  if(value.projectionRuleRef.contentHash!==projection.items[index].projectionRuleRef.contentHash) reject(REASON_CODES.RUN_INVALID,'attempt rule changed','$.attempts['+index+'].projectionRuleRef');
  if(!Array.isArray(value.hitIds)||!Array.isArray(value.passageClaimIds)||!Array.isArray(value.evidenceCandidateIds)) reject(REASON_CODES.RUN_INVALID,'attempt references rejected','$.attempts['+index+']');
  assertInteger(value.operationCount,0,10000000,'$.attempts['+index+'].operationCount');
  expectedId='countersearch-attempt:'+shortHash(Canonical.hashCanonical(without(value,['attemptId','contentHash'])));
  if(value.attemptId!==expectedId) reject(REASON_CODES.RUN_INVALID,'attempt ID changed','$.attempts['+index+'].attemptId');
  expectedHash=Canonical.hashCanonical(without(value,['contentHash']));
  if(value.contentHash!==expectedHash) reject(REASON_CODES.RUN_INVALID,'attempt hash changed','$.attempts['+index+'].contentHash');
}
function assertRun(value){
  var keys='attempts,code,commitAllowed,completenessClaim,contentHash,finalRelation,finalStatus,indexRef,operationCount,projection,projectionRef,reasonCodes,requiredPurposes,reviewStatus,runId,schema,semanticTruth,soundness,sourceSetHash,status,targetClaimRef,visitedQueryHashes',base,expectedId,expectedHash,i;
  assertObject(value,'$');
  if(Object.keys(value).sort().join(',')!==keys) reject(REASON_CODES.RUN_INVALID,'run keys changed','$');
  if(value.schema!==SCHEMAS.run) reject(REASON_CODES.RUN_INVALID,'run schema changed','$.schema');
  assertEnum(value.status,RUN_STATUSES,'$.status');
  if(value.finalStatus!=='ABSTAIN'||value.reviewStatus!=='REQUIRES_REVIEW'||value.finalRelation!=='NOT_COMPUTED'||value.semanticTruth!==false||value.soundness!=='NOT_COMPUTED'||value.commitAllowed!==false) reject(REASON_CODES.RUN_INVALID,'review boundary changed','$');
  if(!sameArray(value.requiredPurposes,REQUIRED_PURPOSES)) reject(REASON_CODES.RUN_INVALID,'required purposes changed','$.requiredPurposes');
  assertHashArray(value.visitedQueryHashes,'$.visitedQueryHashes');
  assertInteger(value.operationCount,0,10000000,'$.operationCount');
  if(value.projection!==null){
    assertProjection(value.projection);
    if(value.projectionRef.contentHash!==value.projection.contentHash) reject(REASON_CODES.RUN_INVALID,'projection ref changed','$.projectionRef');
    for(i=0;i<value.attempts.length;i++) assertAttempt(value.attempts[i],i,value.projection);
  }else if(value.projectionRef!==null||value.attempts.length) reject(REASON_CODES.RUN_INVALID,'attempts require projection','$.projection');
  if(value.status==='EXECUTED'){
    if(value.projection===null||value.attempts.length!==REQUIRED_PURPOSES.length||value.attempts.some(function(item){ return item.status==='ABSTAIN'; })) reject(REASON_CODES.RUN_INVALID,'executed run is incomplete','$');
    if(value.finalStatus!=='ABSTAIN') reject(REASON_CODES.RUN_INVALID,'final status changed','$.finalStatus');
  }
  base=without(value,['runId','contentHash']);
  expectedId='countersearch-run:'+shortHash(Canonical.hashCanonical(base));
  if(value.runId!==expectedId) reject(REASON_CODES.RUN_INVALID,'run ID changed','$.runId');
  expectedHash=Canonical.hashCanonical(without(value,['contentHash']));
  if(value.contentHash!==expectedHash) reject(REASON_CODES.RUN_INVALID,'run hash changed','$.contentHash');
  return true;
}
function validationReport(assertion,value){
  try{ assertion(Canonical.deepCopy(value)); return freeze({status:'VALID',code:null,errors:[]}); }
  catch(error){
    return freeze({status:'INVALID',code:error&&error.code||REASON_CODES.RUN_INVALID,errors:[{
      code:error&&error.code||REASON_CODES.RUN_INVALID,path:error&&error.path||'$',message:error&&error.message||String(error)
    }]});
  }
}
function validateProjection(value){ return validationReport(assertProjection,value); }
function validateRun(value){ return validationReport(assertRun,value); }

global.MRDP78ClaimCountersearch=freeze({
  version:VERSION,status:'READY',integrationStatus:'DISCONNECTED_DRAFT',
  schema:'meridian.claim-countersearch/1',schemas:SCHEMAS,
  requiredPurposes:REQUIRED_PURPOSES,reasonCodes:REASON_CODES,
  projectorRef:PROJECTOR_REF,projectionRuleSetHash:PROJECTION_RULE_SET_HASH,
  maxOutputStatus:'LOCATED',finalStatus:'ABSTAIN',reviewStatus:'REQUIRES_REVIEW',
  semanticTruth:false,soundness:'NOT_COMPUTED',commitAllowed:false,
  project:project,run:run,replay:run,
  validateProjection:validateProjection,validateRun:validateRun
});
})(typeof globalThis!=='undefined'?globalThis:this);
