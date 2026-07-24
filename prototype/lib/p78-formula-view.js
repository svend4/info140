(function(global){
'use strict';

var VERSION='1.0.0';
var TITLES={
  'ring.balance':'баланс кольца',
  'pressure.closure':'центр C',
  'pressure.edge':'край E',
  'pressure.orbit-forward':'орбита O→',
  'pressure.orbit-reverse':'орбита O←',
  'pressure.orbit-total':'полная орбита O',
  'pressure.partition':'разбиение',
  'pressure.direction':'направление',
  'pressure.margin':'запас орбиты',
  'vitality.snapshot-geomean':'снимок жизненности',
  'vitality.trajectory':'траектория жизненности'
};

function node(doc,tag,className,text){
  var element=doc.createElement(tag);
  if(className) element.className=className;
  if(text!==undefined&&text!==null) element.textContent=String(text);
  return element;
}
function clear(root){ while(root&&root.firstChild) root.removeChild(root.firstChild); }
function shortHash(value){ return String(value||'нет hash').replace(/^sha256:/,'').slice(0,12); }
function number(value){
  if(typeof value!=='number'||!Number.isFinite(value)) return '—';
  return value.toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
}
function title(id,fallback){ return TITLES[id]||fallback||id||'формула'; }
function metric(doc,label,value,accent){
  var item=node(doc,'div','formulaMetric'+(accent?' '+accent:''));
  item.appendChild(node(doc,'b','',number(value)));
  item.appendChild(node(doc,'span','',label));
  return item;
}
function render(root,pack){
  if(!root) return null;
  clear(root);
  var doc=root.ownerDocument||global.document, value=pack||{}, ready=value.status==='READY';
  root.dataset.status=value.status||'INVALID';
  root.dataset.registryHash=value.registryHash||'';

  var head=node(doc,'div','formulaTraceHead');
  var state=node(doc,'div','formulaTraceState');
  state.appendChild(node(doc,'b',ready?'ready':'blocked',ready?'цепь исполнена':'цепь остановлена'));
  state.appendChild(node(doc,'span','',ready?(String((value.summary&&value.summary.completed)||0)+'/'+String((value.summary&&value.summary.total)||0)+' формул'):(value.code||'нет результата')));
  head.appendChild(state);
  var hash=node(doc,'code','formulaHash','registry '+shortHash(value.registryHash));
  hash.title=value.registryHash||'';
  head.appendChild(hash);
  root.appendChild(head);

  if(!ready){
    var failure=node(doc,'div','formulaFailure');
    failure.appendChild(node(doc,'b','',value.code||'ABSTAIN'));
    failure.appendChild(node(doc,'span','',value.status==='ABSTAIN'?'неизвестный вход не заменён догадкой':'формульный контракт отклонил вычисление'));
    root.appendChild(failure);
  }

  var route=node(doc,'div','formulaRoute');
  var current=node(doc,'div','formulaRouteItem current');
  current.appendChild(node(doc,'span','','текущая'));
  current.appendChild(node(doc,'b','',value.current?title(value.current.formulaId,value.current.title):'—'));
  if(value.current) current.appendChild(node(doc,'i','',number(value.current.outputValue)));
  var next=node(doc,'div','formulaRouteItem next');
  next.appendChild(node(doc,'span','','следующая'));
  next.appendChild(node(doc,'b','',value.next?title(value.next.formulaId,value.next.title):'—'));
  if(value.next) next.appendChild(node(doc,'i','',value.next.reason||''));
  route.appendChild(current); route.appendChild(next); root.appendChild(route);

  var trace=node(doc,'div','formulaTraceRail');
  (value.trace||[]).forEach(function(entry,index){
    var item=node(doc,'div','formulaNode');
    item.dataset.formulaId=entry.formulaId||'';
    item.appendChild(node(doc,'span','formulaNodeIndex',String(index+1).padStart(2,'0')));
    item.appendChild(node(doc,'b','',title(entry.formulaId,entry.title)));
    item.appendChild(node(doc,'code','',entry.formulaId||''));
    var output=node(doc,'div','formulaNodeOutput');
    output.appendChild(node(doc,'span','',entry.outputKey||'output'));
    output.appendChild(node(doc,'strong','',number(entry.outputValue)));
    item.appendChild(output);
    item.title=(entry.contentHash||'')+' · '+(entry.status||'');
    trace.appendChild(item);
  });
  if(!(value.trace||[]).length) trace.appendChild(node(doc,'div','formulaTraceEmpty','нет исполненных формул'));
  root.appendChild(trace);

  var summary=value.summary||{}, metrics=node(doc,'div','formulaMetrics');
  metrics.appendChild(metric(doc,'Σ разбиения',summary.partition,Math.abs((summary.partition||0)-1)<1e-9?'ok':'bad'));
  metrics.appendChild(metric(doc,'M(λ)',summary.balance,'balance'));
  metrics.appendChild(metric(doc,'запас 2D',summary.margin,summary.margin>0?'ok':'bad'));
  metrics.appendChild(metric(doc,'направление',summary.direction,'direction'));
  metrics.appendChild(metric(doc,'жизненность',summary.vitality,summary.vitality>=.55?'ok':'warn'));
  root.appendChild(metrics);

  var proof=node(doc,'div','formulaEvidence');
  proof.appendChild(node(doc,'b','','STRUCTURAL'));
  proof.appendChild(node(doc,'span','','вычисление воспроизводимо; математическая доказанность и семантическая истинность не заявлены'));
  proof.appendChild(node(doc,'code','',value.soundness||'NOT_COMPUTED'));
  root.appendChild(proof);
  return root;
}

global.MRDP78FormulaView=Object.freeze({version:VERSION,render:render,clear:clear});
})(typeof globalThis!=='undefined'?globalThis:this);
