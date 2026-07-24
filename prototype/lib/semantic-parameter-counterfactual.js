(function(global){
'use strict';

var VERSION='1.0.0';
var KIND='MRDSemanticParameterCounterfactual';
var STRUCTURAL='STRUCTURAL';
var NOT_COMPUTED='NOT_COMPUTED';
var DEFAULT_SPAN=.12;
var STATUS_RANK={BLOCKED:0,ABSTAIN:1,DAMPED:2,READY:3};
var DIRECTION_ORDER=['orbit','generalize','detail','repair'];

function clean(value){ return String(value==null?'':value).replace(/\s+/g,' ').trim(); }
function number(value,fallback){ value=Number(value); return isFinite(value)?value:(fallback==null?0:fallback); }
function clamp01(value){ return Math.max(0,Math.min(1,number(value,0))); }
function rounded(value,places){ var power=Math.pow(10,places==null?6:places); return Math.round(number(value,0)*power)/power; }
function hash(value){
  value=String(value==null?'':value); var h=2166136261>>>0;
  for(var i=0;i<value.length;i++){ h^=value.charCodeAt(i); h=Math.imul(h,16777619); }
  return ('00000000'+(h>>>0).toString(16)).slice(-8);
}
function core(){ return global.MRDSemanticCore||null; }
function field(){ return global.MRDSemanticReactionField||null; }
function composer(){ return global.MRDSemanticTraceContinuation||null; }
function directionCounts(metrics){
  var source=metrics&&metrics.directionCounts||{},out={};
  DIRECTION_ORDER.forEach(function(direction){out[direction]=Math.max(0,number(source[direction],0));}); return out;
}
function dominantDirection(counts){
  var best=null,bestValue=0;
  DIRECTION_ORDER.forEach(function(direction){var value=number(counts[direction],0);if(value>bestValue){best=direction;bestValue=value;}});
  return best;
}
function invariantSafe(reaction){
  var invariants=reaction&&reaction.invariants||[];
  return !!reaction&&invariants.length>0&&invariants.every(function(item){return !!(item&&item.ok);});
}
function reactionHash(reaction){
  var events=reaction&&reaction.events||[];
  return hash(JSON.stringify(events.map(function(event){return [event.ruleId,event.direction,event.sourceTokenIndex,event.targetTokenIndex,event.sourceToken,event.targetToken];})));
}
function scenario(spec,text,target,analysis,rails,reactionEngine,traceEngine){
  var lambda=clamp01(spec.lambda),reaction=reactionEngine.simulate(analysis,lambda,{maxDepth:3,budget:8});
  var continuation=traceEngine.compose({text:text,target:target,analysis:analysis,rails:rails,reaction:reaction,observed:null});
  var metrics=reaction.metrics||{},events=reaction.events||[],counts=directionCounts(metrics),safe=invariantSafe(reaction);
  var minU=number(metrics.minU,0),maxU=number(metrics.maxU,0),ringMargin=Math.min(minU-.18,.82-maxU),ringScore=clamp01(ringMargin/.32);
  var eventScore=clamp01(events.length/3),criticality=clamp01(metrics.criticality),traceScore=continuation.status==='READY'?1:0;
  var score=clamp01(.30*eventScore+.25*ringScore+.25*criticality+.20*traceScore),status='ABSTAIN';
  if(!safe) status='BLOCKED';
  else if(continuation.status==='READY') status='READY';
  else if(!events.length||reaction.status==='damped') status='DAMPED';
  return {
    id:spec.id,label:spec.label,lambda:rounded(lambda,2),distance:rounded(Math.abs(lambda-spec.base),2),status:status,effect:spec.id==='current'?'baseline':'pending',
    mode:reaction.mode||'orbit',window:reactionEngine.windowAt?rounded(reactionEngine.windowAt(lambda),6):rounded(4*lambda*(1-lambda),6),
    events:events.length,depth:Math.max(0,number(metrics.depth,0)),criticality:rounded(criticality,6),minU:rounded(minU,6),maxU:rounded(maxU,6),ringMargin:rounded(ringMargin,6),ringScore:rounded(ringScore,6),safe:safe,
    direction:continuation.direction||dominantDirection(counts),directionCounts:counts,score:rounded(score,6),
    continuationStatus:continuation.status,continuationCode:continuation.code||null,sentence:continuation.status==='READY'?continuation.sentence:'',message:continuation.status==='READY'?'':clean(continuation.message||(reaction.text&&reaction.text.output)),
    traceHash:continuation.hashes&&continuation.hashes.trace||null,reactionHash:reactionHash(reaction),sameTrace:null,sameDirection:null,
    delta:{events:0,criticality:0,ringMargin:0},origin:'forecast',evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
  };
}
function compareWithBaseline(item,baseline){
  item.sameTrace=item.traceHash===baseline.traceHash&&item.continuationStatus===baseline.continuationStatus;
  item.sameDirection=item.direction===baseline.direction;
  item.delta={events:item.events-baseline.events,criticality:rounded(item.criticality-baseline.criticality,6),ringMargin:rounded(item.ringMargin-baseline.ringMargin,6)};
  if(item.id==='current') item.effect='baseline';
  else if(item.status==='BLOCKED') item.effect='blocked';
  else if(item.status==='DAMPED') item.effect='damped';
  else if(item.sameTrace&&item.sameDirection&&item.status===baseline.status) item.effect='stable';
  else item.effect='changed';
  return item;
}
function chooseBest(scenarios){
  return scenarios.slice().sort(function(a,b){
    return (STATUS_RANK[b.status]||0)-(STATUS_RANK[a.status]||0)||b.score-a.score||a.distance-b.distance||(a.id==='current'?-1:b.id==='current'?1:0)||a.lambda-b.lambda;
  })[0]||null;
}
function summary(status,scenarios,best,sensitivity){
  var lower=scenarios[0],upper=scenarios[2],range=lower.lambda.toFixed(2)+'–'+upper.lambda.toFixed(2);
  if(status==='STABLE') return 'В окне λ '+range+' причинный прогноз сохраняется; соседние сценарии не меняют trace и направление.';
  if(status==='SENSITIVE') return 'В окне λ '+range+' изменено '+Math.round(sensitivity*2)+' из 2 соседних прогнозов; лучший структурный сценарий — '+best.label+' '+best.lambda.toFixed(2)+'.';
  return 'Текущий λ не дает READY-продолжение; соседние прогнозы показаны без автоматического выбора и без изменения текста.';
}
function empty(code,message,lambda,span){
  return {version:VERSION,kind:KIND,status:'EMPTY',code:code,lambda:clamp01(lambda),span:span,scenarios:[],best:null,sensitivity:0,summary:message,formula:'counterfactual = FORECAST(text, λ−δ | λ | λ+δ) -> trace compare',contract:{pre:{ok:false,text:'non-empty text and counterfactual APIs'},inv:{ok:true,text:'input is immutable'},post:{ok:false,text:'no scenarios emitted'}},evidence:'UNVERIFIED',evidenceLevel:'UNVERIFIED',soundness:NOT_COMPUTED};
}
function compare(text,target,lambda,options){
  options=options||{}; text=clean(text); target=clean(target); lambda=clamp01(lambda); var span=clamp01(options.span==null?DEFAULT_SPAN:options.span);
  var semantic=core(),reactionEngine=field(),traceEngine=composer();
  if(!semantic||!reactionEngine||!traceEngine||typeof reactionEngine.simulate!=='function'||typeof traceEngine.compose!=='function') return empty('COUNTERFACTUAL_API_UNAVAILABLE','Контрфактические API недоступны.',lambda,span);
  if(!text) return empty('COUNTERFACTUAL_EMPTY_TEXT','Введите текст для сравнения λ.',lambda,span);
  var analysis=options.analysis||semantic.analyzeText(text),rails=options.rails||semantic.semanticRails(text);
  var specs=[
    {id:'lower',label:'λ−',lambda:Math.max(0,lambda-span),base:lambda},
    {id:'current',label:'λ',lambda:lambda,base:lambda},
    {id:'upper',label:'λ+',lambda:Math.min(1,lambda+span),base:lambda}
  ];
  var scenarios=specs.map(function(spec){return scenario(spec,text,target,analysis,rails,reactionEngine,traceEngine);});
  var baseline=scenarios[1]; scenarios.forEach(function(item){compareWithBaseline(item,baseline);});
  var changed=scenarios.filter(function(item){return item.id!=='current'&&item.effect!=='stable';}).length,sensitivity=rounded(changed/2,6),best=chooseBest(scenarios);
  var status=baseline.status!=='READY'?'ABSTAIN':changed?'SENSITIVE':'STABLE';
  var hashes=scenarios.map(function(item){return [item.id,item.lambda,item.reactionHash,item.traceHash,item.status];});
  return {
    version:VERSION,kind:KIND,status:status,code:null,lambda:rounded(lambda,2),span:rounded(span,2),analysisHash:analysis.hash,scenarios:scenarios,best:best,sensitivity:sensitivity,
    summary:summary(status,scenarios,best,sensitivity),formula:'CF(λ,δ) = FORECAST(text, λ−δ | λ | λ+δ) -> compare(status, traceHash, direction, events, ringMargin)',
    hashes:{input:hash(text+'\u241f'+target),comparison:hash(JSON.stringify(hashes))},
    contract:{pre:{ok:true,text:'same immutable text, target and analysis for all scenarios'},inv:{ok:scenarios.every(function(item){return item.safe;}),text:'all forecasts preserve mass, depth and 0.18 < u < 0.82'},post:{ok:scenarios.length===3&&scenarios[1].id==='current',text:'exact lower/current/upper comparison with current baseline'}},
    evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
  };
}

global.MRDSemanticParameterCounterfactual={version:VERSION,kind:KIND,defaultSpan:DEFAULT_SPAN,compare:compare};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
