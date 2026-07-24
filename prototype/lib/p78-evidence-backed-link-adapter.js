(function(global){
'use strict';

var VERSION='1.4.0';
var Canonical=global.MRDP78CanonicalJSON||global.MRDP78CanonicalJson;
var Search=global.MRDP78SearchContracts;
var Parser=global.MRDP78LinguisticParserAdapter;
var Evidence=global.MRDP78EvidenceContracts;
var Linguistic=global.MRDP78LinguisticStructureIndex;
var Alpha=global.MRDP78AlphaOrbitContracts;
var Data7=global.MRDP78Data7Adapter;
var QualifierDirection=global.MRDP78QualifierDirectionContracts;
var EXPECTED_QUALIFIER_DIRECTION_VERSION='2.1.0';
var EXPECTED_QUALIFIER_DIRECTION_SCHEMA='meridian.qualifier-direction-contracts/2';
var EXPECTED_QUALIFIER_DIRECTION_OUTPUT='meridian.qualifier-direction-assessment/2';
var EXPECTED_QUALIFIER_DIRECTION_BASIS='SINGLE_CONTROLLED_METHOD_CLAUSE_DELTA';
var EXPECTED_QUALIFIER_DIRECTION_RULESET='sha256:7321414f2ef9fbc5238deee20db4615f210bf05b72bc44d14c5e790b6f13ba34';

function blockedDependency(code){
  global.MRDP78EvidenceBackedLinkAdapter=Object.freeze({
    version:VERSION,status:'BLOCKED',code:code,semanticTruth:false,commitAllowed:false
  });
}

if(!Canonical||!Search||!Parser||!Evidence||!Linguistic||!Alpha||!Data7||!QualifierDirection||
   Search.status!=='READY'||Parser.status!=='READY'||Evidence.status!=='READY'||
   Linguistic.status!=='READY'||Alpha.status!=='READY'||Data7.status!=='READY'||QualifierDirection.status!=='READY'){
  blockedDependency('EVIDENCE_BACKED_LINK_DEPENDENCY_UNAVAILABLE');
  return;
}
if(QualifierDirection.version!==EXPECTED_QUALIFIER_DIRECTION_VERSION||
   QualifierDirection.schema!==EXPECTED_QUALIFIER_DIRECTION_SCHEMA||
   QualifierDirection.outputSchema!==EXPECTED_QUALIFIER_DIRECTION_OUTPUT||
   QualifierDirection.basis!==EXPECTED_QUALIFIER_DIRECTION_BASIS){
  blockedDependency('QUALIFIER_DIRECTION_DEPENDENCY_INCOMPATIBLE');
  return;
}
if(QualifierDirection.rulesetHash!==EXPECTED_QUALIFIER_DIRECTION_RULESET){
  blockedDependency('QUALIFIER_DIRECTION_POLICY_STALE');
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var OUTPUT_SCHEMA='meridian.data7-evidence-backed-link-proposal/2';
var VALIDATOR_VERSION='p78-evidence-backed-link-adapter@1.4.0';
var VALIDATION_REPORT_SCHEMA='meridian.evidence-backed-link-validation-report/1';
var CONTEXT_SCHEMA='meridian.context-span/1';
var RELATIONS=freeze({SUPPORTS:true,REFUTES:true,QUALIFIES:true});
var MAX_GRAPH_NODES=250000;
var MAX_GRAPH_VALUES=1000000;
var MAX_GRAPH_CODE_UNITS=64000000;
var MAX_GRAPH_DEPTH=64;
var MAX_REPLAY_HITS=100000;
var MAX_REPLAY_PASSAGES=10000;
var MAX_REPLAY_OPERATIONS=10000000;
var MAX_SOURCE_COUNT=64;
var MAX_SOURCE_CODE_UNITS=8000000;
var ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:@\/-]{0,255}$/;

function fail(code,path,detail){
  var error=new TypeError(code+(path?' at '+path:'')+(detail?': '+detail:''));
  error.name='P78EvidenceBackedLinkError';
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
    for(i=0;i<keys.length;i++){
      scanData(value[keys[i]],path+'.'+keys[i],state,ancestors);
    }
  }
  ancestors.pop();
}

function safeData(value){
  scanData(value,'$',{nodes:0,values:0,codeUnits:0},[]);
  return value;
}

function object(value,path){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Canonical.isPlainObject(value)) fail('PLAIN_OBJECT_REQUIRED',path);
  return value;
}

function exactKeys(value,required,optional,path){
  var allowed={},keys=Object.keys(value),i;
  optional=optional||[];
  for(i=0;i<required.length;i++) allowed[required[i]]=true;
  for(i=0;i<optional.length;i++) allowed[optional[i]]=true;
  for(i=0;i<required.length;i++) if(!own.call(value,required[i])) fail('MISSING_FIELD',path+'.'+required[i]);
  for(i=0;i<keys.length;i++) if(!allowed[keys[i]]) fail('UNKNOWN_FIELD',path+'.'+keys[i]);
}

function array(value,path,min,max){
  if(!Array.isArray(value)) fail('ARRAY_REQUIRED',path);
  if(min!==undefined&&value.length<min) fail('ARRAY_TOO_SHORT',path);
  if(max!==undefined&&value.length>max) fail('ARRAY_TOO_LONG',path);
  return value;
}

function text(value,path,max,pattern){
  if(typeof value!=='string'||!value.length||value.trim()!==value) fail('NON_EMPTY_TRIMMED_STRING_REQUIRED',path);
  if(max!==undefined&&value.length>max) fail('STRING_TOO_LONG',path);
  if(pattern&&!pattern.test(value)) fail('STRING_FORMAT_INVALID',path);
  return value;
}

function integer(value,path,min,max){
  if(!Number.isSafeInteger(value)) fail('SAFE_INTEGER_REQUIRED',path);
  if(value<min||value>max) fail('INTEGER_OUT_OF_RANGE',path);
  return value;
}

function hash(value,path){
  if(!Canonical.isSha256(value)) fail('HASH_REQUIRED',path);
  return value;
}

function same(left,right){ return Canonical.canonicalize(left)===Canonical.canonicalize(right); }

function sameArray(left,right){
  var i;
  if(left.length!==right.length) return false;
  for(i=0;i<left.length;i++) if(left[i]!==right[i]) return false;
  return true;
}

function compareText(left,right){ return left<right?-1:left>right?1:0; }

function validationSubject(value){
  return {
    schema:value.schema,
    proposalId:value.proposalId,
    contentHash:value.contentHash
  };
}

function validationBundle(value,against){
  return {
    sourceSetHash:value.sourceSetRef.sourceSetHash,
    primarySourceHash:value.sourceSetRef.primarySourceHash,
    sourceCount:value.sourceSetRef.sourceCount,
    sourceRef:Canonical.deepCopy(value.targetSegmentRef.sourceRef),
    queryHash:value.queryRef.contentHash,
    indexHash:value.indexRef.contentHash,
    linguisticIndexHash:value.linguisticIndexRef.linguisticIndexHash,
    lexicalIndexHash:value.linguisticIndexRef.lexicalIndexHash,
    lexiconHash:value.linguisticIndexRef.lexiconHash,
    patternSetHash:value.linguisticIndexRef.patternSetHash,
    parserRef:Canonical.deepCopy(value.linguisticIndexRef.parserRef),
    alignerVersion:value.linguisticIndexRef.alignerVersion,
    evidenceCandidateHash:value.evidenceCandidateRef.contentHash,
    targetSegmentHash:value.targetSegmentRef.contentHash,
    passageSegmentHash:value.passageSegmentRef.contentHash,
    contextSegmentHash:value.contextSegmentRef.contentHash,
    targetLocator:Canonical.deepCopy(value.targetSegmentRef.locator),
    passageLocator:Canonical.deepCopy(value.passageSegmentRef.locator),
    contextLocator:Canonical.deepCopy(value.contextSegmentRef.locator),
    targetTextHash:against.fromSegment.textHash,
    passageTextHash:against.toSegment.textHash,
    proposedRelation:value.proposedRelation,
    direction:value.direction,
    basis:value.basis,
    qualifierDirectionAssessmentHash:value.qualifierDirectionAssessment?value.qualifierDirectionAssessment.contentHash:null,
    hitCount:value.hitRefs.length,
    contextCount:value.contextSpanRefs.length,
    storedVerificationStatus:value.verificationStatus
  };
}

