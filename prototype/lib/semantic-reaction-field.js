(function(global){
'use strict';

var VERSION='1.2.0';
var STRUCTURAL='STRUCTURAL';
var UNVERIFIED='UNVERIFIED';
var NOT_COMPUTED='NOT_COMPUTED';
var MIN_U=.18;
var MAX_U=.82;

var Rulebook=global.MRDSemanticReactionRules||null;
if(!Rulebook||typeof Rulebook.list!=='function'||typeof Rulebook.select!=='function') throw new Error('MRDSemanticReactionRules is required before MRDSemanticReactionField');
var RULES=Rulebook.list();

function core(){ return global.MRDSemanticCore||null; }
function text(value){ return value==null?'':String(value); }
function number(value,fallback){ value=Number(value); return isFinite(value)?value:fallback; }
function clamp(value,min,max){ value=number(value,min); return value<min?min:value>max?max:value; }
function rounded(value){ return Math.round(number(value,0)*1000000)/1000000; }
function hash(value){
  var c=core();
  if(c&&typeof c.hash==='function') return Number(c.hash(text(value)))>>>0;
  var h=2166136261>>>0, source=text(value);
  for(var i=0;i<source.length;i++){ h^=source.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
function unique(values){
  var seen={}, out=[];
  (values||[]).forEach(function(value){ value=text(value); if(value&&!seen[value]){seen[value]=1;out.push(value);} });
  return out;
}
function windowAt(lambda){ lambda=clamp(lambda,0,1); return rounded(4*lambda*(1-lambda)); }
function roleU(role){ return role==='core'?.34:role==='detail'?.66:role==='bridge'?.52:.56; }
function roleQ(role,token){ return role==='core'?1:role==='detail'?-1:role==='bridge'?0:(hash(token)%2?1:-1); }
function baseReactionRole(role){ return role==='core'?'synth':role==='detail'?'fragment':role==='bridge'?'catalyst':'carrier'; }
function modeSignal(mode){ return mode==='generalize'?-1:mode==='detail'?1:0; }
function modeFrom(analysis){
  var items=analysis&&analysis.items||[];
  for(var i=0;i<items.length;i++){
    var entry=items[i]&&items[i].entry;
    if(!entry||entry.scale!=='OP') continue;
    if(entry.lemma==='обобщение') return 'generalize';
    if(entry.lemma==='детализация') return 'detail';
    if(entry.lemma==='продолжение'&&!(analysis.conflicts&&analysis.conflicts.length&&!analysis.hasMediation)) return 'orbit';
  }
  var portal=analysis&&analysis.portal||{}, op=text(portal.op).toLowerCase();
  if(op==='⇑'||op.indexOf('general')>=0||op.indexOf('synth')>=0) return 'generalize';
  if(op==='⇓'||op.indexOf('detail')>=0||op.indexOf('split')>=0) return 'detail';
  if(analysis&&analysis.conflicts&&analysis.conflicts.length&&!analysis.hasMediation) return 'repair';
  if(analysis&&analysis.core>.46&&analysis.edge<.22) return 'generalize';
  if(analysis&&analysis.edge>.46&&analysis.core<.22) return 'detail';
  return 'orbit';
}
function analyze(input){
  if(input&&typeof input==='object'&&Array.isArray(input.items)) return input;
  var c=core();
  return c&&typeof c.analyzeText==='function'?c.analyzeText(text(input)):{text:text(input),tokens:[],items:[],roles:[],relations:[],conflicts:[]};
}
function conflictSet(analysis){
  var out={}, conflicts=analysis&&analysis.conflicts||[];
  for(var i=0;i<conflicts.length;i++){
    if(conflicts[i].a) out[conflicts[i].a]=1;
    if(conflicts[i].b) out[conflicts[i].b]=1;
  }
  return out;
}
function firstByRole(items,role){
  for(var i=0;i<items.length;i++) if(items[i]&&items[i].role===role) return i;
  return -1;
}
function triggerIndex(items,mode){
  var index=mode==='generalize'?firstByRole(items,'core'):mode==='detail'?firstByRole(items,'detail'):firstByRole(items,'bridge');
  if(index<0&&mode==='repair') index=firstByRole(items,'neutral');
  if(index<0) index=firstByRole(items,'core');
  if(index<0) index=firstByRole(items,'detail');
  return index<0?0:index;
}
function makeParticle(item,index,trigger,conflicts,signal){
  item=item||{};
  var entry=item.entry||{}, token=item.token||item.lemma||('token-'+index), semanticKey=item.lemma||token, role=item.role||'neutral';
  var baseRole=conflicts[semanticKey]?'anti':baseReactionRole(role), reactionRole=index===trigger?'seed':baseRole;
  var h=hash(token+'|'+index);
  return {
    id:'p-'+index,index:index,token:token,semanticRole:role,reactionRole:reactionRole,baseReactionRole:baseRole,
    q:roleQ(role,token),tags:unique((entry.tags||[]).concat([role])),mass:1,
    act:rounded(.72+(h%19)/100),thr:rounded(baseRole==='catalyst'?.26:baseRole==='anti'?.38:.32),
    u:roleU(role),signal:index===trigger?signal:null,state:index===trigger?'trigger':'idle',generation:index===trigger?0:null
  };
}
function edgeKey(a,b){ return a<b?a+'|'+b:b+'|'+a; }
function adjacency(analysis,count){
  var graph=[], known={};
  for(var i=0;i<count;i++) graph.push([]);
  function add(a,b,relation){
    a=Number(a); b=Number(b);
    if(a===b||a<0||b<0||a>=count||b>=count) return;
    var key=edgeKey(a,b), current=known[key], score=clamp(relation&&relation.score,.08,1);
    if(current&&current.score>=score) return;
    if(current){
      graph[a]=graph[a].filter(function(item){return item.to!==b;});
      graph[b]=graph[b].filter(function(item){return item.to!==a;});
    }
    var base={type:relation&&relation.type||'sequence',score:score,fit:clamp(relation&&relation.fit,.08,1),reason:relation&&relation.reason||'соседство в исходной строке'};
    graph[a].push({to:b,type:base.type,score:base.score,fit:base.fit,reason:base.reason});
    graph[b].push({to:a,type:base.type,score:base.score,fit:base.fit,reason:base.reason});
    known[key]={score:score};
  }
  (analysis&&analysis.relations||[]).forEach(function(relation){ add(relation.i,relation.j,relation); });
  for(i=0;i<count-1;i++) add(i,i+1,{type:'sequence',score:.62,fit:.72,reason:'порядок слов передает ход'});
  return graph;
}
function relationPriority(type,mode){
  if(mode==='repair'&&type==='conflict') return 5;
  return type==='bridge'?4:type==='sequence'?3:type==='conflict'?2:1;
}
function sortedNeighbors(list,mode){
  return (list||[]).slice().sort(function(a,b){
    return relationPriority(b.type,mode)-relationPriority(a.type,mode)||b.score-a.score||a.to-b.to;
  });
}
function affinity(edge){ return clamp(.55*number(edge.fit,.62)+.45*number(edge.score,.62),.08,1); }
function selectionInput(mode,source,target,edge,guarded){
  return Rulebook.normalizeSelection({
    mode:mode,relationType:edge&&edge.type,guarded:!!guarded,
    sourceBaseRole:source&&source.baseReactionRole,sourceReactionRole:source&&source.reactionRole,sourceSemanticRole:source&&source.semanticRole,
    targetBaseRole:target&&target.baseReactionRole,targetReactionRole:target&&target.reactionRole,targetSemanticRole:target&&target.semanticRole
  });
}
function ruleFor(mode,source,target,edge){
  var input=selectionInput(mode,source,target,edge,false);
  return {rule:Rulebook.select(input),input:input};
}
function proposedDelta(direction,before,strength){
  if(direction==='generalize') return -.105*(.45+.55*strength);
  if(direction==='detail') return .105*(.45+.55*strength);
  if(direction==='repair') return (.5-before)*(.55+.25*strength);
  return (.5-before)*(.22+.22*strength);
}
function eventContract(rule,after,massBefore,massAfter,changed){
  return {
    pre:{ok:true,text:rule.contract.pre},
    inv:{ok:after>MIN_U&&after<MAX_U&&Math.abs(massBefore-massAfter)<1e-9,text:rule.contract.inv},
    post:{ok:!!changed,text:rule.contract.post},
    proof:rule.contract.proof,
    evidence:STRUCTURAL,
    soundness:NOT_COMPUTED
  };
}
function emptyResult(analysis,lambda){
  lambda=clamp(number(lambda,.5),0,1);
  return {
    version:VERSION,kind:'MRDSemanticReactionField',status:'empty',mode:'orbit',lambda:lambda,window:windowAt(lambda),gamma:0,ruleVersion:Rulebook.version,ruleHash:Rulebook.hash,
    trigger:null,particles:[],events:[],attempts:[],rules:RULES.slice(),
    metrics:{particles:0,types:0,fired:0,blocked:0,repaired:0,depth:0,budget:0,massBefore:0,massAfter:0,minU:0,maxU:0,criticality:0,directionCounts:{generalize:0,detail:0,orbit:0,repair:0}},
    invariants:[{id:'open_ring',ok:true},{id:'mass',ok:true},{id:'bounded_depth',ok:true}],
    contract:{pre:false,inv:true,post:false,evidence:UNVERIFIED,soundness:NOT_COMPUTED},
    text:{summary:'Нет частиц для реакции.',output:'Введите текстовое условие: система покажет, какая частица запускает следующий ход.',mantra:'условие · частица · связь · дальше'},
    formula:'rule = P(mode, source.type, target.type, relation); F = M(lambda) * affinity * act / (1 + distance^2); fire iff F >= thr'
  };
}
function simulate(input,lambda,options){
  var analysis=analyze(input); lambda=clamp(number(lambda,.5),0,1); options=options||{};
  var items=analysis.items||[], count=items.length;
  if(!count) return emptyResult(analysis,lambda);
  var maxDepth=Math.max(1,Math.min(3,Math.floor(number(options.maxDepth,3))));
  var budget=Math.max(1,Math.min(12,Math.floor(number(options.budget,8))));
  var mode=modeFrom(analysis), signal=modeSignal(mode), trigger=triggerIndex(items,mode), conflicts=conflictSet(analysis);
  var particles=[], massBefore=0;
  for(var i=0;i<count;i++){ particles.push(makeParticle(items[i],i,trigger,conflicts,signal)); massBefore+=1; }
  var graph=adjacency(analysis,count), active=[trigger], visited={}; visited[trigger]=1;
  var events=[], attempts=[], repaired=0, processed=0, seq=0, depth=0, win=windowAt(lambda);
  for(var generation=1;generation<=maxDepth&&active.length&&events.length<budget;generation++){
    var next=[];
    for(var ai=0;ai<active.length&&events.length<budget;ai++){
      var source=particles[active[ai]], neighbors=sortedNeighbors(graph[source.index],mode), edge=null;
      for(var ni=0;ni<neighbors.length;ni++) if(!visited[neighbors[ni].to]){edge=neighbors[ni];break;}
      if(!edge) continue;
      processed++;
      var target=particles[edge.to], dist=Math.abs(source.index-target.index)/Math.max(1,count-1), fit=affinity(edge);
      var catalytic=source.reactionRole==='mediated'?1.12:(source.reactionRole==='seed'||source.baseReactionRole==='catalyst')?1.08:source.baseReactionRole==='anti'?.62:1;
      var force=rounded(win*(.60+.40*fit)*source.act*catalytic/(1+dist*dist));
      var fired=force>=target.thr;
      attempts.push({generation:generation,sourceId:source.id,targetId:target.id,sourceToken:source.token,targetToken:target.token,force:force,threshold:target.thr,fired:fired,relation:edge.type});
      if(!fired) continue;
      var choice=ruleFor(mode,source,target,edge), rule=choice.rule, selection=choice.input, before=target.u, strength=clamp((force-target.thr)/Math.max(.01,1-target.thr),0,1);
      var candidate=before+proposedDelta(rule.direction,before,strength), guarded=candidate<=MIN_U||candidate>=MAX_U;
      if(guarded){ selection=selectionInput(mode,source,target,edge,true); rule=Rulebook.select(selection); candidate=candidate<=MIN_U?.22:.78; repaired++; }
      var after=rounded(clamp(candidate,.181,.819)), sourceActBefore=source.act, targetActBefore=target.act;
      source.act=rounded(clamp(source.act-number(rule.cost,.16),0,1));
      target.act=rounded(Math.max(target.act,sourceActBefore*.74));
      target.thr=rounded(Math.max(.20,target.thr*((source.baseReactionRole==='catalyst'||source.reactionRole==='seed')?.78:.92)));
      target.u=after; target.signal=signal; target.state=rule.id==='R_MEDIATE'?'mediated':'activated';
      target.reactionRole=rule.id==='R_MEDIATE'?'mediated':target.reactionRole;
      target.generation=generation; visited[target.index]=1; next.push(target.index); depth=Math.max(depth,generation); seq++;
      var massAfterStep=particles.reduce(function(sum,particle){return sum+particle.mass;},0);
      events.push({
        seq:seq,generation:generation,ruleId:rule.id,ruleLabel:rule.label,ruleVersion:Rulebook.version,ruleHash:Rulebook.hash,priority:rule.priority,cost:rule.cost,direction:rule.direction,selectionReason:rule.selectionReason,selectionInput:selection,
        sourceId:source.id,targetId:target.id,sourceIndex:source.index,targetIndex:target.index,sourceToken:source.token,targetToken:target.token,
        relation:edge.type,reason:edge.reason,affinity:rounded(fit),force:force,threshold:attempts[attempts.length-1].threshold,
        beforeU:before,afterU:after,deltaU:rounded(after-before),sourceActBefore:sourceActBefore,sourceActAfter:source.act,
        targetActBefore:targetActBefore,targetActAfter:target.act,enabledNext:generation<maxDepth,
        inputPort:rule.inputPort,outputPort:rule.outputPort,portPath:Rulebook.typedPath(rule.id),
        contract:eventContract(rule,after,massBefore,massAfterStep,true),evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
      });
    }
    active=next;
  }
  var massAfter=particles.reduce(function(sum,particle){return sum+particle.mass;},0);
  var minU=particles.reduce(function(value,particle){return Math.min(value,particle.u);},1);
  var maxU=particles.reduce(function(value,particle){return Math.max(value,particle.u);},0);
  var gamma=processed?rounded(events.length/processed):0, criticality=events.length?rounded(clamp((1-Math.abs(1-gamma))*win,0,1)):0;
  var status=!events.length?'damped':repaired?'guarded':depth>=2&&gamma>=.75&&gamma<=1.25?'critical':'active';
  var types={},directionCounts={generalize:0,detail:0,orbit:0,repair:0};
  particles.forEach(function(particle){types[particle.reactionRole]=(types[particle.reactionRole]||0)+1;});
  events.forEach(function(event){directionCounts[event.direction]=(directionCounts[event.direction]||0)+1;});
  var last=events.length?events[events.length-1]:null, triggerParticle=particles[trigger];
  var summary=status==='damped'?'Реакция затухла у порога: M(λ) недостаточно для передачи сигнала.':
    status==='guarded'?'Каскад дошел до границы, но 2D-предохранитель вернул его в открытое кольцо.':
    status==='critical'?'Каскад идет поколение за поколением без разгона и без полного затухания.':'Локальная реакция активна и остается ограниченной.';
  var output=!events.length?'«'+triggerParticle.token+'» не передает сигнал: сила ниже порога; система сохраняет исходные частицы без формального хода.':
    mode==='generalize'?'«'+triggerParticle.token+'» собирает связные части к общему тезису, сохраняя их различимыми.':
    mode==='detail'?'«'+triggerParticle.token+'» раскрывает одну новую деталь и передает ход дальше, не разрывая тему.':
    mode==='repair'?'«'+triggerParticle.token+'» вводит посредничество между конфликтующими частями и возвращает движение.':
    '«'+triggerParticle.token+'» передает следующий ход к «'+(last?last.targetToken:triggerParticle.token)+'» через локальную связь.';
  return {
    version:VERSION,kind:'MRDSemanticReactionField',status:status,mode:mode,lambda:lambda,window:win,gamma:gamma,ruleVersion:Rulebook.version,ruleHash:Rulebook.hash,
    trigger:{id:triggerParticle.id,index:triggerParticle.index,token:triggerParticle.token,reactionRole:triggerParticle.reactionRole,semanticRole:triggerParticle.semanticRole,signal:signal},
    particles:particles,events:events,attempts:attempts,rules:RULES.slice(),
    metrics:{particles:particles.length,types:Object.keys(types).length,typeCounts:types,directionCounts:directionCounts,fired:events.length,blocked:attempts.length-events.length,repaired:repaired,depth:depth,budget:budget,massBefore:massBefore,massAfter:massAfter,minU:rounded(minU),maxU:rounded(maxU),criticality:criticality},
    invariants:[
      {id:'open_ring',ok:minU>MIN_U&&maxU<MAX_U,actual:{min:minU,max:maxU},expected:'0.18 < u < 0.82'},
      {id:'mass',ok:Math.abs(massBefore-massAfter)<1e-9,actual:massAfter,expected:massBefore},
      {id:'bounded_depth',ok:depth<=maxDepth&&events.length<=budget,actual:{depth:depth,events:events.length},expected:{depth:maxDepth,budget:budget}}
    ],
    contract:{pre:particles.length>0,inv:minU>MIN_U&&maxU<MAX_U&&Math.abs(massBefore-massAfter)<1e-9&&depth<=maxDepth,post:events.length>0||status==='damped',evidence:STRUCTURAL,soundness:NOT_COMPUTED},
    text:{summary:summary,output:output,mantra:'одна частица · одна связь · один ход · guard'},
    formula:'rule = P(mode, source.type, target.type, relation); deltaU = D(rule.direction, u, strength); F = M(lambda) * affinity * act / (1 + distance^2); fire iff F >= thr; depth <= 3',
    evidence:STRUCTURAL,evidenceLevel:STRUCTURAL,soundness:NOT_COMPUTED
  };
}

global.MRDSemanticReactionField={version:VERSION,ruleVersion:Rulebook.version,ruleHash:Rulebook.hash,rules:RULES,simulate:simulate,windowAt:windowAt,limits:{minU:MIN_U,maxU:MAX_U}};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
