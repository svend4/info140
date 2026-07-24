(function(global){
'use strict';

var VERSION='1.0.1';
var CHANNEL='p78-neighbors-v1';
var REQUEST_KEY='p78.exchange.request.';
var RESULT_KEY='p78.exchange.result.';
var contract=global.MRDP78ExchangeContract;
var root=global.document&&document.getElementById('neighborWorlds');
var sourceEl=global.document&&document.getElementById('condition');
var goalEl=global.document&&document.getElementById('goalTarget');
var reportEl=global.document&&document.getElementById('neighborReport');
var pending={};
var epoch=0;
var channel=null;

function clean(value){ return value==null?'':String(value).trim(); }
function statusNode(world){ return root&&root.querySelector('[data-world-status="'+world+'"]'); }
function setStatus(world,status,value){
  var node=statusNode(world);
  if(!node) return;
  node.dataset.status=status||'';
  node.textContent=value||status||'';
}
function report(value){ if(reportEl) reportEl.textContent=value; }
function storage(){
  try{return global.localStorage||null;}catch(error){return null;}
}
function nextEpoch(){ epoch+=1; return epoch; }
function revision(source,target){ return 'src-'+contract.hash(clean(source)+'|'+clean(target)); }
function targetUrl(world,id){
  var page=world==='1d'?'p79-pulse-tape-1d.html':'p80-hypercube-center-3d.html';
  return page+'?request='+encodeURIComponent(id);
}
function requestBody(world,source,target){
  if(world==='1d') return {operation:'ENCODE',text:source,target:target,encoding:'UTF-8',bitOrder:'msb0',morseProfile:'international-itu-r-m1677-1'};
  return {operation:'DIAGNOSE_Q6',textHash:contract.hash(source),targetHash:contract.hash(target),profileId:'p78-center-safety-v0',flags:[null,null,null,null,null,null]};
}
function makeRequest(world){
  if(!contract||!sourceEl) return null;
  var source=sourceEl.value||'', target=goalEl&&goalEl.value||'';
  return contract.create({
    kind:'REQUEST',from:'2d',to:world,replyTo:null,epoch:nextEpoch(),revision:revision(source,target),status:'READY',code:null,
    body:requestBody(world,source,target),evidence:{providerId:'living-ring-ui',providerVersion:VERSION}
  });
}
function storeRequest(world,value){
  var store=storage();
  if(store) store.setItem(REQUEST_KEY+world,JSON.stringify(value));
}
function readResult(id){
  var store=storage(), raw;
  if(!store) return null;
  raw=store.getItem(RESULT_KEY+id);
  if(!raw) return null;
  try{return JSON.parse(raw);}catch(error){return null;}
}
function summarize(value){
  var body=value&&value.body||{}, operation=body.operation||'REPORT';
  if(operation==='SEQUENCE_REPORT') return '1D: '+(body.byteCount||0)+' байт · '+(body.bitCount||0)+' бит · roundtrip '+(body.roundtripOk?'OK':'FAIL');
  if(operation==='HYPERCUBE_REPORT') return '3D: '+(body.state||'??????')+' · путь '+(body.pathLength==null?'—':body.pathLength)+' · '+value.status;
  return value.status+' · '+operation;
}
function acceptResult(value){
  if(!contract) return false;
  var checked=contract.validate(value), request=value&&pending[value.replyTo];
  if(!checked.ok||!request) return false;
  if(contract.isStale(value,request.epoch,request.revision)){
    setStatus(request.to,'BLOCKED','STALE · ответ не применён');
    return false;
  }
  setStatus(request.to,value.status,value.status+' · отчёт получен');
  report(summarize(value)+'; текст не изменён.');
  root.dataset.lastReply=value.messageId;
  return true;
}
function acceptWindowMessage(event){
  if(!event||global.location.origin==='null'||event.origin!==global.location.origin) return false;
  return acceptResult(event.data);
}
function poll(id,attempt){
  var value=readResult(id);
  if(value){acceptResult(value);return;}
  if(attempt<24) global.setTimeout(function(){poll(id,attempt+1);},250);
}
function openWorld(world){
  var value=makeRequest(world);
  if(!value||value.status==='INVALID'){
    setStatus(world,'INVALID',value&&value.code||'UNAVAILABLE');
    report('Запрос к соседнему миру не создан.');
    return null;
  }
  pending[value.messageId]=value;
  storeRequest(world,value);
  setStatus(world,'READY','READY · '+value.messageId);
  report('Снимок отправлен в '+world.toUpperCase()+'; P78 ожидает только read-only отчёт.');
  if(channel) channel.postMessage(value);
  global.open(targetUrl(world,value.messageId),'_blank');
  poll(value.messageId,0);
  return value;
}
function bind(){
  if(!root) return;
  root.querySelectorAll('[data-open-world]').forEach(function(button){
    button.addEventListener('click',function(){openWorld(button.dataset.openWorld);});
  });
  if(typeof global.BroadcastChannel==='function'){
    channel=new global.BroadcastChannel(CHANNEL);
    channel.addEventListener('message',function(event){acceptResult(event.data);});
  }
  global.addEventListener('message',acceptWindowMessage);
  root.dataset.exchange='READY';
}
function close(){ if(channel){channel.close();channel=null;} global.removeEventListener('message',acceptWindowMessage); }

var API=Object.freeze({version:VERSION,channel:CHANNEL,openWorld:openWorld,acceptResult:acceptResult,close:close});
global.MRDP78NeighborWorlds=API;
bind();
})(typeof window!=='undefined'?window:globalThis);
