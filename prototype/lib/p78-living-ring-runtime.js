(function(){
'use strict';
var TAU=Math.PI*2, PHI=(Math.sqrt(5)-1)/2;
var canvas=document.getElementById('world'), ctx=canvas.getContext('2d');
var condition=document.getElementById('condition'), applyBtn=document.getElementById('apply'), sampleBtn=document.getElementById('sample');
var impulse=document.getElementById('impulse'), impulseCheck=document.getElementById('impulseCheck'), impulseApply=document.getElementById('impulseApply'), impulseBest=document.getElementById('impulseBest'), impulseResult=document.getElementById('impulseResult');
var lambda=document.getElementById('lambda'), inertia=document.getElementById('inertia'), tempo=document.getElementById('tempo'), goalTarget=document.getElementById('goalTarget'), goalCheck=document.getElementById('goalCheck');
var angleBtn=document.getElementById('angle'), pauseBtn=document.getElementById('pause'), resetBtn=document.getElementById('reset');
var chant=document.getElementById('chant'), beats=document.getElementById('beats'), events=document.getElementById('events'), tagsEl=document.getElementById('tags'), archipelagoMapEl=document.getElementById('archipelagoMap'), weaveMapEl=document.getElementById('weaveMap'), windowMapEl=document.getElementById('windowMap'), backtrackMapEl=document.getElementById('backtrackMap'), goalMapEl=document.getElementById('goalMap'), phiMapEl=document.getElementById('phiMap'), railsMapEl=document.getElementById('railsMap');
var guardEl=document.getElementById('guard'), balanceEl=document.getElementById('balance'), reactionFieldEl=document.getElementById('reactionField'), continuation=document.getElementById('continuation'), composeRefresh=document.getElementById('composeRefresh'), composeBest=document.getElementById('composeBest'), composeResult=document.getElementById('composeResult'), forecastEl=document.getElementById('forecast'), trajectoryEl=document.getElementById('trajectory'), portalEl=document.getElementById('portal'), radarEl=document.getElementById('radar'), traceProofEl=document.getElementById('traceProof'), textResultEl=document.getElementById('textResult'), parameterCounterfactualEl=document.getElementById('parameterCounterfactual'), outputMenuEl=document.getElementById('outputMenu'), continuationProtocolEl=document.getElementById('continuationProtocol');
var corePullEl=document.getElementById('corePull'), edgePullEl=document.getElementById('edgePull'), movePullEl=document.getElementById('movePull'), lifeScoreEl=document.getElementById('lifeScore');
var mval=document.getElementById('mval'), mbar=document.getElementById('mbar'), aval=document.getElementById('aval'), coreEl=document.getElementById('core'), edgeEl=document.getElementById('edge');
var fitVal=document.getElementById('fitVal'), lcaVal=document.getElementById('lcaVal'), gLinkVal=document.getElementById('gLinkVal'), conflictVal=document.getElementById('conflictVal');
var formulaX=document.getElementById('formulaX'), formulaY=document.getElementById('formulaY'), formulaXValue=document.getElementById('formulaXValue'), formulaYValue=document.getElementById('formulaYValue');
var formulaTraceEl=document.getElementById('formulaTrace'), marginalCorridorEl=document.getElementById('marginalCorridor');
var semanticSearchQuery=document.getElementById('semanticSearchQuery'), semanticSearchFormula=document.getElementById('semanticSearchFormula'), semanticSearchRun=document.getElementById('semanticSearchRun');
var semanticSearchTraceEl=document.getElementById('semanticSearchTrace');
var controlledClaimInput=document.getElementById('controlledClaimInput'), controlledClaimRun=document.getElementById('controlledClaimRun');
var controlledClaimTraceEl=document.getElementById('controlledClaimTrace');
var controlledClaimEvidenceEl=document.getElementById('controlledClaimEvidence');
var evidenceBackedLinkEl=document.getElementById('evidenceBackedLinkView');
var semanticFlowEl=document.getElementById('semanticFlowView');
var analysisModeBtn=document.querySelector('button[data-mode="analysis"]');
var W=1080,H=690,CX=484,CY=348,R0=92,R1=258,PI='14159265358979323846264338327950288419716939937510';
var REACTION_RUNTIME_INTERVAL=48;
var REACTION_RUNTIME_FRAME_INTERVAL=24;
var SIMULATION_SUBSTEP_CAP=2;
var PANEL_FRAME_INTERVAL=24;
var VISUAL_PARTICLE_COUNT=180;
var REACTION_RUNTIME_PARTICLE_LIMIT=96;
var LIQUID_BAND_COUNT=6;
var LIQUID_BAND_SEGMENTS=72;
var TRACE_LIMIT=120;
var FRAME_HEALTH_WINDOW=180;
var Semantic=window.MRDSemanticCore||null;
var RuntimeState=window.MRDP78RuntimeState;
var ReactionKernel=window.MRDP78ReactionKernel;
var ActionController=window.MRDP78SemanticActionController;
var InterfaceMode=window.MRDP78InterfaceMode;
var FormulaRegistry=window.MRDP78FormulaRegistry;
var FormulaEngine=window.MRDP78FormulaEngine;
var FormulaView=window.MRDP78FormulaView;
var FormulaAdapter=window.MRDP78FormulaAdapter;
var BidirectionalRetrieval=window.MRDP78BidirectionalRetrieval;
var SearchView=window.MRDP78SearchView;
var SearchAdapter=window.MRDP78SearchAdapter;
var ControlledClaimEngine=window.MRDP78ControlledClaimEngine;
var ClaimView=window.MRDP78ClaimView;
var ClaimAdapter=window.MRDP78ClaimAdapter;
var ClaimEvidenceCascade=window.MRDP78ClaimEvidenceCascade;
var EvidenceCandidateView=window.MRDP78EvidenceCandidateView;
var EvidenceBackedLinkProjector=window.MRDP78EvidenceBackedLinkProjector;
var EvidenceBackedLinkView=window.MRDP78EvidenceBackedLinkView;
var EvidenceBackedLinkRunner=window.MRDP78EvidenceBackedLinkRunner;
var SemanticFlowReducer=window.MRDP78SemanticFlowReducer;
var SemanticFlowView=window.MRDP78SemanticFlowView;
if(!FormulaAdapter||typeof FormulaAdapter.create!=='function') throw new Error('P78_FORMULA_ADAPTER_UNAVAILABLE');
if(!FormulaRegistry||FormulaRegistry.status!=='READY') throw new Error('P78_FORMULA_REGISTRY_UNAVAILABLE');
if(!FormulaEngine||typeof FormulaEngine.runRingMatryoshka!=='function') throw new Error('P78_FORMULA_ENGINE_UNAVAILABLE');
if(!FormulaView||typeof FormulaView.render!=='function') throw new Error('P78_FORMULA_VIEW_UNAVAILABLE');
if(!BidirectionalRetrieval||typeof BidirectionalRetrieval.create!=='function') throw new Error('P78_BIDIRECTIONAL_RETRIEVAL_UNAVAILABLE');
if(!SearchView||typeof SearchView.render!=='function') throw new Error('P78_SEARCH_VIEW_UNAVAILABLE');
if(!SearchAdapter||typeof SearchAdapter.create!=='function') throw new Error('P78_SEARCH_ADAPTER_UNAVAILABLE');
var MarginalCorridor=window.MRDP78MarginalCorridor;
var MarginalCorridorView=window.MRDP78MarginalCorridorView;
var SemanticLanguage=window.MRDSemanticLanguage;
if(!ControlledClaimEngine||typeof ControlledClaimEngine.create!=='function') throw new Error('P78_CONTROLLED_CLAIM_ENGINE_UNAVAILABLE');
if(!ClaimView||typeof ClaimView.render!=='function') throw new Error('P78_CLAIM_VIEW_UNAVAILABLE');
if(!ClaimAdapter||typeof ClaimAdapter.create!=='function') throw new Error('P78_CLAIM_ADAPTER_UNAVAILABLE');
if(!RuntimeState||typeof RuntimeState.createState!=='function') throw new Error('P78_RUNTIME_STATE_UNAVAILABLE');
if(!ReactionKernel||typeof ReactionKernel.create!=='function') throw new Error('P78_REACTION_KERNEL_UNAVAILABLE');
if(!ActionController||typeof ActionController.create!=='function') throw new Error('P78_ACTION_CONTROLLER_UNAVAILABLE');
if(!InterfaceMode||typeof InterfaceMode.create!=='function') throw new Error('P78_INTERFACE_MODE_UNAVAILABLE');
var p78State=RuntimeState.createState({
  semanticState:{ledger:window.MRDSemanticLedger&&window.MRDSemanticLedger.create?window.MRDSemanticLedger.create(8):null}
});
var worldState=p78State.worldState,reactionState=p78State.reactionState,semanticState=p78State.semanticState,uiState=p78State.uiState;
var reactionController=null;
var actionController=ActionController.create({semanticState:semanticState,uiState:uiState});
if(!MarginalCorridor||typeof MarginalCorridor.evaluate!=='function') throw new Error('P78_MARGINAL_CORRIDOR_UNAVAILABLE');
if(!MarginalCorridorView||typeof MarginalCorridorView.render!=='function') throw new Error('P78_MARGINAL_CORRIDOR_VIEW_UNAVAILABLE');
var interfaceMode=window.MRDP78InterfaceMode.create(document.querySelector('.dock'));
var formulaAdapter=FormulaAdapter.create({registry:FormulaRegistry,engine:FormulaEngine,view:FormulaView,semantic:Semantic,root:formulaTraceEl,xInput:formulaX,yInput:formulaY,xOutput:formulaXValue,yOutput:formulaYValue});
var searchEngine=BidirectionalRetrieval.create();
if(!searchEngine||searchEngine.status!=='READY') throw new Error('P78_SEARCH_ENGINE_UNAVAILABLE');
var searchAdapter=SearchAdapter.create({engine:searchEngine,view:SearchView,root:semanticSearchTraceEl,queryInput:semanticSearchQuery,formulaSelect:semanticSearchFormula,registry:FormulaRegistry});
var claimEvidenceCascade=null,claimEvidenceAvailabilityCode=null;
if(ClaimEvidenceCascade&&typeof ClaimEvidenceCascade.create==='function'){
  try{
    claimEvidenceCascade=ClaimEvidenceCascade.create();
    if(!claimEvidenceCascade||claimEvidenceCascade.status!=='READY'){
      claimEvidenceCascade=null; claimEvidenceAvailabilityCode='P78_CLAIM_EVIDENCE_CASCADE_UNAVAILABLE';
    }
  }catch(evidenceSetupError){ claimEvidenceCascade=null; claimEvidenceAvailabilityCode=evidenceSetupError&&evidenceSetupError.code||'P78_CLAIM_EVIDENCE_CASCADE_UNAVAILABLE'; }
}else claimEvidenceAvailabilityCode='P78_CLAIM_EVIDENCE_CASCADE_UNAVAILABLE';
var controlledClaimEngine=ControlledClaimEngine.create(claimEvidenceCascade?{evidenceCascade:claimEvidenceCascade}:undefined);
if(!controlledClaimEngine||controlledClaimEngine.status!=='READY') throw new Error('P78_CONTROLLED_CLAIM_ENGINE_UNAVAILABLE');
var controlledClaimAdapter=ClaimAdapter.create({engine:controlledClaimEngine,view:ClaimView,root:controlledClaimTraceEl,input:controlledClaimInput});
var evidenceBackedLinkRunner=EvidenceBackedLinkRunner&&EvidenceBackedLinkRunner.status==='READY'&&typeof EvidenceBackedLinkRunner.create==='function'?
  EvidenceBackedLinkRunner.create({workerUrl:'lib/p78-evidence-backed-link-worker.js?v=1.0.0',timeoutMs:15000}):null;

var examples=[
  'Продолжить статью: город учится беречь воду, но жители спорят о цене. Нужны общий смысл, факты и следующий шаг.',
  'Разбить слово круговорот на части, потом собрать их в одну короткую мысль и продолжить песню.',
  'Герой потерял ключ у моста. Ветер принес письмо. Нужно уточнить детали, но не разрушить сюжет.',
  'Одним словом назвать тему: память, дорога, дождь, карта. Затем дать продолжение рассказа.'
];
var words=[
  ['круг','ход продолжается'],
  ['кроха','деталь входит в ряд'],
  ['не центр','смысл не схлопнуть'],
  ['не край','тему не рассыпать'],
  ['дальше','следующий ход']
];
var stopWords={и:1,а:1,но:1,на:1,у:1,о:1,об:1,в:1,во:1,к:1,ко:1,с:1,со:1,по:1,из:1,за:1,для:1,не:1,это:1,как:1,что:1,то:1,он:1,она:1,они:1,мы:1,вы:1,я:1,или:1,если:1,then:1,and:1,the:1};
var dictionaries={
  core:['обобщ','смысл','главн','итог','вывод','ядро','одно','сжать','сверн','назвать','тезис','тема','цель','предложение'],
  detail:['разб','слог','букв','част','детал','уточ','факт','пример','дефраг','разлож','рассып','край','матер','услов','параметр','тег'],
  bridge:['продолж','дальше','движ','сюжет','песня','статья','рассказ','связ','ход','реаг','жив','теч','потом','затем','след']
};
function rnd(){ worldState.seed=(worldState.seed*1664525+1013904223)>>>0; return worldState.seed/4294967296; }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function clockMs(){ return window.performance&&typeof window.performance.now==='function'?window.performance.now():Date.now(); }
function publishFrameHealth(){
  if(!worldState.frame.healthSamples.length) return;
  var sorted=worldState.frame.healthSamples.slice().sort(function(a,b){return a-b;}),sum=worldState.frame.healthSamples.reduce(function(a,b){return a+b;},0);
  canvas.dataset.frameMean=(sum/worldState.frame.healthSamples.length).toFixed(2);
  canvas.dataset.frameP95=sorted[Math.floor((sorted.length-1)*.95)].toFixed(2);
  canvas.dataset.frameMax=sorted[sorted.length-1].toFixed(2);
  canvas.dataset.frameStalls=String(worldState.frame.healthSamples.filter(function(value){return value>40;}).length);
  canvas.dataset.runtimeMs=reactionState.runtimeMs.toFixed(2);
  canvas.dataset.frameWorkMs=worldState.frame.workMs.toFixed(2);
  canvas.dataset.simulationMs=worldState.frame.simulationMs.toFixed(2);
  canvas.dataset.drawMs=worldState.frame.drawMs.toFixed(2);
  canvas.dataset.simulationSubsteps=String(worldState.frame.substeps);
  canvas.dataset.frameSamples=String(worldState.frame.healthSamples.length);
}
function recordFrameHealth(now){
  if(worldState.frame.lastAt){
    worldState.frame.healthSamples.push(Math.max(0,now-worldState.frame.lastAt));
    if(worldState.frame.healthSamples.length>FRAME_HEALTH_WINDOW) worldState.frame.healthSamples.shift();
  }
  worldState.frame.lastAt=now; worldState.frame.serial++;
  if(worldState.frame.serial%60===0) publishFrameHealth();
}
function normWord(s){ return s.toLowerCase().replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi,''); }
function hash(s){ var h=2166136261>>>0; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function hasStem(word,list){ for(var i=0;i<list.length;i++) if(word.indexOf(list[i])>=0) return true; return false; }
function roleColor(role,a){
  var c=role==='core'?'117,103,216':role==='detail'?'216,81,63':role==='bridge'?'21,151,132':'226,161,43';
  return 'rgba('+c+','+a+')';
}
function col(u,a){
  var c=u<.20?'117,103,216':u<.45?'47,131,202':u<.70?'21,151,132':u<.86?'226,161,43':'216,81,63';
  return 'rgba('+c+','+a+')';
}
function eventLine(s){
  var d=document.createElement('div'); d.textContent=s; events.insertBefore(d,events.firstChild);
  while(events.childNodes.length>40) events.removeChild(events.lastChild);
}
function tokenRole(w){
  if(Semantic) return Semantic.classify(w).role;
  var core=hasStem(w,dictionaries.core), detail=hasStem(w,dictionaries.detail), bridge=hasStem(w,dictionaries.bridge);
  if(bridge && !core && !detail) return 'bridge';
  if(core && !detail) return 'core';
  if(detail && !core) return 'detail';
  if(w.length<=3) return 'detail';
  if(w.length>=10) return 'core';
  return bridge?'bridge':'neutral';
}
function uniqueTokens(text){
  if(Semantic) return Semantic.tokenize(text,26);
  var raw=(text||'').toLowerCase().split(/[^a-zа-яё0-9]+/i), seen={}, out=[];
  for(var i=0;i<raw.length;i++){
    var w=normWord(raw[i]);
    if(w.length<2 || stopWords[w] || seen[w]) continue;
    seen[w]=true; out.push(w);
    if(out.length>=26) break;
  }
  return out;
}
function analyze(text){
  if(Semantic) return Semantic.analyzeText(text);
  var tokens=uniqueTokens(text), counts={core:0,detail:0,bridge:0,neutral:0}, roles=[], h=hash(text||'');
  for(var i=0;i<tokens.length;i++){
    var role=tokenRole(tokens[i]); counts[role]++; roles.push(role);
  }
  var n=Math.max(1,tokens.length), core=counts.core/n, edge=counts.detail/n, move=(counts.bridge+.45*counts.neutral)/n;
  var balance=1-Math.min(1,Math.abs(core-edge)*1.35), density=clamp(tokens.length/14,0,1);
  var life=clamp((.38+.42*move+.20*balance)*(.72+.28*density),0,1);
  return {text:text,tokens:tokens,roles:roles,counts:counts,core:core,edge:edge,move:move,life:life,hash:h,force:edge-core};
}
function renderReactionField(){
  if(!reactionFieldEl) return;
  var view=window.MRDSemanticReactionFieldView,field=reactionController.getField();
  if(view&&typeof view.render==='function'){
    var live=reactionController.snapshot();
    view.render(reactionFieldEl,field,{live:live}); return;
  }
  reactionFieldEl.textContent=field&&field.text?field.text.summary:'Движок локальных реакций недоступен.';
}
function syncReactionVisuals(){
  var i, particle;
  for(i=0;i<worldState.islands.length;i++){
    particle=reactionController.particle(i); if(!particle) continue;
    worldState.islands[i].u=particle.u; worldState.islands[i].reactionRole=particle.reactionRole; worldState.islands[i].baseReactionRole=particle.baseReactionRole;
    worldState.islands[i].q=particle.q; worldState.islands[i].act=particle.act; worldState.islands[i].thr=particle.thr; worldState.islands[i].state=particle.state;
  }
  for(i=0;i<worldState.drops.length;i++){
    var drop=worldState.drops[i]; particle=reactionController.particle(drop.tokenIndex); if(!particle) continue;
    drop.reactionRole=particle.reactionRole==='seed'&&drop.id!==particle.index?particle.baseReactionRole:particle.reactionRole;
    drop.baseReactionRole=particle.baseReactionRole; drop.q=particle.q; drop.act=particle.act; drop.thr=particle.thr; drop.reactionState=particle.state;
  }
}
function updateReactionField(){
  reactionController.recalculate(semanticState.analysis||condition.value,+lambda.value/100);
  syncReactionVisuals();
  reactionController.initialize();
  renderMarginalCorridor();
  renderReactionField();
  return reactionController.getField();
}
function renderMarginalCorridor(){
  if(!marginalCorridorEl) return null;
  var language=semanticState.rails&&semanticState.rails.language;
  if(!language&&SemanticLanguage&&typeof SemanticLanguage.analyze==='function') language=SemanticLanguage.analyze(condition.value);
  semanticState.marginalCorridor=MarginalCorridor.evaluate({
    text:condition.value,
    analysis:semanticState.analysis,
    language:language,
    field:reactionController.getField()
  });
  MarginalCorridorView.render(marginalCorridorEl,semanticState.marginalCorridor);
  canvas.dataset.corridorStatus=semanticState.marginalCorridor.status;
  canvas.dataset.corridorRegime=semanticState.marginalCorridor.overall.regime;
  canvas.dataset.corridorPosition=semanticState.marginalCorridor.overall.position.toFixed(3);
  return semanticState.marginalCorridor;
}
function reactionRuntimeParticles(){
  var out=[];
  for(var i=0;i<worldState.drops.length&&out.length<REACTION_RUNTIME_PARTICLE_LIMIT;i++){
    var drop=worldState.drops[i], pos=point(drop.th,drop.u);
    out.push({
      id:drop.id,tokenIndex:drop.tokenIndex,token:drop.label,x:(pos.x-CX)/(R1*2),y:(pos.y-CY)/(R1*2),u:drop.u,
      reactionRole:drop.reactionRole,baseReactionRole:drop.baseReactionRole,semanticRole:drop.role,
      q:drop.q,act:drop.act,thr:drop.thr,mass:1
    });
  }
  return out;
}
function runtimeDrop(id){
  for(var i=0;i<worldState.drops.length;i++) if(String(worldState.drops[i].id)===String(id)) return worldState.drops[i];
  return null;
}
function applyReactionRuntimeEffects(effects){
  for(var i=0;i<(effects||[]).length;i++){
    var effect=effects[i], source=runtimeDrop(effect.sourceId), target=runtimeDrop(effect.targetId);
    if(source){ source.act=effect.sourceAct; source.reactionState='cooldown'; }
    if(target){
      target.u=clamp(effect.afterU,.181001,.818999); target.act=effect.targetAct;
      target.reactionRole=effect.targetRole; target.reactionState=effect.targetState; target.reactionGeneration=effect.generation;
    }
  }
}
function scheduleIdle(task,timeout){
  if(typeof window.requestIdleCallback==='function') window.requestIdleCallback(task,{timeout:timeout||240});
  else window.setTimeout(task,0);
}
function schedulePanelUpdate(){
  if(uiState.panelUpdateScheduled) return;
  uiState.panelUpdateScheduled=true;
  scheduleIdle(function(){ uiState.panelUpdateScheduled=false; updatePanel(); },220);
}
function flushReactionRuntimeUi(payload){
  renderReactionField();
  if(payload.textDirty) renderTextResult();
  if(payload.menuDirty) renderOutputMenu();
  if(payload.event) eventLine(payload.event);
}
function applyReactionRuntimeResult(result){
  var runtimeMessage='';
  if(result.status==='BLOCKED'){
    runtimeMessage='живая реакция остановлена: '+String(result.code||'контракт');
  }else{
    applyReactionRuntimeEffects(result.effects);
    if(result.events.length){
      var event=result.events[0];
      runtimeMessage='живая встреча: «'+event.sourceToken+'» → «'+event.targetToken+'» · '+event.ruleId;
    }
  }
  return runtimeMessage;
}
reactionController=ReactionKernel.create({
  state:reactionState,
  fieldEngine:window.MRDSemanticReactionField||null,
  runtimeEngine:window.MRDSemanticReactionRuntime||null,
  rulebook:window.MRDSemanticReactionRules||null,
  scheduleIdle:scheduleIdle,
  now:clockMs,
  hashText:hash,
  isRunning:function(){ return worldState.running; },
  readRevisionInput:function(){
    var field=reactionController.getField(),trigger=field&&field.trigger;
    return {analysisHash:semanticState.analysis&&semanticState.analysis.hash||0,lambdaRaw:lambda.value,target:semanticState.renderTarget||'',mode:field&&field.mode||'orbit',triggerToken:trigger&&trigger.token||''};
  },
  readRuntimeInput:function(){ return {running:worldState.running,worldTick:worldState.tick,lambda:+lambda.value/100,particles:reactionRuntimeParticles()}; },
  applyResult:applyReactionRuntimeResult,
  flushUi:flushReactionRuntimeUi
});
function makeIsland(token,role,i,n){
  var h=hash(token), reaction=reactionController.particle(i), u=reaction?reaction.u:(role==='core' ? .25 : role==='detail' ? .80 : role==='bridge' ? .53 : .58);
  var th=((h%10000)/10000 + i*Math.max(.07,PHI/n))%1;
  return {token:token,role:role,th:th,u:u,pulse:(h%628)/100,weight:1+(token.length%7)/7,reactionRole:reaction&&reaction.reactionRole||'carrier',baseReactionRole:reaction&&reaction.baseReactionRole||'carrier',q:reaction&&reaction.q||0,act:reaction&&reaction.act||0,thr:reaction&&reaction.thr||0,state:reaction&&reaction.state||'idle'};
}
function rebuildIslands(){
  worldState.islands=[]; worldState.links=[];
  if(!semanticState.analysis) return;
  for(var i=0;i<semanticState.analysis.tokens.length;i++) worldState.islands.push(makeIsland(semanticState.analysis.tokens[i],semanticState.analysis.roles[i],i,semanticState.analysis.tokens.length));
  if(semanticState.analysis.relations && semanticState.analysis.relations.length){
    for(var r=0;r<semanticState.analysis.relations.length && worldState.links.length<42;r++){
      var rel=semanticState.analysis.relations[r];
      if(rel.i<worldState.islands.length && rel.j<worldState.islands.length) worldState.links.push({from:rel.i,to:rel.j,type:rel.type,score:rel.score,reason:rel.reason});
    }
  }else{
    for(var j=1;j<worldState.islands.length;j++) worldState.links.push({from:j-1,to:j,type:'sequence',score:.2});
    for(var k=0;k<worldState.islands.length;k++) for(var m=k+2;m<worldState.islands.length;m++) if(worldState.islands[k].role===worldState.islands[m].role && worldState.links.length<36) worldState.links.push({from:k,to:m,type:'bridge',score:.35});
  }
}
function makeDrop(i){
  var role='neutral', label='', tokenIndex=-1, reaction=null, reactionRole='carrier';
  if(semanticState.analysis && semanticState.analysis.tokens.length){ tokenIndex=i%semanticState.analysis.tokens.length; role=semanticState.analysis.roles[tokenIndex]; label=semanticState.analysis.tokens[tokenIndex]; reaction=reactionController.particle(tokenIndex); }
  if(reaction) reactionRole=reaction.reactionRole==='seed'&&i!==reaction.index?reaction.baseReactionRole:reaction.reactionRole;
  var base=reaction?reaction.u:(role==='core' ? .28 : role==='detail' ? .76 : role==='bridge' ? .52 : .16+rnd()*.68);
  return {th:rnd(),u:clamp(base+(rnd()-.5)*.16,.08,.92),role:role,label:label,tokenIndex:tokenIndex,reactionRole:reactionRole,baseReactionRole:reaction&&reaction.baseReactionRole||'carrier',q:reaction&&reaction.q||0,act:reaction&&reaction.act||0,thr:reaction&&reaction.thr||0,reactionState:reaction&&reaction.state||'idle',spin:(rnd()-.5)*.0018,size:2.1+rnd()*4.1,phase:rnd()*TAU,id:i};
}
function resetWorld(){
  worldState.seed=(semanticState.analysis?semanticState.analysis.hash:987654321)>>>0; worldState.tick=0; worldState.coreHits=0; worldState.edgeHits=0; worldState.drops=[]; worldState.shards=[]; worldState.rings=[]; worldState.trace=[];
  for(var i=0;i<VISUAL_PARTICLE_COUNT;i++) worldState.drops.push(makeDrop(i));
  rebuildSemanticTraceParticleLookup();
  reactionController.initialize(); renderReactionField();
  events.innerHTML=''; worldState.running=true; pauseBtn.textContent='пауза'; pauseBtn.classList.remove('on');
  eventLine('старт: открытое кольцо, 0<u<1');
  if(semanticState.analysis && semanticState.analysis.tokens.length) eventLine('условие: '+semanticState.analysis.tokens.slice(0,8).join(' · '));
}
function renderSemanticSearch(){
  semanticState.searchTrace=searchAdapter.render();
  return semanticState.searchTrace;
}
function resolveClaimEvidenceText(result,request){
  var cascade=result&&result.evidenceCascade,passages=cascade&&cascade.locatedPassages||[],i,passage;
  for(i=0;i<passages.length;i++){
    passage=passages[i];
    if(passage.sourceRef.sourceId===request.sourceRef.sourceId&&passage.sourceRef.revision===request.sourceRef.revision&&
      passage.sourceRef.sourceHash===request.sourceRef.sourceHash&&passage.locator.start===request.locator.start&&
      passage.locator.end===request.locator.end&&passage.locator.sentenceIndex===request.locator.sentenceIndex&&
      passage.textHash===request.passageTextHash) return passage.text;
  }
  return null;
}
function renderClaimEvidenceUnavailable(code){
  if(!controlledClaimEvidenceEl) return;
  controlledClaimEvidenceEl.textContent='Кандидаты источников недоступны: '+String(code||'NOT_COMPUTED');
  controlledClaimEvidenceEl.dataset.status='NOT_COMPUTED';
  controlledClaimEvidenceEl.dataset.reviewStatus='NOT_COMPUTED';
  controlledClaimEvidenceEl.dataset.finalRelation='NOT_COMPUTED';
  controlledClaimEvidenceEl.dataset.candidateCount='0';
}
function renderEvidenceBackedLinkUnavailable(code){
  if(!evidenceBackedLinkEl) return;
  while(evidenceBackedLinkEl.firstChild) evidenceBackedLinkEl.removeChild(evidenceBackedLinkEl.firstChild);
  evidenceBackedLinkEl.textContent='EVIDENCE-BACKED LINK · '+String(code||'NOT_COMPUTED');
  evidenceBackedLinkEl.dataset.status='BLOCKED';
  evidenceBackedLinkEl.dataset.validationScope='NOT_PERFORMED';
  evidenceBackedLinkEl.dataset.referentialReplay='NOT_PERFORMED';
  evidenceBackedLinkEl.dataset.sourceAuthority='NOT_ASSESSED';
  evidenceBackedLinkEl.dataset.relationStatus='NOT_COMPUTED';
  evidenceBackedLinkEl.dataset.reviewStatus='REQUIRES_REVIEW';
  evidenceBackedLinkEl.dataset.finalRelation='NOT_COMPUTED';
  evidenceBackedLinkEl.dataset.commitAllowed='false';
  evidenceBackedLinkEl.dataset.proposalCount='0';
  evidenceBackedLinkEl.dataset.rejectionCount='0';
  evidenceBackedLinkEl.dataset.skippedCount='0';
}
function renderEvidenceBackedLinkPending(){
  if(!evidenceBackedLinkEl) return;
  while(evidenceBackedLinkEl.firstChild) evidenceBackedLinkEl.removeChild(evidenceBackedLinkEl.firstChild);
  evidenceBackedLinkEl.textContent='EVIDENCE-BACKED LINK | REPLAY PENDING';
  evidenceBackedLinkEl.dataset.status='PENDING';
  evidenceBackedLinkEl.dataset.validationScope='NOT_PERFORMED';
  evidenceBackedLinkEl.dataset.referentialReplay='NOT_PERFORMED';
  evidenceBackedLinkEl.dataset.sourceAuthority='NOT_ASSESSED';
  evidenceBackedLinkEl.dataset.relationStatus='NOT_COMPUTED';
  evidenceBackedLinkEl.dataset.reviewStatus='REQUIRES_REVIEW';
  evidenceBackedLinkEl.dataset.finalRelation='NOT_COMPUTED';
  evidenceBackedLinkEl.dataset.commitAllowed='false';
  evidenceBackedLinkEl.dataset.proposalCount='0';
  evidenceBackedLinkEl.dataset.rejectionCount='0';
  evidenceBackedLinkEl.dataset.skippedCount='0';
}
function renderEvidenceBackedLink(result){
  var payload,ticket;
  if(!evidenceBackedLinkEl) return null;
  if(!claimEvidenceCascade||!claimEvidenceCascade.index||
     !evidenceBackedLinkRunner||typeof evidenceBackedLinkRunner.project!=='function'||
     !EvidenceBackedLinkView||EvidenceBackedLinkView.status!=='READY'||typeof EvidenceBackedLinkView.render!=='function'){
    semanticState.evidenceBackedLinkModel=null;
    renderEvidenceBackedLinkUnavailable('P78_EVIDENCE_BACKED_LINK_STACK_UNAVAILABLE');
    return null;
  }
  try{
    payload=result&&result.evidenceCascade||result;
    renderEvidenceBackedLinkPending();
    ticket=evidenceBackedLinkRunner.project({
      targetText:controlledClaimInput.value.trim(),
      cascadeResult:payload,
      linguisticIndex:claimEvidenceCascade.index
    },function(outcome){
      if(!outcome||outcome.status!=='READY'||!outcome.model){
        semanticState.evidenceBackedLinkModel=null;
        renderEvidenceBackedLinkUnavailable(outcome&&outcome.code||'P78_EVIDENCE_BACKED_LINK_WORKER_ERROR');
        return;
      }
      try{
        EvidenceBackedLinkView.render(evidenceBackedLinkEl,outcome.model);
        semanticState.evidenceBackedLinkModel=outcome.model;
      }catch(renderError){
        semanticState.evidenceBackedLinkModel=null;
        renderEvidenceBackedLinkUnavailable(renderError&&renderError.code||'P78_EVIDENCE_BACKED_LINK_RENDER_ERROR');
      }
    });
    semanticState.evidenceBackedLinkRequestId=ticket.requestId;
    return ticket;
  }catch(linkError){
    semanticState.evidenceBackedLinkModel=null;
    renderEvidenceBackedLinkUnavailable(linkError&&linkError.code||'P78_EVIDENCE_BACKED_LINK_ERROR');
    return null;
  }
}
function renderSemanticFlow(result){
  var previous,delta=null,frame;
  if(!semanticFlowEl) return null;
  if(!SemanticFlowReducer||SemanticFlowReducer.status!=='READY'||typeof SemanticFlowReducer.reduce!=='function'||
    !SemanticFlowView||SemanticFlowView.status!=='READY'||typeof SemanticFlowView.render!=='function'){
    semanticState.semanticFlowFrame=null;
    semanticState.semanticFlowDelta=null;
    semanticFlowEl.textContent='2D FLOW \u00b7 UNAVAILABLE';
    semanticFlowEl.dataset.status='BLOCKED';
    return null;
  }
  try{
    previous=semanticState.semanticFlowFrame||null;
    frame=SemanticFlowReducer.reduce(result);
    if(previous&&typeof SemanticFlowReducer.createDelta==='function') delta=SemanticFlowReducer.createDelta(previous,frame);
    SemanticFlowView.render(semanticFlowEl,frame,delta);
    semanticState.semanticFlowDelta=delta;
    semanticState.semanticFlowFrame=frame;
    return frame;
  }catch(flowError){
    semanticState.semanticFlowFrame=null;
    semanticState.semanticFlowDelta=null;
    semanticFlowEl.textContent='2D FLOW \u00b7 '+String(flowError&&flowError.code||'FLOW_ERROR');
    semanticFlowEl.dataset.status='INVALID';
    return null;
  }
}
function renderControlledClaim(){
  var payload;
  semanticState.claimTrace=controlledClaimAdapter.render();
  payload=semanticState.claimTrace.evidenceCascade||semanticState.claimTrace;
  if(controlledClaimEvidenceEl&&EvidenceCandidateView&&typeof EvidenceCandidateView.render==='function'){
    try{
      EvidenceCandidateView.render(controlledClaimEvidenceEl,payload,{resolver:function(request){
        return resolveClaimEvidenceText(semanticState.claimTrace,request);
      }});
    }catch(evidenceViewError){
      renderClaimEvidenceUnavailable(evidenceViewError&&evidenceViewError.code||'P78_EVIDENCE_VIEW_ERROR');
    }
  }else renderClaimEvidenceUnavailable(claimEvidenceAvailabilityCode||'P78_EVIDENCE_CANDIDATE_VIEW_UNAVAILABLE');
  renderEvidenceBackedLink(semanticState.claimTrace);
  renderSemanticFlow(semanticState.claimTrace);
  return semanticState.claimTrace;
}
function applyCondition(){
  semanticState.renderSource=condition.value;
  semanticState.renderTarget=goalTarget&&goalTarget.value?goalTarget.value.trim():'';
  semanticState.analysis=analyze(condition.value);
  reactionController.recalculate(semanticState.analysis||condition.value,+lambda.value/100);
  worldState.signal=semanticState.analysis.force;
  rebuildIslands();
  renderTags();
  renderArchipelagoMap();
  renderWeaveMap();
  renderWindowRhythm();
  renderBacktrackMap();
  renderGoalMap();
  renderPhiMap();
  renderRailsMap();
  renderGuard();
  renderBalance();
  renderForecast();
  renderTrajectory();
  renderContinuationPlan();
  renderImpulse();
  semanticState.formulaTrace=formulaAdapter.render(condition.value,+lambda.value/100,true);
  renderSemanticSearch();
  renderMarginalCorridor();
  if(interfaceMode.snapshot().mode==='analysis') renderControlledClaim(); else semanticState.claimTrace=null;
  resetWorld();
  renderTextResult();
  renderTraceProof();
  renderContinuationProtocol();
  renderParameterCounterfactual();
  renderOutputMenu();
  eventLine('реакция: '+reactionName());
  if(semanticState.analysis.portal) eventLine('портал: '+semanticState.analysis.portal.op+' '+semanticState.analysis.portal.label);
  updatePanel();
}
function reactionName(){
  if(!semanticState.analysis) return 'нет условия';
  if(semanticState.analysis.conflicts && semanticState.analysis.conflicts.length) return 'конфликт смысла -> нужен мост';
  if(semanticState.analysis.core>.46 && semanticState.analysis.edge<.22) return 'слишком внутрь -> нужен пример';
  if(semanticState.analysis.edge>.46 && semanticState.analysis.core<.22) return 'слишком наружу -> нужна связка';
  if(semanticState.analysis.move>.36) return 'продолжение удерживает середину';
  return 'середина собирает ход';
}
function renderTags(){
  tagsEl.innerHTML='';
  if(!semanticState.analysis || !semanticState.analysis.tokens.length){ tagsEl.textContent=''; renderRadar(); return; }
  for(var i=0;i<semanticState.analysis.tokens.length;i++){
    var t=document.createElement('span'); t.className='tag '+semanticState.analysis.roles[i]; t.textContent=semanticState.analysis.tokens[i]; tagsEl.appendChild(t);
  }
  renderRadar();
  renderPortal();
}
function renderRadar(){
  if(!radarEl) return;
  radarEl.innerHTML='';
  if(!semanticState.analysis || !semanticState.analysis.graph){ radarEl.textContent='нет графа'; return; }
  var m=semanticState.analysis.graph.metrics||{}, summary=document.createElement('div');
  summary.className='radarSummary';
  var stats=[['fit',(semanticState.analysis.semFit||0).toFixed(2)],['LCA',(m.lcaAvg||0).toFixed(2)],['g↔',(m.gLink||0).toFixed(2)],['! ',String(m.conflictCount||0)]];
  for(var s=0;s<stats.length;s++){ var cell=document.createElement('div'); cell.innerHTML='<b>'+stats[s][1]+'</b><span>'+stats[s][0]+'</span>'; summary.appendChild(cell); }
  radarEl.appendChild(summary);
  var rels=(semanticState.analysis.graph.conflicts&&semanticState.analysis.graph.conflicts.length?semanticState.analysis.graph.conflicts:[]).concat(semanticState.analysis.graph.gaps||[]);
  if(!rels.length) rels=(semanticState.analysis.relations||[]).slice(0,5);
  for(var i=0;i<Math.min(6,rels.length);i++){
    var r=rels[i], row=document.createElement('div');
    row.className='radarRow '+r.type;
    var name=r.type==='conflict'?'стоп':r.type==='bridge'?'мост':'ряд';
    row.innerHTML='<b>'+name+'</b><span>'+r.a+' ↔ '+r.b+'</span><i>'+Number(r.score||0).toFixed(2)+'</i>';
    row.title=r.reason||'';
    radarEl.appendChild(row);
  }
}
function fallbackArchipelago(){
  var a=semanticState.analysis||analyze(condition.value), groups={}, clusters=[], rels=((a.graph&&a.graph.conflicts)||[]).concat((a.graph&&a.graph.gaps)||[]).concat((a.relations||[]).slice(0,4));
  for(var i=0;i<(a.tokens||[]).length;i++){
    var role=a.roles[i]||'neutral', key=role, g=groups[key];
    if(!g) g=groups[key]={id:key,label:role,role:role,names:[],score:0,weight:0,u:role==='core'?.3:role==='detail'?.78:role==='bridge'?.52:.6};
    g.names.push(a.tokens[i]); g.weight++;
  }
  for(var k in groups){ groups[k].score=clamp(.25+groups[k].weight/8,0,1); clusters.push(groups[k]); }
  var straits=[];
  for(i=0;i<rels.length;i++) straits.push({a:rels[i].a||'',b:rels[i].b||'',type:rels[i].type||'bridge',risk:(rels[i].type==='conflict'?'risk':'strait'),score:rels[i].score||.3,reason:rels[i].reason||'',op:'↔'});
  var best=straits[0]||null, gm=a.graph&&a.graph.metrics?a.graph.metrics:{};
  return {clusters:clusters,straits:straits,best:best,action:best?'открыть пролив «'+best.a+'» ↔ «'+best.b+'»':'держать острова в кольце',score:a.life||0,formula:'archipelago = group(tokens by role) + rank(straits)',metrics:{clusters:clusters.length,straits:straits.length,gLink:gm.gLink||0,lca:gm.lcaAvg||0,conflicts:gm.conflictCount||0,novelty:clusters.length/Math.max(1,(a.tokens||[]).length)}};
}
function archipelagoPack(){ return Semantic&&Semantic.semanticArchipelago?Semantic.semanticArchipelago(condition.value):fallbackArchipelago(); }
function renderArchipelagoMap(){
  if(!archipelagoMapEl) return;
  archipelagoMapEl.innerHTML=''; uiState.archipelagoPath=[]; semanticState.archipelago=archipelagoPack();
  var pack=semanticState.archipelago, metrics=pack.metrics||{};
  var head=document.createElement('div'); head.className='archHead';
  var title=document.createElement('b'); title.textContent='архипелаг · '+Number(pack.score||0).toFixed(2)+' · '+(pack.action||'');
  var formula=document.createElement('span'); formula.textContent=pack.formula||'';
  head.appendChild(title); head.appendChild(formula); archipelagoMapEl.appendChild(head);
  var m=document.createElement('div'); m.className='archMetrics';
  [['остр',metrics.clusters],['прол',metrics.straits],['g↔',metrics.gLink],['LCA',metrics.lca]].forEach(function(x){var d=document.createElement('div'), digits=(x[0]==='g↔'||x[0]==='LCA')?2:0; d.className='archMetric'; d.innerHTML='<b>'+((typeof x[1]==='number')?Number(x[1]).toFixed(digits):x[1]||0)+'</b><span>'+x[0]+'</span>'; m.appendChild(d);});
  archipelagoMapEl.appendChild(m);
  var clusters=(pack.clusters||[]).slice(0,4);
  for(var i=0;i<clusters.length;i++){
    var c=clusters[i], row=document.createElement('div'); row.className='archCluster '+(c.role||'neutral');
    row.innerHTML='<b>'+((c.label||'остров').slice(0,12))+'</b><span>'+((c.names||[]).slice(0,5).join(' · '))+'</span><i>'+Number(c.score||0).toFixed(2)+'</i>';
    archipelagoMapEl.appendChild(row);
  }
  var straits=(pack.straits||[]).slice(0,4);
  for(i=0;i<straits.length;i++){
    var s=straits[i], sr=document.createElement('div'); sr.className='archStrait '+(s.type||'bridge')+(i===0?' best':'');
    sr.title=s.reason||''; sr.innerHTML='<b>'+((s.type==='conflict')?'!':'↔')+'</b><span>'+s.a+' ↔ '+s.b+'</span><i>'+Number(s.score||0).toFixed(2)+'</i>';
    archipelagoMapEl.appendChild(sr);
    uiState.archipelagoPath.push({rank:i+1,a:s.a,b:s.b,type:s.type||'bridge',score:s.score||0,from:s.from,to:s.to});
  }
  var actions=document.createElement('div'); actions.className='archActions';
  var refresh=document.createElement('button'); refresh.type='button'; refresh.textContent='пересчитать'; refresh.onclick=renderArchipelagoMap;
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent='вставить мост'; apply.disabled=!(pack.best&&pack.best.a&&pack.best.b); apply.onclick=applyArchipelagoBridge;
  actions.appendChild(refresh); actions.appendChild(apply); archipelagoMapEl.appendChild(actions);
}
function applyArchipelagoBridge(){
  var pack=semanticState.archipelago&&semanticState.archipelago.best?semanticState.archipelago:archipelagoPack(), b=pack&&pack.best;
  if(!b) return;
  var line='RAG-мост: «'+b.a+'» связывается с «'+b.b+'»; пролив удерживает острова вместе и дает следующий ход.';
  commitSemanticAction(line,{id:'archipelago.bridge',label:'архипелаг',log:'архипелаг: мост '+b.a+' ↔ '+b.b,event:'архипелаг: вставлен мост '+b.a+' ↔ '+b.b});
}
function fallbackWeave(){
  var a=semanticState.analysis||analyze(condition.value), g=semanticState.guard||fallbackGuard(), arch=semanticState.archipelago||fallbackArchipelago(), best=arch.best||null;
  var topic=(a.tokens&&a.tokens[0])||'тема', fact=(a.tokens&&a.tokens[1])||topic, conflict=a.conflicts&&a.conflicts[0];
  var conflictOther=null;
  if(conflict){ conflictOther=topic===conflict.a?conflict.b:topic===conflict.b?conflict.a:(conflict.a+' / '+conflict.b); }
  var obstacle=conflict?conflictOther:(best?(best.a+' / '+best.b):fact), bridge=best?(best.a+' ↔ '+best.b):'мост';
  var next=continuationText().replace(/<[^>]*>/g,'').replace(/^дальше:\s*/,'')||'сделать следующий ход';
  var risk=(g.zone==='safe'?0:g.zone==='thin'?.12:.24)+((a.conflicts&&a.conflicts.length)||0)*.12;
  var openness=clamp((a.move||0)*.34+(a.life||0)*.34+((arch.metrics&&arch.metrics.gLink)||0)*.18,.05,1), score=clamp(openness-risk,0,1), K=g.zone==='conflict'?1:g.zone==='safe'?3:2;
  var slots=[{id:'topic',label:'тема',value:topic,role:'core',u:.30,score:a.core||.5},{id:'obstacle',label:'узел',value:obstacle,role:conflict?'detail':'neutral',u:conflict?.76:.58,score:best?best.score:.45},{id:'bridge',label:'мост',value:bridge,role:'bridge',u:.50,score:a.move||.45},{id:'action',label:'ход',value:conflict?'↔ поставить мост':'orbit продолжить',role:'bridge',u:.56,score:score},{id:'next',label:'строка',value:next,role:'bridge',u:.62,score:score}];
  var sentence='«'+topic+'» встречает «'+obstacle+'», проходит через «'+bridge+'» и делает ход: '+next;
  return {slots:slots,sentence:sentence,insertLine:'Смысловая сборка: '+sentence,score:score,verdict:score<.34?'каркас слабый: нужен ремонт':'каркас удерживает продолжение',formula:'weave = topic -> obstacle -> bridge -> action -> next',metrics:{slots:slots.length,K:K,openness:openness,risk:risk,confidence:score,gLink:(arch.metrics&&arch.metrics.gLink)||0,lca:(arch.metrics&&arch.metrics.lca)||0,conflicts:(a.conflicts&&a.conflicts.length)||0}};
}
function weavePack(){ return Semantic&&Semantic.semanticWeave?Semantic.semanticWeave(condition.value):fallbackWeave(); }
function renderWeaveMap(){
  if(!weaveMapEl) return;
  weaveMapEl.innerHTML=''; uiState.weavePath=[]; semanticState.weave=weavePack();
  var pack=semanticState.weave, metrics=pack.metrics||{};
  var head=document.createElement('div'); head.className='weaveHead';
  var title=document.createElement('b'); title.textContent='сборка · '+Number(pack.score||0).toFixed(2)+' · окно K='+((metrics.K==null)?'-':metrics.K);
  var formula=document.createElement('span'); formula.textContent=pack.formula||'';
  head.appendChild(title); head.appendChild(formula); weaveMapEl.appendChild(head);
  var m=document.createElement('div'); m.className='weaveMetrics';
  [['слот',metrics.slots],['K',metrics.K],['open',metrics.openness],['risk',metrics.risk]].forEach(function(x){var d=document.createElement('div'), digits=(x[0]==='open'||x[0]==='risk')?2:0; d.className='weaveMetric'; d.innerHTML='<b>'+((typeof x[1]==='number')?Number(x[1]).toFixed(digits):x[1]||0)+'</b><span>'+x[0]+'</span>'; m.appendChild(d);});
  weaveMapEl.appendChild(m);
  var slots=(pack.slots||[]).slice(0,5);
  for(var i=0;i<slots.length;i++){
    var s=slots[i], row=document.createElement('div'); row.className='weaveSlot '+(s.role||'neutral'); row.title=s.note||'';
    var b=document.createElement('b'); b.textContent=s.label||('шаг '+(i+1));
    var span=document.createElement('span'); span.textContent=s.value||'';
    var score=document.createElement('i'); score.textContent=Number(s.score||0).toFixed(2);
    row.appendChild(b); row.appendChild(span); row.appendChild(score); weaveMapEl.appendChild(row);
    uiState.weavePath.push({rank:i+1,label:s.label||'',role:s.role||'neutral',u:s.u||.5,score:s.score||0});
  }
  var line=document.createElement('div'); line.className='weaveLine'; line.textContent=pack.sentence||pack.verdict||''; weaveMapEl.appendChild(line);
  var actions=document.createElement('div'); actions.className='weaveActions';
  var refresh=document.createElement('button'); refresh.type='button'; refresh.textContent='пересчитать'; refresh.onclick=renderWeaveMap;
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent='вставить строку'; apply.disabled=!(pack.insertLine||pack.sentence); apply.onclick=applyWeaveLine;
  actions.appendChild(refresh); actions.appendChild(apply); weaveMapEl.appendChild(actions);
}
function applyWeaveLine(){
  var pack=semanticState.weave||weavePack(), line=pack.insertLine||pack.sentence;
  if(!line) return;
  commitSemanticAction(line,{id:'weave.line',label:'смысловая сборка',log:'сборка: вставлен каркас',event:'сборка: вставлена строка продолжения'});
}
function fallbackWindowRhythm(){
  var w=semanticState.weave||fallbackWeave(), a=semanticState.analysis||analyze(condition.value), K=Math.max(1,Math.min(5,(w.metrics&&w.metrics.K)||2));
  var slots=w.slots||[], byId={}, graph=a.graph||{}; for(var i=0;i<slots.length;i++) byId[slots[i].id]=slots[i];
  var topic=(byId.topic&&byId.topic.value)||(a.tokens&&a.tokens[0])||'тема', candidate=(byId.obstacle&&byId.obstacle.value)||(a.tokens&&a.tokens[1])||topic, bridge=(byId.bridge&&byId.bridge.value)||'мост';
  var conflict=a.conflicts&&a.conflicts[0], phase=conflict?K:(hash(condition.value+'|window|'+K)%(K+1)), open=phase>=K, gate=conflict?.24:clamp((a.semFit||0)*.7+(a.move||0)*.3,0,1), theta=conflict?.45:.34;
  var mode=!open?'repeat':conflict?'bridge':gate>=theta?'admit':'block', beats=[];
  for(var b=0;b<K;b++) beats.push({index:b+1,label:'повтор '+(b+1),kind:'repeat',active:phase===b,role:'bridge',value:'«'+topic+'» через «'+bridge+'»',u:.46,score:w.score||.5});
  beats.push({index:K+1,label:'окно',kind:mode,active:open,role:mode==='bridge'||mode==='block'?'detail':'bridge',value:open?'«'+candidate+'»':'ожидание окна',u:open?.72:.55,score:gate});
  var action=mode==='repeat'?'повторить связку и ждать окна':mode==='bridge'?'впустить через мост':mode==='admit'?'впустить новизну':'заблокировать и сохранить петлю';
  var insertLine=mode==='repeat'?'Оконный ритм: повтор '+Math.max(1,phase+1)+'/'+K+' — «'+topic+'» удерживается через «'+bridge+'»; окно новизны пока закрыто.':mode==='bridge'?'Оконный ритм: окно открыто; «'+candidate+'» допускается только через «'+bridge+'», чтобы конфликт стал продолжением.':mode==='admit'?'Оконный ритм: окно открыто; «'+candidate+'» входит в тему «'+topic+'» и дает следующий ход.':'Оконный ритм: окно открыто, но «'+candidate+'» не проходит SemFit-порог; петля сохраняется через «'+bridge+'».';
  var score=clamp((open?.22:.10)+(w.score||0)*.42+(mode==='admit'?.22:mode==='bridge'?.16:mode==='repeat'?.12:-.08)+Math.max(0,gate-theta)*.35,0,1);
  return {weave:w,K:K,phase:phase,open:open,mode:mode,topic:topic,candidate:candidate,bridge:bridge,gate:gate,theta:theta,beats:beats,action:action,insertLine:insertLine,score:score,formula:'window = repeat(loop,K) -> open(candidate if SemFit >= theta else bridge/block)',metrics:{K:K,phase:phase+1,cycle:K+1,gate:gate,theta:theta,score:score,open:open?1:0,conflicts:(graph.metrics&&graph.metrics.conflictCount)||0}};
}
function windowRhythmPack(){ return Semantic&&Semantic.semanticWindowRhythm?Semantic.semanticWindowRhythm(condition.value):fallbackWindowRhythm(); }
function renderWindowRhythm(){
  if(!windowMapEl) return;
  windowMapEl.innerHTML=''; uiState.windowPath=[]; semanticState.windowRhythm=windowRhythmPack();
  var pack=semanticState.windowRhythm, metrics=pack.metrics||{};
  var source=Semantic&&Semantic.semanticWindowRhythm?'core '+(Semantic.version||''):'fallback';
  var head=document.createElement('div'); head.className='windowHead';
  var title=document.createElement('b'); title.textContent='окно · '+(pack.open?'открыто':'закрыто')+' · K='+((metrics.K==null)?'-':metrics.K);
  var formula=document.createElement('span'); formula.textContent=pack.formula||'';
  head.appendChild(title); head.appendChild(formula); windowMapEl.appendChild(head);
  var m=document.createElement('div'); m.className='windowMetrics';
  [['такт',metrics.phase],['цикл',metrics.cycle],['gate',metrics.gate],['θ',metrics.theta],['ядро',source]].forEach(function(x){var d=document.createElement('div'), digits=(x[0]==='gate'||x[0]==='θ')?2:0; d.className='windowMetric'; d.innerHTML='<b>'+((typeof x[1]==='number')?Number(x[1]).toFixed(digits):x[1]||0)+'</b><span>'+x[0]+'</span>'; m.appendChild(d);});
  windowMapEl.appendChild(m);
  var list=document.createElement('div'); list.className='windowBeats';
  var beats=pack.beats||[];
  for(var i=0;i<beats.length;i++){
    var bt=beats[i], row=document.createElement('div'); row.className='windowBeat '+(bt.active?'active ':'')+(bt.kind||bt.role||'repeat');
    row.innerHTML='<b>'+bt.label+'</b><span>'+bt.value+'</span><i>'+Number(bt.score||0).toFixed(2)+'</i>'; list.appendChild(row);
    uiState.windowPath.push({rank:i+1,active:!!bt.active,kind:bt.kind||'repeat',role:bt.role||'bridge',u:bt.u||.5,score:bt.score||0});
  }
  windowMapEl.appendChild(list);
  var line=document.createElement('div'); line.className='windowLine'; line.textContent=pack.action||''; windowMapEl.appendChild(line);
  var actions=document.createElement('div'); actions.className='windowActions';
  var refresh=document.createElement('button'); refresh.type='button'; refresh.textContent='пересчитать'; refresh.onclick=renderWindowRhythm;
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent=pack.open?'применить окно':'повторить'; apply.disabled=!(pack.insertLine); apply.onclick=applyWindowRhythm;
  actions.appendChild(refresh); actions.appendChild(apply); windowMapEl.appendChild(actions);
}
function applyWindowRhythm(){
  var pack=semanticState.windowRhythm||windowRhythmPack(), line=pack.insertLine;
  if(!line) return;
  commitSemanticAction(line,{id:'window.rhythm',label:'оконный ритм',log:'окно: '+(pack.mode||'ритм'),event:'окно: '+(pack.action||'ритм применен')});
}

function fallbackBacktrack(){
  var pack=fallbackTrajectory(condition.value,2), steps=pack.steps||[], attempts=[], path=[];
  for(var i=0;i<steps.length;i++){
    var s=steps[i], ok=s.after&&(s.after.zone==='safe'||s.after.zone==='thin');
    var a={step:s.step||i+1,branch:i+1,label:s.label||'ход',op:s.op||'orbit',line:s.line||'',text:s.text,status:ok?'accept':'rollback',reason:ok?'ветка остается в 2D-кольце':'ветка требует отката',score:s.score||0,before:s.before,after:s.after,u:(s.after&&s.after.u)||.5,zone:(s.after&&s.after.zone)||'safe'};
    attempts.push(a); if(ok){ a.chosen=true; path.push(a); }
  }
  var last=path[path.length-1]||null;
  return {text:pack.text,attempts:attempts,path:path,best:last,count:attempts.length,rejected:attempts.length-path.length,accepted:path.length,formula:'backtrack = try(branch) -> guard; reject(center|edge|conflict) -> rollback; accept(0<u<1)',verdict:pack.verdict||'резервный поиск с откатом',metrics:{attempts:attempts.length,rejected:attempts.length-path.length,accepted:path.length,guard:(pack.last&&pack.last.score)||0,u:(pack.last&&pack.last.u)||.5}};
}
function backtrackPack(){ return Semantic&&Semantic.semanticBacktrack?Semantic.semanticBacktrack(condition.value,2,5):fallbackBacktrack(); }
function renderBacktrackMap(){
  if(!backtrackMapEl) return;
  backtrackMapEl.innerHTML=''; uiState.backtrackPath=[]; semanticState.backtrack=backtrackPack();
  var pack=semanticState.backtrack||{}, metrics=pack.metrics||{}, best=pack.best||null;
  var head=document.createElement('div'); head.className='backtrackHead';
  var title=document.createElement('b'); title.textContent='откат · '+(pack.verdict||'поиск')+' · '+Number(metrics.guard||0).toFixed(2);
  var formula=document.createElement('span'); formula.textContent=pack.formula||'';
  head.appendChild(title); head.appendChild(formula); backtrackMapEl.appendChild(head);
  var m=document.createElement('div'); m.className='backtrackMetrics';
  [['проб',metrics.attempts],['откат',metrics.rejected],['ход',metrics.accepted],['u',metrics.u]].forEach(function(x){var d=document.createElement('div'), digits=x[0]==='u'?2:0; d.className='backtrackMetric'; d.innerHTML='<b>'+((typeof x[1]==='number')?Number(x[1]).toFixed(digits):x[1]||0)+'</b><span>'+x[0]+'</span>'; m.appendChild(d);});
  backtrackMapEl.appendChild(m);
  var attempts=(pack.attempts||[]).slice(0,7);
  for(var i=0;i<attempts.length;i++){
    var a=attempts[i], row=document.createElement('div'); row.className='backtrackStep '+(a.status||'accept')+(a.chosen?' chosen':''); row.title=(a.reason||'')+String.fromCharCode(10)+(a.formula||'');
    var place=document.createElement('b'); place.textContent=(a.status==='rollback'?'↺':'✓')+String(a.branch||i+1);
    var text=document.createElement('span'); text.textContent=(a.op||'orbit')+' · '+(a.label||'ход')+' · '+((a.after&&a.after.zone)||a.zone||'safe')+' · '+(a.line||'').slice(0,90);
    var score=document.createElement('i'); score.textContent=Number(a.score||0).toFixed(2);
    row.appendChild(place); row.appendChild(text); row.appendChild(score); backtrackMapEl.appendChild(row);
    uiState.backtrackPath.push({rank:i+1,status:a.status||'accept',chosen:!!a.chosen,u:a.u||((a.after&&a.after.u)||.5),score:a.score||0,zone:(a.after&&a.after.zone)||a.zone||'safe'});
  }
  var line=document.createElement('div'); line.className='backtrackLine'; line.textContent=best?(best.reason+' · '+(best.line||'')):(pack.verdict||'нет выбранной ветки'); backtrackMapEl.appendChild(line);
  var actions=document.createElement('div'); actions.className='backtrackActions';
  var refresh=document.createElement('button'); refresh.type='button'; refresh.textContent='пересчитать'; refresh.onclick=renderBacktrackMap;
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent='применить путь'; apply.disabled=!(pack.text&&pack.text!==condition.value);
  apply.onclick=applyBacktrackAction;
  actions.appendChild(refresh); actions.appendChild(apply); backtrackMapEl.appendChild(actions);
}
function applyBacktrackAction(){
  var pack=semanticState.backtrack&&semanticState.backtrack.text?semanticState.backtrack:backtrackPack();
  if(!pack||!pack.text||pack.text===condition.value) return;
  commitSemanticText(pack.text,{id:'backtrack.path',label:'поиск с откатом',log:'откат: выбран путь '+(pack.accepted||0),event:'откат: применен выбранный путь'});
}


function fallbackGoal(){
  var g=semanticState.guard||fallbackGuard(), back=semanticState.backtrack||fallbackBacktrack(), ok=g.zone==='safe'||g.zone==='thin', target=goalTarget&&goalTarget.value?goalTarget.value.trim():'';
  var pathScore=(back.accepted||0)/Math.max(1,(back.accepted||0)+(back.rejected||0));
  var score=clamp((g.score||0)*.62+pathScore*.24+((semanticState.analysis&&semanticState.analysis.life)||0)*.14,0,1);
  var status=!ok?'repair':score>.72?'homeostasis':'continue';
  var line=status==='repair'?'Цель-гомеостаз: сначала нужен ремонт или откат.':'Цель-гомеостаз: удержать текст в живом кольце и продолжить через мост.';
  return {status:status,score:score,homeostasis:score,action:status==='homeostasis'?'гомеостаз достигнут':'продолжать до гомеостаза',insertLine:line,formula:'goal = homeostasis(guard + accepted_path + life + bridge) + optional targetFit',metrics:{guard:g.score||0,path:pathScore,target:target?0:0,homeostasis:score,score:score,accepted:back.accepted||0,rejected:back.rejected||0,u:g.u||.5},steps:[{label:'guard',value:g.zone||'safe',score:g.score||0,u:g.u||.5,kind:ok?'accept':'rollback'},{label:'откат',value:(back.accepted||0)+' ok',score:pathScore,u:.5,kind:pathScore>.34?'accept':'rollback'},{label:target?'мишень':'гомео',value:target||'0<u<1',score:score,u:.5,kind:status},{label:'итог',value:status,score:score,u:g.u||.5,kind:status}]};
}
function goalPack(){ return Semantic&&Semantic.semanticGoal?Semantic.semanticGoal(condition.value,goalTarget&&goalTarget.value?goalTarget.value.trim():''):fallbackGoal(); }
function renderGoalMap(){
  if(!goalMapEl) return;
  goalMapEl.innerHTML=''; uiState.goalPath=[]; semanticState.goal=goalPack();
  semanticState.goal._sourceSnapshot=condition.value; semanticState.goal._targetSnapshot=semanticActionTarget();
  var pack=semanticState.goal||{}, metrics=pack.metrics||{};
  var head=document.createElement('div'); head.className='goalHead';
  var title=document.createElement('b'); title.textContent='цель · '+(pack.status||'continue')+' · '+Number(pack.score||0).toFixed(2);
  var formula=document.createElement('span'); formula.textContent=pack.formula||'';
  head.appendChild(title); head.appendChild(formula); goalMapEl.appendChild(head);
  var m=document.createElement('div'); m.className='goalMetrics';
  [['guard',metrics.guard],['путь',metrics.path],['цель',metrics.target],['гомео',metrics.homeostasis]].forEach(function(x){var d=document.createElement('div'); d.className='goalMetric'; d.innerHTML='<b>'+Number(x[1]||0).toFixed(2)+'</b><span>'+x[0]+'</span>'; m.appendChild(d);});
  goalMapEl.appendChild(m);
  var steps=pack.steps||[];
  for(var i=0;i<steps.length;i++){
    var s=steps[i], row=document.createElement('div'); row.className='goalStep '+(s.kind||pack.status||'continue');
    var gb=document.createElement('b'); gb.textContent=String(s.label||'шаг');
    var gs=document.createElement('span'); gs.textContent=String(s.value||'');
    var gi=document.createElement('i'); gi.textContent=Number(s.score||0).toFixed(2);
    row.appendChild(gb); row.appendChild(gs); row.appendChild(gi); goalMapEl.appendChild(row);
    uiState.goalPath.push({rank:i+1,kind:s.kind||pack.status||'continue',u:s.u||.5,score:s.score||0});
  }
  var line=document.createElement('div'); line.className='goalLine'; line.textContent=pack.action||pack.insertLine||''; goalMapEl.appendChild(line);
  var actions=document.createElement('div'); actions.className='goalActions';
  var refresh=document.createElement('button'); refresh.type='button'; refresh.textContent='пересчитать'; refresh.onclick=renderGoalMap;
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent='вставить цель'; apply.disabled=!(pack.insertLine); apply.onclick=applyGoalAction;
  actions.appendChild(refresh); actions.appendChild(apply); goalMapEl.appendChild(actions);
}
function applyGoalAction(){
  var pack=semanticState.goal||goalPack(), line=pack&&pack.insertLine;
  if(!line) return;
  commitSemanticAction(line,{id:'goal.homeostasis',label:'цель',log:'цель: '+(pack.status||'гомеостаз'),event:'цель: '+(pack.action||pack.status||'гомеостаз'),expectedSource:pack._sourceSnapshot,expectedTarget:pack._targetSnapshot});
}


function fallbackPhi(){
  var g=semanticState.guard||fallbackGuard(), ok=g.zone==='safe'||g.zone==='thin', n=(semanticState.analysis&&semanticState.analysis.tokens&&semanticState.analysis.tokens.length)||1;
  var growth=((semanticState.analysis&&semanticState.analysis.life)||0)*.48+((semanticState.analysis&&semanticState.analysis.move)||0)*.32, novelty=Math.min(1,n/8), openness=ok?.52:.18, balance=g.score||0;
  var phi=Math.sqrt(Math.max(0,growth*novelty*openness*balance));
  var status=!ok?'repair':phi>.72?'alive':phi<.38?'stall':'continue';
  return {status:status,score:phi,action:status==='alive'?'живое продолжение удержано':'усилить рост, новизну и открытость',insertLine:'Φ: добавить связную новую кроху и оставить следующий ход открытым.',formula:'Φ = sqrt(growth × novelty × openness × balance)',metrics:{growth:growth,novelty:novelty,openness:openness,balance:balance,phi:phi},axes:[{label:'рост',value:'life+move',score:growth,u:.42,kind:growth>.35?'accept':'stall'},{label:'новизна',value:n+' ток.',score:novelty,u:.58,kind:'accept'},{label:'κ open',value:'ход открыт',score:openness,u:.55,kind:openness>.35?'accept':'closed'},{label:'баланс',value:g.zone||'safe',score:balance,u:g.u||.5,kind:ok?'accept':'repair'}]};
}
function phiPack(){ return Semantic&&Semantic.semanticPhi?Semantic.semanticPhi(condition.value):fallbackPhi(); }
function renderPhiMap(){
  if(!phiMapEl) return;
  phiMapEl.innerHTML=''; uiState.phiPath=[]; semanticState.phi=phiPack();
  var pack=semanticState.phi||{}, metrics=pack.metrics||{};
  var head=document.createElement('div'); head.className='phiHead';
  var title=document.createElement('b'); title.textContent='Φ · '+(pack.status||'continue')+' · '+Number(pack.score||0).toFixed(2);
  var formula=document.createElement('span'); formula.textContent=pack.formula||'';
  head.appendChild(title); head.appendChild(formula); phiMapEl.appendChild(head);
  var m=document.createElement('div'); m.className='phiMetrics';
  [['рост',metrics.growth],['нов',metrics.novelty],['κ',metrics.openness],['бал',metrics.balance]].forEach(function(x){var d=document.createElement('div'); d.className='phiMetric'; d.innerHTML='<b>'+Number(x[1]||0).toFixed(2)+'</b><span>'+x[0]+'</span>'; m.appendChild(d);});
  phiMapEl.appendChild(m);
  var axes=pack.axes||[];
  for(var i=0;i<axes.length;i++){
    var a=axes[i], row=document.createElement('div'); row.className='phiStep '+(a.kind||pack.status||'continue');
    var b=document.createElement('b'); b.textContent=String(a.label||'ось');
    var s=document.createElement('span'); s.textContent=String(a.value||'');
    var score=document.createElement('i'); score.textContent=Number(a.score||0).toFixed(2);
    row.appendChild(b); row.appendChild(s); row.appendChild(score); phiMapEl.appendChild(row);
    uiState.phiPath.push({rank:i+1,kind:a.kind||pack.status||'continue',u:a.u||.5,score:a.score||0});
  }
  var line=document.createElement('div'); line.className='phiLine'; line.textContent=pack.action||pack.insertLine||''; phiMapEl.appendChild(line);
  var actions=document.createElement('div'); actions.className='phiActions';
  var refresh=document.createElement('button'); refresh.type='button'; refresh.textContent='пересчитать'; refresh.onclick=renderPhiMap;
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent='вставить Φ'; apply.disabled=!(pack.insertLine); apply.onclick=applyPhiAction;
  actions.appendChild(refresh); actions.appendChild(apply); phiMapEl.appendChild(actions);
}
function applyPhiAction(){
  var pack=semanticState.phi||phiPack(), line=pack&&pack.insertLine;
  if(!line) return;
  commitSemanticAction(line,{id:'phi.action',label:'разумность Φ',log:'Φ: '+(pack.status||'продолжение'),event:'Φ: '+(pack.action||pack.status||'продолжение')});
}


function fallbackRails(){
  var g=semanticState.guard||fallbackGuard(), ok=g.zone==='safe'||g.zone==='thin', a=semanticState.analysis||analyze(condition.value), tokens=a.tokens||[];
  var theme=(tokens[0]||'тема'), detail=(tokens[1]||'деталь'), bridge='мост', action=tokens.length>2?'ход':'';
  var open=/продолж|след|дальше|ход/i.test(condition.value||'')?1:.35;
  var score=(theme?.20:0)+(action?.24:0)+.18+(detail?.20:0)+open*.18;
  var status=!ok?'repair':!action?'need_action':open<.5?'need_open':'complete';
  return {status:status,score:score,action:status==='complete'?'фразовый скелет держится':'нужен ремонт фразового скелета',insertLine:'Рельсы: «'+theme+'» делает ход через «'+bridge+'» к «'+detail+'»; следующий ход открыт.',formula:'rails = theme + action + bridge + detail + open_next',metrics:{theme:1,action:action?1:0,bridge:1,detail:detail?1:0,open:open,score:score,guard:g.score||0},slots:[{label:'тема',value:theme,score:1,u:.34,kind:'accept'},{label:'действие',value:action||'нет действия',score:action?1:0,u:.45,kind:action?'accept':'missing'},{label:'мост',value:bridge,score:1,u:.54,kind:'accept'},{label:'деталь',value:detail,score:detail?1:0,u:.68,kind:detail?'accept':'missing'},{label:'дальше',value:open>.5?'открыто':'нужен ход',score:open,u:.58,kind:open>.5?'accept':'missing'}]};
}
function railsPack(){ return Semantic&&Semantic.semanticRails?Semantic.semanticRails(condition.value):fallbackRails(); }
function renderRailsMap(){
  if(!railsMapEl) return;
  railsMapEl.innerHTML=''; uiState.railsPath=[]; semanticState.rails=railsPack();
  var pack=semanticState.rails||{}, metrics=pack.metrics||{};
  var head=document.createElement('div'); head.className='railsHead';
  var title=document.createElement('b'); title.textContent='рельсы · '+(pack.status||'complete')+' · '+Number(pack.score||0).toFixed(2);
  var formula=document.createElement('span'); formula.textContent=pack.formula||'';
  head.appendChild(title); head.appendChild(formula); railsMapEl.appendChild(head);
  var m=document.createElement('div'); m.className='railsMetrics';
  [['тем',metrics.theme],['акт',metrics.action],['мост',metrics.bridge],['open',metrics.open]].forEach(function(x){var d=document.createElement('div'); d.className='railsMetric'; d.innerHTML='<b>'+Number(x[1]||0).toFixed(2)+'</b><span>'+x[0]+'</span>'; m.appendChild(d);});
  railsMapEl.appendChild(m);
  var slots=pack.slots||[];
  for(var i=0;i<slots.length;i++){
    var sl=slots[i], row=document.createElement('div'); row.className='railsStep '+(sl.kind||pack.status||'complete');
    var b=document.createElement('b'); b.textContent=String(sl.label||'слот');
    var s=document.createElement('span'); s.textContent=String(sl.value||'');
    var score=document.createElement('i'); score.textContent=Number(sl.score||0).toFixed(2);
    row.appendChild(b); row.appendChild(s); row.appendChild(score); railsMapEl.appendChild(row);
    uiState.railsPath.push({rank:i+1,kind:sl.kind||pack.status||'complete',u:sl.u||.5,score:sl.score||0});
  }
  var line=document.createElement('div'); line.className='railsLine'; line.textContent=pack.action||pack.insertLine||''; railsMapEl.appendChild(line);
  var actions=document.createElement('div'); actions.className='railsActions';
  var refresh=document.createElement('button'); refresh.type='button'; refresh.textContent='пересчитать'; refresh.onclick=renderRailsMap;
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent='вставить рельсы'; apply.disabled=!(pack.insertLine); apply.onclick=applyRailsAction;
  actions.appendChild(refresh); actions.appendChild(apply); railsMapEl.appendChild(actions);
}
function applyRailsAction(){
  var pack=semanticState.rails||railsPack(), line=pack&&pack.insertLine;
  if(!line) return;
  commitSemanticAction(line,{id:'rails.action',label:'рельсы',log:'рельсы: '+(pack.status||'скелет'),event:'рельсы: '+(pack.action||pack.status||'скелет')});
}


function initializeSemanticDataEvidence(){
  var engine=window.MRDSemanticDataEvidence;
  if(!engine||typeof engine.load!=='function'){ canvas.dataset.dataStatus='UNAVAILABLE'; return null; }
  semanticState.data=engine.snapshot?engine.snapshot():null;
  canvas.dataset.dataStatus=semanticState.data&&semanticState.data.status||'LOADING';
  semanticState.dataLoadPromise=engine.load({vectors:'data/vectors.json',phiCalibration:'data/phi_calibration.json',adaptiveK:'data/adaptive_k.json'}).then(function(snapshot){
    semanticState.data=snapshot; canvas.dataset.dataStatus=snapshot&&snapshot.status||'UNAVAILABLE';
    renderContinuationProtocol(); renderTextResult();
    var label=snapshot&&snapshot.status||'UNAVAILABLE', count=snapshot&&snapshot.vectorCount||0, provider=snapshot&&snapshot.provider||'none';
    eventLine('данные: '+label+' · '+provider+' · '+count+' опор · влияние не более 5%');
    return snapshot;
  },function(reason){
    semanticState.data=engine.snapshot?engine.snapshot():null; canvas.dataset.dataStatus='UNAVAILABLE';
    renderContinuationProtocol(); renderTextResult(); eventLine('данные: UNAVAILABLE · решения работают без корпуса');
    return reason;
  });
  return semanticState.dataLoadPromise;
}
function semanticOutputContext(observed){
  var target=goalTarget&&goalTarget.value?goalTarget.value.trim():'';
  if(observed===undefined) observed=reactionController.snapshot();
  return {
    lambda:+lambda.value/100,reaction:reactionState.field,observed:observed,
    precomputed:{
      source:condition.value,target:target,analysis:semanticState.analysis,guard:semanticState.guard,
      rails:semanticState.rails,phi:semanticState.phi,goal:semanticState.goal
    }
  };
}
function textResultPack(){
  var context=semanticOutputContext();
  var pack=window.MRDTextResult&&window.MRDTextResult.summarize?window.MRDTextResult.summarize(condition.value,context.precomputed.target,context):null;
  return MarginalCorridor.decorateTextResult(pack,semanticState.marginalCorridor);
}
function updateSemanticTraceOverlay(){
  var view=window.MRDSemanticTraceView,continuation=semanticState.textResult&&semanticState.textResult.traceContinuation;
  semanticState.traceOverlay=view&&typeof view.build==='function'?view.build(continuation,worldState.drops):null;
  var metrics=semanticState.traceOverlay&&semanticState.traceOverlay.metrics||{};
  canvas.dataset.traceStatus=semanticState.traceOverlay&&semanticState.traceOverlay.status||'EMPTY';
  canvas.dataset.traceOrigin=semanticState.traceOverlay&&semanticState.traceOverlay.origin||'none';
  canvas.dataset.traceWitnesses=String(metrics.mappedWitnesses||0);
  canvas.dataset.traceEdges=String(metrics.mappedEdges||0);
  canvas.dataset.traceHash=semanticState.traceOverlay&&semanticState.traceOverlay.traceHash||'';
}
function renderTextResult(){
  if(!textResultEl) return;
  semanticState.textResult=textResultPack();
  updateSemanticTraceOverlay();
  var view=window.MRDSemanticOutputView;
  if(view&&typeof view.renderText==='function'){
    view.renderText(textResultEl,semanticState.textResult||{},{onRefresh:renderTextResult,onApply:applyTextResult});
    return;
  }
  textResultEl.textContent=semanticState.textResult&&semanticState.textResult.summary||'Нет расчета.';
}
function parameterCounterfactualPack(){
  var engine=window.MRDSemanticParameterCounterfactual;
  return engine&&typeof engine.compare==='function'?engine.compare(condition.value,goalTarget&&goalTarget.value?goalTarget.value.trim():'',+lambda.value/100,{span:.12,analysis:semanticState.analysis,rails:semanticState.rails}):null;
}
function renderParameterCounterfactual(){
  if(!parameterCounterfactualEl) return;
  semanticState.parameterCounterfactual=parameterCounterfactualPack();
  var view=window.MRDSemanticParameterView;
  if(view&&typeof view.render==='function'){ view.render(parameterCounterfactualEl,semanticState.parameterCounterfactual||{}); return; }
  parameterCounterfactualEl.textContent=semanticState.parameterCounterfactual&&semanticState.parameterCounterfactual.summary||'Нет контрфактического расчета.';
}
function scheduleParameterCounterfactual(){
  if(uiState.parameterCounterfactualScheduled) return;
  uiState.parameterCounterfactualScheduled=true;
  scheduleIdle(function(){ uiState.parameterCounterfactualScheduled=false; renderParameterCounterfactual(); },220);
}
function applyTextResult(){
  var pack=semanticState.textResult||textResultPack(), line=pack&&pack.insertLine;
  if(!line) return;
  commitSemanticAction(line,{id:'text.result',label:'текстовый вывод',log:'вывод: '+(pack.status||'результат'),event:'вывод: '+(pack.status||'результат')});
}
function outputMenuPack(){
  var observed=semanticState.textResult&&semanticState.textResult.observed;
  var context=semanticOutputContext(observed===undefined?undefined:observed);
  context.textResult=semanticState.textResult;
  return window.MRDOutputMenu&&window.MRDOutputMenu.build?window.MRDOutputMenu.build(condition.value,context.precomputed.target,context):null;
}
function renderOutputMenu(){
  if(!outputMenuEl) return;
  semanticState.outputMenu=outputMenuPack();
  var view=window.MRDSemanticOutputView;
  if(view&&typeof view.renderMenu==='function'){
    view.renderMenu(outputMenuEl,semanticState.outputMenu||{},{onApplyItem:applyOutputItem});
    return;
  }
  outputMenuEl.textContent=semanticState.outputMenu&&semanticState.outputMenu.summary||'нет вариантов вывода';
}
function semanticActionCode(value){
  var first=value&&value.errors&&value.errors[0];
  return value&&(value.code||value.errorCode)||(first&&first.code)||value&&value.status||'ACTION_BLOCKED';
}
function semanticActionTarget(){ return goalTarget&&goalTarget.value?goalTarget.value.trim():''; }
function semanticOutcomeTransactionId(outcome){
  return outcome&&((outcome.receipt&&outcome.receipt.transactionId)||(outcome.transaction&&outcome.transaction.transactionId)||(outcome.plan&&outcome.plan.transaction&&outcome.plan.transaction.transactionId))||'tx';
}
function finishSemanticOutcome(outcome,meta){
  meta=meta||{};
  if(!outcome){ eventLine((meta.label||meta.id||'действие')+': ACTION_CONTROLLER_EMPTY'); return false; }
  var code=semanticActionCode(outcome);
  if(!outcome.changed){
    if(code==='ACTION_STALE_SOURCE'||code==='ACTION_STALE_TARGET'||code==='TX_STALE_SOURCE'||code==='TX_STALE_TARGET'){
      applyCondition();
      eventLine((meta.label||meta.id||'действие')+': '+code+' · выполнен новый расчет');
    }else{
      eventLine((meta.label||meta.id||'действие')+': '+code+' · текст не изменен');
    }
    return false;
  }
  condition.value=String(outcome.text||'');
  applyCondition();
  if(typeof meta.afterCommit==='function') meta.afterCommit();
  eventLine((meta.event||((meta.label||meta.id||'действие')+' применено'))+' · '+semanticOutcomeTransactionId(outcome));
  return true;
}
function commitSemanticAction(line,meta){
  meta=meta||{};
  var expectedSource=meta.expectedSource==null?semanticState.renderSource:String(meta.expectedSource);
  var expectedTarget=meta.expectedTarget==null?semanticState.renderTarget:String(meta.expectedTarget).trim();
  var outcome=actionController.commitLine(condition.value,semanticActionTarget(),line,meta,expectedSource,expectedTarget);
  return finishSemanticOutcome(outcome,meta);
}
function commitSemanticText(fullText,meta){
  meta=meta||{};
  var expectedSource=meta.expectedSource==null?semanticState.renderSource:String(meta.expectedSource);
  var expectedTarget=meta.expectedTarget==null?semanticState.renderTarget:String(meta.expectedTarget).trim();
  var outcome=actionController.commitText(condition.value,semanticActionTarget(),String(fullText||''),meta,expectedSource,expectedTarget);
  return finishSemanticOutcome(outcome,meta);
}

function applyOutputItem(item){
  var line=item&&item.insertLine;
  if(!line) return;
  commitSemanticAction(line,{id:'output.'+(item.id||'item'),label:item.label||item.id||'вывод',log:'меню: '+(item.label||item.id||'вывод'),event:'меню выводов: '+(item.label||item.id||'вывод')});
}

function semanticDecisionPack(){
  var outcome=actionController.evaluate(condition.value,semanticActionTarget());
  return outcome&&outcome.decision||semanticState.decision||null;
}
function renderContinuationProtocol(){
  if(!continuationProtocolEl) return;
  semanticState.decision=semanticDecisionPack();
  if(window.MRDSemanticDecisionView&&window.MRDSemanticDecisionView.render){
    semanticState.decision=window.MRDSemanticDecisionView.render(continuationProtocolEl,{
      text:condition.value,
      target:semanticActionTarget(),
      decision:semanticState.decision,
      getText:function(){ return condition.value; },
      getTarget:semanticActionTarget,
      onRefresh:renderContinuationProtocol,
      onApply:applySemanticDecisionLine,
      canUndo:actionController.canUndo(condition.value),
      onUndo:undoPortalAction,
      ledger:semanticState.ledger,
      onReplay:replaySemanticLedgerEntry,
      onCopy:copySemanticDecisionText,
      onEvent:eventLine,
      revision:reactionState.revision||'',
      traceHash:canvas.dataset.traceHash||'',
      traceOrigin:semanticState.textResult&&semanticState.textResult.traceContinuation&&semanticState.textResult.traceContinuation.origin||'forecast'
    });
    return;
  }
  continuationProtocolEl.innerHTML='';
  var fallback=document.createElement('div'); fallback.className='protocolText';
  fallback.textContent=semanticState.decision&&semanticState.decision.summary||'Семантическое решение недоступно.';
  continuationProtocolEl.appendChild(fallback);
}
function applySemanticDecisionLine(line,decision,transaction){
  if(!line||!decision||decision.decision!=='apply') return false;
  var outcome=actionController.commitPrepared(condition.value,semanticActionTarget(),decision,transaction||decision.transaction,{
    id:'semantic-decision',
    label:'семантическое решение',
    log:'tx: '+((transaction||decision.transaction)&&((transaction||decision.transaction).transactionId)||'commit'),
    event:'семантическое решение: ход вставлен'
  });
  return finishSemanticOutcome(outcome,{id:'semantic-decision',label:'семантическое решение',event:'семантическое решение: ход вставлен'});
}
function replaySemanticLedgerEntry(entry){
  var outcome=actionController.replay(entry,condition.value,semanticActionTarget());
  return finishSemanticOutcome(outcome,{
    id:entry&&entry.actionId||'ledger-replay',
    label:'повтор: '+(entry&&entry.actionLabel||entry&&entry.actionId||'действие'),
    event:'ветвь воспроизведена'
  });
}function copySemanticDecisionText(value){
  value=String(value||''); if(!value) return;
  function done(){ eventLine('семантическое решение: текст скопирован'); }
  function fallback(){
    var area=document.createElement('textarea'); area.value=value; area.setAttribute('readonly',''); area.style.position='absolute'; area.style.left='-9999px';
    document.body.appendChild(area); area.select();
    try{ document.execCommand('copy'); }catch(error){}
    document.body.removeChild(area); done();
  }
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done,fallback);
  else fallback();
}
function fallbackGuard(){
  var a=semanticState.analysis||analyze(condition.value), u=clamp(.5+(a.edge-a.core)*.38-(a.move-.33)*.06,.06,.94), risk=(a.conflicts&&a.conflicts.length)?'conflict':u<.18?'center':u>.82?'edge':a.life<.35?'stall':'ok';
  var centerIntent=/сжать|сверн|одно\s+главн|все[^.!?]{0,40}одно|убрать[^.!?]{0,50}(пример|детал|факт)/i.test(condition.value||'');
  var score=clamp(Math.min(u,1-u)*1.2+(a.life||0)*.34+(a.move||0)*.12,0,1), zone=centerIntent&&((a.core||0)>.32||(a.move||0)<.30)?'center':risk==='ok'?(score<.42?'thin':'safe'):risk;
  if(zone==='center'||zone==='edge') score=Math.min(score,.39);
  if(zone==='conflict') score=Math.min(score,.34);
  var verdict=zone==='center'?'слишком близко к 3D-схлопыванию':zone==='edge'?'слишком близко к 1D-распаду':zone==='conflict'?'смысловой разрыв перед продолжением':zone==='stall'?'движение формально слабеет':zone==='thin'?'кольцо держится, но запас мал':'рабочее 2D-кольцо удержано';
  var action=zone==='center'?'добавить пример или конкретную деталь':zone==='edge'?'собрать детали в тезис':zone==='conflict'?'сначала поставить ↔-мост':zone==='stall'?'добавить следующий ход':'продолжать через мост и одну деталь';
  return {score:score,u:u,zone:zone,risk:zone==='center'?'center':risk,verdict:verdict,action:action,formula:'guard = min(u, 1-u) + life + move + g_link - conflict',checks:[{label:'не центр',value:u,ok:u>.18&&!centerIntent,note:centerIntent?'явное сжатие всех деталей':'запас до 3D'},{label:'не край',value:1-u,ok:u<.82,note:'запас до 1D'},{label:'живость',value:a.life||0,ok:(a.life||0)>=.35,note:'не остановка'},{label:'мост',value:a.move||0,ok:(a.move||0)>=.34,note:'связь для хода'}]};
}
function guardPack(){ return Semantic&&Semantic.stabilityGuard?Semantic.stabilityGuard(condition.value):fallbackGuard(); }
function renderGuard(){
  if(!guardEl) return;
  guardEl.innerHTML=''; semanticState.guard=guardPack();
  var head=document.createElement('div'); head.className='guardHead '+(semanticState.guard.zone||'safe');
  var b=document.createElement('b'); b.textContent='запас '+Number(semanticState.guard.score||0).toFixed(2)+' · '+(semanticState.guard.verdict||'');
  var s=document.createElement('span'); s.textContent=semanticState.guard.action||'';
  head.appendChild(b); head.appendChild(s); guardEl.appendChild(head);
  var rail=document.createElement('div'); rail.className='guardRail'; var mark=document.createElement('i'); mark.style.left=(clamp((semanticState.guard.u||.5)*100,2,98)).toFixed(1)+'%'; rail.appendChild(mark); guardEl.appendChild(rail);
  var checks=document.createElement('div'); checks.className='guardChecks';
  var list=semanticState.guard.checks||[];
  for(var i=0;i<list.length;i++){
    var c=list[i], row=document.createElement('div'); row.className='guardCheck '+(c.ok?'ok':'bad');
    var cb=document.createElement('b'); cb.textContent=(c.ok?'✓ ':'! ')+c.label+' '+Number(c.value||0).toFixed(2);
    var cs=document.createElement('span'); cs.textContent=c.note||'';
    row.appendChild(cb); row.appendChild(cs); checks.appendChild(row);
  }
  guardEl.appendChild(checks);
}
function localGuardScoreFor(text){
  var a=analyze(text), u=clamp(.5+(a.edge-a.core)*.38-(a.move-.33)*.06,.06,.94), risk=(a.conflicts&&a.conflicts.length)?'conflict':u<.18?'center':u>.82?'edge':a.life<.35?'stall':'ok';
  var score=clamp(Math.min(u,1-u)*1.2+(a.life||0)*.34+(a.move||0)*.12,0,1), zone=risk==='ok'?(score<.42?'thin':'safe'):risk;
  if(zone==='center'||zone==='edge') score=Math.min(score,.39);
  if(zone==='conflict') score=Math.min(score,.34);
  var verdict=zone==='center'?'слишком близко к 3D-схлопыванию':zone==='edge'?'слишком близко к 1D-распаду':zone==='conflict'?'смысловой разрыв':zone==='stall'?'движение слабеет':zone==='thin'?'запас мал':'рабочее 2D-кольцо';
  return {score:score,u:u,zone:zone,risk:risk,verdict:verdict};
}
function fallbackBalanceRepair(text){
  var base=String(text||'').trim(), a=semanticState.analysis||analyze(base), g=semanticState.guard||fallbackGuard(), topic=(a.tokens&&a.tokens[0])||'тема', fact=(a.tokens&&a.tokens[1])||topic, line='', label='ход', op='orbit';
  if(g.zone==='center'){ label='пример'; op='⇓'; line='Баланс: не сжимать все в одну точку; оставить пример: «'+topic+'» проявляется через «'+fact+'», затем сделать следующий ход.'; }
  else if(g.zone==='edge'){ label='тезис'; op='⇑'; line='Баланс: детали не разлетаются отдельно; собрать «'+fact+'» и соседние части в тезис о «'+topic+'», затем продолжить.'; }
  else if(g.zone==='conflict'){ label='мост'; op='↔'; line='Баланс: поставить мост между «'+topic+'» и «'+fact+'», затем продолжить без удаления сторон.'; }
  else { line='Баланс: добавить следующий ход: «'+topic+'» переходит через мост к «'+fact+'», сохраняя движение.'; }
  var out=appendTextLocal(base,line), after=analyze(out.text), afterGuard=localGuardScoreFor(out.text), best={rank:1,label:label,op:op,line:line,text:out.text,added:out.added,changed:out.changed,score:afterGuard.score,after:after,afterGuard:afterGuard,formula:'repair = guard_after - guard_before'};
  return {guard:g,items:[best],best:best,count:1,formula:'repair = argmax(guard_after - guard_before + life + move - risk)',verdict:'резервная балансировка',mantra:'не центр · не край · мост · следующий ход'};
}
function balancePack(){ return Semantic&&Semantic.balanceRepair?Semantic.balanceRepair(condition.value,4):fallbackBalanceRepair(condition.value); }
function renderBalance(){
  if(!balanceEl) return;
  balanceEl.innerHTML=''; uiState.balancePath=[]; semanticState.balance=balancePack();
  var pack=semanticState.balance, best=pack&&pack.best;
  if(!best){ balanceEl.textContent='нет ремонта'; return; }
  var head=document.createElement('div'); head.className='balanceHead '+((pack.guard&&pack.guard.zone)||'safe');
  var hb=document.createElement('b'); hb.textContent=(pack.verdict||'баланс')+' · '+Number(best.score||0).toFixed(2);
  var hs=document.createElement('span'); hs.textContent=pack.formula||'';
  head.appendChild(hb); head.appendChild(hs); balanceEl.appendChild(head);
  var mantra=document.createElement('div'); mantra.className='balanceMantra'; mantra.textContent=pack.mantra||''; balanceEl.appendChild(mantra);
  var preview=document.createElement('div'); preview.className='balancePreview'; preview.textContent=best.line||best.added||''; balanceEl.appendChild(preview);
  var list=document.createElement('div'); list.className='balanceChoices';
  for(var i=0;i<(pack.items||[]).length;i++){
    var item=pack.items[i], row=document.createElement('div'); row.className='balanceChoice '+(item.zone||item.risk||'ok')+(item===best?' best':'');
    var place=document.createElement('b'); place.textContent=String(item.rank||i+1);
    var text=document.createElement('span'); text.textContent=(item.op||'orbit')+' · '+(item.label||'ход')+' · '+((item.afterGuard&&item.afterGuard.verdict)||'после ремонта');
    var score=document.createElement('i'); score.textContent=Number(item.score||0).toFixed(2);
    row.appendChild(place); row.appendChild(text); row.appendChild(score); list.appendChild(row);
  }
  balanceEl.appendChild(list);
  var actions=document.createElement('div'); actions.className='balanceActions';
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent='применить баланс'; apply.disabled=!best.changed; apply.onclick=applyBalanceRepair;
  var refresh=document.createElement('button'); refresh.type='button'; refresh.textContent='пересчитать'; refresh.onclick=renderBalance;
  actions.appendChild(apply); actions.appendChild(refresh); balanceEl.appendChild(actions);
  uiState.balancePath.push({from:(pack.guard&&pack.guard.u)||.5,to:(best.afterGuard&&best.afterGuard.u)||.5,zone:(pack.guard&&pack.guard.zone)||'safe',op:best.op||'orbit',label:best.label||'баланс'});
}
function applyBalanceRepair(){
  var pack=semanticState.balance&&semanticState.balance.best?semanticState.balance:balancePack(), best=pack&&pack.best;
  if(!best||!best.text) return;
  commitSemanticText(best.text,{id:'balance.repair',label:'баланс',log:'баланс '+(best.op||'orbit')+': '+(best.label||'ремонт'),event:'баланс: '+(best.op||'orbit')+' '+(best.label||'ремонт')});
}
function fallbackTrajectory(text,steps){
  steps=Math.max(1,Math.min(6,steps||5));
  var current=String(text||'').trim(), out=[];
  for(var i=0;i<steps;i++){
    var before=localGuardScoreFor(current), pack=before.zone==='safe'?fallbackComposeContinuation(current,4):fallbackBalanceRepair(current), best=pack&&pack.best;
    if(!best||!best.text||best.text===current) break;
    var after=analyze(best.text), afterGuard=localGuardScoreFor(best.text), mode=before.zone==='safe'?'compose':'repair';
    out.push({step:i+1,mode:mode,op:best.op||'orbit',label:best.label||'ход',line:best.line||best.added||'',score:afterGuard.score,text:best.text,before:before,after:afterGuard,life:after.life,move:after.move,formula:mode==='repair'?'repair':'compose'});
    current=best.text;
  }
  return {start:String(text||''),text:current,steps:out,count:out.length,formula:'trajectory = repeat(guard -> repair|compose -> guard)',verdict:out.length?'траектория удерживает ход':'нет траектории',last:out.length?out[out.length-1].after:localGuardScoreFor(current)};
}
function trajectoryPack(){ return Semantic&&Semantic.semanticTrajectory?Semantic.semanticTrajectory(condition.value,5):fallbackTrajectory(condition.value,5); }
function renderTrajectory(){
  if(!trajectoryEl) return;
  trajectoryEl.innerHTML=''; uiState.trajectoryPath=[]; semanticState.trajectory=trajectoryPack();
  var pack=semanticState.trajectory, steps=pack&&pack.steps?pack.steps:[];
  var head=document.createElement('div'); head.className='trajectoryHead';
  var hb=document.createElement('b'); hb.textContent=(pack&&pack.verdict?pack.verdict:'траектория')+' · '+steps.length+' ход';
  var hs=document.createElement('span'); hs.textContent=(pack&&pack.formula)||'';
  head.appendChild(hb); head.appendChild(hs); trajectoryEl.appendChild(head);
  var mantra=document.createElement('div'); mantra.className='trajectoryMantra'; mantra.textContent='память: каждый шаг проверяет guard до и после'; trajectoryEl.appendChild(mantra);
  for(var i=0;i<steps.length;i++){
    var s=steps[i], row=document.createElement('div'); row.className='trajectoryStep '+(s.mode||'compose');
    var place=document.createElement('b'); place.textContent=String(s.step||i+1);
    var mode=document.createElement('em'); mode.textContent=s.mode||'ход';
    var text=document.createElement('span'); text.textContent=(s.op||'orbit')+' · '+(s.label||'ход')+' · '+((s.before&&s.before.zone)||'')+' → '+((s.after&&s.after.zone)||'');
    var score=document.createElement('i'); score.textContent=Number(s.score||0).toFixed(2);
    row.appendChild(place); row.appendChild(mode); row.appendChild(text); row.appendChild(score); trajectoryEl.appendChild(row);
    uiState.trajectoryPath.push({step:s.step||i+1,from:(s.before&&s.before.u)||.5,to:(s.after&&s.after.u)||.5,mode:s.mode||'compose',op:s.op||'orbit',score:s.score||0});
  }
  if(!steps.length){ var empty=document.createElement('div'); empty.className='trajectoryMantra'; empty.textContent=(pack&&pack.last&&(pack.last.zone==='safe'||pack.last.zone==='thin'))?'цепь уже в устойчивом состоянии':'нет шагов для памяти'; trajectoryEl.appendChild(empty); }
  var actions=document.createElement('div'); actions.className='trajectoryActions';
  var run=document.createElement('button'); run.type='button'; run.textContent='пересчитать'; run.onclick=renderTrajectory;
  var apply=document.createElement('button'); apply.type='button'; apply.className='primary'; apply.textContent='применить цепь'; apply.disabled=!(pack&&pack.text&&pack.text!==condition.value); apply.onclick=applyTrajectoryAction;
  actions.appendChild(run); actions.appendChild(apply); trajectoryEl.appendChild(actions);
}
function applyTrajectoryAction(){
  var pack=semanticState.trajectory&&semanticState.trajectory.text?semanticState.trajectory:trajectoryPack();
  if(!pack||!pack.text||pack.text===condition.value) return;
  commitSemanticText(pack.text,{id:'trajectory.chain',label:'траектория',log:'траектория: '+(pack.count||0)+' ход',event:'траектория: применена цепь '+(pack.count||0)});
}
function fallbackSemanticTrace(text){
  var a=analyze(text), topic=(a.tokens&&a.tokens[0])||'тема', fact=(a.tokens&&a.tokens[1])||topic, bridge='мост';
  for(var i=0;i<a.tokens.length;i++) if(a.roles[i]==='bridge'){ bridge=a.tokens[i]; break; }
  var u=clamp(.5+(a.edge-a.core)*.38-(a.move-.33)*.06,.06,.94), risk=(a.conflicts&&a.conflicts.length)?'conflict':u<.18?'center':u>.82?'edge':a.life<.35?'stall':'ok';
  return {nodes:[{kind:'core',label:topic,role:'core',note:'что удерживаем'},{kind:'bridge',label:bridge,role:'bridge',note:'чем связываем'},{kind:'detail',label:fact,role:'detail',note:'через какую кроху идем'},{kind:'op',label:'orbit держать кольцо',role:'bridge',note:'какая операция'},{kind:'next',label:'следующий ход',role:'bridge',note:'продолжить'}],edges:[{score:a.semFit||.5},{score:a.life||.5},{score:a.move||.5},{score:a.life||.5}],score:a.life||0,state:{u:u,risk:risk},formula:'trace = core -> bridge -> detail -> op -> next',why:risk==='ok'?'жесткого разрыва нет; можно продолжать по кольцу':'сначала нужен мост',metrics:{life:a.life,move:a.move,semFit:a.semFit||0,gLink:0,lca:0,conflicts:(a.conflicts&&a.conflicts.length)||0}};
}
function semanticTracePack(){
  return Semantic&&Semantic.semanticTrace?Semantic.semanticTrace(condition.value):fallbackSemanticTrace(condition.value);
}
function renderTraceProof(){
  if(!traceProofEl) return;
  traceProofEl.innerHTML=''; semanticState.proofTrace=null;
  if(!semanticState.analysis || !semanticState.analysis.tokens.length){ traceProofEl.textContent='нет цепи'; return; }
  var pack=semanticTracePack(); semanticState.proofTrace=pack;
  var head=document.createElement('div'); head.className='proofHead';
  var title=document.createElement('b'); title.textContent='удержание · '+Number(pack.score||0).toFixed(2)+' · '+((pack.state&&pack.state.risk)||'ok');
  var formula=document.createElement('span'); formula.textContent=pack.formula||'';
  head.appendChild(title); head.appendChild(formula); traceProofEl.appendChild(head);
  var chain=document.createElement('div'); chain.className='proofChain';
  var nodes=pack.nodes||[], edges=pack.edges||[];
  for(var i=0;i<nodes.length;i++){
    var n=nodes[i], node=document.createElement('div'); node.className='proofNode '+(n.role||'neutral');
    var b=document.createElement('b'); b.textContent=n.label||'';
    var small=document.createElement('small'); small.textContent=n.note||n.kind||'';
    node.appendChild(b); node.appendChild(small); chain.appendChild(node);
    if(i<edges.length){ var arrow=document.createElement('span'); arrow.className='proofArrow'; arrow.textContent='→ '+Number(edges[i].score||0).toFixed(2); chain.appendChild(arrow); }
  }
  traceProofEl.appendChild(chain);
  var why=document.createElement('div'); why.className='proofWhy'; why.textContent=pack.why||''; traceProofEl.appendChild(why);
}
function proofNodePoint(label){
  label=String(label||'');
  for(var i=0;i<worldState.islands.length;i++) if(worldState.islands[i].label===label) return point(worldState.islands[i].th,worldState.islands[i].u);
  return null;
}
function addPortalText(parent, cls, text){
  var d=document.createElement('div'); if(cls) d.className=cls; d.textContent=text; parent.appendChild(d); return d;
}
function addContractRow(parent,key,value){
  var d=document.createElement('div'), b=document.createElement('b'), s=document.createElement('span');
  b.textContent=key; s.textContent=value||''; d.appendChild(b); d.appendChild(s); parent.appendChild(d);
}
function fallbackExecutePortal(text,p){
  var addition='';
  if(!p) return {text:text,changed:false,added:''};
  if(p.id==='link_conflict') addition='Связка: конфликт переводится в мост, чтобы смысл продолжился, а шум стал препятствием, а не распадом.';
  else if(p.id==='add_detail') addition='Пример: добавлена конкретная деталь, чтобы обобщение не схлопнулось в пустой центр.';
  else if(p.id==='synthesize') addition='Тезис: детали собраны в общий смысл без потери отдельных частей.';
  else addition='Продолжение: следующий ход удерживает тему между ядром и краем.';
  var base=String(text||'').trim();
  if(base.indexOf(addition)>=0) return {text:base,changed:false,added:addition,command:p,op:p.op,label:p.label,formula:p.formula};
  return {text:(base?base+'\n'+addition:addition),changed:true,added:addition,command:p,op:p.op,label:p.label,formula:p.formula};
}
function executePortalAction(){
  if(!semanticState.analysis || !semanticState.analysis.portal) return;
  var before=condition.value;
  var res=Semantic&&Semantic.executePortal?Semantic.executePortal(before,semanticState.analysis.portal,semanticState.analysis):fallbackExecutePortal(before,semanticState.analysis.portal);
  if(!res || !res.text) return;
  if(res.changed){
    var meta={id:'portal.'+(semanticState.analysis.portal.id||semanticState.analysis.portal.op||'action'),label:'портал',log:(res.op||semanticState.analysis.portal.op)+' '+(res.label||semanticState.analysis.portal.label)+': '+(res.added||'действие применено'),event:'исполнено: '+(res.op||semanticState.analysis.portal.op)+' '+(res.label||semanticState.analysis.portal.label),fullText:res.text};
    if(res.added) commitSemanticAction(res.added,meta); else commitSemanticText(res.text,meta);
  }else eventLine('портал уже применен');
}
function undoPortalAction(){
  var outcome=actionController.undo(condition.value);
  return finishSemanticOutcome(outcome,{id:'undo',label:'откат',event:'точное изменение отменено'});
}function renderPortalHistory(parent){
  var h=document.createElement('div'); h.className='portalHistory';
  if(!uiState.portalLog.length){ var empty=document.createElement('div'); empty.textContent='история пуста'; h.appendChild(empty); }
  for(var i=0;i<uiState.portalLog.length;i++){ var d=document.createElement('div'); d.textContent=uiState.portalLog[i]; h.appendChild(d); }
  parent.appendChild(h);
}
function renderPortal(){
  if(!portalEl) return;
  portalEl.innerHTML='';
  if(!semanticState.analysis){ portalEl.textContent='нет команды'; return; }
  var p=semanticState.analysis.portal || (Semantic&&Semantic.portalCommand?Semantic.portalCommand(semanticState.analysis):null);
  if(!p){ portalEl.textContent='портал недоступен'; return; }
  var head=document.createElement('div'); head.className='portalHead';
  var op=document.createElement('div'); op.className='portalOp'; op.textContent=p.op||'cmd';
  var title=document.createElement('div'); title.className='portalTitle';
  var tb=document.createElement('b'); tb.textContent=p.label||p.id||'команда';
  var ts=document.createElement('span'); ts.textContent=p.signature||'';
  title.appendChild(tb); title.appendChild(ts); head.appendChild(op); head.appendChild(title); portalEl.appendChild(head);
  addPortalText(portalEl,'portalFormula',p.formula||'');
  var c=document.createElement('div'); c.className='contract';
  addContractRow(c,'pre',p.contract&&p.contract.pre);
  addContractRow(c,'inv',p.contract&&p.contract.inv);
  addContractRow(c,'post',p.contract&&p.contract.post);
  addContractRow(c,'proof',p.contract&&p.contract.proof);
  portalEl.appendChild(c);
  addPortalText(portalEl,'portalRisk',(p.verdict||'')+(p.risk?' · риск: '+p.risk:''));
  var actions=document.createElement('div'); actions.className='portalActions';
  var run=document.createElement('button'); run.className='primary'; run.type='button'; run.textContent='исполнить'; run.onclick=executePortalAction;
  var undo=document.createElement('button'); undo.type='button'; undo.textContent='откат'; undo.disabled=!actionController.canUndo(condition.value); undo.onclick=undoPortalAction;
  actions.appendChild(run); actions.appendChild(undo); portalEl.appendChild(actions);
  renderPortalHistory(portalEl);
}
function fallbackImpulse(baseText,impulseText){
  var base=analyze(baseText), combined=(String(baseText||'').trim()+'\nВнешнее условие: '+String(impulseText||'').trim()).trim(), after=analyze(combined);
  var d={core:after.core-base.core,edge:after.edge-base.edge,move:after.move-base.move,life:after.life-base.life,semFit:0,conflicts:0,gLink:0};
  var u=clamp(.5+(after.edge-after.core)*.38-(after.move-.33)*.06,.06,.94);
  var effect=d.edge>.08?'split':d.core>.08?'generalize':d.move>.05||d.life>.04?'continue':d.life<-.08?'risk':'neutral';
  var labels={split:'детализация',generalize:'обобщение',continue:'продолжение',risk:'риск',neutral:'слабый импульс'};
  var rec=effect==='split'?'импульс тянет к 1D-детализации: нужен тезис-сборка':effect==='generalize'?'импульс тянет к 3D-обобщению: нужен пример':effect==='continue'?'импульс поддерживает 2D-продолжение':effect==='risk'?'импульс снижает живость':'импульс слабый: система почти не меняется';
  return {base:base,after:after,combinedText:combined,deltas:d,state:{u:u,risk:u<.18?'center':u>.82?'edge':'ok',verdict:rec},effect:effect,label:labels[effect]||effect,recommendation:rec,portal:after.portal,forecast:fallbackForecast(combined,3).steps};
}
function fmtDelta(v){ return (v>=0?'+':'')+Number(v||0).toFixed(2); }
function addDeltaCell(parent,label,value){
  var d=document.createElement('div'), b=document.createElement('b'), s=document.createElement('span');
  b.textContent=fmtDelta(value); s.textContent=label; d.appendChild(b); d.appendChild(s); parent.appendChild(d);
}
function impulseLines(text){ return String(text||'').split(/[\n;]+/).map(function(x){return x.replace(/^[-*•\d.)\s]+/,'').trim();}).filter(Boolean); }
function fallbackRankImpulses(baseText,raw){
  var lines=impulseLines(raw), items=[];
  for(var i=0;i<lines.length;i++){
    var r=fallbackImpulse(baseText,lines[i]);
    var riskPenalty=r.state&&r.state.risk==='ok'?0:.18, extreme=Math.abs(((r.state&&r.state.u)||.5)-.5)*.42, d=r.deltas||{};
    var direction=Math.max(0,d.core||0)*.45+Math.max(0,d.edge||0)*.28+Math.max(0,-(d.move||0))*.22;
    var effectPenalty=(r.effect==='split'||r.effect==='generalize')?.08:0;
    r.index=i; r.impulseText=lines[i]; r.score=clamp((r.after.life||0)+Math.max(0,d.move||0)*.16-riskPenalty-extreme-direction-effectPenalty,0,1);
    items.push(r);
  }
  items.sort(function(a,b){return b.score-a.score || (b.after.life-a.after.life) || a.index-b.index;});
  for(var j=0;j<items.length;j++) items[j].rank=j+1;
  return {items:items,best:items[0]||null,count:items.length};
}
function impulseRanking(baseText,raw){
  return Semantic&&Semantic.rankImpulses?Semantic.rankImpulses(baseText,raw):fallbackRankImpulses(baseText,raw);
}
function renderImpulsePack(pack,prefix){
  semanticState.impulse=pack;
  var head=document.createElement('div'); head.className='impulseHead '+(pack.effect||'neutral');
  var title=document.createElement('b'); title.textContent=(prefix||'')+(pack.label||'импульс')+' · '+((pack.portal&&pack.portal.op)||'orbit')+' '+((pack.portal&&pack.portal.label)||'держать кольцо');
  var note=document.createElement('span'); note.textContent=pack.recommendation||'';
  head.appendChild(title); head.appendChild(note); impulseResult.appendChild(head);
  var deltas=document.createElement('div'); deltas.className='impulseDeltas';
  addDeltaCell(deltas,'ядро',pack.deltas&&pack.deltas.core);
  addDeltaCell(deltas,'деталь',pack.deltas&&pack.deltas.edge);
  addDeltaCell(deltas,'ход',pack.deltas&&pack.deltas.move);
  addDeltaCell(deltas,'живость',pack.deltas&&pack.deltas.life);
  impulseResult.appendChild(deltas);
}
function renderImpulseChoices(rank){
  for(var i=0;i<Math.min(5,rank.items.length);i++){
    var item=rank.items[i], row=document.createElement('div');
    row.className='impulseChoice '+(i===0?'best ':'')+(item.effect||'neutral');
    var place=document.createElement('b'); place.textContent=String(i+1);
    var text=document.createElement('span'); text.textContent=(item.label||'импульс')+' · '+(item.impulseText||'');
    var score=document.createElement('i'); score.textContent=Number(item.score||0).toFixed(2);
    row.title=(item.recommendation||'')+'\n'+((item.portal&&item.portal.formula)||'');
    row.appendChild(place); row.appendChild(text); row.appendChild(score); impulseResult.appendChild(row);
  }
}
function renderImpulse(){
  if(!impulseResult || !impulse) return;
  impulseResult.innerHTML=''; semanticState.impulse=null; semanticState.impulseRank=null;
  var text=impulse.value.trim();
  if(!text){ impulseResult.textContent='импульс не задан'; return; }
  var lines=impulseLines(text);
  if(lines.length>1){
    var rank=impulseRanking(condition.value,text); semanticState.impulseRank=rank;
    if(!rank.best){ impulseResult.textContent='нет вариантов'; return; }
    renderImpulsePack(rank.best,'лучший · ');
    renderImpulseChoices(rank);
    return;
  }
  var pack=Semantic&&Semantic.analyzeImpulse?Semantic.analyzeImpulse(condition.value,text):fallbackImpulse(condition.value,text);
  renderImpulsePack(pack,'');
}
function applyImpulsePack(pack,label){
  if(!pack || !pack.combinedText) return;
  commitSemanticText(pack.combinedText,{id:'impulse.apply',label:label||'импульс',log:(label||'импульс')+': '+(pack.impulseText||((impulse&&impulse.value)||'').trim()),event:(label||'импульс')+' применен: '+(pack.label||'реакция'),afterCommit:function(){ if(impulse) impulse.value=''; if(impulseResult){ impulseResult.innerHTML=''; renderImpulsePack(pack,'применено · '); } }});
}
function applyImpulseAction(){
  if(!impulse) return;
  var text=impulse.value.trim(); if(!text) return;
  var pack=Semantic&&Semantic.analyzeImpulse?Semantic.analyzeImpulse(condition.value,text):fallbackImpulse(condition.value,text);
  pack.impulseText=text;
  applyImpulsePack(pack,'импульс');
}
function applyBestImpulseAction(){
  if(!impulse) return;
  var text=impulse.value.trim(); if(!text) return;
  var rank=semanticState.impulseRank&&semanticState.impulseRank.count?semanticState.impulseRank:impulseRanking(condition.value,text);
  semanticState.impulseRank=rank;
  if(rank.best) applyImpulsePack(rank.best,'лучший импульс');
}
function appendTextLocal(base,addition){
  base=String(base||'').trim(); addition=String(addition||'').trim();
  return {text:(base?base+'\n'+addition:addition),added:addition,changed:!!addition};
}
function fallbackComposeContinuation(text,count){
  count=count||4;
  var base=String(text||'').trim(), a=analyze(base), raw=continuationText().replace(/<[^>]+>/g,'').replace(/^дальше:\s*/,'');
  var topic=(a.tokens&&a.tokens[0])||'тема', fact=(a.tokens&&a.tokens[1])||topic;
  var forms=[
    {label:'ход',op:'orbit',line:'Продолжение: '+raw,formula:'orbit('+topic+') -> next('+fact+') && keep(0<u<1)',reason:'удержать середину'},
    {label:'мост',op:'↔',line:'Связка: «'+topic+'» и «'+fact+'» соединяются мостом, чтобы движение не распалось.',formula:'bridge('+topic+','+fact+') -> continue',reason:'связать соседние слова'},
    {label:'пример',op:'⇓',line:'Пример: «'+topic+'» получает одну видимую деталь и следующий шаг.',formula:'detail('+topic+') -> example',reason:'вернуть радиус'},
    {label:'тезис',op:'⇑',line:'Тезис: детали вокруг «'+topic+'» собираются в общий смысл без потери частей.',formula:'synth('+fact+') -> thesis',reason:'собрать детали'}
  ];
  var items=[];
  for(var i=0;i<forms.length;i++){
    var out=appendTextLocal(base,forms[i].line), after=analyze(out.text), u=clamp(.5+(after.edge-after.core)*.38-(after.move-.33)*.06,.06,.94), risk=(after.conflicts&&after.conflicts.length)?'conflict':u<.18?'center':u>.82?'edge':after.life<.35?'stall':'ok';
    var score=clamp((after.life||0)+Math.max(0,after.move||0)*.12-(risk==='ok'?0:.18)-Math.abs(u-.5)*.38,0,1);
    items.push({rank:i+1,index:i,label:forms[i].label,op:forms[i].op,line:forms[i].line,text:out.text,added:forms[i].line,formula:forms[i].formula,reason:forms[i].reason,score:score,life:after.life,u:u,risk:risk,state:{u:u,risk:risk}});
  }
  items.sort(function(x,y){return y.score-x.score || y.life-x.life || x.index-y.index;});
  for(var j=0;j<items.length;j++) items[j].rank=j+1;
  return {items:items.slice(0,count),best:items[0]||null,count:items.length,formula:'compose = argmax(next.life - risk - |u-.5|)',mantra:'круг идет · кроха в ряд · мост держит · смысл живет'};
}
function continuationPlan(){
  return Semantic&&Semantic.composeContinuation?Semantic.composeContinuation(condition.value,4):fallbackComposeContinuation(condition.value,4);
}
function renderContinuationPlan(){
  if(!composeResult) return;
  composeResult.innerHTML=''; uiState.continuationPath=[];
  var pack=continuationPlan(); semanticState.continuationPlan=pack;
  if(!pack || !pack.best){ composeResult.textContent='нет вариантов'; return; }
  var head=document.createElement('div'); head.className='contHead';
  var title=document.createElement('b'); title.textContent='лучший ход · '+(pack.best.label||'продолжение')+' · '+Number(pack.best.score||0).toFixed(2);
  var formula=document.createElement('span'); formula.textContent=pack.formula||'';
  head.appendChild(title); head.appendChild(formula); composeResult.appendChild(head);
  var mantra=document.createElement('div'); mantra.className='contMantra'; mantra.textContent=pack.mantra||''; composeResult.appendChild(mantra);
  for(var i=0;i<pack.items.length;i++){
    var item=pack.items[i], row=document.createElement('div');
    row.className='contChoice '+(i===0?'best ':'')+(item.risk||'ok');
    row.title=(item.reason||'')+'\n'+(item.formula||'');
    var place=document.createElement('b'); place.textContent=String(item.rank||i+1);
    var text=document.createElement('span'); text.textContent=(item.label||'ход')+' · '+(item.line||'');
    var score=document.createElement('i'); score.textContent=Number(item.score||0).toFixed(2);
    var btn=document.createElement('button'); btn.type='button'; btn.textContent='вставить';
    btn.onclick=(function(choice){return function(){applyContinuationItem(choice,'ход');};})(item);
    row.appendChild(place); row.appendChild(text); row.appendChild(score); row.appendChild(btn); composeResult.appendChild(row);
    uiState.continuationPath.push({rank:item.rank||i+1,th:((hash(item.line||'')%10000)/10000),u:clamp(item.u||.5,.08,.92),risk:item.risk||'ok',score:item.score||0,label:item.label||''});
  }
}
function applyContinuationItem(item,label){
  if(!item || !item.text) return;
  commitSemanticText(item.text,{id:'continuation.'+(item.op||item.label||'item'),label:label||'ход',log:(label||'ход')+': '+(item.line||item.label||'продолжение'),event:(label||'ход')+' применен: '+(item.label||'продолжение')});
}
function applyBestContinuationAction(){
  var pack=semanticState.continuationPlan&&semanticState.continuationPlan.best?semanticState.continuationPlan:continuationPlan();
  semanticState.continuationPlan=pack;
  if(pack&&pack.best) applyContinuationItem(pack.best,'лучший ход');
}
function fallbackForecast(text,steps){
  steps=steps||4;
  var current=String(text||'').trim(), out=[];
  for(var i=0;i<steps;i++){
    var a=analyze(current), p=a.portal || {op:'orbit',label:'держать кольцо',id:'keep_orbit',formula:'orbit() -> next'};
    var res=fallbackExecutePortal(current,p);
    if(!res.changed){
      var line=continuationText().replace(/<[^>]+>/g,'').replace(/^дальше:\s*/,'');
      res={text:(current?current+'\n':'')+'Ход '+(i+1)+': '+line,changed:true,added:line,op:p.op,label:p.label,formula:p.formula};
    }
    var after=analyze(res.text);
    var u=clamp(.5+(after.edge-after.core)*.38-(after.move-.33)*.06,.06,.94);
    var risk=(after.conflicts&&after.conflicts.length)?'conflict':u<.18?'center':u>.82?'edge':after.life<.35?'stall':'ok';
    var verdict=risk==='conflict'?'сначала нужен мост':risk==='center'?'риск центр-коллапса':risk==='edge'?'риск распада на край':risk==='stall'?'риск формальной остановки':'рабочее кольцо';
    out.push({step:i+1,op:p.op,label:p.label,id:p.id,formula:p.formula,added:res.added||'',changed:true,life:after.life,core:after.core,edge:after.edge,move:after.move,semFit:after.semFit||0,u:u,risk:risk,verdict:verdict,text:res.text});
    current=res.text;
  }
  return {text:current,steps:out};
}
function renderForecast(){
  if(!forecastEl) return;
  forecastEl.innerHTML=''; uiState.forecastPath=[];
  var pack=Semantic&&Semantic.forecast?Semantic.forecast(condition.value,4):fallbackForecast(condition.value,4);
  var steps=pack&&pack.steps?pack.steps:[];
  if(!steps.length){ forecastEl.textContent='нет прогноза'; return; }
  var base=((semanticState.analysis?semanticState.analysis.hash:1)%10000)/10000;
  for(var i=0;i<steps.length;i++){
    var s=steps[i], row=document.createElement('div');
    row.className='forecastStep '+(s.risk||'ok');
    var op=document.createElement('b'); op.textContent=s.op||'•';
    var txt=document.createElement('span'); txt.textContent=(s.label||'ход')+' · '+(s.verdict||'рабочее кольцо');
    var score=document.createElement('i'); score.textContent=Number(s.life||0).toFixed(2);
    row.title=(s.formula||'')+(s.added?'\n'+s.added:'');
    row.appendChild(op); row.appendChild(txt); row.appendChild(score); forecastEl.appendChild(row);
    uiState.forecastPath.push({th:(base+(i+1)*PHI)%1,u:clamp(s.u||.5,.08,.92),op:s.op||'orbit',risk:s.risk||'ok',label:s.label||''});
  }
}
function continuationText(){
  if(Semantic && semanticState.analysis) return Semantic.nextMove(semanticState.analysis).html;
  if(!semanticState.analysis || !semanticState.analysis.tokens.length) return '<b>дальше:</b> внесите условие, и кольцо построит следующий ход.';
  var core=[], detail=[], bridge=[], other=[];
  for(var i=0;i<semanticState.analysis.tokens.length;i++){
    var role=semanticState.analysis.roles[i], w=semanticState.analysis.tokens[i];
    if(role==='core') core.push(w); else if(role==='detail') detail.push(w); else if(role==='bridge') bridge.push(w); else other.push(w);
  }
  var topic=(core[0]||other[0]||semanticState.analysis.tokens[0]);
  var fact=(detail[0]||semanticState.analysis.tokens[1]||topic);
  var move=(bridge[0]||'продолжить');
  var advice='';
  if(semanticState.analysis.core>.46 && semanticState.analysis.edge<.22) advice=' добавить конкретную деталь';
  else if(semanticState.analysis.edge>.46 && semanticState.analysis.core<.22) advice=' собрать детали в общий смысл';
  else advice=' удержать движение между смыслом и деталями';
  return '<b>дальше:</b> '+move+' тему «'+topic+'»: через «'+fact+'»,'+advice+'.';
}
function spawnEdge(th,label){
  for(var i=0;i<7;i++) worldState.shards.push({th:th+(rnd()-.5)*.25,r:R1+18+rnd()*18,v:1.6+rnd()*3.6,rot:rnd()*TAU,life:34+rnd()*40,label:label||''});
}
function spawnCore(label){ worldState.rings.push({r:18,life:34,label:label||''}); }
function roleForce(role){ return role==='core' ? -.00042 : role==='detail' ? .00042 : 0; }
function step(scale){
  scale=Math.max(.01,numOr(scale,1));
  worldState.tick+=scale;
  var lam=+lambda.value/100, t=+tempo.value, alpha=worldState.irr?PHI:1/6, memory=+inertia.value/100;
  var conditionForce=semanticState.analysis?semanticState.analysis.force*.00036:0;
  for(var i=0;i<worldState.drops.length;i++){
    var p=worldState.drops[i], digit=PI.charCodeAt((Math.floor(worldState.tick)+i)%PI.length)-48;
    var pi=((digit/9)-.5)*.0022;
    var wave=Math.sin(p.phase+worldState.tick*.018+p.th*TAU)*.0021;
    var home=(.5-p.u)*(.0013+.0022*memory);
    var lever=(.5-lam)*.00072;
    var islandPull=0;
    if(p.tokenIndex>=0 && worldState.islands[p.tokenIndex]){
      var target=worldState.islands[p.tokenIndex];
      islandPull=(target.u-p.u)*.0018;
      p.th+=(target.th-p.th)*.00024*scale;
    }
    var continuePush=(semanticState.analysis?semanticState.analysis.move:0)*Math.sin(worldState.tick*.012+p.phase)*.0012;
    p.th=(p.th+(alpha*(.00165+.00031*t)+p.spin+(p.u-.5)*.0016+continuePush)*scale)%1;
    if(p.th<0) p.th+=1;
    p.u+=(home+wave+pi+lever+roleForce(p.role)+conditionForce+islandPull)*scale;
    var boundaryGain=1-Math.pow(.65,scale);
    if(p.u<.18) p.u+=(.18-p.u)*boundaryGain;
    else if(p.u>.82) p.u+=(.82-p.u)*boundaryGain;
    if(p.u<=.055){
      worldState.coreHits++; spawnCore(p.label);
      p.u=.20+rnd()*.10; p.th=(p.th+PHI)%1;
      p.role='bridge';
      if(worldState.coreHits%8===1) eventLine('центр: «'+(p.label||'смысл')+'» схлопнулся -> вернуть примером');
    }else if(p.u>=.945){
      worldState.edgeHits++; spawnEdge(p.th*TAU,p.label);
      p.u=.70+rnd()*.10; p.th=(p.th+PHI)%1;
      p.role='bridge';
      if(worldState.edgeHits%8===1) eventLine('край: «'+(p.label||'деталь')+'» рассыпался -> связать обратно');
    }
  }
  var h=worldState.drops[0], a=h.th*TAU, r=R0+h.u*(R1-R0);
  worldState.trace.push({x:CX+Math.cos(a)*r,y:CY+Math.sin(a)*r,u:h.u,role:h.role});
  if(worldState.trace.length>TRACE_LIMIT) worldState.trace.shift();
}
function point(th,u){ var r=R0+u*(R1-R0), a=th*TAU; return {x:CX+Math.cos(a)*r,y:CY+Math.sin(a)*r,r:r,a:a}; }
function drawBackground(){
  if(!uiState.backgroundGradient){
    uiState.backgroundGradient=ctx.createLinearGradient(0,0,W,H);
    uiState.backgroundGradient.addColorStop(0,'#11131a'); uiState.backgroundGradient.addColorStop(.48,'#0b2022'); uiState.backgroundGradient.addColorStop(1,'#261513');
  }
  ctx.fillStyle=uiState.backgroundGradient; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,.035)';
  for(var i=0;i<90;i++){ var x=(i*137+worldState.tick*.15)%W; ctx.fillRect(x,(i*61)%H,1,1); }
}
function drawLiquidBands(){
  for(var k=0;k<LIQUID_BAND_COUNT;k++){
    var u=k/(LIQUID_BAND_COUNT-1), r=R0+u*(R1-R0);
    ctx.beginPath();
    for(var s=0;s<=LIQUID_BAND_SEGMENTS;s++){
      var a=s/LIQUID_BAND_SEGMENTS*TAU, wob=Math.sin(a*5+worldState.tick*.025+k)*4+Math.sin(a*9-worldState.tick*.018)*2;
      var rr=r+wob, x=CX+Math.cos(a)*rr, y=CY+Math.sin(a)*rr;
      if(s) ctx.lineTo(x,y); else ctx.moveTo(x,y);
    }
    var edgeBand=(k===0 || k===LIQUID_BAND_COUNT-1);
    ctx.closePath(); ctx.strokeStyle=col(u,edgeBand ? .25 : .095); ctx.lineWidth=edgeBand ? 1.8 : 1; ctx.stroke();
  }
}
function drawCore(){
  ctx.save(); ctx.translate(CX,CY);
  ctx.fillStyle='rgba(8,11,16,.86)'; ctx.beginPath(); ctx.arc(0,0,R0-10,0,TAU); ctx.fill();
  for(var i=worldState.rings.length-1;i>=0;i--){
    var q=worldState.rings[i]; q.r+=2.9; q.life--;
    ctx.strokeStyle='rgba(117,103,216,'+(q.life/34)+')'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,q.r,0,TAU); ctx.stroke();
    if(q.life<=0) worldState.rings.splice(i,1);
  }
  var s=44;
  ctx.fillStyle='#7a6ee0'; ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(s,-s*.46); ctx.lineTo(0,s*.08); ctx.lineTo(-s,-s*.46); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#5750b5'; ctx.beginPath(); ctx.moveTo(-s,-s*.46); ctx.lineTo(0,s*.08); ctx.lineTo(0,s*1.05); ctx.lineTo(-s,s*.48); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#3f3b8e'; ctx.beginPath(); ctx.moveTo(s,-s*.46); ctx.lineTo(0,s*.08); ctx.lineTo(0,s*1.05); ctx.lineTo(s,s*.48); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(238,242,247,.55)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,-s-34); ctx.lineTo(0,s*1.05); ctx.stroke();
  ctx.fillStyle='rgba(238,242,247,.9)'; ctx.font='700 12px system-ui'; ctx.textAlign='center';
  ctx.fillText('3D ЯДРО',0,4); ctx.fillText('сжать',0,20);
  ctx.restore();
}
function drawTrace(){
  if(worldState.trace.length<2) return;
  ctx.lineWidth=2.3; ctx.strokeStyle=roleColor(worldState.trace[worldState.trace.length-1].role,.56);
  ctx.beginPath(); ctx.moveTo(worldState.trace[0].x,worldState.trace[0].y);
  for(var i=1;i<worldState.trace.length;i++) ctx.lineTo(worldState.trace[i].x,worldState.trace[i].y);
  ctx.stroke();
}
function linkStroke(l){
  if(l.type==='conflict') return {c:'rgba(216,81,63,.72)',w:2.4,d:[8,6]};
  if(l.type==='bridge') return {c:'rgba(215,200,111,'+(.24+.46*Math.min(1,l.score||0))+')',w:1.2+2.2*Math.min(1,l.score||0),d:[]};
  return {c:'rgba(21,151,132,.18)',w:1,d:[]};
}
function drawArchipelago(){
  if(!worldState.islands.length) return;
  ctx.save();
  for(var i=0;i<worldState.links.length;i++){
    var l=worldState.links[i], a=worldState.islands[l.from], b=worldState.islands[l.to]; if(!a||!b) continue;
    var pa=point(a.th,a.u), pb=point(b.th,b.u), st=linkStroke(l);
    ctx.strokeStyle=st.c; ctx.lineWidth=st.w; ctx.setLineDash(st.d);
    ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.quadraticCurveTo(CX,CY, pb.x,pb.y); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.font='700 11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for(var j=0;j<worldState.islands.length;j++){
    var q=worldState.islands[j], p=point(q.th,q.u), pulse=1+.16*Math.sin(worldState.tick*.035+q.pulse), rr=(7+q.weight*3)*pulse;
    ctx.fillStyle=roleColor(q.role,.22); ctx.beginPath(); ctx.arc(p.x,p.y,rr+5,0,TAU); ctx.fill();
    ctx.fillStyle=roleColor(q.role,.92); ctx.beginPath(); ctx.arc(p.x,p.y,rr,0,TAU); ctx.fill();
    if(j<14){
      ctx.fillStyle='rgba(238,242,247,.88)';
      ctx.fillText(q.token.slice(0,12),p.x,p.y-rr-10);
    }
  }
  ctx.restore();
}
function impulseColor(effect,a){
  var c=effect==='conflict'||effect==='split'||effect==='risk'?'216,81,63':effect==='generalize'?'117,103,216':effect==='continue'?'21,151,132':'215,200,111';
  return 'rgba('+c+','+a+')';
}
function drawImpulse(){
  if(!semanticState.impulse || !semanticState.impulse.after) return;
  var u=semanticState.impulse.state?semanticState.impulse.state.u:.5, th=((hash((impulse&&impulse.value)||'импульс')%10000)/10000+worldState.tick*.00018)%1;
  var target=point(th,clamp(u,.08,.92)), start=point(th,R1?1.22:.92);
  ctx.save(); ctx.setLineDash([7,5]); ctx.strokeStyle=impulseColor(semanticState.impulse.effect,.72); ctx.lineWidth=2.2;
  ctx.beginPath(); ctx.moveTo(start.x,start.y); ctx.quadraticCurveTo(CX,CY,target.x,target.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle=impulseColor(semanticState.impulse.effect,.24); ctx.beginPath(); ctx.arc(target.x,target.y,18,0,TAU); ctx.fill();
  ctx.fillStyle=impulseColor(semanticState.impulse.effect,.96); ctx.beginPath(); ctx.arc(target.x,target.y,9,0,TAU); ctx.fill();
  ctx.fillStyle='rgba(238,242,247,.9)'; ctx.font='800 11px system-ui'; ctx.textAlign='center'; ctx.fillText('импульс',target.x,target.y-24);
  ctx.restore();
}
function forecastColor(risk,a){
  var c=risk==='conflict'||risk==='edge'?'216,81,63':risk==='center'?'117,103,216':risk==='stall'?'226,161,43':'215,200,111';
  return 'rgba('+c+','+a+')';
}
function drawForecast(){
  if(!uiState.forecastPath.length) return;
  ctx.save(); ctx.setLineDash([5,8]); ctx.lineWidth=2.1;
  for(var i=1;i<uiState.forecastPath.length;i++){
    var a=point(uiState.forecastPath[i-1].th,uiState.forecastPath[i-1].u), b=point(uiState.forecastPath[i].th,uiState.forecastPath[i].u);
    ctx.strokeStyle=forecastColor(uiState.forecastPath[i].risk,.7);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.quadraticCurveTo(CX,CY,b.x,b.y); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 10px system-ui';
  for(var j=0;j<uiState.forecastPath.length;j++){
    var p=uiState.forecastPath[j], q=point(p.th,p.u);
    ctx.fillStyle=forecastColor(p.risk,.22); ctx.beginPath(); ctx.arc(q.x,q.y,15,0,TAU); ctx.fill();
    ctx.fillStyle=forecastColor(p.risk,.92); ctx.beginPath(); ctx.arc(q.x,q.y,9,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(10,14,19,.9)'; ctx.fillText(String(j+1),q.x,q.y+1);
  }
  ctx.restore();
}
function drawArchipelagoRoute(){
  if(!uiState.archipelagoPath.length) return;
  ctx.save(); ctx.setLineDash([4,6]); ctx.lineWidth=1.8; ctx.font='800 10px system-ui'; ctx.textAlign='center';
  for(var i=0;i<Math.min(4,uiState.archipelagoPath.length);i++){
    var s=uiState.archipelagoPath[i], th=((hash((s.a||'')+'|'+(s.b||''))%10000)/10000+worldState.tick*.00003)%1, a=point(th,.36+.08*i), b=point(th+.18,.62+.05*i);
    var tone=s.type==='conflict'?'216,81,63':'215,200,111';
    ctx.strokeStyle='rgba('+tone+',.58)'; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.quadraticCurveTo(CX,CY,b.x,b.y); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle='rgba('+tone+',.88)'; ctx.beginPath(); ctx.arc(b.x,b.y,7+Math.max(0,Math.min(1,s.score))*5,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(10,14,19,.9)'; ctx.fillText('A'+String(s.rank||i+1),b.x,b.y+3); ctx.setLineDash([4,6]);
  }
  ctx.restore();
}
function drawWeaveRoute(){
  if(!uiState.weavePath.length) return;
  ctx.save(); ctx.lineWidth=2.2; ctx.font='800 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  var prev=null;
  for(var i=0;i<uiState.weavePath.length;i++){
    var s=uiState.weavePath[i], th=(.70+i*.055+worldState.tick*.00006)%1, p=point(th,clamp(s.u,.10,.90)), tone=s.role==='detail'?'216,81,63':s.role==='core'?'117,103,216':'21,151,132';
    if(prev){ ctx.strokeStyle='rgba(215,200,111,.62)'; ctx.setLineDash([3,5]); ctx.beginPath(); ctx.moveTo(prev.x,prev.y); ctx.quadraticCurveTo(CX,CY,p.x,p.y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle='rgba('+tone+',.22)'; ctx.beginPath(); ctx.arc(p.x,p.y,15,0,TAU); ctx.fill();
    ctx.fillStyle='rgba('+tone+',.92)'; ctx.beginPath(); ctx.arc(p.x,p.y,8+Math.max(0,Math.min(1,s.score))*4,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(10,14,19,.92)'; ctx.fillText('W'+String(s.rank||i+1),p.x,p.y+1);
    prev=p;
  }
  ctx.restore();
}
function drawWindowRhythm(){
  if(!uiState.windowPath.length) return;
  ctx.save(); ctx.lineWidth=1.8; ctx.font='800 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for(var i=0;i<uiState.windowPath.length;i++){
    var s=uiState.windowPath[i], th=(.56+i*.045+worldState.tick*.00009)%1, p=point(th,clamp(s.u,.10,.90)), tone=s.active?'215,200,111':s.kind==='bridge'||s.kind==='block'?'216,81,63':'21,151,132';
    ctx.strokeStyle='rgba('+tone+','+(s.active?.88:.42)+')'; ctx.fillStyle='rgba('+tone+','+(s.active?.30:.16)+')'; ctx.beginPath(); ctx.arc(p.x,p.y,s.active?18:13,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle=s.active?'rgba(10,14,19,.94)':'rgba(238,242,247,.78)'; ctx.fillText('K'+String(s.rank||i+1),p.x,p.y+1);
  }
  ctx.restore();
}


function drawGoal(){
  if(!uiState.goalPath.length) return;
  ctx.save(); ctx.lineWidth=1.7; ctx.font='800 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for(var i=0;i<uiState.goalPath.length;i++){
    var s=uiState.goalPath[i], th=(.33+i*.052+worldState.tick*.00007)%1, p=point(th,clamp(s.u,.08,.92));
    var tone=s.kind==='repair'||s.kind==='rollback'?'216,81,63':s.kind==='target'||s.kind==='homeostasis'?'21,151,132':'215,200,111';
    ctx.fillStyle='rgba('+tone+','+(.18+.18*Math.max(0,Math.min(1,s.score)))+')'; ctx.strokeStyle='rgba('+tone+',.74)';
    ctx.beginPath(); ctx.arc(p.x,p.y,12+Math.max(0,Math.min(1,s.score))*6,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(10,14,19,.92)'; ctx.fillText('G'+String(s.rank||i+1),p.x,p.y+1);
  }
  ctx.restore();
}

function drawPhi(){
  if(!uiState.phiPath.length) return;
  ctx.save(); ctx.lineWidth=1.7; ctx.font='800 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  var prev=null;
  for(var i=0;i<uiState.phiPath.length;i++){
    var s=uiState.phiPath[i], th=(.245+i*.055+worldState.tick*.00008)%1, p=point(th,clamp(s.u,.08,.92));
    var tone=s.kind==='repair'||s.kind==='stall'||s.kind==='repeat'||s.kind==='closed'?'216,81,63':s.kind==='alive'||s.kind==='accept'?'21,151,132':'215,200,111';
    if(prev){ ctx.strokeStyle='rgba('+tone+',.36)'; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.moveTo(prev.x,prev.y); ctx.quadraticCurveTo(CX,CY,p.x,p.y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle='rgba('+tone+','+(.17+.22*Math.max(0,Math.min(1,s.score)))+')'; ctx.strokeStyle='rgba('+tone+',.76)';
    ctx.beginPath(); ctx.arc(p.x,p.y,12+Math.max(0,Math.min(1,s.score))*6,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(10,14,19,.92)'; ctx.fillText('Φ'+String(s.rank||i+1),p.x,p.y+1);
    prev=p;
  }
  ctx.restore();
}

function drawRails(){
  if(!uiState.railsPath.length) return;
  ctx.save(); ctx.lineWidth=1.6; ctx.font='800 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  var prev=null;
  for(var i=0;i<uiState.railsPath.length;i++){
    var s=uiState.railsPath[i], th=(.185+i*.052+worldState.tick*.00006)%1, p=point(th,clamp(s.u,.08,.92));
    var tone=s.kind==='missing'||s.kind==='repair'||String(s.kind).indexOf('need_')===0?'216,81,63':'21,151,132';
    if(prev){ ctx.strokeStyle='rgba('+tone+',.34)'; ctx.setLineDash([8,5]); ctx.beginPath(); ctx.moveTo(prev.x,prev.y); ctx.quadraticCurveTo(CX,CY,p.x,p.y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle='rgba('+tone+','+(.16+.22*Math.max(0,Math.min(1,s.score)))+')'; ctx.strokeStyle='rgba('+tone+',.72)';
    ctx.beginPath(); ctx.arc(p.x,p.y,11+Math.max(0,Math.min(1,s.score))*5,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(10,14,19,.92)'; ctx.fillText('R'+String(s.rank||i+1),p.x,p.y+1);
    prev=p;
  }
  ctx.restore();
}

function drawBacktrack(){
  if(!uiState.backtrackPath.length) return;
  ctx.save(); ctx.lineWidth=1.6; ctx.font='800 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  var prev=null;
  for(var i=0;i<uiState.backtrackPath.length;i++){
    var s=uiState.backtrackPath[i], th=(.44+i*.038+worldState.tick*.00011)%1, p=point(th,clamp(s.u,.08,.92));
    var tone=s.status==='rollback'?'216,81,63':s.chosen?'215,200,111':'21,151,132';
    if(prev){ ctx.strokeStyle='rgba('+tone+',.44)'; ctx.setLineDash(s.status==='rollback'?[2,7]:[6,4]); ctx.beginPath(); ctx.moveTo(prev.x,prev.y); ctx.quadraticCurveTo(CX,CY,p.x,p.y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle='rgba('+tone+','+(s.chosen?.34:.18)+')'; ctx.strokeStyle='rgba('+tone+','+(s.chosen?.92:.58)+')'; ctx.beginPath(); ctx.arc(p.x,p.y,s.chosen?17:12,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle=s.chosen?'rgba(10,14,19,.94)':'rgba(238,242,247,.78)'; ctx.fillText((s.status==='rollback'?'↺':'B')+String(s.rank||i+1),p.x,p.y+1);
    prev=p;
  }
  ctx.restore();
}

function drawTrajectory(){
  if(!uiState.trajectoryPath.length) return;
  ctx.save(); ctx.lineWidth=2; ctx.font='800 11px system-ui'; ctx.textAlign='center';
  for(var i=0;i<uiState.trajectoryPath.length;i++){
    var s=uiState.trajectoryPath[i], th=(.18+i*.075+worldState.tick*.00004)%1, a=point(th,clamp(s.from,.06,.94)), b=point(th+.045,clamp(s.to,.06,.94));
    var tone=s.mode==='repair'?'215,200,111':'21,151,132';
    ctx.strokeStyle='rgba('+tone+',.58)'; ctx.fillStyle='rgba('+tone+',.82)'; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.quadraticCurveTo(CX+Math.cos(th*TAU)*(R1+54),CY+Math.sin(th*TAU)*(R1+54),b.x,b.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x,b.y,8+Math.max(0,Math.min(1,s.score))*5,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(238,242,247,.82)'; ctx.fillText(String(s.step||i+1),b.x,b.y+4);
  }
  ctx.restore();
}
function drawBalance(){
  if(!uiState.balancePath.length) return;
  var b=uiState.balancePath[0], th=(.055+worldState.tick*.00005)%1, p0=point(th,clamp(b.from,.06,.94)), p1=point(th+.035,clamp(b.to,.06,.94));
  var color=b.zone==='center'?'117,103,216':b.zone==='edge'||b.zone==='conflict'?'216,81,63':'21,151,132';
  ctx.save(); ctx.setLineDash([7,7]); ctx.strokeStyle='rgba('+color+',.72)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.quadraticCurveTo(CX+R1+42,CY-168,p1.x,p1.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='rgba('+color+',.20)'; ctx.strokeStyle='rgba('+color+',.78)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(p1.x,p1.y,13+Math.sin(worldState.tick*.04)*2,0,TAU); ctx.fill(); ctx.stroke();
  ctx.font='800 12px system-ui'; ctx.fillStyle='#eef2f7'; ctx.textAlign='left'; ctx.fillText('repair '+(b.op||''),p1.x+16,p1.y+4); ctx.restore();
}
function drawGuard(){
  if(!semanticState.guard) return;
  var u=clamp(semanticState.guard.u||.5,.06,.94), p=point(.985,u), zone=semanticState.guard.zone||'safe';
  var color=zone==='center'?'117,103,216':zone==='edge'||zone==='conflict'?'216,81,63':zone==='thin'||zone==='stall'?'226,161,43':'21,151,132';
  ctx.save();
  ctx.strokeStyle='rgba('+color+',.85)'; ctx.lineWidth=3; ctx.setLineDash([3,5]);
  ctx.beginPath(); ctx.arc(CX,CY,R0+u*(R1-R0),-.18,.18); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle='rgba('+color+',.28)'; ctx.beginPath(); ctx.arc(p.x,p.y,18,0,TAU); ctx.fill();
  ctx.fillStyle='rgba('+color+',.96)'; ctx.beginPath(); ctx.arc(p.x,p.y,8,0,TAU); ctx.fill();
  ctx.fillStyle='rgba(238,242,247,.9)'; ctx.font='800 10px system-ui'; ctx.textAlign='center'; ctx.fillText('guard',p.x,p.y-23);
  ctx.restore();
}
function drawProofTrace(){
  if(!semanticState.proofTrace || !semanticState.proofTrace.nodes || !semanticState.proofTrace.nodes.length) return;
  ctx.save(); ctx.lineWidth=3; ctx.setLineDash([10,6]);
  var prev=null;
  for(var i=0;i<semanticState.proofTrace.nodes.length;i++){
    var node=semanticState.proofTrace.nodes[i], p=proofNodePoint(node.label);
    if(!p){
      var th=((hash(node.label||'')%10000)/10000+worldState.tick*.00005)%1;
      var u=node.role==='core'?.26:node.role==='detail'?.74:.52;
      p=point(th,u);
    }
    if(prev){ ctx.strokeStyle='rgba(215,200,111,.78)'; ctx.beginPath(); ctx.moveTo(prev.x,prev.y); ctx.lineTo(p.x,p.y); ctx.stroke(); }
    ctx.setLineDash([]); ctx.fillStyle=roleColor(node.role||'bridge',.30); ctx.beginPath(); ctx.arc(p.x,p.y,18,0,TAU); ctx.fill();
    ctx.strokeStyle='rgba(238,242,247,.72)'; ctx.lineWidth=1.4; ctx.stroke();
    ctx.fillStyle='rgba(238,242,247,.92)'; ctx.font='700 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(i+1),p.x,p.y);
    ctx.setLineDash([10,6]); ctx.lineWidth=3;
    prev=p;
  }
  ctx.restore();
}
function drawContinuationPlan(){
  if(!uiState.continuationPath.length) return;
  ctx.save(); ctx.setLineDash([4,7]); ctx.lineWidth=1.4;
  var start=point((((semanticState.analysis?semanticState.analysis.hash:1)%10000)/10000),.5);
  for(var i=0;i<uiState.continuationPath.length;i++){
    var p=uiState.continuationPath[i], q=point((p.th+worldState.tick*.00008)%1,p.u);
    ctx.strokeStyle=forecastColor(p.risk,.52); ctx.beginPath(); ctx.moveTo(start.x,start.y); ctx.lineTo(q.x,q.y); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle=forecastColor(p.risk,.24); ctx.beginPath(); ctx.arc(q.x,q.y,13,0,TAU); ctx.fill();
    ctx.fillStyle=forecastColor(p.risk,.94); ctx.font='700 11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(p.rank),q.x,q.y);
    ctx.setLineDash([4,7]);
  }
  ctx.restore();
}
function cascadeTone(direction){
  return direction==='generalize'?'117,103,216':direction==='detail'?'216,81,63':direction==='repair'?'47,131,202':'21,151,132';
}
function drawReactionCascade(){
  var eventsPack=reactionState.field&&reactionState.field.events||[];
  if(!eventsPack.length) return;
  ctx.save(); ctx.font='700 9px ui-monospace,SFMono-Regular,Consolas,monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for(var i=0;i<eventsPack.length&&i<3;i++){
    var event=eventsPack[i], source=worldState.islands[event.sourceIndex], target=worldState.islands[event.targetIndex];
    if(!source||!target) continue;
    var a=point(source.th,source.u), b=point(target.th,target.u), dx=b.x-a.x, dy=b.y-a.y, len=Math.max(1,Math.sqrt(dx*dx+dy*dy));
    var bend=(i%2?1:-1)*(12+event.generation*3), cx=(a.x+b.x)/2-dy/len*bend, cy=(a.y+b.y)/2+dx/len*bend;
    var tone=cascadeTone(event.direction), phase=(worldState.tick*.012+event.generation*.17)%1, one=1-phase;
    ctx.strokeStyle='rgba('+tone+',.72)'; ctx.lineWidth=1.5; ctx.setLineDash([4,5]); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.quadraticCurveTo(cx,cy,b.x,b.y); ctx.stroke(); ctx.setLineDash([]);
    var px=one*one*a.x+2*one*phase*cx+phase*phase*b.x, py=one*one*a.y+2*one*phase*cy+phase*phase*b.y;
    ctx.fillStyle='rgba('+tone+',.96)'; ctx.beginPath(); ctx.arc(px,py,3.4,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(238,242,247,.78)'; ctx.fillText('g'+event.generation+' '+event.ruleId,cx,cy-6);
  }
  ctx.restore();
}
function drawObservedReactions(){
  var history=reactionState.runtime&&reactionState.runtime.history||[];
  if(!history.length) return;
  ctx.save(); ctx.font='800 9px ui-monospace,SFMono-Regular,Consolas,monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  var shown=0;
  for(var i=history.length-1;i>=0&&shown<5;i--){
    var event=history[i], age=worldState.tick-numOr(event.worldTick,worldState.tick);
    if(age<0||age>REACTION_RUNTIME_INTERVAL*6) continue;
    var source=runtimeDrop(event.sourceId), target=runtimeDrop(event.targetId); if(!source||!target) continue;
    var a=point(source.th,source.u), b=point(target.th,target.u), tone=cascadeTone(event.direction), alpha=clamp(1-age/(REACTION_RUNTIME_INTERVAL*6),0,1);
    var phase=clamp(age/REACTION_RUNTIME_INTERVAL,0,1), px=a.x+(b.x-a.x)*phase, py=a.y+(b.y-a.y)*phase;
    ctx.strokeStyle='rgba('+tone+','+(.22+.66*alpha)+')'; ctx.lineWidth=2.2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    ctx.fillStyle='rgba('+tone+','+(.45+.5*alpha)+')'; ctx.beginPath(); ctx.arc(px,py,4.2,0,TAU); ctx.fill();
    ctx.strokeStyle='rgba(245,248,255,'+(.25+.65*alpha)+')'; ctx.beginPath(); ctx.arc(b.x,b.y,7+2*alpha,0,TAU); ctx.stroke();
    ctx.fillStyle='rgba(245,248,255,'+(.45+.5*alpha)+')'; ctx.fillText('OBS g'+event.generation,(a.x+b.x)/2,(a.y+b.y)/2-7);
    shown++;
  }
  ctx.restore();
}
function numOr(value,fallback){ value=Number(value); return isFinite(value)?value:fallback; }
function drawDrops(){
  var painter=window.MRDSemanticReactionFieldView&&window.MRDSemanticReactionFieldView.paintParticle;
  for(var i=0;i<worldState.drops.length;i++){
    var p=worldState.drops[i], q=point(p.th,p.u), alpha=.50+.28*Math.sin(worldState.tick*.035+i);
    if(painter) painter(ctx,q.x,q.y,p.size,p,alpha);
    else{ ctx.fillStyle=roleColor(p.role,alpha); ctx.beginPath(); ctx.arc(q.x,q.y,p.size,0,TAU); ctx.fill(); }
  }
  var h=worldState.drops[0], hp=point(h.th,h.u);
  ctx.strokeStyle='rgba(245,248,255,.94)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(hp.x,hp.y,9,0,TAU); ctx.stroke();
  if(painter) painter(ctx,hp.x,hp.y,5.4,h,1);
  else{ ctx.fillStyle=roleColor(h.role,1); ctx.beginPath(); ctx.arc(hp.x,hp.y,5.4,0,TAU); ctx.fill(); }
}
function rebuildSemanticTraceParticleLookup(){
  semanticState.traceParticleLookup={};
  for(var i=0;i<worldState.drops.length;i++) semanticState.traceParticleLookup['$'+String(worldState.drops[i].id)]=worldState.drops[i];
}
function traceParticleResolve(id){ return semanticState.traceParticleLookup['$'+String(id)]||null; }
function traceParticlePoint(particle){ return point(particle.th,particle.u); }
function drawSemanticTraceOverlay(){
  var view=window.MRDSemanticTraceView;
  if(!view||typeof view.paint!=='function'||!semanticState.traceOverlay) return;
  view.paint(ctx,semanticState.traceOverlay,{resolveParticle:traceParticleResolve,projectParticle:traceParticlePoint,tick:worldState.tick,bounds:{width:W,height:H,cx:CX,cy:CY,r0:R0,r1:R1}});
}
function drawEdge(){
  ctx.setLineDash([6,9]); ctx.strokeStyle='rgba(216,81,63,.55)'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.arc(CX,CY,R1+38,0,TAU); ctx.stroke(); ctx.setLineDash([]);
  for(var i=worldState.shards.length-1;i>=0;i--){
    var s=worldState.shards[i]; s.r+=s.v; s.rot+=.08; s.life--;
    var x=CX+Math.cos(s.th)*s.r, y=CY+Math.sin(s.th)*s.r;
    ctx.save(); ctx.translate(x,y); ctx.rotate(s.rot); ctx.globalAlpha=Math.max(0,s.life/48);
    ctx.fillStyle='#d8513f'; ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(8,4); ctx.lineTo(-5,5); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha=1;
    if(s.life<=0) worldState.shards.splice(i,1);
  }
}
function drawForces(){
  if(!semanticState.analysis) return;
  var cx=CX+R1+104, y=CY-96;
  ctx.save(); ctx.font='700 12px system-ui'; ctx.textAlign='left'; ctx.textBaseline='middle';
  drawArrow(cx,y,0,-semanticState.analysis.core*70,'#7567d8','обобщить');
  drawArrow(cx,y+52,0,semanticState.analysis.edge*70,'#d8513f','разбить');
  drawArrow(cx-44,y+112,semanticState.analysis.move*92,0,'#159784','продолжить');
  ctx.restore();
}
function drawArrow(x,y,dx,dy,color,label){
  ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dx,y+dy); ctx.stroke();
  var a=Math.atan2(dy,dx), ex=x+dx, ey=y+dy;
  ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(ex-Math.cos(a-.55)*9,ey-Math.sin(a-.55)*9); ctx.lineTo(ex-Math.cos(a+.55)*9,ey-Math.sin(a+.55)*9); ctx.closePath(); ctx.fill();
  ctx.fillText(label,x+12,y-12);
}
function drawPortalCommand(){
  if(!semanticState.analysis || !semanticState.analysis.portal) return;
  var p=semanticState.analysis.portal, x=28, y=H-116, w=328, h=86;
  var tone=p.op==='↔'?'215,200,111':p.op==='⇑'?'117,103,216':p.op==='⇓'?'216,81,63':'21,151,132';
  ctx.save();
  ctx.fillStyle='rgba(10,14,19,.74)'; ctx.strokeStyle='rgba('+tone+',.72)'; ctx.lineWidth=1.4;
  ctx.fillRect(x,y,w,h); ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.fillStyle='rgba('+tone+',.18)'; ctx.fillRect(x+8,y+10,42,42);
  ctx.strokeStyle='rgba('+tone+',.64)'; ctx.strokeRect(x+8.5,y+10.5,41,41);
  ctx.fillStyle='rgba('+tone+',.96)'; ctx.font='900 24px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(p.op||'cmd',x+29,y+32);
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillStyle='rgba(238,242,247,.93)'; ctx.font='800 13px system-ui'; ctx.fillText('портал · '+(p.label||''),x+62,y+24);
  ctx.fillStyle='rgba(238,242,247,.72)'; ctx.font='11px ui-monospace,SFMono-Regular,Consolas,monospace'; ctx.fillText(String(p.signature||'').slice(0,42),x+62,y+43);
  ctx.fillStyle='rgba(226,161,43,.88)'; ctx.font='700 11px system-ui'; ctx.fillText(String(p.risk||p.verdict||'').slice(0,48),x+12,y+72);
  ctx.restore();
}
function drawLabels(){
  ctx.fillStyle='rgba(238,242,247,.82)'; ctx.font='700 13px system-ui'; ctx.textAlign='center';
  ctx.fillText('2D ЖИДКОСТЬ: смысловой ход по кольцу',CX,CY-R1-12);
  ctx.fillStyle='rgba(216,81,63,.86)'; ctx.fillText('1D КРАЙ: распад на буквы, слоги, факты',CX,CY-R1-55);
  ctx.fillStyle='rgba(238,242,247,.64)';
  var labs=[['круг',-Math.PI/2],['деталь',0],['дальше',Math.PI/2],['не край',Math.PI],['не центр',-2.36]];
  for(var i=0;i<labs.length;i++){
    var a=labs[i][1], rr=R1+20;
    ctx.fillText(labs[i][0],CX+Math.cos(a)*rr,CY+Math.sin(a)*rr+4);
  }
}
function draw(){
  drawBackground(); drawLiquidBands(); drawEdge(); drawTrace(); drawArchipelago(); drawArchipelagoRoute(); drawWeaveRoute(); drawWindowRhythm(); drawGoal(); drawPhi(); drawRails(); drawBacktrack(); drawTrajectory(); drawBalance(); drawGuard(); drawProofTrace(); drawForecast(); drawContinuationPlan(); drawImpulse(); drawReactionCascade(); drawObservedReactions(); drawDrops(); drawSemanticTraceOverlay(); drawCore(); drawForces(); drawPortalCommand(); drawLabels();
}
function updatePanel(){
  var lam=+lambda.value/100, M=4*lam*(1-lam), idx=Math.floor(worldState.tick/52)%words.length;
  chant.innerHTML=words[idx][0]+'<small>'+words[idx][1]+'</small>';
  for(var i=0;i<beats.children.length;i++) beats.children[i].classList.toggle('hot',i===idx);
  mval.textContent=M.toFixed(2); mbar.style.width=(M*100).toFixed(0)+'%';
  aval.textContent=worldState.irr?'φ':'1/6'; coreEl.textContent=worldState.coreHits; edgeEl.textContent=worldState.edgeHits;
  if(semanticState.analysis){
    corePullEl.textContent=semanticState.analysis.core.toFixed(2); edgePullEl.textContent=semanticState.analysis.edge.toFixed(2); movePullEl.textContent=semanticState.analysis.move.toFixed(2); lifeScoreEl.textContent=semanticState.analysis.life.toFixed(2);
    var gm=semanticState.analysis.graph&&semanticState.analysis.graph.metrics?semanticState.analysis.graph.metrics:{};
    if(fitVal) fitVal.textContent=(semanticState.analysis.semFit||0).toFixed(2);
    if(lcaVal) lcaVal.textContent=(gm.lcaAvg||0).toFixed(2);
    if(gLinkVal) gLinkVal.textContent=(gm.gLink||0).toFixed(2);
    if(conflictVal) conflictVal.textContent=String(gm.conflictCount||0);
  }
  continuation.innerHTML=continuationText();
}
function frame(now){
  recordFrameHealth(typeof now==='number'?now:clockMs());
  var frameStarted=clockMs(),simulationStarted=frameStarted;
  worldState.frame.substeps=0;
  if(worldState.running){
    var requestedSteps=Math.max(1,+tempo.value||1),substeps=Math.min(SIMULATION_SUBSTEP_CAP,Math.max(1,Math.ceil(requestedSteps))),stepScale=requestedSteps/substeps;
    worldState.frame.substeps=substeps;
    for(var i=0;i<substeps;i++) step(stepScale);
  }
  worldState.frame.simulationMs=clockMs()-simulationStarted;
  if(worldState.running&&worldState.frame.serial%REACTION_RUNTIME_FRAME_INTERVAL===0) reactionController.scheduleStep();
  var drawStarted=clockMs();
  draw();
  worldState.frame.drawMs=clockMs()-drawStarted;
  if(worldState.frame.serial%PANEL_FRAME_INTERVAL===0) schedulePanelUpdate();
  worldState.frame.workMs=clockMs()-frameStarted;
  requestAnimationFrame(frame);
}
for(var i=0;i<words.length;i++){
  var b=document.createElement('div'); b.className='beat'; b.textContent=words[i][0]; beats.appendChild(b);
}
angleBtn.onclick=function(){ worldState.irr=!worldState.irr; angleBtn.textContent=worldState.irr?'φ-ход':'6 лучей'; angleBtn.classList.toggle('on',worldState.irr); eventLine(worldState.irr?'φ: почти не повторяется':'1/6: виден застой по лучам'); };
pauseBtn.onclick=function(){ worldState.running=!worldState.running; pauseBtn.textContent=worldState.running?'пауза':'пуск'; pauseBtn.classList.toggle('on',!worldState.running); };
resetBtn.onclick=resetWorld;
applyBtn.onclick=applyCondition;
semanticSearchRun.onclick=renderSemanticSearch;
semanticSearchFormula.addEventListener('change',renderSemanticSearch);
semanticSearchQuery.addEventListener('keydown',function(e){ if(e.key==='Enter') renderSemanticSearch(); });
controlledClaimRun.onclick=renderControlledClaim;
controlledClaimInput.addEventListener('keydown',function(e){ if(e.key==='Enter') renderControlledClaim(); });
if(impulseCheck) impulseCheck.onclick=renderImpulse;
if(impulseApply) impulseApply.onclick=applyImpulseAction;
if(impulseBest) impulseBest.onclick=applyBestImpulseAction;
if(composeRefresh) composeRefresh.onclick=renderContinuationPlan;
if(composeBest) composeBest.onclick=applyBestContinuationAction;
if(goalCheck) goalCheck.onclick=renderGoalMap;
if(analysisModeBtn) analysisModeBtn.addEventListener('click',function(){ if(!semanticState.claimTrace) renderControlledClaim(); });
if(goalTarget) goalTarget.addEventListener('keydown',function(e){ if(e.key==='Enter') renderGoalMap(); });
if(impulse) impulse.addEventListener('keydown',function(e){ if((e.ctrlKey||e.metaKey) && e.key==='Enter') renderImpulse(); });
sampleBtn.onclick=function(){ condition.value=examples[Math.floor(rnd()*examples.length)]; applyCondition(); };
condition.addEventListener('keydown',function(e){ if((e.ctrlKey||e.metaKey) && e.key==='Enter') applyCondition(); });
condition.addEventListener('input',function(){ if(uiState.portalUndo.length){ actionController.invalidate(); renderPortal(); renderContinuationProtocol(); } });
lambda.oninput=function(){ var lam=+lambda.value/100; updateReactionField(); renderTextResult(); renderOutputMenu(); scheduleParameterCounterfactual(); semanticState.formulaTrace=formulaAdapter.render(condition.value,lam,false); if(lam>.86) eventLine('λ высоко: тянет к центру; локальная цепь затухает'); if(lam<.14) eventLine('λ низко: тянет к краю; локальная цепь затухает'); };
formulaX.addEventListener('input',function(){ semanticState.formulaTrace=formulaAdapter.render(condition.value,+lambda.value/100,false); });
formulaY.addEventListener('input',function(){ semanticState.formulaTrace=formulaAdapter.render(condition.value,+lambda.value/100,false); });
initializeSemanticDataEvidence();
applyCondition();
frame();
})();
