(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var Evidence=global.MRDP78EvidenceContracts;

if(!Canonical||!Evidence||Evidence.status!=='READY'){
  global.MRDP78EvidenceCandidateView=Object.freeze({
    version:VERSION,status:'BLOCKED',code:'EVIDENCE_CANDIDATE_VIEW_DEPENDENCY_UNAVAILABLE'
  });
  return;
}

var own=Object.prototype.hasOwnProperty;
var ALIGNMENT_FIELDS=Object.freeze([
  {key:'predicate',label:'предикат'},
  {key:'arguments',label:'аргументы'},
  {key:'polarity',label:'полярность'},
  {key:'modality',label:'модальность'},
  {key:'quantifier',label:'квантор'},
  {key:'qualifiers',label:'ограничители'}
]);
var DISPLAY_LIMIT=10;
var RELATION_PRIORITY=Object.freeze({SUPPORTS:0,REFUTES:1,QUALIFIES:2,MENTIONS:3});


function node(doc,tag,className,value){
  var item=doc.createElement(tag);
  if(className) item.className=className;
  if(value!==undefined&&value!==null) item.textContent=String(value);
  return item;
}

function clear(root){
  while(root&&root.firstChild) root.removeChild(root.firstChild);
}

function candidateList(payload){
  if(Array.isArray(payload)) return payload.slice();
  if(payload&&Array.isArray(payload.evidenceCandidates)) return payload.evidenceCandidates.slice();
  return [];
}
function classifyCandidates(candidates){
  var valid=[],invalid=[];
  candidates.forEach(function(candidate){
    var report=Evidence.validateEvidenceCandidate(candidate);
    if(report.status==='VALID') valid.push(candidate);
    else invalid.push({candidate:candidate,report:report});
  });
  valid.sort(function(a,b){
    var relationOrder=RELATION_PRIORITY[a.proposedRelation]-RELATION_PRIORITY[b.proposedRelation];
    if(relationOrder) return relationOrder;
    return a.candidateId<b.candidateId?-1:a.candidateId>b.candidateId?1:0;
  });
  return {valid:valid,invalid:invalid};
}

function appendInvalidCandidate(doc,parent,entry){
  var card=node(doc,'article','evidenceCandidateCard is-invalid');
  card.appendChild(node(doc,'b','','INVALID_CANDIDATE'));
  card.appendChild(node(doc,'code','',entry.report.code||'INVALID_VALUE'));
  parent.appendChild(card);
}


function embeddedText(payload,candidateId){
  var values=payload&&!Array.isArray(payload)&&payload.exactTextByCandidateId;
  if(values&&typeof values==='object'&&own.call(values,candidateId)&&typeof values[candidateId]==='string'){
    return {found:true,text:values[candidateId],origin:'EMBEDDED'};
  }
  return {found:false,text:null,origin:null};
}

function resolverRequest(candidate){
  return Canonical.copyAndFreeze({
    schema:'meridian.evidence-text-resolution-request/1',
    candidateId:candidate.candidateId,
    sourceRef:candidate.sourceRef,
    locator:candidate.locator,
    passageTextHash:candidate.passageTextHash
  });
}

function resolverText(value){
  if(typeof value==='string') return value;
  if(value&&typeof value==='object'&&typeof value.text==='string') return value.text;
  return null;
}

function resolveExactText(candidate,payload,options){
  var embedded=embeddedText(payload,candidate.candidateId),resolved,text;
  if(embedded.found){
    text=embedded.text;
  }else if(options&&typeof options.resolver==='function'){
    try{
      resolved=options.resolver(resolverRequest(candidate));
    }catch(error){
      return {status:'RESOLVER_ERROR',origin:'RESOLVER',text:null};
    }
    if(resolved&&typeof resolved.then==='function'){
      return {status:'RESOLVER_ASYNC_FORBIDDEN',origin:'RESOLVER',text:null};
    }
    text=resolverText(resolved);
    if(text===null) return {status:'RESOLVER_RESULT_INVALID',origin:'RESOLVER',text:null};
  }else{
    return {status:'EXACT_TEXT_UNAVAILABLE',origin:'NONE',text:null};
  }

  if(Canonical.hashText(text)!==candidate.passageTextHash){
    return {status:'PASSAGE_TEXT_HASH_MISMATCH',origin:embedded.found?'EMBEDDED':'RESOLVER',text:null};
  }
  return {status:'EXACT_TEXT_VERIFIED',origin:embedded.found?'EMBEDDED':'RESOLVER',text:text};
}

function sourceLine(candidate){
  return candidate.sourceRef.sourceId+' @ '+candidate.sourceRef.revision;
}

function locatorLine(candidate){
  var locator=candidate.locator;
  return 'UTF16_CODE_UNIT ['+locator.start+', '+locator.end+') · sentenceIndex='+locator.sentenceIndex;
}

function appendPin(doc,parent,label,value){
  var row=node(doc,'div','evidenceCandidatePin');
  row.appendChild(node(doc,'span','',label));
  row.appendChild(node(doc,'code','',value));
  parent.appendChild(row);
}

function appendAlignment(doc,parent,candidate){
  var grid=node(doc,'div','evidenceCandidateAlignment');
  ALIGNMENT_FIELDS.forEach(function(field){
    var value=candidate.alignment[field.key],item=node(doc,'div','evidenceCandidateAlignmentItem is-'+String(value).toLowerCase());
    item.appendChild(node(doc,'span','',field.label));
    item.appendChild(node(doc,'b','',value));
    grid.appendChild(item);
  });
  parent.appendChild(grid);
}

function appendExactText(doc,parent,resolution){
  var block=node(doc,'div','evidenceCandidateExcerpt '+(resolution.status==='EXACT_TEXT_VERIFIED'?'is-verified':'is-blocked'));
  var head=node(doc,'div','evidenceCandidateExcerptHead');
  head.appendChild(node(doc,'b','','точный фрагмент'));
  head.appendChild(node(doc,'code','',resolution.status));
  head.appendChild(node(doc,'span','',resolution.origin));
  block.appendChild(head);
  if(resolution.text!==null) block.appendChild(node(doc,'blockquote','evidenceCandidateExactText',resolution.text));
  else block.appendChild(node(doc,'p','evidenceCandidateUnavailable','Текст не показан: точность источника не подтверждена.'));
  parent.appendChild(block);
}

function appendCandidate(doc,parent,candidate,payload,options,index){
  var report=Evidence.validateEvidenceCandidate(candidate),card,head,source,pins,resolution,reasons;
  if(report.status!=='VALID'){
    card=node(doc,'article','evidenceCandidateCard is-invalid');
    card.appendChild(node(doc,'b','','INVALID_CANDIDATE'));
    card.appendChild(node(doc,'code','',report.code||'INVALID_VALUE'));
    parent.appendChild(card);
    return false;
  }

  card=node(doc,'article','evidenceCandidateCard relation-'+candidate.proposedRelation.toLowerCase());
  card.dataset.candidateId=candidate.candidateId;
  card.dataset.relation=candidate.proposedRelation;
  head=node(doc,'header','evidenceCandidateCardHead');
  head.appendChild(node(doc,'span','evidenceCandidateOrdinal',String(index+1)));
  head.appendChild(node(doc,'b','evidenceCandidateRelation',candidate.proposedRelation));
  head.appendChild(node(doc,'code','evidenceCandidateLocalStatus',candidate.status));
  card.appendChild(head);

  source=node(doc,'section','evidenceCandidateSource');
  source.appendChild(node(doc,'b','evidenceCandidateSourceName',sourceLine(candidate)));
  source.appendChild(node(doc,'code','evidenceCandidateLocator',locatorLine(candidate)));
  pins=node(doc,'div','evidenceCandidatePins');
  appendPin(doc,pins,'sourceHash',candidate.sourceRef.sourceHash);
  appendPin(doc,pins,'passageTextHash',candidate.passageTextHash);
  appendPin(doc,pins,'candidateHash',candidate.contentHash);
  source.appendChild(pins);
  card.appendChild(source);

  resolution=resolveExactText(candidate,payload,options);
  appendExactText(doc,card,resolution);
  appendAlignment(doc,card,candidate);

  reasons=node(doc,'div','evidenceCandidateReasons');
  candidate.reasonCodes.forEach(function(reason){ reasons.appendChild(node(doc,'code','',reason)); });
  card.appendChild(reasons);
  parent.appendChild(card);
  return true;
}

function conflictTargets(candidates){
  var targets={},conflicts=[];
  candidates.forEach(function(candidate){
    var report=Evidence.validateEvidenceCandidate(candidate),key,relations;
    if(report.status!=='VALID') return;
    key=candidate.targetClaimRef.contentHash;
    relations=targets[key]||(targets[key]={});
    relations[candidate.proposedRelation]=true;
  });
  Object.keys(targets).sort().forEach(function(key){
    if(targets[key].SUPPORTS&&targets[key].REFUTES) conflicts.push(key);
  });
  return conflicts;
}

function boundaryValue(doc,label,value){
  var item=node(doc,'div','evidenceCandidateBoundaryItem');
  item.appendChild(node(doc,'span','',label));
  item.appendChild(node(doc,'b','',value));
  return item;
}

function render(root,payload,rawOptions){
  var options=rawOptions||{},doc,candidates,classified,validCandidates,invalidCandidates,visibleCandidates,conflicts,head,headStatus,boundary,list,conflict,primary,mentions,mentionDetails,mentionList,invalidList;
  if(!root) return null;
  clear(root);
  doc=root.ownerDocument||global.document;
  candidates=candidateList(payload);
  classified=classifyCandidates(candidates);
  validCandidates=classified.valid;
  invalidCandidates=classified.invalid;
  visibleCandidates=validCandidates.slice(0,DISPLAY_LIMIT);
  conflicts=conflictTargets(validCandidates);

  if((' '+root.className+' ').indexOf(' evidenceCandidateView ')===-1) root.className=(root.className?root.className+' ':'')+'evidenceCandidateView';
  root.dataset.status=validCandidates.length?'EVIDENCE_CANDIDATE':'NOT_COMPUTED';
  root.dataset.reviewStatus=validCandidates.length?'REQUIRES_REVIEW':'NOT_COMPUTED';
  root.dataset.finalRelation='NOT_COMPUTED';
  root.dataset.conflict=conflicts.length?'true':'false';
  root.dataset.candidateCount=String(validCandidates.length);
  root.dataset.validCandidateCount=String(validCandidates.length);
  root.dataset.inputCandidateCount=String(candidates.length);
  root.dataset.invalidCandidateCount=String(invalidCandidates.length);
  root.dataset.displayedCandidateCount=String(visibleCandidates.length);

  head=node(doc,'header','evidenceCandidateViewHead');
  head.appendChild(node(doc,'h3','','Кандидаты источников'));
  headStatus=node(doc,'span','evidenceCandidateLiveStatus',validCandidates.length+' · '+(validCandidates.length?'требуется проверка':'не вычислено'));
  if(typeof headStatus.setAttribute==='function'){ headStatus.setAttribute('aria-live','polite'); headStatus.setAttribute('aria-atomic','true'); }
  head.appendChild(headStatus);
  root.appendChild(head);

  boundary=node(doc,'div','evidenceCandidateBoundary');
  boundary.appendChild(boundaryValue(doc,'доказательность',root.dataset.status));
  boundary.appendChild(boundaryValue(doc,'проверка',root.dataset.reviewStatus));
  boundary.appendChild(boundaryValue(doc,'итоговое отношение',root.dataset.finalRelation));
  root.appendChild(boundary);

  if(conflicts.length){
    conflict=node(doc,'div','evidenceCandidateConflict');
    conflict.appendChild(node(doc,'b','','КОНФЛИКТ'));
    conflict.appendChild(node(doc,'span','','SUPPORTS + REFUTES'));
    conflict.appendChild(node(doc,'code','',conflicts.length+' target claim'));
    root.appendChild(conflict);
  }

  list=node(doc,'div','evidenceCandidateList');
  primary=visibleCandidates.filter(function(candidate){ return candidate.proposedRelation!=='MENTIONS'; });
  mentions=visibleCandidates.filter(function(candidate){ return candidate.proposedRelation==='MENTIONS'; });
  primary.forEach(function(candidate,index){ appendCandidate(doc,list,candidate,payload,options,index); });
  if(mentions.length){
    mentionDetails=node(doc,'details','evidenceCandidateMentions');
    mentionDetails.appendChild(node(doc,'summary','','MENTIONS · '+mentions.length));
    mentionList=node(doc,'div','evidenceCandidateMentionList');
    mentions.forEach(function(candidate,index){ appendCandidate(doc,mentionList,candidate,payload,options,primary.length+index); });
    mentionDetails.appendChild(mentionList);
    list.appendChild(mentionDetails);
  }
  if(invalidCandidates.length){
    invalidList=node(doc,'div','evidenceCandidateInvalidList');
    invalidCandidates.slice(0,3).forEach(function(entry){ appendInvalidCandidate(doc,invalidList,entry); });
    list.appendChild(invalidList);
  }
  if(visibleCandidates.length<validCandidates.length){
    list.appendChild(node(doc,'div','evidenceCandidateTruncated','Показано '+visibleCandidates.length+' из '+validCandidates.length+' кандидатов.'));
  }
  if(!validCandidates.length){
    list.appendChild(node(doc,'div','evidenceCandidateEmpty','Нет валидных source-backed кандидатов.'));
  }
  root.appendChild(list);
  return root;
}

global.MRDP78EvidenceCandidateView=Object.freeze({
  version:VERSION,
  status:'READY',
  schema:'meridian.evidence-candidate-view/1',
  resolverRequestSchema:'meridian.evidence-text-resolution-request/1',
  render:render,
  clear:clear
});
})(typeof globalThis!=='undefined'?globalThis:this);
