(function(global){
'use strict';

var VERSION='1.0.0';

function node(doc,tag,className,value){
  var item=doc.createElement(tag);
  if(className) item.className=className;
  if(value!==undefined&&value!==null) item.textContent=String(value);
  return item;
}
function clear(root){ while(root&&root.firstChild) root.removeChild(root.firstChild); }
function shortHash(value){ return String(value||'нет hash').replace(/^sha256:/,'').slice(0,12); }
function valueOr(value,fallback){ return typeof value==='string'&&value?value:fallback; }
function appendIdentity(doc,parent,label,value){
  var item=node(doc,'span','claimIdentity');
  item.appendChild(node(doc,'b','',label));
  item.appendChild(node(doc,'code','',shortHash(value)));
  parent.appendChild(item);
}
function fact(doc,label,value,className){
  var item=node(doc,'div','claimFact '+(className||''));
  item.appendChild(node(doc,'span','',label));
  item.appendChild(node(doc,'b','',valueOr(value,'—')));
  return item;
}
function argumentText(argument,surfaces){
  var surface=surfaces&&surfaces[argument.surfaceSpanId],identity=argument.senseId||argument.entityId||surface||argument.surfaceSpanId;
  return argument.role+' → '+identity;
}
function qualifierText(qualifiers){
  var keys=Object.keys(qualifiers||{}).sort();
  return keys.length?keys.map(function(key){ return key+'='+qualifiers[key]; }).join(' · '):'нет';
}
function issueText(issues){
  return (issues||[]).slice(0,4).map(function(issue){ return issue.code||issue; }).join(' · ')||'структура не построена';
}
function render(root,pack){
  if(!root) return null;
  clear(root);
  var doc=root.ownerDocument||global.document,value=pack||{},claim=value.claimAst||null,matches=value.structuralMatches||[],corpus=value.corpusMatches||[],surfaces=value.surfaceBySpanId||{},head=node(doc,'div','claimHead'),state=node(doc,'div','claimState'),identities=node(doc,'div','claimIdentities'),grid=node(doc,'div','claimGrid'),argumentList=node(doc,'div','claimArguments'),matchBlock=node(doc,'div','claimMatches'),trace=node(doc,'div','claimSteps'),ready=value.status==='READY';
  root.dataset.status=value.status||'INVALID';
  root.dataset.resolution=value.resolutionStatus||(claim&&claim.resolutionStatus)||'OOV';
  root.dataset.traceHash=value.traceHash||(value.trace&&value.trace.contentHash)||'';

  state.appendChild(node(doc,'b',ready?'ready':'blocked',ready?'CLAIM РАЗОБРАН':'CLAIM ОСТАНОВЛЕН'));
  state.appendChild(node(doc,'span','',value.resolutionStatus||(claim&&claim.resolutionStatus)||value.code||'OOV'));
  head.appendChild(state);
  appendIdentity(doc,identities,'lexicon',value.lexiconHash);
  appendIdentity(doc,identities,'patterns',value.patternSetHash);
  appendIdentity(doc,identities,'trace',root.dataset.traceHash);
  head.appendChild(identities);
  root.appendChild(head);

  if(claim){
    grid.appendChild(fact(doc,'предикат',claim.predicate.lemma,'predicate'));
    grid.appendChild(fact(doc,'sense',claim.predicate.senseId||'AMBIGUOUS'));
    grid.appendChild(fact(doc,'логика',claim.polarity+' · '+claim.modality));
    grid.appendChild(fact(doc,'квантор',claim.quantifier));
    root.appendChild(grid);
    claim.arguments.forEach(function(argument){ argumentList.appendChild(node(doc,'code','claimArgument',argumentText(argument,surfaces))); });
    root.appendChild(argumentList);
    root.appendChild(fact(doc,'qualifiers',qualifierText(claim.qualifiers),'qualifiers'));
  }else{
    root.appendChild(node(doc,'div','claimEmpty',issueText(value.issues)));
  }

  matchBlock.appendChild(node(doc,'div','claimMatchHead','STRUCTURAL_MATCH · '+matches.length+' · corpus '+corpus.length));
  matches.slice(0,4).forEach(function(match){
    var row=node(doc,'div','claimMatch');
    row.appendChild(node(doc,'b','',match.patternId||(match.patternRef&&match.patternRef.patternId)||'pattern'));
    row.appendChild(node(doc,'code','',match.status||'STRUCTURAL_MATCH'));
    matchBlock.appendChild(row);
  });
  if(!matches.length) matchBlock.appendChild(node(doc,'div','claimEmpty',claim?'закрытый pattern не совпал':'нет структуры для pattern'));
  root.appendChild(matchBlock);

  var boundary=node(doc,'div','claimEvidenceBoundary');
  boundary.appendChild(node(doc,'b','',value.evidenceStatus||'NOT_COMPUTED'));
  boundary.appendChild(node(doc,'span','',value.reviewStatus||'REQUIRES_REVIEW'));
  boundary.appendChild(node(doc,'code','',value.semanticTruth===true?'POLICY_VIOLATION':'ABSTAIN'));
  root.appendChild(boundary);

  ((value.trace&&value.trace.steps)||[]).forEach(function(step){
    var item=node(doc,'span','claimStep '+String(step.status||'').toLowerCase());
    item.appendChild(node(doc,'b','',String((Number(step.ordinal)||0)+1)));
    item.appendChild(node(doc,'span','',step.stage||'STEP'));
    item.appendChild(node(doc,'code','',step.status||'EMPTY'));
    trace.appendChild(item);
  });
  if(!trace.firstChild) trace.appendChild(node(doc,'div','claimEmpty','trace не построен'));
  root.appendChild(trace);
  return root;
}

global.MRDP78ClaimView=Object.freeze({version:VERSION,render:render,clear:clear});
})(typeof globalThis!=='undefined'?globalThis:this);
