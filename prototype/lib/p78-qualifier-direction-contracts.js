(function(global){
'use strict';

var VERSION='2.1.0';
var CONTRACT_SCHEMA='meridian.qualifier-direction-contracts/2';
var OUTPUT_SCHEMA='meridian.qualifier-direction-assessment/2';
var Canonical=global.MRDP78CanonicalJSON||global.MRDP78CanonicalJson;
var ClaimIR=global.MRDP78ClaimIR;
var Parser=global.MRDP78LinguisticParserAdapter;
var Evidence=global.MRDP78EvidenceContracts;

if(!Canonical||!ClaimIR||ClaimIR.status!=='READY'||!Parser||Parser.status!=='READY'||!Evidence||Evidence.status!=='READY'){
  global.MRDP78QualifierDirectionContracts=Object.freeze({
    version:VERSION,
    status:'BLOCKED',
    code:'QUALIFIER_DIRECTION_DEPENDENCY_UNAVAILABLE',
    semanticTruth:false,
    commitAllowed:false
  });
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var QUALIFIER_ROLES=freeze({TIME:true,PLACE:true,POPULATION:true,METHOD:true,CONDITION:true,MEASURE:true});
var QUALIFIER_FIELDS=freeze(ClaimIR.qualifierFields.slice());
var QUALIFIER_FIELD_SET=freeze(QUALIFIER_FIELDS.reduce(function(result,key){ result[key]=true; return result; },{}));
var DIRECTIONS=freeze({NARROWER:true,BROADER:true});
var STATUSES=freeze({DIRECTED:true,ABSTAIN:true});
var ABSTAIN_CODES=freeze({
  RELATION_NOT_QUALIFIES:true,
  STRUCTURAL_ALIGNMENT_REQUIRED:true,
  PREDICATE_MISMATCH:true,
  CORE_ARGUMENT_MISMATCH:true,
  POLARITY_MISMATCH:true,
  MODALITY_MISMATCH:true,
  QUANTIFIER_MISMATCH:true,
  NO_QUALIFIER_DELTA:true,
  QUALIFIER_KEY_UNSUPPORTED:true,
  QUALIFIER_VALUE_CONFLICT:true,
  QUALIFIER_SETS_INCOMPARABLE:true,
  MULTIPLE_QUALIFIER_DELTA_UNSUPPORTED:true,
  METHOD_BINDING_UNPROVEN:true,
  METHOD_SURFACE_PATTERN_UNPROVEN:true,
  TOKEN_REMAINDER_MISMATCH:true
});
var RULESET=freeze({
  id:'p78:qualifier-direction:single-controlled-method-clause',
  version:VERSION,
  directionDomain:'SYNTACTIC_SPECIFICITY',
  orientation:'PASSAGE_TO_TARGET',
  supportedQualifier:'method',
  markerToken:'через',
  qualifiedDeltaTokenCount:2,
  requireTokenRemainderIdentity:true,
  requireExactSourceRemainderIdentity:true,
  directions:freeze(['BROADER','NARROWER'])
});
var RULESET_HASH=Canonical.hashCanonical(RULESET);
var MAX_GRAPH_NODES=100000;
var MAX_GRAPH_VALUES=200000;
var MAX_GRAPH_CODE_UNITS=2000000;
var MAX_GRAPH_DEPTH=64;
var MAX_CLAIM_CODE_UNITS=8192;
var KEY_PATTERN=/^[a-z][a-z0-9_]{0,63}$/;

function fail(code,path,detail){
  var error=new TypeError(code+(path?' at '+path:'')+(detail?': '+detail:''));
  error.name='P78QualifierDirectionError';
  error.code=code;
  error.path=path||'$';
  throw error;
}

function scanData(value,path,state,ancestors){
  var names,keys,symbols,descriptor,i;
  state.values++;
  if(state.values>MAX_GRAPH_VALUES) fail('INPUT_GRAPH_VALUE_BUDGET_EXCEEDED',path);
  if(value===null||typeof value==='boolean') return;
  if(typeof value==='string'){
    state.codeUnits+=value.length;
    if(state.codeUnits>MAX_GRAPH_CODE_UNITS) fail('INPUT_GRAPH_TEXT_BUDGET_EXCEEDED',path);
    return;
  }
  if(typeof value==='number'){
    if(!Number.isFinite(value)) fail('NON_FINITE_NUMBER_FORBIDDEN',path);
    return;
  }
  if(typeof value!=='object') fail('NON_DATA_VALUE_FORBIDDEN',path);
  state.nodes++;
  if(state.nodes>MAX_GRAPH_NODES) fail('INPUT_GRAPH_BUDGET_EXCEEDED',path);
  if(ancestors.length>=MAX_GRAPH_DEPTH) fail('INPUT_GRAPH_DEPTH_EXCEEDED',path);
  if(ancestors.indexOf(value)!==-1) fail('CYCLIC_DATA_FORBIDDEN',path);
  ancestors.push(value);
  symbols=Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(value):[];
  if(symbols.length) fail('SYMBOL_FIELD_FORBIDDEN',path);
  if(Array.isArray(value)&&value.length>MAX_GRAPH_VALUES-state.values) fail('INPUT_GRAPH_VALUE_BUDGET_EXCEEDED',path);
  names=Object.getOwnPropertyNames(value);
  keys=Object.keys(value);
  if(Array.isArray(value)){
    if(names.length!==value.length+1) fail('ARRAY_PROPERTY_FORBIDDEN',path);
    for(i=0;i<value.length;i++){
      descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||descriptor.get||descriptor.set) fail('SPARSE_OR_ACCESSOR_ARRAY_FORBIDDEN',path+'['+i+']');
      scanData(value[i],path+'['+i+']',state,ancestors);
    }
  }else{
    if(names.length!==keys.length) fail('NON_ENUMERABLE_FIELD_FORBIDDEN',path);
    for(i=0;i<keys.length;i++){
      descriptor=Object.getOwnPropertyDescriptor(value,keys[i]);
      if(!descriptor||descriptor.get||descriptor.set) fail('ACCESSOR_FORBIDDEN',path+'.'+keys[i]);
    }
    if(!Canonical.isPlainObject(value)) fail('PLAIN_OBJECT_REQUIRED',path);
    for(i=0;i<keys.length;i++) scanData(value[keys[i]],path+'.'+keys[i],state,ancestors);
  }
  ancestors.pop();
}

function safeData(value){ scanData(value,'$',{nodes:0,values:0,codeUnits:0},[]); return value; }

function object(value,path){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Canonical.isPlainObject(value)) fail('PLAIN_OBJECT_REQUIRED',path);
  return value;
}

function exactKeys(value,required,path){
  var allowed={},keys=Object.keys(value),i;
  for(i=0;i<required.length;i++) allowed[required[i]]=true;
  for(i=0;i<required.length;i++) if(!own.call(value,required[i])) fail('MISSING_FIELD',path+'.'+required[i]);
  for(i=0;i<keys.length;i++) if(!allowed[keys[i]]) fail('UNKNOWN_FIELD',path+'.'+keys[i]);
}

function hash(value,path){ if(!Canonical.isSha256(value)) fail('HASH_REQUIRED',path); return value; }
function same(left,right){ return Canonical.canonicalize(left)===Canonical.canonicalize(right); }
function compareText(left,right){ return left<right?-1:left>right?1:0; }
function claimRef(claim){ return Canonical.deepCopy(Evidence.claimRef(claim)); }

function assertClaim(value,path){
  var report=ClaimIR.validateClaimAst(value);
  if(!report||report.status!=='VALID') fail('CLAIM_AST_INVALID',path,report&&report.code||'INVALID');
  if(value.resolutionStatus!=='RESOLVED') fail('CLAIM_AST_NOT_RESOLVED',path+'.resolutionStatus');
}

function parseSource(value,path){
  var claim=value.claimAst,spanId,source;
  assertClaim(claim,path+'.claimAst');
  object(value.surfaceBySpanId,path+'.surfaceBySpanId');
  spanId=claim.sourceSpanIds[0];
  if(!own.call(value.surfaceBySpanId,spanId)) fail('CLAIM_SOURCE_TEXT_MISSING',path+'.surfaceBySpanId');
  source=value.surfaceBySpanId[spanId];
  if(typeof source!=='string'||!source.length||source.trim()!==source) fail('CLAIM_SOURCE_TEXT_INVALID',path+'.surfaceBySpanId');
  if(source.length>MAX_CLAIM_CODE_UNITS) fail('CLAIM_TEXT_BUDGET_EXCEEDED',path+'.surfaceBySpanId');
  if(Canonical.hashText(source)!==value.inputHash) fail('CLAIM_SOURCE_HASH_MISMATCH',path+'.inputHash');
  return source;
}

function replayParseResult(value,path){
  var source,replayed,replayMaxTokens;
  object(value,path);
  exactKeys(value,[
    'schema','version','status','code','resolutionStatus','parserRef','lexiconHash','inputHash','claimAst',
    'surfaceBySpanId','tokens','dependencies','issues','evidenceStatus','semanticTruth','soundness','resultHash'
  ],path);
  if(value.schema!=='meridian.claim-parse-result/1'||value.version!==Parser.version) fail('PARSE_RESULT_SCHEMA_MISMATCH',path+'.schema');
  if(value.status!=='READY'||value.resolutionStatus!=='RESOLVED'||value.code!==null) fail('CLAIM_REPLAY_NOT_RESOLVED',path+'.status');
  if(!same(value.parserRef,Parser.parserRef)||value.lexiconHash!==Parser.lexiconHash) fail('PARSER_IDENTITY_MISMATCH',path+'.parserRef');
  hash(value.inputHash,path+'.inputHash');
  hash(value.resultHash,path+'.resultHash');
  source=parseSource(value,path);
  if(!Array.isArray(value.tokens)) fail('PARSE_RESULT_TOKENS_INVALID',path+'.tokens');
  replayMaxTokens=Math.max(32,value.tokens.length);
  if(replayMaxTokens>128) fail('PARSE_RESULT_TOKENS_INVALID',path+'.tokens');
  replayed=Parser.replay(source,{expectedLexiconHash:value.lexiconHash,maxTokens:replayMaxTokens});
  if(!replayed||replayed.status!=='READY'||replayed.resolutionStatus!=='RESOLVED') fail('CLAIM_REPLAY_NOT_RESOLVED',path);
  if(Canonical.canonicalize(replayed)!==Canonical.canonicalize(value)) fail('PARSE_REPLAY_MISMATCH',path);
  return replayed;
}

function assertCandidate(value,path){
  var report=Evidence.validateEvidenceCandidate(value);
  if(!report||report.status!=='VALID') fail('EVIDENCE_CANDIDATE_INVALID',path,report&&report.code||'INVALID');
}

function coreArgumentMap(claim){
  var result={},i,item;
  for(i=0;i<claim.arguments.length;i++){
    item=claim.arguments[i];
    if(!own.call(QUALIFIER_ROLES,item.role)) result[item.role]=item.senseId;
  }
  return result;
}

function argumentAlignment(target,passage){
  var left=coreArgumentMap(target),right=coreArgumentMap(passage);
  var keys=Object.keys(left).concat(Object.keys(right)).filter(function(key,index,all){ return all.indexOf(key)===index; }).sort(compareText),i,key;
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(!own.call(left,key)||!own.call(right,key)||left[key]===null||right[key]===null||left[key]!==right[key]) return 'FALSE';
  }
  return 'TRUE';
}

