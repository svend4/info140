(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON||global.MRDP78CanonicalJson;
var Search=global.MRDP78SearchContracts;
var Alpha=global.MRDP78AlphaOrbitContracts;

if(!Canonical||!Search||!Alpha||Search.status!=='READY'||Alpha.status!=='READY'){
  global.MRDP78Data7Adapter=Object.freeze({
    version:VERSION,
    status:'BLOCKED',
    code:'DATA7_ADAPTER_DEPENDENCY_UNAVAILABLE',
    semanticTruth:false,
    commitAllowed:false
  });
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var SEGMENT_SCHEMA='meridian.data7-segment/1';
var SEGMENT_BATCH_SCHEMA='meridian.data7-segment-batch/1';
var ORBIT_SCHEMA='meridian.data7-orbit-proposal/1';
var LINK_SCHEMA='meridian.data7-link-candidate/1';
var VALIDATOR_VERSION='p78-data7-adapter@1.0.0';
var MAX_SEGMENTS=32;
var MAX_COST=1000000;
var ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:@\/-]{0,255}$/;
var QUALIFIERS=freeze(['EXACT_SOURCE_SPAN','SEGMENT_ONLY']);

function fail(code,path,detail){
  var error=new TypeError(code+(path?' at '+path:'')+(detail?': '+detail:''));
  error.name='P78Data7AdapterError';
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
  var allowed={},actual=Object.keys(value),i;
  for(i=0;i<keys.length;i++) allowed[keys[i]]=true;
  for(i=0;i<actual.length;i++) if(!allowed[actual[i]]) fail('UNKNOWN_FIELD',path+'.'+actual[i]);
  for(i=0;i<keys.length;i++) if(!own.call(value,keys[i])) fail('MISSING_FIELD',path+'.'+keys[i]);
}

function array(value,path,min,max){
  var names,symbols,i,descriptor;
  if(!Array.isArray(value)) fail('ARRAY_REQUIRED',path);
  symbols=Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(value):[];
  if(symbols.length) fail('ARRAY_SYMBOL_FIELD_FORBIDDEN',path);
  names=Object.getOwnPropertyNames(value);
  if(names.length!==value.length+1) fail('ARRAY_PROPERTY_FORBIDDEN',path);
  if(min!==undefined&&value.length<min) fail('ARRAY_TOO_SHORT',path);
  if(max!==undefined&&value.length>max) fail('ARRAY_TOO_LONG',path);
  for(i=0;i<value.length;i++){
    descriptor=Object.getOwnPropertyDescriptor(value,String(i));
    if(!descriptor||descriptor.get||descriptor.set) fail('SPARSE_OR_ACCESSOR_ARRAY_FORBIDDEN',path+'['+i+']');
  }
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
  if(min!==undefined&&value<min) fail('INTEGER_OUT_OF_RANGE',path);
  if(max!==undefined&&value>max) fail('INTEGER_OUT_OF_RANGE',path);
  return value;
}

function number(value,path,min,max){
  if(typeof value!=='number'||!Number.isFinite(value)) fail('FINITE_NUMBER_REQUIRED',path);
  if(min!==undefined&&value<min) fail('NUMBER_OUT_OF_RANGE',path);
  if(max!==undefined&&value>max) fail('NUMBER_OUT_OF_RANGE',path);
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

function uniqueSorted(values){
  var seen={},result=[],i,value;
  for(i=0;i<values.length;i++){
    value=values[i];
    if(!seen[value]){ seen[value]=true; result.push(value); }
  }
  return result.sort();
}

function assertBoundary(value,path){
  if(value.authority!=='STRUCTURAL_ONLY') fail('AUTHORITY_BOUNDARY_VIOLATION',path+'.authority');
  if(value.soundness!=='NOT_COMPUTED') fail('SOUNDNESS_BOUNDARY_VIOLATION',path+'.soundness');
  if(value.semanticTruth!==false) fail('SEMANTIC_TRUTH_FORBIDDEN',path+'.semanticTruth');
  if(value.commitAllowed!==false) fail('COMMIT_AUTHORITY_FORBIDDEN',path+'.commitAllowed');
}

function validationReport(assertion,value,a,b,c){
  try{
    assertion(value,a,b,c);
    return freeze({status:'VALID',code:null,path:null});
  }catch(error){
    return freeze({status:'INVALID',code:error&&error.code||'INVALID_VALUE',path:error&&error.path||'$'});
  }
}

function assertSourceSnapshot(value){
  var report=Search.validateSourceSnapshot(value);
  if(!report||report.status!=='VALID') fail('SOURCE_SNAPSHOT_INVALID','$',report&&report.code||'INVALID');
  return true;
}

function sourceRef(source){
  return {
    sourceId:source.sourceId,
    revision:source.revision,
    language:source.language,
    textHash:source.textHash,
    sourceHash:source.sourceHash
  };
}

function assertSourceRef(value,path){
  object(value,path);
  exactKeys(value,['sourceId','revision','language','textHash','sourceHash'],path);
  text(value.sourceId,path+'.sourceId',256,ID_PATTERN);
  text(value.revision,path+'.revision',128);
  text(value.language,path+'.language',64);
  hash(value.textHash,path+'.textHash');
  hash(value.sourceHash,path+'.sourceHash');
  return true;
}

function artifactRef(artifact){
  return {
    artifactId:artifact.artifactId,
    contentHash:artifact.contentHash,
    alpha:artifact.alpha,
    kind:artifact.kind
  };
}

function assertArtifactRef(value,path){
  object(value,path);
  exactKeys(value,['artifactId','contentHash','alpha','kind'],path);
  hash(value.artifactId,path+'.artifactId');
  hash(value.contentHash,path+'.contentHash');
  if(Alpha.kindForAlpha(value.alpha)!==value.kind) fail('ALPHA_KIND_MISMATCH',path+'.kind');
  return true;
}

function locatorInput(value,path){
  object(value,path);
  exactKeys(value,['start','end','label'],path);
  return {
    start:integer(value.start,path+'.start',0),
    end:integer(value.end,path+'.end',1),
    label:text(value.label,path+'.label',256)
  };
}

function assertLocator(value,path){
  var locator=locatorInput(value,path);
  if(locator.end<=locator.start) fail('INVALID_LOCATOR',path+'.end');
  return locator;
}

function assertSpanLocator(value,path){
  object(value,path);
  exactKeys(value,['start','end'],path);
  integer(value.start,path+'.start',0);
  integer(value.end,path+'.end',1);
  if(value.end<=value.start) fail('INVALID_LOCATOR',path+'.end');
  return {start:value.start,end:value.end};
}

function segmentIdentity(source,locator,alpha){
  var span=source.text.slice(locator.start,locator.end),kind=Alpha.kindForAlpha(alpha),artifact,identity;
  if(locator.end>source.text.length) fail('LOCATOR_OUTSIDE_SOURCE','$.locators');
  if(!span.length) fail('EMPTY_SEGMENT','$.locators');
  if(span.trim()!==span) fail('SEGMENT_BOUNDARY_WHITESPACE','$.locators');
  artifact=Alpha.createArtifact({
    alpha:alpha,
    kind:kind,
    title:locator.label,
    body:span,
    language:source.language,
    claimRefs:[],
    sourceRefs:[source.sourceHash],
    parentRefs:[],
    childRefs:[],
    horizontalRefs:[],
    qualifiers:QUALIFIERS,
    authority:'DRAFT'
  });
  identity={
    schema:SEGMENT_SCHEMA,
    version:VERSION,
    operation:'SEGMENT',
    sourceRef:sourceRef(source),
    locator:{start:locator.start,end:locator.end},
    label:locator.label,
    text:span,
    textHash:Canonical.hashText(span),
    artifact:artifact,
    authority:'STRUCTURAL_ONLY',
    evidenceLevel:'LOCATED',
    soundness:'NOT_COMPUTED',
    semanticTruth:false,
    commitAllowed:false
  };
  return identity;
}

function createSegment(source,locator,alpha){
  var identity=segmentIdentity(source,locator,alpha),payload=Canonical.deepCopy(identity);
  payload.segmentId=Canonical.hashCanonical(identity);
  payload.contentHash=Canonical.hashCanonical(payload);
  assertSegment(payload);
  return freeze(payload);
}

function assertSegment(value){
  var identity,payload,expectedId,expectedHash,locator,report;
  object(value,'$');
  exactKeys(value,[
    'schema','version','operation','sourceRef','locator','label','text','textHash','artifact',
    'authority','evidenceLevel','soundness','semanticTruth','commitAllowed','segmentId','contentHash'
  ],'$');
  if(value.schema!==SEGMENT_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  if(value.operation!=='SEGMENT') fail('OPERATION_MISMATCH','$.operation');
  assertSourceRef(value.sourceRef,'$.sourceRef');
  locator=assertSpanLocator(value.locator,'$.locator');
  text(value.label,'$.label',256);
  text(value.text,'$.text',2000000);
  if(value.text.trim()!==value.text) fail('SEGMENT_BOUNDARY_WHITESPACE','$.text');
  hash(value.textHash,'$.textHash');
  if(Canonical.hashText(value.text)!==value.textHash) fail('TEXT_HASH_MISMATCH','$.textHash');
  if(value.text.length!==locator.end-locator.start) fail('LOCATOR_TEXT_LENGTH_MISMATCH','$.locator');
  report=Alpha.validateArtifact(value.artifact);
  if(!report||report.status!=='VALID') fail('ALPHA_ARTIFACT_INVALID','$.artifact',report&&report.code||'INVALID');
  if(value.artifact.title!==value.label||value.artifact.body!==value.text) fail('SEGMENT_ARTIFACT_TEXT_MISMATCH','$.artifact');
  if(value.artifact.language!==value.sourceRef.language) fail('SEGMENT_LANGUAGE_MISMATCH','$.artifact.language');
  if(!sameArray(value.artifact.sourceRefs,[value.sourceRef.sourceHash])) fail('SEGMENT_SOURCE_REF_MISMATCH','$.artifact.sourceRefs');
  if(value.artifact.claimRefs.length||value.artifact.parentRefs.length||value.artifact.childRefs.length||value.artifact.horizontalRefs.length){
    fail('SEGMENT_ARTIFACT_SCOPE_INVALID','$.artifact');
  }
  if(!sameArray(value.artifact.qualifiers,QUALIFIERS)||value.artifact.authority!=='DRAFT') fail('SEGMENT_ARTIFACT_AUTHORITY_INVALID','$.artifact');
  if(value.evidenceLevel!=='LOCATED') fail('EVIDENCE_LEVEL_INVALID','$.evidenceLevel');
  assertBoundary(value,'$');
  hash(value.segmentId,'$.segmentId');
  hash(value.contentHash,'$.contentHash');
  identity=Canonical.deepCopy(value);
  delete identity.segmentId;
  delete identity.contentHash;
  expectedId=Canonical.hashCanonical(identity);
  if(value.segmentId!==expectedId) fail('SEGMENT_ID_MISMATCH','$.segmentId');
  payload=Canonical.deepCopy(value);
  expectedHash=payload.contentHash;
  delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}

function segmentRef(segment){
  assertSegment(segment);
  return {
    segmentId:segment.segmentId,
    contentHash:segment.contentHash,
    sourceRef:Canonical.deepCopy(segment.sourceRef),
    locator:Canonical.deepCopy(segment.locator),
    artifactRef:artifactRef(segment.artifact)
  };
}

function assertSegmentRef(value,path){
  object(value,path);
  exactKeys(value,['segmentId','contentHash','sourceRef','locator','artifactRef'],path);
  hash(value.segmentId,path+'.segmentId');
  hash(value.contentHash,path+'.contentHash');
  assertSpanLocator(value.locator,path+'.locator');
  assertSourceRef(value.sourceRef,path+'.sourceRef');
  assertArtifactRef(value.artifactRef,path+'.artifactRef');
}

function normalizedLocators(values){
  var copy=[],i;
  array(values,'$.locators',1,MAX_SEGMENTS);
  for(i=0;i<values.length;i++) copy.push(locatorInput(values[i],'$.locators['+i+']'));
  copy.sort(function(a,b){ return a.start-b.start||a.end-b.end||(a.label<b.label?-1:a.label>b.label?1:0); });
  for(i=0;i<copy.length;i++){
    if(copy[i].end<=copy[i].start) fail('INVALID_LOCATOR','$.locators['+i+'].end');
    if(i&&copy[i].start<copy[i-1].end) fail('SEGMENT_OVERLAP','$.locators['+i+']');
  }
  return copy;
}

function coverageFor(segments,total){
  var covered=0,complete=true,i,previous=0;
  for(i=0;i<segments.length;i++){
    covered+=segments[i].locator.end-segments[i].locator.start;
    if(segments[i].locator.start!==previous) complete=false;
    previous=segments[i].locator.end;
  }
  if(previous!==total) complete=false;
  return {coveredCodeUnits:covered,totalCodeUnits:total,complete:complete};
}

function createSegmentBatch(source,definition){
  var raw=object(definition,'$'),alpha,kind,locators,segments=[],coverage,identity,payload,i;
  assertSourceSnapshot(source);
  exactKeys(raw,['alpha','locators'],'$');
  alpha=integer(raw.alpha,'$.alpha',-4,4);
  kind=Alpha.kindForAlpha(alpha);
  locators=normalizedLocators(raw.locators);
  for(i=0;i<locators.length;i++) segments.push(createSegment(source,locators[i],alpha));
  coverage=coverageFor(segments,source.text.length);
  identity={
    schema:SEGMENT_BATCH_SCHEMA,
    version:VERSION,
    operation:'SEGMENT',
    alpha:alpha,
    kind:kind,
    sourceRef:sourceRef(source),
    segments:segments,
    coverage:coverage,
    authority:'STRUCTURAL_ONLY',
    evidenceLevel:'LOCATED',
    soundness:'NOT_COMPUTED',
    semanticTruth:false,
    commitAllowed:false
  };
  payload=Canonical.deepCopy(identity);
  payload.batchId=Canonical.hashCanonical(identity);
  payload.contentHash=Canonical.hashCanonical(payload);
  assertSegmentBatch(payload);
  return freeze(payload);
}

function assertCoverage(value,path,segments){
  var expected;
  object(value,path);
  exactKeys(value,['coveredCodeUnits','totalCodeUnits','complete'],path);
  integer(value.coveredCodeUnits,path+'.coveredCodeUnits',1);
  integer(value.totalCodeUnits,path+'.totalCodeUnits',1);
  if(typeof value.complete!=='boolean') fail('BOOLEAN_REQUIRED',path+'.complete');
  if(segments[segments.length-1].locator.end>value.totalCodeUnits) fail('LOCATOR_OUTSIDE_SOURCE',path+'.totalCodeUnits');
  expected=coverageFor(segments,value.totalCodeUnits);
  if(!same(value,expected)) fail('COVERAGE_MISMATCH',path);
}

function assertSegmentBatch(value){
  var identity,payload,expectedId,expectedHash,i,previousEnd=-1,report;
  object(value,'$');
  exactKeys(value,[
    'schema','version','operation','alpha','kind','sourceRef','segments','coverage','authority',
    'evidenceLevel','soundness','semanticTruth','commitAllowed','batchId','contentHash'
  ],'$');
  if(value.schema!==SEGMENT_BATCH_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  if(value.operation!=='SEGMENT') fail('OPERATION_MISMATCH','$.operation');
  if(Alpha.kindForAlpha(value.alpha)!==value.kind) fail('ALPHA_KIND_MISMATCH','$.kind');
  assertSourceRef(value.sourceRef,'$.sourceRef');
  array(value.segments,'$.segments',1,MAX_SEGMENTS);
  for(i=0;i<value.segments.length;i++){
    assertSegment(value.segments[i]);
    if(value.segments[i].artifact.alpha!==value.alpha||value.segments[i].artifact.kind!==value.kind) fail('BATCH_ALPHA_MISMATCH','$.segments['+i+']');
    if(!same(value.segments[i].sourceRef,value.sourceRef)) fail('BATCH_SOURCE_REF_MISMATCH','$.segments['+i+'].sourceRef');
    if(value.segments[i].locator.start<previousEnd) fail('SEGMENT_OVERLAP','$.segments['+i+'].locator');
    previousEnd=value.segments[i].locator.end;
  }
  assertCoverage(value.coverage,'$.coverage',value.segments);
  if(value.evidenceLevel!=='LOCATED') fail('EVIDENCE_LEVEL_INVALID','$.evidenceLevel');
  assertBoundary(value,'$');
  hash(value.batchId,'$.batchId');
  hash(value.contentHash,'$.contentHash');
  identity=Canonical.deepCopy(value);
  delete identity.batchId;
  delete identity.contentHash;
  expectedId=Canonical.hashCanonical(identity);
  if(value.batchId!==expectedId) fail('BATCH_ID_MISMATCH','$.batchId');
  payload=Canonical.deepCopy(value);
  expectedHash=payload.contentHash;
  delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  report=Search.validateSourceSnapshot;
  if(typeof report!=='function') fail('SOURCE_VALIDATOR_UNAVAILABLE','$');
  return true;
}

function assertSegmentBatchAgainst(value,source){
  var expected,definition;
  assertSegmentBatch(value);
  assertSourceSnapshot(source);
  if(!same(value.sourceRef,sourceRef(source))) fail('SOURCE_SNAPSHOT_STALE','$.sourceRef');
  definition={
    alpha:value.alpha,
    locators:value.segments.map(function(segment){
      return {start:segment.locator.start,end:segment.locator.end,label:segment.label};
    })
  };
  expected=createSegmentBatch(source,definition);
  if(expected.contentHash!==value.contentHash) fail('SEGMENT_BATCH_SOURCE_MISMATCH','$');
  return true;
}

function memberRefsFromSegments(segments){
  var refs=segments.map(segmentRef);
  refs.sort(function(a,b){ return a.segmentId<b.segmentId?-1:a.segmentId>b.segmentId?1:0; });
  return refs;
}

function assertMemberRefs(value,path){
  var i;
  array(value,path,2,MAX_SEGMENTS);
  for(i=0;i<value.length;i++){
    assertSegmentRef(value[i],path+'['+i+']');
    if(i&&value[i-1].segmentId>=value[i].segmentId) fail('MEMBER_REFS_NOT_SORTED_UNIQUE',path);
  }
}

function assertOrder(value,path,memberIds){
  var sorted,i;
  array(value,path,memberIds.length,memberIds.length);
  for(i=0;i<value.length;i++) hash(value[i],path+'['+i+']');
  sorted=value.slice().sort();
  if(!sameArray(sorted,memberIds)) fail('ORDER_NOT_MEMBER_PERMUTATION',path);
  return value.slice();
}

function normalizeCosts(values,memberIds){
  var known={},seen={},copy=[],i,item,key,expected=memberIds.length*(memberIds.length-1);
  for(i=0;i<memberIds.length;i++) known[memberIds[i]]=true;
  array(values,'$.costs',expected,expected);
  for(i=0;i<values.length;i++){
    item=object(values[i],'$.costs['+i+']');
    exactKeys(item,['fromSegmentId','toSegmentId','cost'],'$.costs['+i+']');
    hash(item.fromSegmentId,'$.costs['+i+'].fromSegmentId');
    hash(item.toSegmentId,'$.costs['+i+'].toSegmentId');
    if(!known[item.fromSegmentId]||!known[item.toSegmentId]) fail('COST_MEMBER_UNKNOWN','$.costs['+i+']');
    if(item.fromSegmentId===item.toSegmentId) fail('SELF_COST_FORBIDDEN','$.costs['+i+']');
    key=item.fromSegmentId+'|'+item.toSegmentId;
    if(seen[key]) fail('DUPLICATE_COST','$.costs['+i+']');
    seen[key]=true;
    copy.push({fromSegmentId:item.fromSegmentId,toSegmentId:item.toSegmentId,cost:number(item.cost,'$.costs['+i+'].cost',0,MAX_COST)});
  }
  copy.sort(function(a,b){
    var ak=a.fromSegmentId+'|'+a.toSegmentId,bk=b.fromSegmentId+'|'+b.toSegmentId;
    return ak<bk?-1:ak>bk?1:0;
  });
  return copy;
}

function assertCanonicalCosts(value,path,memberIds){
  var normalized=normalizeCosts(value,memberIds);
  if(!same(value,normalized)) fail('COSTS_NOT_CANONICAL',path);
  return normalized;
}

function costMap(costs){
  var map={},i;
  for(i=0;i<costs.length;i++) map[costs[i].fromSegmentId+'|'+costs[i].toSegmentId]=costs[i].cost;
  return map;
}

function greedyOrder(memberIds,startId,costs){
  var known={},remaining=memberIds.slice(),map=costMap(costs),order=[startId],total=0,current=startId,i,best,bestCost,cost;
  for(i=0;i<memberIds.length;i++) known[memberIds[i]]=true;
  if(!known[startId]) fail('START_SEGMENT_UNKNOWN','$.startSegmentId');
  remaining.splice(remaining.indexOf(startId),1);
  while(remaining.length){
    best=null;
    bestCost=Infinity;
    for(i=0;i<remaining.length;i++){
      cost=map[current+'|'+remaining[i]];
      if(cost===undefined) fail('COST_MATRIX_INCOMPLETE','$.costs');
      if(cost<bestCost||(cost===bestCost&&(best===null||remaining[i]<best))){ best=remaining[i]; bestCost=cost; }
    }
    order.push(best);
    total+=bestCost;
    remaining.splice(remaining.indexOf(best),1);
    current=best;
  }
  return {order:order,pathCost:total};
}

function orbitContext(memberRefs){
  var alpha=memberRefs[0].artifactRef.alpha,kind=memberRefs[0].artifactRef.kind;
  var language=memberRefs[0].sourceRef.language,i;
  for(i=0;i<memberRefs.length;i++){
    if(memberRefs[i].artifactRef.alpha!==alpha||memberRefs[i].artifactRef.kind!==kind) fail('ORBIT_ALPHA_KIND_MISMATCH','$.memberRefs['+i+']');
    if(memberRefs[i].sourceRef.language!==language) fail('ORBIT_LANGUAGE_MISMATCH','$.memberRefs['+i+'].sourceRef.language');
  }
  return {alpha:alpha,kind:kind,language:language};
}

function createOrbitProposal(segments,definition){
  var raw=object(definition,'$'),beforeOrder=[],memberRefs,memberIds,costs,result,context,identity,payload,i;
  array(segments,'$.segments',2,MAX_SEGMENTS);
  for(i=0;i<segments.length;i++){
    assertSegment(segments[i]);
    beforeOrder.push(segments[i].segmentId);
  }
  if(uniqueSorted(beforeOrder).length!==beforeOrder.length) fail('DUPLICATE_SEGMENT','$.segments');
  exactKeys(raw,['startSegmentId','costs'],'$');
  hash(raw.startSegmentId,'$.startSegmentId');
  memberRefs=memberRefsFromSegments(segments);
  memberIds=memberRefs.map(function(ref){ return ref.segmentId; });
  context=orbitContext(memberRefs);
  costs=normalizeCosts(raw.costs,memberIds);
  result=greedyOrder(memberIds,raw.startSegmentId,costs);
  if(sameArray(beforeOrder,result.order)) fail('ORBIT_PROGRESS_REQUIRED','$.segments');
  identity={
    schema:ORBIT_SCHEMA,
    version:VERSION,
    operation:'ORBIT',
    algorithm:'DIRECTED_GREEDY',
    alpha:context.alpha,
    kind:context.kind,
    startSegmentId:raw.startSegmentId,
    memberRefs:memberRefs,
    beforeOrder:beforeOrder,
    afterOrder:result.order,
    costs:costs,
    pathCost:result.pathCost,
    improvementStatus:'NOT_COMPUTED',
    alphaTransitionReceipt:null,
    authority:'STRUCTURAL_ONLY',
    evidenceLevel:'STRUCTURAL',
    soundness:'NOT_COMPUTED',
    semanticTruth:false,
    commitAllowed:false
  };
  payload=Canonical.deepCopy(identity);
  payload.proposalId=Canonical.hashCanonical(identity);
  payload.contentHash=Canonical.hashCanonical(payload);
  assertOrbitProposal(payload);
  return freeze(payload);
}

function assertOrbitProposal(value){
  var memberIds,costs,result,context,identity,payload,expectedId,expectedHash;
  object(value,'$');
  exactKeys(value,[
    'schema','version','operation','algorithm','alpha','kind','startSegmentId','memberRefs',
    'beforeOrder','afterOrder','costs','pathCost','improvementStatus','alphaTransitionReceipt',
    'authority','evidenceLevel','soundness','semanticTruth','commitAllowed','proposalId','contentHash'
  ],'$');
  if(value.schema!==ORBIT_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  if(value.operation!=='ORBIT'||value.algorithm!=='DIRECTED_GREEDY') fail('OPERATION_MISMATCH','$.operation');
  if(Alpha.kindForAlpha(value.alpha)!==value.kind) fail('ALPHA_KIND_MISMATCH','$.kind');
  hash(value.startSegmentId,'$.startSegmentId');
  assertMemberRefs(value.memberRefs,'$.memberRefs');
  memberIds=value.memberRefs.map(function(ref){ return ref.segmentId; });
  assertOrder(value.beforeOrder,'$.beforeOrder',memberIds);
  assertOrder(value.afterOrder,'$.afterOrder',memberIds);
  costs=assertCanonicalCosts(value.costs,'$.costs',memberIds);
  result=greedyOrder(memberIds,value.startSegmentId,costs);
  if(!sameArray(result.order,value.afterOrder)||result.pathCost!==value.pathCost) fail('GREEDY_RESULT_MISMATCH','$.afterOrder');
  if(sameArray(value.beforeOrder,value.afterOrder)) fail('ORBIT_PROGRESS_REQUIRED','$.afterOrder');
  context=orbitContext(value.memberRefs);
  if(value.alpha!==context.alpha||value.kind!==context.kind) fail('ORBIT_ALPHA_KIND_MISMATCH','$.alpha');
  if(value.improvementStatus!=='NOT_COMPUTED'||value.alphaTransitionReceipt!==null) fail('ORBIT_AUTHORITY_BOUNDARY_VIOLATION','$.alphaTransitionReceipt');
  if(value.evidenceLevel!=='STRUCTURAL') fail('EVIDENCE_LEVEL_INVALID','$.evidenceLevel');
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

function assertOrbitProposalAgainst(value,segments){
  var expected;
  assertOrbitProposal(value);
  expected=createOrbitProposal(segments,{startSegmentId:value.startSegmentId,costs:value.costs});
  if(expected.contentHash!==value.contentHash) fail('ORBIT_SEGMENT_REF_MISMATCH','$');
  return true;
}

function createLinkCandidate(fromSegment,toSegment,witnessSegment,definition){
  var raw=object(definition,'$'),sourceHash,low,high,identity,payload;
  assertSegment(fromSegment);
  assertSegment(toSegment);
  assertSegment(witnessSegment);
  exactKeys(raw,['relation'],'$');
  if(raw.relation!=='CO_OCCURS_WITH') fail('LINK_RELATION_NOT_SAFE','$.relation');
  if(fromSegment.segmentId===toSegment.segmentId) fail('SELF_LINK_FORBIDDEN','$.toSegment');
  if(fromSegment.artifact.alpha!==toSegment.artifact.alpha||fromSegment.artifact.kind!==toSegment.artifact.kind){
    fail('LINK_ALPHA_KIND_MISMATCH','$.toSegment');
  }
  if(witnessSegment.artifact.alpha!==fromSegment.artifact.alpha) fail('LINK_WITNESS_ALPHA_MISMATCH','$.witnessSegment');
  sourceHash=fromSegment.sourceRef.sourceHash;
  if(toSegment.sourceRef.sourceHash!==sourceHash||witnessSegment.sourceRef.sourceHash!==sourceHash){
    fail('COMMON_EXACT_SOURCE_REQUIRED','$.witnessSegment');
  }
  low=Math.min(fromSegment.locator.start,toSegment.locator.start);
  high=Math.max(fromSegment.locator.end,toSegment.locator.end);
  if(witnessSegment.locator.start>low||witnessSegment.locator.end<high) fail('LINK_WITNESS_CONTEXT_INCOMPLETE','$.witnessSegment.locator');
  identity={
    schema:LINK_SCHEMA,
    version:VERSION,
    operation:'LINK_CANDIDATE',
    basis:'EXACT_CONTEXT_COOCCURRENCE',
    relation:'CO_OCCURS_WITH',
    fromSegmentRef:segmentRef(fromSegment),
    toSegmentRef:segmentRef(toSegment),
    witnessSegmentRef:segmentRef(witnessSegment),
    edge:null,
    alphaTransitionReceipt:null,
    reviewStatus:'REQUIRES_REVIEW',
    finalRelation:'NOT_COMPUTED',
    authority:'STRUCTURAL_ONLY',
    evidenceLevel:'LOCATED',
    soundness:'NOT_COMPUTED',
    semanticTruth:false,
    commitAllowed:false
  };
  payload=Canonical.deepCopy(identity);
  payload.candidateId=Canonical.hashCanonical(identity);
  payload.contentHash=Canonical.hashCanonical(payload);
  assertLinkCandidate(payload);
  return freeze(payload);
}

function assertLinkCandidate(value){
  var identity,payload,expectedId,expectedHash,low,high;
  object(value,'$');
  exactKeys(value,[
    'schema','version','operation','basis','relation','fromSegmentRef','toSegmentRef','witnessSegmentRef',
    'edge','alphaTransitionReceipt','reviewStatus','finalRelation','authority','evidenceLevel','soundness','semanticTruth',
    'commitAllowed','candidateId','contentHash'
  ],'$');
  if(value.schema!==LINK_SCHEMA) fail('SCHEMA_MISMATCH','$.schema');
  if(value.version!==VERSION) fail('VERSION_MISMATCH','$.version');
  if(value.operation!=='LINK_CANDIDATE'||value.basis!=='EXACT_CONTEXT_COOCCURRENCE'||value.relation!=='CO_OCCURS_WITH'){
    fail('LINK_CANDIDATE_MODE_INVALID','$.operation');
  }
  assertSegmentRef(value.fromSegmentRef,'$.fromSegmentRef');
  assertSegmentRef(value.toSegmentRef,'$.toSegmentRef');
  assertSegmentRef(value.witnessSegmentRef,'$.witnessSegmentRef');
  if(value.fromSegmentRef.segmentId===value.toSegmentRef.segmentId) fail('SELF_LINK_FORBIDDEN','$.toSegmentRef');
  if(value.fromSegmentRef.artifactRef.alpha!==value.toSegmentRef.artifactRef.alpha||value.fromSegmentRef.artifactRef.kind!==value.toSegmentRef.artifactRef.kind){
    fail('LINK_ALPHA_KIND_MISMATCH','$.toSegmentRef');
  }
  if(value.witnessSegmentRef.artifactRef.alpha!==value.fromSegmentRef.artifactRef.alpha) fail('LINK_WITNESS_ALPHA_MISMATCH','$.witnessSegmentRef');
  if(value.fromSegmentRef.sourceRef.sourceHash!==value.toSegmentRef.sourceRef.sourceHash||
     value.fromSegmentRef.sourceRef.sourceHash!==value.witnessSegmentRef.sourceRef.sourceHash){
    fail('COMMON_EXACT_SOURCE_REQUIRED','$.witnessSegmentRef');
  }
  low=Math.min(value.fromSegmentRef.locator.start,value.toSegmentRef.locator.start);
  high=Math.max(value.fromSegmentRef.locator.end,value.toSegmentRef.locator.end);
  if(value.witnessSegmentRef.locator.start>low||value.witnessSegmentRef.locator.end<high) fail('LINK_WITNESS_CONTEXT_INCOMPLETE','$.witnessSegmentRef.locator');
  if(value.edge!==null||value.alphaTransitionReceipt!==null) fail('LINK_AUTHORITY_BOUNDARY_VIOLATION','$.edge');
  if(value.reviewStatus!=='REQUIRES_REVIEW'||value.finalRelation!=='NOT_COMPUTED') fail('REVIEW_STATUS_INVALID','$.reviewStatus');
  if(value.evidenceLevel!=='LOCATED') fail('EVIDENCE_LEVEL_INVALID','$.evidenceLevel');
  assertBoundary(value,'$');
  hash(value.candidateId,'$.candidateId');
  hash(value.contentHash,'$.contentHash');
  identity=Canonical.deepCopy(value);
  delete identity.candidateId;
  delete identity.contentHash;
  expectedId=Canonical.hashCanonical(identity);
  if(value.candidateId!==expectedId) fail('CANDIDATE_ID_MISMATCH','$.candidateId');
  payload=Canonical.deepCopy(value);
  expectedHash=payload.contentHash;
  delete payload.contentHash;
  if(Canonical.hashCanonical(payload)!==expectedHash) fail('CONTENT_HASH_MISMATCH','$.contentHash');
  return true;
}

function assertLinkCandidateAgainst(value,fromSegment,toSegment,witnessSegment){
  var expected;
  assertLinkCandidate(value);
  expected=createLinkCandidate(fromSegment,toSegment,witnessSegment,{relation:value.relation});
  if(expected.contentHash!==value.contentHash) fail('LINK_SEGMENT_REF_MISMATCH','$');
  return true;
}

global.MRDP78Data7Adapter=freeze({
  version:VERSION,
  status:'READY',
  schema:'meridian.data7-adapter/1',
  schemas:freeze({segment:SEGMENT_SCHEMA,segmentBatch:SEGMENT_BATCH_SCHEMA,orbitProposal:ORBIT_SCHEMA,linkCandidate:LINK_SCHEMA}),
  operations:freeze(['SEGMENT','ORBIT','LINK_CANDIDATE']),
  algorithms:freeze(['DIRECTED_GREEDY']),
  limits:freeze({maxSegments:MAX_SEGMENTS,maxCost:MAX_COST}),
  validatorVersion:VALIDATOR_VERSION,
  semanticTruth:false,
  soundness:'NOT_COMPUTED',
  commitAllowed:false,
  createSegmentBatch:createSegmentBatch,
  validateSegment:function(value){ return validationReport(assertSegment,value); },
  validateSegmentBatch:function(value){ return validationReport(assertSegmentBatch,value); },
  validateSegmentBatchAgainst:function(value,source){ return validationReport(assertSegmentBatchAgainst,value,source); },
  createOrbitProposal:createOrbitProposal,
  validateOrbitProposal:function(value){ return validationReport(assertOrbitProposal,value); },
  validateOrbitProposalAgainst:function(value,segments){ return validationReport(assertOrbitProposalAgainst,value,segments); },
  createLinkCandidate:createLinkCandidate,
  validateLinkCandidate:function(value){ return validationReport(assertLinkCandidate,value); },
  validateLinkCandidateAgainst:function(value,fromSegment,toSegment,witnessSegment){
    return validationReport(assertLinkCandidateAgainst,value,fromSegment,toSegment,witnessSegment);
  }
});
})(typeof globalThis!=='undefined'?globalThis:this);
