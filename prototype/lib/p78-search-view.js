(function(global){
'use strict';

var VERSION='1.0.0';
var STAGE_TITLES={
  GREP_TO_AST:'grep → AST',
  AST_TO_GREP:'AST → grep',
  EVIDENCE_GATE:'evidence gate'
};

function element(doc,tag,className,text){
  var node=doc.createElement(tag);
  if(className) node.className=className;
  if(text!==undefined&&text!==null) node.textContent=String(text);
  return node;
}
function clear(root){ while(root&&root.firstChild) root.removeChild(root.firstChild); }
function shortHash(value){ return String(value||'нет hash').replace(/^sha256:/,'').slice(0,12); }
function text(value,fallback){ return typeof value==='string'&&value?value:(fallback||'—'); }
function limit(values){ return Array.isArray(values)?values.slice(0,4):[]; }
function appendIdentity(doc,parent,label,value){
  var item=element(doc,'span','searchIdentity');
  item.appendChild(element(doc,'b','',label));
  item.appendChild(element(doc,'code','',shortHash(value)));
  parent.appendChild(item);
}
function hitRow(doc,hit){
  var row=element(doc,'div','searchResultRow');
  row.appendChild(element(doc,'b','',text(hit.title||hit.sourceTitle||hit.sourceId,'источник')));
  row.appendChild(element(doc,'span','',text(hit.contextText||hit.context||hit.matchedText,'адресуемый фрагмент')));
  row.appendChild(element(doc,'code','',text(hit.status,'LOCATED')));
  return row;
}
function matchRow(doc,match){
  var row=element(doc,'div','searchResultRow');
  row.appendChild(element(doc,'b','',text(match.formulaId||(match.bindings&&match.bindings.formulaId)||match.candidateRef,'Formula AST')));
  row.appendChild(element(doc,'span','',text(match.patternId||(match.patternRef&&match.patternRef.patternId)||match.rationale,'закрытое правило')));
  row.appendChild(element(doc,'code','',text(match.status,'STRUCTURAL_MATCH')));
  return row;
}
function emptyRow(doc,message){ return element(doc,'div','searchEmpty',message); }
function layer(doc,className,title,status,countValue){
  var block=element(doc,'section','searchLayer '+className),head=element(doc,'header','searchLayerHead');
  head.appendChild(element(doc,'span','',title));
  head.appendChild(element(doc,'b','',String(countValue)));
  head.appendChild(element(doc,'code','',status));
  block.appendChild(head);
  return block;
}
function render(root,pack){
  if(!root) return null;
  clear(root);
  var doc=root.ownerDocument||global.document,value=pack||{},ready=value.status==='READY',located=value.located||value.hits||[],matches=value.structuralMatches||value.matches||[],evidence=value.evidenceCandidates||[],head=element(doc,'div','searchTraceHead'),state=element(doc,'div','searchTraceState'),identities=element(doc,'div','searchIdentities'),layers=element(doc,'div','searchLayers'),i,block,steps;
  root.dataset.status=value.status||'INVALID';
  root.dataset.traceHash=value.traceHash||(value.trace&&value.trace.contentHash)||'';

  state.appendChild(element(doc,'b',ready?'ready':'blocked',ready?'цикл воспроизводим':'цикл остановлен'));
  state.appendChild(element(doc,'span','',ready?(String(located.length)+' найдено · '+String(matches.length)+' структурно'):(value.code||'нет результата')));
  head.appendChild(state);
  appendIdentity(doc,identities,'source',value.sourceSetHash);
  appendIdentity(doc,identities,'index',value.indexHash||(value.indexManifest&&value.indexManifest.contentHash));
  appendIdentity(doc,identities,'trace',value.traceHash||(value.trace&&value.trace.contentHash));
  head.appendChild(identities);
  root.appendChild(head);

  block=layer(doc,'located','найдено','LOCATED',located.length);
  limit(located).forEach(function(hit){ block.appendChild(hitRow(doc,hit)); });
  if(!located.length) block.appendChild(emptyRow(doc,'точных фрагментов нет'));
  layers.appendChild(block);

  block=layer(doc,'structural','структурно','STRUCTURAL_MATCH',matches.length);
  limit(matches).forEach(function(match){ block.appendChild(matchRow(doc,match)); });
  if(!matches.length) block.appendChild(emptyRow(doc,'формульное правило не совпало'));
  layers.appendChild(block);

  block=layer(doc,'evidence','доказательность',value.evidenceStatus||'NOT_COMPUTED',evidence.length);
  block.appendChild(element(doc,'div','searchEvidenceBoundary','Найденное и структурно совпавшее ещё не является подтверждённым утверждением.'));
  block.appendChild(element(doc,'code','searchEvidenceCode',value.semanticTruth===true?'POLICY_VIOLATION':'ABSTAIN')); 
  layers.appendChild(block);
  root.appendChild(layers);

  steps=element(doc,'div','searchSteps');
  ((value.trace&&value.trace.steps)||[]).forEach(function(step){
    var item=element(doc,'span','searchStep '+String(step.status||'').toLowerCase());
    item.appendChild(element(doc,'b','',String((Number(step.ordinal)||0)+1)));
    item.appendChild(element(doc,'span','',STAGE_TITLES[step.direction]||step.direction||'шаг'));
    item.appendChild(element(doc,'code','',step.status||'EMPTY'));
    steps.appendChild(item);
  });
  if(!steps.firstChild) steps.appendChild(emptyRow(doc,'trace ещё не построен'));
  root.appendChild(steps);
  return root;
}

global.MRDP78SearchView=Object.freeze({version:VERSION,render:render,clear:clear});
})(typeof globalThis!=='undefined'?globalThis:this);
