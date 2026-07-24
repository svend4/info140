(function(global){
'use strict';

var VERSION='1.0.0';

function number(value){ value=Number(value); return isFinite(value)?value:0; }
function fixed(value,places){ return number(value).toFixed(places==null?2:places); }
function signed(value,places){ value=number(value); return (value>0?'+':'')+value.toFixed(places==null?2:places); }
function documentFor(root){
  var doc=root&&root.ownerDocument||global.document;
  if(!doc||typeof doc.createElement!=='function') throw new Error('semantic-parameter-view requires a DOM document');
  return doc;
}
function clear(root){ while(root&&root.firstChild) root.removeChild(root.firstChild); }
function node(root,tag,className,text){
  var item=documentFor(root).createElement(tag); if(className) item.className=className; if(text!=null) item.textContent=String(text); return item;
}
function appendMetric(root,host,label,value){
  var item=node(root,'span','counterfactualMetric'); item.appendChild(node(root,'b','',label)); item.appendChild(node(root,'i','',value)); host.appendChild(item);
}
function scenarioRow(root,scenario,best){
  scenario=scenario||{};
  var item=node(root,'div','counterfactualScenario '+String(scenario.id||'')+' '+String(scenario.status||'')+' '+String(scenario.effect||'')+(best&&best.id===scenario.id?' best':''));
  item.setAttribute('data-scenario-id',scenario.id||''); item.setAttribute('data-status',scenario.status||''); item.setAttribute('data-effect',scenario.effect||'');
  item.setAttribute('data-lambda',fixed(scenario.lambda,2)); item.setAttribute('data-trace-hash',scenario.traceHash||'');
  var head=node(root,'div','counterfactualScenarioHead');
  head.appendChild(node(root,'b','',String(scenario.label||'λ')+' '+fixed(scenario.lambda,2)));
  head.appendChild(node(root,'span','',scenario.status||'UNKNOWN'));
  head.appendChild(node(root,'i','',fixed(scenario.score,2)));
  item.appendChild(head);
  var metrics=node(root,'div','counterfactualMetrics');
  appendMetric(root,metrics,'M',fixed(scenario.window,2));
  appendMetric(root,metrics,'g',String(Math.max(0,number(scenario.events))));
  appendMetric(root,metrics,'u',fixed(scenario.minU,2)+'–'+fixed(scenario.maxU,2));
  appendMetric(root,metrics,'Δg',signed(scenario.delta&&scenario.delta.events,0));
  item.appendChild(metrics);
  var relation=scenario.id==='current'?'baseline':scenario.sameTrace&&scenario.sameDirection?'trace =':'trace Δ';
  item.appendChild(node(root,'div','counterfactualRelation',String(scenario.direction||'нет направления')+' · '+relation+' · '+String(scenario.effect||'')));
  item.appendChild(node(root,'div','counterfactualLine',scenario.sentence||scenario.message||'Нет причинной строки.'));
  return item;
}
function render(root,pack){
  if(!root) return null; pack=pack||{}; clear(root);
  root.setAttribute('data-status',pack.status||'EMPTY'); root.setAttribute('data-comparison-hash',pack.hashes&&pack.hashes.comparison||'');
  var head=node(root,'div','counterfactualHead '+String(pack.status||'EMPTY').toLowerCase());
  head.appendChild(node(root,'b','',pack.title||'λ · '+String(pack.status||'EMPTY')));
  head.appendChild(node(root,'span','',pack.formula||'CF(λ,δ) = FORECAST(λ− | λ | λ+)'));
  root.appendChild(head);
  root.appendChild(node(root,'div','counterfactualSummary',pack.summary||'Нет контрфактического расчета.'));
  var scenarios=Array.isArray(pack.scenarios)?pack.scenarios:[],list=node(root,'div','counterfactualScenarios');
  scenarios.forEach(function(scenario){list.appendChild(scenarioRow(root,scenario,pack.best));});
  root.appendChild(list);
  var proof=node(root,'div','counterfactualProof',(pack.evidenceLevel||pack.evidence||'UNVERIFIED')+' / '+(pack.soundness||'NOT_COMPUTED'));
  root.appendChild(proof);
  return {version:VERSION,kind:'MRDSemanticParameterViewRender',status:pack.status||'EMPTY',scenarios:scenarios.length,best:pack.best&&pack.best.id||null,sensitivity:number(pack.sensitivity)};
}

global.MRDSemanticParameterView={version:VERSION,render:render};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
