(function(global){
'use strict';

var VERSION='1.0.0';
var CLAIM_SCHEMA='meridian.claim-ast/1';
var Canonical=global.MRDP78CanonicalJSON||global.MRDP78CanonicalJson;

if(!Canonical){
  global.MRDP78ClaimIR=Object.freeze({
    version:VERSION,
    schema:CLAIM_SCHEMA,
    status:'BLOCKED',
    code:'CANONICAL_JSON_UNAVAILABLE',
    semanticTruth:false
  });
  return;
}

var freeze=Canonical.deepFreeze;
var hasOwn=Object.prototype.hasOwnProperty;
var SEMVER=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
var ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:@\/-]{0,255}$/;
var CLAIM_ID_PATTERN=/^claim-ast:[0-9a-f]{64}$/;
var QUANTIFIERS=freeze({ONE:true,SOME:true,ALL:true,MOST:true,NONE:true,UNSPECIFIED:true});
var POLARITIES=freeze({POSITIVE:true,NEGATIVE:true});
var MODALITIES=freeze({FACT:true,REPORTED:true,DERIVED:true,HYPOTHESIS:true,INTERPRETATION:true});
var RESOLUTION_STATUSES=freeze({RESOLVED:true,AMBIGUOUS:true,OOV:true});
var QUALIFIER_FIELDS=freeze(['time','place','population','method','condition','measure']);
var REASON_CODES=freeze({
  CANONICAL_JSON_UNAVAILABLE:'CANONICAL_JSON_UNAVAILABLE',
  INVALID_SCHEMA:'INVALID_SCHEMA',
  UNKNOWN_FIELD:'UNKNOWN_FIELD',
  REQUIRED_FIELD_MISSING:'REQUIRED_FIELD_MISSING',
  INVALID_VALUE:'INVALID_VALUE',
  INVALID_ENUM:'INVALID_ENUM',
  INVALID_ID:'INVALID_ID',
  INVALID_SEMVER:'INVALID_SEMVER',
  INVALID_HASH:'INVALID_HASH',
  CLAIM_ID_MISMATCH:'CLAIM_ID_MISMATCH',
  CONTENT_HASH_MISMATCH:'CONTENT_HASH_MISMATCH',
  DUPLICATE_SOURCE_SPAN:'DUPLICATE_SOURCE_SPAN',
  DUPLICATE_ARGUMENT_ROLE:'DUPLICATE_ARGUMENT_ROLE',
  DUPLICATE_ARGUMENT_SPAN:'DUPLICATE_ARGUMENT_SPAN',
  DUPLICATE_ONTOLOGY_TYPE:'DUPLICATE_ONTOLOGY_TYPE',
  EVIDENCE_FIELD_FORBIDDEN:'EVIDENCE_FIELD_FORBIDDEN',
  SEMANTIC_TRUTH_FIELD_FORBIDDEN:'SEMANTIC_TRUTH_FIELD_FORBIDDEN',
  CYCLE_DETECTED:'CYCLE_DETECTED',
  NON_JSON_VALUE:'NON_JSON_VALUE',
  INVALID_UNICODE:'INVALID_UNICODE',
  NON_FINITE_NUMBER:'NON_FINITE_NUMBER',
  SPARSE_ARRAY:'SPARSE_ARRAY'
});
var EVIDENCE_FIELDS=freeze({evidence:true,evidenceIds:true,evidenceStatus:true,support:true,supported:true});
var TRUTH_FIELDS=freeze({semanticTruth:true,truth:true,truthStatus:true,factualStatus:true,entailment:true});

function contractError(code,message,path){
  var error=new TypeError(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78ClaimIRContractError';
  error.code=code;
  error.path=path||'$';
  return error;
}

function reject(code,message,path){ throw contractError(code,message,path); }
function isObject(value){ return Canonical.isPlainObject(value); }

function mappedCanonicalError(error){
  var code=error&&error.code;
  if(code==='CYCLIC_VALUE') code=REASON_CODES.CYCLE_DETECTED;
  else if(code==='NON_JSON_KEY') code=REASON_CODES.NON_JSON_VALUE;
  else if(!hasOwn.call(REASON_CODES,code)) code=REASON_CODES.INVALID_VALUE;
  return contractError(code,error&&error.message?error.message:String(error),error&&error.path?error.path:'$');
}

function copyData(value){
  try{ return Canonical.deepCopy(value); }
  catch(error){ throw mappedCanonicalError(error); }
}

function assertObject(value,path){
  if(!isObject(value)) reject(REASON_CODES.INVALID_VALUE,'plain object required',path);
}

function assertExactKeys(value,required,optional,path){
  var allowed=Object.create(null),keys=Object.keys(value),i,key;
  for(i=0;i<required.length;i++) allowed[required[i]]=true;
  for(i=0;i<optional.length;i++) allowed[optional[i]]=true;
  for(i=0;i<required.length;i++){
    if(!hasOwn.call(value,required[i])) reject(REASON_CODES.REQUIRED_FIELD_MISSING,required[i],path+'.'+required[i]);
  }
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(!hasOwn.call(allowed,key)) reject(REASON_CODES.UNKNOWN_FIELD,key,path+'.'+key);
  }
}

function assertNoEpistemicFields(value,path){
  var keys=Object.keys(value),i,key;
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(hasOwn.call(EVIDENCE_FIELDS,key)) reject(REASON_CODES.EVIDENCE_FIELD_FORBIDDEN,'Claim AST is not evidence',path+'.'+key);
    if(hasOwn.call(TRUTH_FIELDS,key)) reject(REASON_CODES.SEMANTIC_TRUTH_FIELD_FORBIDDEN,'Claim AST does not assert truth',path+'.'+key);
  }
}

