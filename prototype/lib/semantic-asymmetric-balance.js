(function(global){
'use strict';

var VERSION='1.0.0';
var EPSILON=1e-12;

function freeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(key){ freeze(value[key]); });
  return Object.freeze(value);
}

function proof(status,code,extra){
  var value={
    version:VERSION,
    kind:'MRDSemanticAsymmetricBalance',
    status:status,
    code:code||null,
    evidence:'STRUCTURAL',
    evidenceLevel:'STRUCTURAL',
    soundness:'NOT_COMPUTED',
    semanticTruth:false
  };
  Object.keys(extra||{}).forEach(function(key){ value[key]=extra[key]; });
  return freeze(value);
}

function unit(value){
  return typeof value==='number'&&isFinite(value)&&value>=0&&value<=1?value:null;
}

function clean(value){
  if(Math.abs(value)<EPSILON) return 0;
  if(Math.abs(1-value)<EPSILON) return 1;
  return value;
}

function componentSummary(components){
  var center=components.p3d, edge=components.p1d, orbit=components.p2d;
  var max=Math.max(center,edge,orbit), labels=[];
  if(Math.abs(center-max)<=EPSILON) labels.push('3d');
  if(Math.abs(orbit-max)<=EPSILON) labels.push('2d');
  if(Math.abs(edge-max)<=EPSILON) labels.push('1d');
  var direction=Math.abs(components.p2dForward-components.p2dReverse)<=EPSILON?'neutral':components.p2dForward>components.p2dReverse?'forward':'reverse';
  return {
    dominant:labels.length===1?labels[0]:'mixed',
    direction:direction,
    margin:clean(orbit-Math.max(center,edge)),
    asymmetry:clean(Math.abs(components.p2dForward-components.p2dReverse))
  };
}

function crossState(x,y){
  var nx=unit(x), ny=unit(y);
  if(nx===null||ny===null){
    return proof('INVALID','ASYMMETRIC_INPUT_RANGE',{input:{x:x,y:y}});
  }
  var components={
    p3d:clean(nx*ny),
    p1d:clean((1-nx)*(1-ny)),
    p2dForward:clean(nx*(1-ny)),
    p2dReverse:clean((1-nx)*ny)
  };
  components.p2d=clean(components.p2dForward+components.p2dReverse);
  var sum=clean(components.p3d+components.p1d+components.p2d);
  var summary=componentSummary(components);
  return proof('READY',null,{
    input:{x:nx,y:ny},
    components:components,
    sum:sum,
    dominant:summary.dominant,
    direction:summary.direction,
    margin:summary.margin,
    asymmetry:summary.asymmetry,
    contract:{
      pre:{ok:true,range:true},
      inv:{ok:Math.abs(sum-1)<=EPSILON,partition:sum},
      post:{ok:true,bounded:true}
    }
  });
}

function pairId(value,index){
  if(!value||typeof value!=='object') return '';
  var id=value.id==null?'':String(value.id).trim();
  return id||'pair-'+String(index+1);
}

function buildFlags(pairs,options){
  options=options||{};
  if(!Array.isArray(pairs)) return proof('INVALID','ASYMMETRIC_PAIRS_REQUIRED',{flags:[]});
  if(pairs.length<2) return proof('ABSTAIN','ASYMMETRIC_PAIRS_THIN',{flags:[],pairCount:pairs.length});
  if(typeof options.weight!=='function') return proof('INVALID','ASYMMETRIC_WEIGHT_REQUIRED',{flags:[],pairCount:pairs.length});
  var ids=[], seen={};
  for(var p=0;p<pairs.length;p++){
    if(!pairs[p]||typeof pairs[p]!=='object'||pairs[p].a==null||pairs[p].b==null){
      return proof('INVALID','ASYMMETRIC_PAIR_SHAPE',{flags:[],pairIndex:p});
    }
    var id=pairId(pairs[p],p);
    if(seen['$'+id]) return proof('INVALID','ASYMMETRIC_PAIR_DUPLICATE',{flags:[],pairId:id});
    seen['$'+id]=true; ids.push(id);
  }
  var flags=[];
  for(var i=0;i<pairs.length;i++){
    for(var j=i+1;j<pairs.length;j++){
      var x,y;
      try{
        x=options.weight(pairs[i].a,pairs[j].b,{from:ids[i],to:ids[j],cross:'forward'});
        y=options.weight(pairs[j].a,pairs[i].b,{from:ids[j],to:ids[i],cross:'reverse'});
      }catch(error){
        return proof('INVALID','ASYMMETRIC_WEIGHT_ERROR',{flags:flags,pairIds:[ids[i],ids[j]],message:error&&error.message||String(error)});
      }
      var state=crossState(x,y);
      if(state.status!=='READY') return proof('INVALID','ASYMMETRIC_WEIGHT_RANGE',{flags:flags,pairIds:[ids[i],ids[j]],input:{x:x,y:y}});
      flags.push(freeze({
        id:ids[i]+'::'+ids[j],
        from:ids[i],
        to:ids[j],
        x:x,
        y:y,
        state:state,
        evidence:'STRUCTURAL',
        soundness:'NOT_COMPUTED'
      }));
    }
  }
  return proof('READY',null,{pairCount:pairs.length,flagCount:flags.length,flags:flags});
}

function stateOf(item){
  if(item&&item.state&&item.state.status==='READY') return item.state;
  return crossState(item&&item.x,item&&item.y);
}

function metric(item,name,fallback){
  if(!item||item[name]===undefined) return fallback;
  return unit(item[name]);
}

