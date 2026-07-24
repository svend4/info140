(function(global){
'use strict';

var VERSION='1.0.0';
var KIND='MRDSemanticTraceOverlay';
var STRUCTURAL='STRUCTURAL';
var NOT_COMPUTED='NOT_COMPUTED';
var SLOT_ORDER=['topic','bridge','detail'];
var SLOT_LABELS={topic:'Т',bridge:'М',detail:'Д'};
var SLOT_COLORS={topic:'230,161,43',bridge:'21,163,146',detail:'216,81,63'};
var DIRECTION_COLORS={generalize:'117,103,216',detail:'216,81,63',repair:'47,131,202',orbit:'21,151,132'};

function clean(value){ return String(value==null?'':value).replace(/\s+/g,' ').trim(); }
function normalize(value){ return clean(value).toLowerCase().replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi,''); }
function number(value,fallback){ value=Number(value); return isFinite(value)?value:(fallback==null?0:fallback); }
function clamp(value,min,max){ return value<min?min:value>max?max:value; }
function idKey(value){ return '$'+String(value); }
function hash(value){
  value=String(value==null?'':value); var h=2166136261>>>0;
  for(var i=0;i<value.length;i++){ h^=value.charCodeAt(i); h=Math.imul(h,16777619); }
  return ('00000000'+(h>>>0).toString(16)).slice(-8);
}
function compareId(a,b){
  var an=Number(a.id),bn=Number(b.id),af=isFinite(an),bf=isFinite(bn);
  if(af&&bf&&an!==bn) return an-bn;
  return String(a.id).localeCompare(String(b.id));
}
function particleMaps(particles){
  var list=(Array.isArray(particles)?particles:[]).filter(function(item){return item&&item.id!=null;}).slice().sort(compareId);
  var byId={},byToken={},byWord={};
  list.forEach(function(particle){
    byId[idKey(particle.id)]=particle;
    var tokenIndex=Number(particle.tokenIndex);
    if(isFinite(tokenIndex)&&tokenIndex>=0){ var tk=String(Math.floor(tokenIndex)); if(!byToken[tk]) byToken[tk]=[]; byToken[tk].push(particle); }
    var word=normalize(particle.label||particle.token);
    if(word){ if(!byWord[word]) byWord[word]=[]; byWord[word].push(particle); }
  });
  return {list:list,byId:byId,byToken:byToken,byWord:byWord};
}
function first(list){ return list&&list.length?list[0]:null; }
function indexed(maps,index){
  index=Number(index); return isFinite(index)&&index>=0?first(maps.byToken[String(Math.floor(index))]):null;
}
function worded(maps,word){ return first(maps.byWord[normalize(word)]); }
function endpoint(event,side,maps){
  event=event||{};
  var id=side==='source'?event.sourceId:event.targetId;
  if(id!=null&&maps.byId[idKey(id)]) return maps.byId[idKey(id)];
  var tokenIndex=side==='source'?event.sourceTokenIndex:event.targetTokenIndex;
  return indexed(maps,tokenIndex)||worded(maps,side==='source'?event.sourceToken:event.targetToken);
}
function eventMap(trace){
  var map={}; (trace||[]).forEach(function(event){if(event&&event.eventId) map[event.eventId]=event;}); return map;
}
function witnessNode(slot,witness,events,maps){
  witness=witness||{};
  var event=witness.eventId&&events[witness.eventId]||null,particle=null;
  if(event&&(witness.side==='source'||witness.side==='target')) particle=endpoint(event,witness.side,maps);
  if(!particle) particle=indexed(maps,witness.tokenIndex)||worded(maps,witness.word);
  return {
    slot:slot,label:SLOT_LABELS[slot],word:clean(witness.word),role:witness.role||'neutral',tokenIndex:Number.isFinite(Number(witness.tokenIndex))?Math.floor(Number(witness.tokenIndex)):null,
    eventId:witness.eventId||null,fromTrace:!!witness.fromTrace,side:witness.side||null,particleId:particle?particle.id:null,mapped:!!particle
  };
}
function edgeNode(event,index,maps,origin){
  event=event||{};
  var source=endpoint(event,'source',maps),target=endpoint(event,'target',maps);
  return {
    index:index,eventId:event.eventId||null,parentEventId:event.parentEventId||null,origin:event.origin||origin||'forecast',generation:Math.max(0,number(event.generation,index+1)),
    ruleId:event.ruleId||null,direction:event.direction||'orbit',sourceParticleId:source?source.id:null,targetParticleId:target?target.id:null,
    sourceToken:clean(event.sourceToken),targetToken:clean(event.targetToken),mapped:!!(source&&target&&idKey(source.id)!==idKey(target.id))
  };
}
function empty(status,code,continuation){
  return {
    version:VERSION,kind:KIND,status:status,code:code||null,origin:continuation&&continuation.origin||'none',direction:continuation&&continuation.direction||null,
    traceHash:continuation&&continuation.hashes&&continuation.hashes.trace||null,overlayHash:hash((status||'EMPTY')+'|'+(code||'')),witnesses:[],edges:[],
    metrics:{witnesses:0,mappedWitnesses:0,edges:0,mappedEdges:0},
    contract:{pre:{ok:!!continuation,text:'trace continuation pack is present'},inv:{ok:true,text:'view never mutates semantic or particle state'},post:{ok:status==='ABSTAIN'||status==='EMPTY',text:'no active overlay is emitted without READY evidence'}},
    evidence:continuation&&continuation.evidence||STRUCTURAL,evidenceLevel:continuation&&continuation.evidenceLevel||STRUCTURAL,soundness:NOT_COMPUTED
  };
}
function build(continuation,particles){
  if(!continuation) return empty('EMPTY','TRACE_VIEW_EMPTY',null);
  if(continuation.status==='ABSTAIN') return empty('ABSTAIN',continuation.code||'TRACE_VIEW_ABSTAIN',continuation);
  if(continuation.status!=='READY') return empty('EMPTY','TRACE_VIEW_NOT_READY',continuation);
  var maps=particleMaps(particles),events=eventMap(continuation.trace),witnesses=[];
  SLOT_ORDER.forEach(function(slot){witnesses.push(witnessNode(slot,continuation.witnesses&&continuation.witnesses[slot],events,maps));});
  var edges=(continuation.trace||[]).map(function(event,index){return edgeNode(event,index,maps,continuation.origin);});
  var mappedWitnesses=witnesses.filter(function(item){return item.mapped;}).length,mappedEdges=edges.filter(function(item){return item.mapped;}).length;
  var distinct={}; witnesses.forEach(function(item){if(item.mapped) distinct[idKey(item.particleId)]=1;});
  var complete=mappedWitnesses===3&&Object.keys(distinct).length===3&&mappedEdges>0,status=complete?'READY':'PARTIAL',code=complete?null:'TRACE_VIEW_MAPPING_INCOMPLETE';
  var mapping=witnesses.map(function(item){return [item.slot,item.tokenIndex,item.particleId];}).concat(edges.map(function(item){return [item.eventId,item.sourceParticleId,item.targetParticleId];}));
  return {
    version:VERSION,kind:KIND,status:status,code:code,origin:continuation.origin,direction:continuation.direction,genre:continuation.genre||'generic',traceHash:continuation.hashes&&continuation.hashes.trace||null,
    overlayHash:hash(JSON.stringify(mapping)),witnesses:witnesses,edges:edges,
    metrics:{witnesses:witnesses.length,mappedWitnesses:mappedWitnesses,edges:edges.length,mappedEdges:mappedEdges},
    contract:{pre:{ok:true,text:'continuation is READY and carries causal witnesses'},inv:{ok:Object.keys(distinct).length===mappedWitnesses,text:'mapped witnesses keep distinct particle identities'},post:{ok:complete,text:'three witnesses and at least one causal edge are drawable'}},
    evidence:continuation.evidence||STRUCTURAL,evidenceLevel:continuation.evidenceLevel||STRUCTURAL,soundness:NOT_COMPUTED
  };
}
function particlePosition(id,env){
  if(id==null||!env||typeof env.resolveParticle!=='function'||typeof env.projectParticle!=='function') return null;
  var particle=env.resolveParticle(id); if(!particle) return null;
  var point=env.projectParticle(particle); return point&&isFinite(Number(point.x))&&isFinite(Number(point.y))?{x:Number(point.x),y:Number(point.y)}:null;
}
function curvePoint(a,c,b,t){ var one=1-t; return {x:one*one*a.x+2*one*t*c.x+t*t*b.x,y:one*one*a.y+2*one*t*c.y+t*t*b.y}; }
function statusText(overlay){
  if(overlay.status==='READY') return 'TRACE · '+(overlay.origin==='observed'?'OBS':'FC')+' · '+String(overlay.direction||'orbit')+' · 3/3';
  if(overlay.status==='ABSTAIN') return 'TRACE · ABSTAIN · '+String(overlay.code||'');
  if(overlay.status==='PARTIAL') return 'TRACE · PARTIAL · '+overlay.metrics.mappedWitnesses+'/3';
  return '';
}
function paint(ctx,overlay,env){
  if(!ctx||!overlay||overlay.status==='EMPTY') return {version:VERSION,kind:'MRDSemanticTraceViewPaint',status:'SKIPPED',edgesPainted:0,witnessesPainted:0};
  env=env||{}; var bounds=env.bounds||{},width=number(bounds.width,1080),height=number(bounds.height,690),tick=number(env.tick,0);
  var edgesPainted=0,witnessesPainted=0,legend=[];
  ctx.save();
  (overlay.edges||[]).forEach(function(edge,index){
    if(!edge.mapped) return;
    var a=particlePosition(edge.sourceParticleId,env),b=particlePosition(edge.targetParticleId,env); if(!a||!b) return;
    var dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.sqrt(dx*dx+dy*dy)),bend=(index%2?1:-1)*(18+index*3),c={x:(a.x+b.x)/2-dy/len*bend,y:(a.y+b.y)/2+dx/len*bend};
    var tone=DIRECTION_COLORS[edge.direction]||DIRECTION_COLORS.orbit,phase=((tick*.009)+(index*.23))%1,bead=curvePoint(a,c,b,phase);
    ctx.strokeStyle='rgba('+tone+','+(edge.origin==='observed'?'.92':'.66')+')'; ctx.lineWidth=edge.origin==='observed'?3.2:2.3; ctx.setLineDash(edge.origin==='observed'?[]:[6,5]);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.quadraticCurveTo(c.x,c.y,b.x,b.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba('+tone+',.98)'; ctx.beginPath(); ctx.arc(bead.x,bead.y,4.1,0,Math.PI*2); ctx.fill(); edgesPainted++;
  });
  (overlay.witnesses||[]).forEach(function(witness,index){
    if(!witness.mapped) return;
    var p=particlePosition(witness.particleId,env); if(!p) return;
    var tone=SLOT_COLORS[witness.slot]||SLOT_COLORS.bridge,pulse=1.5+1.5*Math.sin(tick*.035+index*1.7);
    ctx.fillStyle='rgba('+tone+',.16)'; ctx.strokeStyle='rgba('+tone+',.98)'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.arc(p.x,p.y,12+pulse,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba('+tone+',.98)'; ctx.beginPath(); ctx.arc(p.x,p.y,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(248,250,252,.98)'; ctx.font='900 9px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(witness.label,p.x,p.y+.5);
    legend.push(witness.label+' '+clean(witness.word).slice(0,18)); witnessesPainted++;
  });
  var status=statusText(overlay);
  if(legend.length){ ctx.fillStyle='rgba(238,242,247,.88)'; ctx.font='800 10px system-ui'; ctx.textAlign='right'; ctx.textBaseline='alphabetic'; ctx.fillText(legend.join(' · '),width-16,height-30); }
  if(status){ ctx.fillStyle=overlay.status==='ABSTAIN'?'rgba(226,161,43,.9)':'rgba(238,242,247,.76)'; ctx.font='800 10px ui-monospace,SFMono-Regular,Consolas,monospace'; ctx.textAlign='right'; ctx.textBaseline='alphabetic'; ctx.fillText(status,width-16,height-14); }
  ctx.restore();
  return {version:VERSION,kind:'MRDSemanticTraceViewPaint',status:overlay.status,edgesPainted:edgesPainted,witnessesPainted:witnessesPainted};
}

global.MRDSemanticTraceView={version:VERSION,kind:KIND,build:build,paint:paint,slotLabels:SLOT_LABELS};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
