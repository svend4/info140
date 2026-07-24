(function(global){
'use strict';

var VERSION='1.0.1';
var Canonical=global.MRDP78CanonicalJSON;

if(!Canonical){
  global.MRDP78SemanticWorkContracts=Object.freeze({version:VERSION,status:'BLOCKED',code:'SEMANTIC_WORK_CANONICAL_DEPENDENCY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var RUN_SCHEMA='meridian.semantic-run/1';
var WORK_SCHEMA='meridian.semantic-work-item/1';
var STATES=freeze({PLANNED:true,INFLIGHT:true,PARKED:true,SHIPPED:true,DISCARDED:true});
var OPERATORS=freeze({INPUT:true,PARSE:true,DISCOVER:true,ALIGN:true,REVIEW:true});
var LANES=freeze({SOURCE:true,STRUCTURE:true,EVIDENCE:true,REVIEW:true});
var LIMITS=freeze({maxOperations:1000000,maxCandidates:10000,maxMilliseconds:60000,maxItems:32,maxEpoch:2147483647});
var FORBIDDEN_AUTHORITY=freeze({semanticTruth:true,accepted:true,acceptedEvidence:true,finalRelation:true,finalClaimStatus:true,commit:true});

function fail(code,path,detail){
  var error=new TypeError(code+(path?' at '+path:'')+(detail?': '+detail:''));
  error.name='P78SemanticWorkContractError';
  error.code=code;
  error.path=path||'$';
  throw error;
}

function object(value,path){
  var names,keys,symbols,i,descriptor;
  if(!value||typeof value!=='object'||Array.isArray(value)) fail('OBJECT_REQUIRED',path);
  symbols=Object.getOwnPropertySymbols(value);
  if(symbols.length) fail('SYMBOL_FIELD_FORBIDDEN',path);
  names=Object.getOwnPropertyNames(value); keys=Object.keys(value);
  if(names.length!==keys.length) fail('NON_ENUMERABLE_FIELD_FORBIDDEN',path);
  for(i=0;i<keys.length;i++){
    descriptor=Object.getOwnPropertyDescriptor(value,keys[i]);
    if(!descriptor||descriptor.get||descriptor.set) fail('ACCESSOR_FORBIDDEN',path+'.'+keys[i]);
  }
  if(!Canonical.isPlainObject(value)) fail('OBJECT_REQUIRED',path);
  return value;
}

function exactKeys(value,keys,path){
  var allowed={},actual=Object.keys(value),i;
  keys.forEach(function(key){ allowed[key]=true; });
  for(i=0;i<actual.length;i++){
    if(FORBIDDEN_AUTHORITY[actual[i]]) fail('AUTHORITY_FIELD_FORBIDDEN',path+'.'+actual[i]);
    if(!allowed[actual[i]]) fail('UNKNOWN_FIELD',path+'.'+actual[i]);
  }
  for(i=0;i<keys.length;i++) if(!own.call(value,keys[i])) fail('MISSING_FIELD',path+'.'+keys[i]);
}

function text(value,path){
  if(typeof value!=='string'||!value.length) fail('NON_EMPTY_STRING_REQUIRED',path);
  return value;
}

function hash(value,path){
  if(!Canonical.isSha256(value)) fail('HASH_REQUIRED',path);
  return value;
}

function integer(value,min,max,path){
  if(!Number.isInteger(value)||value<min||value>max) fail('BOUNDED_INTEGER_REQUIRED',path);
  return value;
}

function enumValue(value,values,path){
  if(!values[value]) fail('ENUM_VALUE_INVALID',path,String(value));
  return value;
}

function stringArray(value,path,pattern){
  var copy,i,names,symbols,descriptor;
  if(!Array.isArray(value)) fail('ARRAY_REQUIRED',path);
  symbols=Object.getOwnPropertySymbols(value);
  if(symbols.length) fail('ARRAY_SYMBOL_FIELD_FORBIDDEN',path);
  names=Object.getOwnPropertyNames(value);
  if(names.length!==value.length+1) fail('ARRAY_PROPERTY_FORBIDDEN',path);
  for(i=0;i<value.length;i++){
    descriptor=Object.getOwnPropertyDescriptor(value,String(i));
    if(!descriptor||descriptor.get||descriptor.set) fail('SPARSE_OR_ACCESSOR_ARRAY_FORBIDDEN',path+'['+i+']');
  }
  copy=value.slice();
  for(i=0;i<copy.length;i++){
    text(copy[i],path+'['+i+']');
    if(pattern&&!pattern.test(copy[i])) fail('STRING_FORMAT_INVALID',path+'['+i+']');
    if(i&&copy[i-1]>=copy[i]) fail('ARRAY_NOT_SORTED_UNIQUE',path);
  }
  return copy;
}

function hashArray(value,path){
  var copy=stringArray(value,path),i;
  for(i=0;i<copy.length;i++) hash(copy[i],path+'['+i+']');
  return copy;
}

function budget(value,path){
  object(value,path);
  exactKeys(value,['maxOperations','maxCandidates','maxMilliseconds'],path);
  return {
    maxOperations:integer(value.maxOperations,1,LIMITS.maxOperations,path+'.maxOperations'),
    maxCandidates:integer(value.maxCandidates,1,LIMITS.maxCandidates,path+'.maxCandidates'),
    maxMilliseconds:integer(value.maxMilliseconds,1,LIMITS.maxMilliseconds,path+'.maxMilliseconds')
  };
}

function validationReport(assertion,value){
  try{ assertion(value); return freeze({status:'VALID',code:null,path:null}); }
  catch(error){ return freeze({status:'INVALID',code:error&&error.code||'INVALID_VALUE',path:error&&error.path||'$'}); }
}

function createRun(raw){
  var value=object(raw,'$'),base,payload;
  exactKeys(value,['inputHash','policyHash','sourceSetHash','budget'],'$');
  base={
    schema:RUN_SCHEMA,
    version:VERSION,
    inputHash:hash(value.inputHash,'$.inputHash'),
    policyHash:hash(value.policyHash,'$.policyHash'),
    sourceSetHash:hash(value.sourceSetHash,'$.sourceSetHash'),
    budget:budget(value.budget,'$.budget')
  };
  payload=Canonical.deepCopy(base);
  payload.runId=Canonical.hashCanonical(base);
  payload.contentHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function assertRun(value){
  var base,payload,expectedRunId,expectedContentHash;
  object(value,'$');
  exactKeys(value,['schema','version','inputHash','policyHash','sourceSetHash','budget','runId','contentHash'],'$');
  if(value.schema!==RUN_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  hash(value.inputHash,'$.inputHash'); hash(value.policyHash,'$.policyHash'); hash(value.sourceSetHash,'$.sourceSetHash');
  budget(value.budget,'$.budget'); hash(value.runId,'$.runId'); hash(value.contentHash,'$.contentHash');
  base={schema:value.schema,version:value.version,inputHash:value.inputHash,policyHash:value.policyHash,sourceSetHash:value.sourceSetHash,budget:value.budget};
  expectedRunId=Canonical.hashCanonical(base);
  if(value.runId!==expectedRunId) fail('RUN_ID_MISMATCH','$.runId');
  payload=Canonical.deepCopy(value); expectedContentHash=payload.contentHash; delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedContentHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}

function createWorkItem(runValue,raw){
  var value=object(raw,'$'),dependsOn,inputRefs,reasons,state,epoch,identity,payload;
  assertRun(runValue);
  exactKeys(value,['operatorId','lane','ordinal','dependsOn','inputRefs','state','epoch','outputHash','reasonCodes'],'$');
  dependsOn=hashArray(value.dependsOn,'$.dependsOn');
  inputRefs=hashArray(value.inputRefs,'$.inputRefs');
  reasons=stringArray(value.reasonCodes,'$.reasonCodes',/^[A-Z][A-Z0-9_]*$/);
  state=enumValue(value.state,STATES,'$.state');
  epoch=integer(value.epoch,1,LIMITS.maxEpoch,'$.epoch');
  if(value.outputHash!==null) hash(value.outputHash,'$.outputHash');
  if(state==='SHIPPED'&&value.outputHash===null) fail('SHIPPED_OUTPUT_REQUIRED','$.outputHash');
  if((state==='PARKED'||state==='DISCARDED')&&!reasons.length) fail('REASON_CODE_REQUIRED','$.reasonCodes');
  identity={
    schema:WORK_SCHEMA,version:VERSION,runId:runValue.runId,inputHash:runValue.inputHash,
    policyHash:runValue.policyHash,sourceSetHash:runValue.sourceSetHash,
    operatorId:enumValue(value.operatorId,OPERATORS,'$.operatorId'),
    lane:enumValue(value.lane,LANES,'$.lane'),
    ordinal:integer(value.ordinal,0,LIMITS.maxItems-1,'$.ordinal'),
    dependsOn:dependsOn,inputRefs:inputRefs
  };
  payload=Canonical.deepCopy(identity);
  payload.workId=Canonical.hashCanonical(identity);
  payload.state=state;
  payload.epoch=epoch;
  payload.fencingToken=Canonical.hashCanonical({runId:runValue.runId,workId:payload.workId,epoch:epoch});
  payload.budget=Canonical.deepCopy(runValue.budget);
  payload.outputHash=value.outputHash;
  payload.reasonCodes=reasons;
  payload.contentHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function assertWorkItem(value){
  var keys=['schema','version','runId','inputHash','policyHash','sourceSetHash','operatorId','lane','ordinal','dependsOn','inputRefs','workId','state','epoch','fencingToken','budget','outputHash','reasonCodes','contentHash'];
  var identity,payload,expectedWorkId,expectedFence,expectedContentHash,state,reasons;
  object(value,'$'); exactKeys(value,keys,'$');
  if(value.schema!==WORK_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  hash(value.runId,'$.runId'); hash(value.inputHash,'$.inputHash'); hash(value.policyHash,'$.policyHash'); hash(value.sourceSetHash,'$.sourceSetHash');
  enumValue(value.operatorId,OPERATORS,'$.operatorId'); enumValue(value.lane,LANES,'$.lane'); integer(value.ordinal,0,LIMITS.maxItems-1,'$.ordinal');
  hashArray(value.dependsOn,'$.dependsOn'); hashArray(value.inputRefs,'$.inputRefs'); hash(value.workId,'$.workId');
  state=enumValue(value.state,STATES,'$.state'); integer(value.epoch,1,LIMITS.maxEpoch,'$.epoch'); hash(value.fencingToken,'$.fencingToken');
  budget(value.budget,'$.budget'); if(value.outputHash!==null) hash(value.outputHash,'$.outputHash');
  reasons=stringArray(value.reasonCodes,'$.reasonCodes',/^[A-Z][A-Z0-9_]*$/); hash(value.contentHash,'$.contentHash');
  if(state==='SHIPPED'&&value.outputHash===null) fail('SHIPPED_OUTPUT_REQUIRED','$.outputHash');
  if((state==='PARKED'||state==='DISCARDED')&&!reasons.length) fail('REASON_CODE_REQUIRED','$.reasonCodes');
  identity={
    schema:value.schema,version:value.version,runId:value.runId,inputHash:value.inputHash,policyHash:value.policyHash,
    sourceSetHash:value.sourceSetHash,operatorId:value.operatorId,lane:value.lane,ordinal:value.ordinal,
    dependsOn:value.dependsOn,inputRefs:value.inputRefs
  };
  expectedWorkId=Canonical.hashCanonical(identity);
  if(value.workId!==expectedWorkId) fail('WORK_ID_MISMATCH','$.workId');
  expectedFence=Canonical.hashCanonical({runId:value.runId,workId:value.workId,epoch:value.epoch});
  if(value.fencingToken!==expectedFence) fail('FENCING_TOKEN_MISMATCH','$.fencingToken');
  payload=Canonical.deepCopy(value); expectedContentHash=payload.contentHash; delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedContentHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}

function isCurrent(value,runId,epoch,fencingToken){
  if(validationReport(assertWorkItem,value).status!=='VALID') return false;
  return value.runId===runId&&value.epoch===epoch&&value.fencingToken===fencingToken;
}

global.MRDP78SemanticWorkContracts=freeze({
  version:VERSION,status:'READY',runSchema:RUN_SCHEMA,workItemSchema:WORK_SCHEMA,
  states:Object.keys(STATES),operators:Object.keys(OPERATORS),lanes:Object.keys(LANES),limits:LIMITS,
  createRun:createRun,validateRun:function(value){ return validationReport(assertRun,value); },
  createWorkItem:createWorkItem,validateWorkItem:function(value){ return validationReport(assertWorkItem,value); },
  isCurrent:isCurrent
});
})(typeof globalThis!=='undefined'?globalThis:this);
