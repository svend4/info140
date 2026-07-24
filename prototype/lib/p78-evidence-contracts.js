(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var SearchContracts=global.MRDP78SearchContracts;
var ClaimIR=global.MRDP78ClaimIR;

if(!Canonical||!SearchContracts||SearchContracts.status!=='READY'||!ClaimIR||ClaimIR.status!=='READY'){
  global.MRDP78EvidenceContracts=Object.freeze({version:VERSION,status:'BLOCKED',code:'EVIDENCE_CONTRACT_DEPENDENCY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var SCHEMAS=freeze({
  sourcePassage:'meridian.source-passage/1',
  evidenceCandidate:'meridian.evidence-candidate/1'
});
var RELATIONS=freeze({SUPPORTS:true,REFUTES:true,QUALIFIES:true,MENTIONS:true});
var ALIGNMENT_VALUES=freeze({TRUE:true,FALSE:true,UNKNOWN:true});
var CANDIDATE_STATUSES=freeze({CANDIDATE:true,STRUCTURALLY_ALIGNED:true,REQUIRES_REVIEW:true});
var REASON_CODES=freeze({
  BROAD_LEXICAL_MATCH:'BROAD_LEXICAL_MATCH',
  PREDICATE_ALIGNED:'PREDICATE_ALIGNED',
  PREDICATE_MISMATCH:'PREDICATE_MISMATCH',
  PREDICATE_UNKNOWN:'PREDICATE_UNKNOWN',
  ARGUMENTS_ALIGNED:'ARGUMENTS_ALIGNED',
  ARGUMENTS_MISMATCH:'ARGUMENTS_MISMATCH',
  ARGUMENTS_UNKNOWN:'ARGUMENTS_UNKNOWN',
  POLARITY_ALIGNED:'POLARITY_ALIGNED',
  POLARITY_OPPOSITE:'POLARITY_OPPOSITE',
  MODALITY_ALIGNED:'MODALITY_ALIGNED',
  QUANTIFIER_ALIGNED:'QUANTIFIER_ALIGNED',
  QUANTIFIER_MISMATCH:'QUANTIFIER_MISMATCH',
  MODALITY_MISMATCH:'MODALITY_MISMATCH',
  QUALIFIERS_ALIGNED:'QUALIFIERS_ALIGNED',
  QUALIFIERS_MISMATCH:'QUALIFIERS_MISMATCH',
  CLAIM_UNRESOLVED:'CLAIM_UNRESOLVED',
  SOURCE_PASSAGE_PINNED:'SOURCE_PASSAGE_PINNED',
  HUMAN_REVIEW_REQUIRED:'HUMAN_REVIEW_REQUIRED'
});
var ID=/^[A-Za-z0-9][A-Za-z0-9._:@\/-]{0,255}$/;
var SEMVER=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function contractError(code,message,path){
  var error=new TypeError(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78EvidenceContractError';
  error.code=code;
  error.path=path||'$';
  return error;
}
function reject(code,message,path){ throw contractError(code,message,path); }
function isObject(value){ return Canonical.isPlainObject(value); }
function assertObject(value,path){ if(!isObject(value)) reject('INVALID_VALUE','plain object required',path); }
function assertExactKeys(value,required,optional,path){
  var allowed={},keys=Object.keys(value),i,key;
  for(i=0;i<required.length;i++) allowed[required[i]]=true;
  for(i=0;i<optional.length;i++) allowed[optional[i]]=true;
  for(i=0;i<required.length;i++) if(!own.call(value,required[i])) reject('REQUIRED_FIELD_MISSING',required[i],path+'.'+required[i]);
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(!allowed[key]) reject('UNKNOWN_FIELD',key,path+'.'+key);
  }
}
function assertString(value,path,options){
  options=options||{};
  if(typeof value!=='string') reject('INVALID_VALUE','string required',path);
  if(options.nonEmpty&&value.length===0) reject('INVALID_VALUE','non-empty string required',path);
  if(options.trimmed&&value.trim()!==value) reject('INVALID_VALUE','surrounding whitespace forbidden',path);
  if(options.max!==undefined&&value.length>options.max) reject('INVALID_VALUE','string too long',path);
  if(options.pattern&&!options.pattern.test(value)) reject('INVALID_VALUE','string format rejected',path);
}
function assertId(value,path){ assertString(value,path,{nonEmpty:true,trimmed:true,max:256,pattern:ID}); }
function assertHash(value,path){ if(!Canonical.isSha256(value)) reject('INVALID_HASH','SHA-256 required',path); }
function assertInteger(value,min,max,path){
  if(!Number.isInteger(value)||value<min||(max!==undefined&&value>max)) reject('INVALID_VALUE','integer out of range',path);
}
function assertEnum(value,values,path){ if(typeof value!=='string'||!own.call(values,value)) reject('INVALID_VALUE','enumeration value rejected',path); }
function assertUniqueStrings(value,path,options){
  var seen={},i;
  options=options||{};
  if(!Array.isArray(value)||value.length<(options.min||0)||value.length>(options.max||4096)) reject('INVALID_VALUE','array size rejected',path);
  for(i=0;i<value.length;i++){
    assertString(value[i],path+'['+i+']',{nonEmpty:true,trimmed:true,max:options.itemMax||256,pattern:options.pattern});
    if(seen[value[i]]) reject('DUPLICATE_VALUE','duplicate array item',path+'['+i+']');
    seen[value[i]]=true;
  }
}
function omit(value,keys){
  var result={},names=Object.keys(value),i;
  for(i=0;i<names.length;i++) if(keys.indexOf(names[i])===-1) result[names[i]]=value[names[i]];
  return result;
}
function sourceRef(source){ return {sourceId:source.sourceId,revision:source.revision,sourceHash:source.sourceHash}; }
function assertSourceRef(value,path){
  assertObject(value,path);
  assertExactKeys(value,['sourceId','revision','sourceHash'],[],path);
  assertId(value.sourceId,path+'.sourceId');
  assertString(value.revision,path+'.revision',{nonEmpty:true,trimmed:true,max:128});
  assertHash(value.sourceHash,path+'.sourceHash');
}
function assertLocator(value,path){
  assertObject(value,path);
  assertExactKeys(value,['start','end','sentenceIndex'],[],path);
  assertInteger(value.start,0,Number.MAX_SAFE_INTEGER,path+'.start');
  assertInteger(value.end,1,Number.MAX_SAFE_INTEGER,path+'.end');
  assertInteger(value.sentenceIndex,0,Number.MAX_SAFE_INTEGER,path+'.sentenceIndex');
  if(value.end<=value.start) reject('INVALID_LOCATOR','end must exceed start',path+'.end');
}
function passageBase(value){
  return {schema:SCHEMAS.sourcePassage,sourceRef:value.sourceRef,locator:value.locator,text:value.text,textHash:value.textHash};
}
function assertSourcePassage(value){
  var base,identityHash,expectedHash;
  assertObject(value,'$');
  assertExactKeys(value,['schema','passageId','sourceSpanId','sourceRef','locator','text','textHash','contentHash'],[],'$');
  if(value.schema!==SCHEMAS.sourcePassage) reject('INVALID_SCHEMA','source passage schema','$.schema');
  assertId(value.passageId,'$.passageId');
  assertId(value.sourceSpanId,'$.sourceSpanId');
  assertSourceRef(value.sourceRef,'$.sourceRef');
  assertLocator(value.locator,'$.locator');
  assertString(value.text,'$.text',{nonEmpty:true,max:100000});
  assertHash(value.textHash,'$.textHash');
  assertHash(value.contentHash,'$.contentHash');
  if(Canonical.hashText(value.text)!==value.textHash) reject('PASSAGE_TEXT_HASH_MISMATCH','passage text changed','$.textHash');
  base=passageBase(value);
  identityHash=Canonical.hashCanonical(base);
  if(value.passageId!=='passage:'+identityHash.slice(7)) reject('PASSAGE_ID_MISMATCH','passage identity changed','$.passageId');
  if(value.sourceSpanId!=='source-span:'+identityHash.slice(7)) reject('SOURCE_SPAN_ID_MISMATCH','source span identity changed','$.sourceSpanId');
  expectedHash=Canonical.hashCanonical(omit(value,['contentHash']));
  if(value.contentHash!==expectedHash) reject('CONTENT_HASH_MISMATCH','passage content changed','$.contentHash');
  return true;
}
function createSourcePassage(source,locator){
  var report,text,base,identityHash,value;
  report=SearchContracts.validateSourceSnapshot(source);
  if(report.status!=='VALID') reject(report.code||'INVALID_SOURCE','invalid source snapshot','$.source');
  assertLocator(locator,'$.locator');
  if(locator.end>source.text.length) reject('INVALID_LOCATOR','locator exceeds source text','$.locator.end');
  text=source.text.slice(locator.start,locator.end);
  if(!text.length) reject('INVALID_LOCATOR','empty source passage','$.locator');
  base={schema:SCHEMAS.sourcePassage,sourceRef:sourceRef(source),locator:Canonical.deepCopy(locator),text:text,textHash:Canonical.hashText(text)};
  identityHash=Canonical.hashCanonical(base);
  value={
    schema:base.schema,passageId:'passage:'+identityHash.slice(7),sourceSpanId:'source-span:'+identityHash.slice(7),
    sourceRef:base.sourceRef,locator:base.locator,text:base.text,textHash:base.textHash
  };
  value.contentHash=Canonical.hashCanonical(value);
  assertSourcePassage(value);
  return Canonical.copyAndFreeze(value);
}
function assertParserRef(value,path){
  assertObject(value,path);
  assertExactKeys(value,['id','version'],[],path);
  assertId(value.id,path+'.id');
  assertString(value.version,path+'.version',{nonEmpty:true,trimmed:true,max:64,pattern:SEMVER});
}
function claimRef(claim){
  var report=ClaimIR.validateClaimAst(claim);
  if(report.status!=='VALID') reject(report.code||'INVALID_CLAIM','invalid Claim AST','$');
  return freeze({claimAstId:claim.claimAstId,contentHash:claim.contentHash,parserRef:claim.parserRef,resolutionStatus:claim.resolutionStatus});
}
function assertClaimRef(value,path){
  assertObject(value,path);
  assertExactKeys(value,['claimAstId','contentHash','parserRef','resolutionStatus'],[],path);
  assertId(value.claimAstId,path+'.claimAstId');
  assertHash(value.contentHash,path+'.contentHash');
  assertParserRef(value.parserRef,path+'.parserRef');
  assertEnum(value.resolutionStatus,{RESOLVED:true,AMBIGUOUS:true,OOV:true},path+'.resolutionStatus');
}
function assertAlignment(value,path){
  var fields=['predicate','arguments','polarity','modality','quantifier','qualifiers'],i;
  assertObject(value,path);
  assertExactKeys(value,fields,[],path);
  for(i=0;i<fields.length;i++) assertEnum(value[fields[i]],ALIGNMENT_VALUES,path+'.'+fields[i]);
}
function assertProvenance(value,path){
  assertObject(value,path);
  assertExactKeys(value,['sourceSetHash','queryHash','lexicalIndexHash','linguisticIndexHash','lexiconHash','parserRef','alignerVersion'],[],path);
  assertHash(value.sourceSetHash,path+'.sourceSetHash');
  assertHash(value.queryHash,path+'.queryHash');
  assertHash(value.lexicalIndexHash,path+'.lexicalIndexHash');
  assertHash(value.linguisticIndexHash,path+'.linguisticIndexHash');
  assertHash(value.lexiconHash,path+'.lexiconHash');
  assertParserRef(value.parserRef,path+'.parserRef');
  assertString(value.alignerVersion,path+'.alignerVersion',{nonEmpty:true,trimmed:true,max:64,pattern:SEMVER});
}
function candidateBase(value){
  return {
    schema:SCHEMAS.evidenceCandidate,targetClaimRef:value.targetClaimRef,passageClaimRef:value.passageClaimRef,
    hitIds:value.hitIds,sourceSpanIds:value.sourceSpanIds,sourceRef:value.sourceRef,locator:value.locator,
    passageTextHash:value.passageTextHash,proposedRelation:value.proposedRelation,alignment:value.alignment,
    status:value.status,reasonCodes:value.reasonCodes,provenance:value.provenance,evidenceStatus:'EVIDENCE_CANDIDATE',
    reviewStatus:'REQUIRES_REVIEW',finalRelation:'NOT_COMPUTED',semanticTruth:false,soundness:'NOT_COMPUTED'
  };
}
function assertRelationCoherence(value){
  var a=value.alignment;
  if(value.proposedRelation==='SUPPORTS'&&!(a.predicate==='TRUE'&&a.arguments==='TRUE'&&a.polarity==='TRUE'&&a.modality==='TRUE'&&a.quantifier==='TRUE'&&a.qualifiers==='TRUE')) reject('RELATION_ALIGNMENT_MISMATCH','SUPPORTS requires complete positive alignment','$.proposedRelation');
  if(value.proposedRelation==='REFUTES'&&!(a.predicate==='TRUE'&&a.arguments==='TRUE'&&a.polarity==='FALSE'&&a.modality==='TRUE'&&a.quantifier==='TRUE'&&a.qualifiers==='TRUE')) reject('RELATION_ALIGNMENT_MISMATCH','REFUTES requires aligned structure and opposite polarity','$.proposedRelation');
  if(value.proposedRelation==='QUALIFIES'&&!(a.predicate==='TRUE'&&a.arguments==='TRUE'&&a.polarity==='TRUE'&&(a.modality!=='TRUE'||a.quantifier!=='TRUE'||a.qualifiers!=='TRUE'))) reject('RELATION_ALIGNMENT_MISMATCH','QUALIFIES requires aligned claim scope with a qualification difference','$.proposedRelation');
  if(value.status==='STRUCTURALLY_ALIGNED'&&!(a.predicate==='TRUE'&&a.arguments==='TRUE')) reject('STATUS_ALIGNMENT_MISMATCH','structural alignment requires predicate and arguments','$.status');
  if(value.targetClaimRef.resolutionStatus!=='RESOLVED'||value.passageClaimRef.resolutionStatus!=='RESOLVED') reject('UNRESOLVED_EVIDENCE_FORBIDDEN','only resolved Claim AST records can become evidence candidates','$.status');
}
function assertEvidenceCandidate(value){
  var expectedId,expectedHash,i;
  assertObject(value,'$');
  assertExactKeys(value,[
    'schema','candidateId','targetClaimRef','passageClaimRef','hitIds','sourceSpanIds','sourceRef','locator','passageTextHash',
    'proposedRelation','alignment','status','reasonCodes','provenance','evidenceStatus','reviewStatus','finalRelation','semanticTruth','soundness','contentHash'
  ],[],'$');
  if(value.schema!==SCHEMAS.evidenceCandidate) reject('INVALID_SCHEMA','evidence candidate schema','$.schema');
  assertId(value.candidateId,'$.candidateId');
  assertClaimRef(value.targetClaimRef,'$.targetClaimRef');
  assertClaimRef(value.passageClaimRef,'$.passageClaimRef');
  assertUniqueStrings(value.hitIds,'$.hitIds',{min:1,max:4096,pattern:ID});
  assertUniqueStrings(value.sourceSpanIds,'$.sourceSpanIds',{min:1,max:256,pattern:ID});
  assertSourceRef(value.sourceRef,'$.sourceRef');
  assertLocator(value.locator,'$.locator');
  assertHash(value.passageTextHash,'$.passageTextHash');
  assertEnum(value.proposedRelation,RELATIONS,'$.proposedRelation');
  assertAlignment(value.alignment,'$.alignment');
  assertEnum(value.status,CANDIDATE_STATUSES,'$.status');
  assertUniqueStrings(value.reasonCodes,'$.reasonCodes',{min:1,max:64,itemMax:128});
  for(i=0;i<value.reasonCodes.length;i++) if(!own.call(REASON_CODES,value.reasonCodes[i])) reject('INVALID_REASON_CODE','unknown reason code','$.reasonCodes['+i+']');
  assertProvenance(value.provenance,'$.provenance');
  if(value.evidenceStatus!=='EVIDENCE_CANDIDATE') reject('FINAL_EVIDENCE_STATUS_FORBIDDEN','candidate cannot declare final evidence','$.evidenceStatus');
  if(value.reviewStatus!=='REQUIRES_REVIEW') reject('REVIEW_BYPASS_FORBIDDEN','candidate requires review','$.reviewStatus');
  if(value.finalRelation!=='NOT_COMPUTED') reject('FINAL_RELATION_FORBIDDEN','candidate cannot declare a final relation','$.finalRelation');
  if(value.semanticTruth!==false) reject('SEMANTIC_TRUTH_FORBIDDEN','candidate cannot assert truth','$.semanticTruth');
  if(value.soundness!=='NOT_COMPUTED') reject('SOUNDNESS_FORBIDDEN','candidate cannot assert soundness','$.soundness');
  assertHash(value.contentHash,'$.contentHash');
  assertRelationCoherence(value);
  expectedId='evidence-candidate:'+Canonical.hashCanonical(candidateBase(value)).slice(7);
  if(value.candidateId!==expectedId) reject('CANDIDATE_ID_MISMATCH','candidate identity changed','$.candidateId');
  expectedHash=Canonical.hashCanonical(omit(value,['contentHash']));
  if(value.contentHash!==expectedHash) reject('CONTENT_HASH_MISMATCH','candidate content changed','$.contentHash');
  return true;
}
function createEvidenceCandidate(definition){
  var source,value,base;
  source=Canonical.deepCopy(definition);
  assertObject(source,'$');
  assertExactKeys(source,[
    'targetClaimRef','passageClaimRef','hitIds','sourceSpanIds','sourceRef','locator','passageTextHash',
    'proposedRelation','alignment','status','reasonCodes','provenance'
  ],[],'$');
  base=candidateBase(source);
  value=Canonical.deepCopy(base);
  value.candidateId='evidence-candidate:'+Canonical.hashCanonical(base).slice(7);
  value.contentHash=Canonical.hashCanonical(value);
  assertEvidenceCandidate(value);
  return Canonical.copyAndFreeze(value);
}
function validationReport(assertion,value){
  try{ assertion(Canonical.deepCopy(value)); return freeze({status:'VALID',code:null,errors:[]}); }
  catch(error){
    return freeze({status:'INVALID',code:error&&error.code||'INVALID_VALUE',errors:[{code:error&&error.code||'INVALID_VALUE',path:error&&error.path||'$',message:error&&error.message||String(error)}]});
  }
}

global.MRDP78EvidenceContracts=freeze({
  version:VERSION,status:'READY',schema:'meridian.evidence-contracts/1',schemas:SCHEMAS,relations:RELATIONS,
  alignmentValues:ALIGNMENT_VALUES,candidateStatuses:CANDIDATE_STATUSES,reasonCodes:REASON_CODES,
  maxOutputStatus:'EVIDENCE_CANDIDATE',reviewStatus:'REQUIRES_REVIEW',semanticTruth:false,soundness:'NOT_COMPUTED',
  createSourcePassage:createSourcePassage,validateSourcePassage:function(value){ return validationReport(assertSourcePassage,value); },
  claimRef:claimRef,createEvidenceCandidate:createEvidenceCandidate,
  validateEvidenceCandidate:function(value){ return validationReport(assertEvidenceCandidate,value); }
});
})(typeof globalThis!=='undefined'?globalThis:this);