function qualifierAlignment(target,passage){
  var keys=Object.keys(target.qualifiers).concat(Object.keys(passage.qualifiers)).filter(function(key,index,all){ return all.indexOf(key)===index; }).sort(compareText),i,key;
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(!own.call(target.qualifiers,key)||!own.call(passage.qualifiers,key)||target.qualifiers[key]!==passage.qualifiers[key]) return 'FALSE';
  }
  return 'TRUE';
}

function computedAlignment(target,passage){
  return {
    predicate:target.predicate.relationTypeId!==null&&target.predicate.senseId!==null&&
      target.predicate.relationTypeId===passage.predicate.relationTypeId&&target.predicate.senseId===passage.predicate.senseId?'TRUE':'FALSE',
    arguments:argumentAlignment(target,passage),
    polarity:target.polarity===passage.polarity?'TRUE':'FALSE',
    modality:target.modality===passage.modality?'TRUE':'FALSE',
    quantifier:target.quantifier===passage.quantifier?'TRUE':'FALSE',
    qualifiers:qualifierAlignment(target,passage)
  };
}

function parseRef(value){
  return {
    inputHash:value.inputHash,
    resultHash:value.resultHash,
    parserRef:Canonical.deepCopy(value.parserRef),
    lexiconHash:value.lexiconHash
  };
}

