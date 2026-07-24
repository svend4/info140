(function(global){
'use strict';

var VERSION='1.0.0';
var REQUEST_SCHEMA='meridian.evidence-backed-link-worker-request/1';
var RESPONSE_SCHEMA='meridian.evidence-backed-link-worker-response/1';
var Projector=global.MRDP78EvidenceBackedLinkProjector;

function blocked(code){
  global.MRDP78EvidenceBackedLinkRunner=Object.freeze({
    version:VERSION,status:'BLOCKED',code:code,semanticTruth:false,commitAllowed:false
  });
}

if(!Projector||Projector.status!=='READY'||Projector.version!=='1.1.0'||
   typeof Projector.snapshotViewModel!=='function'){
  blocked('EVIDENCE_BACKED_LINK_RUNNER_DEPENDENCY_UNAVAILABLE');
  return;
}

var freeze=Object.freeze;
var DEFAULT_TIMEOUT_MS=15000;
var MIN_TIMEOUT_MS=1000;
var MAX_TIMEOUT_MS=60000;

function safeCode(value,fallback){
  return typeof value==='string'&&value.length&&value.length<=128?value:fallback;
}
function createOutcome(status,requestId,model,code){
  return freeze({
    schema:'meridian.evidence-backed-link-runner-outcome/1',version:VERSION,
    status:status,requestId:requestId,model:model||null,code:code||null,
    semanticTruth:false,commitAllowed:false
  });
}
function create(options){
  var config=options&&typeof options==='object'?options:{};
  var workerUrl=typeof config.workerUrl==='string'&&config.workerUrl.length?config.workerUrl:'lib/p78-evidence-backed-link-worker.js?v=1.0.0';
  var workerFactory=typeof config.workerFactory==='function'?config.workerFactory:null;
  var timeoutMs=Number.isSafeInteger(config.timeoutMs)?config.timeoutMs:DEFAULT_TIMEOUT_MS;
  var worker=null,state='NEW',nextRequestId=0,latestRequestId=0,pending=Object.create(null),destroyed=false;
  if(timeoutMs<MIN_TIMEOUT_MS||timeoutMs>MAX_TIMEOUT_MS) throw new RangeError('EVIDENCE_BACKED_LINK_RUNNER_TIMEOUT_INVALID');

  function deliver(requestId,outcome){
    var record=pending[requestId];
    if(!record) return;
    delete pending[requestId];
    if(record.timer!==null) global.clearTimeout(record.timer);
    if(requestId!==latestRequestId||destroyed) return;
    record.callback(outcome);
  }
  function failPending(code){
    var ids=Object.keys(pending),i,id;
    for(i=0;i<ids.length;i++){
      id=Number(ids[i]);
      deliver(id,createOutcome('ERROR',id,null,code));
    }
  }
  function resetWorker(code){
    var current=worker;
    worker=null;
    state='FAILED';
    if(current&&typeof current.terminate==='function'){
      try{ current.terminate(); }catch(ignoreTerminate){}
    }
    failPending(code);
  }
  function onMessage(event){
    var message=event&&event.data,report;
    if(!message||message.schema!==RESPONSE_SCHEMA||message.version!=='1.0.0'||
       !Number.isSafeInteger(message.requestId)||message.requestId<1){
      resetWorker('WORKER_PROTOCOL_INVALID');
      return;
    }
    if(!pending[message.requestId]) return;
    if(message.status==='READY'){
      report=Projector.snapshotViewModel(message.model);
      if(!report||report.status!=='VALID'){
        deliver(message.requestId,createOutcome('ERROR',message.requestId,null,'WORKER_MODEL_INVALID'));
        return;
      }
      deliver(message.requestId,createOutcome('READY',message.requestId,report.model,null));
      return;
    }
    if(message.status==='ERROR'){
      deliver(message.requestId,createOutcome('ERROR',message.requestId,null,safeCode(message.code,'WORKER_PROJECTION_FAILED')));
      return;
    }
    resetWorker('WORKER_PROTOCOL_INVALID');
  }
  function onError(){ resetWorker('WORKER_RUNTIME_FAILED'); }
  function ensureWorker(){
    var created;
    if(worker) return worker;
    if(destroyed) return null;
    try{
      if(workerFactory) created=workerFactory(workerUrl);
      else if(typeof global.Worker==='function') created=new global.Worker(workerUrl);
      else return null;
      if(!created||typeof created.postMessage!=='function'||typeof created.addEventListener!=='function'){
        if(created&&typeof created.terminate==='function'){
          try{ created.terminate(); }catch(ignoreInvalidTerminate){}
        }
        return null;
      }
      worker=created;
      created.addEventListener('message',function(event){
        if(created===worker) onMessage(event);
      });
      created.addEventListener('error',function(){
        if(created===worker) onError();
      });
      state='READY';
      return created;
    }catch(error){
      worker=null;
      state='FAILED';
      return null;
    }
  }
  function project(definition,callback){
    var active,id,keys,i,oldId,message;
    if(destroyed) throw new Error('EVIDENCE_BACKED_LINK_RUNNER_DESTROYED');
    if(typeof callback!=='function') throw new TypeError('EVIDENCE_BACKED_LINK_RUNNER_CALLBACK_REQUIRED');
    id=++nextRequestId;
    latestRequestId=id;
    keys=Object.keys(pending);
    if(keys.length&&worker){
      try{ worker.terminate(); }catch(ignoreStaleTerminate){}
      worker=null;
      state='NEW';
    }
    for(i=0;i<keys.length;i++){
      oldId=Number(keys[i]);
      if(pending[oldId].timer!==null) global.clearTimeout(pending[oldId].timer);
      delete pending[oldId];
    }
    active=ensureWorker();
    if(!active){
      callback(createOutcome('ERROR',id,null,'WEB_WORKER_UNAVAILABLE'));
      return freeze({requestId:id,status:'ERROR'});
    }
    pending[id]={
      callback:callback,
      timer:global.setTimeout(function(){
        if(!pending[id]) return;
        deliver(id,createOutcome('ERROR',id,null,'WORKER_TIMEOUT'));
        resetWorker('WORKER_TIMEOUT');
      },timeoutMs)
    };
    message={schema:REQUEST_SCHEMA,version:'1.0.0',type:'PROJECT',requestId:id,definition:definition};
    try{ active.postMessage(message); }
    catch(error){ resetWorker('WORKER_POST_FAILED'); }
    return freeze({requestId:id,status:pending[id]?'QUEUED':'ERROR'});
  }
  function cancel(){
    var keys=Object.keys(pending),i,id,current=worker;
    latestRequestId=++nextRequestId;
    for(i=0;i<keys.length;i++){
      id=Number(keys[i]);
      if(pending[id].timer!==null) global.clearTimeout(pending[id].timer);
      delete pending[id];
    }
    worker=null;
    if(current&&typeof current.terminate==='function'){
      try{ current.terminate(); }catch(ignoreCancelTerminate){}
    }
    if(!destroyed) state='NEW';
    return freeze({requestId:latestRequestId,status:'CANCELLED'});
  }
  function destroy(){
    if(destroyed) return;
    cancel();
    destroyed=true;
    if(worker&&typeof worker.terminate==='function'){
      try{ worker.terminate(); }catch(ignoreTerminate){}
    }
    worker=null;
    state='DESTROYED';
  }
  return freeze({
    version:VERSION,status:'READY',workerUrl:workerUrl,timeoutMs:timeoutMs,
    project:project,cancel:cancel,destroy:destroy,
    getState:function(){ return state; }
  });
}

global.MRDP78EvidenceBackedLinkRunner=freeze({
  version:VERSION,status:'READY',schema:'meridian.evidence-backed-link-runner/1',
  requestSchema:REQUEST_SCHEMA,responseSchema:RESPONSE_SCHEMA,
  defaultTimeoutMs:DEFAULT_TIMEOUT_MS,projectorVersion:Projector.version,
  semanticTruth:false,commitAllowed:false,create:create
});
})(typeof globalThis!=='undefined'?globalThis:this);
