(function(global){
'use strict';
var VERSION='1.3.0';
var core=function(){ return global.MRDSemanticCore||null; };
var textResult=function(){ return global.MRDTextResult||null; };
function clamp01(n){ n=Number(n)||0; return Math.max(0,Math.min(1,n)); }
function pct(n){ return Math.round(clamp01(n)*100)+'%'; }
function word(item,fallback){ return item?(item.word||item.lemma||item.token||fallback):fallback; }
function uniqueWords(items,limit){
  var out=[], seen={};
  (items||[]).forEach(function(it){
    var w=word(it,'').trim();
    if(!w||seen[w]) return;
    seen[w]=1; out.push(w);
  });
  return out.slice(0,limit||8);
}
function firstByDim(items,dim,fallback){
  for(var i=0;i<(items||[]).length;i++){
    var it=items[i], role=it&&(it.dim||it.role);
    if(role===dim || (dim==='core'&&role==='center') || (dim==='detail'&&role==='edge')) return word(it,fallback);
  }
  return fallback;
}
function outputLine(pack){
  return pack&&pack.outputLine?pack.outputLine.replace(/^Вывод:\s*/,''): '';
}
function build(text,target,context){
  context=context||{};
  var c=core(), tr=textResult(), source=String(text||'').trim(), targetText=String(target||'').trim();
  if(!c||!source) return {version:VERSION,status:'empty',summary:'Введите условие, чтобы получить меню выводов.',items:[]};
  var precomputed=context.precomputed||null;
  var scoped=!!(precomputed&&String(precomputed.source||'').trim()===source&&String(precomputed.target||'').trim()===targetText);
  var analysis=scoped&&precomputed.analysis||c.analyzeText(source);
  var guard=scoped&&precomputed.guard||c.stabilityGuard(source);
  var rails=scoped&&precomputed.rails||(c.semanticRails?c.semanticRails(source):null);
  var phi=scoped&&precomputed.phi||(c.semanticPhi?c.semanticPhi(source):null);
  var goal=scoped&&precomputed.goal||(c.semanticGoal?c.semanticGoal(source,targetText):null);
  var result=scoped&&context.textResult||(tr&&tr.summarize?tr.summarize(source,targetText,context):null);
  var items=analysis.items||[], tags=uniqueWords(items,10);
  if(!tags.length && analysis.tokens) tags=analysis.tokens.slice(0,10);
  var topic=firstByDim(items,'core',tags[0]||'тема'), bridge=firstByDim(items,'bridge',tags[1]||'связка'), detail=firstByDim(items,'detail',tags[2]||'деталь');
  var guardScore=guard&&guard.score!=null?guard.score:.5, railScore=rails&&rails.score!=null?rails.score:.5, phiScore=phi&&phi.phi!=null?phi.phi:phi&&phi.score!=null?phi.score:.5, goalScore=goal&&goal.score!=null?goal.score:.5;
  var danger=guard&&guard.zone&&guard.zone!=='safe'&&guard.zone!=='thin';
  var status=danger?'repair':(railScore<.45?'repair':'continue');
  var next=status==='repair'
    ? 'Сначала связать: '+topic+' -> '+bridge+' -> '+detail+'. Затем повторить ход без распада и без закрытия темы.'
    : 'Дальше: '+topic+' проходит через '+bridge+' и добавляет '+detail+', чтобы движение осталось открытым.';
  var border='Крайности: распад '+pct(1-guardScore)+'; уплотнение '+pct(Math.max(0,(analysis.core||0)-.35));
  var arch='Теги: '+(tags.length?tags.join(' · '):'нет опорных слов')+'.';
  var formula='O = guard('+pct(guardScore)+') + rails('+pct(railScore)+') + Φ('+pct(phiScore)+') + goal('+pct(goalScore)+') => '+status;
  var base=outputLine(result)||next;
  var list=[
    {id:'summary',label:'итог',kind:'text',score:guardScore,text:base,insertLine:(result&&result.insertLine)||('Итог: '+base)},
    {id:'next',label:'следующий ход',kind:'continue',score:(railScore+phiScore)/2,text:next,insertLine:'Следующий ход: '+next},
    {id:'tags',label:'архипелаг тегов',kind:'tags',score:analysis.graph&&analysis.graph.metrics?analysis.graph.metrics.gLink||.4:.4,text:arch,insertLine:'Архипелаг тегов: '+(tags.length?tags.join(', '):topic)},
    {id:'formula',label:'формула',kind:'formula',score:(guardScore+railScore+phiScore+goalScore)/4,text:formula,insertLine:'Формула вывода: '+formula},
    {id:'border',label:'крайности',kind:'guard',score:guardScore,text:border+' Задача: удержать середину и продолжить смысл.',insertLine:'Проверка крайностей: '+border+' удержать середину.'}
  ];
  var insertIndex=1;
  if(result&&result.observation){ list.splice(insertIndex,0,{id:'observed',label:'\u043d\u0430\u0431\u043b\u044e\u0434\u0435\u043d\u0438\u0435',kind:'observed',score:result.observation.score||0,text:result.observedLine||result.observation.text,insertLine:result.observedLine||result.observation.text}); insertIndex++; }
  if(result&&result.traceContinuation){
    var trace=result.traceContinuation,ready=trace.status==='READY',actionable=ready&&(result.status==='continue'||result.status==='answer');
    list.splice(insertIndex,0,{id:'trace',label:'причинное продолжение',kind:actionable?'trace':ready?'trace-held':'trace-abstain',score:trace.score||0,text:actionable?trace.sentence:ready?'УДЕРЖАНО '+result.status+': '+trace.sentence:'ABSTAIN ('+trace.code+'): '+trace.message,insertLine:actionable?trace.insertLine:'',origin:trace.origin,code:trace.code||null,contract:trace.contract||null});
  }
  return {version:VERSION,status:status,title:'меню выводов · '+status,summary:'Один ввод развернут в итог, причинное продолжение или ABSTAIN, наблюдение, теги, формулу и контроль крайностей.',items:list,formula:'output_menu = text + observed causal trace + next + tags + formula + guard'};
}
global.MRDOutputMenu={version:VERSION,build:build};
})(window);
