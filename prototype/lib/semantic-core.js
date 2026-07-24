(function(global){
'use strict';

var DIMENSIONS=['city','nature','motion','light','time','thought','warmth','abstract'];
var STOP={и:1,а:1,но:1,на:1,у:1,о:1,об:1,в:1,во:1,к:1,ко:1,с:1,со:1,по:1,из:1,за:1,для:1,не:1,это:1,как:1,что:1,то:1,он:1,она:1,они:1,мы:1,вы:1,я:1,или:1,если:1,же:1,ли:1,бы:1,его:1,ее:1,их:1,все:1,всё:1,then:1,and:1,the:1};
var STEMS={
  core:['обобщ','смысл','главн','итог','вывод','ядро','одно','сжать','сверн','назвать','тезис','тема','цель','предлож','афор','собра','синтез'],
  detail:['разб','слог','букв','част','детал','уточ','факт','пример','дефраг','разлож','край','матер','услов','параметр','тег','атом','оскол','рассып','конкрет'],
  bridge:['продолж','дальше','движ','сюжет','песня','статья','рассказ','связ','ход','реаг','жив','теч','потом','затем','след','мост','переход']
};
var BAD_PAIRS={
  'шум|смысл':'антонимия процесса: шум разрушает связность смысла',
  'смысл|шум':'антонимия процесса: шум разрушает связность смысла',
  'коллапс|движение':'коллапс останавливает движение',
  'движение|коллапс':'коллапс останавливает движение',
  'центр|край':'оба полюса конфликтуют без моста',
  'край|центр':'оба полюса конфликтуют без моста',
  'тьма|свет':'прямой конфликт признаков без оператора перехода',
  'свет|тьма':'прямой конфликт признаков без оператора перехода'
};
var GOOD_PAIRS={
  'тишина|сад':'сочетаемая сцена: тишина может быть свойством сада',
  'сад|тишина':'сочетаемая сцена: тишина может быть свойством сада',
  'город|мост':'пространственная связь',
  'мост|город':'пространственная связь',
  'река|мост':'пространственная связь',
  'мост|река':'пространственная связь',
  'слово|смысл':'слово несет смысл',
  'смысл|слово':'слово несет смысл',
  'мысль|слово':'мысль выражается словом',
  'слово|мысль':'мысль выражается словом'
};
var LEX=[
  ['город',['город','города','городе','городу'],[1], 'ID', ['place','city'], [1,0,.3,.2,.1,.1,.4,.2], 'neutral'],
  ['улица',['улиц','улица','улицы'],[1,1], 'ID', ['place','city','path'], [.9,0,.5,.2,0,0,.3,.1], 'detail'],
  ['мост',['мост','мостом','мосту'],[1,2], 'ID', ['place','bridge','path'], [.8,.2,.6,0,.1,0,.2,.15], 'bridge'],
  ['поезд',['поезд'],[1,3], 'ID', ['motion','vehicle'], [.7,0,1,.1,0,0,.3,.1], 'bridge'],
  ['путь',['путь','пути','дорог','дорога','дорогу'],[1,4], 'ID', ['motion','path'], [.3,.2,.9,0,.2,.3,.3,.4], 'bridge'],
  ['река',['рек','река','реку'],[2,1], 'ID', ['nature','flow'], [0,.9,.7,.2,.3,0,.4,.2], 'bridge'],
  ['сад',['сад','саду'],[2,2], 'ID', ['nature','place','warmth'], [.2,1,.1,.3,.2,0,.8,.2], 'neutral'],
  ['лист',['лист','листь'],[2,2,1], 'ID', ['nature','part'], [0,.9,.2,.2,.1,0,.5,.1], 'detail'],
  ['свет',['свет','свету'],[3,1], 'ID', ['light'], [0,.2,.2,1,.1,.2,.7,.4], 'neutral'],
  ['заря',['заря','заре'],[3,2], 'ID', ['light','time','nature'], [0,.5,.2,.9,.4,0,.8,.3], 'neutral'],
  ['огонь',['огонь'],[3,3], 'ID', ['light','warmth'], [0,.2,.4,.9,0,0,.9,.2], 'neutral'],
  ['тишина',['тишин','тих','тихая','тихое'],[4,1], 'ID', ['state','calm'], [0,.3,0,.1,.5,.4,.6,.5], 'neutral'],
  ['время',['время','времени'],[4,2], 'QTY', ['time'], [0,.1,.4,0,1,.3,.2,.8], 'neutral'],
  ['слово',['слово','слов','слова'],[5,1], 'ID', ['language','thought'], [0,0,.1,.1,.1,.9,.4,.5], 'bridge'],
  ['мысль',['мысль','мысли'],[5,2], 'ID', ['thought'], [0,0,.3,.2,.2,1,.3,.7], 'core'],
  ['смысл',['смысл','смысла'],[5,3], 'ID', ['thought','abstract'], [0,0,.1,.2,.2,1,.5,.9], 'core'],
  ['шум',['шум'],[6,1], 'ID', ['noise','break'], [.3,0,.5,0,.1,.2,.1,.3], 'detail'],
  ['буква',['букв','буква','буквы'],[6,2], 'ID', ['language','part'], [0,0,.1,0,0,.3,.1,.05], 'detail'],
  ['слог',['слог','слоги'],[6,3], 'ID', ['language','part'], [0,0,.1,0,0,.35,.1,.08], 'detail'],
  ['карта',['карт','карта'],[1,5], 'ID', ['place','symbol'], [.5,.2,.4,.1,.1,.4,.2,.35], 'bridge'],
  ['дождь',['дожд','дождь'],[2,3], 'ID', ['nature','event'], [0,.8,.4,.1,.3,0,.35,.2], 'detail'],
  ['рассказ',['рассказ','сюжет','герой','мальчик'],[5,4], 'ID', ['story','language'], [.1,.2,.5,.2,.3,.8,.45,.65], 'bridge'],
  ['статья',['стать','статья','текст'],[5,5], 'ID', ['language','document'], [.1,.1,.4,.1,.4,.85,.25,.75], 'bridge'],
  ['песня',['песн','песня'],[5,6], 'ID', ['language','rhythm'], [.1,.2,.65,.45,.45,.65,.65,.55], 'bridge'],
  ['ключ',['ключ'],[1,6], 'ID', ['object','polysemy'], [.4,.1,.4,.1,.2,.45,.2,.35], 'detail'],
  ['обобщение',['обобщ','сжать','собрать','итог'],[7,1], 'OP', ['operator','core'], [0,0,.2,.1,.4,.9,.3,1], 'core'],
  ['детализация',['уточ','разб','разлож','дефраг','част','детал'],[7,2], 'OP', ['operator','detail'], [0,0,.5,.1,.2,.55,.2,.25], 'detail'],
  ['продолжение',['продолж','дальше','след','потом','затем'],[7,3], 'OP', ['operator','bridge'], [.1,.1,.9,.1,.8,.7,.4,.55], 'bridge']
];
var byLemma={}, byAlias={};
for(var i=0;i<LEX.length;i++){
  var e=entry(LEX[i]); byLemma[e.lemma]=e;
  for(var j=0;j<e.aliases.length;j++) byAlias[e.aliases[j]]=e;
}
function entry(a){return {lemma:a[0],aliases:a[1],path:a[2],scale:a[3],tags:a[4],v:a[5],role:a[6]};}
function normalize(s){return String(s||'').toLowerCase().replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi,'');}
function tokenize(text,limit){
  var raw=String(text||'').toLowerCase().split(/[^a-zа-яё0-9]+/i), seen={}, out=[];
  for(var i=0;i<raw.length;i++){
    var w=normalize(raw[i]); if(w.length<2||STOP[w]||seen[w]) continue;
    seen[w]=1; out.push(w); if(limit&&out.length>=limit) break;
  }
  return out;
}
function hash(s){var h=2166136261>>>0; s=String(s||''); for(var i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0;}
function hasStem(w,list){for(var i=0;i<list.length;i++) if(w.indexOf(list[i])>=0) return true; return false;}
function lookup(w){
  w=normalize(w); if(byLemma[w]) return byLemma[w]; if(byAlias[w]) return byAlias[w];
  for(var k in byAlias) if(w.indexOf(k)>=0||k.indexOf(w)>=0) return byAlias[k];
  return null;
}
function classify(w){
  var e=lookup(w); var role=e?e.role:'neutral';
  if(hasStem(w,STEMS.bridge)) role='bridge';
  if(hasStem(w,STEMS.core)) role='core';
  if(hasStem(w,STEMS.detail)) role='detail';
  if(!e && role==='neutral') role=w.length<=3?'detail':'neutral';
  return {token:w,lemma:e?e.lemma:w,entry:e,role:role};
}
function lcaDepth(pa,pb){var n=Math.min((pa||[]).length,(pb||[]).length),d=0; for(var i=0;i<n;i++){if(pa[i]!==pb[i]) break; d++;} return d;}
function pathSimilarity(a,b){if(!a||!b||!a.path||!b.path) return 0; var d=lcaDepth(a.path,b.path); return (2*d)/(a.path.length+b.path.length||1);}
function cosine(va,vb){if(!va||!vb) return 0; var d=0,na=0,nb=0; for(var i=0;i<Math.min(va.length,vb.length);i++){d+=va[i]*vb[i];na+=va[i]*va[i];nb+=vb[i]*vb[i];} return na&&nb?d/Math.sqrt(na*nb):0;}
function tagCos(a,b){if(!a||!b||!a.tags||!b.tags) return 0; var sh=0; for(var i=0;i<a.tags.length;i++) if(b.tags.indexOf(a.tags[i])>=0) sh++; return a.tags.length&&b.tags.length?sh/Math.sqrt(a.tags.length*b.tags.length):0;}
function pairKey(a,b){return (a&&a.lemma?a.lemma:normalize(a))+'|'+(b&&b.lemma?b.lemma:normalize(b));}
function semFit(a,b){
  a=typeof a==='string'?lookup(a):a; b=typeof b==='string'?lookup(b):b;
  if(!a||!b) return {score:.62,reason:'нет полного словаря: мягкий фолбэк'};
  var key=pairKey(a,b); if(BAD_PAIRS[key]) return {score:.08,reason:BAD_PAIRS[key],hard:true};
  if(GOOD_PAIRS[key]) return {score:.92,reason:GOOD_PAIRS[key],hard:false};
  if(a.scale==='OP'||b.scale==='OP') return {score:.82,reason:'оператор может менять траекторию'};
  if(a.tags.indexOf('noise')>=0 && b.tags.indexOf('abstract')>=0) return {score:.18,reason:'шум рядом с абстракцией требует моста',hard:true};
  if(a.tags.indexOf('part')>=0 && b.tags.indexOf('abstract')>=0) return {score:.45,reason:'часть и абстракция требуют операции сборки'};
  return {score:.72+.18*Math.max(pathSimilarity(a,b),tagCos(a,b)),reason:'совместимо по словарю'};
}
function similarity(a,b){
  var ca=typeof a==='string'?classify(a):a, cb=typeof b==='string'?classify(b):b;
  var ea=ca.entry||lookup(ca.token||ca.lemma), eb=cb.entry||lookup(cb.token||cb.lemma);
  var vec=cosine(ea&&ea.v,eb&&eb.v), path=pathSimilarity(ea,eb), tag=tagCos(ea,eb), fit=semFit(ea,eb);
  var raw=.52*vec+.25*path+.23*tag;
  var score=Math.max(0,Math.min(1,raw*fit.score));
  return {score:score,raw:raw,vector:vec,path:path,tag:tag,fit:fit};
}
function canCompute(op,w){var e=typeof w==='string'?lookup(w):w; if(!e) return false; var ops={QTY:['add','sub','mul','div','compare'],ORD:['compare'],ID:['eq','neq'],OP:['apply']}; return (ops[e.scale]||[]).indexOf(op)>=0;}
function relationType(i,j,s){
  if(s.fit&&s.fit.hard) return 'conflict';
  if(j===i+1) return 'sequence';
  if(s.score>=.34) return 'bridge';
  if(s.fit&&s.fit.score<.35) return 'weak';
  return 'latent';
}
function hasMediation(text){
  var t=String(text||'').toLowerCase();
  return /связк|мост между|через[^.!?\n]{0,50}мост|не сталкиваются напрямую/.test(t);
}
function semanticGraph(analysis,limit){
  var items=analysis&&analysis.items?analysis.items:[], links=[], lcaSum=0, lcaN=0, bridgeSum=0, bridgeCount=0, conflictCount=0;
  limit=limit||36;
  for(var i=0;i<items.length;i++) for(var j=i+1;j<items.length;j++){
    var s=similarity(items[i],items[j]), type=relationType(i,j,s);
    if(type==='conflict' && analysis && analysis.hasMediation) type='bridge';
    var keep=type==='conflict'||type==='bridge'||(type==='sequence'&&s.score>=.03);
    if(!keep) continue;
    var ea=items[i].entry||lookup(items[i].token), eb=items[j].entry||lookup(items[j].token);
    var lca=lcaDepth(ea&&ea.path,eb&&eb.path);
    if(lca>0){ lcaSum+=lca; lcaN++; }
    if(type==='bridge'){ bridgeSum+=s.score; bridgeCount++; }
    if(type==='conflict') conflictCount++;
    links.push({i:i,j:j,a:items[i].lemma,b:items[j].lemma,roleA:items[i].role,roleB:items[j].role,type:type,score:s.score,fit:s.fit.score,path:s.path,tag:s.tag,lca:lca,reason:s.fit.reason});
  }
  links.sort(function(a,b){
    var pa=a.type==='conflict'?3:a.type==='bridge'?2:a.type==='sequence'?1:0;
    var pb=b.type==='conflict'?3:b.type==='bridge'?2:b.type==='sequence'?1:0;
    return pb-pa || b.score-a.score;
  });
  var gaps=links.filter(function(x){return x.type==='bridge' && x.j>x.i+1;}).slice(0,8);
  var conflicts=links.filter(function(x){return x.type==='conflict';}).slice(0,8);
  return {links:links.slice(0,limit),gaps:gaps,conflicts:conflicts,metrics:{gLink:bridgeSum/(bridgeSum+1),lcaAvg:lcaN?lcaSum/lcaN:0,bridgeCount:bridgeCount,conflictCount:conflictCount,relationCount:links.length}};
}
function analyzeText(text){
  var tokens=tokenize(text,26), items=[], roles=[], counts={core:0,detail:0,bridge:0,neutral:0};
  for(var i=0;i<tokens.length;i++){var c=classify(tokens[i]); items.push(c); roles.push(c.role); counts[c.role]=(counts[c.role]||0)+1;}
  var n=Math.max(1,tokens.length), pairScore=0, pairFit=0, pairs=0, conflicts=[], mediated=hasMediation(text);
  for(i=1;i<items.length;i++){var s=similarity(items[i-1],items[i]); pairScore+=s.score; pairFit+=s.fit.score; pairs++;}
  for(i=0;i<items.length;i++) for(var j=i+1;j<items.length;j++){
    var f=semFit(items[i].entry||lookup(items[i].token),items[j].entry||lookup(items[j].token));
    if(f.hard && !mediated){ conflicts.push({a:items[i].lemma,b:items[j].lemma,reason:f.reason,score:f.score}); pairFit+=f.score*.75; pairs+=.75; pairScore+=f.score*.25; }
    else if(f.hard && mediated){ pairFit+=.65*.75; pairs+=.75; pairScore+=.45*.25; }
  }
  var core=counts.core/n, edge=counts.detail/n, move=(counts.bridge+.45*counts.neutral)/n;
  var balance=1-Math.min(1,Math.abs(core-edge)*1.35);
  var density=Math.min(1,tokens.length/14);
  var coherence=pairs?pairScore/pairs:.62, fitAvg=pairs?pairFit/pairs:.72;
  var life=Math.max(0,Math.min(1, (.30+.30*move+.18*balance+.22*coherence)*(.72+.28*density)*(.72+.28*fitAvg) ));
  if(conflicts.length) life=Math.max(0,life-.14*Math.min(3,conflicts.length));
  var result={text:text,tokens:tokens,items:items,roles:roles,counts:counts,core:core,edge:edge,move:move,life:life,coherence:coherence,semFit:fitAvg,conflicts:conflicts,hasMediation:mediated,hash:hash(text),force:edge-core};
  result.graph=semanticGraph(result,36);
  result.relations=result.graph.links;
  result.gaps=result.graph.gaps;
  result.portal=portalCommand(result);
  return result;
}
function pick(items,role,preferOp){
  var fallback=null;
  for(var i=0;i<items.length;i++){
    if(items[i].role!==role) continue;
    if(preferOp && items[i].entry && items[i].entry.scale==='OP') return items[i].lemma;
    if(!fallback) fallback=items[i].lemma;
  }
  return fallback;
}
function pickMeaning(items,roles){
  for(var r=0;r<roles.length;r++) for(var i=0;i<items.length;i++){
    if(items[i].role!==roles[r]) continue;
    if(items[i].entry && items[i].entry.scale!=='OP') return items[i].lemma;
  }
  for(r=0;r<roles.length;r++) for(i=0;i<items.length;i++) if(items[i].role===roles[r]) return items[i].lemma;
  return null;
}
function actionVerb(lemma){
  if(lemma==='продолжение') return 'продолжить';
  if(lemma==='мост') return 'связать';
  if(lemma==='путь') return 'провести дальше';
  if(lemma==='слово') return 'выразить';
  return lemma||'продолжить';
}
function parseFormula(s){
  s=String(s||'');
  var m=s.match(/^\s*([a-zа-яё_↔⇑⇓]+)\(([^)]*)\)\s*->\s*(.+)\s*$/i);
  if(!m) return {ok:false,source:s,op:'raw',args:[],effect:s};
  return {ok:true,source:s,op:m[1],args:m[2].split(',').map(function(x){return normalize(x.trim());}).filter(Boolean),effect:m[3].trim()};
}
function pickBridgeWord(analysis){
  var w=pickMeaning(analysis.items||[],['bridge','neutral','core','detail']);
  return w||'мост';
}
function portalCommand(analysis){
  if(!analysis||!analysis.tokens||!analysis.tokens.length){
    var emptyFormula='orbit() -> wait(condition)';
    return {id:'empty',op:'orbit',label:'ожидание условия',signature:'orbit() -> condition',params:[],formula:emptyFormula,formulaAst:parseFormula(emptyFormula),contract:{pre:'есть поле ввода',inv:'система остается в 0<u<1',post:'ожидает внешнее условие',proof:'нет токенов для SemFit'},verdict:'нет команды'};
  }
  var graph=analysis.graph||semanticGraph(analysis,36), conflict=graph.conflicts&&graph.conflicts[0], gap=graph.gaps&&graph.gaps[0];
  var topic=pickMeaning(analysis.items,['core','bridge','neutral','detail'])||analysis.tokens[0];
  var fact=pickMeaning(analysis.items,['detail','neutral','bridge','core'])||analysis.tokens[1]||topic;
  var bridge=pickBridgeWord(analysis);
  var command;
  if(conflict){
    command={id:'link_conflict',op:'↔',label:'мост конфликта',signature:'bridge('+conflict.a+', '+conflict.b+') -> continue',params:[conflict.a,conflict.b,bridge],formula:'bridge('+conflict.a+','+conflict.b+') -> add('+bridge+') && keep(0<u<1)',contract:{pre:'SemFit('+conflict.a+','+conflict.b+') < 0.35',inv:'не удалять смысл и не разносить детали за край',post:'появляется связующий оператор перед продолжением',proof:conflict.reason||'жесткий SemFit-гейт'},verdict:'исполнить ↔ перед продолжением',risk:'без моста фраза дробится в шум'};
  }else if(analysis.core>.46&&analysis.edge<.22){
    command={id:'add_detail',op:'⇓',label:'добавить пример',signature:'detail('+topic+') -> example',params:[topic,fact],formula:'detail('+topic+') -> edge(+example) && keep(core)',contract:{pre:'core > 0.46 && detail < 0.22',inv:'главный смысл сохраняется',post:'ядро получает проверяемую деталь',proof:'M(λ) падает от схлопывания; деталь возвращает радиус'},verdict:'исполнить ⇓',risk:'без примера будет центр-коллапс'};
  }else if(analysis.edge>.46&&analysis.core<.22){
    command={id:'synthesize',op:'⇑',label:'собрать смысл',signature:'synth('+fact+') -> thesis',params:[fact,topic],formula:'synth('+fact+') -> core(+thesis) && bind(details)',contract:{pre:'detail > 0.46 && core < 0.22',inv:'детали не теряются, только связываются',post:'появляется общий тезис',proof:'g↔ засчитывает рост только при новой связи'},verdict:'исполнить ⇑',risk:'без синтеза детали улетят к 1D-краю'};
  }else if(analysis.move<.25){
    command={id:'open_bridge',op:'↔',label:'открыть мост',signature:'bridge('+topic+', '+fact+') -> next',params:[topic,fact],formula:'bridge('+topic+','+fact+') -> continue(+1 step)',contract:{pre:'move < 0.25',inv:'сохранять оба полюса различимыми',post:'появляется следующий ход',proof:'низкий bridge-счетчик требует оператора ↔'},verdict:'исполнить ↔',risk:'без моста движение станет формальным'};
  }else{
    command={id:'keep_orbit',op:'orbit',label:'держать кольцо',signature:'orbit('+topic+') -> next',params:[topic,fact],formula:'orbit('+topic+') -> next('+fact+') && keep(0<u<1)',contract:{pre:'core/detail/bridge находятся в рабочей зоне',inv:'не схлопывать и не рассыпать',post:'продолжить тему через выбранную деталь',proof:'SemFit и g↔ не показывают жесткого разрыва'},verdict:'продолжать по кольцу',risk:'слишком сильный рычаг λ создаст полюс'};
  }
  command.formulaAst=parseFormula(command.formula);
  command.metrics={semFit:analysis.semFit||0,gLink:graph.metrics.gLink||0,lca:graph.metrics.lcaAvg||0,life:analysis.life||0};
  if(gap&&!conflict) command.bridgeCandidate={a:gap.a,b:gap.b,score:gap.score,reason:gap.reason};
  return command;
}
function appendPortalText(base,addition){
  base=String(base||'').trim(); addition=String(addition||'').trim();
  if(!addition) return {text:base,added:'',changed:false};
  if(base.indexOf(addition)>=0) return {text:base,added:addition,changed:false};
  return {text:(base?base+'\n'+addition:addition),added:addition,changed:true};
}
function executePortal(text,command,analysis){
  analysis=analysis||analyzeText(text);
  command=command||analysis.portal||portalCommand(analysis);
  var p=command.params||[], topic=p[0]||pickMeaning(analysis.items||[],['core','bridge','neutral','detail'])||'тема', fact=p[1]||pickMeaning(analysis.items||[],['detail','neutral','bridge','core'])||topic, bridge=p[2]||pickBridgeWord(analysis);
  var addition='';
  if(command.id==='link_conflict'){
    addition='Связка: «'+topic+'» и «'+fact+'» не сталкиваются напрямую; через «'+bridge+'» конфликт становится препятствием, которое можно пройти и продолжить тему.';
  }else if(command.id==='add_detail'){
    addition='Пример: «'+topic+'» проверяется через одну видимую деталь, один факт и следующий шаг, чтобы ядро не схлопнулось в пустое обобщение.';
  }else if(command.id==='synthesize'){
    addition='Тезис: «'+topic+'» и соседние детали собираются в общий смысл; детали остаются на месте, но получают связующий вывод.';
  }else if(command.id==='open_bridge'){
    addition='Связка: «'+topic+'» ведет к «'+fact+'»; следующий ход должен сохранить оба слова и добавить переход между ними.';
  }else{
    addition='Продолжение: «'+topic+'» идет через «'+fact+'»; кольцо удерживает ход между ядром и краем.';
  }
  var out=appendPortalText(text,addition);
  out.command=command;
  out.op=command.op;
  out.label=command.label;
  out.formula=command.formula;
  return out;
}
function orbitState(analysis){
  var u=Math.max(.06,Math.min(.94,.5+(analysis.edge-analysis.core)*.38-(analysis.move-.33)*.06));
  var risk='ok', verdict='рабочее кольцо';
  if(analysis.graph&&analysis.graph.metrics&&analysis.graph.metrics.conflictCount){risk='conflict'; verdict='сначала нужен мост';}
  else if(u<.18){risk='center'; verdict='риск центр-коллапса';}
  else if(u>.82){risk='edge'; verdict='риск распада на край';}
  else if(analysis.life<.35){risk='stall'; verdict='риск формальной остановки';}
  return {u:u,risk:risk,verdict:verdict};
}
function stabilityGuard(input){
  var source=typeof input==='string'?input:(input&&input.text)||'';
  var analysis=typeof input==='string'?analyzeText(input):input;
  analysis=analysis||analyzeText('');
  var sourceText=String(source||analysis.text||'');
  var counterIntent=/не\s+(сжимать|сжать|сверн|убирать|убрать)|оставить[^.!?]{0,70}(пример|детал|факт)|сохранить[^.!?]{0,70}(пример|детал|факт)|не\s+потерять[^.!?]{0,70}(пример|детал|факт)/i.test(sourceText);
  var centerIntent=!counterIntent && /сжать|сверн|одно\s+главн|все[^.!?]{0,40}одно|убрать[^.!?]{0,50}(пример|детал|факт)/i.test(sourceText);
  var state=orbitState(analysis), gm=analysis.graph&&analysis.graph.metrics?analysis.graph.metrics:{};
  var u=state.u==null?.5:state.u, centerMargin=Math.max(0,u), edgeMargin=Math.max(0,1-u);
  var middle=1-Math.min(1,Math.abs(u-.5)*2);
  var conflictPenalty=(gm.conflictCount||0)>.0?.22:0;
  var score=Math.max(0,Math.min(1,Math.min(centerMargin,edgeMargin)*1.2+(analysis.life||0)*.34+(analysis.move||0)*.12+Math.max(0,gm.gLink||0)*.10-conflictPenalty));
  var zone=(centerIntent && ((analysis.core||0)>.32 || (analysis.move||0)<.30))?'center':state.risk==='center'?'center':state.risk==='edge'?'edge':state.risk==='conflict'?'conflict':state.risk==='stall'?'stall':score<.42?'thin':'safe';
  if(zone==='center') score=Math.min(score,.39);
  if(zone==='edge') score=Math.min(score,.39);
  if(zone==='conflict') score=Math.min(score,.34);
  var verdict='рабочее 2D-кольцо удержано';
  var action='продолжать через мост и одну деталь';
  if(zone==='center'){verdict='слишком близко к 3D-схлопыванию'; action='добавить пример или конкретную деталь';}
  else if(zone==='edge'){verdict='слишком близко к 1D-распаду'; action='собрать детали в тезис';}
  else if(zone==='conflict'){verdict='смысловой разрыв перед продолжением'; action='сначала поставить ↔-мост';}
  else if(zone==='stall'){verdict='движение формально слабеет'; action='добавить следующий ход';}
  else if(zone==='thin'){verdict='кольцо держится, но запас мал'; action='усилить мост, не добавляя крайностей';}
  return {score:score,u:u,middle:middle,zone:zone,risk:zone==='center'?'center':state.risk,verdict:verdict,action:action,formula:'guard = min(u, 1-u) + life + move + g_link - conflict',margins:{center:centerMargin,edge:edgeMargin,life:analysis.life||0,move:analysis.move||0,gLink:gm.gLink||0},checks:[{id:'center',label:'не центр',value:centerMargin,ok:u>.18&&!centerIntent,note:centerIntent?'явное сжатие всех деталей':'запас до 3D-схлопывания'},{id:'edge',label:'не край',value:edgeMargin,ok:u<.82,note:'запас до 1D-распада'},{id:'life',label:'живость',value:analysis.life||0,ok:(analysis.life||0)>=.35,note:'не формальная остановка'},{id:'bridge',label:'мост',value:gm.gLink||0,ok:(gm.gLink||0)>=.25||analysis.move>=.34,note:'есть связь для продолжения'}]};
}
function balanceCandidate(items,seen,baseText,beforeGuard,label,op,line,formula,reason,index){
  line=String(line||'').trim();
  if(!line||seen[line]) return;
  seen[line]=1;
  var out=appendPortalText(baseText,line), after=analyzeText(out.text), guard=stabilityGuard(out.text), state=orbitState(after);
  var riskPenalty=(guard.zone==='safe'||guard.zone==='thin')?0:guard.zone==='conflict'?.24:.18;
  var gain=Math.max(0,(guard.score||0)-((beforeGuard&&beforeGuard.score)||0));
  var score=Math.max(0,Math.min(1,(guard.score||0)*.72+gain*.18+(after.life||0)*.06+(after.move||0)*.04-riskPenalty));
  items.push({index:index,label:label,op:op,line:line,text:out.text,added:out.added,changed:!!out.changed,formula:formula,reason:reason,score:score,beforeGuard:beforeGuard,afterGuard:guard,after:after,state:state,life:after.life,core:after.core,edge:after.edge,move:after.move,u:guard.u,risk:guard.risk,zone:guard.zone});
}
function balanceRepair(text,count){
  count=Math.max(1,Math.min(6,count||4));
  var baseText=String(text||'').trim(), before=analyzeText(baseText), guard=stabilityGuard(baseText), cmd=before.portal||portalCommand(before), items=[], seen={};
  var topic=pickMeaning(before.items||[],['core','bridge','neutral','detail'])||before.tokens[0]||'тема';
  var fact=pickMeaning(before.items||[],['detail','neutral','bridge','core'])||before.tokens[1]||topic;
  var bridge=pickBridgeWord(before)||'мост';
  if(bridge===topic||bridge===fact) bridge='мост';
  if(guard.zone==='center'){
    balanceCandidate(items,seen,baseText,guard,'пример','⇓','Баланс: не сжимать все в одну точку; оставить пример: «'+topic+'» проявляется через «'+fact+'», затем сделать следующий ход.','repair(center) = add(example) + keep(core) + next','деталь возвращает объем без распада',0);
  }else if(guard.zone==='edge'){
    balanceCandidate(items,seen,baseText,guard,'тезис','⇑','Баланс: детали не разлетаются отдельно; собрать «'+fact+'» и соседние части в тезис о «'+topic+'», затем продолжить.','repair(edge) = synth(details) + bind(topic) + next','тезис собирает крохи, не стирая их',0);
  }else if(guard.zone==='conflict'){
    balanceCandidate(items,seen,baseText,guard,'мост','↔','Баланс: поставить мост «'+bridge+'» между «'+topic+'» и «'+fact+'», затем продолжить без удаления сторон.','repair(conflict) = bridge(a,b) + keep(both) + next','мост переводит разрыв в препятствие',0);
  }else if(guard.zone==='stall'||guard.zone==='thin'){
    balanceCandidate(items,seen,baseText,guard,'ход','orbit','Баланс: добавить следующий ход: «'+topic+'» переходит через «'+bridge+'» к «'+fact+'», сохраняя движение.','repair(thin) = next(topic, bridge, fact)','ход усиливает слабое кольцо',0);
  }else{
    balanceCandidate(items,seen,baseText,guard,'поддержка','orbit','Поддержка: «'+topic+'» продолжает движение через «'+fact+'»; центр и край остаются различимыми.','repair(ok) = keep(0<u<1) + next','система уже в рабочем кольце',0);
  }
  balanceCandidate(items,seen,baseText,guard,'мост','↔','Связка: «'+topic+'» и «'+fact+'» соединяются через «'+bridge+'», чтобы следующий ход не стал формальным.','bridge('+topic+','+fact+') -> continue','универсальный мост продолжения',1);
  balanceCandidate(items,seen,baseText,guard,'мантра','orbit','Круг идет. Кроха в ряд. Мост держит. Смысл живет.','chant -> rhythm + keep(0<u<1)','простой ритм удерживает процесс',2);
  items.sort(function(a,b){return b.score-a.score || ((b.afterGuard&&b.afterGuard.score)||0)-((a.afterGuard&&a.afterGuard.score)||0) || a.index-b.index;});
  for(var i=0;i<items.length;i++) items[i].rank=i+1;
  var best=items[0]||null;
  return {before:before,guard:guard,items:items.slice(0,count),best:best,count:items.length,formula:'repair = argmax(guard_after - guard_before + life + move - risk)',verdict:best?'лучшее противодействие: '+best.label:'нет противодействия',mantra:'не центр · не край · мост · следующий ход'};
}
function compactGuard(g){
  return {score:g&&g.score||0,u:g&&g.u||.5,zone:g&&g.zone||'safe',risk:g&&g.risk||'ok',verdict:g&&g.verdict||'',action:g&&g.action||''};
}
function trajectoryStepScore(beforeGuard,afterGuard,afterAnalysis){
  var gain=(afterGuard&&afterGuard.score||0)-(beforeGuard&&beforeGuard.score||0);
  var middle=1-Math.min(1,Math.abs(((afterGuard&&afterGuard.u)!=null?afterGuard.u:.5)-.5)*2);
  var penalty=(afterGuard&&afterGuard.zone&&afterGuard.zone!=='safe'&&afterGuard.zone!=='thin')?.18:0;
  return Math.max(0,Math.min(1,(afterGuard&&afterGuard.score||0)*.62+Math.max(0,gain)*.18+((afterAnalysis&&afterAnalysis.life)||0)*.10+middle*.10-penalty));
}
function semanticTrajectory(text,steps){
  steps=Math.max(1,Math.min(8,steps||5));
  var current=String(text||'').trim(), out=[], seen={};
  for(var i=0;i<steps;i++){
    var before=analyzeText(current), beforeGuard=stabilityGuard(current), plan=null, best=null, mode='compose';
    if(beforeGuard.zone==='safe'){
      plan=composeContinuation(current,4); best=plan.best; mode='compose';
    }else{
      plan=balanceRepair(current,4); best=plan.best; mode='repair';
      if(!best || !best.changed){ plan=composeContinuation(current,4); best=plan.best; mode='compose'; }
    }
    if(!best){ break; }
    var nextText=best.text||appendPortalText(current,best.line||best.added||'').text;
    if(!nextText || nextText===current) break;
    var after=analyzeText(nextText), afterGuard=stabilityGuard(nextText), key=(mode+'|'+(best.op||'')+'|'+after.hash+'|'+afterGuard.zone);
    out.push({step:i+1,mode:mode,op:best.op||'orbit',label:best.label||'ход',line:best.line||best.added||'',score:trajectoryStepScore(beforeGuard,afterGuard,after),text:nextText,before:compactGuard(beforeGuard),after:compactGuard(afterGuard),life:after.life,move:after.move,core:after.core,edge:after.edge,semFit:after.semFit,formula:(mode==='repair'?(plan&&plan.formula)||'repair':'compose = argmax(next_life - risk - |u-.5|')});
    current=nextText;
    if(seen[key]) break;
    seen[key]=1;
  }
  var last=out.length?out[out.length-1].after:compactGuard(stabilityGuard(current));
  var ok=last.zone==='safe'||last.zone==='thin';
  return {start:String(text||''),text:current,steps:out,count:out.length,formula:'trajectory = repeat(guard -> repair|compose -> guard)',verdict:ok?'траектория удерживает 2D-кольцо':'траектория требует нового ремонта',last:last};
}
var ARCH_ROOTS={0:'смешанный берег',1:'город/путь',2:'природа/поток',3:'свет',4:'время/состояние',5:'слово/мысль',6:'осколки/части',7:'операции'};
function rootOfItem(item){
  var e=item&&(item.entry||lookup(item.token||item.lemma));
  return e&&e.path&&e.path.length?e.path[0]:0;
}
function dominantRole(counts){
  var best='neutral', n=-1;
  for(var k in counts) if(counts[k]>n){best=k; n=counts[k];}
  return best;
}
function islandRadius(role){ return role==='core'?.30:role==='detail'?.78:role==='bridge'?.52:.60; }
function clusterCohesion(items){
  if(!items||items.length<2) return items&&items.length?1:0;
  var total=0,n=0;
  for(var i=0;i<items.length;i++) for(var j=i+1;j<items.length;j++){ total+=similarity(items[i],items[j]).score; n++; }
  return n?total/n:0;
}
function semanticArchipelago(input){
  var analysis=typeof input==='string'?analyzeText(input):(input||analyzeText(''));
  var graph=analysis.graph||semanticGraph(analysis,36), groups={}, clusters=[], items=analysis.items||[];
  for(var i=0;i<items.length;i++){
    var root=rootOfItem(items[i]), key=String(root), g=groups[key];
    if(!g){ g=groups[key]={id:key,root:root,label:ARCH_ROOTS[root]||('ветвь '+root),items:[],roles:{core:0,detail:0,bridge:0,neutral:0},score:0}; }
    g.items.push(items[i]); g.roles[items[i].role]=(g.roles[items[i].role]||0)+1;
  }
  for(var k in groups){
    var c=groups[k], role=dominantRole(c.roles), cohesion=clusterCohesion(c.items), u=islandRadius(role), names=c.items.map(function(x){return x.lemma;});
    c.role=role; c.u=u; c.cohesion=cohesion; c.weight=c.items.length; c.names=names; c.score=Math.max(0,Math.min(1,cohesion*.52+Math.min(1,c.weight/5)*.28+(role==='bridge'?.12:0)+(role==='core'?.08:0)));
    clusters.push(c);
  }
  clusters.sort(function(a,b){return b.score-a.score || b.weight-a.weight || a.root-b.root;});
  var linked={}, straits=[];
  var rels=(graph.conflicts||[]).concat(graph.gaps||[]).concat((graph.links||[]).filter(function(x){return x.type==='bridge';}).slice(0,8));
  for(i=0;i<rels.length;i++){
    var r=rels[i], a=lookup(r.a)||classify(r.a), b=lookup(r.b)||classify(r.b), ra=rootOfItem({entry:a,lemma:r.a}), rb=rootOfItem({entry:b,lemma:r.b}), type=r.type||'bridge';
    var key2=[r.a,r.b,type].join('|'); if(linked[key2]) continue; linked[key2]=1;
    var risk=type==='conflict'?'risk':ra!==rb?'strait':'inner';
    var novelty=ra!==rb?.28:.10, score=Math.max(0,Math.min(1,(r.score||0)*.62+novelty+(type==='conflict'?.22:0)));
    straits.push({a:r.a,b:r.b,from:String(ra),to:String(rb),fromLabel:ARCH_ROOTS[ra]||String(ra),toLabel:ARCH_ROOTS[rb]||String(rb),type:type,risk:risk,score:score,reason:r.reason||'',op:type==='conflict'?'↔':'bridge'});
  }
  straits.sort(function(a,b){
    var pa=a.type==='conflict'?3:a.risk==='strait'?2:1, pb=b.type==='conflict'?3:b.risk==='strait'?2:1;
    return pb-pa || b.score-a.score;
  });
  var best=straits[0]||null;
  var action='держать острова в кольце';
  if(best&&best.type==='conflict') action='поставить мост между «'+best.a+'» и «'+best.b+'»';
  else if(best) action='открыть пролив «'+best.a+'» ↔ «'+best.b+'»';
  else if(clusters.length<2) action='добавить второй остров через пример или деталь';
  var gm=graph.metrics||{}, noveltyScore=Math.max(0,Math.min(1,clusters.length/Math.max(1,(analysis.tokens||[]).length)));
  var score=Math.max(0,Math.min(1,(gm.gLink||0)*.35+(analysis.life||0)*.25+noveltyScore*.20+(best?best.score*.20:0)-((gm.conflictCount||0)*.12)));
  return {analysis:analysis,clusters:clusters,straits:straits.slice(0,8),best:best,action:action,score:score,formula:'archipelago = group(tokens by LCA/root) + rank(straits by SemFit × novelty × risk)',metrics:{clusters:clusters.length,straits:straits.length,gLink:gm.gLink||0,lca:gm.lcaAvg||0,conflicts:gm.conflictCount||0,novelty:noveltyScore}};
}
function plainTextLine(s){ return String(s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); }
function weaveSlot(id,label,value,role,u,score,note){ return {id:id,label:label,value:value||'—',role:role||'neutral',u:u,score:Math.max(0,Math.min(1,score==null?.5:score)),note:note||''}; }
function semanticWeave(input){
  var analysis=typeof input==='string'?analyzeText(input):(input||analyzeText(''));
  var text=analysis.text||String(input||'');
  var graph=analysis.graph||semanticGraph(analysis,36), gm=graph.metrics||{};
  var guard=stabilityGuard(text), arch=semanticArchipelago(analysis), plan=composeContinuation(text,4), repair=balanceRepair(text,4);
  var conflict=graph.conflicts&&graph.conflicts[0], bestStrait=arch.best||null;
  var topic=pickMeaning(analysis.items||[],['core','bridge','neutral','detail'])||analysis.tokens[0]||'тема';
  var fact=pickMeaning(analysis.items||[],['detail','neutral','bridge','core'])||analysis.tokens[1]||topic;
  var bridge=pickBridgeWord(analysis)||'мост';
  var conflictOther=null;
  if(conflict){ conflictOther=topic===conflict.a?conflict.b:topic===conflict.b?conflict.a:(conflict.a+' / '+conflict.b); }
  var obstacle=conflict?conflictOther:(bestStrait?(bestStrait.a+' / '+bestStrait.b):fact);
  var op='orbit', action='продолжить';
  if(conflict){ op='↔'; action='поставить мост'; bridge=bridge||'мост'; }
  else if(guard.zone==='center'){ op='⇓'; action='дать пример'; }
  else if(guard.zone==='edge'){ op='⇑'; action='собрать тезис'; }
  else if(guard.zone==='stall'||guard.zone==='thin'){ op='↔'; action='укрепить связь'; }
  else if(analysis.portal){ op=analysis.portal.op||op; action=analysis.portal.label||action; }
  var bestLine=(plan.best&&(plan.best.line||plan.best.added))||(repair.best&&(repair.best.line||repair.best.added))||nextMove(analysis).text;
  var next=plainTextLine(bestLine).replace(/^дальше:\s*/i,'');
  if(!next) next='сделать один связный следующий ход';
  var risk=(guard.zone==='safe'?0:guard.zone==='thin'?.12:.24)+Math.min(.36,(gm.conflictCount||0)*.12);
  var openness=Math.max(0,Math.min(1,(analysis.move||0)*.34+(analysis.life||0)*.32+(arch.metrics&&arch.metrics.novelty||0)*.18+(gm.gLink||0)*.16));
  var confidence=Math.max(0,Math.min(1,openness+(bestStrait?bestStrait.score*.18:0)-risk));
  var K=guard.zone==='conflict'?1:(guard.zone==='stall'||guard.zone==='thin'?2:(analysis.life>.62?3:2));
  var slots=[
    weaveSlot('topic','тема',topic,'core',.30,(analysis.core||0)+.35,'что удерживаем'),
    weaveSlot('obstacle','узел',obstacle,conflict?'detail':'neutral',conflict?.76:.58,bestStrait?bestStrait.score:(analysis.semFit||0),'что мешает или требует уточнения'),
    weaveSlot('bridge','мост',bridge,'bridge',.50,(analysis.move||0)+.30,'чем связываем'),
    weaveSlot('action','ход',op+' '+action,'bridge',.56,confidence,'какая операция удерживает кольцо'),
    weaveSlot('next','строка',next,'bridge',.62,(plan.best&&plan.best.score)||confidence,'какое продолжение вставить')
  ];
  var sentence='«'+topic+'» встречает «'+obstacle+'», проходит через «'+bridge+'» и делает ход: '+next;
  var insertLine='Смысловая сборка: '+sentence;
  var verdict=confidence<.34?'каркас слабый: сначала нужен ремонт':risk>.28?'каркас найден, но конфликт требует моста':'каркас удерживает продолжение';
  return {analysis:analysis,guard:guard,archipelago:arch,plan:plan,repair:repair,slots:slots,sentence:sentence,insertLine:insertLine,verdict:verdict,score:confidence,formula:'weave = topic -> obstacle -> bridge -> action -> next; window(K) = repeat 2-3 then open novelty',metrics:{slots:slots.length,K:K,openness:openness,risk:risk,confidence:confidence,gLink:gm.gLink||0,lca:gm.lcaAvg||0,conflicts:gm.conflictCount||0}};
}
function semanticWindowRhythm(input){
  var analysis=typeof input==='string'?analyzeText(input):(input||analyzeText(''));
  var text=analysis.text||String(input||''), weave=semanticWeave(analysis), graph=analysis.graph||semanticGraph(analysis,36);
  var slots=weave.slots||[], byId={};
  for(var i=0;i<slots.length;i++) byId[slots[i].id]=slots[i];
  var topic=(byId.topic&&byId.topic.value)||pickMeaning(analysis.items||[],['core','bridge','neutral','detail'])||analysis.tokens[0]||'тема';
  var obstacle=(byId.obstacle&&byId.obstacle.value)||pickMeaning(analysis.items||[],['detail','neutral','bridge','core'])||topic;
  var bridge=(byId.bridge&&byId.bridge.value)||pickBridgeWord(analysis)||'мост';
  var K=Math.max(1,Math.min(5,(weave.metrics&&weave.metrics.K)||2));
  var conflict=graph.conflicts&&graph.conflicts[0], phase=conflict?K:(hash(text+'|window|'+K)%(K+1)), open=phase>=K;
  var candidate=obstacle&&obstacle!=='—'?obstacle:bridge;
  var sim=similarity(topic,candidate), theta=conflict?.45:.34, gate=conflict?Math.min(.32,sim.score):sim.score;
  var mode=!open?'repeat':conflict?'bridge':gate>=theta?'admit':'block';
  var beats=[];
  for(var b=0;b<K;b++) beats.push({index:b+1,label:'повтор '+(b+1),kind:'repeat',active:phase===b,role:'bridge',value:'«'+topic+'» через «'+bridge+'»',u:.46,score:Math.max(.25,weave.score||0)});
  beats.push({index:K+1,label:'окно',kind:mode,active:open,role:mode==='block'||mode==='bridge'?'detail':'bridge',value:open?'«'+candidate+'»':'ожидание окна',u:open?.72:.55,score:open?Math.max(gate,weave.score||0):weave.score||0});
  var action=mode==='repeat'?'повторить связку и не впускать новую деталь до окна':mode==='bridge'?'окно открыто, но конфликт входит только через мост':mode==='admit'?'окно открыто: впустить новую деталь': 'окно открыто, но связность ниже порога — блок и откат';
  var insertLine=mode==='repeat'?'Оконный ритм: повтор '+Math.max(1,phase+1)+'/'+K+' — «'+topic+'» удерживается через «'+bridge+'»; окно новизны пока закрыто.':mode==='bridge'?'Оконный ритм: окно открыто; «'+candidate+'» допускается только через «'+bridge+'», чтобы конфликт стал продолжением.':mode==='admit'?'Оконный ритм: окно открыто; «'+candidate+'» входит в тему «'+topic+'» и дает следующий ход.':'Оконный ритм: окно открыто, но «'+candidate+'» не проходит SemFit-порог; петля сохраняется через «'+bridge+'».';
  var score=Math.max(0,Math.min(1,(open?.22:.10)+(weave.score||0)*.42+(mode==='admit'?.22:mode==='bridge'?.16:mode==='repeat'?.12:-.08)+Math.max(0,gate-theta)*.35));
  return {analysis:analysis,weave:weave,K:K,phase:phase,open:open,mode:mode,topic:topic,candidate:candidate,bridge:bridge,gate:gate,theta:theta,beats:beats,action:action,insertLine:insertLine,score:score,formula:'window = repeat(loop,K) -> open(candidate if SemFit >= theta else bridge/block)',metrics:{K:K,phase:phase+1,cycle:K+1,gate:gate,theta:theta,score:score,open:open?1:0,conflicts:(graph.metrics&&graph.metrics.conflictCount)||0}};
}
function forecast(text,steps){

  steps=Math.max(1,Math.min(8,steps||4));
  var current=String(text||'').trim(), out=[], seen={};
  for(var i=0;i<steps;i++){
    var before=analyzeText(current), cmd=before.portal||portalCommand(before), run=executePortal(current,cmd,before);
    if(!run.changed){
      var mv=nextMove(before).text.replace(/^дальше:\s*/,'');
      run=appendPortalText(current,'Ход '+(i+1)+': '+mv);
      run.command=cmd; run.op=cmd.op; run.label=cmd.label; run.formula=cmd.formula;
    }
    var after=analyzeText(run.text), state=orbitState(after);
    var sig=(cmd.id||'cmd')+'|'+state.risk+'|'+after.hash;
    out.push({step:i+1,op:cmd.op,label:cmd.label,id:cmd.id,formula:cmd.formula,added:run.added||'',changed:!!run.changed,life:after.life,core:after.core,edge:after.edge,move:after.move,semFit:after.semFit,u:state.u,risk:state.risk,verdict:state.verdict,text:run.text});
    current=run.text;
    if(seen[sig]) break;
    seen[sig]=1;
  }
  return {text:current,steps:out};
}
function mergeImpulseText(base,impulse){
  base=String(base||'').trim(); impulse=String(impulse||'').trim();
  if(!impulse) return base;
  return appendPortalText(base,'Внешнее условие: '+impulse).text;
}
function impulseVerdict(effect,state,d){
  if(effect==='conflict') return 'импульс создает разрыв: сначала нужен ↔-мост';
  if(effect==='split') return 'импульс тянет к 1D-детализации: нужен тезис-сборка';
  if(effect==='generalize') return 'импульс тянет к 3D-обобщению: нужен пример, чтобы не схлопнуться';
  if(effect==='continue') return 'импульс поддерживает 2D-продолжение';
  if(effect==='risk') return state.verdict||'импульс снижает живость';
  if(Math.abs(d.life)<.025 && Math.abs(d.core)<.025 && Math.abs(d.edge)<.025 && Math.abs(d.move)<.025) return 'импульс слабый: система почти не меняется';
  return 'импульс принят: удерживать кольцо';
}
function analyzeImpulse(baseText,impulseText){
  var base=analyzeText(baseText), impulse=analyzeText(impulseText), combinedText=mergeImpulseText(baseText,impulseText), after=analyzeText(combinedText);
  var bm=base.graph&&base.graph.metrics?base.graph.metrics:{}, am=after.graph&&after.graph.metrics?after.graph.metrics:{};
  var d={core:after.core-base.core,edge:after.edge-base.edge,move:after.move-base.move,life:after.life-base.life,semFit:(after.semFit||0)-(base.semFit||0),conflicts:(am.conflictCount||0)-(bm.conflictCount||0),gLink:(am.gLink||0)-(bm.gLink||0)};
  var state=orbitState(after), effect='neutral';
  if(d.conflicts>0 || (after.portal&&after.portal.id==='link_conflict')) effect='conflict';
  else if(d.edge>.08 && after.edge>after.core) effect='split';
  else if(d.core>.08 && after.core>=after.edge) effect='generalize';
  else if(d.move>.05 || d.life>.04 || d.gLink>.06) effect='continue';
  else if(d.life<-.08 || state.risk!=='ok') effect='risk';
  var labels={conflict:'разрыв',split:'детализация',generalize:'обобщение',continue:'продолжение',risk:'риск',neutral:'слабый импульс'};
  return {base:base,impulse:impulse,after:after,combinedText:combinedText,deltas:d,state:state,effect:effect,label:labels[effect]||effect,recommendation:impulseVerdict(effect,state,d),portal:after.portal,forecast:forecast(combinedText,3).steps};
}
function impulseLines(input){
  if(Array.isArray(input)) return input.map(function(x){return String(x||'').trim();}).filter(Boolean);
  return String(input||'').split(/[\n;]+/).map(function(x){return x.replace(/^[-*•\d.)\s]+/,'').trim();}).filter(Boolean);
}
function impulseScore(result){
  var d=result.deltas||{}, state=result.state||{}, after=result.after||{}, conflictPenalty=Math.max(0,d.conflicts||0)*.24;
  var extremePenalty=Math.abs((state.u==null?.5:state.u)-.5)*.42;
  var riskPenalty=state.risk==='ok'?0:state.risk==='conflict'?.28:.16;
  var gain=Math.max(0,d.gLink||0)*.20+Math.max(0,d.move||0)*.16+Math.max(0,d.life||0)*.24;
  var directionPenalty=Math.max(0,d.core||0)*.45+Math.max(0,d.edge||0)*.28+Math.max(0,-(d.move||0))*.22;
  var effectPenalty=(result.effect==='split'||result.effect==='generalize')?.08:0;
  return Math.max(0,Math.min(1,(after.life||0)+gain-conflictPenalty-extremePenalty-riskPenalty-directionPenalty-effectPenalty));
}
function rankImpulses(baseText,impulseInput){
  var lines=impulseLines(impulseInput), items=[];
  for(var i=0;i<lines.length;i++){
    var r=analyzeImpulse(baseText,lines[i]);
    r.index=i; r.impulseText=lines[i]; r.score=impulseScore(r);
    items.push(r);
  }
  items.sort(function(a,b){return b.score-a.score || (b.after.life-a.after.life) || a.index-b.index;});
  for(var j=0;j<items.length;j++) items[j].rank=j+1;
  return {items:items,best:items[0]||null,count:items.length};
}
function continuationScore(analysis,state){
  var gm=analysis&&analysis.graph&&analysis.graph.metrics?analysis.graph.metrics:{};
  var riskPenalty=state&&state.risk==='ok'?0:state&&state.risk==='conflict'?.28:.16;
  var extremePenalty=Math.abs(((state&&state.u)!=null?state.u:.5)-.5)*.38;
  var bridgeGain=Math.max(0,gm.gLink||0)*.14+Math.max(0,(analysis&&analysis.move)||0)*.12;
  return Math.max(0,Math.min(1,((analysis&&analysis.life)||0)+bridgeGain-riskPenalty-extremePenalty));
}
function addContinuationCandidate(items,seen,baseText,label,op,line,formula,reason,index){
  line=String(line||'').trim();
  if(!line||seen[line]) return;
  seen[line]=1;
  var out=appendPortalText(baseText,line), after=analyzeText(out.text), state=orbitState(after);
  items.push({index:index,label:label,op:op,line:line,text:out.text,added:out.added,formula:formula,reason:reason,score:continuationScore(after,state),life:after.life,core:after.core,edge:after.edge,move:after.move,semFit:after.semFit,u:state.u,risk:state.risk,state:state,analysis:after});
}
function composeContinuation(text,count){
  count=Math.max(1,Math.min(6,count||4));
  var baseText=String(text||'').trim(), base=analyzeText(baseText), cmd=base.portal||portalCommand(base), items=[], seen={};
  var topic=pickMeaning(base.items||[],['core','bridge','neutral','detail'])||base.tokens[0]||'тема';
  var fact=pickMeaning(base.items||[],['detail','neutral','bridge','core'])||base.tokens[1]||topic;
  var bridge=pickBridgeWord(base)||'мост';
  var commandRun=executePortal(baseText,cmd,base);
  if(commandRun&&commandRun.added) addContinuationCandidate(items,seen,baseText,cmd.label||'портал',cmd.op||'orbit',commandRun.added,cmd.formula||'',cmd.verdict||'исполнить текущую портал-команду',0);
  if(base.graph&&base.graph.metrics&&base.graph.metrics.conflictCount){
    addContinuationCandidate(items,seen,baseText,'мост','↔','Связка: «'+topic+'» и «'+fact+'» сначала соединяются через «'+bridge+'»; после этого препятствие становится ходом, а не распадом.','bridge('+topic+','+fact+') -> continue && keep(0<u<1)','конфликт получает посредника перед продолжением',1);
  }
  addContinuationCandidate(items,seen,baseText,'ход','orbit','Продолжение: «'+topic+'» делает следующий шаг через «'+fact+'»; главный смысл остается тем же, но появляется одна новая деталь.','orbit('+topic+') -> next('+fact+') && keep(0<u<1)','средний путь между схлопыванием и распадом',2);
  addContinuationCandidate(items,seen,baseText,'пример','⇓','Пример: показать «'+topic+'» в одном действии: заметить «'+fact+'», выбрать следующий шаг и не потерять главную линию.','detail('+topic+') -> example && keep(core)','деталь возвращает радиус, когда смысл слишком сжат',3);
  addContinuationCandidate(items,seen,baseText,'тезис','⇑','Тезис: детали вокруг «'+topic+'» собираются в одну мысль: движение продолжается, потому что «'+fact+'» связано с общей темой.','synth('+fact+') -> core(+thesis) && bind(details)','обобщение связывает детали, но не стирает их',4);
  addContinuationCandidate(items,seen,baseText,'мантра','orbit','Круг идет. Кроха в ряд. Мост держит. Смысл живет.','chant(core,detail,bridge) -> rhythm && keep(0<u<1)','простая строка удерживает процесс как ритм',5);
  items.sort(function(a,b){return b.score-a.score || b.life-a.life || a.index-b.index;});
  for(var i=0;i<items.length;i++) items[i].rank=i+1;
  return {base:base,command:cmd,items:items.slice(0,count),best:items[0]||null,count:items.length,formula:'compose = argmax(next.life + move + g_link - risk - |u-0.5|)',mantra:'круг идет · кроха в ряд · мост держит · смысл живет'};
}

