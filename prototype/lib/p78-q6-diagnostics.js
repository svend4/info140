(function(global){
'use strict';

var VERSION='1.0.0';
var KIND='MRDP78Q6Diagnostics';
var PROFILE_ID='p78-center-safety-v0';
var DIMENSION=6;
var VERTEX_COUNT=64;
var DEGREE=6;
var EDGE_COUNT=192;
var UNKNOWN='UNKNOWN';
var STRUCTURAL='STRUCTURAL';
var NOT_COMPUTED='NOT_COMPUTED';

function own(value,key){ return Object.prototype.hasOwnProperty.call(value,key); }
function plain(value){ return !!value&&Object.prototype.toString.call(value)==='[object Object]'; }
function finite(value){ return typeof value==='number'&&isFinite(value); }
function text(value){ return typeof value==='string'?value.trim():''; }
function freeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(key){ freeze(value[key]); });
  return Object.freeze(value);
}
function proof(status,code,operation,extra){
  var result={
    version:VERSION,
    kind:KIND,
    operation:operation,
    status:status,
    code:code||null,
    evidence:STRUCTURAL,
    evidenceLevel:STRUCTURAL,
    soundness:NOT_COMPUTED,
    semanticTruth:false
  };
  Object.keys(extra||{}).forEach(function(key){ result[key]=extra[key]; });
  return freeze(result);
}

var PREDICATE_DEFINITIONS=freeze([
  {bit:0,name:'sourceCovered',question:'Is the source covered by the analysis?'},
  {bit:1,name:'goalCovered',question:'Is the goal present and covered?'},
  {bit:2,name:'relationSupported',question:'Is the candidate relation to the source supported?'},
  {bit:3,name:'noveltyPreserved',question:'Does the candidate preserve novelty rather than repeat?'},
  {bit:4,name:'guardSafe',question:'Does the move remain inside the living ring?'},
  {bit:5,name:'reversible',question:'Does an exact reversible transaction exist?'}
]);
var PREDICATE_NAMES=freeze(PREDICATE_DEFINITIONS.map(function(item){ return item.name; }));
var PREDICATE_INDEX={};
PREDICATE_NAMES.forEach(function(name,index){ PREDICATE_INDEX[name]=index; });
freeze(PREDICATE_INDEX);
var PROFILE=freeze({
  id:PROFILE_ID,
  dimension:DIMENSION,
  predicates:PREDICATE_DEFINITIONS,
  unknown:UNKNOWN,
  evidenceLevel:STRUCTURAL,
  soundness:NOT_COMPUTED
});

function bitStringFromBits(bits){ return bits.join(''); }
function bitsFromId(id){
  var bits=[];
  for(var index=0;index<DIMENSION;index++) bits.push((id>>(DIMENSION-1-index))&1);
  return bits;
}
function idFromBits(bits){
  var id=0;
  for(var index=0;index<DIMENSION;index++) id=(id<<1)|bits[index];
  return id;
}
function cubeCoordinate(bits){
  return bits.map(function(bit){ return bit===1?1:-1; });
}
function createVertex(id){
  var bits=bitsFromId(id);
  return freeze({
    id:id,
    bitString:bitStringFromBits(bits),
    bits:bits,
    localBits:bits.slice(0,3),
    macroBits:bits.slice(3,6),
    weight:bits.reduce(function(sum,bit){ return sum+bit; },0)
  });
}
function createGraph(){
  var vertices=[],edges=[],adjacency=[],id,bit,other,from,to;
  for(id=0;id<VERTEX_COUNT;id++){
    vertices.push(createVertex(id));
    adjacency.push([]);
  }
  for(id=0;id<VERTEX_COUNT;id++){
    for(bit=0;bit<DIMENSION;bit++){
      other=id^(1<<(DIMENSION-1-bit));
      if(id<other){
        from=vertices[id]; to=vertices[other];
        edges.push(freeze({
          id:from.bitString+'--'+to.bitString,
          from:from.id,
          to:to.id,
          fromKey:from.bitString,
          toKey:to.bitString,
          changedBit:bit,
          changedPredicate:PREDICATE_NAMES[bit],
          hammingDistance:1,
          topology:'HAMMING_ONE'
        }));
        adjacency[from.id].push(to.id);
        adjacency[to.id].push(from.id);
      }
    }
  }
  adjacency.forEach(function(neighbors){ neighbors.sort(function(a,b){ return a-b; }); });
  return freeze({
    kind:'Q6_GRAPH',
    group:'(Z2)^6',
    dimension:DIMENSION,
    vertexCount:vertices.length,
    degree:DEGREE,
    edgeCount:edges.length,
    vertices:vertices,
    edges:edges,
    adjacency:adjacency,
    topologyTruth:'HAMMING_ONE',
    screenDistanceSemantic:false,
    evidenceLevel:STRUCTURAL,
    soundness:NOT_COMPUTED
  });
}

