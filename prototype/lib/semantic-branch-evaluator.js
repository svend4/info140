(function(global){
'use strict';

var VERSION='1.1.0';
var FORMULA='structural = .24 guard + .18 life + .18 move + .15 theme + .15 newness + .10 middle(u); with target: structural = .82 structural + .18 target; if local corpus is READY: score = .95 structural + .05 corpus; reject(center|edge|conflict); soundness/truth = NOT_COMPUTED';
var HARD_ZONES={center:1,edge:1,conflict:1};

function core(){ return global.MRDSemanticCore||null; }
function dataEvidence(){ return global.MRDSemanticDataEvidence||null; }
function clamp01(value){
  value=Number(value);
  return isFinite(value)?Math.max(0,Math.min(1,value)):0;
}
function textOf(value){ return String(value||'').trim(); }
function appendText(base,line){
  base=textOf(base); line=textOf(line);
  if(!base) return line;
  if(!line) return base;
  return base+(/[.!?…]$/.test(base)?' ':'. ')+line;
}
function unique(values){
  var out=[], seen={};
  for(var i=0;i<(values||[]).length;i++){
    var value=textOf(values[i]).toLowerCase();
    if(!value||seen[value]) continue;
    seen[value]=1; out.push(value);
  }
  return out;
}
function tokensOf(analysis){ return unique(analysis&&analysis.tokens||[]); }
function conceptsOf(analysis){
  var out=[], items=analysis&&analysis.items||[];
  for(var i=0;i<items.length;i++){
    if(!items[i]||items[i].role==='neutral') continue;
    out.push(items[i].lemma||items[i].token||'');
  }
  return unique(out);
}
function sharedScore(left,right){
  left=unique(left); right=unique(right);
  var map={}, shared=0;
  for(var i=0;i<left.length;i++) map[left[i]]=1;
  for(i=0;i<right.length;i++) if(map[right[i]]) shared++;
  return left.length?clamp01(shared/Math.min(3,left.length)):0;
}
function itemKey(item){
  return textOf(item&&(item.lemma||item.token)).toLowerCase();
}
function targetScore(c,targetAnalysis,after){
  if(!targetAnalysis) return 0;
  var targets=targetAnalysis.items||[], items=after&&after.items||[];
  if(!targets.length||!items.length) return 0;
  var total=0;
  for(var i=0;i<targets.length;i++){
    var best=0, targetKey=itemKey(targets[i]);
    for(var j=0;j<items.length;j++){
      var score=targetKey&&targetKey===itemKey(items[j])?1:0;
      if(score<1&&c.similarity){
        var similarity=c.similarity(targets[i],items[j]);
        score=Math.max(score,clamp01(similarity&&similarity.score));
      }
      if(score>best) best=score;
    }
    total+=best;
  }
  return clamp01(total/targets.length);
}
function pickMeaning(analysis,roles,avoid){
  var items=analysis&&analysis.items||[], blocked=avoid||{};
  for(var r=0;r<roles.length;r++){
    for(var i=0;i<items.length;i++){
      var value=itemKey(items[i]);
      if(!value||blocked[value]||items[i].role!==roles[r]) continue;
      if(!items[i].entry||items[i].entry.scale!=='OP') return value;
    }
  }
  for(r=0;r<roles.length;r++){
    for(i=0;i<items.length;i++){
      value=itemKey(items[i]);
      if(value&&!blocked[value]&&items[i].role===roles[r]) return value;
    }
  }
  var tokens=tokensOf(analysis);
  for(i=0;i<tokens.length;i++) if(!blocked[tokens[i]]) return tokens[i];
  return '';
}
function fallbackLines(analysis){
  var topic=pickMeaning(analysis,['core','bridge','neutral','detail'])||'тема';
  var blocked={}; blocked[topic]=1;
  var fact=pickMeaning(analysis,['detail','neutral','bridge','core'],blocked)||topic;
  return {
    generalize:'Тезис: детали вокруг «'+topic+'» собираются в общую мысль: движение продолжается, потому что «'+fact+'» связано с темой, но не стирается.',
    orbit:'Продолжение: «'+topic+'» делает следующий шаг через «'+fact+'»; главный смысл остается тем же, но появляется одна новая деталь.',
    detail:'Пример: показать «'+topic+'» в одном действии: заметить «'+fact+'», выбрать следующий шаг и не потерять главную линию.'
  };
}
function candidateLine(candidate){
  return textOf(candidate&&(candidate.line||candidate.added));
}
function candidateMatch(kind,candidate){
  var op=textOf(candidate&&candidate.op), label=textOf(candidate&&candidate.label).toLowerCase();
  var formula=textOf(candidate&&candidate.formula).toLowerCase();
  if(kind==='generalize') return op==='⇑'||/тезис|обобщ|general|synth/.test(label+' '+formula);
  if(kind==='detail') return op==='⇓'||/пример|детал|detail|example/.test(label+' '+formula);
  return (/ход|продолж|мост|связ/.test(label)||op==='orbit'||op==='↔')&&!/мантр|chant/.test(label+' '+formula);
}
function findCandidate(kind,items){
  var best=null, bestRank=-Infinity;
  for(var i=0;i<(items||[]).length;i++){
    var item=items[i], line=candidateLine(item);
    if(!line||!candidateMatch(kind,item)) continue;
    var op=textOf(item.op), label=textOf(item.label).toLowerCase(), rank=clamp01(item.score);
    if(kind==='generalize'&&op==='⇑') rank+=3;
    if(kind==='detail'&&op==='⇓') rank+=3;
    if(kind==='orbit'&&(/ход|продолж|мост|связ/.test(label)||op==='↔')) rank+=3;
    if(rank>bestRank){ best=item; bestRank=rank; }
  }
  return best;
}
function effectiveZone(guard,analysis){
  var zone=textOf(guard&&guard.zone).toLowerCase();
  var risk=textOf(guard&&guard.risk).toLowerCase();
  var graphConflicts=analysis&&analysis.graph&&analysis.graph.metrics&&analysis.graph.metrics.conflictCount||0;
  if((analysis&&analysis.conflicts&&analysis.conflicts.length)||graphConflicts>0||zone==='conflict'||risk==='conflict') return 'conflict';
  var u=guard&&guard.u!=null?clamp01(guard.u):.5;
  if(zone==='center'||risk==='center'||u<=.18) return 'center';
  if(zone==='edge'||risk==='edge'||u>=.82) return 'edge';
  return zone||risk||'safe';
}
function branchStatus(zone,metrics,targetActive){
  if(HARD_ZONES[zone]) return 'reject';
  var complete=metrics.guard>=.42&&metrics.u>.18&&metrics.u<.82&&metrics.life>=.35&&
    metrics.move>=.25&&metrics.theme>=.20&&metrics.newness>=.25&&(!targetActive||metrics.target>=.28);
  return complete?'accept':'repair';
}
function statusReason(status,zone,metrics,targetActive){
  if(status==='reject'){
    if(zone==='center') return 'guard: ветвь схлопывается в 3D-центр';
    if(zone==='edge') return 'guard: ветвь распадается к 1D-краю';
    return 'guard: ветвь сохраняет смысловой конфликт без допустимого моста';
  }
  if(status==='accept') return 'guard и эвристики продолжения проходят пороги';
  var missing=[];
  if(metrics.guard<.42) missing.push('guard');
  if(metrics.life<.35) missing.push('life');
  if(metrics.move<.25) missing.push('move');
  if(metrics.theme<.20) missing.push('theme');
  if(metrics.newness<.25) missing.push('newness');
  if(targetActive&&metrics.target<.28) missing.push('target');
  return 'нужен ремонт: '+(missing.length?missing.join(', '):zone);
}
function evaluateBranch(c,spec,line,source,before,beforeGuard,targetAnalysis,targetActive,targetText){
  var lineAnalysis=c.analyzeText(line), afterText=appendText(source,line), after=c.analyzeText(afterText);
  var guard=c.stabilityGuard(afterText)||{}, sourceTokens=tokensOf(before), lineTokens=tokensOf(lineAnalysis);
  var sourceConcepts=conceptsOf(before), lineConcepts=conceptsOf(lineAnalysis), sourceMap={}, newCount=0;
  for(var i=0;i<sourceTokens.length;i++) sourceMap[sourceTokens[i]]=1;
  for(i=0;i<lineTokens.length;i++) if(!sourceMap[lineTokens[i]]) newCount++;
  var metrics={
    guard:clamp01(guard.score),
    u:guard.u!=null?clamp01(guard.u):.5,
    life:clamp01(after.life),
    move:clamp01(after.move),
    theme:sharedScore(sourceConcepts.length?sourceConcepts:sourceTokens,lineConcepts.length?lineConcepts:lineTokens),
    newness:clamp01(newCount/4),
    target:targetScore(c,targetAnalysis,after)
  };
  var middle=clamp01(1-Math.abs(metrics.u-.5)*2);
  var score=.24*metrics.guard+.18*metrics.life+.18*metrics.move+.15*metrics.theme+.15*metrics.newness+.10*middle;
  if(targetActive) score=score*.82+metrics.target*.18;
  var structuralScore=clamp01(score), dataEngine=dataEvidence();
  var data=dataEngine&&typeof dataEngine.assess==='function'?dataEngine.assess(source,line,targetText||''):null;
  if(data&&data.status==='READY') score=(1-(Number(data.boundedWeight)||.05))*structuralScore+(Number(data.boundedWeight)||.05)*clamp01(data.score);
  var zone=effectiveZone(guard,after), status=branchStatus(zone,metrics,targetActive);
  return {
    id:spec.id,dimension:spec.dimension,label:spec.label,op:spec.op,status:status,score:clamp01(score),structuralScore:structuralScore,line:line,
    guard:metrics.guard,u:metrics.u,life:metrics.life,move:metrics.move,theme:metrics.theme,newness:metrics.newness,target:metrics.target,
    zone:zone,newWords:newCount,data:data,dataScore:data&&data.status==='READY'?clamp01(data.score):null,rankingDelta:clamp01(score)-structuralScore,
    delta:{guard:metrics.guard-clamp01(beforeGuard.score),u:metrics.u-(beforeGuard.u!=null?clamp01(beforeGuard.u):.5),life:metrics.life-clamp01(before.life),move:metrics.move-clamp01(before.move)},
    reason:statusReason(status,zone,metrics,targetActive)
  };
}
function bestBranch(branches,sourceZone){
  var eligible=[];
  for(var i=0;i<branches.length;i++) if(branches[i].status==='accept'||branches[i].status==='repair') eligible.push(branches[i]);
  var priority={orbit:0,generalize:1,detail:2};
  eligible.sort(function(a,b){
    var statusA=a.status==='accept'?1:0, statusB=b.status==='accept'?1:0;
    return statusB-statusA||b.score-a.score||priority[a.id]-priority[b.id];
  });
  var repairMode=sourceZone==='center'?'detail':sourceZone==='edge'?'generalize':sourceZone==='conflict'?'orbit':'';
  if(repairMode){
    for(i=0;i<eligible.length;i++) if(eligible[i].id===repairMode) return eligible[i];
  }
  var top=eligible[0]||null, orbit=null;
  for(i=0;i<eligible.length;i++) if(eligible[i].id==='orbit'){ orbit=eligible[i]; break; }
  if(top&&orbit&&orbit.status===top.status&&orbit.score>=top.score-.03) return orbit;
  return top;
}
function resultSummary(best,branches){
  var rejected=0;
  for(var i=0;i<branches.length;i++) if(branches[i].status==='reject') rejected++;
  if(!best) return 'Все три ветви отклонены guard; best отсутствует. Истинность и soundness не вычисляются.';
  var state=best.status==='accept'?'принята':'требует ремонта';
  return 'Выбрана ветвь «'+best.label+'»: '+state+'; отклонено '+rejected+'. Сравнение эвристическое, истинность и soundness не вычисляются.';
}
function emptyResult(summary){
  return {version:VERSION,status:'empty',title:'ветви реакции · нет входа',formula:FORMULA,branches:[],best:null,summary:summary};
}
function build(text,target){
  var c=core(), source=textOf(text), targetText=textOf(target);
  if(!c||typeof c.analyzeText!=='function'||typeof c.stabilityGuard!=='function'){
    return emptyResult('SemanticCore недоступен; ветви не построены. Истинность и soundness не вычисляются.');
  }
  if(!source) return emptyResult('Введите текст, чтобы построить три ветви. Истинность и soundness не вычисляются.');

  var before=c.analyzeText(source), beforeGuard=c.stabilityGuard(source)||{};
  if(!before.tokens||before.tokens.length<3) return emptyResult('Нужно не менее трёх слов: ветви не строятся и вставка запрещена. Истинность и soundness не вычисляются.');
  var targetAnalysis=targetText?c.analyzeText(targetText):null, plan=c.composeContinuation?c.composeContinuation(source,6):null;
  var repair=c.balanceRepair?c.balanceRepair(source,6):null;
  var items=(plan&&plan.items||[]).concat(repair&&repair.items||[]), fallbacks=fallbackLines(before), used={}, branches=[];
  var specs=[
    {id:'generalize',dimension:'3D',label:'3D · обобщение',op:'⇑'},
    {id:'orbit',dimension:'2D',label:'2D · продолжение',op:'orbit'},
    {id:'detail',dimension:'1D',label:'1D · уточнение',op:'⇓'}
  ];
  for(var i=0;i<specs.length;i++){
    var candidate=findCandidate(specs[i].id,items), line=candidateLine(candidate);
    if(!line||used[line]) line=fallbacks[specs[i].id];
    used[line]=1;
    branches.push(evaluateBranch(c,specs[i],line,source,before,beforeGuard,targetAnalysis,!!targetText,targetText));
  }
  var best=bestBranch(branches,effectiveZone(beforeGuard,before));
  var status=best?best.status:'reject';
  var dataEngine=dataEvidence(), dataSnapshot=dataEngine&&typeof dataEngine.snapshot==='function'?dataEngine.snapshot():null;
  return {version:VERSION,status:status,title:'ветви реакции · '+status,formula:FORMULA,branches:branches,best:best,dataSnapshot:dataSnapshot,summary:resultSummary(best,branches)};
}

global.MRDSemanticBranchEvaluator={version:VERSION,build:build};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
