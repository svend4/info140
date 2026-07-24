(function(global){
'use strict';

var VERSION='1.2.0';
var LIVE_KIND='MRDP78RuntimeState';
var SNAPSHOT_KIND='MRDP78RuntimeStateSnapshot';
var SECTIONS=['worldState','reactionState','semanticState','uiState'];

function plain(value){
  if(!value||Object.prototype.toString.call(value)!=='[object Object]') return false;
  var proto=Object.getPrototypeOf(value);
  return proto===null||!!(proto&&proto.constructor&&proto.constructor.name==='Object');
}
function own(value,key){ return Object.prototype.hasOwnProperty.call(value,key); }
function worldDefaults(){
  return {
    seed:987654321,tick:0,running:true,irr:true,coreHits:0,edgeHits:0,
    drops:[],shards:[],rings:[],trace:[],islands:[],links:[],signal:0,
    frame:{serial:0,lastAt:0,healthSamples:[],workMs:0,simulationMs:0,drawMs:0,substeps:0}
  };
}
function reactionDefaults(){
  return {
    field:null,runtime:null,lastResult:null,revision:'',tick:0,runtimeEpoch:0,
    stepScheduled:false,stepScheduledEpoch:null,uiScheduled:false,uiScheduledEpoch:null,
    uiTextDirty:false,uiMenuDirty:false,uiEvent:'',uiPayloadEpoch:null,runtimeMs:0
  };
}
function semanticDefaults(){
  return {
    analysis:null,impulse:null,impulseRank:null,continuationPlan:null,trajectory:null,proofTrace:null,
    guard:null,balance:null,archipelago:null,weave:null,windowRhythm:null,backtrack:null,goal:null,phi:null,rails:null,
    textResult:null,traceOverlay:null,traceParticleLookup:{},parameterCounterfactual:null,outputMenu:null,
    marginalCorridor:null,continuationProtocol:null,decision:null,transaction:null,action:null,data:null,dataLoadPromise:null,ledger:null,
    renderSource:'',renderTarget:''
  };
}
function uiDefaults(){
  return {
    backgroundGradient:null,panelUpdateScheduled:false,parameterCounterfactualScheduled:false,
    portalUndo:[],portalLog:[],forecastPath:[],continuationPath:[],balancePath:[],trajectoryPath:[],
    archipelagoPath:[],weavePath:[],windowPath:[],backtrackPath:[],goalPath:[],phiPath:[],railsPath:[]
  };
}
function defaults(){
  return {worldState:worldDefaults(),reactionState:reactionDefaults(),semanticState:semanticDefaults(),uiState:uiDefaults()};
}
function liveCopy(value,seen){
  if(value==null||typeof value!=='object') return value;
  if(!Array.isArray(value)&&!plain(value)) return value;
  if(seen.has(value)) return seen.get(value);
  var out=Array.isArray(value)?[]:{};
  seen.set(value,out);
  if(Array.isArray(value)){
    for(var i=0;i<value.length;i++) out.push(liveCopy(value[i],seen));
  }else{
    Object.keys(value).forEach(function(key){ out[key]=liveCopy(value[key],seen); });
  }
  return out;
}
function sectionFrom(template,override,seen){
  var out={};
  Object.keys(template).forEach(function(key){
    var value=override&&own(override,key)?override[key]:template[key];
    out[key]=liveCopy(value,seen);
  });
  return out;
}
function normalizeOverrides(overrides){ return plain(overrides)?overrides:{}; }
function build(overrides){
  overrides=normalizeOverrides(overrides);
  var base=defaults(),seen=new WeakMap();
  return {
    version:VERSION,kind:LIVE_KIND,
    worldState:sectionFrom(base.worldState,plain(overrides.worldState)?overrides.worldState:null,seen),
    reactionState:sectionFrom(base.reactionState,plain(overrides.reactionState)?overrides.reactionState:null,seen),
    semanticState:sectionFrom(base.semanticState,plain(overrides.semanticState)?overrides.semanticState:null,seen),
    uiState:sectionFrom(base.uiState,plain(overrides.uiState)?overrides.uiState:null,seen)
  };
}
function createState(overrides){ return build(overrides); }
function validState(state){
  return plain(state)&&state.kind===LIVE_KIND&&SECTIONS.every(function(name){return plain(state[name]);});
}
function snapshotValue(value,seen){
  if(value==null||typeof value==='string'||typeof value==='number'||typeof value==='boolean') return value;
  if(typeof value!=='object') return null;
  if(!Array.isArray(value)&&!plain(value)) return null;
  if(seen.has(value)) return seen.get(value);
  var out=Array.isArray(value)?[]:{};
  seen.set(value,out);
  if(Array.isArray(value)){
    for(var i=0;i<value.length;i++) out.push(snapshotValue(value[i],seen));
  }else{
    Object.keys(value).forEach(function(key){ out[key]=snapshotValue(value[key],seen); });
  }
  return out;
}
function projectSection(source,template,seen){
  var out={};
  seen.set(source,out);
  Object.keys(template).forEach(function(key){ out[key]=snapshotValue(source[key],seen); });
  return out;
}
function freezeDeep(value,seen){
  if(!value||typeof value!=='object'||seen.has(value)) return value;
  seen.add(value);
  Object.keys(value).forEach(function(key){ freezeDeep(value[key],seen); });
  return Object.freeze(value);
}
function snapshot(state){
  if(!validState(state)) throw new TypeError('P78_RUNTIME_STATE_INVALID');
  var base=defaults(),seen=new WeakMap();
  var out={version:VERSION,kind:SNAPSHOT_KIND};
  out.worldState=projectSection(state.worldState,base.worldState,seen);
  out.reactionState=projectSection(state.reactionState,base.reactionState,seen);
  out.semanticState=projectSection(state.semanticState,base.semanticState,seen);
  out.uiState=projectSection(state.uiState,base.uiState,seen);
  return freezeDeep(out,new WeakSet());
}
function replaceSection(target,source){
  Object.keys(target).forEach(function(key){ delete target[key]; });
  Object.keys(source).forEach(function(key){ target[key]=source[key]; });
}
function nextRuntimeEpoch(state){
  var epoch=state.reactionState.runtimeEpoch;
  if(!Number.isSafeInteger(epoch)||epoch<0) throw new TypeError('P78_RUNTIME_STATE_INVALID');
  if(epoch===Number.MAX_SAFE_INTEGER) throw new RangeError('P78_RUNTIME_EPOCH_EXHAUSTED');
  return epoch+1;
}
function reset(state,overrides){
  if(!validState(state)) throw new TypeError('P78_RUNTIME_STATE_INVALID');
  var runtimeEpoch=nextRuntimeEpoch(state);
  var fresh=build(overrides);
  fresh.reactionState.runtimeEpoch=runtimeEpoch;
  replaceSection(state.worldState,fresh.worldState);
  replaceSection(state.reactionState,fresh.reactionState);
  replaceSection(state.semanticState,fresh.semanticState);
  replaceSection(state.uiState,fresh.uiState);
  state.version=VERSION; state.kind=LIVE_KIND;
  return state;
}

global.MRDP78RuntimeState={
  version:VERSION,liveKind:LIVE_KIND,snapshotKind:SNAPSHOT_KIND,sections:SECTIONS.slice(),
  createState:createState,snapshot:snapshot,reset:reset
};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