function resolveDefinition(raw){
  var definition=safeData(raw),targetParse,passageParse,target,passage,candidate,targetRef,passageRef,actualAlignment;
  object(definition,'$');
  exactKeys(definition,['targetParseResult','passageParseResult','evidenceCandidate'],'$');
  targetParse=replayParseResult(definition.targetParseResult,'$.targetParseResult');
  passageParse=replayParseResult(definition.passageParseResult,'$.passageParseResult');
  target=targetParse.claimAst;
  passage=passageParse.claimAst;
  candidate=definition.evidenceCandidate;
  assertCandidate(candidate,'$.evidenceCandidate');
  targetRef=claimRef(target);
  passageRef=claimRef(passage);
  if(!same(candidate.targetClaimRef,targetRef)) fail('TARGET_CLAIM_REFERENCE_MISMATCH','$.evidenceCandidate.targetClaimRef');
  if(!same(candidate.passageClaimRef,passageRef)) fail('PASSAGE_CLAIM_REFERENCE_MISMATCH','$.evidenceCandidate.passageClaimRef');
  actualAlignment=computedAlignment(target,passage);
  if(!same(actualAlignment,candidate.alignment)) fail('CANDIDATE_ALIGNMENT_MISMATCH','$.evidenceCandidate.alignment');
  return {
    targetParse:targetParse,passageParse:passageParse,target:target,passage:passage,candidate:candidate,
    targetRef:targetRef,passageRef:passageRef,actualAlignment:actualAlignment
  };
}