function validatorRef(){
  return {
    schema:'meridian.data7-evidence-backed-link-adapter/1',
    version:VERSION,
    validatorVersion:VALIDATOR_VERSION,
    qualifierDirectionRulesetHash:QualifierDirection.rulesetHash
  };
}

function successfulValidationReport(snapshot,against,successStatus,scope){
  return freeze({
    schema:VALIDATION_REPORT_SCHEMA,version:'1.1.0',status:successStatus,code:null,path:null,
    subjectRef:validationSubject(snapshot),validatorRef:validatorRef(),
    evidenceBundleRef:scope==='REFERENTIAL_REPLAY'?validationBundle(snapshot,against):null,
    validationScope:scope,referentialReplay:scope==='REFERENTIAL_REPLAY'?'PERFORMED':'NOT_PERFORMED',
    sourceAuthority:scope==='REFERENTIAL_REPLAY'?'UNVERIFIED':'NOT_ASSESSED',
    reviewStatus:'REQUIRES_REVIEW',semanticTruth:false,commitAllowed:false
  });
}

function validationReport(assertion,value,against,successStatus,scope){
  var snapshot;
  try{
    safeData(value);
    snapshot=Canonical.deepCopy(value);
    assertion(snapshot,against);
    return successfulValidationReport(snapshot,against,successStatus,scope);
  }catch(error){
    return freeze({
      schema:VALIDATION_REPORT_SCHEMA,version:'1.1.0',status:'INVALID',
      code:error&&error.code||'INVALID_VALUE',path:error&&error.path||'$',subjectRef:null,
      validatorRef:validatorRef(),evidenceBundleRef:null,validationScope:scope,
      referentialReplay:'NOT_CONFIRMED',sourceAuthority:'NOT_ASSESSED',
      reviewStatus:'REQUIRES_REVIEW',semanticTruth:false,commitAllowed:false
    });
  }
}

function promotableRelation(value,path){
  if(!own.call(RELATIONS,value)) fail('RELATION_NOT_PROMOTABLE',path);
  return value;
}

function assertBoundary(value,path){
  if(value.authority!=='STRUCTURAL_ONLY') fail('AUTHORITY_BOUNDARY_VIOLATION',path+'.authority');
  if(value.soundness!=='NOT_COMPUTED') fail('SOUNDNESS_BOUNDARY_VIOLATION',path+'.soundness');
  if(value.semanticTruth!==false) fail('SEMANTIC_TRUTH_FORBIDDEN',path+'.semanticTruth');
  if(value.commitAllowed!==false) fail('COMMIT_AUTHORITY_FORBIDDEN',path+'.commitAllowed');
  if(value.reviewStatus!=='REQUIRES_REVIEW') fail('REVIEW_BYPASS_FORBIDDEN',path+'.reviewStatus');
  if(value.finalRelation!=='NOT_COMPUTED') fail('FINAL_RELATION_FORBIDDEN',path+'.finalRelation');
}

function assertSourceSnapshot(value){
  var report=Search.validateSourceSnapshot(value);
  if(!report||report.status!=='VALID') fail('SOURCE_SNAPSHOT_INVALID','$.sourceSnapshot',report&&report.code||'INVALID');
}

function data7SourceRef(source){
  return {
    sourceId:source.sourceId,
    revision:source.revision,
    language:source.language,
    textHash:source.textHash,
    sourceHash:source.sourceHash
  };
}

function evidenceSourceRef(source){
  return {sourceId:source.sourceId,revision:source.revision,sourceHash:source.sourceHash};
}

function assertEvidenceSourceRef(value,path){
  object(value,path);
  exactKeys(value,['sourceId','revision','sourceHash'],[],path);
  text(value.sourceId,path+'.sourceId',256,ID_PATTERN);
  text(value.revision,path+'.revision',128);
  hash(value.sourceHash,path+'.sourceHash');
}

function assertData7SourceRef(value,path){
  object(value,path);
  exactKeys(value,['sourceId','revision','language','textHash','sourceHash'],[],path);
  text(value.sourceId,path+'.sourceId',256,ID_PATTERN);
  text(value.revision,path+'.revision',128);
  text(value.language,path+'.language',64);
  hash(value.textHash,path+'.textHash');
  hash(value.sourceHash,path+'.sourceHash');
}

function assertLocator(value,path,withSentence){
  object(value,path);
  exactKeys(value,withSentence?['start','end','sentenceIndex']:['start','end'],[],path);
  integer(value.start,path+'.start',0,Number.MAX_SAFE_INTEGER);
  integer(value.end,path+'.end',1,Number.MAX_SAFE_INTEGER);
  if(value.end<=value.start) fail('INVALID_LOCATOR',path+'.end');
  if(withSentence) integer(value.sentenceIndex,path+'.sentenceIndex',0,Number.MAX_SAFE_INTEGER);
}

function assertParserRef(value,path){
  object(value,path);
  exactKeys(value,['id','version'],[],path);
  text(value.id,path+'.id',256,ID_PATTERN);
  text(value.version,path+'.version',64,/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/);
}

function assertClaimRef(value,path){
  object(value,path);
  exactKeys(value,['claimAstId','contentHash','parserRef','resolutionStatus'],[],path);
  text(value.claimAstId,path+'.claimAstId',256,ID_PATTERN);
  hash(value.contentHash,path+'.contentHash');
  assertParserRef(value.parserRef,path+'.parserRef');
  if(value.resolutionStatus!=='RESOLVED') fail('RESOLVED_CLAIM_REQUIRED',path+'.resolutionStatus');
}

function assertArtifactRef(value,path){
  object(value,path);
  exactKeys(value,['artifactId','contentHash','alpha','kind'],[],path);
  hash(value.artifactId,path+'.artifactId');
  hash(value.contentHash,path+'.contentHash');
  if(Alpha.kindForAlpha(value.alpha)!==value.kind) fail('ALPHA_KIND_MISMATCH',path+'.kind');
}

function assertSegmentRef(value,path){
  object(value,path);
  exactKeys(value,['segmentId','contentHash','sourceRef','locator','artifactRef'],[],path);
  hash(value.segmentId,path+'.segmentId');
  hash(value.contentHash,path+'.contentHash');
  assertData7SourceRef(value.sourceRef,path+'.sourceRef');
  assertLocator(value.locator,path+'.locator',false);
  assertArtifactRef(value.artifactRef,path+'.artifactRef');
}

function assertData7LinkRef(value,path){
  object(value,path);
  exactKeys(value,['candidateId','contentHash'],[],path);
  hash(value.candidateId,path+'.candidateId');
  hash(value.contentHash,path+'.contentHash');
}

function assertSourceSetRef(value,path){
  object(value,path);
  exactKeys(value,['sourceSetHash','primarySourceHash','sourceCount'],[],path);
  hash(value.sourceSetHash,path+'.sourceSetHash');
  hash(value.primarySourceHash,path+'.primarySourceHash');
  integer(value.sourceCount,path+'.sourceCount',1,MAX_SOURCE_COUNT);
}

