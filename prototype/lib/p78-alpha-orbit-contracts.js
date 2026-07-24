(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON||global.MRDP78CanonicalJson;

if(!Canonical){
  global.MRDP78AlphaOrbitContracts=Object.freeze({
    version:VERSION,
    status:'BLOCKED',
    code:'ALPHA_ORBIT_CANONICAL_DEPENDENCY_UNAVAILABLE',
    semanticTruth:false,
    commitAllowed:false
  });
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var ARTIFACT_SCHEMA='meridian.alpha-artifact/1';
var EDGE_SCHEMA='meridian.alpha-edge/1';
var RECEIPT_SCHEMA='meridian.alpha-transition-receipt/1';
var ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:@\/-]{0,255}$/;
var LANGUAGE_PATTERN=/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
var REASON_PATTERN=/^[A-Z][A-Z0-9_]*$/;
var VALIDATOR_PATTERN=/^[a-z][a-z0-9.-]*@[0-9]+\.[0-9]+\.[0-9]+$/;
var MAX_TEXT=100000;
var LEVELS=freeze([
  {alpha:4,kind:'ONTOLOGY'},
  {alpha:3,kind:'PHILOSOPHY'},
  {alpha:2,kind:'LAW'},
  {alpha:1,kind:'PRINCIPLE'},
  {alpha:0,kind:'CONCEPT'},
  {alpha:-1,kind:'SPECIFICATION'},
  {alpha:-2,kind:'TEMPLATE'},
  {alpha:-3,kind:'EXAMPLE'},
  {alpha:-4,kind:'CODE'}
]);
var KIND_TO_ALPHA=freeze({
  ONTOLOGY:4,PHILOSOPHY:3,LAW:2,PRINCIPLE:1,CONCEPT:0,
  SPECIFICATION:-1,TEMPLATE:-2,EXAMPLE:-3,CODE:-4
});
var ALPHA_TO_KIND=freeze({
  '4':'ONTOLOGY','3':'PHILOSOPHY','2':'LAW','1':'PRINCIPLE','0':'CONCEPT',
  '-1':'SPECIFICATION','-2':'TEMPLATE','-3':'EXAMPLE','-4':'CODE'
});
var OPERATIONS=freeze({
  GENERALIZE:true,SPECIALIZE:true,LINK:true,ORBIT:true,
  BRIDGE:true,PARK:true,ROLLBACK:true,ABSTAIN:true
});
var HORIZONTAL_RELATIONS=freeze({
  ASSOCIATES:true,USES:true,INCLUDES:true,DEPENDS_ON:true,
  SUPPORTS:true,REFUTES:true,QUALIFIES:true
});
var RADIAL_RELATIONS=freeze({
  GENERALIZES:true,SPECIALIZES:true,IMPLEMENTS:true,INSTANTIATES:true
});
var RELATIONS=freeze({
  GENERALIZES:true,SPECIALIZES:true,ASSOCIATES:true,USES:true,INCLUDES:true,
  DEPENDS_ON:true,SUPPORTS:true,REFUTES:true,QUALIFIES:true,
  IMPLEMENTS:true,INSTANTIATES:true
});
var AUTHORITIES=freeze({DRAFT:true,SOURCE_BACKED:true,REVIEWED:true,ABSTAIN:true});
var AUTHORITY_RANK=freeze({ABSTAIN:-1,DRAFT:0,SOURCE_BACKED:1,REVIEWED:2});
var EDGE_STATUSES=freeze({PROPOSED:true,REVIEWED:true,REJECTED:true});
var RECEIPT_STATUSES=freeze({READY:true,PARKED:true,ROLLED_BACK:true,ABSTAIN:true});
var FORBIDDEN_AUTHORITY=freeze({
  truth:true,truthStatus:true,factualStatus:true,entailment:true,
  accepted:true,acceptedEvidence:true,finalRelation:true,finalClaimStatus:true,
  commit:true,authorized:true
});

function fail(code,path,detail){
  var error=new TypeError(code+(path?' at '+path:'')+(detail?': '+detail:''));
  error.name='P78AlphaOrbitContractError';
  error.code=code;
  error.path=path||'$';
  throw error;
}

function object(value,path){
  var names,keys,symbols,i,descriptor;
  if(!value||typeof value!=='object'||Array.isArray(value)) fail('OBJECT_REQUIRED',path);
  symbols=Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(value):[];
  if(symbols.length) fail('SYMBOL_FIELD_FORBIDDEN',path);
  names=Object.getOwnPropertyNames(value);
  keys=Object.keys(value);
  if(names.length!==keys.length) fail('NON_ENUMERABLE_FIELD_FORBIDDEN',path);
  for(i=0;i<keys.length;i++){
    descriptor=Object.getOwnPropertyDescriptor(value,keys[i]);
    if(!descriptor||descriptor.get||descriptor.set) fail('ACCESSOR_FORBIDDEN',path+'.'+keys[i]);
  }
  if(!Canonical.isPlainObject(value)) fail('OBJECT_REQUIRED',path);
  return value;
}

function exactKeys(value,keys,path){
  var allowed={},actual=Object.keys(value),i,key;
  for(i=0;i<keys.length;i++) allowed[keys[i]]=true;
  for(i=0;i<actual.length;i++){
    key=actual[i];
    if(FORBIDDEN_AUTHORITY[key]) fail('AUTHORITY_FIELD_FORBIDDEN',path+'.'+key);
    if(!allowed[key]) fail('UNKNOWN_FIELD',path+'.'+key);
  }
  for(i=0;i<keys.length;i++) if(!own.call(value,keys[i])) fail('MISSING_FIELD',path+'.'+keys[i]);
}

function text(value,path,max,pattern){
  if(typeof value!=='string'||!value.length||value.trim()!==value) fail('NON_EMPTY_TRIMMED_STRING_REQUIRED',path);
  if(value.length>(max||MAX_TEXT)) fail('STRING_TOO_LONG',path);
  if(pattern&&!pattern.test(value)) fail('STRING_FORMAT_INVALID',path);
  return value;
}

function hash(value,path){
  if(!Canonical.isSha256(value)) fail('HASH_REQUIRED',path);
  return value;
}

function enumValue(value,values,path){
  if(typeof value!=='string'||!own.call(values,value)) fail('ENUM_VALUE_INVALID',path,String(value));
  return value;
}

function alphaValue(value,path){
  if(!Number.isInteger(value)||value<-4||value>4) fail('ALPHA_OUT_OF_RANGE',path,String(value));
  return value;
}

function finiteNumber(value,path){
  if(typeof value!=='number'||!Number.isFinite(value)) fail('FINITE_NUMBER_REQUIRED',path);
  return value;
}

function arrayShape(value,path){
  var names,symbols,i,descriptor;
  if(!Array.isArray(value)) fail('ARRAY_REQUIRED',path);
  symbols=Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(value):[];
  if(symbols.length) fail('ARRAY_SYMBOL_FIELD_FORBIDDEN',path);
  names=Object.getOwnPropertyNames(value);
  if(names.length!==value.length+1) fail('ARRAY_PROPERTY_FORBIDDEN',path);
  for(i=0;i<value.length;i++){
    descriptor=Object.getOwnPropertyDescriptor(value,String(i));
    if(!descriptor||descriptor.get||descriptor.set) fail('SPARSE_OR_ACCESSOR_ARRAY_FORBIDDEN',path+'['+i+']');
  }
  return value;
}

function stringArray(value,path,pattern){
  var copy,i;
  arrayShape(value,path);
  copy=value.slice();
  for(i=0;i<copy.length;i++){
    text(copy[i],path+'['+i+']',256,pattern);
    if(i&&copy[i-1]>=copy[i]) fail('ARRAY_NOT_SORTED_UNIQUE',path);
  }
  return copy;
}

function hashArray(value,path){
  var copy=stringArray(value,path),i;
  for(i=0;i<copy.length;i++) hash(copy[i],path+'['+i+']');
  return copy;
}

function containsAll(superset,subset){
  var i;
  for(i=0;i<subset.length;i++) if(superset.indexOf(subset[i])===-1) return false;
  return true;
}

function sameArray(left,right){
  var i;
  if(left.length!==right.length) return false;
  for(i=0;i<left.length;i++) if(left[i]!==right[i]) return false;
  return true;
}

function validationReport(assertion,value,a,b){
  try{
    assertion(value,a,b);
    return freeze({status:'VALID',code:null,path:null});
  }catch(error){
    return freeze({status:'INVALID',code:error&&error.code||'INVALID_VALUE',path:error&&error.path||'$'});
  }
}

function kindForAlpha(value){
  alphaValue(value,'$.alpha');
  return ALPHA_TO_KIND[String(value)];
}

function alphaForKind(value){
  enumValue(value,KIND_TO_ALPHA,'$.kind');
  return KIND_TO_ALPHA[value];
}

function radiusForAlpha(value,rInner,rOuter){
  var alpha=alphaValue(value,'$.alpha');
  finiteNumber(rInner,'$.rInner');
  finiteNumber(rOuter,'$.rOuter');
  if(rInner<=0||rOuter<=rInner) fail('SAFE_ANNULUS_INVALID','$');
  return rInner+((4-alpha)/8)*(rOuter-rInner);
}

function alphaForRadius(radius,rInner,rOuter){
  var raw;
  finiteNumber(radius,'$.radius');
  finiteNumber(rInner,'$.rInner');
  finiteNumber(rOuter,'$.rOuter');
  if(rInner<=0||rOuter<=rInner) fail('SAFE_ANNULUS_INVALID','$');
  if(radius<rInner||radius>rOuter) fail('RADIUS_OUTSIDE_SAFE_ANNULUS','$.radius');
  raw=Math.round(4-8*(radius-rInner)/(rOuter-rInner));
  return alphaValue(raw,'$.alpha');
}

function artifactInput(raw,path){
  var value=object(raw,path),claimRefs,sourceRefs,parentRefs,childRefs,horizontalRefs,qualifiers,kind,alpha,authority;
  exactKeys(value,[
    'alpha','kind','title','body','language','claimRefs','sourceRefs',
    'parentRefs','childRefs','horizontalRefs','qualifiers','authority'
  ],path);
  alpha=alphaValue(value.alpha,path+'.alpha');
  kind=enumValue(value.kind,KIND_TO_ALPHA,path+'.kind');
  if(KIND_TO_ALPHA[kind]!==alpha) fail('ALPHA_KIND_MISMATCH',path+'.alpha');
  claimRefs=hashArray(value.claimRefs,path+'.claimRefs');
  sourceRefs=hashArray(value.sourceRefs,path+'.sourceRefs');
  parentRefs=hashArray(value.parentRefs,path+'.parentRefs');
  childRefs=hashArray(value.childRefs,path+'.childRefs');
  horizontalRefs=hashArray(value.horizontalRefs,path+'.horizontalRefs');
  qualifiers=stringArray(value.qualifiers,path+'.qualifiers');
  authority=enumValue(value.authority,AUTHORITIES,path+'.authority');
  if((authority==='SOURCE_BACKED'||authority==='REVIEWED')&&(!claimRefs.length||!sourceRefs.length)){
    fail('SOURCE_BACKED_REFS_REQUIRED',path+'.authority');
  }
  return {
    alpha:alpha,
    kind:kind,
    title:text(value.title,path+'.title',256),
    body:text(value.body,path+'.body',MAX_TEXT),
    language:text(value.language,path+'.language',32,LANGUAGE_PATTERN),
    claimRefs:claimRefs,
    sourceRefs:sourceRefs,
    parentRefs:parentRefs,
    childRefs:childRefs,
    horizontalRefs:horizontalRefs,
    qualifiers:qualifiers,
    authority:authority
  };
}

function createArtifact(raw){
  var input=artifactInput(raw,'$'),identity,payload;
  identity={
    schema:ARTIFACT_SCHEMA,
    version:VERSION,
    alpha:input.alpha,
    kind:input.kind,
    title:input.title,
    body:input.body,
    language:input.language,
    claimRefs:input.claimRefs,
    sourceRefs:input.sourceRefs,
    parentRefs:input.parentRefs,
    childRefs:input.childRefs,
    horizontalRefs:input.horizontalRefs,
    qualifiers:input.qualifiers,
    authority:input.authority,
    semanticTruth:false,
    soundness:'NOT_COMPUTED'
  };
  payload=Canonical.deepCopy(identity);
  payload.artifactId=Canonical.hashCanonical(identity);
  payload.contentHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function assertArtifact(value){
  var identity,payload,expectedId,expectedHash,input;
  object(value,'$');
  exactKeys(value,[
    'schema','version','alpha','kind','title','body','language','claimRefs','sourceRefs',
    'parentRefs','childRefs','horizontalRefs','qualifiers','authority',
    'semanticTruth','soundness','artifactId','contentHash'
  ],'$');
  if(value.schema!==ARTIFACT_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  input=artifactInput({
    alpha:value.alpha,kind:value.kind,title:value.title,body:value.body,language:value.language,
    claimRefs:value.claimRefs,sourceRefs:value.sourceRefs,parentRefs:value.parentRefs,
    childRefs:value.childRefs,horizontalRefs:value.horizontalRefs,qualifiers:value.qualifiers,
    authority:value.authority
  },'$');
  if(value.semanticTruth!==false) fail('SEMANTIC_TRUTH_FORBIDDEN','$.semanticTruth');
  if(value.soundness!=='NOT_COMPUTED') fail('SOUNDNESS_BOUNDARY_VIOLATION','$.soundness');
  hash(value.artifactId,'$.artifactId');
  hash(value.contentHash,'$.contentHash');
  identity={
    schema:value.schema,version:value.version,alpha:input.alpha,kind:input.kind,
    title:input.title,body:input.body,language:input.language,claimRefs:input.claimRefs,
    sourceRefs:input.sourceRefs,parentRefs:input.parentRefs,childRefs:input.childRefs,
    horizontalRefs:input.horizontalRefs,qualifiers:input.qualifiers,authority:input.authority,
    semanticTruth:value.semanticTruth,soundness:value.soundness
  };
  expectedId=Canonical.hashCanonical(identity);
  if(value.artifactId!==expectedId) fail('ARTIFACT_ID_MISMATCH','$.artifactId');
  payload=Canonical.deepCopy(value);
  expectedHash=payload.contentHash;
  delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}

function artifactRef(value,path){
  assertArtifact(value);
  return {
    artifactId:value.artifactId,
    contentHash:value.contentHash,
    alpha:value.alpha,
    kind:value.kind
  };
}

function assertArtifactRef(value,path){
  object(value,path);
  exactKeys(value,['artifactId','contentHash','alpha','kind'],path);
  hash(value.artifactId,path+'.artifactId');
  hash(value.contentHash,path+'.contentHash');
  alphaValue(value.alpha,path+'.alpha');
  enumValue(value.kind,KIND_TO_ALPHA,path+'.kind');
  if(KIND_TO_ALPHA[value.kind]!==value.alpha) fail('ALPHA_KIND_MISMATCH',path+'.alpha');
}

function assertEdgeRelation(fromAlpha,toAlpha,relation,path){
  if(HORIZONTAL_RELATIONS[relation]){
    if(fromAlpha!==toAlpha) fail('HORIZONTAL_ALPHA_MISMATCH',path);
    return;
  }
  if(relation==='GENERALIZES'){
    if(toAlpha!==fromAlpha+1) fail('GENERALIZE_ALPHA_STEP_INVALID',path);
    return;
  }
  if(relation==='SPECIALIZES'){
    if(toAlpha!==fromAlpha-1) fail('SPECIALIZE_ALPHA_STEP_INVALID',path);
    return;
  }
  if(relation==='IMPLEMENTS'||relation==='INSTANTIATES'){
    if(fromAlpha>=toAlpha) fail('IMPLEMENTATION_DIRECTION_INVALID',path);
    return;
  }
  fail('ENUM_VALUE_INVALID',path,String(relation));
}

function createEdge(fromArtifact,toArtifact,raw){
  var from=artifactRef(fromArtifact,'$.fromArtifact'),to=artifactRef(toArtifact,'$.toArtifact');
  var value=object(raw,'$'),relation,sourceRefs,status,identity,payload;
  exactKeys(value,['relation','sourceRefs','status'],'$');
  if(from.artifactId===to.artifactId) fail('SELF_EDGE_FORBIDDEN','$.toArtifact');
  relation=enumValue(value.relation,RELATIONS,'$.relation');
  sourceRefs=hashArray(value.sourceRefs,'$.sourceRefs');
  status=enumValue(value.status,EDGE_STATUSES,'$.status');
  if(status==='REVIEWED'&&!sourceRefs.length) fail('REVIEWED_EDGE_SOURCE_REQUIRED','$.sourceRefs');
  assertEdgeRelation(from.alpha,to.alpha,relation,'$.relation');
  identity={
    schema:EDGE_SCHEMA,version:VERSION,fromRef:from,toRef:to,relation:relation,
    sourceRefs:sourceRefs,status:status,semanticTruth:false,soundness:'NOT_COMPUTED'
  };
  payload=Canonical.deepCopy(identity);
  payload.edgeId=Canonical.hashCanonical(identity);
  payload.contentHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function assertEdge(value){
  var payload,expectedHash,identity,expectedId;
  object(value,'$');
  exactKeys(value,[
    'schema','version','fromRef','toRef','relation','sourceRefs','status',
    'semanticTruth','soundness','edgeId','contentHash'
  ],'$');
  if(value.schema!==EDGE_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  assertArtifactRef(value.fromRef,'$.fromRef');
  assertArtifactRef(value.toRef,'$.toRef');
  if(value.fromRef.artifactId===value.toRef.artifactId) fail('SELF_EDGE_FORBIDDEN','$.toRef');
  enumValue(value.relation,RELATIONS,'$.relation');
  hashArray(value.sourceRefs,'$.sourceRefs');
  enumValue(value.status,EDGE_STATUSES,'$.status');
  if(value.status==='REVIEWED'&&!value.sourceRefs.length) fail('REVIEWED_EDGE_SOURCE_REQUIRED','$.sourceRefs');
  assertEdgeRelation(value.fromRef.alpha,value.toRef.alpha,value.relation,'$.relation');
  if(value.semanticTruth!==false) fail('SEMANTIC_TRUTH_FORBIDDEN','$.semanticTruth');
  if(value.soundness!=='NOT_COMPUTED') fail('SOUNDNESS_BOUNDARY_VIOLATION','$.soundness');
  hash(value.edgeId,'$.edgeId');
  hash(value.contentHash,'$.contentHash');
  identity=Canonical.deepCopy(value);
  delete identity.edgeId;
  delete identity.contentHash;
  expectedId=Canonical.hashCanonical(identity);
  if(value.edgeId!==expectedId) fail('EDGE_ID_MISMATCH','$.edgeId');
  payload=Canonical.deepCopy(value);
  expectedHash=payload.contentHash;
  delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}

function assertEdgeAgainst(value,fromArtifact,toArtifact){
  var expected;
  assertEdge(value);
  expected=createEdge(fromArtifact,toArtifact,{
    relation:value.relation,sourceRefs:value.sourceRefs,status:value.status
  });
  if(expected.contentHash!==value.contentHash) fail('EDGE_ARTIFACT_REF_MISMATCH','$');
  return true;
}

function witnesses(value,path){
  var copy=[],i,item,key,previousKey=null;
  arrayShape(value,path);
  for(i=0;i<value.length;i++){
    item=object(value[i],path+'['+i+']');
    exactKeys(item,['alpha','artifactRef'],path+'['+i+']');
    copy.push({
      alpha:alphaValue(item.alpha,path+'['+i+'].alpha'),
      artifactRef:hash(item.artifactRef,path+'['+i+'].artifactRef')
    });
    key=String(copy[i].alpha+4).padStart(2,'0')+'|'+copy[i].artifactRef;
    if(previousKey!==null&&previousKey>=key) fail('WITNESSES_NOT_SORTED_UNIQUE',path);
    previousKey=key;
  }
  return copy;
}

function expectedBridgeAlphas(fromAlpha,toAlpha){
  var result=[],low=Math.min(fromAlpha,toAlpha),high=Math.max(fromAlpha,toAlpha),i;
  for(i=low+1;i<high;i++) result.push(i);
  return result;
}

function receiptStatus(operation){
  if(operation==='PARK') return 'PARKED';
  if(operation==='ABSTAIN') return 'ABSTAIN';
  if(operation==='ROLLBACK') return 'ROLLED_BACK';
  return 'READY';
}

function transitionInput(raw){
  var value=object(raw,'$');
  exactKeys(value,[
    'operation','relation','coverageRefs','witnesses','reasonCodes',
    'validatorVersions','priorReceiptRef'
  ],'$');
  if(value.relation!==null) enumValue(value.relation,RELATIONS,'$.relation');
  if(value.priorReceiptRef!==null) hash(value.priorReceiptRef,'$.priorReceiptRef');
  return {
    operation:enumValue(value.operation,OPERATIONS,'$.operation'),
    relation:value.relation,
    coverageRefs:hashArray(value.coverageRefs,'$.coverageRefs'),
    witnesses:witnesses(value.witnesses,'$.witnesses'),
    reasonCodes:stringArray(value.reasonCodes,'$.reasonCodes',REASON_PATTERN),
    validatorVersions:stringArray(value.validatorVersions,'$.validatorVersions',VALIDATOR_PATTERN),
    priorReceiptRef:value.priorReceiptRef
  };
}

function requireArtifactAfter(after,operation){
  if(!after) fail('AFTER_ARTIFACT_REQUIRED','$.afterArtifact',operation);
}

function requirePreservation(before,after,input){
  if(!sameArray(input.coverageRefs,before.claimRefs)) fail('CLAIM_COVERAGE_INCOMPLETE','$.coverageRefs');
  if(!containsAll(after.claimRefs,before.claimRefs)) fail('CLAIM_REFERENCE_LOSS','$.afterArtifact.claimRefs');
  if(!containsAll(after.sourceRefs,before.sourceRefs)) fail('SOURCE_PROVENANCE_LOSS','$.afterArtifact.sourceRefs');
  if(!containsAll(after.qualifiers,before.qualifiers)) fail('QUALIFIER_LOSS','$.afterArtifact.qualifiers');
  if(AUTHORITY_RANK[after.authority]>AUTHORITY_RANK[before.authority]) fail('AUTHORITY_ESCALATION_FORBIDDEN','$.afterArtifact.authority');
}

function assertTransitionGate(before,after,input){
  var operation=input.operation,delta,expected,actual,i;
  if(!input.validatorVersions.length) fail('VALIDATOR_VERSION_REQUIRED','$.validatorVersions');
  if(operation==='PARK'||operation==='ABSTAIN'){
    if(after!==null) fail('AFTER_ARTIFACT_FORBIDDEN','$.afterArtifact');
    if(input.relation!==null) fail('RELATION_FORBIDDEN','$.relation');
    if(input.coverageRefs.length||input.witnesses.length) fail('TRANSITION_PAYLOAD_FORBIDDEN','$');
    if(!input.reasonCodes.length) fail('REASON_CODE_REQUIRED','$.reasonCodes');
    if(input.priorReceiptRef!==null) fail('PRIOR_RECEIPT_FORBIDDEN','$.priorReceiptRef');
    return;
  }
  requireArtifactAfter(after,operation);
  delta=after.alpha-before.alpha;
  if(operation==='ROLLBACK'){
    if(input.relation!==null) fail('RELATION_FORBIDDEN','$.relation');
    if(input.coverageRefs.length||input.witnesses.length) fail('TRANSITION_PAYLOAD_FORBIDDEN','$');
    if(!input.reasonCodes.length) fail('REASON_CODE_REQUIRED','$.reasonCodes');
    if(input.priorReceiptRef===null) fail('PRIOR_RECEIPT_REQUIRED','$.priorReceiptRef');
    return;
  }
  if(input.reasonCodes.length) fail('READY_REASON_CODES_FORBIDDEN','$.reasonCodes');
  if(input.priorReceiptRef!==null) fail('PRIOR_RECEIPT_FORBIDDEN','$.priorReceiptRef');
  if(operation==='GENERALIZE'){
    if(before.alpha===4) fail('INNER_GUARD_REACHED','$.beforeArtifact.alpha');
    if(delta!==1) fail('GENERALIZE_ALPHA_STEP_INVALID','$.afterArtifact.alpha');
    if(input.relation!=='GENERALIZES') fail('TRANSITION_RELATION_INVALID','$.relation');
    requirePreservation(before,after,input);
    return;
  }
  if(operation==='SPECIALIZE'){
    if(before.alpha===-4) fail('OUTER_GUARD_REACHED','$.beforeArtifact.alpha');
    if(delta!==-1) fail('SPECIALIZE_ALPHA_STEP_INVALID','$.afterArtifact.alpha');
    if(input.relation!=='SPECIALIZES') fail('TRANSITION_RELATION_INVALID','$.relation');
    requirePreservation(before,after,input);
    return;
  }
  if(operation==='LINK'){
    if(delta!==0) fail('HORIZONTAL_ALPHA_MISMATCH','$.afterArtifact.alpha');
    if(!input.relation||!HORIZONTAL_RELATIONS[input.relation]) fail('HORIZONTAL_RELATION_REQUIRED','$.relation');
    if(before.artifactId===after.artifactId) fail('SELF_EDGE_FORBIDDEN','$.afterArtifact');
    if(!input.witnesses.length) fail('LINK_WITNESS_REQUIRED','$.witnesses');
    for(i=0;i<input.witnesses.length;i++) if(input.witnesses[i].alpha!==before.alpha) fail('LINK_WITNESS_ALPHA_MISMATCH','$.witnesses['+i+'].alpha');
    if(input.coverageRefs.length) fail('CLAIM_COVERAGE_FORBIDDEN','$.coverageRefs');
    return;
  }
  if(operation==='ORBIT'){
    if(delta!==0||before.kind!==after.kind) fail('ORBIT_ALPHA_KIND_MISMATCH','$.afterArtifact.alpha');
    if(!input.relation||!HORIZONTAL_RELATIONS[input.relation]) fail('HORIZONTAL_RELATION_REQUIRED','$.relation');
    if(before.artifactId===after.artifactId) fail('ORBIT_PROGRESS_REQUIRED','$.afterArtifact');
    requirePreservation(before,after,input);
    return;
  }
  if(operation==='BRIDGE'){
    if(Math.abs(delta)<2) fail('BRIDGE_DISTANCE_TOO_SHORT','$.afterArtifact.alpha');
    if(delta>0&&input.relation!=='GENERALIZES') fail('TRANSITION_RELATION_INVALID','$.relation');
    if(delta<0&&input.relation!=='SPECIALIZES') fail('TRANSITION_RELATION_INVALID','$.relation');
    expected=expectedBridgeAlphas(before.alpha,after.alpha);
    actual=input.witnesses.map(function(item){ return item.alpha; });
    if(!sameArray(actual,expected)) fail('BRIDGE_WITNESS_CHAIN_INCOMPLETE','$.witnesses');
    for(i=0;i<input.witnesses.length;i++) hash(input.witnesses[i].artifactRef,'$.witnesses['+i+'].artifactRef');
    requirePreservation(before,after,input);
    return;
  }
  fail('ENUM_VALUE_INVALID','$.operation',operation);
}

function createTransitionReceipt(beforeArtifact,afterArtifact,raw){
  var before=beforeArtifact,after=afterArtifact===null?null:afterArtifact;
  var input=transitionInput(raw),identity,payload;
  assertArtifact(before);
  if(after!==null) assertArtifact(after);
  assertTransitionGate(before,after,input);
  identity={
    schema:RECEIPT_SCHEMA,
    version:VERSION,
    operation:input.operation,
    status:receiptStatus(input.operation),
    beforeRef:artifactRef(before,'$.beforeArtifact'),
    afterRef:after===null?null:artifactRef(after,'$.afterArtifact'),
    relation:input.relation,
    coverageRefs:input.coverageRefs,
    witnesses:input.witnesses,
    reasonCodes:input.reasonCodes,
    validatorVersions:input.validatorVersions,
    priorReceiptRef:input.priorReceiptRef,
    authority:'STRUCTURAL_ONLY',
    evidenceLevel:'STRUCTURAL',
    soundness:'NOT_COMPUTED',
    semanticTruth:false,
    commitAllowed:false
  };
  payload=Canonical.deepCopy(identity);
  payload.receiptId=Canonical.hashCanonical(identity);
  payload.contentHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function assertReceiptShapeGate(before,after,input){
  var operation=input.operation,delta,expected,i;
  if(!input.validatorVersions.length) fail('VALIDATOR_VERSION_REQUIRED','$.validatorVersions');
  if(operation==='PARK'||operation==='ABSTAIN'){
    if(after!==null) fail('AFTER_ARTIFACT_FORBIDDEN','$.afterRef');
    if(input.relation!==null) fail('RELATION_FORBIDDEN','$.relation');
    if(input.coverageRefs.length||input.witnesses.length) fail('TRANSITION_PAYLOAD_FORBIDDEN','$');
    if(!input.reasonCodes.length) fail('REASON_CODE_REQUIRED','$.reasonCodes');
    if(input.priorReceiptRef!==null) fail('PRIOR_RECEIPT_FORBIDDEN','$.priorReceiptRef');
    return;
  }
  if(after===null) fail('AFTER_ARTIFACT_REQUIRED','$.afterRef');
  delta=after.alpha-before.alpha;
  if(operation==='ROLLBACK'){
    if(input.relation!==null) fail('RELATION_FORBIDDEN','$.relation');
    if(input.coverageRefs.length||input.witnesses.length) fail('TRANSITION_PAYLOAD_FORBIDDEN','$');
    if(!input.reasonCodes.length) fail('REASON_CODE_REQUIRED','$.reasonCodes');
    if(input.priorReceiptRef===null) fail('PRIOR_RECEIPT_REQUIRED','$.priorReceiptRef');
    return;
  }
  if(input.reasonCodes.length) fail('READY_REASON_CODES_FORBIDDEN','$.reasonCodes');
  if(input.priorReceiptRef!==null) fail('PRIOR_RECEIPT_FORBIDDEN','$.priorReceiptRef');
  if(operation==='GENERALIZE'){
    if(before.alpha===4) fail('INNER_GUARD_REACHED','$.beforeRef.alpha');
    if(delta!==1) fail('GENERALIZE_ALPHA_STEP_INVALID','$.afterRef.alpha');
    if(input.relation!=='GENERALIZES') fail('TRANSITION_RELATION_INVALID','$.relation');
    return;
  }
  if(operation==='SPECIALIZE'){
    if(before.alpha===-4) fail('OUTER_GUARD_REACHED','$.beforeRef.alpha');
    if(delta!==-1) fail('SPECIALIZE_ALPHA_STEP_INVALID','$.afterRef.alpha');
    if(input.relation!=='SPECIALIZES') fail('TRANSITION_RELATION_INVALID','$.relation');
    return;
  }
  if(operation==='LINK'){
    if(delta!==0) fail('HORIZONTAL_ALPHA_MISMATCH','$.afterRef.alpha');
    if(!input.relation||!HORIZONTAL_RELATIONS[input.relation]) fail('HORIZONTAL_RELATION_REQUIRED','$.relation');
    if(before.artifactId===after.artifactId) fail('SELF_EDGE_FORBIDDEN','$.afterRef');
    if(!input.witnesses.length) fail('LINK_WITNESS_REQUIRED','$.witnesses');
    for(i=0;i<input.witnesses.length;i++) if(input.witnesses[i].alpha!==before.alpha) fail('LINK_WITNESS_ALPHA_MISMATCH','$.witnesses['+i+'].alpha');
    if(input.coverageRefs.length) fail('CLAIM_COVERAGE_FORBIDDEN','$.coverageRefs');
    return;
  }
  if(operation==='ORBIT'){
    if(delta!==0||before.kind!==after.kind) fail('ORBIT_ALPHA_KIND_MISMATCH','$.afterRef.alpha');
    if(!input.relation||!HORIZONTAL_RELATIONS[input.relation]) fail('HORIZONTAL_RELATION_REQUIRED','$.relation');
    if(before.artifactId===after.artifactId) fail('ORBIT_PROGRESS_REQUIRED','$.afterRef');
    return;
  }
  if(operation==='BRIDGE'){
    if(Math.abs(delta)<2) fail('BRIDGE_DISTANCE_TOO_SHORT','$.afterRef.alpha');
    if(delta>0&&input.relation!=='GENERALIZES') fail('TRANSITION_RELATION_INVALID','$.relation');
    if(delta<0&&input.relation!=='SPECIALIZES') fail('TRANSITION_RELATION_INVALID','$.relation');
    expected=expectedBridgeAlphas(before.alpha,after.alpha);
    if(!sameArray(input.witnesses.map(function(item){ return item.alpha; }),expected)) fail('BRIDGE_WITNESS_CHAIN_INCOMPLETE','$.witnesses');
    return;
  }
  fail('ENUM_VALUE_INVALID','$.operation',operation);
}

function assertReceipt(value){
  var identity,payload,expectedId,expectedHash,input,before,after;
  object(value,'$');
  exactKeys(value,[
    'schema','version','operation','status','beforeRef','afterRef','relation','coverageRefs',
    'witnesses','reasonCodes','validatorVersions','priorReceiptRef','authority','evidenceLevel',
    'soundness','semanticTruth','commitAllowed','receiptId','contentHash'
  ],'$');
  if(value.schema!==RECEIPT_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  enumValue(value.operation,OPERATIONS,'$.operation');

  enumValue(value.status,RECEIPT_STATUSES,'$.status');
  if(value.status!==receiptStatus(value.operation)) fail('RECEIPT_STATUS_MISMATCH','$.status');
  assertArtifactRef(value.beforeRef,'$.beforeRef');
  if(value.afterRef!==null) assertArtifactRef(value.afterRef,'$.afterRef');
  input=transitionInput({
    operation:value.operation,relation:value.relation,coverageRefs:value.coverageRefs,
    witnesses:value.witnesses,reasonCodes:value.reasonCodes,
    validatorVersions:value.validatorVersions,priorReceiptRef:value.priorReceiptRef
  });
  assertReceiptShapeGate(value.beforeRef,value.afterRef,input);
  before={
    alpha:value.beforeRef.alpha,kind:value.beforeRef.kind,artifactId:value.beforeRef.artifactId,
    claimRefs:value.coverageRefs,sourceRefs:[],qualifiers:[],authority:'DRAFT'
  };
  after=value.afterRef===null?null:{
    alpha:value.afterRef.alpha,kind:value.afterRef.kind,artifactId:value.afterRef.artifactId,
    claimRefs:[],sourceRefs:[],qualifiers:[],authority:'DRAFT'
  };
  if(value.operation==='GENERALIZE'&&(!after||after.alpha-before.alpha!==1)) fail('GENERALIZE_ALPHA_STEP_INVALID','$.afterRef.alpha');
  if(value.operation==='SPECIALIZE'&&(!after||after.alpha-before.alpha!==-1)) fail('SPECIALIZE_ALPHA_STEP_INVALID','$.afterRef.alpha');
  if((value.operation==='LINK'||value.operation==='ORBIT')&&(!after||after.alpha!==before.alpha)) fail('HORIZONTAL_ALPHA_MISMATCH','$.afterRef.alpha');
  if(value.operation==='BRIDGE'){
    if(!after||Math.abs(after.alpha-before.alpha)<2) fail('BRIDGE_DISTANCE_TOO_SHORT','$.afterRef.alpha');
    if(!sameArray(input.witnesses.map(function(item){ return item.alpha; }),expectedBridgeAlphas(before.alpha,after.alpha))){
      fail('BRIDGE_WITNESS_CHAIN_INCOMPLETE','$.witnesses');
    }
  }
  if((value.operation==='PARK'||value.operation==='ABSTAIN')&&value.afterRef!==null) fail('AFTER_ARTIFACT_FORBIDDEN','$.afterRef');
  if(value.operation==='ROLLBACK'&&value.afterRef===null) fail('AFTER_ARTIFACT_REQUIRED','$.afterRef');
  if(value.authority!=='STRUCTURAL_ONLY') fail('AUTHORITY_BOUNDARY_VIOLATION','$.authority');
  if(value.evidenceLevel!=='STRUCTURAL') fail('EVIDENCE_LEVEL_INVALID','$.evidenceLevel');
  if(value.soundness!=='NOT_COMPUTED') fail('SOUNDNESS_BOUNDARY_VIOLATION','$.soundness');
  if(value.semanticTruth!==false) fail('SEMANTIC_TRUTH_FORBIDDEN','$.semanticTruth');
  if(value.commitAllowed!==false) fail('COMMIT_AUTHORITY_FORBIDDEN','$.commitAllowed');
  hash(value.receiptId,'$.receiptId');
  hash(value.contentHash,'$.contentHash');
  identity=Canonical.deepCopy(value);
  delete identity.receiptId;
  delete identity.contentHash;
  expectedId=Canonical.hashCanonical(identity);
  if(value.receiptId!==expectedId) fail('RECEIPT_ID_MISMATCH','$.receiptId');
  payload=Canonical.deepCopy(value);
  expectedHash=payload.contentHash;
  delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}

function assertReceiptAgainst(value,beforeArtifact,afterArtifact){
  var expected;
  assertReceipt(value);
  expected=createTransitionReceipt(beforeArtifact,afterArtifact,{
    operation:value.operation,relation:value.relation,coverageRefs:value.coverageRefs,
    witnesses:value.witnesses,reasonCodes:value.reasonCodes,
    validatorVersions:value.validatorVersions,priorReceiptRef:value.priorReceiptRef
  });
  if(expected.contentHash!==value.contentHash) fail('RECEIPT_ARTIFACT_REF_MISMATCH','$');
  return true;
}

global.MRDP78AlphaOrbitContracts=freeze({
  version:VERSION,
  status:'READY',
  artifactSchema:ARTIFACT_SCHEMA,
  edgeSchema:EDGE_SCHEMA,
  receiptSchema:RECEIPT_SCHEMA,
  levels:LEVELS,
  operations:Object.keys(OPERATIONS),
  relations:Object.keys(RELATIONS),
  horizontalRelations:Object.keys(HORIZONTAL_RELATIONS),
  radialRelations:Object.keys(RADIAL_RELATIONS),
  authorityLevels:Object.keys(AUTHORITIES),
  semanticTruth:false,
  soundness:'NOT_COMPUTED',
  commitAllowed:false,
  kindForAlpha:kindForAlpha,
  alphaForKind:alphaForKind,
  radiusForAlpha:radiusForAlpha,
  alphaForRadius:alphaForRadius,
  createArtifact:createArtifact,
  validateArtifact:function(value){ return validationReport(assertArtifact,value); },
  createEdge:createEdge,
  validateEdge:function(value){ return validationReport(assertEdge,value); },
  validateEdgeAgainst:function(value,fromArtifact,toArtifact){ return validationReport(assertEdgeAgainst,value,fromArtifact,toArtifact); },
  createTransitionReceipt:createTransitionReceipt,
  validateTransitionReceipt:function(value){ return validationReport(assertReceipt,value); },
  validateTransitionReceiptAgainst:function(value,beforeArtifact,afterArtifact){
    return validationReport(assertReceiptAgainst,value,beforeArtifact,afterArtifact);
  }
});
})(typeof globalThis!=='undefined'?globalThis:this);