function abstain(code){ return {status:'ABSTAIN',scopeDirection:null,witness:null,abstainCode:code}; }
function sourceSpanId(parse,token){
  return 'span:'+Canonical.hashCanonical({
    schema:'meridian.claim-source-span/1',
    textHash:parse.inputHash,
    start:token.offset,
    end:token.offset+token.surface.length
  }).slice(7);
}

function methodArgument(claim){
  var values=claim.arguments.filter(function(item){ return item.role==='METHOD'; });
  return values.length===1?values[0]:null;
}

function methodWitness(qualifiedParse,unqualifiedParse,qualifiedSide){
  var claim=qualifiedParse.claimAst,argument=methodArgument(claim),tokens=qualifiedParse.tokens;
  var markerIndexes=[],i,markerIndex,markerToken,valueToken,remainder,baseTokens,valueSurface,expectedSpanId,qualifiedSource,unqualifiedSource,removeStart,removeEnd,strippedSource;
  if(!argument||argument.senseId===null) return abstain('METHOD_BINDING_UNPROVEN');
  for(i=0;i<tokens.length;i++) if(tokens[i].token===RULESET.markerToken) markerIndexes.push(i);
  if(markerIndexes.length!==1) return abstain('METHOD_SURFACE_PATTERN_UNPROVEN');
  markerIndex=markerIndexes[0];
  markerToken=tokens[markerIndex];
  if(markerIndex+1>=tokens.length||tokens.length!==unqualifiedParse.tokens.length+RULESET.qualifiedDeltaTokenCount){
    return abstain('METHOD_SURFACE_PATTERN_UNPROVEN');
  }
  valueToken=tokens[markerIndex+1];
  valueSurface=qualifiedParse.surfaceBySpanId[argument.surfaceSpanId];
  expectedSpanId=sourceSpanId(qualifiedParse,valueToken);
  if(markerToken.index!==markerIndex||valueToken.index!==markerIndex+1||argument.surfaceSpanId!==expectedSpanId||
     typeof valueSurface!=='string'||valueSurface!==valueToken.surface||claim.qualifiers.method!==valueToken.surface){
    return abstain('METHOD_BINDING_UNPROVEN');
  }
  qualifiedSource=qualifiedParse.surfaceBySpanId[claim.sourceSpanIds[0]];
  unqualifiedSource=unqualifiedParse.surfaceBySpanId[unqualifiedParse.claimAst.sourceSpanIds[0]];
  if(typeof qualifiedSource!=='string'||typeof unqualifiedSource!=='string'||
     qualifiedSource.slice(markerToken.offset,markerToken.offset+markerToken.surface.length)!==markerToken.surface||
     qualifiedSource.slice(valueToken.offset,valueToken.offset+valueToken.surface.length)!==valueToken.surface||
     valueToken.offset!==markerToken.offset+markerToken.surface.length+1||
     qualifiedSource.slice(markerToken.offset+markerToken.surface.length,valueToken.offset)!==' '){
    return abstain('METHOD_SURFACE_PATTERN_UNPROVEN');
  }
  removeStart=markerToken.offset;
  removeEnd=valueToken.offset+valueToken.surface.length;
  if(removeStart>0&&qualifiedSource.charAt(removeStart-1)===' ') removeStart--;
  else if(removeEnd<qualifiedSource.length&&qualifiedSource.charAt(removeEnd)===' ') removeEnd++;
  else return abstain('METHOD_SURFACE_PATTERN_UNPROVEN');
  strippedSource=qualifiedSource.slice(0,removeStart)+qualifiedSource.slice(removeEnd);
  if(strippedSource!==unqualifiedSource) return abstain('TOKEN_REMAINDER_MISMATCH');
  remainder=tokens.filter(function(item,index){ return index!==markerIndex&&index!==markerIndex+1; }).map(function(item){ return item.token; });
  baseTokens=unqualifiedParse.tokens.map(function(item){ return item.token; });
  if(!same(remainder,baseTokens)) return abstain('TOKEN_REMAINDER_MISMATCH');
  return {
    status:'DIRECTED',
    scopeDirection:qualifiedSide==='PASSAGE'?'NARROWER':'BROADER',
    witness:{
      qualifiedSide:qualifiedSide,
      qualifierKey:'method',
      markerToken:RULESET.markerToken,
      markerTokenIndex:tokens[markerIndex].index,
      valueTokenIndex:valueToken.index,
      valueSurfaceSpanId:argument.surfaceSpanId,
      valueSenseId:argument.senseId,
      qualifierValueHash:Canonical.hashText(claim.qualifiers.method)
    },
    abstainCode:null
  };
}