function assertQueryRef(value,path){
  object(value,path);
  exactKeys(value,['queryId','revision','contentHash'],[],path);
  text(value.queryId,path+'.queryId',256,ID_PATTERN);
  text(value.revision,path+'.revision',128);
  hash(value.contentHash,path+'.contentHash');
}

function assertIndexRef(value,path){
  object(value,path);
  exactKeys(value,['indexId','version','contentHash'],[],path);
  text(value.indexId,path+'.indexId',256,ID_PATTERN);
  text(value.version,path+'.version',64,/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/);
  hash(value.contentHash,path+'.contentHash');
}

function assertLinguisticIndexRef(value,path){
  object(value,path);
  exactKeys(value,['linguisticIndexHash','sourceSetHash','lexicalIndexHash','lexiconHash','patternSetHash','parserRef','alignerVersion'],[],path);
  hash(value.linguisticIndexHash,path+'.linguisticIndexHash');
  hash(value.sourceSetHash,path+'.sourceSetHash');
  hash(value.lexicalIndexHash,path+'.lexicalIndexHash');
  hash(value.lexiconHash,path+'.lexiconHash');
  hash(value.patternSetHash,path+'.patternSetHash');
  assertParserRef(value.parserRef,path+'.parserRef');
  text(value.alignerVersion,path+'.alignerVersion',64,/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/);
}

function sourcePassageRef(passage){
  return {
    passageId:passage.passageId,
    sourceSpanId:passage.sourceSpanId,
    contentHash:passage.contentHash,
    sourceRef:Canonical.deepCopy(passage.sourceRef),
    locator:Canonical.deepCopy(passage.locator),
    textHash:passage.textHash
  };
}

function assertSourcePassageRef(value,path){
  object(value,path);
  exactKeys(value,['passageId','sourceSpanId','contentHash','sourceRef','locator','textHash'],[],path);
  text(value.passageId,path+'.passageId',256,ID_PATTERN);
  text(value.sourceSpanId,path+'.sourceSpanId',256,ID_PATTERN);
  hash(value.contentHash,path+'.contentHash');
  assertEvidenceSourceRef(value.sourceRef,path+'.sourceRef');
  assertLocator(value.locator,path+'.locator',true);
  hash(value.textHash,path+'.textHash');
}

function assertPassageClaimRecordRef(value,path){
  object(value,path);
  exactKeys(value,['passageClaimId','contentHash','claimAstRef','resolutionStatus','spanMapStatus','structuralStatus'],[],path);
  text(value.passageClaimId,path+'.passageClaimId',256,ID_PATTERN);
  hash(value.contentHash,path+'.contentHash');
  assertClaimRef(value.claimAstRef,path+'.claimAstRef');
  if(value.resolutionStatus!=='RESOLVED') fail('RESOLVED_CLAIM_REQUIRED',path+'.resolutionStatus');
  if(value.spanMapStatus!=='COMPLETE') fail('SOURCE_SPAN_MAP_INCOMPLETE',path+'.spanMapStatus');
  if(value.structuralStatus!=='STRUCTURAL_MATCH') fail('STRUCTURAL_MATCH_REQUIRED',path+'.structuralStatus');
}

function assertAlignmentRef(value,path){
  object(value,path);
  exactKeys(value,['alignmentId','contentHash','gateStatus'],[],path);
  text(value.alignmentId,path+'.alignmentId',256,ID_PATTERN);
  hash(value.contentHash,path+'.contentHash');
  if(value.gateStatus!=='CLAIM_ALIGNED') fail('CLAIM_ALIGNMENT_REQUIRED',path+'.gateStatus');
}

function assertEvidenceCandidateRef(value,path){
  var i;
  object(value,path);
  exactKeys(value,['candidateId','contentHash','proposedRelation','status','hitIds','sourceSpanIds'],[],path);
  text(value.candidateId,path+'.candidateId',256,ID_PATTERN);
  hash(value.contentHash,path+'.contentHash');
  promotableRelation(value.proposedRelation,path+'.proposedRelation');
  if(value.status!=='STRUCTURALLY_ALIGNED') fail('STRUCTURAL_ALIGNMENT_REQUIRED',path+'.status');
  array(value.hitIds,path+'.hitIds',1,MAX_REPLAY_HITS);
  array(value.sourceSpanIds,path+'.sourceSpanIds',1,1);
  for(i=0;i<value.hitIds.length;i++){
    text(value.hitIds[i],path+'.hitIds['+i+']',256,ID_PATTERN);
    if(i&&value.hitIds[i-1]>=value.hitIds[i]) fail('HIT_IDS_NOT_SORTED_UNIQUE',path+'.hitIds');
  }
  text(value.sourceSpanIds[0],path+'.sourceSpanIds[0]',256,ID_PATTERN);
}

function assertHitRef(value,path){
  object(value,path);
  exactKeys(value,['hitId','queryRef','indexRef','sourceHash','locator','matchedTextHash','contextSpanHash'],[],path);
  text(value.hitId,path+'.hitId',256,ID_PATTERN);
  assertQueryRef(value.queryRef,path+'.queryRef');
  assertIndexRef(value.indexRef,path+'.indexRef');
  hash(value.sourceHash,path+'.sourceHash');
  assertLocator(value.locator,path+'.locator',false);
  hash(value.matchedTextHash,path+'.matchedTextHash');
  hash(value.contextSpanHash,path+'.contextSpanHash');
}

function assertContextSpanRef(value,path){
  object(value,path);
  exactKeys(value,['spanId','spanHash','sourceHash','start','end','textHash'],[],path);
  text(value.spanId,path+'.spanId',256,ID_PATTERN);
  hash(value.spanHash,path+'.spanHash');
  hash(value.sourceHash,path+'.sourceHash');
  integer(value.start,path+'.start',0,Number.MAX_SAFE_INTEGER);
  integer(value.end,path+'.end',1,Number.MAX_SAFE_INTEGER);
  if(value.end<=value.start) fail('INVALID_LOCATOR',path+'.end');
  hash(value.textHash,path+'.textHash');
}

function replayConfig(value,path){
  object(value,path);
  exactKeys(value,['maxOperations','maxHits','maxPassages'],[],path);
  return {
    maxOperations:integer(value.maxOperations,path+'.maxOperations',1,MAX_REPLAY_OPERATIONS),
    maxHits:integer(value.maxHits,path+'.maxHits',1,MAX_REPLAY_HITS),
    maxPassages:integer(value.maxPassages,path+'.maxPassages',1,MAX_REPLAY_PASSAGES)
  };
}

function assertSegmentAgainstSource(segment,source,path){
  var report=Data7.validateSegment(segment);
  if(!report||report.status!=='VALID') fail('DATA7_SEGMENT_INVALID',path,report&&report.code||'INVALID');
  if(!same(segment.sourceRef,data7SourceRef(source))) fail('SEGMENT_SOURCE_MISMATCH',path+'.sourceRef');
  if(source.text.slice(segment.locator.start,segment.locator.end)!==segment.text) fail('SEGMENT_SOURCE_SLICE_MISMATCH',path+'.text');
}