function assertString(value,path,options){
  options=options||{};
  if(typeof value!=='string') reject(REASON_CODES.INVALID_VALUE,'string required',path);
  if(options.nonEmpty&&value.length===0) reject(REASON_CODES.INVALID_VALUE,'non-empty string required',path);
  if(options.trimmed&&value.trim()!==value) reject(REASON_CODES.INVALID_VALUE,'surrounding whitespace forbidden',path);
  if(options.max!==undefined&&value.length>options.max) reject(REASON_CODES.INVALID_VALUE,'string too long',path);
  if(options.pattern&&!options.pattern.test(value)) reject(options.patternCode||REASON_CODES.INVALID_VALUE,'string format rejected',path);
}

function assertId(value,path){
  assertString(value,path,{nonEmpty:true,trimmed:true,max:256,pattern:ID_PATTERN,patternCode:REASON_CODES.INVALID_ID});
}

function assertNullableId(value,path){
  if(value!==null) assertId(value,path);
}

function assertSemVer(value,path){
  assertString(value,path,{nonEmpty:true,trimmed:true,max:128,pattern:SEMVER,patternCode:REASON_CODES.INVALID_SEMVER});
}

function assertEnum(value,values,path){
  if(typeof value!=='string'||!hasOwn.call(values,value)) reject(REASON_CODES.INVALID_ENUM,'enumeration value rejected',path);
}

function assertHash(value,path){
  if(!Canonical.isSha256(value)) reject(REASON_CODES.INVALID_HASH,'SHA-256 required',path);
}

function assertSourceSpanIds(value,path){
  var seen=Object.create(null),i,item;
  if(!Array.isArray(value)||value.length===0||value.length>256) reject(REASON_CODES.INVALID_VALUE,'one to 256 source spans required',path);
  for(i=0;i<value.length;i++){
    item=value[i];
    assertId(item,path+'['+i+']');
    if(hasOwn.call(seen,item)) reject(REASON_CODES.DUPLICATE_SOURCE_SPAN,'duplicate source span',path+'['+i+']');
    seen[item]=true;
  }
}

function assertPredicate(value,path){
  assertObject(value,path);
  assertExactKeys(value,['lemma','senseId','relationTypeId'],[],path);
  assertString(value.lemma,path+'.lemma',{nonEmpty:true,trimmed:true,max:512});
  assertNullableId(value.senseId,path+'.senseId');
  assertNullableId(value.relationTypeId,path+'.relationTypeId');
}

