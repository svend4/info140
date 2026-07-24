(function(global){
'use strict';
var VERSION='1.4.0';
var FORMULA='decision = language occurrences -> compare(structural + bounded local corpus) -> verify(grammar + ring) -> compose -> prepare(READY) -> commit|rollback; truth = NOT_COMPUTED';
var FUNCTION_WORDS={и:1,а:1,но:1,на:1,у:1,о:1,об:1,в:1,во:1,к:1,ко:1,с:1,со:1,по:1,из:1,за:1,для:1,это:1,как:1,что:1,то:1,он:1,она:1,они:1,мы:1,вы:1,я:1,или:1,если:1,же:1,ли:1,бы:1,его:1,ее:1,их:1,все:1,всё:1};
var NEGATIONS={не:1,нет:1,ни:1,без:1,нельзя:1,никогда:1};
var OPERATORS=[
  {id:'continue',direction:'orbit',stems:['продолж','дальш','следующ','развив','переход']},
  {id:'generalize',direction:'generalize',stems:['обобщ','сжать','сжим','сверн','итог','тезис','синтез','собрать']},
  {id:'detail',direction:'detail',stems:['разб','уточ','детал','слог','букв','расщеп','дефраг']}
];
function core(){ return global.MRDSemanticCore||null; }
function language(){ return global.MRDSemanticLanguage||null; }
function protocol(){ return global.MRDContinuationProtocol||null; }
function evaluator(){ return global.MRDSemanticBranchEvaluator||null; }
function commandDsl(){ return global.MRDSemanticCommandDSL||null; }
function transactionEngine(){ return global.MRDSemanticTransaction||null; }
function clamp01(value){ value=Number(value); return isFinite(value)?Math.max(0,Math.min(1,value)):0; }
function normalize(value){ return String(value||'').toLowerCase().replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi,''); }
function hasStem(word,stems){
  for(var i=0;i<(stems||[]).length;i++) if(word.indexOf(stems[i])>=0) return true;
  return false;
}
function unique(values){
  var out=[], seen={};
  for(var i=0;i<(values||[]).length;i++){
    var value=String(values[i]||'').toLowerCase();
    if(!value||seen[value]) continue;
    seen[value]=1; out.push(value);
  }
  return out;
}
function rawOccurrences(text){
  var source=String(text||''), regex=/[A-Za-zА-Яа-яЁё0-9]+/g, out=[], match, last=0, sentence=0;
  while((match=regex.exec(source))){
    var gap=source.slice(last,match.index), boundaries=gap.match(/[.!?]+/g);
    if(boundaries) sentence+=boundaries.length;
    out.push({raw:match[0],token:normalize(match[0]),index:out.length,offset:match.index,sentence:sentence});
    last=regex.lastIndex;
  }
  return out;
}
function matchOccurrence(c,occurrence){
  var entry=c&&c.lookup?c.lookup(occurrence.token):null, kind='oov';
  if(entry){
    if(occurrence.token===entry.lemma) kind='exact';
    else if((entry.aliases||[]).indexOf(occurrence.token)>=0) kind='alias';
    else kind='stem';
  }
  occurrence.match=kind;
  occurrence.lemma=entry?entry.lemma:occurrence.token;
  occurrence.role=entry?entry.role:'neutral';
  occurrence.scale=entry?entry.scale:null;
  return occurrence;
}
function operatorOf(word){
  for(var i=0;i<OPERATORS.length;i++) if(hasStem(word,OPERATORS[i].stems)) return OPERATORS[i];
  return null;
}
function detectOperators(occurrences){
  var out=[];
  for(var i=0;i<occurrences.length;i++){
    var spec=operatorOf(occurrences[i].token);
    if(!spec) continue;
    var negation=null;
    for(var j=i-1;j>=0&&j>=i-2;j--){
      if(occurrences[j].sentence!==occurrences[i].sentence) break;
      if(NEGATIONS[occurrences[j].token]){ negation=occurrences[j].token; break; }
    }
    out.push({id:spec.id,direction:spec.direction,token:occurrences[i].token,index:i,negated:!!negation,negation:negation});
  }
  return out;
}
function fallbackAmbiguities(c,occurrences){
  var out=[];
  for(var i=0;i<occurrences.length;i++){
    var entry=c&&c.lookup?c.lookup(occurrences[i].token):null;
    if(!entry||(entry.tags||[]).indexOf('polysemy')<0) continue;
    out.push({token:occurrences[i].token,lemma:entry.lemma,index:i,resolved:false,senseId:null,confidence:0,candidates:[],code:'LANGUAGE_ANALYZER_UNAVAILABLE'});
  }
  return out;
}
function interpret(text){
  var c=core(), l=language(), source=String(text||''), languagePack=l&&typeof l.analyze==='function'?l.analyze(source):null;
  var occurrences=languagePack&&languagePack.occurrences?languagePack.occurrences:rawOccurrences(source);
  if(!languagePack) for(var i=0;i<occurrences.length;i++) matchOccurrence(c,occurrences[i]);
  var content=occurrences.filter(function(item){return item.token.length>=2&&!(item.functionWord||FUNCTION_WORDS[item.token])&&!NEGATIONS[item.token];});
  var recognized=content.filter(function(item){return item.match!=='oov';});
  var operators=detectOperators(occurrences), ambiguities=languagePack?languagePack.ambiguities:fallbackAmbiguities(c,occurrences), provenance=languagePack?languagePack.provenance:{exact:0,alias:0,stem:0,oov:0};
  if(!languagePack) occurrences.forEach(function(item){provenance[item.match]=(provenance[item.match]||0)+1;});
  var positiveOperators=operators.filter(function(item){return !item.negated;}), negatedOperators=operators.filter(function(item){return item.negated;});
  return {
    version:VERSION,text:source,occurrences:occurrences,contentCount:content.length,recognizedCount:recognized.length,
    coverage:languagePack?languagePack.coverage:(content.length?recognized.length/content.length:0),operators:operators,
    positiveOperators:positiveOperators,negatedOperators:negatedOperators,
    blockedDirections:unique(negatedOperators.map(function(item){return item.direction;})),
    ambiguities:ambiguities||[],provenance:provenance,
    grammar:languagePack&&languagePack.grammar||{status:'UNAVAILABLE',score:0,checks:[],failures:[],openValencies:[],evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'},
    language:languagePack,
    occurrenceHash:languagePack?languagePack.occurrenceHash:(c&&c.hash?c.hash(occurrences.map(function(item){return item.token;}).join('|')):0)
  };
}
function concepts(analysis){
  var out=[], items=analysis&&analysis.items||[];
  for(var i=0;i<items.length;i++) if(items[i]&&items[i].role!=='neutral') out.push(items[i].lemma||items[i].token);
  return unique(out);
}
function sharedScore(left,right){
  left=unique(left); right=unique(right);
  var map={}, shared=0;
  for(var i=0;i<left.length;i++) map[left[i]]=1;
  for(i=0;i<right.length;i++) if(map[right[i]]) shared++;
  return left.length?clamp01(shared/Math.min(3,left.length)):0;
}
function appendText(source,line){
  source=String(source||'').trim(); line=String(line||'').trim();
  return source?(line?source+'\n'+line:source):line;
}
function verify(source,candidate,target,interpretation,dataAssessment){
  var c=core(), line=String(candidate||'').trim(), input=String(source||'').trim();
  interpretation=interpretation||interpret(input);
  if(!c||!line) return {evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED',checks:[],witness:'no-candidate'};
  var before=c.analyzeText(input), lineAnalysis=c.analyzeText(line), afterText=appendText(input,line), after=c.analyzeText(afterText), guard=c.stabilityGuard(afterText);
  var l=language(), afterLanguage=l&&typeof l.analyze==='function'?l.analyze(afterText):null, grammar=afterLanguage&&afterLanguage.grammar||null;
  var beforeConcepts=concepts(before), lineConcepts=concepts(lineAnalysis), theme=sharedScore(beforeConcepts.length?beforeConcepts:before.tokens,lineConcepts.length?lineConcepts:lineAnalysis.tokens);
  var sourceTokens=unique(before.tokens), lineTokens=unique(lineAnalysis.tokens), sourceMap={}, newWords=0;
  sourceTokens.forEach(function(word){sourceMap[word]=1;});
  lineTokens.forEach(function(word){if(!sourceMap[word]) newWords++;});
  var negationOk=interpretation.negatedOperators.length===0||interpretation.positiveOperators.some(function(item){return interpretation.blockedDirections.indexOf(item.direction)<0;});
  var checks=[
    {id:'coverage',ok:interpretation.coverage>=.30,value:interpretation.coverage},
    {id:'negation',ok:negationOk,value:negationOk?1:0},
    {id:'candidate',ok:lineTokens.length>=4,value:clamp01(lineTokens.length/8)},
    {id:'grammar',ok:!grammar||grammar.status!=='CONFLICT',value:grammar?clamp01(grammar.score):0,required:!!grammar,status:grammar&&grammar.status||'UNAVAILABLE'},
    {id:'open_ring',ok:guard&&guard.u>.18&&guard.u<.82&&(guard.zone==='safe'||guard.zone==='thin'),value:guard?guard.score:0},
    {id:'theme',ok:theme>=.20,value:theme},
    {id:'newness',ok:newWords>=2,value:clamp01(newWords/4)}
  ];
  if(dataAssessment) checks.push({id:'data_support',ok:dataAssessment.status==='READY',value:dataAssessment.status==='READY'?clamp01(dataAssessment.score):0,required:false,status:dataAssessment.status,code:dataAssessment.code||null});
  var structural=checks.filter(function(item){return item.required!==false;}).every(function(item){return item.ok;});

  var targetPack=target&&c.semanticGoal?c.semanticGoal(afterText,String(target)):null;
  return {
    evidenceLevel:structural?'STRUCTURAL':'UNVERIFIED',soundness:'NOT_COMPUTED',checks:checks,
    witness:'#'+String(c.hash?c.hash(input+'|'+line+'|'+String(target||'')):0),
    metrics:{guard:guard&&guard.score||0,u:guard&&guard.u||.5,theme:theme,newness:clamp01(newWords/4),target:targetPack&&targetPack.score||0,grammar:grammar?clamp01(grammar.score):0,data:dataAssessment&&dataAssessment.status==='READY'?clamp01(dataAssessment.score):0},
    language:afterLanguage,
    data:dataAssessment||null,
    afterText:afterText
  };
}
function typedDescriptor(id,inputPort,outputPort,contract){
  return {
    ok:true,kind:'TypedCommandDescriptor',id:id,inputPort:inputPort,outputPort:outputPort,
    contract:contract,evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED'
  };
}
function typedProgram(decision,best,verification,candidate,interpretation,reasons){
  var dsl=commandDsl(), path='ID -> STATE -> EFFECT -> STATE', direction=best&&best.id||'orbit';
  if(decision!=='apply') return {
    ok:false,status:'gated',direction:null,portPath:path,stages:[],composition:null,
    errors:(reasons||[]).map(function(code){return {code:code,phase:'decision'};}),
    evidence:'UNVERIFIED',evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'
  };
  if(!dsl||typeof dsl.compose!=='function') return {
    ok:false,status:'unavailable',direction:direction,portPath:path,stages:[],composition:null,
    errors:[{code:'DSL_UNAVAILABLE',phase:'compose'}],evidence:'UNVERIFIED',evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'
  };
  var coverage=Number(interpretation&&interpretation.coverage||0).toFixed(2), witness=verification&&verification.witness||'no-witness';
  var stages=[
    typedDescriptor('interpret','ID','STATE',{
      pre:'coverage '+coverage+' >= 0.30; negation, contextual sense and grammar gates passed',
      inv:'token order, repetitions, provenance and negation scope are preserved',
      post:'typed semantic STATE is available for branch selection',
      proof:'interpretation structure only; truth was not computed'
    }),
    typedDescriptor(direction,'STATE','EFFECT',{
      pre:'selected branch '+direction+' has status accept',
      inv:'forbidden directions remain blocked and no implicit type cast is allowed',
      post:'one declarative continuation EFFECT is selected',
      proof:'three-branch comparison and guard repair trace only'
    }),
    typedDescriptor('commit','EFFECT','STATE',{
      pre:'candidate effect contains a non-empty continuation line',
      inv:'0.18 < u < 0.82; theme and source text remain observable',
      post:'candidate yields the next semantic STATE without center or edge collapse',
      proof:(verification&&verification.evidenceLevel||'UNVERIFIED')+' '+witness+'; mathematical truth was not computed'
    })
  ];
  var first=dsl.compose(stages[0],stages[1]), composed=first&&first.ok?dsl.compose(first,stages[2]):first;
  composed=composed||{ok:false,errors:[{code:'DSL_EMPTY_COMPOSITION',phase:'compose'}]};
  return {
    ok:!!composed.ok,status:composed.ok?'composed':'blocked',direction:direction,portPath:path,
    stages:stages,composition:composed,contract:composed.ok?composed.contract:null,
    errors:composed.errors||[],candidate:candidate,
    evidence:composed.ok?'STRUCTURAL':'UNVERIFIED',evidenceLevel:composed.ok?'STRUCTURAL':'UNVERIFIED',soundness:'NOT_COMPUTED'
  };
}
function reasonSummary(decision,reasons,interpretation){
  if(decision==='clarify'){
    if(reasons.indexOf('low_coverage')>=0) return 'Недостаточно распознанного смысла: система воздерживается и просит уточнение.';
    if(reasons.indexOf('ambiguous_sense')>=0) return 'Значение слова неоднозначно: нужно уточнить контекст перед продолжением.';
    if(reasons.indexOf('grammar_conflict')>=0) return 'Формы слов или управление конфликтуют: система просит уточнить фразу, а не угадывает исправление.';
    return 'Недостаточно материала для предсказуемой реакции.';
  }
  if(decision==='reject'){
    if(reasons.indexOf('negated_operator')>=0) return 'Команда содержит отрицание: противоположное действие не выполняется.';
    if(reasons.indexOf('contract_composition_failed')>=0) return 'Типизированные порты команды несовместимы: изменение текста заблокировано.';
    if(reasons.indexOf('transaction_not_ready')>=0) return 'Транзакция не прошла pre/inv/post: изменение текста заблокировано до нового расчета.';
    return 'Безопасная ветвь не найдена; действие отклонено.';
  }
  return 'Вход распознан, безопасная ветвь выбрана, доказательность ограничена структурной проверкой.';
}
function decide(text,target){
  var source=String(text||'').trim(), targetText=String(target||'').trim(), interpretation=interpret(source), reasons=[], decision='apply';
  var hasUnblockedPositive=interpretation.positiveOperators.some(function(item){return interpretation.blockedDirections.indexOf(item.direction)<0;});
  if(interpretation.negatedOperators.length&&!hasUnblockedPositive) reasons.push('negated_operator');
  if(interpretation.contentCount<3) reasons.push('short_input');
  if(interpretation.contentCount>=3&&interpretation.coverage<.30) reasons.push('low_coverage');
  if(interpretation.ambiguities.some(function(item){return !item.resolved;})) reasons.push('ambiguous_sense');
  if(interpretation.grammar&&interpretation.grammar.status==='CONFLICT') reasons.push('grammar_conflict');
  if(reasons.indexOf('negated_operator')>=0) decision='reject';
  else if(reasons.length) decision='clarify';
  var branchPack=null, protocolPack=null, best=null, candidate='', typed=null;
  var verification={evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED',checks:[],witness:'gate-'+decision};
  if(decision==='apply'){
    branchPack=evaluator()&&evaluator().build?evaluator().build(source,targetText):null;
    protocolPack=protocol()&&protocol().build?protocol().build(source,targetText):null;
    var sourceGuard=core()&&core().stabilityGuard?core().stabilityGuard(source):null;
    var forceRepair=sourceGuard&&['center','edge','conflict'].indexOf(sourceGuard.zone)>=0;
    var preferredDirections=unique(interpretation.positiveOperators.map(function(item){return item.direction;}).filter(function(direction){return interpretation.blockedDirections.indexOf(direction)<0;}));
    if(!forceRepair&&branchPack&&branchPack.branches&&preferredDirections.length){
      var preferred=branchPack.branches.filter(function(item){return item.status==='accept'&&preferredDirections.indexOf(item.id)>=0;});
      preferred.sort(function(a,b){return b.score-a.score;}); best=preferred[0]||null;
    }
    if(!best&&branchPack&&branchPack.best&&branchPack.best.status==='accept'&&interpretation.blockedDirections.indexOf(branchPack.best.id)<0) best=branchPack.best;
    if(!best&&branchPack&&branchPack.branches){
      var allowed=branchPack.branches.filter(function(item){return item.status==='accept'&&interpretation.blockedDirections.indexOf(item.id)<0;});
      allowed.sort(function(a,b){return b.score-a.score;}); best=allowed[0]||null;
    }
    candidate=best&&best.line?best.line:(protocolPack&&protocolPack.status==='accept'?protocolPack.line:'');
    verification=verify(source,candidate,targetText,interpretation,best&&best.data||null);
    if(!candidate||verification.evidenceLevel!=='STRUCTURAL'){
      decision='reject'; reasons.push(candidate?'structural_check_failed':'no_safe_branch'); candidate='';
    }
  }
  typed=typedProgram(decision,best,verification,candidate,interpretation,reasons);
  if(decision==='apply'&&!typed.ok){ decision='reject'; reasons.push('contract_composition_failed'); candidate=''; }
  var result={
    version:VERSION,decision:decision,status:decision,title:'семантическое решение · '+decision,
    formula:FORMULA,reasonCodes:[],summary:'',source:source,
    interpretation:interpretation,branches:branchPack,protocol:protocolPack,verification:verification,typedProgram:typed,
    evidenceLevel:decision==='apply'?verification.evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED',
    best:decision==='apply'?best:null,candidate:decision==='apply'?candidate:'',insertLine:decision==='apply'?candidate:'',
    dataEvidence:verification&&verification.data||best&&best.data||null,
    language:interpretation.language||null
  };
  var txEngine=transactionEngine();
  result.transaction=txEngine&&typeof txEngine.prepare==='function'?txEngine.prepare(source,result,targetText):{
    version:'unavailable',status:decision==='apply'?'BLOCKED':'GATED',transactionId:null,source:source,target:targetText,
    errors:[{code:'TX_ENGINE_UNAVAILABLE',phase:'prepare'}],evidence:'UNVERIFIED',evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'
  };
  if(result.decision==='apply'&&result.transaction.status!=='READY'){
    result.decision='reject'; result.status='reject'; reasons.push('transaction_not_ready');
    result.best=null; result.candidate=''; result.insertLine=''; result.evidenceLevel='UNVERIFIED';
  }
  result.title='семантическое решение · '+result.decision;
  result.reasonCodes=unique(reasons);
  result.summary=reasonSummary(result.decision,result.reasonCodes,interpretation);
  return result;
}
global.MRDSemanticDecision={version:VERSION,interpret:interpret,verify:verify,decide:decide};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