function assertIndexAgainstSource(index,source){
  var report,sources,indexSource=null,i,sourceSetHash,totalCodeUnits=0;
  if(!index.lexicalIndex||!Array.isArray(index.lexicalIndex.sources)) fail('INDEX_SOURCES_UNAVAILABLE','$.linguisticIndex.lexicalIndex.sources');
  sources=index.lexicalIndex.sources;
  if(!sources.length||sources.length>MAX_SOURCE_COUNT) fail('SOURCE_SET_TOO_LARGE','$.linguisticIndex.lexicalIndex.sources');
  for(i=0;i<sources.length;i++){
    if(!sources[i]||typeof sources[i].text!=='string') fail('SOURCE_SNAPSHOT_INVALID','$.linguisticIndex.lexicalIndex.sources['+i+']');
    totalCodeUnits+=sources[i].text.length;
    if(totalCodeUnits>MAX_SOURCE_CODE_UNITS) fail('SOURCE_TEXT_BUDGET_EXCEEDED','$.linguisticIndex.lexicalIndex.sources');
    if(sources[i].sourceId===source.sourceId&&sources[i].revision===source.revision){
      if(indexSource!==null) fail('DUPLICATE_PRIMARY_SOURCE','$.linguisticIndex.lexicalIndex.sources');
      indexSource=sources[i];
    }
  }
  report=Linguistic.validateIndex(index);
  if(!report||report.status!=='VALID') fail('LINGUISTIC_INDEX_INVALID','$.linguisticIndex',report&&report.code||'INVALID');
  if(indexSource===null||!same(indexSource,source)) fail('PRIMARY_SOURCE_NOT_IN_INDEX','$.sourceSnapshot');
  sourceSetHash=Search.computeSourceSetHash(sources);
  if(sourceSetHash!==index.sourceSetHash) fail('SOURCE_SET_HASH_MISMATCH','$.linguisticIndex.sourceSetHash');
  return {sourceSetHash:sourceSetHash,sourceCount:sources.length};
}

function assertContentAddressedRecord(value,idField,prefix,path){
  var base,copy,expectedId,expectedHash;
  object(value,path);
  if(!own.call(value,idField)||!own.call(value,'contentHash')) fail('CONTENT_ADDRESS_FIELDS_REQUIRED',path);
  text(value[idField],path+'.'+idField,256,ID_PATTERN);
  hash(value.contentHash,path+'.contentHash');
  base=Canonical.deepCopy(value);
  delete base[idField];
  delete base.contentHash;
  expectedId=prefix+Canonical.hashCanonical(base).slice(7);
  if(value[idField]!==expectedId) fail('RECORD_ID_MISMATCH',path+'.'+idField);
  copy=Canonical.deepCopy(value);
  expectedHash=copy.contentHash;
  delete copy.contentHash;
  if(Canonical.hashCanonical(copy)!==expectedHash) fail('CONTENT_HASH_MISMATCH',path+'.contentHash');
}

function assertContextSpan(context,source,path){
  var base,expectedHash;
  object(context,path);
  exactKeys(context,['schema','sourceId','sourceRevision','sourceHash','start','end','text','textHash','spanId','spanHash'],[],path);
  if(context.schema!==CONTEXT_SCHEMA) fail('CONTEXT_SCHEMA_MISMATCH',path+'.schema');
  if(context.sourceId!==source.sourceId||context.sourceRevision!==source.revision||context.sourceHash!==source.sourceHash){
    fail('CONTEXT_SOURCE_MISMATCH',path);
  }
  integer(context.start,path+'.start',0,source.text.length);
  integer(context.end,path+'.end',1,source.text.length);
  if(context.end<=context.start) fail('INVALID_LOCATOR',path+'.end');
  if(context.text!==source.text.slice(context.start,context.end)) fail('CONTEXT_SOURCE_SLICE_MISMATCH',path+'.text');
  if(context.textHash!==Canonical.hashText(context.text)) fail('CONTEXT_TEXT_HASH_MISMATCH',path+'.textHash');
  base={
    schema:context.schema,sourceId:context.sourceId,sourceRevision:context.sourceRevision,
    sourceHash:context.sourceHash,start:context.start,end:context.end,text:context.text,textHash:context.textHash
  };
  expectedHash=Canonical.hashCanonical(base);
  if(context.spanHash!==expectedHash||context.spanId!=='span:'+expectedHash.slice(7)) fail('CONTEXT_IDENTITY_MISMATCH',path+'.spanHash');
}

function uniqueBy(values,key,path){
  var seen={},i,value;
  for(i=0;i<values.length;i++){
    value=values[i][key];
    if(seen[value]) fail('DUPLICATE_REFERENCE',path+'['+i+'].'+key);
    seen[value]=true;
  }
}

function findOne(values,predicate,missingCode,duplicateCode,path){
  var found=null,count=0,i;
  for(i=0;i<values.length;i++) if(predicate(values[i])){ found=values[i]; count++; }
  if(count===0) fail(missingCode,path);
  if(count!==1) fail(duplicateCode,path);
  return found;
}

function claimRef(claim){ return Canonical.deepCopy(Evidence.claimRef(claim)); }

function assertClaimReplay(parsed,expectedRef,path){
  var actual;
  if(!parsed||parsed.status!=='READY'||parsed.resolutionStatus!=='RESOLVED'||!parsed.claimAst) fail('CLAIM_REPLAY_NOT_RESOLVED',path);
  actual=claimRef(parsed.claimAst);
  if(!same(actual,expectedRef)) fail('CLAIM_REPLAY_MISMATCH',path+'.claimAst');
  return parsed.claimAst;
}

function contextRef(context){
  return {
    spanId:context.spanId,spanHash:context.spanHash,sourceHash:context.sourceHash,
    start:context.start,end:context.end,textHash:context.textHash
  };
}

function hitRef(hit){
  return {
    hitId:hit.hitId,queryRef:Canonical.deepCopy(hit.queryRef),indexRef:Canonical.deepCopy(hit.indexRef),
    sourceHash:hit.sourceHash,locator:{start:hit.locator.start,end:hit.locator.end},
    matchedTextHash:hit.matchedTextHash,contextSpanHash:hit.contextSpanHash
  };
}