function threshold(value,fallback){
  return value===undefined?fallback:unit(value);
}

function rankTransitions(items,options){
  options=options||{};
  if(!Array.isArray(items)) return proof('INVALID','ASYMMETRIC_TRANSITIONS_REQUIRED',{items:[]});
  if(!items.length) return proof('ABSTAIN','ASYMMETRIC_TRANSITIONS_EMPTY',{items:[]});
  var hasThresholds=!!options.thresholds, limits=options.thresholds||{};
  var minScore=threshold(limits.minScore,0), minGuard=threshold(limits.minGuardAfter,0), maxCenter=threshold(limits.maxCenter,1), maxEdge=threshold(limits.maxEdge,1);
  if(minScore===null||minGuard===null||maxCenter===null||maxEdge===null){
    return proof('INVALID','ASYMMETRIC_THRESHOLD_RANGE',{items:[]});
  }
  var ranked=[];
  for(var i=0;i<items.length;i++){
    var item=items[i]||{}, state=stateOf(item), id=item.id==null?'transition-'+String(i+1):String(item.id);
    var semFit=metric(item,'semFit',1), novelty=metric(item,'novelty',1), guardAfter=metric(item,'guardAfter',1), conflictRisk=metric(item,'conflictRisk',0), confidence=metric(item,'confidence',1);
    if(state.status!=='READY'||semFit===null||novelty===null||guardAfter===null||conflictRisk===null||confidence===null){
      ranked.push(freeze({id:id,status:'INVALID',code:'ASYMMETRIC_TRANSITION_RANGE',score:0,rankScore:0,state:state}));
      continue;
    }
    var components=state.components;
    var score=clean(components.p2d*semFit*novelty*guardAfter*(1-conflictRisk));
    var rankScore=clean(score*confidence), reasons=[];
    if(hasThresholds){
      if(score<minScore) reasons.push('score');
      if(guardAfter<minGuard) reasons.push('guard');
      if(components.p3d>maxCenter) reasons.push('center');
      if(components.p1d>maxEdge) reasons.push('edge');
    }
    ranked.push(freeze({
      id:id,
      status:hasThresholds?(reasons.length?'BLOCKED':'ELIGIBLE'):'SCORED',
      code:reasons.length?'ASYMMETRIC_LIMIT':null,
      reasons:reasons,
      score:score,
      rankScore:rankScore,
      confidence:confidence,
      metrics:{semFit:semFit,novelty:novelty,guardAfter:guardAfter,conflictRisk:conflictRisk},
      state:state,
      evidence:'STRUCTURAL',
      soundness:'NOT_COMPUTED'
    }));
  }
  ranked.sort(function(a,b){
    if(a.status==='INVALID'&&b.status!=='INVALID') return 1;
    if(b.status==='INVALID'&&a.status!=='INVALID') return -1;
    return b.rankScore-a.rankScore||String(a.id).localeCompare(String(b.id));
  });
  return proof(ranked.some(function(item){return item.status!=='INVALID';})?'READY':'INVALID',ranked.some(function(item){return item.status!=='INVALID';})?null:'ASYMMETRIC_TRANSITIONS_INVALID',{
    thresholded:hasThresholds,
    thresholds:{minScore:minScore,minGuardAfter:minGuard,maxCenter:maxCenter,maxEdge:maxEdge},
    eligibleCount:ranked.filter(function(item){return item.status==='ELIGIBLE';}).length,
    items:ranked
  });
}

function aggregate(items){
  if(!Array.isArray(items)) return proof('INVALID','ASYMMETRIC_AGGREGATE_REQUIRED',{components:null});
  if(!items.length) return proof('ABSTAIN','ASYMMETRIC_AGGREGATE_EMPTY',{components:null});
  var totalWeight=0, used=0, ignoredZeroWeight=0;
  var sums={p3d:0,p1d:0,p2dForward:0,p2dReverse:0,p2d:0};
  for(var i=0;i<items.length;i++){
    var item=items[i]||{}, state=stateOf(item), confidence=metric(item,'confidence',1);
    if(state.status!=='READY'||confidence===null) return proof('INVALID','ASYMMETRIC_AGGREGATE_RANGE',{components:null,itemIndex:i});
    if(confidence===0){ ignoredZeroWeight++; continue; }
    Object.keys(sums).forEach(function(key){ sums[key]+=state.components[key]*confidence; });
    totalWeight+=confidence; used++;
  }
  if(totalWeight<=EPSILON) return proof('ABSTAIN','ASYMMETRIC_AGGREGATE_ZERO_WEIGHT',{components:null,used:0,ignoredZeroWeight:ignoredZeroWeight});
  var components={};
  Object.keys(sums).forEach(function(key){ components[key]=clean(sums[key]/totalWeight); });
  var sum=clean(components.p3d+components.p1d+components.p2d), summary=componentSummary(components);
  return proof('READY',null,{
    used:used,
    ignoredZeroWeight:ignoredZeroWeight,
    totalWeight:totalWeight,
    components:components,
    sum:sum,
    dominant:summary.dominant,
    direction:summary.direction,
    margin:summary.margin,
    asymmetry:summary.asymmetry,
    contract:{inv:{ok:Math.abs(sum-1)<=EPSILON,partition:sum}}
  });
}

global.MRDSemanticAsymmetricBalance=freeze({
  version:VERSION,
  evidence:'STRUCTURAL',
  soundness:'NOT_COMPUTED',
  crossState:crossState,
  buildFlags:buildFlags,
  rankTransitions:rankTransitions,
  aggregate:aggregate
});
})(typeof window!=='undefined'?window:globalThis);