function directionDecision(resolved){
  var candidate=resolved.candidate,a=resolved.actualAlignment,targetKeys,passageKeys,targetMethod,passageMethod,unsupported;
  if(candidate.proposedRelation!=='QUALIFIES') return abstain('RELATION_NOT_QUALIFIES');
  if(candidate.status!=='STRUCTURALLY_ALIGNED') return abstain('STRUCTURAL_ALIGNMENT_REQUIRED');
  if(a.predicate!=='TRUE') return abstain('PREDICATE_MISMATCH');
  if(a.arguments!=='TRUE') return abstain('CORE_ARGUMENT_MISMATCH');
  if(a.polarity!=='TRUE') return abstain('POLARITY_MISMATCH');
  if(a.modality!=='TRUE') return abstain('MODALITY_MISMATCH');
  if(a.quantifier!=='TRUE') return abstain('QUANTIFIER_MISMATCH');
  if(a.qualifiers==='TRUE') return abstain('NO_QUALIFIER_DELTA');
  targetKeys=Object.keys(resolved.target.qualifiers).sort(compareText);
  passageKeys=Object.keys(resolved.passage.qualifiers).sort(compareText);
  unsupported=targetKeys.concat(passageKeys).filter(function(key,index,all){ return all.indexOf(key)===index&&key!=='method'; });
  if(unsupported.length) return abstain('QUALIFIER_KEY_UNSUPPORTED');
  targetMethod=own.call(resolved.target.qualifiers,'method');
  passageMethod=own.call(resolved.passage.qualifiers,'method');
  if(targetMethod&&passageMethod){
    return abstain(resolved.target.qualifiers.method===resolved.passage.qualifiers.method?'NO_QUALIFIER_DELTA':'QUALIFIER_VALUE_CONFLICT');
  }
  if(targetKeys.length>1||passageKeys.length>1) return abstain('MULTIPLE_QUALIFIER_DELTA_UNSUPPORTED');
  if(targetMethod&&passageMethod) return abstain('QUALIFIER_SETS_INCOMPARABLE');
  if(targetMethod) return methodWitness(resolved.targetParse,resolved.passageParse,'TARGET');
  if(passageMethod) return methodWitness(resolved.passageParse,resolved.targetParse,'PASSAGE');
  return abstain('NO_QUALIFIER_DELTA');
}