function resolveEvidence(raw){
  var definition=safeData(raw),config,source,indexInfo,linkReport,targetParse,replay,candidate,replayedCandidate,
    queryReport,indexManifestReport,passage,expectedPassage,passageParse,passageClaimRecord,alignment,
    directionAssessment,directionReport,hits=[],contexts=[],contextByHash={},usedContexts={},hitById={},
    sourceRef,queryRef,indexRef,targetRef,passageClaimRefValue,passageClaimIds,alignmentIds,i,hit,context,edge,edgeReport;

  object(definition,'$');
  exactKeys(definition,[
    'linkCandidate','fromSegment','toSegment','witnessSegment','sourceSnapshot',
    'linguisticIndex','evidenceCandidate','replayConfig'
  ],[],'$');
  config=replayConfig(definition.replayConfig,'$.replayConfig');
  source=definition.sourceSnapshot;
  assertSourceSnapshot(source);
  assertSegmentAgainstSource(definition.fromSegment,source,'$.fromSegment');
  assertSegmentAgainstSource(definition.toSegment,source,'$.toSegment');
  assertSegmentAgainstSource(definition.witnessSegment,source,'$.witnessSegment');
  linkReport=Data7.validateLinkCandidateAgainst(
    definition.linkCandidate,definition.fromSegment,definition.toSegment,definition.witnessSegment
  );
  if(!linkReport||linkReport.status!=='VALID') fail('DATA7_LINK_CANDIDATE_INVALID','$.linkCandidate',linkReport&&linkReport.code||'INVALID');
  indexInfo=assertIndexAgainstSource(definition.linguisticIndex,source);

  candidate=definition.evidenceCandidate;
  if(Evidence.validateEvidenceCandidate(candidate).status!=='VALID') fail('EVIDENCE_CANDIDATE_INVALID','$.evidenceCandidate');
  promotableRelation(candidate.proposedRelation,'$.evidenceCandidate.proposedRelation');
  if(candidate.status!=='STRUCTURALLY_ALIGNED') fail('STRUCTURAL_ALIGNMENT_REQUIRED','$.evidenceCandidate.status');
  if(candidate.reasonCodes.indexOf('SOURCE_PASSAGE_PINNED')===-1||candidate.reasonCodes.indexOf('HUMAN_REVIEW_REQUIRED')===-1){
    fail('EVIDENCE_REASON_REQUIRED','$.evidenceCandidate.reasonCodes');
  }
  if(candidate.provenance.sourceSetHash!==indexInfo.sourceSetHash||
     candidate.provenance.lexicalIndexHash!==definition.linguisticIndex.lexicalIndexHash||
     candidate.provenance.linguisticIndexHash!==definition.linguisticIndex.linguisticIndexHash||
     candidate.provenance.lexiconHash!==definition.linguisticIndex.lexiconHash||
     candidate.provenance.alignerVersion!==Linguistic.version){
    fail('EVIDENCE_PROVENANCE_MISMATCH','$.evidenceCandidate.provenance');
  }
  if(!same(candidate.provenance.parserRef,Parser.parserRef)||
     !same(definition.linguisticIndex.parserRef,Parser.parserRef)) fail('PARSER_IDENTITY_MISMATCH','$.evidenceCandidate.provenance.parserRef');

  targetParse=Parser.replay(definition.fromSegment.text,{expectedLexiconHash:definition.linguisticIndex.lexiconHash});
  targetRef=claimRef(assertClaimReplay(targetParse,candidate.targetClaimRef,'$.fromSegment'));
  replay=Linguistic.replay(definition.linguisticIndex,targetParse,{
    maxOperations:config.maxOperations,maxHits:config.maxHits,maxPassages:config.maxPassages,
    expectedSourceSetHash:indexInfo.sourceSetHash,
    expectedLinguisticIndexHash:definition.linguisticIndex.linguisticIndexHash
  });
  if(!replay||replay.status!=='READY') fail('EVIDENCE_REPLAY_NOT_READY','$.linguisticIndex',replay&&replay.code||'INVALID');
  replayedCandidate=findOne(replay.evidenceCandidates,function(item){
    return item.candidateId===candidate.candidateId&&item.contentHash===candidate.contentHash;
  },'EVIDENCE_CANDIDATE_NOT_REPRODUCED','EVIDENCE_CANDIDATE_REPLAY_DUPLICATE','$.evidenceCandidate');
  if(!same(replayedCandidate,candidate)) fail('EVIDENCE_CANDIDATE_REPLAY_MISMATCH','$.evidenceCandidate');

  queryReport=Search.validateSemanticQuery(replay.query);
  if(!queryReport||queryReport.status!=='VALID') fail('SEMANTIC_QUERY_INVALID','$.linguisticIndex.replay.query');
  indexManifestReport=Search.validateIndexManifest(definition.linguisticIndex.lexicalIndex.manifest);
  if(!indexManifestReport||indexManifestReport.status!=='VALID') fail('INDEX_MANIFEST_INVALID','$.linguisticIndex.lexicalIndex.manifest');
  queryRef={queryId:replay.query.queryId,revision:replay.query.revision,contentHash:replay.query.contentHash};
  indexRef=Canonical.deepCopy(replay.lexicalResult.indexRef);
  if(candidate.provenance.queryHash!==queryRef.contentHash||candidate.provenance.lexicalIndexHash!==indexRef.contentHash){
    fail('QUERY_INDEX_PROVENANCE_MISMATCH','$.evidenceCandidate.provenance');
  }

  sourceRef=evidenceSourceRef(source);
  passage=findOne(replay.locatedPassages,function(item){
    return same(item.sourceRef,sourceRef)&&item.locator.start===definition.toSegment.locator.start&&
      item.locator.end===definition.toSegment.locator.end;
  },'EXACT_SOURCE_PASSAGE_NOT_FOUND','EXACT_SOURCE_PASSAGE_DUPLICATE','$.toSegment.locator');
  if(Evidence.validateSourcePassage(passage).status!=='VALID') fail('SOURCE_PASSAGE_INVALID','$.toSegment.locator');
  expectedPassage=Evidence.createSourcePassage(source,passage.locator);
  if(expectedPassage.contentHash!==passage.contentHash||passage.text!==definition.toSegment.text||
     passage.textHash!==definition.toSegment.textHash) fail('SOURCE_PASSAGE_ENDPOINT_MISMATCH','$.toSegment');
  if(!same(candidate.sourceRef,sourceRef)||!same(candidate.locator,passage.locator)||
     candidate.passageTextHash!==passage.textHash||!sameArray(candidate.sourceSpanIds,[passage.sourceSpanId])){
    fail('EVIDENCE_PASSAGE_REFERENCE_MISMATCH','$.evidenceCandidate');
  }

  passageParse=Parser.replay(definition.toSegment.text,{expectedLexiconHash:definition.linguisticIndex.lexiconHash});
  passageClaimRefValue=claimRef(assertClaimReplay(passageParse,candidate.passageClaimRef,'$.toSegment'));
  passageClaimRecord=findOne(replay.passageClaims,function(item){
    return item.passageRef&&item.passageRef.passageId===passage.passageId;
  },'PASSAGE_CLAIM_NOT_FOUND','PASSAGE_CLAIM_DUPLICATE','$.evidenceCandidate.passageClaimRef');
  assertContentAddressedRecord(passageClaimRecord,'passageClaimId','passage-claim:','$.passageClaimRecord');
  if(!same(passageClaimRecord.claimAstRef,passageClaimRefValue)||passageClaimRecord.resolutionStatus!=='RESOLVED'||
     passageClaimRecord.spanMapStatus!=='COMPLETE'||passageClaimRecord.structural.status!=='STRUCTURAL_MATCH'){
    fail('PASSAGE_CLAIM_INCOMPLETE','$.passageClaimRecord');
  }

  alignment=findOne(replay.alignments,function(item){
    return item.targetClaimRef&&item.targetClaimRef.contentHash===targetRef.contentHash&&
      item.passageClaimRef&&item.passageClaimRef.passageClaimId===passageClaimRecord.passageClaimId;
  },'CLAIM_ALIGNMENT_NOT_FOUND','CLAIM_ALIGNMENT_DUPLICATE','$.evidenceCandidate.alignment');
  assertContentAddressedRecord(alignment,'alignmentId','claim-alignment:','$.alignment');
  if(alignment.gateStatus!=='CLAIM_ALIGNED') fail('CLAIM_ALIGNMENT_REQUIRED','$.alignment.gateStatus');

  directionAssessment=null;
  if(candidate.proposedRelation==='QUALIFIES'){
    directionAssessment=QualifierDirection.assessQualifierDirection({
      targetParseResult:targetParse,
      passageParseResult:passageParse,
      evidenceCandidate:candidate
    });
    directionReport=QualifierDirection.validateQualifierDirectionAgainst(directionAssessment,{
      targetParseResult:targetParse,passageParseResult:passageParse,evidenceCandidate:candidate
    });
    if(!directionReport||directionReport.status!=='VALID') fail('QUALIFIES_DIRECTION_REPLAY_INVALID','$.qualifierDirectionAssessment',directionReport&&directionReport.code||'INVALID');
    if(directionAssessment.status!=='DIRECTED'){
      fail('QUALIFIES_DIRECTION_ABSTAIN','$.qualifierDirectionAssessment',directionAssessment.abstainCode);
    }
    if(directionAssessment.scopeDirection!=='NARROWER') fail('QUALIFIES_ENDPOINT_DIRECTION_MISMATCH','$.qualifierDirectionAssessment.scopeDirection');
  }

  array(replay.lexicalResult.hits,'$.replay.hits',1,MAX_REPLAY_HITS);
  uniqueBy(replay.lexicalResult.hits,'hitId','$.replay.hits');
  for(i=0;i<replay.lexicalResult.hits.length;i++) hitById[replay.lexicalResult.hits[i].hitId]=replay.lexicalResult.hits[i];
  if(!sameArray(candidate.hitIds,candidate.hitIds.slice().sort(compareText))) fail('HIT_IDS_NOT_SORTED','$.evidenceCandidate.hitIds');
  for(i=0;i<candidate.hitIds.length;i++){
    hit=hitById[candidate.hitIds[i]];
    if(!hit) fail('SEARCH_HIT_NOT_FOUND','$.evidenceCandidate.hitIds['+i+']');
    if(Search.validateSearchHit(hit).status!=='VALID') fail('SEARCH_HIT_INVALID','$.replay.hits');
    if(hit.sourceId!==source.sourceId||hit.sourceRevision!==source.revision||hit.sourceHash!==source.sourceHash){
      fail('SEARCH_HIT_SOURCE_MISMATCH','$.replay.hits');
    }
    if(hit.locator.start<passage.locator.start||hit.locator.end>passage.locator.end) fail('SEARCH_HIT_OUTSIDE_PASSAGE','$.replay.hits');
    if(hit.matchedTextHash!==Canonical.hashText(source.text.slice(hit.locator.start,hit.locator.end))){
      fail('SEARCH_HIT_SLICE_MISMATCH','$.replay.hits');
    }
    if(!same(hit.queryRef,queryRef)||!same(hit.indexRef,indexRef)) fail('SEARCH_HIT_PROVENANCE_MISMATCH','$.replay.hits');
    hits.push(hit);
  }

  array(replay.lexicalResult.contexts,'$.replay.contexts',1,MAX_REPLAY_HITS);
  uniqueBy(replay.lexicalResult.contexts,'spanHash','$.replay.contexts');
  for(i=0;i<replay.lexicalResult.contexts.length;i++) contextByHash[replay.lexicalResult.contexts[i].spanHash]=replay.lexicalResult.contexts[i];
  for(i=0;i<hits.length;i++){
    context=contextByHash[hits[i].contextSpanHash];
    if(!context) fail('CONTEXT_SPAN_NOT_FOUND','$.replay.hits['+i+'].contextSpanHash');
    assertContextSpan(context,source,'$.replay.contexts');
    if(context.start>hits[i].locator.start||context.end<hits[i].locator.end) fail('CONTEXT_DOES_NOT_COVER_HIT','$.replay.contexts');
    if(context.start<definition.witnessSegment.locator.start||context.end>definition.witnessSegment.locator.end){
      fail('CONTEXT_OUTSIDE_DATA7_WITNESS','$.replay.contexts');
    }
    if(!usedContexts[context.spanHash]){ usedContexts[context.spanHash]=true; contexts.push(context); }
  }
  hits.sort(function(a,b){ return compareText(a.hitId,b.hitId); });
  contexts.sort(function(a,b){ return compareText(a.spanHash,b.spanHash); });

  edge=Alpha.createEdge(definition.toSegment.artifact,definition.fromSegment.artifact,{
    relation:candidate.proposedRelation,sourceRefs:[source.sourceHash],status:'PROPOSED'
  });
  edgeReport=Alpha.validateEdgeAgainst(edge,definition.toSegment.artifact,definition.fromSegment.artifact);
  if(!edgeReport||edgeReport.status!=='VALID') fail('ALPHA_EDGE_PROPOSAL_INVALID','$.edgeProposal',edgeReport&&edgeReport.code||'INVALID');

  passageClaimIds={
    passageClaimId:passageClaimRecord.passageClaimId,contentHash:passageClaimRecord.contentHash,
    claimAstRef:Canonical.deepCopy(passageClaimRecord.claimAstRef),resolutionStatus:passageClaimRecord.resolutionStatus,
    spanMapStatus:passageClaimRecord.spanMapStatus,structuralStatus:passageClaimRecord.structural.status
  };
  alignmentIds={alignmentId:alignment.alignmentId,contentHash:alignment.contentHash,gateStatus:alignment.gateStatus};
  return {
    definition:definition,config:config,source:source,indexInfo:indexInfo,candidate:candidate,
    targetRef:targetRef,passageClaimRef:passageClaimRefValue,queryRef:queryRef,indexRef:indexRef,
    passage:passage,passageClaimRecordRef:passageClaimIds,alignmentRef:alignmentIds,
    qualifierDirectionAssessment:directionAssessment,hits:hits,contexts:contexts,edge:edge
  };
}

