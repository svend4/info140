(function(global){
'use strict';
var VERSION='1.13.0';
function clean(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function pct(x){ return Math.round(Math.max(0,Math.min(1,Number(x)||0))*100); }
function stripPrefix(s){ return clean(clean(s).replace(/^(Цель-гомеостаз|Рельсы|Φ|Баланс|Связка):\s*/,'')); }
function resultPhrase(topic,verb,bridge,detail){
  topic=clean(topic)||'тема'; verb=clean(verb)||'делает ход'; bridge=clean(bridge)||'мост'; detail=clean(detail)||'деталь';
  if(/^(через|к|ко|по|на|в|во|между|для|после|перед|до|от)$/i.test(bridge)) return '«'+topic+'» '+verb+' '+bridge+' «'+detail+'»';
  return '«'+topic+'» '+verb+' через «'+bridge+'» к «'+detail+'»';
}
function api(){ return global.MRDSemanticCore || null; }
function reactionApi(){ return global.MRDSemanticReactionField || null; }
function traceContinuationApi(){ return global.MRDSemanticTraceContinuation || null; }
function dataEvidenceApi(){ return global.MRDSemanticDataEvidence || null; }
function languageApi(){ return global.MRDSemanticLanguage || null; }
function directionValues(values){
  values=values||{};
  return {generalize:Math.max(0,Number(values.generalize)||0),detail:Math.max(0,Number(values.detail)||0),orbit:Math.max(0,Number(values.orbit)||0),repair:Math.max(0,Number(values.repair)||0)};
}
function directionCountText(values){
  return 'сборка '+values.generalize+', деталь '+values.detail+', круг '+values.orbit+', ремонт '+values.repair;
}
function directionTargetText(values){
  return 'сборка '+Math.round(Math.min(1,values.generalize)*100)+'%, деталь '+Math.round(Math.min(1,values.detail)*100)+'%, круг '+Math.round(Math.min(1,values.orbit)*100)+'%, ремонт '+Math.round(Math.min(1,values.repair)*100)+'%';
}
function directionActionText(value){
  var labels={generalize:'сборке',detail:'детали',orbit:'кругу',repair:'ремонту'}; return labels[value]||value||'следующему типу';
}
function observedProjection(observed){
  if(!observed||observed.origin!=='observed'||observed.kind!=='MRDSemanticReactionRuntimeSnapshot') return null;
  var events=observed.lastEvents&&observed.lastEvents.length?observed.lastEvents:(observed.history||[]);
  var event=events.length?events[events.length-1]:null;
  var tick=Math.max(0,Number(observed.tick)||0),metrics=observed.metrics||{},profile=observed.directionProfile||{},mixTarget=directionValues(profile.target||metrics.directionTarget),reachable=directionValues(metrics.directionReachableProfile);
  var sampleSize=Math.max(0,Number(metrics.directionSampleSize)||0),opportunitySize=Math.max(0,Number(metrics.directionOpportunitySampleSize)||0),divergence=sampleSize?Math.max(0,Math.min(1,Number(metrics.directionDivergence)||0)):0;
  var availability=opportunitySize?Math.max(0,Math.min(1,Number(metrics.directionAvailabilityDivergence)||0)):0,control=sampleSize&&opportunitySize?Math.max(0,Math.min(1,Number(metrics.directionControlDivergence)||0)):0;
  if(!event) return {origin:'observed',status:'quiet',tick:tick,eventTick:null,eventId:null,ruleId:null,selectionReason:null,selectionInput:null,directionCounts:directionValues(metrics.directionCounts),directionTarget:mixTarget,directionReachableProfile:reachable,directionProfile:profile,directionDivergence:divergence,directionAvailabilityDivergence:availability,directionControlDivergence:control,score:0,text:'Наблюдение t'+tick+': фактических срабатываний пока нет; поле продолжает движение. Цель: '+directionTargetText(mixTarget)+'; доступно: '+(opportunitySize?directionTargetText(reachable):'пока нет пороговых пар')+'; Δmix / Δspace / Δcontrol —.',evidenceLevel:observed.evidenceLevel||'UNVERIFIED',soundness:observed.soundness||'NOT_COMPUTED'};
  var source=clean(event.sourceToken)||String(event.sourceId), target=clean(event.targetToken)||String(event.targetId);
  var generation=Math.max(0,Number(event.generation)||0), eventTick=Math.max(0,Number(event.tick)||0);
  var score=Math.max(0,Math.min(1,Number(event.force)||0));
  var reason=clean(event.selectionReason),directions=directionValues(metrics.directionCounts),calibration=clean(event.calibrationReason),calibrationNote='';
  if(calibration==='direction:underrepresented') calibrationNote=', дефицит текущего направления';
  else if(calibration==='handoff:underrepresented') calibrationNote=', маршрут к '+directionActionText(event.handoffDirection);
  var line='Наблюдение t'+tick+', событие t'+eventTick+': «'+source+'» → «'+target+'»; '+String(event.ruleId||'RULE')+' / '+clean(event.ruleLabel||event.direction||'reaction')+(reason?', причина '+reason:'')+calibrationNote+', накоплено: '+directionCountText(directions)+'; цель: '+directionTargetText(mixTarget)+'; доступно: '+(opportunitySize?directionTargetText(reachable):'нет пороговых пар')+'; Δmix '+divergence.toFixed(2)+', Δspace '+(opportunitySize?availability.toFixed(2):'—')+', Δcontrol '+(sampleSize&&opportunitySize?control.toFixed(2):'—')+'; поколение '+generation+', всего '+Math.max(0,Number(metrics.totalEvents)||0)+'.';
  return {origin:'observed',status:eventTick===tick?'fired':'history',tick:tick,eventTick:eventTick,eventId:event.eventId||null,parentEventId:event.parentEventId||null,ruleId:event.ruleId||null,ruleVersion:event.ruleVersion||observed.ruleVersion||null,ruleHash:event.ruleHash||observed.ruleHash||null,selectionReason:reason||null,selectionInput:event.selectionInput||null,calibrationReason:calibration||null,calibrationDebt:Number(event.calibrationDebt)||0,calibrationScore:Number(event.calibrationScore)||0,calibrationMultiplier:Number(event.calibrationMultiplier)||1,handoffDirection:event.handoffDirection||null,handoffDebt:Number(event.handoffDebt)||0,directionCounts:directions,directionTarget:mixTarget,directionReachableProfile:reachable,directionProfile:profile,directionDivergence:divergence,directionAvailabilityDivergence:availability,directionControlDivergence:control,sourceToken:source,targetToken:target,generation:generation,direction:event.direction||null,score:score,text:line,evidenceLevel:event.evidenceLevel||observed.evidenceLevel||'UNVERIFIED',soundness:event.soundness||observed.soundness||'NOT_COMPUTED'};
}
function fallback(text){
  var source=clean(text), has=source.length>0;
  return {status:has?'draft':'empty',title:has?'вывод · черновик':'вывод · пусто',summary:has?'Текст принят, но semantic-core недоступен для расчета.':'Введите условие, чтобы получить текстовый итог.',outputLine:has?'Вывод: '+source:'Вывод: нет входных данных.',metrics:{guard:0,rails:0,phi:0,goal:0},rows:[{label:'режим',value:has?'fallback':'empty',score:has?.3:0}],insertLine:''};
}
function summarize(text,target,context){
  var core=api(); if(!core) return fallback(text);
  context=context||{};
  var source=clean(text), targetText=clean(target);
  if(!source) return fallback('');
  var precomputed=context.precomputed||null;
  var scoped=!!(precomputed&&clean(precomputed.source)===source&&clean(precomputed.target)===targetText);
  var analysis=scoped&&precomputed.analysis||core.analyzeText(source);
  var guard=scoped&&precomputed.guard||core.stabilityGuard(source);
  var rails=scoped&&precomputed.rails||(core.semanticRails?core.semanticRails(source):null);
  var phi=scoped&&precomputed.phi||(core.semanticPhi?core.semanticPhi(source):null);
  var goal=scoped&&precomputed.goal||(core.semanticGoal?core.semanticGoal(source,targetText):null);
  var languageEngine=languageApi(), language=rails&&rails.language||(languageEngine&&typeof languageEngine.analyze==='function'?languageEngine.analyze(source):null), grammar=language&&language.grammar||null;
  var languageContent=Math.max(0,Number(language&&language.contentCount)||0), languageRecognized=Math.max(0,Number(language&&language.recognizedCount)||0), languageAbstain=languageContent>0&&languageRecognized===0;
  var reaction=context.reaction||null, reactionEngine=reactionApi();
  if(!reaction&&reactionEngine&&typeof reactionEngine.simulate==='function') reaction=reactionEngine.simulate(analysis,context.lambda);
  var observation=observedProjection(context.observed||null);
  var continuationEngine=traceContinuationApi(), traceContinuation=continuationEngine&&typeof continuationEngine.compose==='function'?continuationEngine.compose({text:source,target:targetText,analysis:analysis,rails:rails,reaction:reaction,observed:context.observed||null}):null;
  if(languageAbstain) traceContinuation={status:'ABSTAIN',origin:'none',genre:'generic',direction:'none',code:'LANGUAGE_COVERAGE',message:'Недостаточно распознанного смысла.',score:0,trace:[],sentence:'',insertLine:''};
  var dataEngine=dataEvidenceApi(), dataCandidate=traceContinuation&&traceContinuation.status==='READY'?traceContinuation.sentence:'', dataEvidence=dataEngine&&typeof dataEngine.assess==='function'?dataEngine.assess(source,dataCandidate,targetText):null;
  var dataSnapshot=dataEngine&&typeof dataEngine.snapshot==='function'?dataEngine.snapshot():null;
  var topic=(rails&&rails.theme)||(analysis.tokens&&analysis.tokens[0])||'тема';
  var bridge=(rails&&rails.bridge)||'мост';
  var detail=(rails&&rails.detail)||(analysis.tokens&&analysis.tokens[1])||'деталь';
  var verb=(rails&&rails.verb)||'делает ход';
  var guardOk=guard.zone==='safe'||guard.zone==='thin';
  var railsOk=rails&&(rails.status==='complete'||rails.status==='thin');
  var phiScore=phi&&phi.score||0, goalScore=goal&&goal.score||0;
  var status='continue', summary='', output='';
  if(languageAbstain){
    status='abstain';
    summary='Недостаточно распознанного смысла: система воздерживается и просит уточнить условие.';
    output='Вывод: недостаточно распознанного смысла. Добавьте известную тему, действие или связь.';
  }else if(!guardOk){
    status='repair';
    summary='Система считает, что прямое продолжение пока опасно: есть выход к краю, центру или смысловой разрыв.';
    output='Вывод: сначала нужен ремонт. '+stripPrefix((goal&&goal.insertLine)||(rails&&rails.insertLine)||'Поставить мост и удержать 0<u<1.');
  }else if(grammar&&grammar.status==='CONFLICT'){
    status='grammar';
    summary='Смысловая зона держится, но формы слов или управление конфликтуют; система не угадывает исправление.';
    output='Вывод: уточнить грамматику. '+stripPrefix((rails&&rails.insertLine)||'Согласовать формы слов и заполнить управление действия.');
  }else if(!railsOk){
    status='rails';
    summary='Смысловая зона держится, но фразовый скелет неполный: нужно достроить рельсы.';
    output='Вывод: достроить фразу. '+stripPrefix((rails&&rails.insertLine)||'Добавить действие, мост, деталь и следующий ход.');
  }else if(phi&&phi.status==='repair'){
    status='phi';
    summary='Фраза читается, но разумность продолжения слабая: рост, новизна, открытость или баланс просели.';
    output='Вывод: усилить живость. '+stripPrefix(phi.insertLine||'Добавить связную новую кроху и оставить следующий ход открытым.');
  }else if(goal&&(goal.status==='target'||goal.status==='homeostasis')){
    status='answer';
    summary='Система видит устойчивый ответ: цель близка или гомеостаз удержан.';
    output='Вывод: '+resultPhrase(topic,'движется',bridge,detail)+'; ответ можно зафиксировать как продолжение, не закрывая следующий ход.';
  }else{
    status='continue';
    summary='Система считает продолжение рабочим: рельсы есть, guard в живом кольце, Φ не провалилась.';
    output='Вывод: '+resultPhrase(topic,verb,bridge,detail)+'; следующий ход остается открытым.';
  }
  if((status==='continue'||status==='answer')&&traceContinuation&&traceContinuation.status==='READY'){
    output='Вывод: '+traceContinuation.sentence;
    summary+=' Причинное продолжение построено по '+(traceContinuation.origin==='observed'?'наблюдаемой':'прогнозной')+' цепи; событий: '+traceContinuation.trace.length+'.';
  }else if((status==='continue'||status==='answer')&&traceContinuation&&traceContinuation.status==='ABSTAIN'){
    summary+=' Причинное продолжение: ABSTAIN ('+traceContinuation.code+'). '+traceContinuation.message;
  }
  if(dataEvidence&&dataEvidence.status==='READY') summary+=' Локальный мини-корпус ('+(dataEvidence.provenance&&dataEvidence.provenance.provider||'unknown')+') поддерживает связь с оценкой '+pct(dataEvidence.score)+'%; влияние на выбор ограничено '+Math.round((dataEvidence.boundedWeight||0)*100)+'%.';
  if(!languageAbstain&&reaction&&reaction.text&&reaction.text.summary) summary+=' Прогноз локальной реакции: '+reaction.text.summary+' '+reaction.text.output;
  if(!languageAbstain&&observation) summary+=' '+observation.text;
  var metrics={guard:guard.score||0,rails:rails&&rails.score||0,grammar:grammar?grammar.score||0:0,phi:phiScore,goal:goalScore,reaction:reaction&&reaction.metrics&&reaction.metrics.criticality||0,observed:observation&&observation.score||0,continuation:traceContinuation&&traceContinuation.score||0,data:dataEvidence&&dataEvidence.status==='READY'?dataEvidence.score||0:0};
  var rows=[
    {label:'guard',value:(guard.zone||'safe')+' · '+pct(metrics.guard)+'%',score:metrics.guard},
    {label:'рельсы',value:(rails&&rails.status||'нет')+' · '+pct(metrics.rails)+'%',score:metrics.rails},
    {label:'грамматика',value:(grammar&&grammar.status||'UNAVAILABLE')+' · '+pct(metrics.grammar)+'%',score:metrics.grammar},
    {label:'Φ',value:(phi&&phi.status||'нет')+' · '+pct(metrics.phi)+'%',score:metrics.phi},
    {label:'цель',value:(goal&&goal.status||'нет')+' · '+pct(metrics.goal)+'%',score:metrics.goal},
    {label:'цепь',value:reaction?(reaction.status+' · '+(reaction.metrics.depth||0)+' пок. · '+(reaction.metrics.fired||0)+' сраб.'):'нет расчета',score:metrics.reaction}
  ];
  if(observation) rows.push({label:'\u043d\u0430\u0431\u043b\u044e\u0434.',value:'t'+observation.tick+' \u00b7 '+(observation.ruleId||'\u043e\u0436\u0438\u0434\u0430\u043d\u0438\u0435')+' \u00b7 '+observation.status,score:metrics.observed});
  if(traceContinuation) rows.push({label:'продолжение',value:traceContinuation.status+' · '+traceContinuation.origin+(traceContinuation.status==='READY'?' · '+traceContinuation.genre+' · '+traceContinuation.direction:' · '+traceContinuation.code),score:metrics.continuation});
  if(dataSnapshot) rows.push({label:'корпус',value:(dataEvidence&&dataEvidence.status||dataSnapshot.status||'UNAVAILABLE')+(dataEvidence&&dataEvidence.status==='READY'?' · '+(dataEvidence.provenance&&dataEvidence.provenance.provider||'local')+' · '+dataEvidence.sourceAnchors.length+'/'+Math.max(1,dataEvidence.sourceTokenCount||0)+' опор':' · '+(dataEvidence&&dataEvidence.code||dataSnapshot.errors&&dataSnapshot.errors[0]&&dataSnapshot.errors[0].code||'нет данных')),score:metrics.data});
  var continuationStatus=status==='continue'||status==='answer';
  var insertLine=(status==='abstain'||status==='grammar')?'':(continuationStatus?(traceContinuation?(traceContinuation.status==='READY'?traceContinuation.insertLine:''):output.replace(/^Вывод:\s*/,'Итог: ')):output.replace(/^Вывод:\s*/,'Результат: '));
  return {status:status,title:'вывод · '+status,summary:summary,outputLine:output,insertLine:insertLine,metrics:metrics,rows:rows,reaction:reaction,observed:context.observed||null,observation:observation,observedLine:observation?observation.text:'',traceContinuation:traceContinuation,dataEvidence:dataEvidence,dataSnapshot:dataSnapshot,language:language,grammar:grammar,source:{topic:topic,verb:verb,bridge:bridge,detail:detail},formula:'result = language occurrences + grammar rails + guard + goal + Phi + forecast cascade + observed causal trace + bounded local corpus -> text'};
}
global.MRDTextResult={version:VERSION,summarize:summarize,observedProjection:observedProjection};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
