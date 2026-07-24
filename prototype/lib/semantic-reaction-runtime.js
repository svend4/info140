(function(global){
'use strict';

var VERSION='2.6.0';
var Rulebook=global.MRDSemanticReactionRules||null;
var STRUCTURAL='STRUCTURAL';
var UNVERIFIED='UNVERIFIED';
var NOT_COMPUTED='NOT_COMPUTED';
var EPSILON=1e-9;

var ERROR_CODES={
  RUNTIME_RULEBOOK_UNAVAILABLE:'RUNTIME_RULEBOOK_UNAVAILABLE',
  RUNTIME_INVALID_INPUT:'RUNTIME_INVALID_INPUT',
  RUNTIME_INVALID_FIELD:'RUNTIME_INVALID_FIELD',
  RUNTIME_INVALID_PARTICLES:'RUNTIME_INVALID_PARTICLES',
  RUNTIME_DUPLICATE_ID:'RUNTIME_DUPLICATE_ID',
  RUNTIME_STALE_PARTICLES:'RUNTIME_STALE_PARTICLES',
  RUNTIME_REVISION_MISMATCH:'RUNTIME_REVISION_MISMATCH',
  RUNTIME_TICK_MISMATCH:'RUNTIME_TICK_MISMATCH',
  RUNTIME_INVALID_STATE:'RUNTIME_INVALID_STATE',
  RUNTIME_INVARIANT_FAILED:'RUNTIME_INVARIANT_FAILED'
};

var DEFAULTS={
  cellSize:.05,
  radius:.09,
  tickBudget:4,
  candidateBudget:96,
  pairBudget:2400,
  cascadeBudget:12,
  maxGeneration:3,
  cooldown:2,
  activationDelay:1,
  cascadeTTL:90,
  rearmAfter:30,
  historyLimit:24,
  regen:.015,
  cost:.16,
  calibrationGain:.12,
  calibrationPriority:20,
  opportunityDecay:.92,
  minU:.181,
  maxU:.819
};

function record(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function dict(){ return Object.create(null); }
function text(value){ return value==null?'':String(value); }
function number(value,fallback){ value=Number(value); return isFinite(value)?value:fallback; }
function integer(value,fallback){ return Math.floor(number(value,fallback)); }
function clamp(value,min,max){ value=number(value,min); return value<min?min:value>max?max:value; }
function rounded(value){ return Math.round(number(value,0)*1000000)/1000000; }
function stableId(value){ return typeof value==='number'&&isFinite(value)?value:text(value); }
function idKey(value){ return typeof value+':'+text(value); }
function compareId(a,b){
  if(typeof a==='number'&&typeof b==='number') return a-b;
  var ak=idKey(a),bk=idKey(b);
  return ak<bk?-1:ak>bk?1:0;
}
function copy(value){
  if(value==null||typeof value!=='object') return value;
  if(Array.isArray(value)) return value.map(copy);
  var out={}; Object.keys(value).forEach(function(key){ out[key]=copy(value[key]); }); return out;
}
function canonical(value){
  if(value==null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+':'+canonical(value[key]);}).join(',')+'}';
}
function hashValue(value){
  var source=canonical(value),h=2166136261>>>0;
  for(var i=0;i<source.length;i++){ h^=source.charCodeAt(i); h=Math.imul(h,16777619); }
  return ('00000000'+(h>>>0).toString(16)).slice(-8);
}
function windowAt(lambda){ lambda=clamp(number(lambda,.5),0,1); return rounded(4*lambda*(1-lambda)); }
function innerClamp(value,options){ return rounded(clamp(value,options.minU+.000001,options.maxU-.000001)); }
function optionsOf(value){
  value=value||{};
  var tickBudget=value.tickBudget==null?value.budget:value.tickBudget;
  return {
    cellSize:clamp(number(value.cellSize,DEFAULTS.cellSize),.01,.25),
    radius:clamp(number(value.radius,DEFAULTS.radius),.015,.30),
    tickBudget:Math.max(1,Math.min(16,integer(tickBudget,DEFAULTS.tickBudget))),
    candidateBudget:Math.max(4,Math.min(4096,integer(value.candidateBudget,DEFAULTS.candidateBudget))),
    pairBudget:Math.max(8,Math.min(32768,integer(value.pairBudget,DEFAULTS.pairBudget))),
    cascadeBudget:Math.max(1,Math.min(96,integer(value.cascadeBudget,DEFAULTS.cascadeBudget))),
    maxGeneration:Math.max(1,Math.min(3,integer(value.maxGeneration,DEFAULTS.maxGeneration))),
    cooldown:Math.max(0,Math.min(60,integer(value.cooldown,DEFAULTS.cooldown))),
    activationDelay:Math.max(1,Math.min(12,integer(value.activationDelay,DEFAULTS.activationDelay))),
    cascadeTTL:Math.max(4,Math.min(1200,integer(value.cascadeTTL,DEFAULTS.cascadeTTL))),
    rearmAfter:Math.max(3,Math.min(1200,integer(value.rearmAfter,DEFAULTS.rearmAfter))),
    historyLimit:Math.max(4,Math.min(128,integer(value.historyLimit,DEFAULTS.historyLimit))),
    regen:clamp(number(value.regen,DEFAULTS.regen),0,.10),
    cost:clamp(number(value.cost,DEFAULTS.cost),0,.50),
    calibrationGain:clamp(number(value.calibrationGain,DEFAULTS.calibrationGain),0,.25),
    calibrationPriority:clamp(number(value.calibrationPriority,DEFAULTS.calibrationPriority),0,30),
    opportunityDecay:clamp(number(value.opportunityDecay,DEFAULTS.opportunityDecay),.50,.99),
    minU:clamp(number(value.minU,DEFAULTS.minU),.10,.39),
    maxU:clamp(number(value.maxU,DEFAULTS.maxU),.61,.90)
  };
}
function metricsBase(count,mass){
  return {
    particles:count||0,cells:0,maxBucket:0,pairsAvailable:0,pairChecks:0,candidateChecks:0,
    thresholdRejected:0,homogeneousRejected:0,conflictRejected:0,lastBudgetUsed:0,totalEvents:0,rearmed:0,
    truncated:false,minU:0,maxU:0,mass:rounded(mass||0),directionCounts:{generalize:0,detail:0,orbit:0,repair:0},
    directionTarget:{generalize:0,detail:0,orbit:0,repair:0},directionDivergence:0,directionSampleSize:0,
    directionOpportunityCounts:{generalize:0,detail:0,orbit:0,repair:0},handoffOpportunityCounts:{generalize:0,detail:0,orbit:0,repair:0},
    lastDirectionOpportunities:{generalize:0,detail:0,orbit:0,repair:0},lastHandoffOpportunities:{generalize:0,detail:0,orbit:0,repair:0},
    directionOpportunityProfile:{generalize:0,detail:0,orbit:0,repair:0},handoffOpportunityProfile:{generalize:0,detail:0,orbit:0,repair:0},directionReachableProfile:{generalize:0,detail:0,orbit:0,repair:0},
    directionOpportunitySampleSize:0,opportunityTicks:0,directionAvailabilityDivergence:0,directionControlDivergence:0
  };
}
var DIRECTIONS=['generalize','detail','orbit','repair'];
function emptyDirections(){ return {generalize:0,detail:0,orbit:0,repair:0}; }
function directionTotal(values){
  var total=0; for(var i=0;i<DIRECTIONS.length;i++) total+=Math.max(0,number(values&&values[DIRECTIONS[i]],0)); return total;
}
function directionShares(values){
  var out=emptyDirections(),total=directionTotal(values);
  if(!total) return out;
  for(var i=0;i<DIRECTIONS.length;i++){var direction=DIRECTIONS[i];out[direction]=rounded(Math.max(0,number(values&&values[direction],0))/total);}
  return out;
}
function forecastDirectionCounts(field){
  var counts=emptyDirections(),metrics=field&&field.metrics||{},fromMetrics=metrics.directionCounts||{};
  for(var i=0;i<DIRECTIONS.length;i++){var direction=DIRECTIONS[i];counts[direction]=Math.max(0,number(fromMetrics[direction],0));}
  if(directionTotal(counts)>0) return counts;
  (field&&field.events||[]).forEach(function(event){if(DIRECTIONS.indexOf(event&&event.direction)>=0) counts[event.direction]+=1;});
  return counts;
}
function directionForRole(role){
  role=text(role); return role==='synth'?'generalize':role==='fragment'?'detail':role==='anti'?'repair':'orbit';
}
function populationDirectionCounts(field){
  var counts=emptyDirections();
  (field&&field.particles||[]).forEach(function(particle){
    counts[directionForRole(particle&&particle.baseReactionRole||particle&&particle.reactionRole)]+=1;
  });
  return counts;
}
function profileFor(field){
  field=field||{};
  var mode=text(field.mode)||'orbit',forecast=forecastDirectionCounts(field),population=populationDirectionCounts(field),target=emptyDirections();
  var forecastTotal=directionTotal(forecast),populationTotal=directionTotal(population),forecastShare=directionShares(forecast),populationShare=directionShares(population),source='fallback';
  if(mode==='generalize'||mode==='detail'){
    target[mode]=1; source='explicit';
  }else if(forecastTotal&&populationTotal){
    for(var i=0;i<DIRECTIONS.length;i++){var direction=DIRECTIONS[i];target[direction]=.75*forecastShare[direction]+.25*populationShare[direction];}
    target=directionShares(target); source='forecast+population';
  }else if(forecastTotal){
    target=forecastShare; source='forecast';
  }else if(populationTotal){
    target=populationShare; source='population';
  }else {
    target[mode==='repair'?'repair':'orbit']=1;
  }
  return {source:source,mode:mode,forecastCounts:forecast,populationCounts:population,target:target,forecastWeight:forecastTotal&&populationTotal?.75:forecastTotal?1:0,populationWeight:forecastTotal&&populationTotal?.25:populationTotal?1:0};
}
function distributionDistance(left,right){
  var distance=0;
  for(var i=0;i<DIRECTIONS.length;i++){var direction=DIRECTIONS[i];distance+=Math.abs(number(left&&left[direction],0)-number(right&&right[direction],0));}
  return rounded(distance*.5);
}
function updateDirectionMetrics(metrics,profile){
  if(!record(metrics.directionCounts)) metrics.directionCounts=emptyDirections();
  var total=directionTotal(metrics.directionCounts),target=profile&&profile.target||emptyDirections(),observed=directionShares(metrics.directionCounts);
  metrics.directionTarget=copy(target); metrics.directionObservedProfile=copy(observed); metrics.directionSampleSize=total; metrics.directionDivergence=total?distributionDistance(observed,target):0;
  return metrics;
}
function ensureOpportunityMetrics(metrics){
  ['directionOpportunityCounts','handoffOpportunityCounts','lastDirectionOpportunities','lastHandoffOpportunities'].forEach(function(key){if(!record(metrics[key])) metrics[key]=emptyDirections();});
}
function updateOpportunityMetrics(metrics,profile,decay){
  ensureOpportunityMetrics(metrics); decay=clamp(number(decay,.92),.50,.99);
  var target=profile&&profile.target||emptyDirections();
  for(var i=0;i<DIRECTIONS.length;i++){
    var direction=DIRECTIONS[i];
    metrics.directionOpportunityCounts[direction]=rounded(number(metrics.directionOpportunityCounts[direction],0)*decay+number(metrics.lastDirectionOpportunities[direction],0));
    metrics.handoffOpportunityCounts[direction]=rounded(number(metrics.handoffOpportunityCounts[direction],0)*decay+number(metrics.lastHandoffOpportunities[direction],0));
  }
  var currentTotal=directionTotal(metrics.directionOpportunityCounts),handoffTotal=directionTotal(metrics.handoffOpportunityCounts);
  var current=directionShares(metrics.directionOpportunityCounts),handoff=directionShares(metrics.handoffOpportunityCounts),reachable=emptyDirections();
  if(currentTotal&&handoffTotal){
    for(i=0;i<DIRECTIONS.length;i++){direction=DIRECTIONS[i];reachable[direction]=.7*current[direction]+.3*handoff[direction];}
    reachable=directionShares(reachable);
  }else if(currentTotal) reachable=current;
  else if(handoffTotal) reachable=handoff;
  var observed=metrics.directionObservedProfile||directionShares(metrics.directionCounts);
  metrics.directionOpportunityProfile=copy(current); metrics.handoffOpportunityProfile=copy(handoff); metrics.directionReachableProfile=copy(reachable);
  metrics.directionOpportunitySampleSize=rounded(currentTotal); metrics.handoffOpportunitySampleSize=rounded(handoffTotal); metrics.opportunityTicks=number(metrics.opportunityTicks,0)+1;
  metrics.directionAvailabilityDivergence=currentTotal||handoffTotal?distributionDistance(reachable,target):0;
  metrics.directionControlDivergence=metrics.directionSampleSize&&(currentTotal||handoffTotal)?distributionDistance(observed,reachable):0;
  return metrics;
}
function directionCalibration(state,direction){
  var profile=state.directionProfile||profileFor({mode:state.mode}),target=profile.target||emptyDirections(),counts=state.metrics&&state.metrics.directionCounts||emptyDirections();
  var total=directionTotal(counts),count=Math.max(0,number(counts[direction],0)),expected=clamp(number(target[direction],0),0,1),observed=total?count/total:0;
  var rawDebt=expected*total-count,debt=clamp(rawDebt,-1,1),shareGap=total?expected-observed:0,gain=state.options.calibrationGain,priorityGain=state.options.calibrationPriority;
  return {
    direction:direction,expectedShare:rounded(expected),observedShare:rounded(observed),shareGap:rounded(shareGap),rawDebt:rounded(rawDebt),debt:rounded(debt),
    multiplier:rounded(1+gain*debt),priorityDelta:rounded(priorityGain*debt),
    reason:!total?'direction:warmup':debt>.05?'direction:underrepresented':debt<-.05?'direction:overrepresented':'direction:balanced'
  };
}
function blockedState(code,detail,revision,options){
  return {
    version:VERSION,kind:'MRDSemanticReactionRuntime',status:'BLOCKED',code:code,errorCode:code,
    errors:[{code:code,detail:detail==null?null:copy(detail)}],revision:text(revision),tick:0,sequence:0,
    cascadeSerial:0,cascadeId:text(revision)+'/c0',cascadeStartTick:0,cascadeEvents:0,quiet:0,
    lambda:.5,window:1,mode:'orbit',fieldHash:null,seedId:null,nodes:[],lineage:{},history:[],lastEvents:[],
    options:options||optionsOf(),metrics:metricsBase(0,0),evidence:UNVERIFIED,evidenceLevel:UNVERIFIED,soundness:NOT_COMPUTED
  };
}
function blockedResult(state,code,detail){
  var next=record(state)?copy(state):blockedState(code,detail,'',optionsOf());
  next.status='BLOCKED'; next.code=code; next.errorCode=code; next.errors=[{code:code,detail:detail==null?null:copy(detail)}]; next.lastEvents=[];
  return {
    state:next,status:'BLOCKED',code:code,errorCode:code,events:[],effects:[],attemptsSummary:{accepted:0},
    metrics:copy(next.metrics||metricsBase()),invariants:{ok:false,failures:[code],checks:{}},
    contract:{pre:{ok:false},inv:{ok:false},post:{ok:false}},evidence:UNVERIFIED,evidenceLevel:UNVERIFIED,soundness:NOT_COMPUTED
  };
}
function normalizeParticles(particles,options){
  if(!Array.isArray(particles)||!particles.length) return {ok:false,code:ERROR_CODES.RUNTIME_INVALID_PARTICLES,detail:'non-empty particle array required'};
  var out=[],seen=dict();
  for(var i=0;i<particles.length;i++){
    var item=particles[i];
    if(!record(item)||item.id==null||!isFinite(Number(item.x))||!isFinite(Number(item.y))||!isFinite(Number(item.u))){
      return {ok:false,code:ERROR_CODES.RUNTIME_INVALID_PARTICLES,detail:{index:i}};
    }
    var key=idKey(item.id);
    if(seen[key]) return {ok:false,code:ERROR_CODES.RUNTIME_DUPLICATE_ID,detail:{id:item.id}};
    seen[key]=true;
    out.push({
      id:stableId(item.id),tokenIndex:integer(item.tokenIndex,-1),token:text(item.token||item.label),
      x:rounded(item.x),y:rounded(item.y),u:innerClamp(item.u,options),reactionRole:text(item.reactionRole),
      baseReactionRole:text(item.baseReactionRole),semanticRole:text(item.semanticRole||item.role),
      q:number(item.q,NaN),act:number(item.act,NaN),thr:number(item.thr,NaN),mass:number(item.mass,1)
    });
  }
  out.sort(function(a,b){return compareId(a.id,b.id);});
  return {ok:true,items:out,keys:seen};
}
function fieldMap(field){
  var map=dict();
  (field&&field.particles||[]).forEach(function(particle){map[String(integer(particle.index,-1))]=particle;});
  return map;
}
function chooseSeed(samples,field){
  var i;
  for(i=0;i<samples.length;i++) if(samples[i].reactionRole==='seed') return samples[i];
  var triggerIndex=integer(field&&field.trigger&&field.trigger.index,-2);
  for(i=0;i<samples.length;i++) if(samples[i].tokenIndex===triggerIndex) return samples[i];
  return samples[0];
}
function stateNodeMap(nodes){ var map=dict(); for(var i=0;i<nodes.length;i++) map[idKey(nodes[i].id)]=nodes[i]; return map; }
function create(input){
  input=input||{};
  var options=optionsOf(input.options),revision=text(input.revision),field=input.field,normalized=normalizeParticles(input.particles,options);
  if(!Rulebook||typeof Rulebook.select!=='function'||typeof Rulebook.validateEvent!=='function') return blockedState(ERROR_CODES.RUNTIME_RULEBOOK_UNAVAILABLE,null,revision,options);
  if(!record(input)||!revision) return blockedState(ERROR_CODES.RUNTIME_INVALID_INPUT,'revision is required',revision,options);
  if(!record(field)||field.kind!=='MRDSemanticReactionField'||!Array.isArray(field.particles)) return blockedState(ERROR_CODES.RUNTIME_INVALID_FIELD,null,revision,options);
  if(!normalized.ok) return blockedState(normalized.code,normalized.detail,revision,options);
  if(options.minU>=options.maxU-.01) return blockedState(ERROR_CODES.RUNTIME_INVALID_INPUT,'open ring bounds overlap',revision,options);
  var descriptors=fieldMap(field),seed=chooseSeed(normalized.items,field),nodes=[],mass=0,minU=1,maxU=0;
  for(var i=0;i<normalized.items.length;i++){
    var sample=normalized.items[i],descriptor=descriptors[String(sample.tokenIndex)]||{},isSeed=idKey(sample.id)===idKey(seed.id);
    var baseRole=sample.baseReactionRole||descriptor.baseReactionRole||descriptor.reactionRole||'carrier';
    var baseAct=clamp(isFinite(sample.act)?sample.act:number(descriptor.act,.76),0,1);
    var node={
      id:sample.id,tokenIndex:sample.tokenIndex,token:sample.token||text(descriptor.token)||('particle-'+text(sample.id)),
      semanticRole:sample.semanticRole||descriptor.semanticRole||'neutral',reactionRole:isSeed?'seed':(sample.reactionRole||descriptor.reactionRole||baseRole),
      baseReactionRole:baseRole,q:isFinite(sample.q)?sample.q:number(descriptor.q,0),tags:copy(descriptor.tags||[]),
      mass:sample.mass>0?sample.mass:1,x:sample.x,y:sample.y,u:sample.u,act:baseAct,baseAct:baseAct,
      thr:clamp(isFinite(sample.thr)?sample.thr:number(descriptor.thr,.32),.12,.82),cd:0,activeAt:0,
      generation:isSeed?0:null,signal:isSeed?number(field.trigger&&field.trigger.signal,0):null,
      state:isSeed?'trigger':'idle',activationEventId:null
    };
    mass+=node.mass; minU=Math.min(minU,node.u); maxU=Math.max(maxU,node.u); nodes.push(node);
  }
  var directionProfile=profileFor(field);
  var fieldHash=hashValue({revision:revision,ruleHash:Rulebook.hash,formula:field.formula||'',mode:field.mode||'orbit',trigger:field.trigger||null,particles:field.particles,directionProfile:directionProfile});
  var metrics=updateDirectionMetrics(metricsBase(nodes.length,mass),directionProfile); metrics.minU=rounded(minU); metrics.maxU=rounded(maxU);
  return {
    version:VERSION,kind:'MRDSemanticReactionRuntime',status:'READY',code:null,errorCode:null,errors:[],revision:revision,tick:0,sequence:0,
    cascadeSerial:0,cascadeId:revision+'/c0',cascadeStartTick:0,cascadeEvents:0,quiet:0,
    lambda:clamp(number(field.lambda,.5),0,1),window:windowAt(field.lambda),mode:field.mode||'orbit',fieldHash:fieldHash,ruleVersion:Rulebook.version,rulePolicyVersion:Rulebook.policyVersion,ruleHash:Rulebook.hash,seedId:seed.id,seedSignal:number(field.trigger&&field.trigger.signal,0),
    nodes:nodes,lineage:{},history:[],lastEvents:[],directionProfile:directionProfile,options:options,metrics:metrics,
    evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
  };
}
function validateStep(state,input,normalized){
  if(!record(state)||state.kind!=='MRDSemanticReactionRuntime'||state.status==='BLOCKED') return {ok:false,code:ERROR_CODES.RUNTIME_INVALID_STATE};
  if(text(input.revision)!==state.revision) return {ok:false,code:ERROR_CODES.RUNTIME_REVISION_MISMATCH,detail:{expected:state.revision,actual:text(input.revision)}};
  var tick=integer(input.tick,NaN);
  if(!isFinite(tick)||tick!==state.tick+1) return {ok:false,code:ERROR_CODES.RUNTIME_TICK_MISMATCH,detail:{expected:state.tick+1,actual:input.tick}};
  if(!normalized.ok) return normalized;
  if(normalized.items.length!==state.nodes.length) return {ok:false,code:ERROR_CODES.RUNTIME_STALE_PARTICLES,detail:{expected:state.nodes.length,actual:normalized.items.length}};
  var current=dict(); for(var i=0;i<normalized.items.length;i++) current[idKey(normalized.items[i].id)]=normalized.items[i];
  for(i=0;i<state.nodes.length;i++){
    var node=state.nodes[i],sample=current[idKey(node.id)];
    if(!sample||sample.tokenIndex!==node.tokenIndex) return {ok:false,code:ERROR_CODES.RUNTIME_STALE_PARTICLES,detail:{id:node.id}};
  }
  return {ok:true,tick:tick,current:current};
}
function shouldRearm(state,nextTick){
  return state.cascadeEvents>=state.options.cascadeBudget||nextTick-state.cascadeStartTick>state.options.cascadeTTL||state.quiet>=state.options.rearmAfter;
}
function rearm(state,nextTick){
  state.cascadeSerial+=1; state.cascadeId=state.revision+'/c'+state.cascadeSerial; state.cascadeStartTick=nextTick;
  state.cascadeEvents=0; state.quiet=0; state.lineage={}; state.metrics.rearmed+=1;
  for(var i=0;i<state.nodes.length;i++){
    var node=state.nodes[i],seed=idKey(node.id)===idKey(state.seedId);
    node.generation=seed?0:null; node.signal=seed?state.seedSignal:null; node.state=seed?'trigger':'idle';
    node.reactionRole=seed?'seed':node.baseReactionRole; node.activationEventId=null; node.activeAt=nextTick; node.cd=0; node.act=node.baseAct;
  }
}
function cellKey(x,y){ return x+'|'+y; }
function buildGrid(nodes,options){
  var buckets=dict(),maxBucket=0;
  for(var i=0;i<nodes.length;i++){
    var node=nodes[i],cx=Math.floor(node.x/options.cellSize),cy=Math.floor(node.y/options.cellSize),key=cellKey(cx,cy);
    if(!buckets[key]) buckets[key]=[]; buckets[key].push(node);
  }
  var keys=Object.keys(buckets);
  keys.forEach(function(key){buckets[key].sort(function(a,b){return compareId(a.id,b.id);});maxBucket=Math.max(maxBucket,buckets[key].length);});
  return {buckets:buckets,cells:keys.length,maxBucket:maxBucket,range:Math.ceil(options.radius/options.cellSize)};
}
function canonicalPairs(nodes,grid,options){
  var found=dict(),pairs=[],truncated=false,stop=false;
  for(var i=0;i<nodes.length&&!stop;i++){
    var a=nodes[i],cx=Math.floor(a.x/options.cellSize),cy=Math.floor(a.y/options.cellSize),near=dict(),targets=[];
    for(var dx=-grid.range;dx<=grid.range;dx++) for(var dy=-grid.range;dy<=grid.range;dy++){
      var bucket=grid.buckets[cellKey(cx+dx,cy+dy)]||[];
      for(var bi=0;bi<bucket.length;bi++){
        var b=bucket[bi],key=idKey(b.id); if(compareId(a.id,b.id)>=0||near[key]) continue; near[key]=true; targets.push(b);
      }
    }
    targets.sort(function(left,right){return compareId(left.id,right.id);});
    for(var ti=0;ti<targets.length;ti++){
      var target=targets[ti],pairKey=idKey(a.id)+'>'+idKey(target.id); if(found[pairKey]) continue; found[pairKey]=true;
      if(pairs.length>=options.pairBudget){truncated=true;stop=true;break;} pairs.push({a:a,b:target});
    }
  }
  return {pairs:pairs,available:pairs.length+(truncated?1:0),truncated:truncated};
}
function tagAffinity(a,b){
  var aa=a.tags||[],bb=b.tags||[],seen=dict(),intersection=0,total=0;
  for(var i=0;i<aa.length;i++) if(!seen[aa[i]]){seen[aa[i]]=1;total++;}
  for(i=0;i<bb.length;i++){
    if(seen[bb[i]]===1){intersection++;seen[bb[i]]=2;}
    else if(!seen[bb[i]]){seen[bb[i]]=2;total++;}
  }
  return total?intersection/total:.55;
}
function polarity(a,b){ if(!a.q||!b.q) return 1; return a.q===b.q?.72:1.08; }
function forceFor(source,target,distance,lambda,options){
  var proximity=clamp(1-distance/options.radius,0,1),affinity=tagAffinity(source,target);
  var roleBoost=source.reactionRole==='mediated'?1.20:source.reactionRole==='seed'||source.baseReactionRole==='catalyst'?1.10:1;
  var force=windowAt(lambda)*(.55+.45*affinity)*source.act*(.58+.42*proximity)*polarity(source,target)*roleBoost;
  return {force:rounded(force),affinity:rounded(affinity),proximity:rounded(proximity)};
}
function selectionInput(mode,source,target,guarded){
  return Rulebook.normalizeSelection({
    mode:mode,guarded:!!guarded,
    sourceBaseRole:source&&source.baseReactionRole,sourceReactionRole:source&&source.reactionRole,sourceSemanticRole:source&&source.semanticRole,
    targetBaseRole:target&&target.baseReactionRole,targetReactionRole:target&&target.reactionRole,targetSemanticRole:target&&target.semanticRole
  });
}
function ruleFor(mode,source,target){
  var input=selectionInput(mode,source,target,false);
  return {rule:Rulebook.select(input),input:input};
}
function activeSource(node,state,tick){
  return node.generation!=null&&node.generation<state.options.maxGeneration&&node.cd===0&&node.activeAt<=tick&&state.cascadeEvents<state.options.cascadeBudget;
}
function candidateFor(source,target,distance,state,tick){
  var force=forceFor(source,target,distance,state.lambda,state.options),choice=ruleFor(state.mode,source,target),calibration=directionCalibration(state,choice.rule.direction);
  var handoffDirection=directionForRole(target&&target.baseReactionRole||target&&target.reactionRole),handoff=directionCalibration(state,handoffDirection);
  var handoffAvailable=number(source&&source.generation,0)+1<state.options.maxGeneration,handoffWeight=handoffAvailable ? .3 : 0,currentWeight=1-handoffWeight;
  var score=rounded(clamp(currentWeight*calibration.debt+handoffWeight*handoff.debt,-1,1));
  calibration.handoffDirection=handoffDirection; calibration.handoffAvailable=handoffAvailable; calibration.handoffDebt=handoffAvailable?handoff.debt:0; calibration.handoffExpectedShare=handoff.expectedShare;
  calibration.score=score; calibration.multiplier=rounded(1+state.options.calibrationGain*score); calibration.priorityDelta=rounded(state.options.calibrationPriority*score);
  if(handoffAvailable&&calibration.reason!=='direction:underrepresented'&&handoff.reason==='direction:underrepresented') calibration.reason='handoff:underrepresented';
  var effectiveForce=rounded(force.force*calibration.multiplier),effectivePriority=rounded(choice.rule.priority+calibration.priorityDelta);
  return {source:source,target:target,distance:distance,rawForce:force.force,force:effectiveForce,affinity:force.affinity,proximity:force.proximity,threshold:target.thr,rule:choice.rule,selectionInput:choice.input,calibration:calibration,effectivePriority:effectivePriority,tick:tick};
}
function candidateCompare(a,b){
  return b.effectivePriority-a.effectivePriority||b.force-a.force||a.distance-b.distance||
    (a.rule.id<b.rule.id?-1:a.rule.id>b.rule.id?1:0)||compareId(a.source.id,b.source.id)||compareId(a.target.id,b.target.id);
}
function collectCandidates(state,pairs,tick,metrics){
  var candidates=[],radius2=state.options.radius*state.options.radius,truncated=false;
  ensureOpportunityMetrics(metrics); metrics.lastDirectionOpportunities=emptyDirections(); metrics.lastHandoffOpportunities=emptyDirections();
  for(var i=0;i<pairs.length;i++){
    if(metrics.pairChecks>=state.options.pairBudget){truncated=true;break;}
    var a=pairs[i].a,b=pairs[i].b,dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy; metrics.pairChecks+=1;
    if(d2>radius2+EPSILON) continue;
    var distance=Math.sqrt(d2),source=null,target=null;
    if(activeSource(a,state,tick)&&b.generation==null){source=a;target=b;}
    else if(activeSource(b,state,tick)&&a.generation==null){source=b;target=a;}
    if(!source) continue;
    if(source.tokenIndex===target.tokenIndex){metrics.homogeneousRejected+=1;continue;}
    if(metrics.candidateChecks>=state.options.candidateBudget){truncated=true;break;}
    metrics.candidateChecks+=1;
    var candidate=candidateFor(source,target,distance,state,tick); candidates.push(candidate);
    if(candidate.force+EPSILON>=candidate.threshold){
      metrics.lastDirectionOpportunities[candidate.rule.direction]+=1;
      if(candidate.calibration.handoffAvailable) metrics.lastHandoffOpportunities[candidate.calibration.handoffDirection]+=1;
    }
  }
  candidates.sort(candidateCompare);
  return {items:candidates,truncated:truncated};
}
function acceptCandidates(state,candidates,metrics){
  var accepted=[],used=dict(),available=Math.min(state.options.tickBudget,state.options.cascadeBudget-state.cascadeEvents);
  for(var i=0;i<candidates.length;i++){
    var candidate=candidates[i];
    if(candidate.force+EPSILON<candidate.threshold){metrics.thresholdRejected+=1;continue;}
    if(used[idKey(candidate.source.id)]||used[idKey(candidate.target.id)]){metrics.conflictRejected+=1;continue;}
    if(accepted.length>=available){metrics.truncated=true;break;}
    used[idKey(candidate.source.id)]=true; used[idKey(candidate.target.id)]=true; accepted.push(candidate);
  }
  return accepted;
}
function deltaFor(direction,u,strength){
  if(direction==='generalize') return -.012*(.65+.35*strength);
  if(direction==='detail') return .012*(.65+.35*strength);
  if(direction==='repair') return (.5-u)*(.12+.08*strength);
  return (.5-u)*(.05+.05*strength);
}
function eventContract(event,massBefore,massAfter,options){
  return {
    pre:{ok:event.distanceSquared<=options.radius*options.radius+EPSILON&&event.force+EPSILON>=event.threshold,text:'observed local contact and force threshold passed'},
    inv:{ok:event.afterU>options.minU&&event.afterU<options.maxU&&Math.abs(massBefore-massAfter)<EPSILON,text:'mass conserved; open 2D ring; one touch per tick'},
    post:{ok:event.generation>=1&&event.targetStateAfter!=='idle',text:'target activates no earlier than the next logical tick'},
    proof:'immutable pre-state -> pair-local rule policy -> bounded forecast calibration -> Cartesian hash -> global arbitration -> batched effects',evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
  };
}
function applyAccepted(state,accepted,tick,worldTick,massBefore){
  var nodes=state.nodes.map(copy),map=stateNodeMap(nodes),events=[],effects=[],newCooldown=dict(),lineage=copy(state.lineage||{}),sequence=state.sequence;
  for(var i=0;i<accepted.length;i++){
    var candidate=accepted[i],source=map[idKey(candidate.source.id)],target=map[idKey(candidate.target.id)];
    var strength=clamp((candidate.force-candidate.threshold)/Math.max(.01,1-candidate.threshold),0,1),beforeU=target.u;
    var rule=candidate.rule,selection=candidate.selectionInput;
    var afterU=beforeU+deltaFor(rule.direction,beforeU,strength),guarded=afterU<=state.options.minU||afterU>=state.options.maxU;
    if(guarded){
      selection=selectionInput(state.mode,candidate.source,candidate.target,true); rule=Rulebook.select(selection);
      afterU=afterU<=state.options.minU?.22:.78;
    }
    afterU=innerClamp(afterU,state.options); sequence+=1;
    var eventId=state.cascadeId+'/e'+sequence,parentEventId=source.activationEventId||null;
    var parent=parentEventId&&lineage[parentEventId];
    if(parentEventId&&(!parent||idKey(parent.targetId)!==idKey(source.id)||parent.cascadeId!==state.cascadeId)) parentEventId=null;
    var sourceActBefore=source.act,targetActBefore=target.act;
    source.act=rounded(clamp(source.act-state.options.cost,0,1)); source.cd=state.options.cooldown; newCooldown[idKey(source.id)]=true;
    target.act=rounded(Math.max(target.act,sourceActBefore*.72));
    target.thr=rounded(Math.max(.12,target.thr*(source.reactionRole==='seed'||source.baseReactionRole==='catalyst'?.82:.92)));
    target.u=afterU; target.generation=source.generation+1; target.signal=source.signal; target.activeAt=tick+state.options.activationDelay;
    target.state=rule.id==='R_MEDIATE'?'mediated':'activated'; target.reactionRole=rule.id==='R_MEDIATE'?'mediated':target.reactionRole; target.activationEventId=eventId;
    var event={
      origin:'observed',eventId:eventId,parentEventId:parentEventId,revision:state.revision,tick:tick,worldTick:worldTick,
      cascadeId:state.cascadeId,generation:target.generation,ruleId:rule.id,ruleLabel:rule.label,ruleVersion:Rulebook.version,ruleHash:Rulebook.hash,priority:rule.priority,cost:rule.cost,direction:rule.direction,selectionReason:rule.selectionReason,selectionInput:selection,
      sourceId:source.id,targetId:target.id,sourceToken:source.token,targetToken:target.token,
      sourceTokenIndex:source.tokenIndex,targetTokenIndex:target.tokenIndex,sourceX:candidate.source.x,sourceY:candidate.source.y,
      targetX:candidate.target.x,targetY:candidate.target.y,distance:rounded(candidate.distance),distanceSquared:rounded(candidate.distance*candidate.distance),
      radius:state.options.radius,rawForce:candidate.rawForce,force:candidate.force,threshold:candidate.threshold,affinity:candidate.affinity,proximity:candidate.proximity,
      calibrationDirection:candidate.calibration.direction,calibrationReason:candidate.calibration.reason,expectedDirectionShare:candidate.calibration.expectedShare,observedDirectionShareBefore:candidate.calibration.observedShare,directionShareGap:candidate.calibration.shareGap,
      calibrationRawDebt:candidate.calibration.rawDebt,calibrationDebt:candidate.calibration.debt,calibrationScore:candidate.calibration.score,calibrationMultiplier:candidate.calibration.multiplier,effectivePriority:candidate.effectivePriority,
      handoffDirection:candidate.calibration.handoffDirection,handoffAvailable:candidate.calibration.handoffAvailable,handoffDebt:candidate.calibration.handoffDebt,handoffExpectedShare:candidate.calibration.handoffExpectedShare,
      beforeU:beforeU,afterU:afterU,deltaU:rounded(afterU-beforeU),guarded:guarded,
      sourceActBefore:sourceActBefore,sourceActAfter:source.act,targetActBefore:targetActBefore,targetActAfter:target.act,
      sourceRole:candidate.source.reactionRole,targetRoleBefore:candidate.target.reactionRole,targetRoleAfter:target.reactionRole,targetStateAfter:target.state,targetActiveAt:target.activeAt,
      inputPort:rule.inputPort,outputPort:rule.outputPort,portPath:Rulebook.typedPath(rule.id),
      preStateHash:hashValue({revision:state.revision,tick:tick,source:candidate.source,target:candidate.target,directionCounts:state.metrics.directionCounts,directionTarget:state.directionProfile&&state.directionProfile.target,calibration:candidate.calibration}),
      evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
    };
    lineage[eventId]={eventId:eventId,parentEventId:parentEventId,targetId:target.id,sourceId:source.id,tick:tick,cascadeId:state.cascadeId};
    events.push(event);
    effects.push({origin:'observed',eventId:eventId,parentEventId:parentEventId,sourceId:source.id,targetId:target.id,afterU:afterU,sourceAct:source.act,targetAct:target.act,targetRole:target.reactionRole,targetState:target.state,generation:target.generation,ruleId:rule.id,selectionReason:rule.selectionReason,calibrationReason:candidate.calibration.reason,handoffDirection:candidate.calibration.handoffDirection});
  }
  var preMap=stateNodeMap(state.nodes);
  for(i=0;i<nodes.length;i++){
    var node=nodes[i],pre=preMap[idKey(node.id)];
    if(pre.cd>0) node.cd=Math.max(0,integer(pre.cd,0)-1);
    else if(!newCooldown[idKey(node.id)]) node.cd=0;
    node.act=rounded(Math.min(node.baseAct,node.act+state.options.regen));
  }
  var postMap=stateNodeMap(nodes);
  for(i=0;i<events.length;i++){
    var sourceAfter=postMap[idKey(events[i].sourceId)],targetAfter=postMap[idKey(events[i].targetId)];
    events[i].sourceActAfter=sourceAfter.act; events[i].targetActAfter=targetAfter.act;
    effects[i].sourceAct=sourceAfter.act; effects[i].targetAct=targetAfter.act;
  }
  var massAfter=0; for(i=0;i<nodes.length;i++) massAfter+=nodes[i].mass;
  for(i=0;i<events.length;i++) events[i].contract=eventContract(events[i],massBefore,massAfter,state.options);
  return {nodes:nodes,events:events,effects:effects,lineage:lineage,sequence:sequence,massAfter:massAfter};
}
function invariantReport(state,events,metrics,massBefore,massAfter){
  var failures=[],used=dict(),lineage=state.lineage||{},minU=1,maxU=0,finite=true,bounds=true,cooldowns=true,generations=true,parents=true,locality=true,typedRules=true;
  for(var i=0;i<state.nodes.length;i++){
    var node=state.nodes[i]; minU=Math.min(minU,node.u); maxU=Math.max(maxU,node.u);
    if(!isFinite(node.x)||!isFinite(node.y)||!isFinite(node.u)||!isFinite(node.act)||!isFinite(node.thr)||!isFinite(node.mass)) finite=false;
    if(!(node.u>state.options.minU&&node.u<state.options.maxU)||node.act<0||node.act>1||node.thr<0||node.thr>1) bounds=false;
    if(node.cd<0||node.cd!==Math.floor(node.cd)) cooldowns=false;
    if(node.generation!=null&&(node.generation<0||node.generation>state.options.maxGeneration)) generations=false;
  }
  for(i=0;i<events.length;i++){
    var event=events[i],sourceKey=idKey(event.sourceId),targetKey=idKey(event.targetId);
    if(used[sourceKey]||used[targetKey]) failures.push('one-touch'); used[sourceKey]=true; used[targetKey]=true;
    if(event.distanceSquared>state.options.radius*state.options.radius+EPSILON) locality=false;
    if(!Rulebook.validateEvent(event).ok) typedRules=false;
    if(event.parentEventId){
      var parent=lineage[event.parentEventId];
      if(!parent||idKey(parent.targetId)!==sourceKey||parent.tick>=event.tick||parent.cascadeId!==event.cascadeId) parents=false;
    }
  }
  if(!finite) failures.push('finite'); if(!bounds) failures.push('bounds'); if(!cooldowns) failures.push('cooldown');
  if(!generations) failures.push('generation'); if(!parents) failures.push('lineage'); if(!locality) failures.push('locality'); if(!typedRules) failures.push('typed-rules');
  if(events.length>state.options.tickBudget||metrics.pairChecks>state.options.pairBudget||metrics.candidateChecks>state.options.candidateBudget||state.cascadeEvents>state.options.cascadeBudget) failures.push('budget');
  if(Math.abs(massBefore-massAfter)>EPSILON) failures.push('mass'); if(state.history.length>state.options.historyLimit) failures.push('history');
  return {
    ok:failures.length===0,failures:failures,checks:{finite:finite,bounds:bounds,cooldowns:cooldowns,generations:generations,lineage:parents,locality:locality,
      oneTouch:failures.indexOf('one-touch')<0,typedRules:typedRules,budgets:failures.indexOf('budget')<0,mass:Math.abs(massBefore-massAfter)<=EPSILON,history:state.history.length<=state.options.historyLimit},
    minU:rounded(minU),maxU:rounded(maxU),mass:rounded(massAfter)
  };
}
function step(state,input){
  input=input||{};
  var options=record(state)&&state.options?state.options:optionsOf(),normalized=normalizeParticles(input.particles,options),valid=validateStep(state,input,normalized);
  if(!valid.ok) return blockedResult(state,valid.code,valid.detail);
  var working=copy(state),tick=valid.tick;
  working.status='READY'; working.code=null; working.errorCode=null; working.errors=[]; working.tick=tick;
  working.lambda=clamp(number(input.lambda,working.lambda),0,1); working.window=windowAt(working.lambda);
  if(shouldRearm(working,tick)) rearm(working,tick);
  var current=valid.current;
  for(var i=0;i<working.nodes.length;i++){
    var sample=current[idKey(working.nodes[i].id)]; working.nodes[i].x=sample.x; working.nodes[i].y=sample.y; working.nodes[i].u=sample.u;
  }
  var massBefore=0; for(i=0;i<working.nodes.length;i++) massBefore+=working.nodes[i].mass;
  var grid=buildGrid(working.nodes,working.options),pairPack=canonicalPairs(working.nodes,grid,working.options);
  var metrics=copy(working.metrics); if(!record(metrics.directionCounts)) metrics.directionCounts={generalize:0,detail:0,orbit:0,repair:0};
  metrics.cells=grid.cells; metrics.maxBucket=grid.maxBucket; metrics.pairsAvailable=pairPack.available;
  metrics.pairChecks=0; metrics.candidateChecks=0; metrics.thresholdRejected=0; metrics.homogeneousRejected=0; metrics.conflictRejected=0; metrics.truncated=pairPack.truncated;
  var candidatePack=collectCandidates(working,pairPack.pairs,tick,metrics); metrics.truncated=metrics.truncated||candidatePack.truncated;
  var accepted=acceptCandidates(working,candidatePack.items,metrics),worldTick=number(input.worldTick,tick);
  var applied=applyAccepted(working,accepted,tick,worldTick,massBefore);
  working.nodes=applied.nodes; working.lineage=applied.lineage; working.sequence=applied.sequence; working.lastEvents=applied.events;
  working.cascadeEvents+=applied.events.length; working.quiet=applied.events.length?0:working.quiet+1;
  working.history=working.history.concat(applied.events).slice(-working.options.historyLimit);
  metrics.lastBudgetUsed=applied.events.length; metrics.totalEvents+=applied.events.length; metrics.particles=working.nodes.length;
  applied.events.forEach(function(event){metrics.directionCounts[event.direction]=(metrics.directionCounts[event.direction]||0)+1;});
  updateDirectionMetrics(metrics,working.directionProfile);
  updateOpportunityMetrics(metrics,working.directionProfile,working.options.opportunityDecay);
  var preliminary=invariantReport(working,applied.events,metrics,massBefore,applied.massAfter);
  metrics.minU=preliminary.minU; metrics.maxU=preliminary.maxU; metrics.mass=preliminary.mass; working.metrics=metrics;
  var invariants=invariantReport(working,applied.events,metrics,massBefore,applied.massAfter);
  if(!invariants.ok) return blockedResult(state,ERROR_CODES.RUNTIME_INVARIANT_FAILED,{failures:invariants.failures});
  working.status=applied.events.length?'FIRED':working.window<.25?'DAMPED':'WAITING';
  var attempts={pairsAvailable:pairPack.available,pairChecks:metrics.pairChecks,candidateChecks:metrics.candidateChecks,
    thresholdRejected:metrics.thresholdRejected,homogeneousRejected:metrics.homogeneousRejected,conflictRejected:metrics.conflictRejected,eligibleOpportunities:directionTotal(metrics.lastDirectionOpportunities),handoffOpportunities:directionTotal(metrics.lastHandoffOpportunities),accepted:applied.events.length,truncated:metrics.truncated};
  return {
    state:working,status:working.status,code:null,errorCode:null,events:copy(applied.events),effects:copy(applied.effects),attemptsSummary:attempts,
    metrics:copy(metrics),invariants:invariants,
    contract:{pre:{ok:true,text:'exact revision, next tick, stable particle identity'},inv:{ok:true,text:'bounded deterministic 2D runtime'},post:{ok:true,text:'effects are observed-only and batched'}},
    evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
  };
}
function snapshot(state){
  if(!record(state)) return null;
  var active=0,cooling=0;
  (state.nodes||[]).forEach(function(node){if(node.generation!=null) active+=1;if(node.cd>0) cooling+=1;});
  return {
    version:VERSION,kind:'MRDSemanticReactionRuntimeSnapshot',origin:'observed',status:state.status,code:state.code||null,
    revision:state.revision,tick:state.tick,sequence:state.sequence,cascadeSerial:state.cascadeSerial,cascadeId:state.cascadeId,
    cascadeStartTick:state.cascadeStartTick,cascadeEvents:state.cascadeEvents,lambda:state.lambda,window:state.window,mode:state.mode,
    fieldHash:state.fieldHash,ruleVersion:state.ruleVersion,rulePolicyVersion:state.rulePolicyVersion,ruleHash:state.ruleHash,seedId:state.seedId,active:active,cooling:cooling,quiet:state.quiet,directionProfile:copy(state.directionProfile),metrics:copy(state.metrics),
    nodes:copy(state.nodes||[]),lastEvents:copy(state.lastEvents||[]),history:copy(state.history||[]),
    evidence:state.evidence||UNVERIFIED,evidenceLevel:state.evidenceLevel||state.evidence||UNVERIFIED,soundness:NOT_COMPUTED
  };
}

global.MRDSemanticReactionRuntime={
  version:VERSION,ruleVersion:Rulebook&&Rulebook.version||null,rulePolicyVersion:Rulebook&&Rulebook.policyVersion||null,ruleHash:Rulebook&&Rulebook.hash||null,errorCodes:ERROR_CODES,ERROR_CODES:ERROR_CODES,defaults:copy(DEFAULTS),create:create,step:step,snapshot:snapshot,windowAt:windowAt,directionProfile:profileFor
};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