function backtrackProbeCandidates(baseText,analysis){
  analysis=analysis||analyzeText(baseText);
  var topic=pickMeaning(analysis.items||[],['core','bridge','neutral','detail'])||analysis.tokens[0]||'тема';
  var fact=pickMeaning(analysis.items||[],['detail','neutral','bridge','core'])||analysis.tokens[1]||topic;
  var bridge=pickBridgeWord(analysis)||'мост';
  var conflict=analysis.graph&&analysis.graph.conflicts&&analysis.graph.conflicts[0];
  var out=[
    {index:-3,label:'центр?',op:'⇑',line:'Проба центра: убрать все детали и оставить одно главное слово «'+topic+'»; движение остановится.',formula:'probe(center) -> guard',reason:'проверка запрещенного 3D-схлопывания',probe:true},
    {index:-2,label:'край?',op:'⇓',line:'Проба края: разбить «'+fact+'» на буквы, слоги, части, детали и факты без общего моста.',formula:'probe(edge) -> guard',reason:'проверка запрещенного 1D-распада',probe:true}
  ];
  if(conflict) out.push({index:-1,label:'разрыв?',op:'!',line:'Проба разрыва: оставить «'+conflict.a+'» и «'+conflict.b+'» рядом без моста «'+bridge+'»; шум спорит со смыслом.',formula:'probe(conflict) -> guard',reason:'проверка конфликта без посредника',probe:true});
  return out;
}
function backtrackRejectReason(guard){
  var zone=guard&&guard.zone||'safe';
  if(zone==='center') return 'откат: ветка схлопывает детали в 3D-центр';
  if(zone==='edge') return 'откат: ветка рассыпает смысл к 1D-краю';
  if(zone==='conflict') return 'откат: конфликт без моста рвет продолжение';
  if(zone==='stall') return 'откат: движение становится формальным';
  return 'ветка остается в живом 2D-кольце';
}
function backtrackAttempt(baseText,candidate,step,branch,beforeGuard){
  var line=String(candidate.line||candidate.added||'').trim();
  var text=candidate.text||appendPortalText(baseText,line).text;
  var after=analyzeText(text), guard=stabilityGuard(text), forcedProbe=null;
  if(candidate.probe){
    var probeLabel=String(candidate.label||'');
    forcedProbe=probeLabel.indexOf('центр')>=0?'center':probeLabel.indexOf('край')>=0?'edge':probeLabel.indexOf('разрыв')>=0?'conflict':null;
    if(forcedProbe){
      guard.zone=forcedProbe; guard.risk=forcedProbe; guard.score=Math.min(guard.score||0,.16);
      guard.u=forcedProbe==='center'?.08:forcedProbe==='edge'?.92:(guard.u==null?.5:guard.u);
      guard.verdict=forcedProbe==='center'?'запрещенная проба 3D-центра':forcedProbe==='edge'?'запрещенная проба 1D-края':'запрещенная проба разрыва без моста';
    }
  }
  var zone=guard.zone||'safe';
  var keep=zone==='safe'||zone==='thin';
  var middle=1-Math.min(1,Math.abs((guard.u==null?.5:guard.u)-.5)*2);
  var penalty=keep?0:zone==='conflict'?.34:.28;
  var score=Math.max(0,Math.min(1,(guard.score||0)*.62+(after.life||0)*.10+(after.move||0)*.10+middle*.18-penalty));
  return {step:step,branch:branch,label:candidate.label||'ход',op:candidate.op||'orbit',line:line,text:text,status:keep?'accept':'rollback',reason:backtrackRejectReason(guard),score:score,before:compactGuard(beforeGuard),after:compactGuard(guard),u:guard.u,zone:zone,risk:guard.risk,life:after.life,move:after.move,semFit:after.semFit,formula:candidate.formula||'',probe:!!candidate.probe};
}
function semanticBacktrack(text,depth,width){
  depth=Math.max(1,Math.min(5,depth||3)); width=Math.max(3,Math.min(8,width||5));
  var start=String(text||'').trim(), current=start, attempts=[], path=[], rejected=0;
  for(var step=1;step<=depth;step++){
    var before=analyzeText(current), beforeGuard=stabilityGuard(current), safeBefore=beforeGuard.zone==='safe'||beforeGuard.zone==='thin';
    var plan=safeBefore?composeContinuation(current,width):balanceRepair(current,width);
    var candidates=backtrackProbeCandidates(current,before).concat((plan&&plan.items)||[]).slice(0,width+3);
    var local=[], chosen=null;
    for(var i=0;i<candidates.length;i++){
      var a=backtrackAttempt(current,candidates[i],step,i+1,beforeGuard);
      local.push(a); attempts.push(a); if(a.status==='rollback') rejected++;
    }
    var keepers=local.filter(function(x){return x.status==='accept'&&x.text&&x.text!==current;});
    keepers.sort(function(a,b){return b.score-a.score || (a.probe?1:0)-(b.probe?1:0) || a.branch-b.branch;});
    chosen=keepers[0]||null;
    if(!chosen){
      var repair=balanceRepair(current,width), best=repair&&repair.best;
      if(best){
        chosen=backtrackAttempt(current,best,step,local.length+1,beforeGuard);
        chosen.status=(chosen.after.zone==='safe'||chosen.after.zone==='thin')?'accept':'rollback';
        attempts.push(chosen); if(chosen.status==='rollback') rejected++;
      }
    }
    if(!chosen||chosen.status!=='accept'||!chosen.text||chosen.text===current) break;
    chosen.chosen=true; path.push(chosen); current=chosen.text;
    if(step>=2 && chosen.score>.76) break;
  }
  var finalGuard=stabilityGuard(current), ok=finalGuard.zone==='safe'||finalGuard.zone==='thin';
  return {start:start,text:current,attempts:attempts,path:path,best:path[path.length-1]||null,count:attempts.length,rejected:rejected,accepted:path.length,formula:'backtrack = try(branch) -> guard; reject(center|edge|conflict) -> rollback; accept(0<u<1)',verdict:ok?'поиск нашел продолжение без выхода в крайности':'поиск остановлен: нужен новый мост или ремонт',metrics:{attempts:attempts.length,rejected:rejected,accepted:path.length,depth:path.length,guard:finalGuard.score,u:finalGuard.u,zone:finalGuard.zone}};
}