function assertOntologyTypes(value,path){
  var seen=Object.create(null),i,item;
  if(!Array.isArray(value)||value.length>64) reject(REASON_CODES.INVALID_VALUE,'ontologyTypes array rejected',path);
  for(i=0;i<value.length;i++){
    item=value[i];
    assertId(item,path+'['+i+']');
    if(hasOwn.call(seen,item)) reject(REASON_CODES.DUPLICATE_ONTOLOGY_TYPE,'duplicate ontology type',path+'['+i+']');
    seen[item]=true;
  }
}

function assertArgument(value,path){
  assertObject(value,path);
  assertExactKeys(value,['role','surfaceSpanId','entityId','senseId','ontologyTypes'],[],path);
  assertString(value.role,path+'.role',{nonEmpty:true,trimmed:true,max:128,pattern:ID_PATTERN});
  assertId(value.surfaceSpanId,path+'.surfaceSpanId');
  assertNullableId(value.entityId,path+'.entityId');
  assertNullableId(value.senseId,path+'.senseId');
  assertOntologyTypes(value.ontologyTypes,path+'.ontologyTypes');
}

function assertArguments(value,path){
  var roles=Object.create(null),spans=Object.create(null),i,argument;
  if(!Array.isArray(value)||value.length===0||value.length>64) reject(REASON_CODES.INVALID_VALUE,'one to 64 arguments required',path);
  for(i=0;i<value.length;i++){
    argument=value[i];
    assertArgument(argument,path+'['+i+']');
    if(hasOwn.call(roles,argument.role)) reject(REASON_CODES.DUPLICATE_ARGUMENT_ROLE,'duplicate argument role',path+'['+i+'].role');
    if(hasOwn.call(spans,argument.surfaceSpanId)) reject(REASON_CODES.DUPLICATE_ARGUMENT_SPAN,'duplicate argument surface span',path+'['+i+'].surfaceSpanId');
    roles[argument.role]=true;
    spans[argument.surfaceSpanId]=true;
  }
}

function assertQualifiers(value,path){
  var i,key;
  assertObject(value,path);
  assertExactKeys(value,[],QUALIFIER_FIELDS,path);
  for(i=0;i<QUALIFIER_FIELDS.length;i++){
    key=QUALIFIER_FIELDS[i];
    if(hasOwn.call(value,key)) assertString(value[key],path+'.'+key,{nonEmpty:true,trimmed:true,max:2048});
  }
}

function assertParserRef(value,path){
  assertObject(value,path);
  assertExactKeys(value,['id','version'],[],path);
  assertId(value.id,path+'.id');
  assertSemVer(value.version,path+'.version');
}

function claimBase(value){
  return {
    schema:CLAIM_SCHEMA,
    sourceSpanIds:value.sourceSpanIds,
    predicate:value.predicate,
    arguments:value.arguments,
    quantifier:value.quantifier,
    polarity:value.polarity,
    modality:value.modality,
    qualifiers:value.qualifiers,
    parserRef:value.parserRef,
    resolutionStatus:value.resolutionStatus
  };
}

function claimIdFor(value){ return 'claim-ast:'+Canonical.hashCanonical(claimBase(value)).slice(7); }

function withoutContentHash(value){
  var result={},keys=Object.keys(value),i,key;
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(key!=='contentHash') result[key]=value[key];
  }
  return result;
}

function assertClaimFields(value){
  assertSourceSpanIds(value.sourceSpanIds,'$.sourceSpanIds');
  assertPredicate(value.predicate,'$.predicate');
  assertArguments(value.arguments,'$.arguments');
  assertEnum(value.quantifier,QUANTIFIERS,'$.quantifier');
  assertEnum(value.polarity,POLARITIES,'$.polarity');
  assertEnum(value.modality,MODALITIES,'$.modality');
  assertQualifiers(value.qualifiers,'$.qualifiers');
  assertParserRef(value.parserRef,'$.parserRef');
  assertEnum(value.resolutionStatus,RESOLUTION_STATUSES,'$.resolutionStatus');
}

