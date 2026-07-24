(function(global){
'use strict';

var VERSION='1.0.0';

function clamp(value){ return value<0?0:value>1?1:value; }
function create(options){
  var Registry=options.registry,Engine=options.engine,View=options.view,Semantic=options.semantic;
  var root=options.root,xInput=options.xInput,yInput=options.yInput,xOutput=options.xOutput,yOutput=options.yOutput;
  var cachedSource=null,cachedMetrics=null,lastPack=null;
  if(!Registry||!Engine||!View||!root) throw new Error('P78_FORMULA_ADAPTER_DEPENDENCY_UNAVAILABLE');

  function record(id){ return Registry.getFormula(Registry.registry,id); }
  function typedInputs(formula,values){
    var result={};
    formula.inputs.forEach(function(port){ result[port.name]=Engine.makeTypedValue(port,values[port.name]); });
    return result;
  }
  function metrics(source,recompute){
    if(!recompute&&cachedMetrics&&cachedSource===source) return cachedMetrics;
    var pack=Semantic&&typeof Semantic.semanticPhi==='function'?Semantic.semanticPhi(source):null, value=pack&&pack.metrics?pack.metrics:{};
    cachedSource=source;
    cachedMetrics={
      growth:clamp(Number.isFinite(value.growth)?value.growth:.5),
      novelty:clamp(Number.isFinite(value.novelty)?value.novelty:.5),
      openness:clamp(Number.isFinite(value.openness)?value.openness:.5),
      previousVitality:clamp(Number.isFinite(value.phi)?value.phi:.5)
    };
    return cachedMetrics;
  }
  function entry(id,value){
    var formula=record(id);
    return {
      formulaId:id,version:formula.version,title:formula.title,status:'READY',
      inputValues:{},outputValue:value,outputKey:formula.output.name,contentHash:formula.contentHash
    };
  }
  function next(summary){
    var id,reason;
    if(summary.margin<=0){ id='pressure.margin'; reason='орбита не превосходит сильнейшую крайность'; }
    else if(summary.balance<.55){ id='ring.balance'; reason='радиальный баланс ослаблен'; }
    else if(summary.vitality<.55){ id='vitality.snapshot-geomean'; reason='структурная жизненность требует проверки'; }
    else{ id='vitality.trajectory'; reason='условия следующего снимка сохранены'; }
    return {formulaId:id,title:record(id).title,reason:reason};
  }
  function failure(result,input,trace){
    return {
      status:result&&result.status||'INVALID',code:result&&result.code||'FORMULA_ADAPTER_INVALID',
      registryHash:Registry.registryHash,input:input,current:trace.length?trace[trace.length-1]:null,next:null,trace:trace,
      summary:{completed:trace.length,total:Registry.records.length,partition:null,balance:null,margin:null,direction:null,vitality:null},
      evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED',semanticTruth:false
    };
  }
  function render(source,u,recompute){
    var x=+xInput.value/100,y=+yInput.value/100,semantic=metrics(String(source||''),!!recompute),input={
      x:x,y:y,u:clamp(Number(u)),growth:semantic.growth,novelty:semantic.novelty,openness:semantic.openness,previousVitality:semantic.previousVitality
    };
    xOutput.textContent=x.toFixed(2); yOutput.textContent=y.toFixed(2);
    var pressure=Engine.runRingMatryoshka({x:x,y:y}),trace=[],pressureValues={};
    if(pressure.status==='READY'){
      pressureValues={
        'pressure.closure':pressure.summary.closure,'pressure.edge':pressure.summary.edge,
        'pressure.orbit-forward':pressure.summary.orbitForward,'pressure.orbit-reverse':pressure.summary.orbitReverse,
        'pressure.partition':pressure.summary.partition,'pressure.orbit-total':pressure.summary.orbitTotal,
        'pressure.direction':pressure.summary.direction,'pressure.margin':pressure.summary.margin
      };
      pressure.trace.formulaOrder.forEach(function(id){ trace.push(entry(id,pressureValues[id])); });
    }
    if(pressure.status!=='READY'){
      lastPack=failure(pressure,input,trace); View.render(root,lastPack); return lastPack;
    }
    var balanceFormula=record('ring.balance'),balance=Engine.evaluateFormula('ring.balance',typedInputs(balanceFormula,{u:input.u}));
    if(balance.status!=='READY'){
      lastPack=failure(balance,input,trace); View.render(root,lastPack); return lastPack;
    }
    trace.push(entry('ring.balance',balance.output.value));
    var vitalityValues={growth:input.growth,novelty:input.novelty,openness:input.openness,balance:balance.output.value};
    var snapshotFormula=record('vitality.snapshot-geomean'),snapshot=Engine.evaluateFormula(snapshotFormula.formulaId,typedInputs(snapshotFormula,vitalityValues));
    if(snapshot.status!=='READY'){
      lastPack=failure(snapshot,input,trace); View.render(root,lastPack); return lastPack;
    }
    trace.push(entry('vitality.snapshot-geomean',snapshot.output.value));
    vitalityValues.previousVitality=input.previousVitality;
    var trajectoryFormula=record('vitality.trajectory'),trajectory=Engine.evaluateFormula(trajectoryFormula.formulaId,typedInputs(trajectoryFormula,vitalityValues));
    if(trajectory.status!=='READY'){
      lastPack=failure(trajectory,input,trace); View.render(root,lastPack); return lastPack;
    }
    trace.push(entry('vitality.trajectory',trajectory.output.value));
    var summary={
      completed:trace.length,total:Registry.records.length,partition:pressure.summary.partition,
      balance:balance.output.value,margin:pressure.summary.margin,direction:pressure.summary.direction,vitality:trajectory.output.value
    };
    lastPack={
      status:'READY',code:null,registryHash:Registry.registryHash,input:input,current:trace[trace.length-1],next:next(summary),trace:trace,summary:summary,
      evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED',semanticTruth:false
    };
    View.render(root,lastPack);
    return lastPack;
  }
  return Object.freeze({version:VERSION,render:render,current:function(){return lastPack;}});
}

global.MRDP78FormulaAdapter=Object.freeze({version:VERSION,create:create});
})(typeof globalThis!=='undefined'?globalThis:this);