function evidenceCandidateRef(value){ return {candidateId:value.candidateId,contentHash:value.contentHash}; }

function assessQualifierDirection(definition){
  var resolved=resolveDefinition(definition),decision=directionDecision(resolved),identity,value;
  identity={
    schema:OUTPUT_SCHEMA,
    version:VERSION,
    relation:'QUALIFIES',
    orientation:'PASSAGE_TO_TARGET',
    directionDomain:'SYNTACTIC_SPECIFICITY',
    basis:'SINGLE_CONTROLLED_METHOD_CLAUSE_DELTA',
    status:decision.status,
    scopeDirection:decision.scopeDirection,
    targetClaimRef:resolved.targetRef,
    passageClaimRef:resolved.passageRef,
    targetParseRef:parseRef(resolved.targetParse),
    passageParseRef:parseRef(resolved.passageParse),
    evidenceCandidateRef:evidenceCandidateRef(resolved.candidate),
    witness:decision.witness,
    abstainCode:decision.abstainCode,
    evaluatorRef:{id:RULESET.id,version:VERSION,rulesetHash:RULESET_HASH},
    verificationStatus:'REPLAY_REQUIRED',
    validationRequirement:'FULL_PARSE_REPLAY',
    authority:'STRUCTURAL_SCOPE_ONLY',
    logicalImplication:'NOT_COMPUTED',
    reviewStatus:'REQUIRES_REVIEW',
    semanticTruth:false,
    soundness:'NOT_COMPUTED',
    commitAllowed:false
  };
  value=Canonical.deepCopy(identity);
  value.assessmentId='qualifier-direction:'+Canonical.hashCanonical(identity).slice(7);
  value.contentHash=Canonical.hashCanonical(value);
  assertAssessment(value);
  return freeze(value);
}

function assertParserRef(value,path){
  object(value,path);
  exactKeys(value,['id','version'],path);
  if(typeof value.id!=='string'||!value.id.length||typeof value.version!=='string'||!value.version.length) fail('PARSER_REF_INVALID',path);
}

function assertClaimRef(value,path){
  object(value,path);
  exactKeys(value,['claimAstId','contentHash','parserRef','resolutionStatus'],path);
  if(typeof value.claimAstId!=='string'||value.claimAstId.indexOf('claim-ast:')!==0) fail('CLAIM_REF_INVALID',path+'.claimAstId');
  hash(value.contentHash,path+'.contentHash');
  assertParserRef(value.parserRef,path+'.parserRef');
  if(value.resolutionStatus!=='RESOLVED') fail('CLAIM_REF_NOT_RESOLVED',path+'.resolutionStatus');
}

function assertParseRef(value,path){
  object(value,path);
  exactKeys(value,['inputHash','resultHash','parserRef','lexiconHash'],path);
  hash(value.inputHash,path+'.inputHash');
  hash(value.resultHash,path+'.resultHash');
  hash(value.lexiconHash,path+'.lexiconHash');
  assertParserRef(value.parserRef,path+'.parserRef');
}

function assertCandidateRef(value,path){
  object(value,path);
  exactKeys(value,['candidateId','contentHash'],path);
  if(typeof value.candidateId!=='string'||value.candidateId.indexOf('evidence-candidate:')!==0) fail('CANDIDATE_REF_INVALID',path+'.candidateId');
  hash(value.contentHash,path+'.contentHash');
}