var GRAPH=createGraph();

function parseBit(value){
  if(value===0||value===false) return 0;
  if(value===1||value===true) return 1;
  return null;
}
function resolveVertex(value){
  var id,bits=[],index,bit;
  if(typeof value==='number'){
    if(Number.isInteger(value)&&value>=0&&value<VERTEX_COUNT) return {ok:true,vertex:GRAPH.vertices[value]};
    return {ok:false,status:'INVALID',code:'Q6_VERTEX_ID_RANGE'};
  }
  if(typeof value==='string'){
    if(!/^[01]{6}$/.test(value)) return {ok:false,status:'INVALID',code:'Q6_VERTEX_BITS_REQUIRED'};
    return {ok:true,vertex:GRAPH.vertices[parseInt(value,2)]};
  }
  if(Array.isArray(value)){
    if(value.length!==DIMENSION) return {ok:false,status:'INVALID',code:'Q6_VERTEX_BITS_REQUIRED'};
    for(index=0;index<DIMENSION;index++){
      bit=parseBit(value[index]);
      if(bit===null) return {ok:false,status:'INVALID',code:'Q6_VERTEX_BITS_REQUIRED'};
      bits.push(bit);
    }
    return {ok:true,vertex:GRAPH.vertices[idFromBits(bits)]};
  }
  if(plain(value)){
    if(value.status==='PARTIAL'||value.status==='ABSTAIN') return {ok:false,status:value.status,code:'Q6_VERTEX_NOT_COMPUTED'};
    if(own(value,'vertex')) return resolveVertex(value.vertex);
    if(own(value,'cell')) return resolveVertex(value.cell);
    if(own(value,'bits')) return resolveVertex(value.bits);
    if(own(value,'bitString')) return resolveVertex(value.bitString);
    if(own(value,'id')) return resolveVertex(value.id);
  }
  return {ok:false,status:'INVALID',code:'Q6_VERTEX_REQUIRED'};
}
function hammingDistance(left,right){
  var a=resolveVertex(left),b=resolveVertex(right),distance=0,index;
  if(!a.ok||!b.ok) return null;
  for(index=0;index<DIMENSION;index++) if(a.vertex.bits[index]!==b.vertex.bits[index]) distance++;
  return distance;
}
function changedBit(left,right){
  var a=resolveVertex(left),b=resolveVertex(right),found=-1,index;
  if(!a.ok||!b.ok) return null;
  for(index=0;index<DIMENSION;index++){
    if(a.vertex.bits[index]===b.vertex.bits[index]) continue;
    if(found!==-1) return null;
    found=index;
  }
  return found;
}
function isAdjacent(left,right){ return hammingDistance(left,right)===1; }
function getVertex(value){
  var parsed=resolveVertex(value);
  return parsed.ok?parsed.vertex:null;
}
function neighbors(value){
  var parsed=resolveVertex(value);
  if(!parsed.ok) return proof(parsed.status,parsed.code,'NEIGHBORS',{vertex:null,neighbors:[]});
  return proof('READY',null,'NEIGHBORS',{
    vertex:parsed.vertex,
    neighbors:GRAPH.adjacency[parsed.vertex.id].map(function(id){ return GRAPH.vertices[id]; }),
    degree:GRAPH.adjacency[parsed.vertex.id].length
  });
}

