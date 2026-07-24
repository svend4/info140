(function(global){
'use strict';
function engine(){ return global.MRDSemanticDecision||null; }
function num(value){ value=Number(value); return isFinite(value)?value:0; }
function pct(value){ return Math.round(Math.max(0,Math.min(1,num(value)))*100)+'%'; }
function decisionLabel(value){ return value==='apply'?'ПРИМЕНИТЬ':value==='reject'?'ОТКЛОНИТЬ':'УТОЧНИТЬ'; }
function checkLabel(id){
  var labels={coverage:'покрытие',negation:'отрицание',candidate:'кандидат',grammar:'грамматика',open_ring:'кольцо',theme:'тема',newness:'новизна',data_support:'корпус'};
  return labels[id]||id||'проверка';
}
function branchSymbol(id){ return id==='generalize'?'⇑':id==='detail'?'⇓':'○'; }
function branchLabel(id){ return id==='generalize'?'3D':id==='detail'?'1D':'2D'; }
function typedSummary(program){
  var data=program||{}, first=data.errors&&data.errors[0], code=first&&first.code;
  if(data.status==='composed') return (data.portPath||'ID -> STATE -> EFFECT -> STATE')+' · '+(data.direction||'orbit');
  return String(data.status||'unavailable').toUpperCase()+(code?' · '+code:'');
}
function hexHash(value){ return ('00000000'+((Number(value)||0)>>>0).toString(16)).slice(-8); }
function transactionSummary(transaction){
  var data=transaction||{}, first=data.errors&&data.errors[0], code=first&&first.code, status=String(data.status||'UNAVAILABLE').toUpperCase();
  if(status==='READY') return 'READY · '+(data.transactionId||'tx')+' · #'+hexHash(data.sourceHash)+' -> #'+hexHash(data.afterHash);
  return status+(code?' · '+code:'');
}
function zoneLabel(value){
  var labels={safe:'кольцо',thin:'тонкое кольцо',center:'3D-центр',edge:'1D-край',conflict:'конфликт',stall:'остановка'};
  return labels[String(value||'').toLowerCase()]||String(value||'нет зоны');
}
function guardSummary(value){
  value=value||{};
  return zoneLabel(value.zone)+' · u='+num(value.u).toFixed(2)+' · guard='+num(value.score).toFixed(2);
}
function firstCode(value){
  var first=value&&value.errors&&value.errors[0];
  return value&&(value.code||value.errorCode)||(first&&first.code)||'';
}
function flowState(decision,transaction){
  var code=firstCode(transaction), tx=String(transaction&&transaction.status||'').toUpperCase();
  if(code==='TX_STALE_SOURCE'||code==='TX_STALE_TARGET'||code==='ACTION_STALE_SOURCE'||code==='ACTION_STALE_TARGET') return 'STALE';
  if(decision&&decision.decision==='apply'&&tx==='READY') return 'READY';
  if(decision&&decision.decision==='clarify') return 'NEEDS_INPUT';
  return 'BLOCKED';
}
function directionOf(decision){
  var typed=decision&&decision.typedProgram||{}, best=decision&&decision.best||{};
  return typed.direction||best.id||'orbit';
}
function directionLabel(value){
  return value==='generalize'?'к 3D-обобщению':value==='detail'?'к 1D-детализации':'по 2D-кольцу';
}
function setData(root,name,value){
  if(root.dataset) root.dataset[name]=String(value==null?'':value);
  else if(typeof root.setAttribute==='function') root.setAttribute('data-'+name.replace(/[A-Z]/g,function(letter){return '-'+letter.toLowerCase();}),String(value==null?'':value));
}
function renderTransactionPreview(root,decision,transaction){
  var preview=document.createElement('div'); preview.className='transactionPreview';
  var head=document.createElement('div'); head.className='transactionPreviewHead';
  var title=document.createElement('b'); title.textContent='точное изменение';
  var state=document.createElement('span'); state.textContent=transactionSummary(transaction);
  head.appendChild(title); head.appendChild(state); preview.appendChild(head);

  var insert=document.createElement('div'); insert.className='transactionInsertLine';
  var insertLabel=document.createElement('b'); insertLabel.textContent='добавится';
  var insertText=document.createElement('span'); insertText.textContent=transaction.insertLine||decision.insertLine||'строка не подготовлена';
  insert.appendChild(insertLabel); insert.appendChild(insertText); preview.appendChild(insert);

  var comparison=document.createElement('div'); comparison.className='transactionPreviewGrid';
  var before=document.createElement('div'); before.className='transactionPreviewBlock before';
  var beforeLabel=document.createElement('b'); beforeLabel.textContent='до';
  var beforeText=document.createElement('pre'); beforeText.textContent=transaction.source==null?'нет снимка':String(transaction.source);
  before.appendChild(beforeLabel); before.appendChild(beforeText);
  var arrow=document.createElement('i'); arrow.className='transactionPreviewArrow'; arrow.textContent='→'; arrow.setAttribute('aria-hidden','true');
  var after=document.createElement('div'); after.className='transactionPreviewBlock after';
  var afterLabel=document.createElement('b'); afterLabel.textContent='после';
  var afterText=document.createElement('pre'); afterText.textContent=transaction.afterText==null?'нет снимка':String(transaction.afterText);
  after.appendChild(afterLabel); after.appendChild(afterText);
  comparison.appendChild(before); comparison.appendChild(arrow); comparison.appendChild(after); preview.appendChild(comparison);

  var guards=document.createElement('div'); guards.className='transactionGuardDelta';
  var guardBefore=document.createElement('div'); var guardBeforeLabel=document.createElement('b'); var guardBeforeText=document.createElement('span');
  guardBeforeLabel.textContent='граница до'; guardBeforeText.textContent=guardSummary(transaction.beforeGuard); guardBefore.appendChild(guardBeforeLabel); guardBefore.appendChild(guardBeforeText);
  var guardArrow=document.createElement('i'); guardArrow.textContent='→'; guardArrow.setAttribute('aria-hidden','true');
  var guardAfter=document.createElement('div'); var guardAfterLabel=document.createElement('b'); var guardAfterText=document.createElement('span');
  guardAfterLabel.textContent='граница после'; guardAfterText.textContent=guardSummary(transaction.afterGuard); guardAfter.appendChild(guardAfterLabel); guardAfter.appendChild(guardAfterText);
  guards.appendChild(guardBefore); guards.appendChild(guardArrow); guards.appendChild(guardAfter); preview.appendChild(guards);

  var trace=document.createElement('div'); trace.className='transactionMetaLine';
  trace.textContent=(transaction.transactionId||'tx не подготовлена')+' · #'+hexHash(transaction.sourceHash)+' -> #'+hexHash(transaction.afterHash)+(transaction.target?' · цель: '+transaction.target:'');
  preview.appendChild(trace); root.appendChild(preview);
}
function phaseText(value){ value=value||{}; return num(value.passed)+'/'+num(value.total); }
function ledgerStatus(value){
  return value==='ROLLED_BACK'?'ОТКАЧЕНО':value==='ALREADY_COMMITTED'?'УЖЕ ПРИМЕНЕНО':'ПРИНЯТО';
}
function renderLedger(root,options){
  var state=options.ledger||{}, all=Array.isArray(state.entries)?state.entries:[], entries=all.slice(Math.max(0,all.length-4)).reverse();
  var ledger=document.createElement('div'); ledger.className='transactionLedger';
  var head=document.createElement('div'); head.className='transactionLedgerHead';
  var title=document.createElement('b'); title.textContent='журнал действий · '+all.length;
  var note=document.createElement('span'); note.textContent='точные снимки · последние 4';
  head.appendChild(title); head.appendChild(note); ledger.appendChild(head);
  if(!entries.length){
    var empty=document.createElement('div'); empty.className='transactionLedgerEmpty'; empty.textContent='принятых транзакций пока нет'; ledger.appendChild(empty);
  }
  entries.forEach(function(entry){
    var row=document.createElement('div'); row.className='transactionLedgerRow '+String(entry.status||'').toLowerCase();
    var body=document.createElement('div'); body.className='transactionLedgerBody';
    var line=document.createElement('div'); line.className='transactionLedgerTitle';
    var label=document.createElement('b'); label.textContent='#'+num(entry.seq)+' · '+(entry.actionLabel||entry.actionId||'действие');
    var status=document.createElement('span'); status.textContent=ledgerStatus(entry.status)+(entry.replayOf!=null?' · повтор #'+entry.replayOf:'');
    line.appendChild(label); line.appendChild(status);
    var contract=entry.contract||{};
    var checks=document.createElement('div'); checks.className='transactionLedgerChecks';
    checks.textContent='pre '+phaseText(contract.pre)+' · inv '+phaseText(contract.inv)+' · post '+phaseText(contract.post);
    var trace=document.createElement('div'); trace.className='transactionLedgerTrace';
    trace.textContent=(entry.portPath||'ID -> STATE -> EFFECT -> STATE')+' · #'+hexHash(entry.sourceHash)+' -> #'+hexHash(entry.afterHash);
    var proof=document.createElement('div'); proof.className='transactionLedgerProof';
    proof.textContent=(entry.evidenceLevel||entry.evidence||'UNVERIFIED')+' · '+(entry.soundness||'NOT_COMPUTED')+' · '+(entry.origin||'p78');
    body.appendChild(line); body.appendChild(checks); body.appendChild(trace); body.appendChild(proof);
    var replay=document.createElement('button'); replay.type='button'; replay.className='transactionReplay'; replay.textContent='↻';
    replay.title='воспроизвести транзакцию'; replay.setAttribute('aria-label','воспроизвести транзакцию #'+num(entry.seq));
    var ledgerEngine=global.MRDSemanticLedger, currentText=options.getText?options.getText():options.text, currentTarget=options.getTarget?options.getTarget():options.target;
    replay.disabled=!(ledgerEngine&&typeof ledgerEngine.canReplay==='function'&&ledgerEngine.canReplay(entry,currentText,currentTarget));
    replay.onclick=function(){ if(options.onReplay) options.onReplay(entry); };
    row.appendChild(body); row.appendChild(replay); ledger.appendChild(row);
  });
  root.appendChild(ledger);
}
function report(decision){
  var data=decision||{}, interpretation=data.interpretation||{}, grammar=interpretation.grammar||{}, language=interpretation.language||{}, ambiguity=interpretation.ambiguities&&interpretation.ambiguities[0], typed=data.typedProgram||{}, transaction=data.transaction||{}, corpus=data.dataEvidence||data.verification&&data.verification.data||{};
  var lines=[
    decisionLabel(data.decision)+': '+(data.summary||'Нет решения.'),
    'coverage='+pct(interpretation.coverage||0)+'; evidence='+(data.evidenceLevel||'UNVERIFIED')+'; soundness='+(data.soundness||'NOT_COMPUTED')+'.'
  ];
  if(data.reasonCodes&&data.reasonCodes.length) lines.push('Причины: '+data.reasonCodes.join(', ')+'.');
  lines.push('LANG: '+(language.mode||'UNAVAILABLE')+'; grammar='+(grammar.status||'UNAVAILABLE')+' '+pct(grammar.score||0)+'; evidence='+(grammar.evidenceLevel||'UNVERIFIED')+'.');
  lines.push('DATA: '+(corpus.status||'UNAVAILABLE')+(corpus.status==='READY'?' · '+pct(corpus.score||0)+' · '+(corpus.provenance&&corpus.provenance.provider||'local'):' · '+(corpus.code||'no evidence'))+'; soundness='+(corpus.soundness||'NOT_COMPUTED')+'.');
  if(ambiguity) lines.push('Смысл: '+(ambiguity.resolved?ambiguity.senseId:'AMBIGUOUS')+'.');
  lines.push('DSL: '+typedSummary(typed)+'; evidence='+(typed.evidence||'UNVERIFIED')+'; soundness='+(typed.soundness||'NOT_COMPUTED')+'.');
  lines.push('TX: '+transactionSummary(transaction)+'; evidence='+(transaction.evidence||'UNVERIFIED')+'; soundness='+(transaction.soundness||'NOT_COMPUTED')+'.');
  if(data.candidate) lines.push('Кандидат: '+data.candidate);
  return lines.join('\n');
}
function addRow(root,item){
  var row=document.createElement('div'); row.className='protocolRow '+(item.ok?'ok':'bad');
  var label=document.createElement('b'); label.textContent=item.label;
  var text=document.createElement('span'); text.textContent=item.text;
  var score=document.createElement('i'); score.textContent=num(item.score).toFixed(2);
  row.appendChild(label); row.appendChild(text); row.appendChild(score); root.appendChild(row);
}
function render(root,options){
  options=options||{};
  if(!root) return null;
  var semantic=engine(), decision=options.decision||(semantic&&semantic.decide?semantic.decide(options.text||'',options.target||''):null);
  decision=decision||{decision:'clarify',summary:'Модуль семантического решения не подключен.',interpretation:{coverage:0,ambiguities:[]},verification:{checks:[]},branches:{branches:[]},evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'};
  var interpretation=decision.interpretation||{}, grammar=interpretation.grammar||{}, language=interpretation.language||{}, verification=decision.verification||{}, branchPack=decision.branches||{}, typed=decision.typedProgram||{}, transaction=decision.transaction||{}, corpus=decision.dataEvidence||verification.data||{}, corpusSnapshot=branchPack.dataSnapshot||{};
  root.innerHTML='';
  var currentFlowState=flowState(decision,transaction), currentDirection=directionOf(decision);
  setData(root,'flowState',currentFlowState);
  setData(root,'direction',currentDirection);
  setData(root,'revision',options.revision==null?'':options.revision);
  setData(root,'traceHash',options.traceHash||'');
  setData(root,'traceOrigin',options.traceOrigin||'FORECAST');
  setData(root,'beforeU',transaction.beforeGuard&&transaction.beforeGuard.u!=null?num(transaction.beforeGuard.u).toFixed(4):'');
  setData(root,'afterU',transaction.afterGuard&&transaction.afterGuard.u!=null?num(transaction.afterGuard.u).toFixed(4):'');

  var head=document.createElement('div'); head.className='protocolHead '+(decision.decision||'clarify');
  var title=document.createElement('b'); title.textContent='семантическое решение · '+decisionLabel(decision.decision);
  var formula=document.createElement('span'); formula.textContent=decision.formula||'interpret -> decide -> verify';
  head.appendChild(title); head.appendChild(formula); root.appendChild(head);

  var summary=document.createElement('div'); summary.className='decisionLine'; summary.textContent=decision.summary||'Нет расчета.'; root.appendChild(summary);
  var meta=document.createElement('div'); meta.className='decisionMeta';
  var ambiguity=interpretation.ambiguities&&interpretation.ambiguities[0];
  ['покрытие '+pct(interpretation.coverage||0),'слова '+num(interpretation.recognizedCount)+'/'+num(interpretation.contentCount),'язык '+String(language.mode||'UNAVAILABLE'),'грамматика '+String(grammar.status||'UNAVAILABLE'),'данные '+String(corpusSnapshot.status||corpus.status||'UNAVAILABLE'),'уровень '+(decision.evidenceLevel||'UNVERIFIED'),'DSL '+String(typed.status||'unavailable').toUpperCase(),'TX '+String(transaction.status||'unavailable').toUpperCase()].forEach(function(value){var span=document.createElement('span');span.textContent=value;meta.appendChild(span);});
  if(ambiguity){ var sense=document.createElement('span'); sense.textContent=ambiguity.resolved?'смысл '+ambiguity.senseId:'смысл AMBIGUOUS'; meta.appendChild(sense); }
  root.appendChild(meta);

  var flow=document.createElement('div'); flow.className='decisionFlowState '+currentFlowState.toLowerCase();
  var flowLabel=document.createElement('b'); flowLabel.textContent=currentFlowState;
  var flowDirection=document.createElement('span'); flowDirection.textContent=directionLabel(currentDirection);
  var flowTrace=document.createElement('small');
  flowTrace.textContent='ревизия '+String(options.revision==null?'—':options.revision)+' · trace '+String(options.traceHash||'—')+' · '+String(options.traceOrigin||'FORECAST').toUpperCase();
  flow.appendChild(flowLabel); flow.appendChild(flowDirection); flow.appendChild(flowTrace); root.appendChild(flow);

  var branches=document.createElement('div'); branches.className='decisionBranches';
  (branchPack.branches||[]).forEach(function(branch){
    var item=document.createElement('div'); item.className='decisionBranch '+(branch.status||'repair')+(decision.best&&decision.best.id===branch.id?' best':'');
    var op=document.createElement('b'); op.textContent=branchSymbol(branch.id)+' '+branchLabel(branch.id);
    var state=document.createElement('span'); state.textContent=(branch.status||'repair')+' · '+num(branch.score).toFixed(2)+(branch.data&&branch.data.status==='READY'?' · data '+num(branch.dataScore).toFixed(2):'');
    item.appendChild(op); item.appendChild(state); branches.appendChild(item);
  });
  if(branches.childNodes.length) root.appendChild(branches);

  renderTransactionPreview(root,decision,transaction);

  var rows=document.createElement('div'); rows.className='protocolRows';
  addRow(rows,{label:'покрытие',ok:(interpretation.coverage||0)>=.30,text:num(interpretation.recognizedCount)+' распознано из '+num(interpretation.contentCount),score:interpretation.coverage||0});
  addRow(rows,{label:'операторы',ok:(decision.reasonCodes||[]).indexOf('negated_operator')<0,text:interpretation.negatedOperators&&interpretation.negatedOperators.length?'запрет: '+interpretation.blockedDirections.join(', '):'прямого запрета нет',score:(decision.reasonCodes||[]).indexOf('negated_operator')<0?1:0});
  addRow(rows,{label:'значение',ok:!ambiguity||ambiguity.resolved,text:ambiguity?(ambiguity.resolved?ambiguity.senseId:'нужно уточнить значение'):'неоднозначность не найдена',score:ambiguity?(ambiguity.confidence||0):1});
  addRow(rows,{label:'грамматика',ok:grammar.status!=='CONFLICT',text:(grammar.status||'UNAVAILABLE')+(grammar.openValencies&&grammar.openValencies.length?' · открыто '+grammar.openValencies.length:''),score:grammar.score||0});
  addRow(rows,{label:'DSL',ok:typed.status==='composed',text:typedSummary(typed),score:typed.status==='composed'?1:0});
  addRow(rows,{label:'TX',ok:transaction.status==='READY',text:transactionSummary(transaction),score:transaction.status==='READY'?1:0});
  (verification.checks||[]).filter(function(item){return ['open_ring','theme','newness','data_support'].indexOf(item.id)>=0;}).forEach(function(item){
    var rowText=item.id==='data_support'?(item.status==='READY'?'локальный мини-корпус поддерживает ранжирование':'ABSTAIN · '+(item.code||'нет покрытых опор')):(item.ok?'проверка пройдена':'проверка не пройдена');
    addRow(rows,{label:checkLabel(item.id),ok:item.id==='data_support'?item.status==='READY':!!item.ok,text:rowText,score:item.value||0});
  });
  addRow(rows,{label:'proof',ok:decision.evidenceLevel==='STRUCTURAL',text:(decision.evidenceLevel||'UNVERIFIED')+'; soundness '+(decision.soundness||'NOT_COMPUTED')+(verification.witness?'; '+verification.witness:''),score:decision.evidenceLevel==='STRUCTURAL'?1:0});
  root.appendChild(rows);

  var actions=document.createElement('div'); actions.className='protocolActions';
  var refresh=document.createElement('button'); refresh.type='button'; refresh.textContent='проверить';
  refresh.onclick=function(){
    if(options.onRefresh) options.onRefresh();
    else{
      var next={}; Object.keys(options).forEach(function(key){next[key]=options[key];});
      next.text=options.getText?options.getText():options.text; next.target=options.getTarget?options.getTarget():options.target; next.decision=null;
      render(root,next);
    }
    if(options.onEvent) options.onEvent('семантическое решение пересчитано');
  };
  var copy=document.createElement('button'); copy.type='button'; copy.textContent='копировать'; copy.onclick=function(){ if(options.onCopy) options.onCopy(report(decision),decision); };
  var undo=document.createElement('button'); undo.type='button'; undo.className='transactionUndo'; undo.textContent='↶';
  undo.title='откатить последнее точное изменение'; undo.setAttribute('aria-label','откатить последнее точное изменение'); undo.disabled=!options.canUndo;
  undo.onclick=function(){ if(options.onUndo) options.onUndo(); };
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent='вставить ход'; apply.disabled=!(currentFlowState==='READY'&&decision.insertLine&&transaction.status==='READY');
  apply.onclick=function(){ if(options.onApply) options.onApply(decision.insertLine,decision,transaction); };
  actions.appendChild(refresh); actions.appendChild(copy); actions.appendChild(undo); actions.appendChild(apply); root.appendChild(actions);
  renderLedger(root,options);
  return decision;
}
global.MRDSemanticDecisionView={version:'1.6.0',render:render,report:report};
})(window);
