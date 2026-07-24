(function(global){
'use strict';

var VERSION='1.1.0';
var Projector=global.MRDP78EvidenceBackedLinkProjector;

if(!Projector||Projector.status!=='READY'||typeof Projector.snapshotViewModel!=='function'){
  global.MRDP78EvidenceBackedLinkView=Object.freeze({
    version:VERSION,status:'BLOCKED',code:'EVIDENCE_BACKED_LINK_VIEW_DEPENDENCY_UNAVAILABLE'
  });
  return;
}

var RELATION_CLASS=Object.freeze({SUPPORTS:'relation-supports',REFUTES:'relation-refutes',QUALIFIES:'relation-qualifies'});

function node(doc,tag,className,value){
  var item=doc.createElement(tag);
  if(className) item.className=className;
  if(value!==undefined&&value!==null) item.textContent=String(value);
  return item;
}
function clear(root){ while(root&&root.firstChild) root.removeChild(root.firstChild); }
function appendClass(root,name){
  if((' '+root.className+' ').indexOf(' '+name+' ')===-1) root.className=(root.className?root.className+' ':'')+name;
}
function boundedCode(value){
  var text=typeof value==='string'?value:'INVALID_MODEL';
  return text.length<=128?text:text.slice(0,128);
}
function locationText(locator){ return 'UTF16 ['+locator.start+', '+locator.end+')'; }
function sourceText(sourceRef){ return sourceRef.sourceId+' @ '+sourceRef.revision; }
function metric(doc,label,value,className){
  var item=node(doc,'div','evidenceLinkMetric'+(className?' '+className:''));
  item.appendChild(node(doc,'span','',label));
  item.appendChild(node(doc,'b','',value));
  return item;
}
function pin(doc,parent,label,value){
  var row=node(doc,'div','evidenceLinkPin');
  row.appendChild(node(doc,'span','',label));
  row.appendChild(node(doc,'code','',value));
  parent.appendChild(row);
}
function endpoint(doc,title,value,className){
  var block=node(doc,'section','evidenceLinkEndpoint '+className);
  var head=node(doc,'div','evidenceLinkEndpointHead');
  head.appendChild(node(doc,'b','',title));
  head.appendChild(node(doc,'code','',locationText(value.locator)));
  block.appendChild(head);
  block.appendChild(node(doc,'blockquote','evidenceLinkExactText',value.text));
  block.appendChild(node(doc,'div','evidenceLinkSource',sourceText(value.sourceRef)));
  return block;
}
function appendQualifier(doc,parent,qualifier){
  var block,head,witness;
  if(!qualifier) return;
  block=node(doc,'section','evidenceLinkQualifier');
  head=node(doc,'div','evidenceLinkQualifierHead');
  head.appendChild(node(doc,'b','','QUALIFIER DIRECTION'));
  head.appendChild(node(doc,'code','',qualifier.scopeDirection));
  block.appendChild(head);
  block.appendChild(node(doc,'p','',qualifier.directionDomain+' · '+qualifier.basis));
  witness=node(doc,'div','evidenceLinkWitness');
  pin(doc,witness,'qualifiedSide',qualifier.witness.qualifiedSide);
  pin(doc,witness,'qualifierKey',qualifier.witness.qualifierKey);
  pin(doc,witness,'markerToken',qualifier.witness.markerToken);
  pin(doc,witness,'valueSenseId',qualifier.witness.valueSenseId);
  block.appendChild(witness);
  parent.appendChild(block);
}
function appendProposal(doc,parent,value,index){
  var card=node(doc,'article','evidenceLinkProposal '+RELATION_CLASS[value.relation]);
  var head=node(doc,'header','evidenceLinkProposalHead');
  var route=node(doc,'div','evidenceLinkRoute');
  var relation=node(doc,'div','evidenceLinkRelation');
  var pins=node(doc,'section','evidenceLinkPins');
  var states=node(doc,'div','evidenceLinkStates');
  card.dataset.proposalId=value.subjectRef.proposalId;
  card.dataset.relation=value.relation;
  head.appendChild(node(doc,'span','evidenceLinkOrdinal',String(index+1)));
  head.appendChild(node(doc,'b','evidenceLinkRelationName',value.relation));
  head.appendChild(node(doc,'code','',value.direction));
  card.appendChild(head);
  route.appendChild(endpoint(doc,'PASSAGE',value.passage,'is-passage'));
  relation.appendChild(node(doc,'b','',value.relation));
  relation.appendChild(node(doc,'span','','PASSAGE -> TARGET'));
  relation.appendChild(node(doc,'code','',value.basis));
  route.appendChild(relation);
  route.appendChild(endpoint(doc,'TARGET',value.target,'is-target'));
  card.appendChild(route);
  appendQualifier(doc,card,value.qualifier);
  pin(doc,pins,'sourceSetHash',value.sourceSetRef.sourceSetHash);
  pin(doc,pins,'primarySourceHash',value.sourceSetRef.primarySourceHash);
  pin(doc,pins,'queryHash',value.pins.queryHash);
  pin(doc,pins,'indexHash',value.pins.indexHash);
  pin(doc,pins,'linguisticIndexHash',value.pins.linguisticIndexHash);
  pin(doc,pins,'evidenceCandidateHash',value.pins.evidenceCandidateHash);
  pin(doc,pins,'parser',value.pins.parserRef.id+'@'+value.pins.parserRef.version);
  pin(doc,pins,'qualifierRulesetHash',value.pins.qualifierRulesetHash);
  pin(doc,pins,'validator',value.pins.validatorVersion);
  card.appendChild(pins);
  states.appendChild(metric(doc,'stored proposal',value.storedVerificationStatus));
  states.appendChild(metric(doc,'local replay',value.validation.referentialReplay,'is-replayed'));
  states.appendChild(metric(doc,'source authority',value.sourceAuthority,'is-warning'));
  states.appendChild(metric(doc,'relation',value.relationStatus));
  states.appendChild(metric(doc,'human review',value.reviewStatus,'is-warning'));
  states.appendChild(metric(doc,'final relation',value.finalRelation));
  states.appendChild(metric(doc,'semantic truth',String(value.semanticTruth)));
  states.appendChild(metric(doc,'commit',String(value.commitAllowed)));
  card.appendChild(states);
  parent.appendChild(card);
}
function appendDiagnostics(doc,parent,model){
  var block,list,i,item,reasons;
  if(!model.rejections.length&&!model.skipReasons.length) return;
  block=node(doc,'section','evidenceLinkDiagnostics');
  block.appendChild(node(doc,'h4','','Диагностика проекции'));
  if(model.rejections.length){
    list=node(doc,'div','evidenceLinkRejections');
    for(i=0;i<model.rejections.length;i++){
      item=node(doc,'div','evidenceLinkRejection');
      item.appendChild(node(doc,'code','',model.rejections[i].code));
      item.appendChild(node(doc,'span','',model.rejections[i].relation));
      item.appendChild(node(doc,'small','',model.rejections[i].candidateId));
      list.appendChild(item);
    }
    block.appendChild(list);
  }
  if(model.skipReasons.length){
    reasons=node(doc,'div','evidenceLinkReasonCounts');
    for(i=0;i<model.skipReasons.length;i++){
      item=node(doc,'div','evidenceLinkReason');
      item.appendChild(node(doc,'code','',model.skipReasons[i].code));
      item.appendChild(node(doc,'b','',model.skipReasons[i].count));
      reasons.appendChild(item);
    }
    block.appendChild(reasons);
  }
  parent.appendChild(block);
}
function setRootState(root,model){
  root.dataset.status=model.status;
  root.dataset.validationScope=model.validationScope;
  root.dataset.referentialReplay=model.referentialReplay;
  root.dataset.sourceAuthority=model.sourceAuthority;
  root.dataset.relationStatus=model.relationStatus;
  root.dataset.reviewStatus=model.reviewStatus;
  root.dataset.finalRelation=model.finalRelation;
  root.dataset.commitAllowed=String(model.commitAllowed);
  root.dataset.proposalCount=String(model.proposalCount);
  root.dataset.rejectionCount=String(model.rejectionCount);
  root.dataset.skippedCount=String(model.skippedCount);
}
function renderInvalid(root,doc,report){
  var shell=node(doc,'div','evidenceLinkInvalid');
  root.dataset.status='INVALID';
  root.dataset.validationScope='NOT_PERFORMED';
  root.dataset.referentialReplay='NOT_PERFORMED';
  root.dataset.sourceAuthority='NOT_ASSESSED';
  root.dataset.relationStatus='NOT_COMPUTED';
  root.dataset.reviewStatus='REQUIRES_REVIEW';
  root.dataset.finalRelation='NOT_COMPUTED';
  root.dataset.commitAllowed='false';
  root.dataset.proposalCount='0';
  root.dataset.rejectionCount='0';
  root.dataset.skippedCount='0';
  shell.appendChild(node(doc,'b','','EVIDENCE-BACKED LINK · INVALID'));
  shell.appendChild(node(doc,'code','',boundedCode(report&&report.code)));
  root.appendChild(shell);
  return root;
}
function render(root,model){
  var report,doc,head,status,boundary,list,empty,i;
  if(!root) return null;
  doc=root.ownerDocument||global.document;
  clear(root);
  appendClass(root,'evidenceBackedLinkView');
  report=Projector.snapshotViewModel(model);
  if(!report||report.status!=='VALID') return renderInvalid(root,doc,report);
  model=report.model;
  setRootState(root,model);
  head=node(doc,'header','evidenceLinkViewHead');
  head.appendChild(node(doc,'h3','','Доказательная связь'));
  status=node(doc,'span','evidenceLinkLiveStatus',model.proposalCount+' proposal · '+model.status);
  if(typeof status.setAttribute==='function'){
    status.setAttribute('aria-live','polite');
    status.setAttribute('aria-atomic','true');
  }
  head.appendChild(status);
  root.appendChild(head);
  boundary=node(doc,'div','evidenceLinkBoundary');
  boundary.appendChild(metric(doc,'replay',model.referentialReplay,model.proposalCount?'is-replayed':''));
  boundary.appendChild(metric(doc,'source authority',model.sourceAuthority,'is-warning'));
  boundary.appendChild(metric(doc,'proposal',model.proposalCount));
  boundary.appendChild(metric(doc,'rejected',model.rejectionCount));
  boundary.appendChild(metric(doc,'skipped',model.skippedCount));
  boundary.appendChild(metric(doc,'review',model.reviewStatus,'is-warning'));
  root.appendChild(boundary);
  if(model.proposals.length){
    list=node(doc,'div','evidenceLinkProposalList');
    for(i=0;i<model.proposals.length;i++) appendProposal(doc,list,model.proposals[i],i);
    root.appendChild(list);
  }else{
    empty=node(doc,'div','evidenceLinkEmpty');
    empty.appendChild(node(doc,'b','','ABSTAIN'));
    empty.appendChild(node(doc,'span','','Общий точный снимок для направленной связи не найден.'));
    root.appendChild(empty);
  }
  appendDiagnostics(doc,root,model);
  return root;
}

global.MRDP78EvidenceBackedLinkView=Object.freeze({
  version:VERSION,status:'READY',schema:'meridian.evidence-backed-link-view/1',
  viewModelSchema:Projector.viewModelSchema,passive:true,hasCommands:false,
  reviewStatus:'REQUIRES_REVIEW',semanticTruth:false,commitAllowed:false,
  clear:clear,render:render
});
})(typeof globalThis!=='undefined'?globalThis:this);