function buildEvidenceBackedLink(resolved){
  var input=resolved.definition,index=input.linguisticIndex,identity,payload;
  identity={
    schema:OUTPUT_SCHEMA,
    version:VERSION,
    operation:'EVIDENCE_BACK_LINK',
    basis:'EXACT_SOURCE_PASSAGE_AND_DETERMINISTIC_REPLAY',
    direction:'PASSAGE_TO_TARGET',
    data7LinkRef:{candidateId:input.linkCandidate.candidateId,contentHash:input.linkCandidate.contentHash},
    targetSegmentRef:Canonical.deepCopy(input.linkCandidate.fromSegmentRef),
    passageSegmentRef:Canonical.deepCopy(input.linkCandidate.toSegmentRef),
    contextSegmentRef:Canonical.deepCopy(input.linkCandidate.witnessSegmentRef),
    sourceSetRef:{
      sourceSetHash:resolved.indexInfo.sourceSetHash,
      primarySourceHash:resolved.source.sourceHash,
      sourceCount:resolved.indexInfo.sourceCount
    },
    queryRef:Canonical.deepCopy(resolved.queryRef),
    indexRef:Canonical.deepCopy(resolved.indexRef),
    linguisticIndexRef:{
      linguisticIndexHash:index.linguisticIndexHash,sourceSetHash:index.sourceSetHash,
      lexicalIndexHash:index.lexicalIndexHash,lexiconHash:index.lexiconHash,patternSetHash:index.patternSetHash,
      parserRef:Canonical.deepCopy(index.parserRef),alignerVersion:Linguistic.version
    },
    sourcePassageRef:sourcePassageRef(resolved.passage),
    targetClaimRef:Canonical.deepCopy(resolved.targetRef),
    passageClaimRef:Canonical.deepCopy(resolved.passageClaimRef),
    passageClaimRecordRef:Canonical.deepCopy(resolved.passageClaimRecordRef),
    alignmentRef:Canonical.deepCopy(resolved.alignmentRef),
    qualifierDirectionAssessment:resolved.qualifierDirectionAssessment?Canonical.deepCopy(resolved.qualifierDirectionAssessment):null,
    hitRefs:resolved.hits.map(hitRef),
    contextSpanRefs:resolved.contexts.map(contextRef),
    evidenceCandidateRef:{
      candidateId:resolved.candidate.candidateId,contentHash:resolved.candidate.contentHash,
      proposedRelation:resolved.candidate.proposedRelation,status:resolved.candidate.status,
      hitIds:resolved.candidate.hitIds.slice(),sourceSpanIds:resolved.candidate.sourceSpanIds.slice()
    },
    replayConfig:Canonical.deepCopy(resolved.config),
    proposedRelation:resolved.candidate.proposedRelation,
    relationStatus:'PROPOSED',
    edgeProposal:Canonical.deepCopy(resolved.edge),
    alphaTransitionReceipt:null,
    verificationStatus:'REPLAY_REQUIRED',
    validationRequirement:'FULL_BUNDLE_REPLAY',
    evidenceStatus:'EVIDENCE_BACKED_PROPOSAL',
    reviewStatus:'REQUIRES_REVIEW',
    finalRelation:'NOT_COMPUTED',
    authority:'STRUCTURAL_ONLY',
    soundness:'NOT_COMPUTED',
    semanticTruth:false,
    commitAllowed:false
  };
  payload=Canonical.deepCopy(identity);
  payload.proposalId=Canonical.hashCanonical(identity);
  payload.contentHash=Canonical.hashCanonical(payload);
  assertEvidenceBackedLink(payload);
  return freeze(payload);
}