function primitiveOrNull(value){
  return value===null||typeof value==='boolean'||finite(value)||(typeof value==='string'&&value.trim()!=='');
}
function copyProvenance(values){
  if(!Array.isArray(values)) return null;
  var output=[];
  for(var index=0;index<values.length;index++){
    var item=values[index];
    if(typeof item==='string'&&item.trim()) output.push(item.trim());
    else if(plain(item)){
      var copy={},valid=true;
      Object.keys(item).sort().forEach(function(key){
        var value=item[key];
        if(value===null||typeof value==='boolean'||finite(value)||(typeof value==='string'&&value.trim()!=='')) copy[key]=value;
        else valid=false;
      });
      if(!valid||!Object.keys(copy).length) return null;
      output.push(copy);
    }else return null;
  }
  return output;
}
function normalizePredicate(name,raw){
  var index=PREDICATE_INDEX[name],spec,value,measurement,threshold,thresholdProfile,evidenceLevel,providerVersion,provenance;
  if(index===undefined) return {ok:false,code:'Q6_PREDICATE_NAME'};
  if(raw===undefined||raw===null) spec={value:UNKNOWN};
  else if(typeof raw==='boolean'||raw===UNKNOWN) spec={value:raw};
  else if(plain(raw)) spec=raw;
  else return {ok:false,code:'Q6_PREDICATE_TYPE',predicate:name};
  value=own(spec,'value')?spec.value:UNKNOWN;
  if(value!==true&&value!==false&&value!==UNKNOWN) return {ok:false,code:'Q6_PREDICATE_VALUE',predicate:name};
  if(own(spec,'name')&&spec.name!==name) return {ok:false,code:'Q6_PREDICATE_ORDER',predicate:name};
  if(own(spec,'bit')&&spec.bit!==index) return {ok:false,code:'Q6_PREDICATE_ORDER',predicate:name};
  measurement=own(spec,'measurement')?spec.measurement:null;
  threshold=own(spec,'threshold')?spec.threshold:null;
  thresholdProfile=own(spec,'thresholdProfile')?text(spec.thresholdProfile):PROFILE_ID;
  evidenceLevel=own(spec,'evidenceLevel')?text(spec.evidenceLevel):STRUCTURAL;
  providerVersion=own(spec,'providerVersion')?text(spec.providerVersion):VERSION;
  provenance=copyProvenance(own(spec,'provenance')?spec.provenance:[]);
  if(!primitiveOrNull(measurement)) return {ok:false,code:'Q6_PREDICATE_MEASUREMENT',predicate:name};
  if(!primitiveOrNull(threshold)) return {ok:false,code:'Q6_PREDICATE_THRESHOLD',predicate:name};
  if(!thresholdProfile) return {ok:false,code:'Q6_THRESHOLD_PROFILE_REQUIRED',predicate:name};
  if(evidenceLevel!==STRUCTURAL) return {ok:false,code:'Q6_EVIDENCE_LEVEL',predicate:name};
  if(!providerVersion) return {ok:false,code:'Q6_PROVIDER_VERSION_REQUIRED',predicate:name};
  if(provenance===null) return {ok:false,code:'Q6_PROVENANCE_TYPE',predicate:name};
  return {ok:true,record:freeze({
    bit:index,
    name:name,
    value:value,
    measurement:measurement,
    threshold:threshold,
    thresholdProfile:thresholdProfile,
    evidenceLevel:STRUCTURAL,
    soundness:NOT_COMPUTED,
    providerVersion:providerVersion,
    provenance:provenance
  })};
}
function predicateInput(input,index,name){
  if(Array.isArray(input)) return input[index];
  if(plain(input)&&Array.isArray(input.predicates)) return input.predicates[index];
  if(plain(input)) return input[name];
  return undefined;
}
function diagnose(input){
  var source=input==null?{}:input,records=[],issues=[],bits=[],pattern=[],known=0,unknown=0,index,normalized,status,code,vertex=null,values={};
  if(!Array.isArray(source)&&!plain(source)) return proof('INVALID','Q6_PREDICATES_REQUIRED','DIAGNOSE_Q6',{profile:PROFILE,predicates:[],vertex:null,cell:null});
  if(Array.isArray(source)&&source.length>DIMENSION) return proof('INVALID','Q6_PREDICATE_COUNT','DIAGNOSE_Q6',{profile:PROFILE,predicates:[],vertex:null,cell:null});
  if(plain(source)&&Array.isArray(source.predicates)&&source.predicates.length>DIMENSION) return proof('INVALID','Q6_PREDICATE_COUNT','DIAGNOSE_Q6',{profile:PROFILE,predicates:[],vertex:null,cell:null});
  for(index=0;index<DIMENSION;index++){
    normalized=normalizePredicate(PREDICATE_NAMES[index],predicateInput(source,index,PREDICATE_NAMES[index]));
    if(!normalized.ok){ issues.push(freeze({predicate:PREDICATE_NAMES[index],code:normalized.code})); continue; }
    records.push(normalized.record);
    values[PREDICATE_NAMES[index]]=normalized.record.value;
    if(normalized.record.value===UNKNOWN){ unknown++; pattern.push('?'); }
    else{
      known++;
      bits.push(normalized.record.value?1:0);
      pattern.push(normalized.record.value?'1':'0');
    }
  }
  if(issues.length) return proof('INVALID','Q6_PREDICATES_INVALID','DIAGNOSE_Q6',{
    profile:PROFILE,predicates:records,issues:issues,knownCount:known,unknownCount:unknown,vertex:null,cell:null
  });
  if(unknown===0){ status='READY'; code=null; vertex=GRAPH.vertices[parseInt(pattern.join(''),2)]; }
  else if(known===0){ status='ABSTAIN'; code='Q6_ALL_PREDICATES_UNKNOWN'; }
  else{ status='PARTIAL'; code='Q6_PREDICATES_PARTIAL'; }
  return proof(status,code,'DIAGNOSE_Q6',{
    profile:PROFILE,
    predicates:records,
    values:values,
    knownCount:known,
    unknownCount:unknown,
    coverage:known/DIMENSION,
    pattern:pattern.join(''),
    compatibleVertexCount:Math.pow(2,unknown),
    vertex:vertex,
    cell:vertex,
    contract:{
      pre:{ok:true,typed:true},
      inv:{ok:records.length===DIMENSION,unknownPreserved:unknown===records.filter(function(item){ return item.value===UNKNOWN; }).length},
      post:{ok:unknown===0?!!vertex:vertex===null,fictionalCell:false}
    }
  });
}

