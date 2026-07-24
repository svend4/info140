(function(global){
'use strict';

var VERSION='1.8.0';

function reasonLabel(value){
  var labels={
    'guard:open-ring':'граница: возврат в кольцо','pair:conflict':'пара: конфликт',
    'explicit:generalize':'явно: обобщить','explicit:detail':'явно: уточнить',
    'source:seed':'источник: триггер','source:mediated':'источник: посредник',
    'source:synth':'источник: сборка','source:fragment':'источник: деталь','source:catalyst':'источник: мост',
    'target:synth':'цель: сборка','target:fragment':'цель: деталь','pair:carrier':'пара: перенос'
  };
  return labels[value]||value||'';
}

function num(value){ value=Number(value); return isFinite(value)?value:0; }
function fixed(value,digits){ return num(value).toFixed(digits==null?2:digits); }
function ruleIdentity(value){ return value&&value.ruleVersion?' · rules '+value.ruleVersion+'/'+(value.ruleHash||'?'):''; }
function statusLabel(value){
  var labels={
    critical:'КРИТИЧЕСКИЙ',guarded:'GUARD',active:'АКТИВНЫЙ',damped:'ЗАТУХ',empty:'ПУСТО',
    READY:'ГОТОВ',FIRED:'СРАБОТАЛ',WAITING:'ОЖИДАНИЕ',DAMPED:'ЗАТУХ',BLOCKED:'БЛОКИРОВКА'
  };
  return labels[value]||String(value||'ПУСТО').toUpperCase();
}
function roleLabel(value){
  var labels={seed:'триггер',catalyst:'катализатор',synth:'сборка',fragment:'деталь',carrier:'носитель',anti:'ингибитор',mediated:'посредник'};
  return labels[value]||value||'частица';
}
function colorFor(value,alpha){
  var colors={seed:'215,200,111',catalyst:'21,151,132',synth:'117,103,216',fragment:'216,81,63',carrier:'226,161,43',anti:'202,77,92',mediated:'47,131,202'};
  return 'rgba('+(colors[value]||'153,165,184')+','+(alpha==null?1:alpha)+')';
}
function appendMetric(root,label,value){
  var item=document.createElement('div'),b=document.createElement('b'),span=document.createElement('span');
  b.textContent=value; span.textContent=label; item.appendChild(b); item.appendChild(span); root.appendChild(item);
}
function directionSummary(metrics){
  var counts=metrics&&metrics.directionCounts||{};
  return 'сборка '+num(counts.generalize)+' / деталь '+num(counts.detail)+' / круг '+num(counts.orbit)+' / ремонт '+num(counts.repair);
}
function directionLabel(value){
  var labels={generalize:'сборке',detail:'детали',orbit:'кругу',repair:'ремонту'}; return labels[value]||value||'следующему типу';
}
function profileSummary(profile){
  profile=profile||{};
  return 'сборка '+Math.round(num(profile.generalize)*100)+'% / деталь '+Math.round(num(profile.detail)*100)+'% / круг '+Math.round(num(profile.orbit)*100)+'% / ремонт '+Math.round(num(profile.repair)*100)+'%';
}
function targetSummary(live){
  return profileSummary(live&&live.directionProfile&&live.directionProfile.target||live&&live.metrics&&live.metrics.directionTarget);
}
function reachableSummary(metrics){ return profileSummary(metrics&&metrics.directionReachableProfile); }
function renderEvent(root,event,observed){
  var row=document.createElement('div'); row.className='reactionEvent '+String(event.direction||'orbit')+(observed?' observed':'');
  var generation=document.createElement('b'); generation.textContent='g'+num(event.generation);
  var body=document.createElement('span');
  var reason=String(event.selectionReason||''),calibration=String(event.calibrationReason||''),calibrationText='';
  if(observed&&calibration==='direction:underrepresented') calibrationText=' · дефицит направления';
  else if(observed&&calibration==='handoff:underrepresented') calibrationText=' · маршрут к '+directionLabel(event.handoffDirection);
  body.textContent='«'+String(event.sourceToken||event.sourceId)+'» → «'+String(event.targetToken||event.targetId)+'» · '+String(event.ruleLabel||event.ruleId||'реакция')+(reason?' · '+reasonLabel(reason):'')+calibrationText;
  if(reason){row.setAttribute('data-selection-reason',reason);row.title=reason;}
  if(calibration){row.setAttribute('data-calibration-reason',calibration);row.title+=(row.title?' · ':'')+calibration;}
  var score=document.createElement('i'),raw=num(event.rawForce),force=num(event.force);
  score.textContent=raw&&Math.abs(raw-force)>.0001?fixed(raw,2)+'→'+fixed(force,2)+' ≥ '+fixed(event.threshold,2):fixed(force,2)+' ≥ '+fixed(event.threshold,2);
  row.appendChild(generation); row.appendChild(body); row.appendChild(score); root.appendChild(row);
}
function renderLive(root,live){
  var block=document.createElement('div'); block.className='reactionLive';
  var head=document.createElement('div'); head.className='reactionFieldHead reactionLiveHead '+String(live.status||'WAITING');
  var title=document.createElement('b'); title.textContent='живые встречи · '+statusLabel(live.status);
  var formula=document.createElement('span');
  var metrics=live.metrics||{};
  formula.textContent='OBSERVED · t'+num(live.tick)+' · '+num(metrics.pairChecks)+' пар / '+num(metrics.candidateChecks)+' кандидатов';
  head.appendChild(title); head.appendChild(formula); block.appendChild(head);

  var meta=document.createElement('div'); meta.className='reactionFieldMeta';
  appendMetric(meta,'такт',String(num(live.tick)));
  appendMetric(meta,'каскад',String(num(live.cascadeSerial)));
  appendMetric(meta,'активны',String(num(live.active)));
  appendMetric(meta,'встречи',String(num(metrics.totalEvents)));
  block.appendChild(meta);

  var events=document.createElement('div'); events.className='reactionEvents reactionLiveEvents';
  var observed=(live.lastEvents&&live.lastEvents.length?live.lastEvents:(live.history||[]).slice(-3)).slice().reverse();
  observed.slice(0,3).forEach(function(event){renderEvent(events,event,true);});
  if(!events.childNodes.length){
    var empty=document.createElement('div'); empty.className='reactionFieldEmpty';
    empty.textContent=live.status==='BLOCKED'?'наблюдение остановлено: '+String(live.code||'контракт не выполнен'):'наблюдение: локальных срабатываний пока нет';
    events.appendChild(empty);
  }
  block.appendChild(events);

  var proof=document.createElement('div'); proof.className='reactionFieldProof reactionLiveProof';
  var hasEvents=num(metrics.directionSampleSize)>0,hasOpportunity=num(metrics.directionOpportunitySampleSize)>0;
  proof.textContent='OBSERVED'+ruleIdentity(live)+' · факт '+directionSummary(metrics)+' · цель '+targetSummary(live)+' · доступно '+(hasOpportunity?reachableSummary(metrics):'—')+
    ' · Δmix '+(hasEvents?fixed(metrics.directionDivergence,2):'—')+' / Δspace '+(hasOpportunity?fixed(metrics.directionAvailabilityDivergence,2):'—')+' / Δcontrol '+(hasEvents&&hasOpportunity?fixed(metrics.directionControlDivergence,2):'—')+
    ' · cells '+num(metrics.cells)+' · budget '+num(metrics.lastBudgetUsed)+' · u '+fixed(metrics.minU,2)+'…'+fixed(metrics.maxU,2)+' · '+(live.evidenceLevel||'UNVERIFIED')+' / '+(live.soundness||'NOT_COMPUTED');
  block.appendChild(proof); root.appendChild(block);
}
function render(root,field,options){
  if(!root) return;
  root.innerHTML=''; field=field||{}; options=options||{};
  var head=document.createElement('div'); head.className='reactionFieldHead '+(field.status||'empty');
  var title=document.createElement('b'); title.textContent='прогноз цепи · '+statusLabel(field.status);
  var formula=document.createElement('span'); formula.textContent=field.formula||'F >= thr; depth <= 3';
  head.appendChild(title); head.appendChild(formula); root.appendChild(head);

  var meta=document.createElement('div'); meta.className='reactionFieldMeta';
  appendMetric(meta,'M(λ)',fixed(field.window,2));
  appendMetric(meta,'γ',fixed(field.gamma,2));
  appendMetric(meta,'поколения',String(field.metrics&&field.metrics.depth||0));
  appendMetric(meta,'срабатывания',String(field.metrics&&field.metrics.fired||0));
  root.appendChild(meta);

  var kinds=document.createElement('div'); kinds.className='reactionKinds';
  var counts=field.metrics&&field.metrics.typeCounts||{};
  Object.keys(counts).sort().forEach(function(role){
    var item=document.createElement('span'); item.className='reactionKind';
    var swatch=document.createElement('i'); swatch.className='reactionSwatch '+role; swatch.style.background=colorFor(role,1);
    var label=document.createElement('span'); label.textContent=roleLabel(role)+' '+counts[role];
    item.appendChild(swatch); item.appendChild(label); kinds.appendChild(item);
  });
  if(kinds.childNodes.length) root.appendChild(kinds);

  var events=document.createElement('div'); events.className='reactionEvents';
  (field.events||[]).slice(0,3).forEach(function(event){renderEvent(events,event,false);});
  if(!events.childNodes.length){
    var blocked=document.createElement('div'); blocked.className='reactionFieldEmpty';
    var attempt=field.attempts&&field.attempts[0];
    blocked.textContent=attempt?'порог не пройден: '+fixed(attempt.force,2)+' < '+fixed(attempt.threshold,2):'нет локального перехода в прогнозе';
    events.appendChild(blocked);
  }
  root.appendChild(events);

  var output=document.createElement('div'); output.className='reactionFieldOutput';
  output.textContent='Прогноз: '+(field.text&&field.text.summary||'Нет расчета.')+' '+(field.text&&field.text.output||''); root.appendChild(output);
  var proof=document.createElement('div'); proof.className='reactionFieldProof';
  var forecastMetrics=field.metrics||{};
  proof.textContent='FORECAST'+ruleIdentity(field)+' · mass '+num(forecastMetrics.massBefore)+'='+num(forecastMetrics.massAfter)+' · u '+fixed(forecastMetrics.minU,2)+'…'+fixed(forecastMetrics.maxU,2)+' · '+(field.evidenceLevel||'UNVERIFIED')+' / '+(field.soundness||'NOT_COMPUTED');
  root.appendChild(proof);
  if(options.live) renderLive(root,options.live);
}

function paintParticle(ctx,x,y,size,particle,alpha){
  if(!ctx) return;
  particle=particle||{};
  var role=particle.reactionRole||particle.baseReactionRole||'carrier',r=Math.max(2,num(size)||3),tone=colorFor(role,alpha==null?.8:alpha);
  ctx.save(); ctx.translate(x,y); ctx.fillStyle=tone; ctx.strokeStyle=colorFor(role,1); ctx.lineWidth=1;
  ctx.beginPath();
  if(role==='seed'||role==='fragment'){
    ctx.moveTo(0,-r*1.35); ctx.lineTo(r*1.15,0); ctx.lineTo(0,r*1.35); ctx.lineTo(-r*1.15,0); ctx.closePath();
  }else if(role==='catalyst'){
    ctx.moveTo(0,-r*1.35); ctx.lineTo(r*1.25,r); ctx.lineTo(-r*1.25,r); ctx.closePath();
  }else if(role==='anti'){
    ctx.rect(-r,-r,r*2,r*2);
  }else if(role==='mediated'){
    for(var i=0;i<6;i++){var angle=-Math.PI/2+i*Math.PI/3,px=Math.cos(angle)*r*1.2,py=Math.sin(angle)*r*1.2;if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);} ctx.closePath();
  }else{
    ctx.arc(0,0,role==='synth'?r*1.15:r,0,Math.PI*2);
  }
  ctx.fill();
  if(role==='seed'){ctx.strokeStyle='rgba(245,248,255,.92)';ctx.lineWidth=1.5;ctx.stroke();}
  if(role==='anti'){
    ctx.strokeStyle='rgba(245,248,255,.72)';ctx.beginPath();ctx.moveTo(-r*.6,-r*.6);ctx.lineTo(r*.6,r*.6);ctx.moveTo(r*.6,-r*.6);ctx.lineTo(-r*.6,r*.6);ctx.stroke();
  }
  ctx.restore();
}

global.MRDSemanticReactionFieldView={version:VERSION,render:render,paintParticle:paintParticle,colorFor:colorFor,statusLabel:statusLabel,roleLabel:roleLabel};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
