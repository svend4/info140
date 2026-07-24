(function(global){
'use strict';

var VERSION='1.0.1';
var CHANNEL='p78-neighbors-v1';
var REQUEST_KEY='p78.exchange.request.3d';
var RESULT_KEY='p78.exchange.result.';
var q6=global.MRDP78Q6Diagnostics;
var contract=global.MRDP78ExchangeContract;
var viewport=document.getElementById('q6Viewport');
var bitsEl=document.getElementById('q6Bits');
var stateLabel=document.getElementById('q6StateLabel');
var statusEl=document.getElementById('q6Status');
var proofEl=document.getElementById('q6Proof');
var pathEl=document.getElementById('q6Path');
var legendEl=document.getElementById('q6Legend');
var diagnoseButton=document.getElementById('q6Diagnose');
var counterfactualButton=document.getElementById('q6Counterfactual');
var state=[];
var selectedBit=0;
var activeRequest=null;
var activeDiagnosis=null;
var activePath=null;
var channel=null;
var renderer=null,scene=null,camera=null,graphGroup=null,marker=null,pathLine=null;
var yaw=.55,pitch=.42,dragging=false,pointerX=0,pointerY=0,lastTime=0,frames=0;
var COLORS=[0x29b6c8,0x47a87a,0xe1a84b,0xe06c5e,0x6db0e8,0xb4c56a];
var LABELS={
  sourceCovered:['исходник покрыт','анализ охватывает вход'],
  goalCovered:['цель покрыта','цель задана и распознана'],
  relationSupported:['связь подтверждена','кандидат связан с исходником'],
  noveltyPreserved:['новизна сохранена','ход не является повтором'],
  guardSafe:['кольцо безопасно','ход остаётся внутри 2D'],
  reversible:['откат существует','transaction обратима']
};

function safeStorage(){try{return global.localStorage||null;}catch(error){return null;}}
function queryRequestId(){try{return new URL(global.location.href).searchParams.get('request')||'';}catch(error){return '';}}
function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});}
function setStatus(status,value){statusEl.dataset.status=status||'';statusEl.textContent=(status||'INVALID')+' · '+(value||'');}
function proofRow(label,value){return '<dt>'+label+'</dt><dd>'+escapeHtml(value)+'</dd>';}
function rawState(){return state.map(function(value){return value==='UNKNOWN'?'UNKNOWN':value===1;});}
function statePattern(){return state.map(function(value){return value==='UNKNOWN'?'?':String(value);}).join('');}
function setBit(index,value){state[index]=value;selectedBit=index;renderBits();diagnose(false);}
function renderBits(){
  bitsEl.innerHTML='';
  q6.profile.predicates.forEach(function(predicate,index){
    var copy=LABELS[predicate.name]||[predicate.name,predicate.question],row=document.createElement('div');row.className='bitRow';
    var name=document.createElement('div');name.className='bitName';name.innerHTML='<b>'+escapeHtml(copy[0])+'</b><small>'+escapeHtml(copy[1])+'</small>';
    var control=document.createElement('div');control.className='triState';control.setAttribute('role','group');control.setAttribute('aria-label',copy[0]);
    [['UNKNOWN','?'],[0,'0'],[1,'1']].forEach(function(pair){
      var button=document.createElement('button');button.type='button';button.textContent=pair[1];button.dataset.value=String(pair[0]);
      button.className=String(state[index])===String(pair[0])?'on':'';button.setAttribute('aria-pressed',button.className==='on'?'true':'false');
      button.addEventListener('click',function(){setBit(index,pair[0]);});control.appendChild(button);
    });
    row.appendChild(name);row.appendChild(control);bitsEl.appendChild(row);
  });
}
function renderProof(result){
  proofEl.innerHTML=[
    proofRow('состояние',result.pattern||'??????'),
    proofRow('покрытие',Math.round((result.coverage||0)*100)+'%'),
    proofRow('совместимо',String(result.compatibleVertexCount==null?'—':result.compatibleVertexCount)),
    proofRow('топология','Q6 · Hamming=1'),
    proofRow('граница','STRUCTURAL · NOT_COMPUTED')
  ].join('');
}
function responseBody(result){
  return {
    operation:'HYPERCUBE_REPORT',profileId:q6.profile.id,state:result.pattern||'??????',knownCount:result.knownCount||0,
    unknownCount:result.unknownCount||0,coverage:result.coverage||0,vertexId:result.vertex?result.vertex.id:null,
    pathLength:activePath&&activePath.status==='READY'?activePath.distance:null,
    path:activePath&&activePath.status==='READY'?activePath.path.map(function(item){return item.bitString;}):[]
  };
}
function notifyOpener(reply){
  try{
    if(global.opener&&!global.opener.closed&&global.location.origin!=='null') global.opener.postMessage(reply,global.location.origin);
  }catch(error){}
}
function publish(result){
  if(!activeRequest||!contract) return null;
  var reply=contract.reply(activeRequest,{
    status:result.status,code:result.status==='READY'?null:(result.code||'Q6_NOT_READY'),body:responseBody(result),
    evidence:{providerId:'q6-center-ui',providerVersion:VERSION}
  });
  if(!reply||reply.status==='INVALID') return reply;
  var store=safeStorage();if(store) store.setItem(RESULT_KEY+activeRequest.messageId,JSON.stringify(reply));
  notifyOpener(reply);
  if(channel) channel.postMessage(reply);return reply;
}
function markerPosition(vertex){
  var projected=q6.projectVertex(vertex,{macroScale:3,localScale:.65});
  return projected.status==='READY'?projected.projection.position:null;
}
function updateMarker(vertex){
  if(!marker||!vertex){if(marker)marker.visible=false;return;}
  var position=markerPosition(vertex);if(!position){marker.visible=false;return;}
  marker.position.set(position[0],position[1],position[2]);marker.visible=true;
}
function updatePath(path){
  if(pathLine){graphGroup.remove(pathLine);pathLine.geometry.dispose();pathLine.material.dispose();pathLine=null;}
  if(!path||path.status!=='READY'||path.path.length<2)return;
  var points=[];path.path.forEach(function(vertex){var position=markerPosition(vertex);points.push(new THREE.Vector3(position[0],position[1],position[2]));});
  pathLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffffff,linewidth:2}));graphGroup.add(pathLine);
}
function diagnose(shouldPublish){
  if(!q6){setStatus('UNAVAILABLE','MRDP78Q6Diagnostics');return null;}
  var result=q6.diagnose(rawState());activeDiagnosis=result;
  stateLabel.textContent=(result.pattern||statePattern())+' · '+result.status;
  setStatus(result.status,result.code||'ячейка вычислена');renderProof(result);updateMarker(result.vertex);
  viewport.dataset.q6Status=result.status;viewport.dataset.q6Pattern=result.pattern||statePattern();
  if(shouldPublish!==false) publish(result);return result;
}
function counterfactual(){
  var result=activeDiagnosis||diagnose(false);
  if(!result||result.status!=='READY'){
    activePath=null;pathEl.textContent='—';setStatus(result&&result.status||'ABSTAIN','сначала нужны шесть известных условий');return;
  }
  var target=result.vertex.bits.slice();target[selectedBit]=target[selectedBit]?0:1;
  activePath=q6.findCounterfactual(result.vertex,target,{allowedBits:[selectedBit]});
  pathEl.textContent=activePath.status==='READY'?String(activePath.distance):'—';updatePath(activePath);
  setStatus(activePath.status,activePath.status==='READY'?'бит '+selectedBit+' · '+q6.predicateNames[selectedBit]:activePath.code);
  publish(result);
}
function acceptRequest(value){
  if(!contract||!value)return false;
  var checked=contract.validate(value);
  if(!checked.ok||value.kind!=='REQUEST'||value.from!=='2d'||value.to!=='3d')return false;
  if(value.body.operation!=='DIAGNOSE_Q6'&&value.body.operation!=='FIND_COUNTERFACTUAL')return false;
  activeRequest=value;
  if(Array.isArray(value.body.flags)&&value.body.flags.length===6){
    state=value.body.flags.map(function(flag){return flag===true?1:flag===false?0:'UNKNOWN';});
  }
  renderBits();diagnose(true);return true;
}
function loadRequest(){
  var store=safeStorage(),raw=store&&store.getItem(REQUEST_KEY),value;if(!raw)return false;
  try{value=JSON.parse(raw);}catch(error){return false;}
  var expected=queryRequestId();if(expected&&value.messageId!==expected)return false;return acceptRequest(value);
}
function buildLegend(){
  legendEl.innerHTML='';q6.predicateNames.forEach(function(name,index){var item=document.createElement('span');item.className='edgeKey';item.innerHTML='<i style="background:#'+COLORS[index].toString(16).padStart(6,'0')+'"></i>'+index+' · '+escapeHtml(name);legendEl.appendChild(item);});
}
function initScene(){
  if(!global.THREE){setStatus('UNAVAILABLE','Three.js');return false;}
  var projection=q6.projectGraph({macroScale:3,localScale:.65});
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,1,.1,100);camera.position.set(0,0,15);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(2,global.devicePixelRatio||1));renderer.setClearColor(0x070a0c,1);viewport.appendChild(renderer.domElement);
  graphGroup=new THREE.Group();scene.add(graphGroup);
  var positions=[];projection.vertices.forEach(function(item){positions.push(item.position[0],item.position[1],item.position[2]);});
  var pointGeometry=new THREE.BufferGeometry();pointGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  graphGroup.add(new THREE.Points(pointGeometry,new THREE.PointsMaterial({color:0xf1f4ef,size:.11,sizeAttenuation:true,transparent:true,opacity:.92})));
  for(var bit=0;bit<6;bit++){
    var segment=[];projection.edges.filter(function(edge){return edge.changedBit===bit;}).forEach(function(edge){var a=projection.vertices[edge.from].position,b=projection.vertices[edge.to].position;segment.push(a[0],a[1],a[2],b[0],b[1],b[2]);});
    var geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(segment,3));
    graphGroup.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:COLORS[bit],transparent:true,opacity:bit<3?0.34:0.18})));
  }
  marker=new THREE.Mesh(new THREE.SphereGeometry(.22,20,14),new THREE.MeshBasicMaterial({color:0xffffff}));marker.visible=false;graphGroup.add(marker);
  viewport.dataset.vertices=String(projection.vertices.length);viewport.dataset.edges=String(projection.edges.length);
  resizeScene();return true;
}
function resizeScene(){if(!renderer)return;var width=Math.max(320,viewport.clientWidth),height=Math.max(320,viewport.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
function frame(time){
  if(!lastTime)lastTime=time;var dt=Math.min(.05,(time-lastTime)/1000);lastTime=time;if(!dragging)yaw+=dt*.08;
  if(graphGroup){graphGroup.rotation.y=yaw;graphGroup.rotation.x=pitch;renderer.render(scene,camera);frames++;viewport.dataset.frames=String(frames);}
  global.requestAnimationFrame(frame);
}
function pointerDown(event){dragging=true;pointerX=event.clientX;pointerY=event.clientY;if(renderer)renderer.domElement.classList.add('dragging');}
function pointerMove(event){if(!dragging)return;yaw+=(event.clientX-pointerX)*.008;pitch=Math.max(-1.2,Math.min(1.2,pitch+(event.clientY-pointerY)*.006));pointerX=event.clientX;pointerY=event.clientY;}
function pointerUp(){dragging=false;if(renderer)renderer.domElement.classList.remove('dragging');}

state=q6?q6.predicateNames.map(function(){return 'UNKNOWN';}):[];
renderBits();buildLegend();initScene();
diagnoseButton.addEventListener('click',function(){diagnose(true);});counterfactualButton.addEventListener('click',counterfactual);
viewport.addEventListener('pointerdown',pointerDown);global.addEventListener('pointermove',pointerMove);global.addEventListener('pointerup',pointerUp);global.addEventListener('resize',resizeScene);
if(typeof global.BroadcastChannel==='function'){channel=new global.BroadcastChannel(CHANNEL);channel.addEventListener('message',function(event){acceptRequest(event.data);});}
if(!loadRequest())diagnose(false);global.requestAnimationFrame(frame);
global.MRDP80Q6Center={version:VERSION,diagnose:diagnose,acceptRequest:acceptRequest};
})(window);
