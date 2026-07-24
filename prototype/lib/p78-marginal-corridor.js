(function(global){
'use strict';

var VERSION='1.1.0';
var EPSILON=1e-12;
var REGIME_THRESHOLD=.18;
var FLOW_FLOOR=.30;
var FLOW_DOMINANCE=.90;

function clamp01(value){
  value=Number(value);
  return isFinite(value)?Math.max(0,Math.min(1,value)):0;
}
function freeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(key){ freeze(value[key]); });
  return Object.freeze(value);
}
function copy(value){
  var out={};
  Object.keys(value||{}).forEach(function(key){ out[key]=value[key]; });
  return out;
}
function edgeKey(a,b){ return a<b?a+'|'+b:b+'|'+a; }
function safeIndex(value,count){
  value=Number(value);
  return Number.isInteger(value)&&value>=0&&value<count?value:null;
}
function graphStats(nodeCount,sourceEdges){
  var n=Math.max(0,Math.floor(Number(nodeCount)||0)), adjacency=[],edges=[],seen={};
  var i;
  for(i=0;i<n;i++) adjacency.push([]);
  (Array.isArray(sourceEdges)?sourceEdges:[]).forEach(function(source){
    source=source||{};
    var a=safeIndex(source.a===undefined?source.i:source.a,n);
    var b=safeIndex(source.b===undefined?source.j:source.b,n);
    if(a===null||b===null||a===b) return;
    var key=edgeKey(a,b);
    if(seen[key]) return;
    seen[key]=true;
    adjacency[a].push(b); adjacency[b].push(a);
    edges.push({a:Math.min(a,b),b:Math.max(a,b)});
  });
  if(!n){
    return {
      nodes:0,edges:0,components:0,componentSizes:[],isolates:0,largest:0,
      giant:0,componentEntropy:0,fragmentation:0,cycleRank:0,cycleCapacity:0,
      rigidity:0,circulation:0,meanDegree:0
    };
  }
  var visited={},sizes=[];
  for(i=0;i<n;i++){
    if(visited[i]) continue;
    var queue=[i],size=0; visited[i]=true;
    while(queue.length){
      var current=queue.shift(); size++;
      adjacency[current].forEach(function(next){
        if(visited[next]) return;
        visited[next]=true; queue.push(next);
      });
    }
    sizes.push(size);
  }
  sizes.sort(function(a,b){ return b-a; });
  var isolates=adjacency.filter(function(list){ return list.length===0; }).length;
  var largest=sizes[0]||0,giant=largest/n,isolateRatio=isolates/n;
  var entropy=0;
  if(n>1){
    sizes.forEach(function(size){
      var probability=size/n;
      entropy-=probability*Math.log(probability);
    });
    entropy=clamp01(entropy/Math.log(n));
  }
  var components=sizes.length;
  var cycleRank=Math.max(0,edges.length-n+components);
  var cycleCapacity=n>2?(n-1)*(n-2)/2:0;
  var rigidity=cycleCapacity?clamp01(cycleRank/cycleCapacity):0;
  var fragmentation=clamp01(((1-giant)+isolateRatio+entropy)/3);
  var circulation=clamp01(giant*(1-rigidity)*(1-.35*isolateRatio));
  return {
    nodes:n,edges:edges.length,components:components,componentSizes:sizes,isolates:isolates,
    largest:largest,giant:giant,componentEntropy:entropy,fragmentation:fragmentation,
    cycleRank:cycleRank,cycleCapacity:cycleCapacity,rigidity:rigidity,
    circulation:circulation,meanDegree:2*edges.length/n
  };
}
function regime(fragmentation,rigidity,circulation,status){
  if(status==='ABSTAIN'||status==='EMPTY') return 'ABSTAIN';
  fragmentation=clamp01(fragmentation); rigidity=clamp01(rigidity); circulation=clamp01(circulation);
  if(fragmentation>=.90&&fragmentation-rigidity>=.55) return '1D_LIMIT';
  if(rigidity>=.90&&rigidity-fragmentation>=.55) return '3D_LIMIT';
  if(circulation>=FLOW_FLOOR&&circulation>=FLOW_DOMINANCE*Math.max(fragmentation,rigidity)) return '2D';
  if(fragmentation-rigidity>=REGIME_THRESHOLD) return '1.5D';
  if(rigidity-fragmentation>=REGIME_THRESHOLD) return '2.5D';
  return '2D';
}
function layerResult(id,label,status,confidence,stats,extra){
  extra=extra||{};
  var fragmentation=clamp01(extra.fragmentation===undefined?stats.fragmentation:extra.fragmentation);
  var rigidity=clamp01(extra.rigidity===undefined?stats.rigidity:extra.rigidity);
  var circulation=clamp01(extra.circulation===undefined?stats.circulation:extra.circulation);
  return {
    id:id,label:label,status:status,confidence:clamp01(confidence),
    regime:regime(fragmentation,rigidity,circulation,status),
    fragmentation:fragmentation,rigidity:rigidity,circulation:circulation,
    graph:stats,issues:extra.issues||0,note:extra.note||'',
    evidenceLevel:extra.evidenceLevel||'HEURISTIC',soundness:'NOT_COMPUTED'
  };
}
function fallbackOccurrences(text){
  var source=String(text||''),regex=/[A-Za-zА-Яа-яЁё0-9]+/g,out=[],match,last=0,sentence=0;
  while((match=regex.exec(source))){
    var boundaries=source.slice(last,match.index).match(/[.!?]+/g);
    if(boundaries) sentence+=boundaries.length;
    out.push({token:match[0].toLowerCase(),lemma:match[0].toLowerCase(),index:out.length,sentence:sentence});
    last=regex.lastIndex;
  }
  return out;
}
function formLayer(text,language){
  var occurrences=language&&Array.isArray(language.occurrences)?language.occurrences:fallbackOccurrences(text);
  var n=occurrences.length,edges=[],first={};
  for(var i=1;i<n;i++){
    if(occurrences[i-1].sentence===occurrences[i].sentence) edges.push({a:i-1,b:i});
  }
  occurrences.forEach(function(item,index){
    var key=String(item&&item.lemma||item&&item.token||'').toLowerCase();
    if(!key) return;
    if(first[key]===undefined) first[key]=index;
    else edges.push({a:first[key],b:index});
  });
  var stats=graphStats(n,edges),status=!n?'EMPTY':n<2?'ABSTAIN':'READY';
  return layerResult('form','форма',status,clamp01(n/4),stats,{
    evidenceLevel:'OBSERVED',
    note:'последовательность знаков, границы фраз и повторы'
  });
}
function grammarLayer(language){
  var occurrences=language&&Array.isArray(language.occurrences)?language.occurrences:[];
  var grammar=language&&language.grammar||null,deps=grammar&&Array.isArray(grammar.dependencies)?grammar.dependencies:[];
  var edges=deps.filter(function(item){ return item&&item.status!=='FAIL'; }).map(function(item){
    return {a:item.headIndex,b:item.dependentIndex};
  });
  var stats=graphStats(occurrences.length,edges);
  var checks=grammar&&Array.isArray(grammar.checks)?grammar.checks:[];
  var failures=grammar&&Array.isArray(grammar.failures)?grammar.failures.length:0;
  var open=grammar&&Array.isArray(grammar.openValencies)?grammar.openValencies.length:
    grammar&&grammar.metrics&&Number(grammar.metrics.open)||0;
  var status=!occurrences.length?'EMPTY':failures?'CONFLICT':!deps.length?'ABSTAIN':open?'OPEN':'READY';
  var dependencyCoverage=occurrences.length>1?Math.min(1,deps.length/(occurrences.length-1)):0;
  var confidence=clamp01((language&&language.coverage||0)*(.35+.65*dependencyCoverage));
  var conflictRisk=checks.length?failures/checks.length:0;
  return layerResult('grammar','грамматика',status,confidence,stats,{
    fragmentation:clamp01(stats.fragmentation+.18*conflictRisk),
    rigidity:stats.rigidity,
    circulation:clamp01(stats.circulation*(1-.55*conflictRisk)),
    issues:failures,
    evidenceLevel:grammar&&grammar.evidenceLevel||'HEURISTIC',
    note:(status==='ABSTAIN'?'мини-парсер не нашёл достаточно зависимостей':
      'согласование, валентность и зависимости')+
      ' · checks '+checks.length+' · failed '+failures+' · open '+open+' · dependencies '+deps.length
  });
}
function semanticLayer(text,analysis){
  analysis=analysis||{};
  var tokens=Array.isArray(analysis.tokens)?analysis.tokens:[];
  var relations=Array.isArray(analysis.relations)?analysis.relations:[];
  var support=relations.filter(function(item){ return item&&item.type!=='conflict'; }).map(function(item){
    return {a:item.i,b:item.j};
  });
  var conflicts=relations.filter(function(item){ return item&&item.type==='conflict'; }).length;
  var stats=graphStats(tokens.length,support);
  var conflictRisk=relations.length?conflicts/relations.length:0;
  var source=String(text||'');
  var counterIntent=/не\s+(?:свод|сжим|сверн|обобщ)|сохран\w*[^.!?]{0,60}(?:детал|факт|пример)|не\s+потер\w*[^.!?]{0,60}(?:детал|факт|пример)/i.test(source);
  var centerIntent=!counterIntent&&/(?:свод|сжим|сверн|обобщ)\w*[^.!?]{0,80}(?:все|один|един|общ|окончат)|(?:все|кажд\w*)[^.!?]{0,80}(?:в один|в един|общ\w+\s+(?:итог|тезис)|один\w*\s+(?:итог|тезис))|общ\w+\s+итог[^.!?]{0,80}(?:кажд|все)/i.test(source);
  var move=clamp01(analysis.move),detailPressure=clamp01(analysis.edge)*(1-move),corePressure=clamp01(analysis.core)*(1-move);
  var fragmentation=clamp01(.65*stats.fragmentation+.35*detailPressure+.20*conflictRisk);
  var rigidity=clamp01(.65*stats.rigidity+.35*corePressure);
  var circulation=clamp01(stats.circulation*(.55+.45*move)*(1-.55*conflictRisk));
  if(centerIntent){
    fragmentation=clamp01(fragmentation*.50);
    rigidity=clamp01(rigidity+.62);
    circulation=clamp01(circulation*.55);
  }
  var status=!tokens.length?'EMPTY':tokens.length<2?'ABSTAIN':conflicts?'CONFLICT':'READY';
  var confidence=clamp01((tokens.length/6)*(.55+.45*clamp01(analysis.semFit||.62)));
  return layerResult('semantics','семантика',status,confidence,stats,{
    fragmentation:fragmentation,rigidity:rigidity,circulation:circulation,
    issues:conflicts,evidenceLevel:'STRUCTURAL',
    note:conflicts?'есть несовместимые отношения без подтверждённого моста':
      centerIntent?'явно задано сведение различимых деталей к одному тезису':'отношения, мосты и смысловые роли'
  });
}
function jammingTrace(field){
  var particles=field&&Array.isArray(field.particles)?field.particles:[];
  if(particles.length<2){
    return {
      status:'ABSTAIN',samples:particles.length,K:null,N:null,D:null,ratio:null,gap:null,
      meanRigidity:null,side:'unknown',diagnosticOnly:true,target:null,
      formula:'KΔ=<q(1-q)>; NΔ=<q²(1-q)>; DΔ=<Δq²>'
    };
  }
  var samples=[],weightSum=0,K=0,N=0,mean=0;
  particles.forEach(function(particle){
    var u=clamp01(particle&&particle.u),q=1-u,weight=Math.max(EPSILON,Number(particle&&particle.mass)||1);
    samples.push({q:q,weight:weight});
    weightSum+=weight; K+=weight*q*(1-q); N+=weight*q*q*(1-q); mean+=weight*q;
  });
  K/=weightSum; N/=weightSum; mean/=weightSum;
  var D=0,pairWeight=0;
  for(var i=0;i<samples.length;i++){
    var next=samples[(i+1)%samples.length],weight=(samples[i].weight+next.weight)/2;
    var delta=next.q-samples[i].q;
    D+=weight*delta*delta; pairWeight+=weight;
  }
  D=pairWeight?D/pairWeight:0;
  var ratio=D>EPSILON?N/D:null;
  var gap=(D+2*N)>EPSILON?Math.abs(D-2*N)/(D+2*N):null;
  return {
    status:'READY',samples:samples.length,K:K,N:N,D:D,ratio:ratio,gap:gap,
    middleSupport:clamp01(4*K),meanRigidity:mean,
    side:mean>.56?'toward_3d':mean<.44?'toward_1d':'middle',
    diagnosticOnly:true,target:null,
    formula:'KΔ=<q(1-q)>; NΔ=<q²(1-q)>; DΔ=<((q[i+1]-q[i])²)>ring',
    warning:'DΔ=2NΔ здесь не является законом языка и не управляет режимом'
  };
}
function recommendation(value){
  if(value==='1D_LIMIT'||value==='1.5D') return 'Связать два раздельных блока одним проверяемым мостом, не сливая их в общий тезис.';
  if(value==='3D_LIMIT'||value==='2.5D') return 'Ослабить одно дублирующее ограничение и вернуть различимую деталь, не разрывая основной маршрут.';
  if(value==='ABSTAIN') return 'Добавить ещё одно предложение или явную связь, чтобы коридор можно было оценить.';
  return 'Продолжить через один новый факт и оставить открытый мост к следующему предложению.';
}
function aggregate(layers){
  var base={form:.20,grammar:.30,semantics:.50},weight=0,fragmentation=0,rigidity=0,circulation=0;
  layers.forEach(function(layer){
    if(layer.status==='EMPTY'||layer.status==='ABSTAIN') return;
    var current=(base[layer.id]||0)*layer.confidence;
    if(current<=0) return;
    weight+=current;
    fragmentation+=layer.fragmentation*current;
    rigidity+=layer.rigidity*current;
    circulation+=layer.circulation*current;
  });
  if(weight<=EPSILON){
    return {
      status:'ABSTAIN',regime:'ABSTAIN',fragmentation:0,rigidity:0,circulation:0,
      position:.5,confidence:0,recommendation:recommendation('ABSTAIN')
    };
  }
  fragmentation=clamp01(fragmentation/weight);
  rigidity=clamp01(rigidity/weight);
  circulation=clamp01(circulation/weight);
  var value=regime(fragmentation,rigidity,circulation,'READY');
  return {
    status:'READY',regime:value,fragmentation:fragmentation,rigidity:rigidity,
    circulation:circulation,position:clamp01(.5+.5*(rigidity-fragmentation)),
    confidence:clamp01(weight),recommendation:recommendation(value)
  };
}
function evaluate(input){
  input=input||{};
  var layers=[
    formLayer(input.text,input.language),
    grammarLayer(input.language),
    semanticLayer(input.text,input.analysis)
  ];
  var overall=aggregate(layers),jamming=jammingTrace(input.field);
  return freeze({
    version:VERSION,kind:'MRDP78MarginalCorridor',status:overall.status,
    evidenceLevel:'HEURISTIC',soundness:'NOT_COMPUTED',semanticTruth:false,
    layers:layers,overall:overall,jamming:jamming,
    contracts:{
      dimensions:'1.5D and 2.5D are interface regimes, not physical dimensions',
      ramsey:'global boundary analogy only; no local Ramsey theorem is claimed',
      fragmentation:'observed graph statistics; thresholds require calibration',
      jamming:'discrete diagnostic trace only; DΔ=2NΔ is not imposed'
    },
    formula:'corridor = aggregate(form graph, grammar graph, semantic graph); 2D if circulation sustains both pressures; position = .5 + .5*(rigidity-fragmentation)'
  });
}
function decorateTextResult(pack,model){
  if(!pack||!model||!model.overall||model.overall.status!=='READY') return pack;
  var out=copy(pack),overall=model.overall;
  out.rows=(Array.isArray(pack.rows)?pack.rows.slice():[]);
  out.rows.push({
    label:'коридор',
    value:overall.regime+' · распад '+overall.fragmentation.toFixed(2)+' · жёсткость '+overall.rigidity.toFixed(2),
    score:overall.circulation
  });
  out.summary=String(pack.summary||'')+' Коридор '+overall.regime+': '+overall.recommendation;
  out.formula=String(pack.formula||'result = metrics -> text')+'; corridor = form + grammar + semantics';
  out.marginalCorridor=model;
  return out;
}

global.MRDP78MarginalCorridor=freeze({
  version:VERSION,threshold:REGIME_THRESHOLD,
  graphStats:graphStats,evaluate:evaluate,decorateTextResult:decorateTextResult
});
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
