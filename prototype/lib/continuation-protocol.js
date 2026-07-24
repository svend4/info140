(function(global){
'use strict';
var core=function(){ return global.MRDSemanticCore||null; };
function clamp01(n){ n=Number(n)||0; return Math.max(0,Math.min(1,n)); }
function pct(n){ return Math.round(clamp01(n)*100)+'%'; }
function unique(list){
  var out=[], seen={};
  (list||[]).forEach(function(value){
    var key=String(value||'').trim().toLowerCase();
    if(!key||seen[key]) return;
    seen[key]=1; out.push(key);
  });
  return out;
}
function tokensOf(analysis){ return unique(analysis&&analysis.tokens||[]); }
function conceptsOf(analysis){
  var concepts=[];
  (analysis&&analysis.items||[]).forEach(function(item){
    if(!item||item.role==='neutral') return;
    concepts.push(item.lemma||item.token||'');
  });
  return unique(concepts);
}
function sharedScore(a,b){
  var left=unique(a), right=unique(b), map={}, shared=0;
  left.forEach(function(value){ map[value]=1; });
  right.forEach(function(value){ if(map[value]) shared++; });
  return left.length?clamp01(shared/Math.min(3,left.length)):0;
}
function appendText(base,line){
  var source=String(base||'').trim(), addition=String(line||'').trim();
  if(!source) return addition;
  if(!addition) return source;
  return source+(/[.!?…]$/.test(source)?' ':'. ')+addition;
}
function statusLabel(status){
  return status==='accept'?'ПРИНЯТЬ':status==='rollback'?'ОТКАТ':'РЕМОНТ';
}
function build(text,target){
  var c=core(), source=String(text||'').trim(), targetText=String(target||'').trim();
  if(!c||!source) return {version:'1.0.0',status:'empty',title:'протокол продолжения',summary:'Введите условие, чтобы проверить следующий ход.',rows:[],reportText:'',insertLine:''};

  var before=c.analyzeText(source), guardBefore=c.stabilityGuard(source), plan=c.composeContinuation?c.composeContinuation(source,5):null;
  var candidate=plan&&plan.best?plan.best:null, line=candidate&&candidate.line?String(candidate.line).trim():'';
  var nextText=candidate&&candidate.text?String(candidate.text):appendText(source,line);
  var lineAnalysis=line?c.analyzeText(line):null, after=line?c.analyzeText(nextText):before, guardAfter=line?c.stabilityGuard(nextText):guardBefore;
  var railsAfter=line&&c.semanticRails?c.semanticRails(nextText):null, goalAfter=line&&targetText&&c.semanticGoal?c.semanticGoal(nextText,targetText):null;

  var sourceTokens=tokensOf(before), lineTokens=tokensOf(lineAnalysis), sourceConcepts=conceptsOf(before), lineConcepts=conceptsOf(lineAnalysis);
  var themeScore=sharedScore(sourceConcepts.length?sourceConcepts:sourceTokens,lineConcepts.length?lineConcepts:lineTokens);
  var sourceMap={}, newCount=0;
  sourceTokens.forEach(function(value){ sourceMap[value]=1; });
  lineTokens.forEach(function(value){ if(!sourceMap[value]) newCount++; });

  var preInput=sourceTokens.length>=3, preCandidate=!!line&&lineTokens.length>=4, preOk=preInput&&preCandidate;
  var zone=guardAfter&&guardAfter.zone||'unknown', u=guardAfter&&guardAfter.u!=null?guardAfter.u:.5;
  var openZone=(zone==='safe'||zone==='thin')&&u>.18&&u<.82;
  var noDrop=(guardAfter.score||0)>=(guardBefore.score||0)-.12;
  var noConflict=!(after.conflicts&&after.conflicts.length);
  var invOk=openZone&&noDrop&&noConflict;
  var targetOk=!targetText||!!(goalAfter&&goalAfter.score>=.32);
  var postOk=themeScore>=.2&&newCount>=2&&(after.move||0)>=.3&&targetOk;
  var status=!invOk?'rollback':(!preOk||!postOk?'repair':'accept');
  var structuralOk=preOk&&lineTokens.length>=4, proofScore=clamp01(((guardAfter.score||0)+(railsAfter&&railsAfter.score||0)+themeScore)/3);
  var hash=c.hash?c.hash(source+'|'+line):0;
  var rows=[
    {id:'pre',label:'pre · вход',state:preOk?'ok':'bad',score:preOk?1:0,text:(preInput?'вход определен':'вход слишком короткий')+'; '+(preCandidate?'кандидат найден':'нет полного кандидата')},
    {id:'inv',label:'inv · кольцо',state:invOk?'ok':'bad',score:guardAfter.score||0,text:'u '+Number(guardBefore.u||.5).toFixed(2)+' → '+Number(u).toFixed(2)+'; guard '+pct(guardBefore.score||0)+' → '+pct(guardAfter.score||0)+'; '+zone},
    {id:'post',label:'post · ход',state:postOk?'ok':'bad',score:clamp01((themeScore+Math.min(1,newCount/4)+(after.move||0))/3),text:'тема '+pct(themeScore)+'; новых слов '+newCount+'; движение '+pct(after.move||0)+(targetText?'; цель '+pct(goalAfter&&goalAfter.score||0):'')},
    {id:'proof',label:'proof · след',state:'open',score:proofScore,text:'trace #'+String(hash>>>0)+'; structure '+(structuralOk?'OK':'FAIL')+'; soundness UNVERIFIED'}
  ];
  var summary=status==='accept'
    ? 'Ход сохраняет тему, остается внутри 2D-кольца и добавляет новое продолжение.'
    : status==='rollback'
      ? 'Ход выводит процесс из живого кольца: ветку нельзя применять без ремонта.'
      : 'Ход остается в кольце, но контракт темы или продолжения заполнен не полностью.';
  var action=status==='accept'?'вставить проверенный ход':status==='rollback'?'вернуться к предыдущей ветке':'добавить тему, мост или новую деталь и проверить снова';
  var report=[
    statusLabel(status)+': '+summary,
    'pre='+(preOk?'OK':'FAIL')+'; inv='+(invOk?'OK':'FAIL')+'; post='+(postOk?'OK':'FAIL')+'; trace=HASHED; soundness=UNVERIFIED.',
    line?'Следующий ход: '+line:'Следующий ход не построен.'
  ].join('\n');
  return {
    version:'1.0.0',status:status,title:'протокол продолжения · '+statusLabel(status),summary:summary,action:action,
    formula:'compose(A,B) = pre ∧ inv ∧ post; proof = trace + structure; soundness = UNVERIFIED',
    rows:rows,line:line,insertLine:status==='accept'?line:'',reportText:report,
    before:{guard:guardBefore.score||0,u:guardBefore.u||.5,life:before.life||0},
    after:{guard:guardAfter.score||0,u:u,life:after.life||0,move:after.move||0},
    contract:{pre:preOk,inv:invOk,post:postOk,structural:structuralOk,soundness:'UNVERIFIED'}
  };
}
global.MRDContinuationProtocol={version:'1.0.0',build:build};
})(window);