function projectionOptions(options){
  options=plain(options)?options:{};
  var macroScale=own(options,'macroScale')?options.macroScale:3;
  var localScale=own(options,'localScale')?options.localScale:0.65;
  if(!finite(macroScale)||macroScale<=0||!finite(localScale)||localScale<=0) return null;
  return {macroScale:macroScale,localScale:localScale};
}
function projectionOf(vertex,options){
  var local=cubeCoordinate(vertex.localBits),macro=cubeCoordinate(vertex.macroBits),position=[];
  for(var axis=0;axis<3;axis++) position.push(macro[axis]*options.macroScale+local[axis]*options.localScale);
  return freeze({
    vertex:vertex,
    localCubeId:parseInt(vertex.macroBits.join(''),2),
    localVertexId:parseInt(vertex.localBits.join(''),2),
    localPosition:local,
    macroPosition:macro,
    position:position,
    projection:'Q3xQ3_CUBE_OF_CUBES',
    topologyTruth:'HAMMING_ONE',
    screenDistanceSemantic:false,
    evidenceLevel:STRUCTURAL,
    soundness:NOT_COMPUTED
  });
}
function projectVertex(value,options){
  var parsed=resolveVertex(value),settings=projectionOptions(options);
  if(!parsed.ok) return proof(parsed.status,parsed.code,'PROJECT_Q6_VERTEX',{projection:null});
  if(!settings) return proof('INVALID','Q6_PROJECTION_SCALE','PROJECT_Q6_VERTEX',{projection:null});
  return proof('READY',null,'PROJECT_Q6_VERTEX',{projection:projectionOf(parsed.vertex,settings),settings:settings});
}
function projectGraph(options){
  var settings=projectionOptions(options),projected,byId,edges;
  if(!settings) return proof('INVALID','Q6_PROJECTION_SCALE','PROJECT_Q6_GRAPH',{vertices:[],edges:[]});
  projected=GRAPH.vertices.map(function(vertex){ return projectionOf(vertex,settings); });
  byId=projected;
  edges=GRAPH.edges.map(function(edge){
    var a=byId[edge.from].position,b=byId[edge.to].position,dx=a[0]-b[0],dy=a[1]-b[1],dz=a[2]-b[2];
    return freeze({
      from:edge.from,to:edge.to,changedBit:edge.changedBit,changedPredicate:edge.changedPredicate,
      topology:'HAMMING_ONE',screenDistance:Math.sqrt(dx*dx+dy*dy+dz*dz),screenDistanceSemantic:false
    });
  });
  return proof('READY',null,'PROJECT_Q6_GRAPH',{
    projection:'Q3xQ3_CUBE_OF_CUBES',settings:settings,vertices:projected,edges:edges,
    topologyTruth:'HAMMING_ONE',screenDistanceSemantic:false
  });
}

