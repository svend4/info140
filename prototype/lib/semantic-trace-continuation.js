(function(global){
'use strict';

var VERSION='1.2.0';
var KIND='MRDSemanticTraceContinuation';
var STRUCTURAL='STRUCTURAL';
var NOT_COMPUTED='NOT_COMPUTED';
var ERROR_CODES={
  SOURCE_THIN:'TRACE_SOURCE_THIN',
  OBSERVED_BLOCKED:'TRACE_OBSERVED_BLOCKED',
  RING_INVALID:'TRACE_RING_INVALID',
  NO_CAUSAL_EVENT:'TRACE_NO_CAUSAL_EVENT',
  WITNESS_INCOMPLETE:'TRACE_WITNESS_INCOMPLETE',
  OUTPUT_INVALID:'TRACE_OUTPUT_INVALID'
};
var STOP={и:1,а:1,но:1,на:1,у:1,о:1,об:1,в:1,во:1,к:1,ко:1,с:1,со:1,по:1,из:1,за:1,для:1,не:1,это:1,как:1,что:1,то:1,он:1,она:1,они:1,мы:1,вы:1,я:1,или:1,если:1,же:1,ли:1,бы:1,его:1,ее:1,её:1,их:1,все:1,всё:1,then:1,and:1,the:1};
var OPERATOR={обобщение:1,детализация:1,продолжение:1};
var WEAK_TOPIC={главный:1,главное:1,общий:1,общая:1,конкретный:1,конкретная:1,новый:1,новая:1,следующий:1,следующая:1,нужно:1,нужна:1,можно:1};
var DIRECTION={generalize:1,detail:1,orbit:1,repair:1};
var MESSAGES={};
MESSAGES[ERROR_CODES.SOURCE_THIN]='Недостаточно самостоятельных слов для причинного продолжения.';
MESSAGES[ERROR_CODES.OBSERVED_BLOCKED]='Наблюдаемый runtime заблокирован; продолжение не строится.';
MESSAGES[ERROR_CODES.RING_INVALID]='Наблюдаемое состояние вышло из открытого кольца 0.18 < u < 0.82.';
MESSAGES[ERROR_CODES.NO_CAUSAL_EVENT]='Нет наблюдаемого или прогнозного причинного события.';
MESSAGES[ERROR_CODES.WITNESS_INCOMPLETE]='В цепи не найдены три различимых смысловых свидетеля.';
MESSAGES[ERROR_CODES.OUTPUT_INVALID]='Шаблон продолжения не прошел структурный постконтракт.';

function clean(value){ return String(value==null?'':value).replace(/\s+/g,' ').trim(); }
function normalize(value){ return clean(value).toLowerCase().replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi,''); }
function number(value,fallback){ value=Number(value); return isFinite(value)?value:(fallback==null?0:fallback); }
function optionalIndex(value){ value=Number(value); return isFinite(value)&&value>=0?Math.floor(value):null; }
function clamp01(value){ return Math.max(0,Math.min(1,number(value,0))); }
function hash(value){
  value=String(value==null?'':value); var h=2166136261>>>0;
  for(var i=0;i<value.length;i++){ h^=value.charCodeAt(i); h=Math.imul(h,16777619); }
  return ('00000000'+(h>>>0).toString(16)).slice(-8);
}
function coreApi(){ return global.MRDSemanticCore||null; }
function own(obj,key){ return Object.prototype.hasOwnProperty.call(obj,key); }
function copyEvent(event,origin,index,parentEventId){
  event=event||{};
  var eventId=clean(event.eventId)||(origin+'/e'+Math.max(1,number(event.seq,index+1)));
  return {
    origin:origin,eventId:eventId,parentEventId:clean(parentEventId==null?event.parentEventId:parentEventId)||null,
    seq:Math.max(0,number(event.seq,index+1)),tick:Math.max(0,number(event.tick,0)),generation:Math.max(0,number(event.generation,0)),
    ruleId:clean(event.ruleId)||null,direction:DIRECTION[event.direction]?event.direction:'orbit',selectionReason:clean(event.selectionReason)||null,
    calibrationReason:clean(event.calibrationReason)||null,handoffDirection:DIRECTION[event.handoffDirection]?event.handoffDirection:null,
    sourceId:event.sourceId==null?null:event.sourceId,targetId:event.targetId==null?null:event.targetId,
    sourceTokenIndex:optionalIndex(event.sourceTokenIndex==null?event.sourceIndex:event.sourceTokenIndex),targetTokenIndex:optionalIndex(event.targetTokenIndex==null?event.targetIndex:event.targetTokenIndex),
    sourceToken:clean(event.sourceToken),targetToken:clean(event.targetToken),relation:clean(event.relation)||null,
    force:clamp01(event.force),threshold:clamp01(event.threshold),evidenceLevel:event.evidenceLevel||event.evidence||STRUCTURAL,
    soundness:event.soundness||NOT_COMPUTED
  };
}
function eventOrder(a,b){
  if(a.tick!==b.tick) return a.tick-b.tick;
  if(a.generation!==b.generation) return a.generation-b.generation;
  if(a.seq!==b.seq) return a.seq-b.seq;
  return a._index-b._index;
}
function observedTrace(observed){
  if(!observed) return {origin:null,trace:[]};
  if(observed.status==='BLOCKED') return {origin:'observed',trace:[],code:ERROR_CODES.OBSERVED_BLOCKED};
  var metrics=observed.metrics||{},nodes=observed.nodes||[];
  if(nodes.length&&isFinite(Number(metrics.minU))&&isFinite(Number(metrics.maxU))&&(Number(metrics.minU)<=.18||Number(metrics.maxU)>=.82)){
    return {origin:'observed',trace:[],code:ERROR_CODES.RING_INVALID};
  }
  var source=[];
  (observed.history||[]).forEach(function(event){source.push(event);});
  (observed.lastEvents||[]).forEach(function(event){source.push(event);});
  var dedup={},ordered=[];
  source.forEach(function(raw,index){
    var event=copyEvent(raw,'observed',index),key=event.eventId;
    if(own(dedup,key)){ ordered[dedup[key]]=event; event._index=dedup[key]; }
    else{ event._index=ordered.length; dedup[key]=ordered.length; ordered.push(event); }
  });
  if(!ordered.length) return {origin:'observed',trace:[]};
  ordered.sort(eventOrder);
  var byId={}; ordered.forEach(function(event){byId[event.eventId]=event;});
  var current=ordered[ordered.length-1],chain=[],seen={};
  while(current&&!seen[current.eventId]){
    seen[current.eventId]=1; chain.push(current);
    current=current.parentEventId&&byId[current.parentEventId]||null;
  }
  chain.reverse();
  chain.forEach(function(event){delete event._index;});
  return {origin:'observed',trace:chain};
}
function sameId(a,b){ return String(a)==String(b); }
function forecastTrace(reaction){
  var raw=reaction&&Array.isArray(reaction.events)?reaction.events:[];
  if(!raw.length) return {origin:'forecast',trace:[]};
  var events=raw.map(function(event,index){var item=copyEvent(event,'forecast',index,null);item._index=index;return item;});
  events.sort(eventOrder);
  var current=events[events.length-1],chain=[];
  while(current){
    chain.push(current); var parent=null;
    for(var i=events.length-1;i>=0;i--){
      var candidate=events[i];
      if(candidate===current||candidate.seq>=current.seq) continue;
      if(sameId(candidate.targetId,current.sourceId)){parent=candidate;break;}
    }
    current=parent;
  }
  chain.reverse();
  for(var j=0;j<chain.length;j++){
    chain[j].parentEventId=j?chain[j-1].eventId:null;
    delete chain[j]._index;
  }
  return {origin:'forecast',trace:chain};
}
function fallbackTokens(text){
  var raw=clean(text).toLowerCase().split(/[^a-zа-яё0-9]+/i),out=[],seen={};
  for(var i=0;i<raw.length;i++){
    var token=normalize(raw[i]);
    if(token.length<2||STOP[token]||seen[token]) continue;
    seen[token]=1; out.push(token);
  }
  return out;
}
function contentPack(text,analysis){
  var api=coreApi();
  if(!analysis&&api&&typeof api.analyzeText==='function') analysis=api.analyzeText(text);
  analysis=analysis||{};
  var tokens=Array.isArray(analysis.tokens)?analysis.tokens:fallbackTokens(text),items=Array.isArray(analysis.items)?analysis.items:[],list=[],byKey={},byIndex={};
  for(var i=0;i<tokens.length;i++){
    var item=items[i]||{},token=clean(item.token||tokens[i]),lemma=clean(item.lemma||token),key=normalize(lemma||token);
    var operator=!!(item.entry&&item.entry.scale==='OP')||!!OPERATOR[key];
    if(!key||key.length<2||STOP[key]||operator) continue;
    var tokenKey=normalize(token)||key,entry={word:token||lemma,key:tokenKey,lemmaKey:key,token:token||lemma,role:item.role||'neutral',index:i,operator:false};
    list.push(entry); byIndex[i]=entry; byKey[tokenKey]=entry; if(!own(byKey,key)) byKey[key]=entry;
  }
  return {analysis:analysis,list:list,byKey:byKey,byIndex:byIndex};
}
function candidateFor(raw,pack,event,side){
  var key=normalize(raw),tokenIndex=event?(side==='source'?event.sourceTokenIndex:event.targetTokenIndex):null;
  var base=tokenIndex!=null&&own(pack.byIndex,tokenIndex)?pack.byIndex[tokenIndex]:pack.byKey[key];
  if(!key||STOP[key]||OPERATOR[key]||!base) return null;
  return {word:base.word,key:base.key,role:base.role,tokenIndex:base.index,eventId:event&&event.eventId||null,fromTrace:!!event,side:side||null,event:event||null};
}
function pushUnique(list,item){
  if(!item) return;
  for(var i=0;i<list.length;i++) if(list[i].key===item.key&&list[i].eventId===item.eventId&&list[i].side===item.side) return;
  list.push(item);
}
function sourceCandidate(value,pack){ return candidateFor(value,pack,null,null); }
function firstAllowed(list,avoid){
  avoid=avoid||{};
  for(var i=0;i<list.length;i++) if(list[i]&&!avoid[list[i].key]) return list[i];
  return null;
}
function promoteTrace(item,traceWords){
  if(!item||item.fromTrace) return item;
  for(var i=0;i<traceWords.length;i++) if(traceWords[i].key===item.key) return traceWords[i];
  return item;
}
function reverse(list){ return list.slice().reverse(); }
function witnessesFor(trace,pack,rails){
  var traceWords=[],traceDetail=[],traceBridge=[];
  trace.forEach(function(event){
    var source=candidateFor(event.sourceToken,pack,event,'source'),target=candidateFor(event.targetToken,pack,event,'target');
    pushUnique(traceWords,source); pushUnique(traceWords,target);
    [source,target].forEach(function(item){
      if(!item) return;
      if(item.role==='detail') pushUnique(traceDetail,item);
      if(item.role==='bridge'||event.direction==='orbit'||event.direction==='repair'||event.ruleId==='R_CATALYZE'||event.ruleId==='R_MEDIATE') pushUnique(traceBridge,item);
    });
  });
  var sourceCore=[],sourceDetail=[],sourceDetailStrong=[],sourceBridge=[],sourceAll=[];
  pack.list.forEach(function(item){
    var candidate={word:item.word,key:item.key,role:item.role,tokenIndex:item.index,eventId:null,fromTrace:false,side:null,event:null};
    sourceAll.push(candidate);
    if(item.role==='core') sourceCore.push(candidate);
    if(item.role==='detail'){ sourceDetail.push(candidate); if(/факт|пример|детал|вод|цен|букв|слог|част|дожд|карт|услов|параметр/.test(item.key)) sourceDetailStrong.push(candidate); }
    if(item.role==='bridge') sourceBridge.push(candidate);
  });
  var topicCandidates=sourceCore.filter(function(item){return !WEAK_TOPIC[item.key];}),railTheme=sourceCandidate(rails&&rails.theme,pack);
  if(railTheme&&railTheme.role!=='detail'&&!WEAK_TOPIC[railTheme.key]) pushUnique(topicCandidates,railTheme);
  sourceAll.forEach(function(item){if(item.role==='neutral'&&!WEAK_TOPIC[item.key]) pushUnique(topicCandidates,item);});
  sourceCore.forEach(function(item){pushUnique(topicCandidates,item);});
  pushUnique(topicCandidates,railTheme);
  sourceAll.forEach(function(item){pushUnique(topicCandidates,item);});
  traceWords.forEach(function(item){pushUnique(topicCandidates,item);});
  var topic=promoteTrace(firstAllowed(topicCandidates),traceWords),avoid={};
  if(!topic) return null; avoid[topic.key]=1;
  var detailCandidates=reverse(traceDetail).concat(reverse(sourceDetailStrong),reverse(sourceDetail),reverse(traceWords),reverse(sourceAll));
  var detail=promoteTrace(firstAllowed(detailCandidates,avoid),traceWords);
  if(!detail) return null; avoid[detail.key]=1;
  var bridgeCandidates=traceBridge.slice();
  pushUnique(bridgeCandidates,sourceCandidate(rails&&rails.bridge,pack));
  bridgeCandidates=bridgeCandidates.concat(sourceBridge,traceWords,sourceAll);
  var bridge=promoteTrace(firstAllowed(bridgeCandidates,avoid),traceWords);
  if(!bridge) return null;
  var chosen=[topic,bridge,detail],traceCount=chosen.filter(function(item){return item.fromTrace;}).length;
  if(traceCount<1){
    var replacement=firstAllowed(traceWords,(function(){var map={};map[topic.key]=1;map[detail.key]=1;return map;})());
    if(replacement){bridge=replacement;chosen=[topic,bridge,detail];traceCount=chosen.filter(function(item){return item.fromTrace;}).length;}
  }
  if(traceCount<1) return null;
  return {
    topic:{word:topic.word,role:topic.role,tokenIndex:topic.tokenIndex,eventId:topic.eventId,fromTrace:topic.fromTrace,side:topic.side},
    bridge:{word:bridge.word,role:bridge.role,tokenIndex:bridge.tokenIndex,eventId:bridge.eventId,fromTrace:bridge.fromTrace,side:bridge.side},
    detail:{word:detail.word,role:detail.role,tokenIndex:detail.tokenIndex,eventId:detail.eventId,fromTrace:detail.fromTrace,side:detail.side},
    eventIds:chosen.map(function(item){return item.eventId;}).filter(Boolean),traceWitnesses:traceCount
  };
}
function genreOf(text){
  text=clean(text).toLowerCase();
  if(/песн|строк|ритм|куплет|припев|мелоди|рифм/.test(text)) return 'song';
  if(/рассказ|сюжет|геро|мальчик|девоч|сказк|истори|путешеств|карта/.test(text)) return 'story';
  if(/стать|тезис|факт|исслед|данн|аргумент|город|цен|доказ/.test(text)) return 'article';
  return 'generic';
}
function sentenceFor(genre,direction,witnesses){
  var topic='«'+witnesses.topic.word+'»',bridge='«'+witnesses.bridge.word+'»',detail='«'+witnesses.detail.word+'»';
  if(genre==='story'){
    if(direction==='generalize') return 'Дальше '+topic+' связывает '+detail+' через '+bridge+' в общий поворот истории, оставляя следующий ход открытым.';
    if(direction==='detail') return 'Дальше '+topic+' проходит через '+bridge+': деталь '+detail+' меняет следующий шаг истории, не закрывая продолжение.';
    if(direction==='repair') return 'Дальше '+bridge+' соединяет '+topic+' и '+detail+', после чего история может двигаться без разрыва.';
    return 'Дальше '+topic+' проходит через '+bridge+'; в цепь входит '+detail+', и следующий поворот истории остается открытым.';
  }
  if(genre==='article'){
    if(direction==='generalize') return 'Дальше тема '+topic+' связывает '+detail+' через '+bridge+' в общий тезис, который можно проверить отдельно.';
    if(direction==='detail') return 'Дальше тема '+topic+' уточняется через '+bridge+': опора '+detail+' открывает следующий проверяемый шаг.';
    if(direction==='repair') return 'Дальше '+bridge+' связывает тему '+topic+' с фактом '+detail+', устраняя разрыв перед следующим выводом.';
    return 'Дальше тема '+topic+' проходит через '+bridge+'; цепь включает '+detail+' как проверяемую опору и оставляет следующий вывод открытым.';
  }
  if(genre==='song'){
    if(direction==='generalize') return 'Дальше строка собирает '+topic+' и '+detail+' через '+bridge+' в новый припев, оставляя место следующему повтору.';
    if(direction==='detail') return 'Дальше строка возвращает '+topic+' через '+bridge+', а деталь '+detail+' открывает новый повтор.';
    if(direction==='repair') return 'Дальше '+bridge+' связывает '+topic+' и '+detail+', возвращая ритм следующей строке.';
    return 'Дальше строка ведет '+topic+' через '+bridge+'; затем появляется '+detail+', и новый повтор остается открытым.';
  }
  if(direction==='generalize') return 'Дальше '+topic+' связывает '+detail+' через '+bridge+' в общий тезис, не закрывая следующий ход.';
  if(direction==='detail') return 'Дальше '+topic+' уточняется через '+bridge+': появляется деталь '+detail+', после которой возможен следующий ход.';
  if(direction==='repair') return 'Дальше '+bridge+' связывает '+topic+' и '+detail+', после чего движение можно продолжить без разрыва.';
  return 'Дальше '+topic+' проходит через '+bridge+'; затем цепь включает '+detail+', сохраняя следующий ход открытым.';
}
function traceHash(trace){
  return hash(JSON.stringify(trace.map(function(event){return [event.eventId,event.parentEventId,event.ruleId,event.direction,event.sourceTokenIndex,event.targetTokenIndex,event.sourceToken,event.targetToken];})));
}
function abstain(code,input,origin,trace,pack){
  trace=trace||[];
  return {
    version:VERSION,kind:KIND,status:'ABSTAIN',code:code,errorCode:code,origin:origin||'none',genre:'generic',direction:null,directionSource:null,
    sentence:'',insertLine:'',score:0,trace:trace,witnesses:null,message:MESSAGES[code]||code,
    contract:{pre:{ok:code!==ERROR_CODES.SOURCE_THIN,text:'at least four non-operator source tokens'},inv:{ok:code!==ERROR_CODES.OBSERVED_BLOCKED&&code!==ERROR_CODES.RING_INVALID,text:'observed runtime is ready and 0.18 < u < 0.82'},post:{ok:false,text:'no actionable text without a complete causal witness set'},proof:'deterministic refusal; source text is not mutated',evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED},
    hashes:{input:hash(clean(input.text)+'\u241f'+clean(input.target)),trace:traceHash(trace),output:hash('')},
    evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED,claims:{semanticTruth:false,structuralTrace:trace.length>0},sourceTokens:pack&&pack.list?pack.list.length:0
  };
}
function compose(input){
  input=input||{};
  var text=clean(input.text),pack=contentPack(text,input.analysis);
  if(pack.list.length<4) return abstain(ERROR_CODES.SOURCE_THIN,input,'none',[],pack);
  var observed=observedTrace(input.observed);
  if(observed.code) return abstain(observed.code,input,observed.origin,observed.trace,pack);
  var selected=observed.trace.length?observed:forecastTrace(input.reaction);
  if(!selected.trace.length) return abstain(ERROR_CODES.NO_CAUSAL_EVENT,input,selected.origin||'none',[],pack);
  var witnesses=witnessesFor(selected.trace,pack,input.rails||null);
  if(!witnesses) return abstain(ERROR_CODES.WITNESS_INCOMPLETE,input,selected.origin,selected.trace,pack);
  var last=selected.trace[selected.trace.length-1],direction=DIRECTION[last.handoffDirection]&&last.calibrationReason==='handoff:underrepresented'?last.handoffDirection:last.direction;
  if(!DIRECTION[direction]) direction='orbit';
  var directionSource=direction===last.handoffDirection&&last.calibrationReason==='handoff:underrepresented'?'handoff':'event';
  var genre=genreOf(text),sentence=clean(sentenceFor(genre,direction,witnesses));
  var distinct=witnesses.topic.word!==witnesses.bridge.word&&witnesses.topic.word!==witnesses.detail.word&&witnesses.bridge.word!==witnesses.detail.word;
  var valid=distinct&&sentence.indexOf('Дальше ')===0&&/[.!?]$/.test(sentence)&&sentence.length<=240&&sentence.indexOf('«'+witnesses.topic.word+'»')>=0&&sentence.indexOf('«'+witnesses.detail.word+'»')>=0;
  if(!valid) return abstain(ERROR_CODES.OUTPUT_INVALID,input,selected.origin,selected.trace,pack);
  var score=clamp01(.46+Math.min(.18,selected.trace.length*.045)+witnesses.traceWitnesses*.08+(selected.origin==='observed'?.08:0));
  return {
    version:VERSION,kind:KIND,status:'READY',code:null,errorCode:null,origin:selected.origin,genre:genre,direction:direction,directionSource:directionSource,
    sentence:sentence,insertLine:sentence,score:score,trace:selected.trace,witnesses:witnesses,message:'Причинное продолжение построено по структурной цепи '+selected.origin+'.',
    contract:{
      pre:{ok:true,text:'at least four non-operator source tokens and one causal event'},
      inv:{ok:true,text:'source is immutable; witnesses are distinct; observed ring remains open'},
      post:{ok:true,text:'one bounded continuation starts with Дальше and leaves a next move open'},
      proof:'input hash -> parent-linked causal suffix -> distinct source witnesses -> fixed genre/direction template -> output hash',
      evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
    },
    hashes:{input:hash(text+'\u241f'+clean(input.target)),trace:traceHash(selected.trace),output:hash(sentence)},
    evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED,claims:{semanticTruth:false,structuralTrace:true},sourceTokens:pack.list.length
  };
}

global.MRDSemanticTraceContinuation={version:VERSION,kind:KIND,errorCodes:ERROR_CODES,compose:compose,traceObserved:observedTrace,traceForecast:forecastTrace};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