function assertWitness(value,path,direction){
  object(value,path);
  exactKeys(value,['qualifiedSide','qualifierKey','markerToken','markerTokenIndex','valueTokenIndex','valueSurfaceSpanId','valueSenseId','qualifierValueHash'],path);
  if(value.qualifiedSide!=='TARGET'&&value.qualifiedSide!=='PASSAGE') fail('WITNESS_SIDE_INVALID',path+'.qualifiedSide');
  if((direction==='NARROWER'&&value.qualifiedSide!=='PASSAGE')||(direction==='BROADER'&&value.qualifiedSide!=='TARGET')) fail('WITNESS_DIRECTION_MISMATCH',path+'.qualifiedSide');
  if(value.qualifierKey!=='method'||value.markerToken!==RULESET.markerToken) fail('WITNESS_RULE_MISMATCH',path);
  if(!Number.isSafeInteger(value.markerTokenIndex)||value.markerTokenIndex<0||!Number.isSafeInteger(value.valueTokenIndex)||value.valueTokenIndex!==value.markerTokenIndex+1) fail('WITNESS_TOKEN_INDEX_INVALID',path);
  if(typeof value.valueSurfaceSpanId!=='string'||!value.valueSurfaceSpanId.length||typeof value.valueSenseId!=='string'||!value.valueSenseId.length) fail('WITNESS_BINDING_INVALID',path);
  hash(value.qualifierValueHash,path+'.qualifierValueHash');
}

function assertAssessment(value){
  var identity,payload,expectedId,expectedHash;
  safeData(value);
  object(value,'$');
  exactKeys(value,[
    'schema','version','relation','orientation','directionDomain','basis','status','scopeDirection',
    'targetClaimRef','passageClaimRef','targetParseRef','passageParseRef','evidenceCandidateRef','witness',
    'abstainCode','evaluatorRef','verificationStatus','validationRequirement','authority','logicalImplication',
    'reviewStatus','semanticTruth','soundness','commitAllowed','assessmentId','contentHash'
  ],'$');
  if(value.schema!==OUTPUT_SCHEMA||value.version!==VERSION) fail('SCHEMA_MISMATCH','$.schema');
  if(value.relation!=='QUALIFIES'||value.orientation!=='PASSAGE_TO_TARGET'||value.directionDomain!=='SYNTACTIC_SPECIFICITY'||
     value.basis!=='SINGLE_CONTROLLED_METHOD_CLAUSE_DELTA') fail('DIRECTION_MODE_INVALID','$');
  if(!own.call(STATUSES,value.status)) fail('ASSESSMENT_STATUS_INVALID','$.status');
  assertClaimRef(value.targetClaimRef,'$.targetClaimRef');
  assertClaimRef(value.passageClaimRef,'$.passageClaimRef');
  assertParseRef(value.targetParseRef,'$.targetParseRef');
  assertParseRef(value.passageParseRef,'$.passageParseRef');
  if(!same(value.targetClaimRef.parserRef,value.targetParseRef.parserRef)||!same(value.passageClaimRef.parserRef,value.passageParseRef.parserRef)) fail('PARSE_CLAIM_REF_MISMATCH','$.targetParseRef');
  assertCandidateRef(value.evidenceCandidateRef,'$.evidenceCandidateRef');
  if(value.status==='DIRECTED'){
    if(!own.call(DIRECTIONS,value.scopeDirection)||value.abstainCode!==null||value.witness===null) fail('DIRECTED_ASSESSMENT_INCOMPLETE','$.status');
    assertWitness(value.witness,'$.witness',value.scopeDirection);
  }else{
    if(value.scopeDirection!==null||value.witness!==null||typeof value.abstainCode!=='string'||!own.call(ABSTAIN_CODES,value.abstainCode)) fail('ABSTAIN_ASSESSMENT_INCOMPLETE','$.status');
  }
  object(value.evaluatorRef,'$.evaluatorRef');
  exactKeys(value.evaluatorRef,['id','version','rulesetHash'],'$.evaluatorRef');
  if(value.evaluatorRef.id!==RULESET.id||value.evaluatorRef.version!==VERSION||value.evaluatorRef.rulesetHash!==RULESET_HASH) fail('EVALUATOR_REF_INVALID','$.evaluatorRef');
  if(value.verificationStatus!=='REPLAY_REQUIRED'||value.validationRequirement!=='FULL_PARSE_REPLAY'||
     value.authority!=='STRUCTURAL_SCOPE_ONLY'||value.logicalImplication!=='NOT_COMPUTED'||
     value.reviewStatus!=='REQUIRES_REVIEW'||value.semanticTruth!==false||value.soundness!=='NOT_COMPUTED'||value.commitAllowed!==false){
    fail('AUTHORITY_BOUNDARY_VIOLATION','$');
  }
  if(typeof value.assessmentId!=='string'||value.assessmentId.indexOf('qualifier-direction:')!==0) fail('ASSESSMENT_ID_INVALID','$.assessmentId');
  hash(value.contentHash,'$.contentHash');
  identity=Canonical.deepCopy(value);
  delete identity.assessmentId;
  delete identity.contentHash;
  expectedId='qualifier-direction:'+Canonical.hashCanonical(identity).slice(7);
  if(value.assessmentId!==expectedId) fail('ASSESSMENT_ID_MISMATCH','$.assessmentId');
  payload=Canonical.deepCopy(value);
  expectedHash=payload.contentHash;
  delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}