function semanticTargetFit(target,analysis){
  target=String(target||'').trim();
  if(!target) return {score:0,label:'гомеостаз',best:null,reason:'цель не задана: используется гомеостаз'};
  var targetItem=classify(target), best=null;
  for(var i=0;i<(analysis.items||[]).length;i++){
    var it=analysis.items[i], sim=similarity(targetItem,it), bonus=(targetItem.role===it.role&&targetItem.role!=='neutral')?.08:0, score=Math.max(0,Math.min(1,(sim.score||0)+bonus));
    if(!best||score>best.score) best={token:it.lemma||it.token,role:it.role,score:score,reason:(sim.fit&&sim.fit.reason)||''};
  }
  if(!best) best={token:'',role:'neutral',score:0,reason:'нет токенов для сравнения'};
  return {score:best.score,label:target,best:best,reason:best.reason};
}


function railActionLike(word){
  return /(ид|идет|идут|шел|шла|дела|делает|движ|продолж|связ|соедин|добав|выбер|выбира|станов|стало|откры|держ|переход|проход|встреч|столк|получ|появ|собира|разб|сжима|рассказыва|рассказать|пиш|поет|стро|реаг|меня|вед|замет|остав|учит|учится|беречь|спор|иск|найд|встав|провер)/i.test(String(word||''));
}
function railBridgeLike(word){
  return /^(и|но|а|через|между|к|ко|от|до|для|чтобы|если|затем|потом|после|перед|над|под|в|во|на|по|при|или)$|мост|связк|переход|след|дальше|ход|продолж/i.test(String(word||''));
}
function railPickDistinct(items,order,avoid){
  avoid=avoid||{};
  for(var o=0;o<order.length;o++){
    for(var i=0;i<(items||[]).length;i++){
      var it=items[i], val=it&&((it.lemma)||it.token);
      if(!val||avoid[val]) continue;
      if((it.role||'neutral')===order[o]) return val;
    }
  }
  for(var j=0;j<(items||[]).length;j++){
    var x=(items[j]&&((items[j].lemma)||items[j].token));
    if(x&&!avoid[x]) return x;
  }
  return '';
}
function semanticRails(text){
  var source=String(text||'').trim(), analysis=analyzeText(source), guard=stabilityGuard(source), items=analysis.items||[], tokens=analysis.tokens||[];
  var languageApi=global.MRDSemanticLanguage, language=languageApi&&typeof languageApi.analyze==='function'?languageApi.analyze(source):null, grammar=language&&language.grammar||null;
  var theme='', action='', bridge='', detail='', actionIndex=-1, bridgeIndex=-1, detailIndex=-1;
  for(var i=0;i<items.length;i++){
    var it=items[i], val=it.lemma||it.token||tokens[i]||'';
    if(!theme && !railActionLike(it.token||val) && !railBridgeLike(it.token||val) && val!=='мост') theme=val;
    if(!action && railActionLike(it.token||val)){ action=val; actionIndex=i; }
    if(!bridge && railBridgeLike(it.token||val)){ bridge=val; bridgeIndex=i; }
    if(!detail && it.role==='detail'){ detail=val; detailIndex=i; }
  }
  if(!theme) theme=railPickDistinct(items,['core','neutral','detail','bridge'],{});
  if(!bridge) bridge=pickBridgeWord(analysis)||'мост';
  if(!detail) detail=railPickDistinct(items,['detail','neutral','core','bridge'],(theme?Object.fromEntries([[theme,1]]):{}))||theme||'деталь';
  if(detail===theme||detail===bridge){ var avoid={}; avoid[theme]=1; avoid[bridge]=1; detail=railPickDistinct(items,['detail','neutral','core','bridge'],avoid)||'деталь'; }
  var hasTheme=!!theme, hasAction=!!action, hasBridge=!!bridge&&(bridge!=='мост'||/мост|через|связ|между|след|дальше|ход|продолж/i.test(source)), hasDetail=!!detail&&detail!==theme;
  var explicitOpen=/продолж|след|дальше|потом|затем|откры|ход|можно|чтобы|после/i.test(source), openScore=explicitOpen?1:(tokens.length>=6?.62:tokens.length>=3?.38:.18);
  var skeleton=(hasTheme?.20:0)+(hasAction?.24:0)+(hasBridge?.18:0)+(hasDetail?.20:0)+openScore*.18;
  var guardGate=(guard.zone==='safe'||guard.zone==='thin')?1:.55;
  var grammarGate=!grammar||grammar.status==='UNKNOWN'?1:(grammar.status==='CONFLICT'?.45:(grammar.status==='OPEN'?.88:1));
  var score=Math.max(0,Math.min(1,skeleton*guardGate*grammarGate));
  var status='complete';
  if(!tokens.length) status='empty';
  else if(!(guard.zone==='safe'||guard.zone==='thin')) status='repair';
  else if(grammar&&grammar.status==='CONFLICT') status='need_grammar';
  else if(!hasAction) status='need_action';
  else if(!hasBridge) status='need_bridge';
  else if(!hasDetail) status='need_detail';
  else if(openScore<.5) status='need_open';
  else if(score<.72) status='thin';
  var verb=action||'делает ход';
  var insertLine='';
  if(status==='empty') insertLine='Рельсы: назвать тему, дать ей действие, провести через мост к одной детали и оставить следующий ход.';
  else if(status==='repair') insertLine='Рельсы: сначала поставить связку: «'+theme+'» делает ход через «'+bridge+'» к «'+detail+'», не выходя из 0<u<1.';
  else if(status==='need_grammar') insertLine='Рельсы: уточнить согласование или управление слов, затем провести «'+theme+'» через «'+bridge+'» к «'+detail+'».';
  else if(status==='need_action') insertLine='Рельсы: «'+theme+'» делает один ход через «'+bridge+'» к «'+detail+'»; фраза получает действие.';
  else if(status==='need_bridge') insertLine='Рельсы: связать «'+theme+'» и «'+detail+'» через «'+bridge+'», чтобы фраза не прыгала без перехода.';
  else if(status==='need_detail') insertLine='Рельсы: к «'+theme+'» добавить одну деталь «'+detail+'» через «'+bridge+'» и оставить следующий ход.';
  else if(status==='need_open') insertLine='Рельсы: после «'+theme+'» оставить открытый следующий ход через «'+bridge+'» к «'+detail+'».';
  else insertLine='Рельсы: «'+theme+'» → «'+verb+'» → «'+bridge+'» → «'+detail+'»; следующий ход открыт.';
  var slots=[
    {label:'тема',value:theme||'нет темы',score:hasTheme?1:0,u:.34,kind:hasTheme?'accept':'missing'},
    {label:'действие',value:action||'нет действия',score:hasAction?1:0,u:.45,kind:hasAction?'accept':'missing'},
    {label:'мост',value:bridge||'нет связки',score:hasBridge?1:.35,u:.54,kind:hasBridge?'accept':'missing'},
    {label:'деталь',value:detail||'нет детали',score:hasDetail?1:0,u:.68,kind:hasDetail?'accept':'missing'},
    {label:'дальше',value:explicitOpen?'следующий ход открыт':'нужен открытый ход',score:openScore,u:.58,kind:openScore>=.5?'accept':'missing'},
    {label:'грамматика',value:grammar?grammar.status:'UNAVAILABLE',score:grammar?grammar.score:0,u:.50,kind:grammar&&grammar.status==='CONFLICT'?'missing':'accept'}
  ];
  return {status:status,score:score,action:status==='complete'?'фразовый скелет держится':status==='thin'?'рельсы слабые, но читаемые':status==='need_grammar'?'нужны согласованные формы и управление':'нужен ремонт фразового скелета',insertLine:insertLine,formula:'rails = grammar + theme + action + bridge + detail + open_next',metrics:{theme:hasTheme?1:0,action:hasAction?1:0,bridge:hasBridge?1:0,detail:hasDetail?1:0,open:openScore,grammar:grammar?grammar.score:0,skeleton:skeleton,score:score,guard:guard.score||0},slots:slots,theme:theme,verb:verb,bridge:bridge,detail:detail,index:{action:actionIndex,bridge:bridgeIndex,detail:detailIndex},guard:guard,language:language,grammar:grammar};
}

