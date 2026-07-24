(function(global){
'use strict';

var VERSION='1.0.0';
var REVISION_PREFIX='p78-r3';

function freeze(value){
  if(!value||typeof value!=='object'||typeof Object.freeze!=='function') return value;
  Object.keys(value).forEach(function(key){ freeze(value[key]); });
  return Object.freeze(value);
}
function copy(source){
  var out={};
  Object.keys(source).forEach(function(key){ out[key]=source[key]; });
  return out;
}

var DEFAULTS=freeze({
  revisionPrefix:REVISION_PREFIX,
  field:{maxDepth:3,budget:8},
  runtime:{
    cellSize:.025,radius:.045,tickBudget:3,candidateBudget:160,pairBudget:2800,
    cascadeBudget:12,maxGeneration:3,cooldown:2,activationDelay:1,cascadeTTL:90,
    rearmAfter:24,historyLimit:18,calibrationGain:.12,calibrationPriority:20,
    opportunityDecay:.92
  },
  outputInterval:6,
  stepTimeout:320,
  uiTimeout:260
});

function nextEpoch(value){
  value=Number(value);
  if(!Number.isSafeInteger(value)||value<0) value=0;
  if(value===Number.MAX_SAFE_INTEGER) throw new RangeError('P78_RUNTIME_EPOCH_EXHAUSTED');
  return value+1;
}

function create(config){
  config=config||{};
  var state=config.state;
  if(!state||typeof state!=='object') throw new TypeError('P78_REACTION_KERNEL_STATE_REQUIRED');
  if(typeof config.scheduleIdle!=='function'||typeof config.now!=='function'||
    typeof config.hashText!=='function'||typeof config.readRevisionInput!=='function'||
    typeof config.isRunning!=='function'||typeof config.readRuntimeInput!=='function'||typeof config.applyResult!=='function'||
    typeof config.flushUi!=='function') throw new TypeError('P78_REACTION_KERNEL_CONFIG_INVALID');

  var fieldEngine=config.fieldEngine||null;
  var runtimeEngine=config.runtimeEngine||null;
  var rulebook=config.rulebook||null;
  var scheduleIdle=config.scheduleIdle;
  var now=config.now;
  var hashText=config.hashText;
  var readRevisionInput=config.readRevisionInput;
  var isRunning=config.isRunning;
  var readRuntimeInput=config.readRuntimeInput;
  var applyResult=config.applyResult;
  var flushUi=config.flushUi;

  function epoch(){
    var value=Number(state.runtimeEpoch);
    return Number.isSafeInteger(value)&&value>=0?value:0;
  }
  function runtimeInput(){
    var value=readRuntimeInput();
    return value&&typeof value==='object'?value:{};
  }
  function revision(){
    var input=readRevisionInput()||{};
    var ruleHash=rulebook&&rulebook.hash||'no-rules';
    return REVISION_PREFIX+'|'+String(ruleHash)+'|'+String(input.analysisHash||0)+'|'+
      String(input.lambdaRaw)+'|'+String(hashText(input.target||''))+'|'+
      String(input.mode||'orbit')+'|'+String(input.triggerToken||'');
  }
  function clearUiPayload(){
    state.uiTextDirty=false;
    state.uiMenuDirty=false;
    state.uiEvent='';
    state.uiPayloadEpoch=null;
  }
  function uiPayload(){
    return {
      textDirty:!!state.uiTextDirty,
      menuDirty:!!state.uiMenuDirty,
      event:state.uiEvent||''
    };
  }
  function canAdvance(){
    return !!(runtimeEngine&&typeof runtimeEngine.step==='function'&&state.runtime&&state.runtime.status!=='BLOCKED');
  }

  function recalculate(input,lambda){
    var field=null;
    if(fieldEngine&&typeof fieldEngine.simulate==='function'){
      field=fieldEngine.simulate(input,lambda,copy(DEFAULTS.field))||null;
    }
    state.field=field;
    return field;
  }

  function initialize(){
    state.runtimeEpoch=nextEpoch(state.runtimeEpoch);
    var input,created;
    state.revision=revision();
    state.tick=0;
    state.lastResult=null;
    state.runtimeMs=0;
    state.runtime=null;
    clearUiPayload();
    if(!runtimeEngine||typeof runtimeEngine.create!=='function'||!state.field) return null;
    input=runtimeInput();
    if(!Array.isArray(input.particles)||!input.particles.length) return null;
    created=runtimeEngine.create({
      revision:state.revision,
      field:state.field,
      particles:input.particles,
      options:copy(DEFAULTS.runtime)
    });
    state.runtime=created||null;
    return state.runtime;
  }

  function advanceWith(input){
    if(!canAdvance()) return null;
    var nextTick=state.runtime.tick+1;
    var started=now();
    var result=runtimeEngine.step(state.runtime,{
      revision:state.revision,
      tick:nextTick,
      worldTick:input.worldTick,
      lambda:input.lambda,
      particles:input.particles
    });
    state.runtimeMs=now()-started;
    state.lastResult=result;
    state.runtime=result.state;
    state.tick=nextTick;
    var message=applyResult(result);
    scheduleUi(message,nextTick===1||nextTick%DEFAULTS.outputInterval===0);
    return result;
  }

  function advance(){
    return canAdvance()?advanceWith(runtimeInput()):null;
  }

  function scheduleStep(){
    var scheduledEpoch=epoch();
    if(!isRunning()) return false;
    if(state.stepScheduled&&state.stepScheduledEpoch===scheduledEpoch) return false;
    var scheduledRevision=state.revision;
    state.stepScheduled=true;
    state.stepScheduledEpoch=scheduledEpoch;
    scheduleIdle(function(){
      if(state.stepScheduledEpoch===scheduledEpoch){
        state.stepScheduled=false;
        state.stepScheduledEpoch=null;
      }
      if(epoch()!==scheduledEpoch) return;
      if(!isRunning()||state.revision!==scheduledRevision) return;
      advanceWith(runtimeInput());
    },DEFAULTS.stepTimeout);
    return true;
  }

  function scheduleUi(message,includeOutput){
    var scheduledEpoch=epoch();
    if(state.uiPayloadEpoch!==scheduledEpoch){
      clearUiPayload();
      state.uiPayloadEpoch=scheduledEpoch;
    }
    if(message) state.uiEvent=message;
    state.uiTextDirty=state.uiTextDirty||!!includeOutput;
    state.uiMenuDirty=state.uiMenuDirty||!!includeOutput;
    if(state.uiScheduled&&state.uiScheduledEpoch===scheduledEpoch) return false;
    var scheduledRevision=state.revision;
    state.uiScheduled=true;
    state.uiScheduledEpoch=scheduledEpoch;
    scheduleIdle(function(){
      if(state.uiScheduledEpoch===scheduledEpoch){
        state.uiScheduled=false;
        state.uiScheduledEpoch=null;
      }
      if(epoch()!==scheduledEpoch||state.revision!==scheduledRevision||state.uiPayloadEpoch!==scheduledEpoch) return;
      var payload=uiPayload();
      flushUi(payload);
      if(epoch()!==scheduledEpoch||state.revision!==scheduledRevision||state.uiPayloadEpoch!==scheduledEpoch) return;
      if(state.uiScheduled&&state.uiScheduledEpoch===scheduledEpoch) return;
      clearUiPayload();
    },DEFAULTS.uiTimeout);
    return true;
  }

  function snapshot(){
    return runtimeEngine&&state.runtime&&typeof runtimeEngine.snapshot==='function'?
      runtimeEngine.snapshot(state.runtime):null;
  }
  function particle(index){
    var particles=state.field&&state.field.particles||[];
    return index>=0&&index<particles.length?particles[index]:null;
  }
  function getField(){ return state.field||null; }

  return {
    recalculate:recalculate,
    initialize:initialize,
    scheduleStep:scheduleStep,
    advance:advance,
    scheduleUi:scheduleUi,
    snapshot:snapshot,
    particle:particle,
    getField:getField
  };
}

global.MRDP78ReactionKernel=freeze({version:VERSION,defaults:DEFAULTS,create:create});
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