function createEvidenceBackedLink(definition){
  return buildEvidenceBackedLink(resolveEvidence(definition));
}

function createEvidenceBackedLinkWithValidation(definition){
  var resolved=resolveEvidence(definition),proposal=buildEvidenceBackedLink(resolved);
  return freeze({
    proposal:proposal,
    validation:successfulValidationReport(proposal,resolved.definition,'VALID','REFERENTIAL_REPLAY')
  });
}

function assertEvidenceBackedLink(value){
  var i,hitIds=[],sourceSpanIds,contextHashes={},identity,payload,expectedId,expectedHash,edgeReport,directionReport;
  safeData(value);
  object(value,'$');
  exactKeys(value,[
    'schema','version','operation','basis','direction','data7LinkRef','targetSegmentRef','passageSegmentRef',
    'contextSegmentRef','sourceSetRef','queryRef','indexRef','linguisticIndexRef','sourcePassageRef',
    'targetClaimRef','passageClaimRef','passageClaimRecordRef','alignmentRef','qualifierDirectionAssessment','hitRefs','contextSpanRefs',
    'evidenceCandidateRef','replayConfig','proposedRelation','relationStatus','edgeProposal',
    'alphaTransitionReceipt','verificationStatus','validationRequirement','evidenceStatus','reviewStatus','finalRelation','authority',
    'soundness','semanticTruth','commitAllowed','proposalId','contentHash'
  ],[],'$');
  if(value.schema!==OUTPUT_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  if(value.operation!=='EVIDENCE_BACK_LINK'||value.basis!=='EXACT_SOURCE_PASSAGE_AND_DETERMINISTIC_REPLAY'||
     value.direction!=='PASSAGE_TO_TARGET') fail('OPERATION_MODE_INVALID','$.operation');
  assertData7LinkRef(value.data7LinkRef,'$.data7LinkRef');
  assertSegmentRef(value.targetSegmentRef,'$.targetSegmentRef');
  assertSegmentRef(value.passageSegmentRef,'$.passageSegmentRef');
  assertSegmentRef(value.contextSegmentRef,'$.contextSegmentRef');
  if(value.targetSegmentRef.segmentId===value.passageSegmentRef.segmentId) fail('SELF_LINK_FORBIDDEN','$.passageSegmentRef');
  if(value.targetSegmentRef.artifactRef.alpha!==value.passageSegmentRef.artifactRef.alpha||
     value.targetSegmentRef.artifactRef.kind!==value.passageSegmentRef.artifactRef.kind) fail('LINK_ALPHA_KIND_MISMATCH','$.passageSegmentRef');
  if(value.contextSegmentRef.artifactRef.alpha!==value.targetSegmentRef.artifactRef.alpha) fail('LINK_WITNESS_ALPHA_MISMATCH','$.contextSegmentRef');
  if(value.targetSegmentRef.sourceRef.sourceHash!==value.passageSegmentRef.sourceRef.sourceHash||
     value.targetSegmentRef.sourceRef.sourceHash!==value.contextSegmentRef.sourceRef.sourceHash) fail('COMMON_EXACT_SOURCE_REQUIRED','$.contextSegmentRef');
  if(value.contextSegmentRef.locator.start>Math.min(value.targetSegmentRef.locator.start,value.passageSegmentRef.locator.start)||
     value.contextSegmentRef.locator.end<Math.max(value.targetSegmentRef.locator.end,value.passageSegmentRef.locator.end)){
    fail('LINK_WITNESS_CONTEXT_INCOMPLETE','$.contextSegmentRef.locator');
  }
  assertSourceSetRef(value.sourceSetRef,'$.sourceSetRef');
  if(value.sourceSetRef.primarySourceHash!==value.targetSegmentRef.sourceRef.sourceHash) fail('PRIMARY_SOURCE_MISMATCH','$.sourceSetRef.primarySourceHash');
  assertQueryRef(value.queryRef,'$.queryRef');
  assertIndexRef(value.indexRef,'$.indexRef');
  assertLinguisticIndexRef(value.linguisticIndexRef,'$.linguisticIndexRef');
  if(value.linguisticIndexRef.sourceSetHash!==value.sourceSetRef.sourceSetHash||
     value.linguisticIndexRef.lexicalIndexHash!==value.indexRef.contentHash) fail('INDEX_REFERENCE_MISMATCH','$.linguisticIndexRef');
  assertSourcePassageRef(value.sourcePassageRef,'$.sourcePassageRef');
  if(value.sourcePassageRef.sourceRef.sourceHash!==value.sourceSetRef.primarySourceHash||
     value.sourcePassageRef.locator.start!==value.passageSegmentRef.locator.start||
     value.sourcePassageRef.locator.end!==value.passageSegmentRef.locator.end) fail('SOURCE_PASSAGE_ENDPOINT_MISMATCH','$.sourcePassageRef');
  assertClaimRef(value.targetClaimRef,'$.targetClaimRef');
  assertClaimRef(value.passageClaimRef,'$.passageClaimRef');
  if(!same(value.targetClaimRef.parserRef,value.linguisticIndexRef.parserRef)||
     !same(value.passageClaimRef.parserRef,value.linguisticIndexRef.parserRef)) fail('PARSER_IDENTITY_MISMATCH','$.targetClaimRef.parserRef');
  assertPassageClaimRecordRef(value.passageClaimRecordRef,'$.passageClaimRecordRef');
  if(!same(value.passageClaimRecordRef.claimAstRef,value.passageClaimRef)) fail('PASSAGE_CLAIM_REFERENCE_MISMATCH','$.passageClaimRecordRef.claimAstRef');
  assertAlignmentRef(value.alignmentRef,'$.alignmentRef');
  assertEvidenceCandidateRef(value.evidenceCandidateRef,'$.evidenceCandidateRef');
  if(value.proposedRelation!==value.evidenceCandidateRef.proposedRelation){
    fail('RELATION_NOT_PROMOTABLE','$.proposedRelation');
  }
  promotableRelation(value.proposedRelation,'$.proposedRelation');
  if(value.proposedRelation==='QUALIFIES'){
    if(value.qualifierDirectionAssessment===null) fail('QUALIFIES_DIRECTION_REQUIRED','$.qualifierDirectionAssessment');
    directionReport=QualifierDirection.inspectQualifierDirectionShape(value.qualifierDirectionAssessment);
    if(!directionReport||directionReport.status!=='STRUCTURALLY_VALID'){
      fail('QUALIFIES_DIRECTION_INVALID','$.qualifierDirectionAssessment',directionReport&&directionReport.code||'INVALID');
    }
    if(!same(value.qualifierDirectionAssessment.targetClaimRef,value.targetClaimRef)||
       !same(value.qualifierDirectionAssessment.passageClaimRef,value.passageClaimRef)||
       value.qualifierDirectionAssessment.evidenceCandidateRef.candidateId!==value.evidenceCandidateRef.candidateId||
       value.qualifierDirectionAssessment.evidenceCandidateRef.contentHash!==value.evidenceCandidateRef.contentHash){
      fail('QUALIFIES_DIRECTION_REFERENCE_MISMATCH','$.qualifierDirectionAssessment');
    }
    if(value.qualifierDirectionAssessment.status!=='DIRECTED'||value.qualifierDirectionAssessment.scopeDirection!=='NARROWER'){
      fail('QUALIFIES_ENDPOINT_DIRECTION_MISMATCH','$.qualifierDirectionAssessment.scopeDirection');
    }
    if(value.qualifierDirectionAssessment.passageParseRef.inputHash!==value.sourcePassageRef.textHash){
      fail('QUALIFIES_DIRECTION_PARSE_REFERENCE_MISMATCH','$.qualifierDirectionAssessment');
    }
  }else if(value.qualifierDirectionAssessment!==null){
    fail('QUALIFIER_DIRECTION_FORBIDDEN','$.qualifierDirectionAssessment');
  }
  if(value.relationStatus!=='PROPOSED') fail('REVIEWED_RELATION_FORBIDDEN','$.relationStatus');
  sourceSpanIds=value.evidenceCandidateRef.sourceSpanIds;
  if(!sameArray(sourceSpanIds,[value.sourcePassageRef.sourceSpanId])) fail('EVIDENCE_PASSAGE_REFERENCE_MISMATCH','$.evidenceCandidateRef.sourceSpanIds');
  replayConfig(value.replayConfig,'$.replayConfig');
  array(value.hitRefs,'$.hitRefs',1,MAX_REPLAY_HITS);
  for(i=0;i<value.hitRefs.length;i++){
    assertHitRef(value.hitRefs[i],'$.hitRefs['+i+']');
    if(i&&value.hitRefs[i-1].hitId>=value.hitRefs[i].hitId) fail('HIT_REFS_NOT_SORTED_UNIQUE','$.hitRefs');
    if(value.hitRefs[i].sourceHash!==value.sourceSetRef.primarySourceHash) fail('SEARCH_HIT_SOURCE_MISMATCH','$.hitRefs['+i+']');
    if(!same(value.hitRefs[i].queryRef,value.queryRef)||!same(value.hitRefs[i].indexRef,value.indexRef)) fail('SEARCH_HIT_PROVENANCE_MISMATCH','$.hitRefs['+i+']');
    if(value.hitRefs[i].locator.start<value.sourcePassageRef.locator.start||
       value.hitRefs[i].locator.end>value.sourcePassageRef.locator.end) fail('SEARCH_HIT_OUTSIDE_PASSAGE','$.hitRefs['+i+'].locator');
    hitIds.push(value.hitRefs[i].hitId);
  }
  if(!sameArray(hitIds,value.evidenceCandidateRef.hitIds)) fail('EVIDENCE_HIT_SET_MISMATCH','$.evidenceCandidateRef.hitIds');
  array(value.contextSpanRefs,'$.contextSpanRefs',1,MAX_REPLAY_HITS);
  for(i=0;i<value.contextSpanRefs.length;i++){
    assertContextSpanRef(value.contextSpanRefs[i],'$.contextSpanRefs['+i+']');
    if(i&&value.contextSpanRefs[i-1].spanHash>=value.contextSpanRefs[i].spanHash) fail('CONTEXT_REFS_NOT_SORTED_UNIQUE','$.contextSpanRefs');
    if(value.contextSpanRefs[i].sourceHash!==value.sourceSetRef.primarySourceHash) fail('CONTEXT_SOURCE_MISMATCH','$.contextSpanRefs['+i+']');
    contextHashes[value.contextSpanRefs[i].spanHash]=value.contextSpanRefs[i];
  }
  for(i=0;i<value.hitRefs.length;i++){
    if(!contextHashes[value.hitRefs[i].contextSpanHash]) fail('CONTEXT_SPAN_NOT_FOUND','$.hitRefs['+i+'].contextSpanHash');
    if(contextHashes[value.hitRefs[i].contextSpanHash].start>value.hitRefs[i].locator.start||
       contextHashes[value.hitRefs[i].contextSpanHash].end<value.hitRefs[i].locator.end){
      fail('CONTEXT_DOES_NOT_COVER_HIT','$.hitRefs['+i+'].contextSpanHash');
    }
  }
  edgeReport=Alpha.validateEdge(value.edgeProposal);
  if(!edgeReport||edgeReport.status!=='VALID') fail('ALPHA_EDGE_PROPOSAL_INVALID','$.edgeProposal',edgeReport&&edgeReport.code||'INVALID');
  if(value.edgeProposal.status!=='PROPOSED'||value.edgeProposal.relation!==value.proposedRelation||
     !same(value.edgeProposal.fromRef,value.passageSegmentRef.artifactRef)||
     !same(value.edgeProposal.toRef,value.targetSegmentRef.artifactRef)||
     !sameArray(value.edgeProposal.sourceRefs,[value.sourceSetRef.primarySourceHash])){
    fail('ALPHA_EDGE_PROPOSAL_MISMATCH','$.edgeProposal');
  }
  if(value.alphaTransitionReceipt!==null) fail('ALPHA_TRANSITION_RECEIPT_FORBIDDEN','$.alphaTransitionReceipt');
  if(value.verificationStatus!=='REPLAY_REQUIRED'||value.validationRequirement!=='FULL_BUNDLE_REPLAY'||
     value.evidenceStatus!=='EVIDENCE_BACKED_PROPOSAL'){
    fail('VERIFICATION_STATUS_INVALID','$.verificationStatus');
  }
  assertBoundary(value,'$');
  hash(value.proposalId,'$.proposalId');
  hash(value.contentHash,'$.contentHash');
  identity=Canonical.deepCopy(value);
  delete identity.proposalId;
  delete identity.contentHash;
  expectedId=Canonical.hashCanonical(identity);
  if(value.proposalId!==expectedId) fail('PROPOSAL_ID_MISMATCH','$.proposalId');
  payload=Canonical.deepCopy(value);
  expectedHash=payload.contentHash;
  delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}

function assertEvidenceBackedLinkAgainst(value,definition){
  var expected;
  assertEvidenceBackedLink(value);
  expected=createEvidenceBackedLink(definition);
  if(expected.contentHash!==value.contentHash) fail('EVIDENCE_BUNDLE_REFERENCE_MISMATCH','$');
  return true;
}

global.MRDP78EvidenceBackedLinkAdapter=freeze({
  version:VERSION,
  status:'READY',
  schema:'meridian.data7-evidence-backed-link-adapter/1',
  validationReportSchema:VALIDATION_REPORT_SCHEMA,
  outputSchema:OUTPUT_SCHEMA,
  operations:freeze(['EVIDENCE_BACK_LINK']),
  promotableRelations:freeze(['QUALIFIES','REFUTES','SUPPORTS']),
  qualifierDirections:QualifierDirection.directions,
  validationScopes:freeze({shape:'STRUCTURE_ONLY',against:'REFERENTIAL_REPLAY'}),
  validatorVersion:VALIDATOR_VERSION,
  limits:freeze({
    maxGraphNodes:MAX_GRAPH_NODES,maxGraphValues:MAX_GRAPH_VALUES,maxGraphCodeUnits:MAX_GRAPH_CODE_UNITS,
    maxGraphDepth:MAX_GRAPH_DEPTH,maxReplayHits:MAX_REPLAY_HITS,
    maxReplayPassages:MAX_REPLAY_PASSAGES,maxReplayOperations:MAX_REPLAY_OPERATIONS,
    maxSourceCount:MAX_SOURCE_COUNT,maxSourceCodeUnits:MAX_SOURCE_CODE_UNITS
  }),
  maxEdgeStatus:'PROPOSED',
  reviewStatus:'REQUIRES_REVIEW',
  finalRelation:'NOT_COMPUTED',
  semanticTruth:false,
  soundness:'NOT_COMPUTED',
  commitAllowed:false,
  createEvidenceBackedLink:createEvidenceBackedLink,
  createEvidenceBackedLinkWithValidation:createEvidenceBackedLinkWithValidation,
  inspectEvidenceBackedLinkShape:function(value){
    return validationReport(assertEvidenceBackedLink,value,null,'STRUCTURALLY_VALID','STRUCTURE_ONLY');
  },
  validateEvidenceBackedLinkAgainst:function(value,definition){
    return validationReport(assertEvidenceBackedLinkAgainst,value,definition,'VALID','REFERENTIAL_REPLAY');
  }
});
})(typeof globalThis!=='undefined'?globalThis:this);