function semanticPhi(text){
  var source=String(text||'').trim(), analysis=analyzeText(source), guard=stabilityGuard(source), gm=analysis.graph&&analysis.graph.metrics?analysis.graph.metrics:{};
  var tokens=analysis.tokens||[], n=Math.max(1,tokens.length), seen={}, unique=0, roles={core:0,detail:0,bridge:0,neutral:0};
  for(var i=0;i<tokens.length;i++){ var key=(analysis.items[i]&&analysis.items[i].lemma)||tokens[i]; if(!seen[key]){seen[key]=1; unique++;} roles[analysis.roles[i]||'neutral']=1; }
  var roleSpan=(roles.core+roles.detail+roles.bridge+roles.neutral)/4, repetition=Math.max(0,1-unique/n);
  var back=semanticBacktrack(source,2,5), traj=semanticTrajectory(source,3), steps=traj.steps||[];
  var accepted=(back.metrics&&back.metrics.accepted)||0, rejected=(back.metrics&&back.metrics.rejected)||0, pathScore=accepted/Math.max(1,accepted+rejected);
  var trajScore=0; for(var t=0;t<steps.length;t++) trajScore+=steps[t].score||0; trajScore=steps.length?trajScore/steps.length:0;
  var conflicts=gm.conflictCount||0, u=guard.u||.5, middle=4*u*(1-u);
  var growth=Math.max(0,Math.min(1,(analysis.life||0)*.28+(analysis.move||0)*.22+(analysis.semFit||0)*.18+Math.max(0,gm.gLink||0)*.18+roleSpan*.14-conflicts*.12));
  var novelty=Math.max(0,Math.min(1,(unique/n)*.70+roleSpan*.20+Math.min(1,n/12)*.10-repetition*.18));
  var openness=Math.max(0,Math.min(1,pathScore*.30+trajScore*.24+(analysis.move||0)*.22+Math.max(0,gm.gLink||0)*.14+(steps.length?.10:0)-conflicts*.10));
  var balance=Math.max(0,Math.min(1,(guard.score||0)*.62+middle*.38));
  var raw=growth*novelty*openness*balance, phi=Math.sqrt(Math.max(0,raw));
  var status='continue';
  if(!(guard.zone==='safe'||guard.zone==='thin')) status='repair';
  else if(novelty<.35) status='repeat';
  else if(openness<.35) status='closed';
  else if(growth<.35) status='stall';
  else if(phi>=.72) status='alive';
  var topic=pickMeaning(analysis.items||[],['core','bridge','neutral','detail'])||analysis.tokens[0]||'тема';
  var fact=pickMeaning(analysis.items||[],['detail','neutral','bridge','core'])||analysis.tokens[1]||topic;
  var bridge=pickBridgeWord(analysis)||'мост';
  if(bridge===topic||bridge===fact) bridge='мост';
  if(fact===topic||fact===bridge){
    for(var fi=0;fi<(analysis.items||[]).length;fi++){
      var cand=(analysis.items[fi]&&analysis.items[fi].lemma)||analysis.tokens[fi];
      if(cand&&cand!==topic&&cand!==bridge){ fact=cand; break; }
    }
  }
  var action=status==='repair'?'сначала убрать крайность или разрыв':status==='repeat'?'добавить новую связную кроху':status==='closed'?'открыть следующий ход':status==='stall'?'усилить рост содержания':status==='alive'?'живое продолжение удержано':'продолжать до роста Φ';
  var insertLine='';
  if(status==='repair'){
    var goal=semanticGoal(source,''); insertLine=(goal&&goal.insertLine)?goal.insertLine:'Φ-ремонт: Связка: «'+topic+'» и «'+fact+'» не сталкиваются напрямую; через «'+bridge+'» появляется следующий ход.';
  }else if(status==='repeat') insertLine='Φ-новизна: к «'+topic+'» добавить одну новую кроху «'+fact+'» и связать её через «'+bridge+'», чтобы круг не стал повтором.';
  else if(status==='closed') insertLine='Φ-открытость: после «'+topic+'» оставить следующий ход через «'+bridge+'» к «'+fact+'», не ставя финальную точку.';
  else if(status==='stall') insertLine='Φ-рост: «'+topic+'» получает новую связную деталь «'+fact+'» через «'+bridge+'», и смысл делает следующий шаг.';
  else insertLine='Φ-живое продолжение: «'+topic+'» движется через «'+bridge+'» к «'+fact+'»; рост, новизна и открытость остаются в кольце.';
  var axes=[
    {label:'рост',value:'связное новое содержание',score:growth,u:.42,kind:growth<.35?'stall':'accept'},
    {label:'новизна',value:unique+'/'+n+' без повтора',score:novelty,u:.58,kind:novelty<.35?'repeat':'accept'},
    {label:'κ open',value:accepted+' ok / '+rejected+' no',score:openness,u:(back.metrics&&back.metrics.u)||.55,kind:openness<.35?'closed':'accept'},
    {label:'баланс',value:(guard.zone||'safe')+' · 0<u<1',score:balance,u:u,kind:(guard.zone==='safe'||guard.zone==='thin')?'accept':'repair'}
  ];
  return {status:status,score:phi,raw:raw,action:action,insertLine:insertLine,formula:'Φ = sqrt(growth × novelty × openness × balance)',metrics:{growth:growth,novelty:novelty,openness:openness,balance:balance,phi:phi,raw:raw,repetition:repetition,u:u,conflicts:conflicts,accepted:accepted,rejected:rejected},axes:axes,backtrack:back,trajectory:traj,guard:guard};
}