function assertAssessmentAgainst(value,definition){
  var expected;
  assertAssessment(value);
  expected=assessQualifierDirection(definition);
  if(expected.contentHash!==value.contentHash) fail('QUALIFIER_DIRECTION_BUNDLE_MISMATCH','$');
  return true;
}

function validationReport(assertion,value,definition,success,scope,parserReplay){
  try{
    assertion(value,definition);
    return freeze({status:success,code:null,path:null,validationScope:scope,parserReplay:parserReplay,referentialReplay:'NOT_CLAIMED'});
  }catch(error){
    return freeze({status:'INVALID',code:error&&error.code||'INVALID_VALUE',path:error&&error.path||'$',validationScope:scope,parserReplay:'NOT_CONFIRMED',referentialReplay:'NOT_CLAIMED'});
  }
}

global.MRDP78QualifierDirectionContracts=freeze({
  version:VERSION,
  status:'READY',
  schema:CONTRACT_SCHEMA,
  outputSchema:OUTPUT_SCHEMA,
  supportedRelation:'QUALIFIES',
  orientation:'PASSAGE_TO_TARGET',
  directionDomain:'SYNTACTIC_SPECIFICITY',
  directions:freeze(['BROADER','NARROWER']),
  assessmentStatuses:freeze(['ABSTAIN','DIRECTED']),
  abstainCodes:ABSTAIN_CODES,
  basis:'SINGLE_CONTROLLED_METHOD_CLAUSE_DELTA',
  rulesetHash:RULESET_HASH,
  limits:freeze({
    maxGraphNodes:MAX_GRAPH_NODES,maxGraphValues:MAX_GRAPH_VALUES,maxGraphCodeUnits:MAX_GRAPH_CODE_UNITS,
    maxGraphDepth:MAX_GRAPH_DEPTH,maxClaimCodeUnits:MAX_CLAIM_CODE_UNITS
  }),
  authority:'STRUCTURAL_SCOPE_ONLY',
  logicalImplication:'NOT_COMPUTED',
  reviewStatus:'REQUIRES_REVIEW',
  semanticTruth:false,
  soundness:'NOT_COMPUTED',
  commitAllowed:false,
  assessQualifierDirection:assessQualifierDirection,
  inspectQualifierDirectionShape:function(value){
    return validationReport(assertAssessment,value,null,'STRUCTURALLY_VALID','STRUCTURE_ONLY','NOT_PERFORMED');
  },
  validateQualifierDirectionAgainst:function(value,definition){
    return validationReport(assertAssessmentAgainst,value,definition,'VALID','PARSE_BUNDLE_REPLAY','PERFORMED');
  }
});
})(typeof globalThis!=='undefined'?globalThis:this);