function assertClaimAst(value){
  var expectedId,expectedHash;
  assertObject(value,'$');
  assertNoEpistemicFields(value,'$');
  assertExactKeys(value,[
    'schema','claimAstId','sourceSpanIds','predicate','arguments','quantifier','polarity',
    'modality','qualifiers','parserRef','resolutionStatus','contentHash'
  ],[],'$');
  if(value.schema!==CLAIM_SCHEMA) reject(REASON_CODES.INVALID_SCHEMA,'Claim AST schema mismatch','$.schema');
  assertString(value.claimAstId,'$.claimAstId',{nonEmpty:true,trimmed:true,max:74,pattern:CLAIM_ID_PATTERN,patternCode:REASON_CODES.INVALID_ID});
  assertClaimFields(value);
  assertHash(value.contentHash,'$.contentHash');
  expectedId=claimIdFor(value);
  if(value.claimAstId!==expectedId) reject(REASON_CODES.CLAIM_ID_MISMATCH,'content-addressed claimAstId mismatch','$.claimAstId');
  expectedHash=Canonical.hashCanonical(withoutContentHash(value));
  if(value.contentHash!==expectedHash) reject(REASON_CODES.CONTENT_HASH_MISMATCH,'Claim AST content hash mismatch','$.contentHash');
  return true;
}

function normalizeQualifiers(value){
  var result={},i,key;
  for(i=0;i<QUALIFIER_FIELDS.length;i++){
    key=QUALIFIER_FIELDS[i];
    if(hasOwn.call(value,key)) result[key]=value[key];
  }
  return result;
}

function createClaimAst(definition){
  var source,value,base;
  source=copyData(definition);
  assertObject(source,'$');
  assertNoEpistemicFields(source,'$');
  assertExactKeys(source,[
    'sourceSpanIds','predicate','arguments','quantifier','polarity','modality',
    'qualifiers','parserRef','resolutionStatus'
  ],[],'$');
  assertClaimFields(source);
  base={
    schema:CLAIM_SCHEMA,
    sourceSpanIds:source.sourceSpanIds,
    predicate:source.predicate,
    arguments:source.arguments,
    quantifier:source.quantifier,
    polarity:source.polarity,
    modality:source.modality,
    qualifiers:normalizeQualifiers(source.qualifiers),
    parserRef:source.parserRef,
    resolutionStatus:source.resolutionStatus
  };
  value={
    schema:CLAIM_SCHEMA,
    claimAstId:claimIdFor(base),
    sourceSpanIds:base.sourceSpanIds,
    predicate:base.predicate,
    arguments:base.arguments,
    quantifier:base.quantifier,
    polarity:base.polarity,
    modality:base.modality,
    qualifiers:base.qualifiers,
    parserRef:base.parserRef,
    resolutionStatus:base.resolutionStatus
  };
  value.contentHash=Canonical.hashCanonical(value);
  assertClaimAst(value);
  return Canonical.copyAndFreeze(value);
}

function validationReport(value){
  var copied;
  try{
    copied=copyData(value);
    assertClaimAst(copied);
    return freeze({status:'VALID',code:null,errors:[]});
  }catch(error){
    return freeze({
      status:'INVALID',
      code:error&&error.code?error.code:REASON_CODES.INVALID_VALUE,
      errors:[{
        code:error&&error.code?error.code:REASON_CODES.INVALID_VALUE,
        path:error&&error.path?error.path:'$',
        message:error&&error.message?error.message:String(error)
      }]
    });
  }
}

global.MRDP78ClaimIR=freeze({
  version:VERSION,
  schema:CLAIM_SCHEMA,
  status:'READY',
  epistemicScope:'STRUCTURE_ONLY',
  evidenceStatus:'NOT_COMPUTED',
  soundness:'NOT_COMPUTED',
  semanticTruth:false,
  reasonCodes:REASON_CODES,
  quantifiers:QUANTIFIERS,
  polarities:POLARITIES,
  modalities:MODALITIES,
  qualifierFields:QUALIFIER_FIELDS,
  resolutionStatuses:RESOLUTION_STATUSES,
  createClaimAst:createClaimAst,
  validateClaimAst:validationReport
});
})(typeof globalThis!=='undefined'?globalThis:this);
