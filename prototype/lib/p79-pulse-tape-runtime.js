(function(global){
'use strict';

var VERSION='1.0.1';
var CHANNEL='p78-neighbors-v1';
var REQUEST_KEY='p78.exchange.request.1d';
var RESULT_KEY='p78.exchange.result.';
var codec=global.MRDP78TimelineCodec;
var contract=global.MRDP78ExchangeContract;
var source=document.getElementById('tapeSource');
var encodeButton=document.getElementById('tapeEncode');
var playButton=document.getElementById('tapePlay');
var resetButton=document.getElementById('tapeReset');
var statusEl=document.getElementById('tapeStatus');
var proofEl=document.getElementById('tapeProof');
var binaryEl=document.getElementById('tapeBinary');
var morseEl=document.getElementById('tapeMorse');
var byteCountEl=document.getElementById('tapeByteCount');
var bitCountEl=document.getElementById('tapeBitCount');
var pulseCountEl=document.getElementById('tapePulseCount');
var roundtripEl=document.getElementById('tapeRoundtrip');
var canvas=document.getElementById('tapeWorld');
var ctx=canvas&&canvas.getContext('2d');
var activeRequest=null;
var pack=null;
var channel=null;
var playing=true;
var offset=0;
var lastTime=0;
var viewWidth=0;
var viewHeight=0;

function clean(value){ return value==null?'':String(value).trim(); }
function safeStorage(){ try{return global.localStorage||null;}catch(error){return null;} }
function queryRequestId(){ try{return new URL(global.location.href).searchParams.get('request')||'';}catch(error){return '';} }
function setStatus(status,value){ statusEl.dataset.status=status||''; statusEl.textContent=(status||'INVALID')+' · '+(value||''); }
function profileId(){
  var selected=document.getElementById('tapeProfile');
  return selected&&selected.value||codec.defaultProfileId;
}
function proofRow(label,value){ return '<dt>'+label+'</dt><dd>'+value+'</dd>'; }
function escapeHtml(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});
}
function renderProof(result){
  var binary=result&&result.binary||{}, morse=result&&result.morse||{};
  proofEl.innerHTML=[
    proofRow('снимок',escapeHtml(binary.contentHash||'—')),
    proofRow('порядок',escapeHtml(binary.bitOrder||'—')),
    proofRow('профиль',escapeHtml(morse.profileId||'—')),
    proofRow('таблица',escapeHtml(morse.tableHash||'—')),
    proofRow('граница','STRUCTURAL · NOT_COMPUTED')
  ].join('');
}
function notation(result){
  var morse=result&&result.morse;
  if(!morse) return '—';
  var note=morse.notation||'—';
  if(morse.unsupportedCount) note+='\n\nunsupported: '+morse.unsupported.map(function(item){return item.symbol+' ('+item.codePoint+')';}).join(', ');
  return note;
}
function render(result){
  var binary=result&&result.binary||{}, morse=result&&result.morse||{};
  pack=result;
  setStatus(result&&result.status||'INVALID',result&&result.code||'кодек рассчитан');
  binaryEl.textContent=binary.displayBits||'—';
  morseEl.textContent=notation(result);
  byteCountEl.textContent=String(binary.byteLength||0);
  bitCountEl.textContent=String(binary.bitLength||0);
  pulseCountEl.textContent=String(morse.timeline&&morse.timeline.length||0);
  roundtripEl.textContent=binary.roundtripExact?'OK':'FAIL';
  renderProof(result);
  canvas.dataset.codecStatus=result&&result.status||'INVALID';
  canvas.dataset.byteCount=String(binary.byteLength||0);
  canvas.dataset.pulseCount=String(morse.timeline&&morse.timeline.length||0);
}
function responseBody(result){
  var binary=result.binary||{}, morse=result.morse||{};
  return {
    operation:'SEQUENCE_REPORT',
    codecStatus:result.status,
    byteCount:binary.byteLength||0,
    bitCount:binary.bitLength||0,
    pulseCount:morse.timeline&&morse.timeline.length||0,
    totalUnits:morse.totalUnits||0,
    roundtripOk:!!binary.roundtripExact,
    contentHash:binary.contentHash||null,
    profileId:morse.profileId||null,
    unsupportedCount:morse.unsupportedCount||0
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
    status:result.status,
    code:result.status==='READY'?null:(result.code||'CODEC_NOT_READY'),
    body:responseBody(result),
    evidence:{providerId:'pulse-tape-ui',providerVersion:VERSION}
  });
  if(!reply||reply.status==='INVALID') return reply;
  var store=safeStorage();
  if(store) store.setItem(RESULT_KEY+activeRequest.messageId,JSON.stringify(reply));
  notifyOpener(reply);
  if(channel) channel.postMessage(reply);
  return reply;
}
function encode(){
  if(!codec){setStatus('UNAVAILABLE','MRDP78TimelineCodec');return null;}
  var result=codec.encode(source.value,{profileId:profileId(),normalization:'NONE'});
  render(result); publish(result); return result;
}
function acceptRequest(value){
  if(!contract||!value) return false;
  var checked=contract.validate(value);
  if(!checked.ok||value.kind!=='REQUEST'||value.from!=='2d'||value.to!=='1d') return false;
  if(value.body.operation!=='ENCODE'&&value.body.operation!=='DECOMPOSE') return false;
  activeRequest=value;
  if(typeof value.body.text==='string') source.value=value.body.text;
  var selected=document.getElementById('tapeProfile');
  if(selected&&codec.getProfile(value.body.morseProfile)) selected.value=value.body.morseProfile;
  encode(); return true;
}
function loadRequest(){
  var store=safeStorage(), raw=store&&store.getItem(REQUEST_KEY), value;
  if(!raw) return false;
  try{value=JSON.parse(raw);}catch(error){return false;}
  var expected=queryRequestId();
  if(expected&&value.messageId!==expected) return false;
  return acceptRequest(value);
}
function resize(){
  if(!canvas||!ctx) return;
  var rect=canvas.getBoundingClientRect(),dpr=Math.min(2,global.devicePixelRatio||1);
  viewWidth=Math.max(320,rect.width||640); viewHeight=Math.max(180,rect.height||260);
  canvas.width=Math.round(viewWidth*dpr); canvas.height=Math.round(viewHeight*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
function bitStream(){
  var bits=pack&&pack.binary&&pack.binary.bitString||'';
  return bits||'0';
}
function timeline(){ return pack&&pack.morse&&pack.morse.timeline||[]; }
function drawBits(){
  var bits=bitStream(),cell=24,start=-((offset*34)%cell),y=54,count=Math.ceil(viewWidth/cell)+2;
  ctx.font='700 11px ui-monospace,Consolas,monospace'; ctx.textAlign='center';
  for(var i=0;i<count;i++){
    var index=(Math.floor(offset*34/cell)+i)%bits.length,bit=bits.charAt(index),x=start+i*cell;
    ctx.fillStyle=bit==='1'?'#29b6c8':'#17252b'; ctx.fillRect(x,y,cell-2,34);
    ctx.fillStyle=bit==='1'?'#061115':'#9facaf'; ctx.fillText(bit,x+(cell-2)/2,y+21);
  }
  ctx.textAlign='start';
}
function drawMorse(){
  var events=timeline(),unit=10,total=events.reduce(function(sum,item){return sum+item.units;},0)||1;
  var start=-((offset*54)%(total*unit)),x=start,y=viewHeight-74,loops=Math.ceil(viewWidth/(total*unit))+2;
  for(var loop=0;loop<loops;loop++){
    for(var i=0;i<events.length;i++){
      var event=events[i],width=Math.max(2,event.units*unit-1);
      ctx.fillStyle=event.signal?'#e1a84b':'#252d31';
      ctx.fillRect(x,y+(event.signal?0:12),width,event.signal?28:4); x+=event.units*unit;
    }
    if(!events.length){ctx.fillStyle='#252d31';ctx.fillRect(x,y+12,total*unit,4);x+=total*unit;}
  }
}
function draw(){
  if(!ctx) return;
  ctx.clearRect(0,0,viewWidth,viewHeight); ctx.fillStyle='#080b0d'; ctx.fillRect(0,0,viewWidth,viewHeight);
  ctx.strokeStyle='#253139'; ctx.lineWidth=1;
  for(var x=0;x<viewWidth;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,viewHeight);ctx.stroke();}
  ctx.fillStyle='#9facaf';ctx.font='10px system-ui';ctx.fillText('binary · msb0',12,29);ctx.fillText('Morse · 1/3/7',12,viewHeight-94);
  drawBits();drawMorse();canvas.dataset.drawn='1';
}
function frame(time){
  if(!lastTime) lastTime=time;
  var dt=Math.min(.05,(time-lastTime)/1000);lastTime=time;
  if(playing) offset=(offset+dt)%10000;
  draw();global.requestAnimationFrame(frame);
}
function reset(){offset=0;source.value='SOS MERIDIAN';var selected=document.getElementById('tapeProfile');if(selected)selected.value=codec.defaultProfileId;encode();}

encodeButton.addEventListener('click',encode);
playButton.addEventListener('click',function(){playing=!playing;playButton.textContent=playing?'Ⅱ':'▶';playButton.title=playing?'пауза':'продолжить';});
resetButton.addEventListener('click',reset);
var profileSelect=document.getElementById('tapeProfile');if(profileSelect) profileSelect.addEventListener('change',encode);
global.addEventListener('resize',resize);
if(typeof global.BroadcastChannel==='function'){
  channel=new global.BroadcastChannel(CHANNEL);
  channel.addEventListener('message',function(event){acceptRequest(event.data);});
}
resize();
if(!loadRequest()) encode();
global.requestAnimationFrame(frame);
global.MRDP79PulseTape={version:VERSION,encode:encode,acceptRequest:acceptRequest};
})(window);