function allowedBits(options){
  var source,mask=[true,true,true,true,true,true],index,name;
  if(options==null) return {ok:true,mask:mask};
  if(Array.isArray(options)) source=options;
  else if(plain(options)){
    if(own(options,'allowedBits')) source=options.allowedBits;
    else if(own(options,'allowedChanges')) source=options.allowedChanges;
    else if(own(options,'allowedPredicates')) source=options.allowedPredicates;
    else return {ok:true,mask:mask};
  }else return {ok:false,code:'Q6_ALLOWED_BITS_TYPE'};
  if(plain(source)){
    mask=[];
    for(index=0;index<DIMENSION;index++){
      name=PREDICATE_NAMES[index];
      if(!own(source,name)||typeof source[name]!=='boolean') return {ok:false,code:'Q6_ALLOWED_BITS_TYPE'};
      mask.push(source[name]);
    }
    return {ok:true,mask:mask};
  }
  if(!Array.isArray(source)) return {ok:false,code:'Q6_ALLOWED_BITS_TYPE'};
  if(source.length===DIMENSION&&source.every(function(value){ return typeof value==='boolean'; })) return {ok:true,mask:source.slice()};
  mask=[false,false,false,false,false,false];
  for(index=0;index<source.length;index++){
    if(typeof source[index]==='string') name=text(source[index]);
    else if(Number.isInteger(source[index])&&source[index]>=0&&source[index]<DIMENSION) name=PREDICATE_NAMES[source[index]];
    else return {ok:false,code:'Q6_ALLOWED_BIT'};
    if(PREDICATE_INDEX[name]===undefined) return {ok:false,code:'Q6_ALLOWED_BIT'};
    mask[PREDICATE_INDEX[name]]=true;
  }
  return {ok:true,mask:mask};
}
function maskNames(mask){
  return PREDICATE_NAMES.filter(function(name,index){ return mask[index]; });
}
function verifyTransition(left,right,options){
  var a=resolveVertex(left),b=resolveVertex(right),allowed=allowedBits(options),distance,bit;
  if(!a.ok) return proof(a.status,a.code,'VERIFY_Q6_TRANSITION',{valid:false,transition:null});
  if(!b.ok) return proof(b.status,b.code,'VERIFY_Q6_TRANSITION',{valid:false,transition:null});
  if(!allowed.ok) return proof('INVALID',allowed.code,'VERIFY_Q6_TRANSITION',{valid:false,transition:null});
  distance=hammingDistance(a.vertex,b.vertex);
  if(distance!==1) return proof('INVALID','Q6_TRANSITION_NOT_EDGE','VERIFY_Q6_TRANSITION',{valid:false,distance:distance,transition:null});
  bit=changedBit(a.vertex,b.vertex);
  if(!allowed.mask[bit]) return proof('BLOCKED','Q6_TRANSITION_BIT_BLOCKED','VERIFY_Q6_TRANSITION',{
    valid:false,distance:1,changedBit:bit,changedPredicate:PREDICATE_NAMES[bit],transition:null
  });
  return proof('READY',null,'VERIFY_Q6_TRANSITION',{
    valid:true,distance:1,
    transition:freeze({from:a.vertex,to:b.vertex,changedBit:bit,changedPredicate:PREDICATE_NAMES[bit]}),
    allowedBits:maskNames(allowed.mask)
  });
}
function pathValues(path){
  if(Array.isArray(path)) return path;
  if(plain(path)&&Array.isArray(path.path)) return path.path;
  return null;
}
function verifyPath(path,options){
  var values=pathValues(path),allowed=allowedBits(options),vertices=[],steps=[],index,parsed,transition,distance,expectedStart,expectedTarget;
  if(!values||!values.length) return proof('INVALID','Q6_PATH_REQUIRED','VERIFY_Q6_PATH',{valid:false,path:[],steps:[]});
  if(!allowed.ok) return proof('INVALID',allowed.code,'VERIFY_Q6_PATH',{valid:false,path:[],steps:[]});
  for(index=0;index<values.length;index++){
    parsed=resolveVertex(values[index]);
    if(!parsed.ok) return proof(parsed.status,parsed.code,'VERIFY_Q6_PATH',{valid:false,path:vertices,steps:steps,failedAt:index});
    vertices.push(parsed.vertex);
  }
  for(index=1;index<vertices.length;index++){
    transition=verifyTransition(vertices[index-1],vertices[index],{allowedBits:allowed.mask});
    if(transition.status!=='READY') return proof('INVALID',transition.code,'VERIFY_Q6_PATH',{valid:false,path:vertices,steps:steps,failedAt:index});
    steps.push(transition.transition);
  }
  if(plain(options)&&own(options,'start')){
    expectedStart=resolveVertex(options.start);
    if(!expectedStart.ok||expectedStart.vertex.id!==vertices[0].id) return proof('INVALID','Q6_PATH_START','VERIFY_Q6_PATH',{valid:false,path:vertices,steps:steps});
  }
  if(plain(options)&&own(options,'target')){
    expectedTarget=resolveVertex(options.target);
    if(!expectedTarget.ok||expectedTarget.vertex.id!==vertices[vertices.length-1].id) return proof('INVALID','Q6_PATH_TARGET','VERIFY_Q6_PATH',{valid:false,path:vertices,steps:steps});
  }
  distance=hammingDistance(vertices[0],vertices[vertices.length-1]);
  if(steps.length!==distance) return proof('INVALID','Q6_PATH_NOT_SHORTEST','VERIFY_Q6_PATH',{
    valid:false,path:vertices,steps:steps,distance:distance
  });
  return proof('READY',null,'VERIFY_Q6_PATH',{
    valid:true,path:vertices,steps:steps,distance:distance,allowedBits:maskNames(allowed.mask),shortest:true
  });
}
function findCounterfactual(start,target,options){
  var from=resolveVertex(start),to=resolveVertex(target),allowed=allowedBits(options),required=[],blocked=[],currentBits,path=[],steps=[],index,bit,next,verified;
  if(!from.ok) return proof(from.status,from.code,'FIND_COUNTERFACTUAL',{path:[],steps:[],start:null,target:null});
  if(!to.ok) return proof(to.status,to.code,'FIND_COUNTERFACTUAL',{path:[],steps:[],start:from.vertex,target:null});
  if(!allowed.ok) return proof('INVALID',allowed.code,'FIND_COUNTERFACTUAL',{path:[],steps:[],start:from.vertex,target:to.vertex});
  for(index=0;index<DIMENSION;index++){
    if(from.vertex.bits[index]===to.vertex.bits[index]) continue;
    required.push(index);
    if(!allowed.mask[index]) blocked.push(index);
  }
  if(blocked.length) return proof('ABSTAIN','Q6_COUNTERFACTUAL_UNREACHABLE','FIND_COUNTERFACTUAL',{
    start:from.vertex,target:to.vertex,path:[],steps:[],requiredDistance:required.length,
    blockedBits:blocked.map(function(value){ return freeze({bit:value,name:PREDICATE_NAMES[value]}); }),
    allowedBits:maskNames(allowed.mask),shortest:false
  });
  currentBits=from.vertex.bits.slice();
  path.push(from.vertex);
  for(index=0;index<required.length;index++){
    bit=required[index];
    currentBits[bit]=to.vertex.bits[bit];
    next=GRAPH.vertices[idFromBits(currentBits)];
    steps.push(freeze({
      index:index+1,from:path[path.length-1],to:next,changedBit:bit,
      changedPredicate:PREDICATE_NAMES[bit],reason:'TARGET_BIT_DIFFERS',
      evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
    }));
    path.push(next);
  }
  verified=verifyPath(path,{allowedBits:allowed.mask,start:from.vertex,target:to.vertex});
  if(verified.status!=='READY') return proof('INVALID','Q6_COUNTERFACTUAL_VERIFICATION','FIND_COUNTERFACTUAL',{
    start:from.vertex,target:to.vertex,path:path,steps:steps,verification:verified
  });
  return proof('READY',null,'FIND_COUNTERFACTUAL',{
    start:from.vertex,target:to.vertex,path:path,steps:steps,distance:required.length,
    allowedBits:maskNames(allowed.mask),shortest:true,canonicalOrder:'PREDICATE_BIT_ASCENDING',verification:verified
  });
}