function semanticGoal(text,target){
  var source=String(text||'').trim(), analysis=analyzeText(source), guard=stabilityGuard(source), back=semanticBacktrack(source,2,5), gm=analysis.graph&&analysis.graph.metrics?analysis.graph.metrics:{};
  var targetPack=semanticTargetFit(target,analysis), accepted=(back.metrics&&back.metrics.accepted)||0, rejected=(back.metrics&&back.metrics.rejected)||0;
  var pathScore=accepted/Math.max(1,accepted+rejected), conflictPenalty=(gm.conflictCount||0)*.12;
  var homeostasis=Math.max(0,Math.min(1,(guard.score||0)*.38+pathScore*.22+(analysis.life||0)*.16+(analysis.move||0)*.10+(gm.gLink||0)*.08+(analysis.semFit||0)*.06-conflictPenalty));
  var targetScore=targetPack.score||0, score=target?Math.max(0,Math.min(1,homeostasis*.72+targetScore*.28)):homeostasis;
  var status='continue';
  if(!(guard.zone==='safe'||guard.zone==='thin')) status='repair';
  else if(target&&targetScore>=.68&&score>=.62) status='target';
  else if(score>=.72&&accepted>0) status='homeostasis';
  var topic=pickMeaning(analysis.items||[],['core','bridge','neutral','detail'])||analysis.tokens[0]||'тема';
  var fact=pickMeaning(analysis.items||[],['detail','neutral','bridge','core'])||analysis.tokens[1]||topic;
  var bridge=pickBridgeWord(analysis)||'мост';
  var action=status==='repair'?'сначала ремонт или откат':status==='target'?'мишень достаточно близко: закрепить ход':status==='homeostasis'?'гомеостаз достигнут: продолжать из устойчивой орбиты':'продолжать, пока гомеостаз не закреплен';
  var repair=balanceRepair(source,3), portalRun=executePortal(source,analysis.portal||portalCommand(analysis),analysis);
  var insertLine='';
  if(status==='repair'){
    if(portalRun&&portalRun.added) insertLine='Цель-гомеостаз: '+portalRun.added;
    else if(repair&&repair.best&&repair.best.line) insertLine='Цель-гомеостаз: '+repair.best.line;
    else if(back.best) insertLine='Цель-гомеостаз: перед ответом нужен откат; '+(back.best.line||'поставить мост и удержать 0<u<1.');
    else insertLine='Цель-гомеостаз: Связка: «'+topic+'» и «'+fact+'» не сталкиваются напрямую; через «'+bridge+'» конфликт становится следующим ходом.';
  }
  else if(status==='target') insertLine='Цель-гомеостаз: «'+topic+'» приблизился к мишени «'+targetPack.label+'» через «'+bridge+'»; можно закрепить вывод и оставить движение открытым.';
  else if(status==='homeostasis') insertLine='Цель-гомеостаз: «'+topic+'» удерживается в живом кольце через «'+fact+'»; это не финальная точка, а устойчивое продолжение.';
  else insertLine='Цель-гомеостаз: продолжить «'+topic+'» через «'+bridge+'» к «'+fact+'», пока guard, мост и новизна не станут устойчивыми.';
  var steps=[
    {label:'guard',value:guard.zone||'safe',score:guard.score||0,u:guard.u||.5,kind:(guard.zone==='safe'||guard.zone==='thin')?'accept':'rollback'},
    {label:'откат',value:accepted+' ok / '+rejected+' no',score:pathScore,u:(back.metrics&&back.metrics.u)||.5,kind:pathScore>.34?'accept':'rollback'},
    {label:target?'мишень':'гомео',value:target?((targetPack.best&&targetPack.best.token)||target):'0<u<1',score:target?targetScore:homeostasis,u:target?Math.max(.18,Math.min(.82,.5+(targetScore-.5)*.32)):.5,kind:(target?targetScore>.48:homeostasis>.62)?'accept':'continue'},
    {label:'итог',value:status,score:score,u:guard.u||.5,kind:status}
  ];
  return {target:targetPack,status:status,score:score,homeostasis:homeostasis,action:action,insertLine:insertLine,formula:'goal = homeostasis(guard + accepted_path + life + bridge) + optional targetFit',metrics:{guard:guard.score||0,path:pathScore,target:targetScore,homeostasis:homeostasis,score:score,accepted:accepted,rejected:rejected,u:guard.u||.5,conflicts:gm.conflictCount||0},steps:steps,backtrack:back,guard:guard};
}

