(function(global){
'use strict';

var VERSION='1.1.0';
var Flow=global.MRDP78SemanticFlowReducer;

if(!Flow||Flow.status!=='READY'){
  global.MRDP78SemanticFlowView=Object.freeze({version:VERSION,status:'BLOCKED',code:'SEMANTIC_FLOW_VIEW_DEPENDENCY_UNAVAILABLE'});
  return;
}

var LABELS=Object.freeze({
  INPUT:'\u0432\u0432\u043e\u0434',
  PARSE:'\u0440\u0430\u0437\u0431\u043e\u0440',
  DISCOVER:'\u043f\u043e\u0438\u0441\u043a',
  ALIGN:'\u0441\u0432\u044f\u0437\u043a\u0430',
  REVIEW:'\u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430'
});

function node(doc,tag,className,value){
  var item=doc.createElement(tag);
  if(className) item.className=className;
  if(value!==undefined&&value!==null) item.textContent=String(value);
  return item;
}
function clear(root){ while(root&&root.firstChild) root.removeChild(root.firstChild); }
function attr(item,name,value){ if(item&&typeof item.setAttribute==='function') item.setAttribute(name,String(value)); }
function metric(doc,label,value,className){
  var item=node(doc,'div','semanticFlowMetric '+(className||''));
  item.appendChild(node(doc,'span','',label));
  item.appendChild(node(doc,'b','',value));
  return item;
}
function relation(doc,code,value){
  var item=node(doc,'span','semanticFlowRelation relation-'+code.toLowerCase());
  item.appendChild(node(doc,'i','',code.charAt(0)));
  item.appendChild(node(doc,'b','',value));
  attr(item,'title',code);
  return item;
}
function metricValue(record){
  return record&&record.status==='COMPUTED'?Number(record.value).toFixed(2):'N/C';
}
function renderInvalid(root,code){
  var doc=root.ownerDocument||global.document;
  clear(root);
  root.className=(root.className||'').replace(/\s+is-[a-z_-]+/g,'')+' is-invalid';
  root.dataset.status='INVALID';
  root.appendChild(node(doc,'div','semanticFlowInvalid','2D FLOW \u00b7 '+String(code||'INVALID_FRAME')));
  return root;
}
function render(root,frame,delta){
  var report,deltaReport,doc,head,orbit,track,center,nodes,metrics,relations,foot,i,item,work;
  if(!root) return null;
  report=Flow.validateFlowFrame(frame);
  if(report.status!=='VALID') return renderInvalid(root,report.code);
  if(delta){
    deltaReport=Flow.validateFlowDelta(delta);
    if(deltaReport.status!=='VALID'||delta.toFrameHash!==frame.contentHash) return renderInvalid(root,deltaReport.code||'DELTA_TARGET_MISMATCH');
  }
  clear(root);
  doc=root.ownerDocument||global.document;
  if((' '+root.className+' ').indexOf(' semanticFlowView ')===-1) root.className=(root.className?root.className+' ':'')+'semanticFlowView';
  root.className=root.className.replace(/\s+is-[a-z_-]+/g,'')+' is-'+frame.state.toLowerCase().replace(/_/g,'-');
  root.dataset.status=frame.state;
  root.dataset.authority=frame.authority;
  root.dataset.semanticTruth='false';
  root.dataset.executionModel=frame.executionModel;
  root.dataset.changedCount=String(delta?delta.changedWorkIds.length:0);

  head=node(doc,'header','semanticFlowHead');
  head.appendChild(node(doc,'h3','','2D semantic flow'));
  head.appendChild(node(doc,'code','semanticFlowStatus',frame.state));
  root.appendChild(head);

  orbit=node(doc,'div','semanticFlowOrbit');
  attr(orbit,'role','list');
  attr(orbit,'aria-label','\u0421\u0442\u0430\u0434\u0438\u0438 2D-\u043f\u043e\u0442\u043e\u043a\u0430');
  track=node(doc,'div','semanticFlowTrack'); attr(track,'aria-hidden','true'); orbit.appendChild(track);
  center=node(doc,'div','semanticFlowCenter');
  center.appendChild(node(doc,'b','',frame.finalStatus));
  center.appendChild(node(doc,'span','',frame.metrics.queueLength+' \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u0438'));
  orbit.appendChild(center);
  nodes=node(doc,'div','semanticFlowNodes');
  for(i=0;i<frame.workItems.length;i++){
    work=frame.workItems[i];
    item=node(doc,'div','semanticFlowNode position-'+i+' state-'+work.state.toLowerCase());
    attr(item,'role','listitem');
    item.dataset.operator=work.operatorId;
    item.dataset.state=work.state;
    item.appendChild(node(doc,'span','semanticFlowOrdinal',String(i+1)));
    item.appendChild(node(doc,'b','',LABELS[work.operatorId]||work.operatorId));
    item.appendChild(node(doc,'small','',work.state));
    if(work.reasonCodes.length) attr(item,'title',work.reasonCodes.join(', '));
    nodes.appendChild(item);
  }
  orbit.appendChild(nodes);
  root.appendChild(orbit);

  metrics=node(doc,'div','semanticFlowMetrics');
  metrics.appendChild(metric(doc,'\u043a\u0430\u043d\u0434.',''+frame.metrics.candidateCount));
  metrics.appendChild(metric(doc,'\u043e\u0447\u0435\u0440\u0435\u0434\u044c',''+frame.metrics.queueLength));
  metrics.appendChild(metric(doc,'\u044d\u0442\u0430\u043f\u044b',metricValue(frame.metrics.stageCompletion)));
  metrics.appendChild(metric(doc,'\u043d\u0430\u0433\u0440\u0443\u0437\u043a\u0430',metricValue(frame.metrics.reviewLoad),'is-statistic'));
  metrics.appendChild(metric(doc,'\u0431\u043b\u043e\u043a',metricValue(frame.metrics.upstreamBlock),'is-statistic'));
  metrics.appendChild(metric(doc,'\u0440\u0430\u0437\u043d. \u0441\u0432\u044f\u0437\u0435\u0439',metricValue(frame.metrics.relationDispersion),'is-statistic'));
  metrics.appendChild(metric(doc,'\u043a\u043e\u043d\u0446. \u0441\u0432\u044f\u0437\u0435\u0439',metricValue(frame.metrics.relationConcentration),'is-statistic'));
  root.appendChild(metrics);

  relations=node(doc,'div','semanticFlowRelations');
  relations.appendChild(relation(doc,'SUPPORTS',frame.metrics.supportCount));
  relations.appendChild(relation(doc,'REFUTES',frame.metrics.refuteCount));
  relations.appendChild(relation(doc,'QUALIFIES',frame.metrics.qualifyCount));
  relations.appendChild(relation(doc,'MENTIONS',frame.metrics.mentionCount));
  root.appendChild(relations);

  foot=node(doc,'footer','semanticFlowBoundary');
  foot.appendChild(node(doc,'b','','ABSTAIN'));
  foot.appendChild(node(doc,'span','','\u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043e\u0442\u043d\u043e\u0448\u0435\u043d\u0438\u0439, \u043d\u0435 \u0438\u0441\u0442\u0438\u043d\u043d\u043e\u0441\u0442\u044c'));
  root.appendChild(foot);
  return root;
}

global.MRDP78SemanticFlowView=Object.freeze({
  version:VERSION,status:'READY',schema:'meridian.semantic-flow-view/1',render:render,clear:clear
});
})(typeof globalThis!=='undefined'?globalThis:this);