function graphCheck(name,actual,expected){ return freeze({name:name,ok:actual===expected,actual:actual,expected:expected}); }
function verifyGraph(candidate){
  var graph=candidate==null?GRAPH:candidate,checks=[],vertices,edges,ids={},pairs={},degrees=[],canonical=true,edgeShape=true,edgeHamming=true,edgeBits=true,unique=true,index,vertex,edge,a,b,distance,bit,key,connected=0,queue,seen={},localEdges=0,macroEdges=0,adjacencyOk=true,expectedNeighbors,actualNeighbors,neighborSeen;
  if(!plain(graph)||!Array.isArray(graph.vertices)||!Array.isArray(graph.edges)) return proof('INVALID','Q6_GRAPH_SHAPE','VERIFY_Q6_GRAPH',{valid:false,checks:[]});
  vertices=graph.vertices; edges=graph.edges;
  checks.push(graphCheck('dimension',graph.dimension,DIMENSION));
  checks.push(graphCheck('declared-degree',graph.degree,DEGREE));
  checks.push(graphCheck('vertex-count',vertices.length,VERTEX_COUNT));
  for(index=0;index<vertices.length;index++){
    vertex=vertices[index];
    if(!plain(vertex)||!Number.isInteger(vertex.id)||vertex.id!==index||vertex.id<0||vertex.id>=VERTEX_COUNT||ids[vertex.id]){ canonical=false; continue; }
    ids[vertex.id]=true;
    if(!Array.isArray(vertex.bits)||vertex.bits.length!==DIMENSION||vertex.bits.some(function(value){ return value!==0&&value!==1; })||idFromBits(vertex.bits)!==vertex.id) canonical=false;
  }
  checks.push(graphCheck('canonical-vertices',canonical&&Object.keys(ids).length,VERTEX_COUNT));
  for(index=0;index<VERTEX_COUNT;index++) degrees.push(0);
  for(index=0;index<edges.length;index++){
    edge=edges[index];
    if(!plain(edge)||!Number.isInteger(edge.from)||!Number.isInteger(edge.to)||edge.from===edge.to||!ids[edge.from]||!ids[edge.to]){ edgeShape=false; continue; }
    a=vertices.find(function(item){ return item.id===edge.from; });
    b=vertices.find(function(item){ return item.id===edge.to; });
    key=Math.min(edge.from,edge.to)+'--'+Math.max(edge.from,edge.to);
    if(pairs[key]) unique=false;
    pairs[key]=true;
    distance=hammingDistance(a.bits,b.bits);
    bit=changedBit(a.bits,b.bits);
    if(distance!==1) edgeHamming=false;
    if(edge.changedBit!==bit||edge.changedPredicate!==PREDICATE_NAMES[bit]) edgeBits=false;
    if(distance===1){
      degrees[edge.from]++; degrees[edge.to]++;
      if(bit<3) localEdges++; else macroEdges++;
    }
  }
  checks.push(graphCheck('edge-count',edges.length,EDGE_COUNT));
  checks.push(graphCheck('unique-undirected-edges',unique&&Object.keys(pairs).length,EDGE_COUNT));
  checks.push(graphCheck('edge-shape',edgeShape,true));
  checks.push(graphCheck('hamming-one',edgeHamming,true));
  checks.push(graphCheck('typed-edge-bit',edgeBits,true));
  checks.push(graphCheck('degree-six',degrees.filter(function(value){ return value===DEGREE; }).length,VERTEX_COUNT));
  checks.push(graphCheck('local-q3-edges',localEdges,96));
  checks.push(graphCheck('macro-q3-edges',macroEdges,96));
  if(Array.isArray(graph.adjacency)&&graph.adjacency.length===VERTEX_COUNT){
    for(index=0;index<VERTEX_COUNT;index++){
      actualNeighbors=graph.adjacency[index];
      expectedNeighbors=[];
      neighborSeen={};
      for(bit=0;bit<DIMENSION;bit++) expectedNeighbors.push(index^(1<<(DIMENSION-1-bit)));
      if(!Array.isArray(actualNeighbors)||actualNeighbors.length!==DEGREE){ adjacencyOk=false; continue; }
      for(a=0;a<actualNeighbors.length;a++){
        b=actualNeighbors[a];
        if(!Number.isInteger(b)||neighborSeen[b]||expectedNeighbors.indexOf(b)===-1||!pairs[Math.min(index,b)+'--'+Math.max(index,b)]){
          adjacencyOk=false;
          break;
        }
        neighborSeen[b]=true;
      }
    }
  }else adjacencyOk=false;
  checks.push(graphCheck('adjacency-index',adjacencyOk,true));
  if(Object.keys(ids).length===VERTEX_COUNT){
    queue=[0]; seen[0]=true;
    while(queue.length){
      a=queue.shift(); connected++;
      for(bit=0;bit<DIMENSION;bit++){
        b=a^(1<<(DIMENSION-1-bit));
        if(ids[b]&&!seen[b]&&pairs[Math.min(a,b)+'--'+Math.max(a,b)]){ seen[b]=true; queue.push(b); }
      }
    }
  }
  checks.push(graphCheck('connected',connected,VERTEX_COUNT));
  var valid=checks.every(function(item){ return item.ok; });
  return proof(valid?'READY':'INVALID',valid?null:'Q6_GRAPH_INVARIANT','VERIFY_Q6_GRAPH',{
    valid:valid,checks:checks,summary:{vertices:vertices.length,degree:degrees.length?Math.min.apply(Math,degrees):0,edges:edges.length,connected:connected},
    topologyTruth:'HAMMING_ONE',screenDistanceChecked:false,screenDistanceSemantic:false,
    contract:{pre:{ok:true},inv:{ok:valid,group:'(Z2)^6'},post:{ok:valid,counts:'64/6/192'}}
  });
}

var API=freeze({
  version:VERSION,
  kind:KIND,
  dimension:DIMENSION,
  vertexCount:VERTEX_COUNT,
  degree:DEGREE,
  edgeCount:EDGE_COUNT,
  unknown:UNKNOWN,
  evidence:STRUCTURAL,
  evidenceLevel:STRUCTURAL,
  soundness:NOT_COMPUTED,
  profile:PROFILE,
  predicateNames:PREDICATE_NAMES,
  graph:GRAPH,
  getGraph:function(){ return GRAPH; },
  getVertex:getVertex,
  hammingDistance:hammingDistance,
  changedBit:changedBit,
  isAdjacent:isAdjacent,
  neighbors:neighbors,
  diagnose:diagnose,
  projectVertex:projectVertex,
  projectGraph:projectGraph,
  findCounterfactual:findCounterfactual,
  verifyTransition:verifyTransition,
  verifyPath:verifyPath,
  verifyGraph:verifyGraph
});

global.MRDP78Q6Diagnostics=API;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