function traceScore(analysis,state){
  var gm=analysis&&analysis.graph&&analysis.graph.metrics?analysis.graph.metrics:{};
  var riskPenalty=state&&state.risk==='ok'?0:state&&state.risk==='conflict'?.26:.14;
  return Math.max(0,Math.min(1,((analysis&&analysis.life)||0)+Math.max(0,gm.gLink||0)*.18+Math.max(0,(analysis&&analysis.move)||0)*.12-riskPenalty-Math.abs(((state&&state.u)!=null?state.u:.5)-.5)*.35));
}
function semanticTrace(text){
  var analysis=analyzeText(text), graph=analysis.graph||semanticGraph(analysis,36), cmd=analysis.portal||portalCommand(analysis), state=orbitState(analysis);
  var topic=pickMeaning(analysis.items||[],['core','neutral','bridge','detail'])||analysis.tokens[0]||'тема';
  var bridge=pickMeaning(analysis.items||[],['bridge','neutral','core','detail'])||pickBridgeWord(analysis)||'мост';
  if(bridge===topic){ bridge='мост'; for(var bi=0;bi<(analysis.items||[]).length;bi++) if(analysis.items[bi].role==='bridge' && analysis.items[bi].lemma!==topic){ bridge=analysis.items[bi].lemma; break; } }
  var fact=pickMeaning(analysis.items||[],['detail','neutral','bridge','core'])||analysis.tokens[1]||topic;
  if(fact===topic) for(var fi=0;fi<(analysis.items||[]).length;fi++) if(analysis.items[fi].role==='detail' && analysis.items[fi].lemma!==topic){ fact=analysis.items[fi].lemma; break; }
  var plan=composeContinuation(text,3), best=plan.best;
  var nodes=[
    {kind:'core',label:topic,role:'core',note:'что удерживаем'},
    {kind:'bridge',label:bridge,role:'bridge',note:'чем связываем'},
    {kind:'detail',label:fact,role:'detail',note:'через какую кроху идем'},
    {kind:'op',label:(cmd.op||'orbit')+' '+(cmd.label||'ход'),role:'bridge',note:'какая операция'},
    {kind:'next',label:best?(best.label||'следующий ход'):'следующий ход',role:'bridge',note:best?(best.line||''):'продолжить'}
  ];
  var edges=[];
  for(var i=1;i<nodes.length;i++){
    var a=nodes[i-1], b=nodes[i], sim=(i<3)?similarity(a.label,b.label):{score:(i===3?analysis.semFit:best?best.score:analysis.life),fit:{reason:i===3?(cmd.formula||'операция удерживает путь'):'лучший следующий ход'}};
    edges.push({from:a.label,to:b.label,score:Math.max(0,Math.min(1,sim.score||0)),reason:(sim.fit&&sim.fit.reason)||''});
  }
  var conflict=graph.conflicts&&graph.conflicts[0], gap=null;
  for(var gi=0;graph.gaps&&gi<graph.gaps.length;gi++){ if(graph.gaps[gi].a!==graph.gaps[gi].b){ gap=graph.gaps[gi]; break; } }
  var why=conflict?'разрыв найден: '+conflict.a+' ↔ '+conflict.b+'; нужен мост':gap?'найден дальний мост: '+gap.a+' ↔ '+gap.b:'жесткого разрыва нет; можно продолжать по кольцу';
  return {nodes:nodes,edges:edges,score:traceScore(analysis,state),state:state,formula:'trace = core -> bridge -> detail -> op -> next',why:why,command:cmd,best:best,metrics:{life:analysis.life,move:analysis.move,semFit:analysis.semFit,gLink:(graph.metrics&&graph.metrics.gLink)||0,lca:(graph.metrics&&graph.metrics.lcaAvg)||0,conflicts:(graph.metrics&&graph.metrics.conflictCount)||0}};
}
function nextMove(analysis){
  if(!analysis||!analysis.tokens||!analysis.tokens.length) return {text:'дальше: внесите условие, и система построит следующий ход.',html:'<b>дальше:</b> внесите условие, и система построит следующий ход.'};
  var topic=pickMeaning(analysis.items,['core','bridge','neutral','detail'])||analysis.tokens[0];
  var fact=pickMeaning(analysis.items,['detail','neutral','bridge','core'])||analysis.tokens[1]||topic;
  var move=actionVerb(pick(analysis.items,'bridge',true)||pick(analysis.items,'bridge',false));
  var advice=analysis.conflicts&&analysis.conflicts.length?'сначала поставить мост между конфликтующими словами':analysis.core>.46&&analysis.edge<.22?'добавить конкретную деталь':analysis.edge>.46&&analysis.core<.22?'собрать детали в общий смысл':analysis.move<.25?'добавить мост продолжения':'удержать движение между смыслом и деталями';
  if(analysis.core>.46&&analysis.edge<.22&&fact===topic) fact='конкретный пример';
  var text='дальше: '+move+' тему «'+topic+'»: через «'+fact+'», '+advice+'.';
  return {text:text,html:'<b>дальше:</b> '+move+' тему «'+topic+'»: через «'+fact+'», '+advice+'.'};
}
function findGaps(words,linked,threshold){
  words=(words||[]).map(function(w){return typeof w==='string'?classify(w):w;}); linked=linked||{}; threshold = threshold == null ? .35 : threshold;
  var gaps=[];
  for(var i=0;i<words.length;i++) for(var j=i+1;j<words.length;j++){
    var a=words[i],b=words[j],key=[a.lemma,b.lemma].sort().join('|'); if(linked[key]) continue;
    var s=similarity(a,b); if(s.score>=threshold) gaps.push({a:a,b:b,score:s.score,detail:s});
  }
  gaps.sort(function(x,y){return y.score-x.score;}); return gaps;
}
function lexicon(){return LEX.map(function(a){return entry(a);});}

global.MRDSemanticCore={version:'1.10.0',dimensions:DIMENSIONS,tokenize:tokenize,normalize:normalize,lookup:lookup,classify:classify,analyzeText:analyzeText,nextMove:nextMove,forecast:forecast,analyzeImpulse:analyzeImpulse,rankImpulses:rankImpulses,composeContinuation:composeContinuation,semanticTrace:semanticTrace,stabilityGuard:stabilityGuard,balanceRepair:balanceRepair,semanticTrajectory:semanticTrajectory,semanticArchipelago:semanticArchipelago,semanticWeave:semanticWeave,semanticWindowRhythm:semanticWindowRhythm,semanticBacktrack:semanticBacktrack,semanticGoal:semanticGoal,semanticRails:semanticRails,semanticPhi:semanticPhi,similarity:similarity,semFit:semFit,semanticGraph:semanticGraph,portalCommand:portalCommand,executePortal:executePortal,parseFormula:parseFormula,lcaDepth:lcaDepth,pathSimilarity:pathSimilarity,canCompute:canCompute,findGaps:findGaps,lexicon:lexicon,hash:hash};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));