(function(global){
'use strict';

var VERSION='1.1.0';
var MODEL_SCHEMA='meridian.evidence-backed-link-view-model/1';
var Canonical=global.MRDP78CanonicalJSON;
var Search=global.MRDP78SearchContracts;
var Linguistic=global.MRDP78LinguisticStructureIndex;
var Data7=global.MRDP78Data7Adapter;
var Adapter=global.MRDP78EvidenceBackedLinkAdapter;

function blocked(code){
  global.MRDP78EvidenceBackedLinkProjector=Object.freeze({
    version:VERSION,status:'BLOCKED',code:code,semanticTruth:false,commitAllowed:false
  });
}

if(!Canonical||!Search||!Linguistic||!Data7||!Adapter){
  blocked('EVIDENCE_BACKED_LINK_PROJECTOR_DEPENDENCY_UNAVAILABLE');
  return;
}
if(Adapter.version!=='1.4.0'||Adapter.validationReportSchema!=='meridian.evidence-backed-link-validation-report/1'||
   typeof Adapter.createEvidenceBackedLinkWithValidation!=='function'){
  blocked('EVIDENCE_BACKED_LINK_ADAPTER_INCOMPATIBLE');
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var PROMOTABLE=freeze({REFUTES:0,QUALIFIES:1,SUPPORTS:2});
var MAX_ATTEMPTS=8;
var MAX_SCAN_CANDIDATES=512;
var MAX_REJECTIONS=8;
var MAX_EXCERPT_CODE_UNITS=1200;
var REPLAY_CONFIG=freeze({maxOperations:100000,maxHits:512,maxPassages:128});
var MAX_MODEL_NODES=2048;
var MAX_MODEL_VALUES=12000;
var MAX_MODEL_CODE_UNITS=96000;
var MAX_MODEL_DEPTH=20;

function fail(code,path,detail){
  var error=new TypeError(code+(path?' at '+path:'')+(detail?': '+detail:''));
  error.name='P78EvidenceBackedLinkProjectorError';
  error.code=code;
  error.path=path||'$';
  throw error;
}

function compareText(left,right){ return left<right?-1:left>right?1:0; }
function plain(value){ return !!value&&typeof value==='object'&&!Array.isArray(value)&&Canonical.isPlainObject(value); }
function hash(value,path){ if(!Canonical.isSha256(value)) fail('HASH_REQUIRED',path); return value; }
function boundedText(value,path,max){
  if(typeof value!=='string'||!value.length||value.length>max) fail('BOUNDED_TEXT_REQUIRED',path);
  return value;
}
function integer(value,path,min,max){
  if(!Number.isSafeInteger(value)||value<min||(max!==undefined&&value>max)) fail('SAFE_INTEGER_REQUIRED',path);
  return value;
}
function exactKeys(value,required,path){
  var allowed={},keys,i;
  if(!plain(value)) fail('PLAIN_OBJECT_REQUIRED',path);
  keys=Object.keys(value);
  for(i=0;i<required.length;i++) allowed[required[i]]=true;
  for(i=0;i<required.length;i++) if(!own.call(value,required[i])) fail('MISSING_FIELD',path+'.'+required[i]);
  for(i=0;i<keys.length;i++) if(!allowed[keys[i]]) fail('UNKNOWN_FIELD',path+'.'+keys[i]);
}
function safeToken(value,fallback){
  return typeof value==='string'&&value.length&&value.length<=256?value:fallback;
}
function sameSource(left,right){
  return !!left&&!!right&&left.sourceId===right.sourceId&&left.revision===right.revision&&
    left.sourceHash===right.sourceHash;
}
function sameFullSource(left,right){
  return sameSource(left,right)&&left.language===right.language&&left.textHash===right.textHash;
}
function sameLocator(left,right){ return left.start===right.start&&left.end===right.end; }
function overlaps(left,right){ return left.start<right.end&&right.start<left.end; }
function sourceFor(index,ref){
  var sources=index.lexicalIndex.sources,i;
  for(i=0;i<sources.length;i++) if(sameSource(sources[i],ref)) return sources[i];
  return null;
}
function passageFor(index,candidate){
  var passages=index.passages,i,item;
  for(i=0;i<passages.length;i++){
    item=passages[i];
    if(sameSource(item.sourceRef,candidate.sourceRef)&&sameLocator(item.locator,candidate.locator)&&
       item.textHash===candidate.passageTextHash) return item;
  }
  return null;
}
function targetPassages(index,source,targetText){
  var result=[],passages=index.passages,i,item;
  for(i=0;i<passages.length;i++){
    item=passages[i];
    if(item.sourceRef.sourceHash===source.sourceHash&&item.text===targetText) result.push(item);
  }
  return result;
}
function segmentAt(segments,locator){
  var i;
  for(i=0;i<segments.length;i++) if(sameLocator(segments[i].locator,locator)) return segments[i];
  return null;
}
function compactQualifier(value){
  if(value===null) return null;
  return {
    assessmentId:value.assessmentId,contentHash:value.contentHash,status:value.status,
    directionDomain:value.directionDomain,scopeDirection:value.scopeDirection,basis:value.basis,
    witness:value.witness?Canonical.deepCopy(value.witness):null
  };
}
function segmentView(segment){
  if(segment.text.length>MAX_EXCERPT_CODE_UNITS) fail('EXCERPT_TOO_LONG_FOR_VIEW','$.segment.text');
  return {
    text:segment.text,textHash:segment.textHash,sourceRef:Canonical.deepCopy(segment.sourceRef),
    locator:Canonical.deepCopy(segment.locator),segmentId:segment.segmentId,contentHash:segment.contentHash,
    alpha:segment.artifact.alpha,kind:segment.artifact.kind
  };
}
function proposalView(proposal,validation,targetSegment,passageSegment,witnessSegment){
  if(validation.status!=='VALID'||validation.validationScope!=='REFERENTIAL_REPLAY'||
     validation.referentialReplay!=='PERFORMED'||!validation.subjectRef||
     validation.subjectRef.proposalId!==proposal.proposalId||validation.subjectRef.contentHash!==proposal.contentHash){
    fail('BOUND_VALIDATION_REQUIRED','$.validation');
  }
  return {
    subjectRef:{schema:proposal.schema,proposalId:proposal.proposalId,contentHash:proposal.contentHash},
    relation:proposal.proposedRelation,direction:proposal.direction,basis:proposal.basis,
    target:segmentView(targetSegment),passage:segmentView(passageSegment),
    context:{
      sourceRef:Canonical.deepCopy(witnessSegment.sourceRef),locator:Canonical.deepCopy(witnessSegment.locator),
      textHash:witnessSegment.textHash,segmentId:witnessSegment.segmentId,contentHash:witnessSegment.contentHash
    },
    sourceSetRef:Canonical.deepCopy(proposal.sourceSetRef),
    pins:{
      queryHash:proposal.queryRef.contentHash,indexHash:proposal.indexRef.contentHash,
      linguisticIndexHash:proposal.linguisticIndexRef.linguisticIndexHash,
      lexicalIndexHash:proposal.linguisticIndexRef.lexicalIndexHash,
      lexiconHash:proposal.linguisticIndexRef.lexiconHash,
      patternSetHash:proposal.linguisticIndexRef.patternSetHash,
      evidenceCandidateHash:proposal.evidenceCandidateRef.contentHash,
      parserRef:Canonical.deepCopy(proposal.linguisticIndexRef.parserRef),
      alignerVersion:proposal.linguisticIndexRef.alignerVersion,
      qualifierRulesetHash:validation.validatorRef.qualifierDirectionRulesetHash,
      adapterVersion:validation.validatorRef.version,
      validatorVersion:validation.validatorRef.validatorVersion
    },
    qualifier:compactQualifier(proposal.qualifierDirectionAssessment),
    counts:{hitCount:proposal.hitRefs.length,contextCount:proposal.contextSpanRefs.length,sourceCount:proposal.sourceSetRef.sourceCount},
    validation:Canonical.deepCopy(validation),
    storedVerificationStatus:proposal.verificationStatus,
    relationStatus:proposal.relationStatus,reviewStatus:proposal.reviewStatus,
    finalRelation:proposal.finalRelation,soundness:proposal.soundness,
    sourceAuthority:validation.sourceAuthority,semanticTruth:false,commitAllowed:false,
    alphaTransitionReceipt:null
  };
}
function candidateOrder(left,right){
  var a=own.call(PROMOTABLE,left.proposedRelation)?PROMOTABLE[left.proposedRelation]:99;
  var b=own.call(PROMOTABLE,right.proposedRelation)?PROMOTABLE[right.proposedRelation]:99;
  return a-b||compareText(safeToken(left.candidateId,''),safeToken(right.candidateId,''));
}
function reasonCountsObject(){ return Object.create(null); }
function countReason(counts,code,amount){ counts[code]=(counts[code]||0)+(amount||1); }
function reasonList(counts){
  return Object.keys(counts).sort(compareText).map(function(code){ return {code:code,count:counts[code]}; });
}
function rejectionFor(candidate,code){
  return {
    candidateId:safeToken(candidate&&candidate.candidateId,'candidate:unavailable'),
    relation:safeToken(candidate&&candidate.proposedRelation,'NOT_COMPUTED'),
    code:safeToken(code,'PROJECTOR_REJECTED')
  };
}
function buildCandidate(candidate,index,targetText){
  var source,passage,targets,batch,targetSegment,passageSegment,witness,link,definition,validated,proposal,validation;
  source=sourceFor(index,candidate.sourceRef);
  if(!source) fail('SOURCE_SNAPSHOT_NOT_FOUND','$.candidate.sourceRef');
  if(Search.validateSourceSnapshot(source).status!=='VALID') fail('SOURCE_SNAPSHOT_INVALID','$.sourceSnapshot');
  passage=passageFor(index,candidate);
  if(!passage) fail('PASSAGE_NOT_FOUND','$.candidate.locator');
  targets=targetPassages(index,source,targetText);
  if(targets.length===0) fail('TARGET_NOT_IN_COMMON_SOURCE','$.targetText');
  if(targets.length!==1) fail('TARGET_OCCURRENCE_AMBIGUOUS','$.targetText');
  if(sameLocator(targets[0].locator,passage.locator)) fail('SELF_LINK_FORBIDDEN','$.candidate.locator');
  if(overlaps(targets[0].locator,passage.locator)) fail('SEGMENT_OVERLAP','$.candidate.locator');
  batch=Data7.createSegmentBatch(source,{
    alpha:0,
    locators:[
      {start:targets[0].locator.start,end:targets[0].locator.end,label:'Target claim'},
      {start:passage.locator.start,end:passage.locator.end,label:'Evidence passage'}
    ]
  });
  targetSegment=segmentAt(batch.segments,targets[0].locator);
  passageSegment=segmentAt(batch.segments,passage.locator);
  if(!targetSegment||!passageSegment) fail('SEGMENT_PROJECTION_FAILED','$.segments');
  witness=Data7.createSegmentBatch(source,{
    alpha:0,locators:[{start:0,end:source.text.length,label:'Exact source context'}]
  }).segments[0];
  link=Data7.createLinkCandidate(targetSegment,passageSegment,witness,{relation:'CO_OCCURS_WITH'});
  definition={
    linkCandidate:link,fromSegment:targetSegment,toSegment:passageSegment,witnessSegment:witness,
    sourceSnapshot:source,linguisticIndex:index,evidenceCandidate:candidate,replayConfig:REPLAY_CONFIG
  };
  validated=Adapter.createEvidenceBackedLinkWithValidation(definition);
  proposal=validated.proposal;
  validation=validated.validation;
  return proposalView(proposal,validation,targetSegment,passageSegment,witness);
}
function createModel(definition){
  var input=definition,index,result,candidates,eligible=[],proposals=[],rejections=[],rejectionCount=0;
  var skippedCount=0,reasons=reasonCountsObject(),scanCount,i,candidate,model,payload,indexReport;
  exactKeys(input,['targetText','cascadeResult','linguisticIndex'],'$');
  boundedText(input.targetText,'$.targetText',8192);
  if(input.targetText.trim()!==input.targetText) fail('TARGET_TEXT_NOT_TRIMMED','$.targetText');
  result=input.cascadeResult;
  index=input.linguisticIndex;
  if(!plain(result)||!Array.isArray(result.evidenceCandidates)) fail('CASCADE_RESULT_INVALID','$.cascadeResult');
  indexReport=Linguistic.validateIndex(index);
  if(!indexReport||indexReport.status!=='VALID') fail('LINGUISTIC_INDEX_INVALID','$.linguisticIndex',indexReport&&indexReport.code);
  if(result.sourceSetHash!==index.sourceSetHash||result.linguisticIndexHash!==index.linguisticIndexHash){
    if(result.evidenceCandidates.length!==0||own.call(result,'sourceSetHash')||own.call(result,'linguisticIndexHash')){
      fail('CASCADE_INDEX_REFERENCE_MISMATCH','$.cascadeResult');
    }
  }
  candidates=result.evidenceCandidates;
  scanCount=Math.min(candidates.length,MAX_SCAN_CANDIDATES);
  if(candidates.length>scanCount){ skippedCount+=candidates.length-scanCount; countReason(reasons,'INPUT_SCAN_CAP',candidates.length-scanCount); }
  for(i=0;i<scanCount;i++){
    candidate=candidates[i];
    if(!candidate||candidate.status!=='STRUCTURALLY_ALIGNED'){
      skippedCount++; countReason(reasons,'STRUCTURAL_ALIGNMENT_REQUIRED'); continue;
    }
    if(!own.call(PROMOTABLE,candidate.proposedRelation)){
      skippedCount++; countReason(reasons,'RELATION_NOT_PROMOTABLE'); continue;
    }
    eligible.push(candidate);
  }
  eligible.sort(candidateOrder);
  if(eligible.length>MAX_ATTEMPTS){
    skippedCount+=eligible.length-MAX_ATTEMPTS;
    countReason(reasons,'ATTEMPT_CAP',eligible.length-MAX_ATTEMPTS);
    eligible.length=MAX_ATTEMPTS;
  }
  for(i=0;i<eligible.length;i++){
    candidate=eligible[i];
    try{
      proposals.push(buildCandidate(candidate,index,input.targetText));
    }catch(error){
      rejectionCount++;
      countReason(reasons,error&&error.code||'PROJECTOR_REJECTED');
      if(rejections.length<MAX_REJECTIONS) rejections.push(rejectionFor(candidate,error&&error.code));
    }
  }
  model={
    schema:MODEL_SCHEMA,version:VERSION,operation:'PROJECT_EVIDENCE_BACKED_LINKS',
    status:proposals.length?'REPLAYED':'ABSTAIN',targetTextHash:Canonical.hashText(input.targetText),
    sourceAuthority:proposals.length?'UNVERIFIED':'NOT_ASSESSED',
    validationScope:proposals.length?'REFERENTIAL_REPLAY':'NOT_PERFORMED',
    referentialReplay:proposals.length?'PERFORMED':'NOT_PERFORMED',
    candidateCount:candidates.length,attemptedCount:eligible.length,proposalCount:proposals.length,
    rejectionCount:rejectionCount,skippedCount:skippedCount,
    proposals:proposals,rejections:rejections,skipReasons:reasonList(reasons),
    relationStatus:proposals.length?'PROPOSED':'NOT_COMPUTED',reviewStatus:'REQUIRES_REVIEW',
    finalRelation:'NOT_COMPUTED',soundness:'NOT_COMPUTED',semanticTruth:false,commitAllowed:false
  };
  payload=Canonical.deepCopy(model);
  payload.contentHash=Canonical.hashCanonical(payload);
  assertViewModel(payload);
  return freeze(payload);
}

function scanModel(value,path,state,ancestors){
  var names,keys,symbols,descriptor,i;
  state.values++;
  if(state.values>MAX_MODEL_VALUES) fail('MODEL_VALUE_BUDGET_EXCEEDED',path);
  if(value===null||typeof value==='boolean') return;
  if(typeof value==='string'){
    state.codeUnits+=value.length;
    if(state.codeUnits>MAX_MODEL_CODE_UNITS) fail('MODEL_TEXT_BUDGET_EXCEEDED',path);
    return;
  }
  if(typeof value==='number'){
    if(!Number.isFinite(value)) fail('NON_FINITE_NUMBER_FORBIDDEN',path);
    return;
  }
  if(typeof value!=='object') fail('NON_DATA_VALUE_FORBIDDEN',path);
  state.nodes++;
  if(state.nodes>MAX_MODEL_NODES) fail('MODEL_NODE_BUDGET_EXCEEDED',path);
  if(ancestors.length>=MAX_MODEL_DEPTH) fail('MODEL_DEPTH_EXCEEDED',path);
  if(ancestors.indexOf(value)!==-1) fail('CYCLIC_MODEL_FORBIDDEN',path);
  ancestors.push(value);
  symbols=Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(value):[];
  if(symbols.length) fail('SYMBOL_FIELD_FORBIDDEN',path);
  names=Object.getOwnPropertyNames(value);
  keys=Object.keys(value);
  if(Array.isArray(value)){
    if(names.length!==value.length+1) fail('ARRAY_PROPERTY_FORBIDDEN',path);
    for(i=0;i<value.length;i++){
      descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||descriptor.get||descriptor.set) fail('SPARSE_OR_ACCESSOR_ARRAY_FORBIDDEN',path+'['+i+']');
      scanModel(value[i],path+'['+i+']',state,ancestors);
    }
  }else{
    if(names.length!==keys.length||!Canonical.isPlainObject(value)) fail('PLAIN_DATA_OBJECT_REQUIRED',path);
    for(i=0;i<keys.length;i++){
      descriptor=Object.getOwnPropertyDescriptor(value,keys[i]);
      if(!descriptor||descriptor.get||descriptor.set) fail('ACCESSOR_FORBIDDEN',path+'.'+keys[i]);
      scanModel(value[keys[i]],path+'.'+keys[i],state,ancestors);
    }
  }
  ancestors.pop();
}
function assertSourceRef(value,path){
  exactKeys(value,['sourceId','revision','language','textHash','sourceHash'],path);
  boundedText(value.sourceId,path+'.sourceId',256); boundedText(value.revision,path+'.revision',128);
  boundedText(value.language,path+'.language',64); hash(value.textHash,path+'.textHash'); hash(value.sourceHash,path+'.sourceHash');
}
function assertLocator(value,path){
  exactKeys(value,['start','end'],path); integer(value.start,path+'.start',0); integer(value.end,path+'.end',1);
  if(value.end<=value.start) fail('LOCATOR_INVALID',path);
}
function assertSegmentView(value,path){
  exactKeys(value,['text','textHash','sourceRef','locator','segmentId','contentHash','alpha','kind'],path);
  boundedText(value.text,path+'.text',MAX_EXCERPT_CODE_UNITS); hash(value.textHash,path+'.textHash');
  if(Canonical.hashText(value.text)!==value.textHash) fail('TEXT_HASH_MISMATCH',path+'.textHash');
  assertSourceRef(value.sourceRef,path+'.sourceRef'); assertLocator(value.locator,path+'.locator');
  if(value.text.length!==value.locator.end-value.locator.start) fail('LOCATOR_TEXT_LENGTH_MISMATCH',path+'.locator');
  hash(value.segmentId,path+'.segmentId'); hash(value.contentHash,path+'.contentHash'); integer(value.alpha,path+'.alpha',-4,4); boundedText(value.kind,path+'.kind',64);
}
function assertReceiptBinding(value,receipt,path){
  var bundle,validator,qualifierHash;
  exactKeys(receipt,[
    'schema','version','status','code','path','subjectRef','validatorRef','evidenceBundleRef','validationScope',
    'referentialReplay','sourceAuthority','reviewStatus','semanticTruth','commitAllowed'
  ],path);
  if(receipt.schema!==Adapter.validationReportSchema||receipt.version!=='1.1.0'||receipt.status!=='VALID'||
     receipt.code!==null||receipt.path!==null||receipt.validationScope!=='REFERENTIAL_REPLAY'||
     receipt.referentialReplay!=='PERFORMED'||receipt.sourceAuthority!=='UNVERIFIED'){
    fail('REPLAY_BINDING_INVALID',path);
  }
  if(receipt.reviewStatus!=='REQUIRES_REVIEW'||receipt.semanticTruth!==false||receipt.commitAllowed!==false){
    fail('VALIDATION_AUTHORITY_BOUNDARY_VIOLATION',path);
  }
  exactKeys(receipt.subjectRef,['schema','proposalId','contentHash'],path+'.subjectRef');
  if(receipt.subjectRef.schema!==value.subjectRef.schema||receipt.subjectRef.proposalId!==value.subjectRef.proposalId||
     receipt.subjectRef.contentHash!==value.subjectRef.contentHash) fail('REPLAY_BINDING_INVALID',path+'.subjectRef');
  validator=receipt.validatorRef;
  exactKeys(validator,['schema','version','validatorVersion','qualifierDirectionRulesetHash'],path+'.validatorRef');
  if(validator.schema!==Adapter.schema||validator.version!==Adapter.version||validator.validatorVersion!==Adapter.validatorVersion||
     validator.version!==value.pins.adapterVersion||validator.validatorVersion!==value.pins.validatorVersion||
     validator.qualifierDirectionRulesetHash!==value.pins.qualifierRulesetHash){
    fail('VALIDATOR_BINDING_INVALID',path+'.validatorRef');
  }
  bundle=receipt.evidenceBundleRef;
  exactKeys(bundle,[
    'sourceSetHash','primarySourceHash','sourceCount','sourceRef','queryHash','indexHash','linguisticIndexHash',
    'lexicalIndexHash','lexiconHash','patternSetHash','parserRef','alignerVersion','evidenceCandidateHash',
    'targetSegmentHash','passageSegmentHash','contextSegmentHash','targetLocator','passageLocator','contextLocator',
    'targetTextHash','passageTextHash','proposedRelation','direction','basis','qualifierDirectionAssessmentHash',
    'hitCount','contextCount','storedVerificationStatus'
  ],path+'.evidenceBundleRef');
  assertSourceRef(bundle.sourceRef,path+'.evidenceBundleRef.sourceRef');
  assertLocator(bundle.targetLocator,path+'.evidenceBundleRef.targetLocator');
  assertLocator(bundle.passageLocator,path+'.evidenceBundleRef.passageLocator');
  assertLocator(bundle.contextLocator,path+'.evidenceBundleRef.contextLocator');
  ['sourceSetHash','primarySourceHash','queryHash','indexHash','linguisticIndexHash','lexicalIndexHash','lexiconHash',
   'patternSetHash','evidenceCandidateHash','targetSegmentHash','passageSegmentHash','contextSegmentHash','targetTextHash',
   'passageTextHash'].forEach(function(key){ hash(bundle[key],path+'.evidenceBundleRef.'+key); });
  if(bundle.qualifierDirectionAssessmentHash!==null) hash(bundle.qualifierDirectionAssessmentHash,path+'.evidenceBundleRef.qualifierDirectionAssessmentHash');
  exactKeys(bundle.parserRef,['id','version'],path+'.evidenceBundleRef.parserRef');
  boundedText(bundle.parserRef.id,path+'.evidenceBundleRef.parserRef.id',256);
  boundedText(bundle.parserRef.version,path+'.evidenceBundleRef.parserRef.version',64);
  boundedText(bundle.alignerVersion,path+'.evidenceBundleRef.alignerVersion',64);
  integer(bundle.sourceCount,path+'.evidenceBundleRef.sourceCount',1,64);
  integer(bundle.hitCount,path+'.evidenceBundleRef.hitCount',0,512);
  integer(bundle.contextCount,path+'.evidenceBundleRef.contextCount',0,512);
  qualifierHash=value.qualifier===null?null:value.qualifier&&value.qualifier.contentHash;
  if(bundle.sourceSetHash!==value.sourceSetRef.sourceSetHash||bundle.primarySourceHash!==value.sourceSetRef.primarySourceHash||
     bundle.sourceCount!==value.sourceSetRef.sourceCount||!sameFullSource(bundle.sourceRef,value.target.sourceRef)||
     !sameFullSource(bundle.sourceRef,value.passage.sourceRef)||!sameFullSource(bundle.sourceRef,value.context.sourceRef)||
     bundle.queryHash!==value.pins.queryHash||bundle.indexHash!==value.pins.indexHash||
     bundle.linguisticIndexHash!==value.pins.linguisticIndexHash||bundle.lexicalIndexHash!==value.pins.lexicalIndexHash||
     bundle.lexiconHash!==value.pins.lexiconHash||bundle.patternSetHash!==value.pins.patternSetHash||
     bundle.evidenceCandidateHash!==value.pins.evidenceCandidateHash||
     bundle.parserRef.id!==value.pins.parserRef.id||bundle.parserRef.version!==value.pins.parserRef.version||
     bundle.alignerVersion!==value.pins.alignerVersion||bundle.targetSegmentHash!==value.target.contentHash||
     bundle.passageSegmentHash!==value.passage.contentHash||bundle.contextSegmentHash!==value.context.contentHash||
     !sameLocator(bundle.targetLocator,value.target.locator)||!sameLocator(bundle.passageLocator,value.passage.locator)||
     !sameLocator(bundle.contextLocator,value.context.locator)||bundle.targetTextHash!==value.target.textHash||
     bundle.passageTextHash!==value.passage.textHash||bundle.proposedRelation!==value.relation||
     bundle.direction!==value.direction||bundle.basis!==value.basis||bundle.qualifierDirectionAssessmentHash!==qualifierHash||
     bundle.hitCount!==value.counts.hitCount||bundle.contextCount!==value.counts.contextCount||
     bundle.storedVerificationStatus!==value.storedVerificationStatus){
    fail('REPLAY_BUNDLE_BINDING_INVALID',path+'.evidenceBundleRef');
  }
}
function assertProposalView(value,path){
  var receipt=value.validation;
  exactKeys(value,[
    'subjectRef','relation','direction','basis','target','passage','context','sourceSetRef','pins','qualifier','counts',
    'validation','storedVerificationStatus','relationStatus','reviewStatus','finalRelation','soundness',
    'sourceAuthority','semanticTruth','commitAllowed','alphaTransitionReceipt'
  ],path);
  exactKeys(value.subjectRef,['schema','proposalId','contentHash'],path+'.subjectRef');
  if(value.subjectRef.schema!=='meridian.data7-evidence-backed-link-proposal/2') fail('SUBJECT_SCHEMA_INVALID',path+'.subjectRef.schema');
  hash(value.subjectRef.proposalId,path+'.subjectRef.proposalId'); hash(value.subjectRef.contentHash,path+'.subjectRef.contentHash');
  if(!own.call(PROMOTABLE,value.relation)||value.direction!=='PASSAGE_TO_TARGET') fail('RELATION_DIRECTION_INVALID',path+'.relation');
  boundedText(value.basis,path+'.basis',128); assertSegmentView(value.target,path+'.target'); assertSegmentView(value.passage,path+'.passage');
  if(!sameFullSource(value.target.sourceRef,value.passage.sourceRef)||sameLocator(value.target.locator,value.passage.locator)) fail('ENDPOINTS_INVALID',path);
  exactKeys(value.context,['sourceRef','locator','textHash','segmentId','contentHash'],path+'.context');
  assertSourceRef(value.context.sourceRef,path+'.context.sourceRef'); assertLocator(value.context.locator,path+'.context.locator');
  hash(value.context.textHash,path+'.context.textHash'); hash(value.context.segmentId,path+'.context.segmentId'); hash(value.context.contentHash,path+'.context.contentHash');
  if(!sameFullSource(value.context.sourceRef,value.target.sourceRef)||value.context.locator.start>Math.min(value.target.locator.start,value.passage.locator.start)||
     value.context.locator.end<Math.max(value.target.locator.end,value.passage.locator.end)) fail('CONTEXT_BOUNDARY_INVALID',path+'.context');
  exactKeys(value.sourceSetRef,['sourceSetHash','primarySourceHash','sourceCount'],path+'.sourceSetRef');
  hash(value.sourceSetRef.sourceSetHash,path+'.sourceSetRef.sourceSetHash'); hash(value.sourceSetRef.primarySourceHash,path+'.sourceSetRef.primarySourceHash');
  integer(value.sourceSetRef.sourceCount,path+'.sourceSetRef.sourceCount',1,64);
  if(value.sourceSetRef.primarySourceHash!==value.target.sourceRef.sourceHash) fail('PRIMARY_SOURCE_MISMATCH',path+'.sourceSetRef');
  if(!plain(value.pins)||!plain(value.counts)||!plain(receipt)) fail('PROPOSAL_SUMMARY_INVALID',path);
  exactKeys(value.pins,[
    'queryHash','indexHash','linguisticIndexHash','lexicalIndexHash','lexiconHash','patternSetHash','evidenceCandidateHash','parserRef',
    'alignerVersion','qualifierRulesetHash','adapterVersion','validatorVersion'
  ],path+'.pins');
  ['queryHash','indexHash','linguisticIndexHash','lexicalIndexHash','lexiconHash','patternSetHash','evidenceCandidateHash','qualifierRulesetHash'].forEach(function(key){ hash(value.pins[key],path+'.pins.'+key); });
  exactKeys(value.pins.parserRef,['id','version'],path+'.pins.parserRef');
  boundedText(value.pins.parserRef.id,path+'.pins.parserRef.id',256); boundedText(value.pins.parserRef.version,path+'.pins.parserRef.version',64);
  boundedText(value.pins.alignerVersion,path+'.pins.alignerVersion',64); boundedText(value.pins.adapterVersion,path+'.pins.adapterVersion',64);
  boundedText(value.pins.validatorVersion,path+'.pins.validatorVersion',128);
  assertReceiptBinding(value,receipt,path+'.validation');
  integer(value.counts.hitCount,path+'.counts.hitCount',0,512);
  integer(value.counts.contextCount,path+'.counts.contextCount',0,512);
  integer(value.counts.sourceCount,path+'.counts.sourceCount',1,64);
  if(value.counts.sourceCount!==value.sourceSetRef.sourceCount) fail('SOURCE_COUNT_MISMATCH',path+'.counts.sourceCount');
  if(value.storedVerificationStatus!=='REPLAY_REQUIRED'||value.relationStatus!=='PROPOSED'||
     value.reviewStatus!=='REQUIRES_REVIEW'||value.finalRelation!=='NOT_COMPUTED'||value.soundness!=='NOT_COMPUTED'||
     value.sourceAuthority!=='UNVERIFIED'||value.semanticTruth!==false||value.commitAllowed!==false||value.alphaTransitionReceipt!==null){
    fail('AUTHORITY_BOUNDARY_VIOLATION',path);
  }
  if(value.relation==='QUALIFIES'){
    if(!plain(value.qualifier)||value.qualifier.status!=='DIRECTED'||value.qualifier.scopeDirection!=='NARROWER'||!plain(value.qualifier.witness)) fail('QUALIFIER_DIRECTION_INVALID',path+'.qualifier');
    exactKeys(value.qualifier,['assessmentId','contentHash','status','directionDomain','scopeDirection','basis','witness'],path+'.qualifier');
    boundedText(value.qualifier.assessmentId,path+'.qualifier.assessmentId',256); hash(value.qualifier.contentHash,path+'.qualifier.contentHash');
    boundedText(value.qualifier.directionDomain,path+'.qualifier.directionDomain',128); boundedText(value.qualifier.basis,path+'.qualifier.basis',128);
    exactKeys(value.qualifier.witness,[
      'qualifiedSide','qualifierKey','markerToken','markerTokenIndex','valueTokenIndex','valueSurfaceSpanId','valueSenseId','qualifierValueHash'
    ],path+'.qualifier.witness');
    if(value.qualifier.witness.qualifiedSide!=='PASSAGE'||value.qualifier.witness.qualifierKey!=='method') fail('QUALIFIER_WITNESS_INVALID',path+'.qualifier.witness');
    hash(value.qualifier.witness.qualifierValueHash,path+'.qualifier.witness.qualifierValueHash');
  }else if(value.qualifier!==null) fail('QUALIFIER_UNEXPECTED',path+'.qualifier');
}
function assertViewModel(value){
  var payload,expected,i,totalReasons=0;
  scanModel(value,'$',{nodes:0,values:0,codeUnits:0},[]);
  exactKeys(value,[
    'schema','version','operation','status','targetTextHash','sourceAuthority','validationScope','referentialReplay',
    'candidateCount','attemptedCount','proposalCount','rejectionCount','skippedCount','proposals','rejections','skipReasons',
    'relationStatus','reviewStatus','finalRelation','soundness','semanticTruth','commitAllowed','contentHash'
  ],'$');
  if(value.schema!==MODEL_SCHEMA||value.version!==VERSION||value.operation!=='PROJECT_EVIDENCE_BACKED_LINKS') fail('MODEL_SCHEMA_INVALID','$.schema');
  if(value.status!=='REPLAYED'&&value.status!=='ABSTAIN') fail('MODEL_STATUS_INVALID','$.status');
  hash(value.targetTextHash,'$.targetTextHash'); hash(value.contentHash,'$.contentHash');
  integer(value.candidateCount,'$.candidateCount',0); integer(value.attemptedCount,'$.attemptedCount',0,MAX_ATTEMPTS);
  integer(value.proposalCount,'$.proposalCount',0,MAX_ATTEMPTS); integer(value.rejectionCount,'$.rejectionCount',0,MAX_ATTEMPTS);
  integer(value.skippedCount,'$.skippedCount',0);
  if(!Array.isArray(value.proposals)||value.proposals.length!==value.proposalCount||value.proposals.length>MAX_ATTEMPTS) fail('PROPOSAL_COUNT_MISMATCH','$.proposals');
  if(!Array.isArray(value.rejections)||value.rejections.length>MAX_REJECTIONS||value.rejections.length>value.rejectionCount) fail('REJECTION_COUNT_MISMATCH','$.rejections');
  if(!Array.isArray(value.skipReasons)||value.skipReasons.length>32) fail('SKIP_REASONS_INVALID','$.skipReasons');
  for(i=0;i<value.proposals.length;i++) assertProposalView(value.proposals[i],'$.proposals['+i+']');
  for(i=0;i<value.rejections.length;i++){
    exactKeys(value.rejections[i],['candidateId','relation','code'],'$.rejections['+i+']');
    boundedText(value.rejections[i].candidateId,'$.rejections['+i+'].candidateId',256);
    boundedText(value.rejections[i].relation,'$.rejections['+i+'].relation',64);
    boundedText(value.rejections[i].code,'$.rejections['+i+'].code',128);
  }
  for(i=0;i<value.skipReasons.length;i++){
    exactKeys(value.skipReasons[i],['code','count'],'$.skipReasons['+i+']');
    boundedText(value.skipReasons[i].code,'$.skipReasons['+i+'].code',128);
    integer(value.skipReasons[i].count,'$.skipReasons['+i+'].count',1);
    totalReasons+=value.skipReasons[i].count;
  }
  if(totalReasons!==value.rejectionCount+value.skippedCount) fail('REASON_COUNT_MISMATCH','$.skipReasons');
  if(value.reviewStatus!=='REQUIRES_REVIEW'||value.finalRelation!=='NOT_COMPUTED'||value.soundness!=='NOT_COMPUTED'||
     value.semanticTruth!==false||value.commitAllowed!==false) fail('MODEL_AUTHORITY_BOUNDARY_VIOLATION','$');
  if(value.proposalCount){
    if(value.status!=='REPLAYED'||value.sourceAuthority!=='UNVERIFIED'||value.validationScope!=='REFERENTIAL_REPLAY'||
       value.referentialReplay!=='PERFORMED'||value.relationStatus!=='PROPOSED') fail('MODEL_REPLAY_STATE_INVALID','$');
  }else if(value.status!=='ABSTAIN'||value.sourceAuthority!=='NOT_ASSESSED'||value.validationScope!=='NOT_PERFORMED'||
           value.referentialReplay!=='NOT_PERFORMED'||value.relationStatus!=='NOT_COMPUTED') fail('MODEL_ABSTAIN_STATE_INVALID','$');
  payload=Canonical.deepCopy(value);
  expected=payload.contentHash;
  delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expected) fail('MODEL_CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}
function inspectViewModel(value){
  try{ assertViewModel(value); return freeze({status:'VALID',code:null,path:null}); }
  catch(error){ return freeze({status:'INVALID',code:error&&error.code||'INVALID_MODEL',path:error&&error.path||'$'}); }
}
function snapshotViewModel(value){
  var snapshot;
  try{
    scanModel(value,'$',{nodes:0,values:0,codeUnits:0},[]);
    snapshot=Canonical.deepCopy(value);
    assertViewModel(snapshot);
    return freeze({status:'VALID',code:null,path:null,model:freeze(snapshot)});
  }catch(error){
    return freeze({status:'INVALID',code:error&&error.code||'INVALID_MODEL',path:error&&error.path||'$',model:null});
  }
}

global.MRDP78EvidenceBackedLinkProjector=freeze({
  version:VERSION,status:'READY',schema:'meridian.evidence-backed-link-projector/1',viewModelSchema:MODEL_SCHEMA,
  maxAttempts:MAX_ATTEMPTS,maxScanCandidates:MAX_SCAN_CANDIDATES,maxExcerptCodeUnits:MAX_EXCERPT_CODE_UNITS,
  replayConfig:REPLAY_CONFIG,sourceAuthority:'UNVERIFIED',reviewStatus:'REQUIRES_REVIEW',
  semanticTruth:false,commitAllowed:false,project:createModel,inspectViewModel:inspectViewModel,snapshotViewModel:snapshotViewModel
});
})(typeof globalThis!=='undefined'?globalThis:this);
