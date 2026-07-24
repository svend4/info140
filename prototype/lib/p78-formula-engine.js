(function(global){
'use strict';

var VERSION='1.0.0';
var RESULT_SCHEMA='meridian.formula-result/1';
var TRACE_SCHEMA='meridian.formula-trace/1';
var STATE_SCHEMA='meridian.formula-state/1';
var TYPED_VALUE_SCHEMA='meridian.typed-value/1';
var Canonical=global.MRDP78CanonicalJSON||global.MRDP78CanonicalJson;
var Registry=global.MRDP78FormulaRegistry;

if(!Canonical||!Registry||Registry.status!=='READY'){
  global.MRDP78FormulaEngine=Object.freeze({version:VERSION,status:'BLOCKED',code:'FORMULA_REGISTRY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var DIMENSION_KEYS=Registry.dimensionKeys;
var ERROR_CODES=freeze({
  FORMULA_UNKNOWN:'FORMULA_UNKNOWN',
  FORMULA_VERSION_MISSING:'FORMULA_VERSION_MISSING',
  FORMULA_HASH_MISMATCH:'FORMULA_HASH_MISMATCH',
  REGISTRY_INVALID:'REGISTRY_INVALID',
  AST_INVALID:'AST_INVALID',
  INPUT_MISSING:'INPUT_MISSING',
  INPUT_UNKNOWN:'INPUT_UNKNOWN',
  INPUT_UNEXPECTED:'INPUT_UNEXPECTED',
  TYPE_MISMATCH:'TYPE_MISMATCH',
  DIMENSION_MISMATCH:'DIMENSION_MISMATCH',
  MEASURE_KIND_MISMATCH:'MEASURE_KIND_MISMATCH',
  UNIT_CONVERSION_MISSING:'UNIT_CONVERSION_MISSING',
  DOMAIN_VIOLATION:'DOMAIN_VIOLATION',
  PRECONDITION_UNKNOWN:'PRECONDITION_UNKNOWN',
  POSTCONDITION_FAILED:'POSTCONDITION_FAILED',
  DEPENDENCY_CYCLE:'DEPENDENCY_CYCLE',
  DEPENDENCY_NOT_PROVED:'DEPENDENCY_NOT_PROVED',
  NUMERIC_UNSTABLE:'NUMERIC_UNSTABLE',
  BUDGET_EXCEEDED:'BUDGET_EXCEEDED',
  ABSTAIN:'ABSTAIN'
});

function statusForCode(code){
  if(code===ERROR_CODES.INPUT_MISSING) return 'PARTIAL';
  if(code===ERROR_CODES.INPUT_UNKNOWN||code===ERROR_CODES.PRECONDITION_UNKNOWN||code===ERROR_CODES.ABSTAIN) return 'ABSTAIN';
  if(code===ERROR_CODES.BUDGET_EXCEEDED||code===ERROR_CODES.DEPENDENCY_CYCLE||code===ERROR_CODES.DEPENDENCY_NOT_PROVED) return 'BLOCKED';
  return 'INVALID';
}

function engineError(code,status,message,path,details){
  var error=new Error(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78FormulaEngineError';
  error.code=code;
  error.status=status||statusForCode(code);
  error.path=path||'$';
  error.details=details||{};
  return error;
}

function raise(code,message,path,details,status){ throw engineError(code,status||statusForCode(code),message,path,details); }
function isObject(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function merge(target,source){ Object.keys(source).forEach(function(key){ target[key]=source[key]; }); return target; }
function omitOwn(value,key){
  var result={},keys=Object.keys(value),i,name;
  for(i=0;i<keys.length;i++){
    name=keys[i];
    if(name!==key) result[name]=value[name];
  }
  return result;
}
function typeShape(spec){
  return {valueType:spec.valueType,unit:spec.unit,dimension:spec.dimension,measureKind:spec.measureKind,interval:spec.interval};
}
function evidenceFields(){ return {evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED',semanticTruth:false}; }

function inInterval(value,interval){
  if(interval===null) return true;
  if(value<interval.min||value>interval.max) return false;
  if(value===interval.min&&!interval.closedMin) return false;
  if(value===interval.max&&!interval.closedMax) return false;
  return true;
}

function valueMatchesType(value,valueType){
  var i;
  if(valueType==='Real') return typeof value==='number'&&Number.isFinite(value);
  if(valueType==='Int') return typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value);
  if(valueType==='Bool') return typeof value==='boolean';
  if(valueType==='Tuple'){
    if(!Array.isArray(value)) return false;
    for(i=0;i<value.length;i++) if(typeof value[i]==='number'&&!Number.isFinite(value[i])) return false;
    return true;
  }
  return false;
}

function makeTypedValue(spec,value){
  var type=typeShape(spec),payload;
  if(!valueMatchesType(value,type.valueType)) throw engineError(ERROR_CODES.TYPE_MISMATCH,'INVALID','value does not match '+type.valueType,'$.value');
  if((type.valueType==='Real'||type.valueType==='Int')&&!inInterval(value,type.interval)){
    throw engineError(ERROR_CODES.DOMAIN_VIOLATION,'INVALID','value is outside the declared interval','$.value',{expected:type.interval,actual:value});
  }
  payload={schema:TYPED_VALUE_SCHEMA,known:true,value:value,valueType:type.valueType,unit:type.unit,dimension:type.dimension,measureKind:type.measureKind,interval:type.interval};
  payload.valueHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function unknownValue(spec){
  var type=typeShape(spec),payload={schema:TYPED_VALUE_SCHEMA,known:false,value:null,valueType:type.valueType,unit:type.unit,dimension:type.dimension,measureKind:type.measureKind,interval:type.interval};
  payload.valueHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function sameDimension(left,right){
  var i,key;
  for(i=0;i<DIMENSION_KEYS.length;i++){
    key=DIMENSION_KEYS[i];
    if(!left||!right||left[key]!==right[key]) return false;
  }
  return true;
}

function intervalSubset(actual,expected){
  if(expected===null) return true;
  if(actual===null) return false;
  if(actual.min<expected.min||actual.max>expected.max) return false;
  if(actual.min===expected.min&&actual.closedMin&&!expected.closedMin) return false;
  if(actual.max===expected.max&&actual.closedMax&&!expected.closedMax) return false;
  return true;
}

function validateTypedValue(value,port,path){
  var expectedHash;
  if(!isObject(value)||value.schema!==TYPED_VALUE_SCHEMA||typeof value.known!=='boolean'||!Canonical.isSha256(value.valueHash)){
    raise(ERROR_CODES.TYPE_MISMATCH,'typed value envelope required',path);
  }
  try{ expectedHash=Canonical.hashCanonical(omitOwn(value,'valueHash')); }
  catch(error){ raise(ERROR_CODES.TYPE_MISMATCH,'typed value is not canonical data',path); }
  if(expectedHash!==value.valueHash) raise(ERROR_CODES.FORMULA_HASH_MISMATCH,'typed value hash mismatch',path+'.valueHash');
  if(value.valueType!==port.valueType) raise(ERROR_CODES.TYPE_MISMATCH,'valueType mismatch',path+'.valueType',{expected:port.valueType,actual:value.valueType});
  if(!sameDimension(value.dimension,port.dimension)) raise(ERROR_CODES.DIMENSION_MISMATCH,'dimension mismatch',path+'.dimension',{expected:port.dimension,actual:value.dimension});
  if(value.unit!==port.unit) raise(ERROR_CODES.UNIT_CONVERSION_MISSING,'unit conversion is not registered',path+'.unit',{expected:port.unit,actual:value.unit});
  if(value.measureKind!==port.measureKind) raise(ERROR_CODES.MEASURE_KIND_MISMATCH,'measureKind mismatch',path+'.measureKind',{expected:port.measureKind,actual:value.measureKind});
  if(!intervalSubset(value.interval,port.interval)) raise(ERROR_CODES.DOMAIN_VIOLATION,'typed interval is wider than the port interval',path+'.interval',{expected:port.interval,actual:value.interval});
  if(!value.known){
    if(value.value!==null) raise(ERROR_CODES.TYPE_MISMATCH,'unknown value must carry null',path+'.value');
    raise(ERROR_CODES.INPUT_UNKNOWN,'UNKNOWN abstains',path,{port:port.name});
  }
  if(!valueMatchesType(value.value,value.valueType)) raise(ERROR_CODES.TYPE_MISMATCH,'payload does not match valueType',path+'.value');
  if((value.valueType==='Real'||value.valueType==='Int')&&!inInterval(value.value,port.interval)){
    raise(ERROR_CODES.DOMAIN_VIOLATION,'value is outside the port interval',path+'.value',{expected:port.interval,actual:value.value});
  }
  return freeze(Canonical.deepCopy(value));
}

function normalizeInputs(record,source){
  var result={},allowed={},keys,i,port;
  if(!isObject(source)) raise(ERROR_CODES.INPUT_MISSING,'input object required','$.inputs');
  for(i=0;i<record.inputs.length;i++) allowed[record.inputs[i].name]=true;
  keys=Object.keys(source).sort();
  for(i=0;i<keys.length;i++) if(!allowed[keys[i]]) raise(ERROR_CODES.INPUT_UNEXPECTED,'unexpected input '+keys[i],'$.inputs.'+keys[i]);
  for(i=0;i<record.inputs.length;i++){
    port=record.inputs[i];
    if(!Object.prototype.hasOwnProperty.call(source,port.name)){
      if(port.required) raise(ERROR_CODES.INPUT_MISSING,'required input is missing','$.inputs.'+port.name,{port:port.name});
    }else{
      result[port.name]=validateTypedValue(source[port.name],port,'$.inputs.'+port.name);
    }
  }
  return freeze(result);
}

function verifyRegistry(source){
  var checked=Registry.verifyRegistry(source||Registry.registry);
  if(checked.status!=='READY'){
    raise(checked.code===Registry.errorCodes.DEPENDENCY_CYCLE?ERROR_CODES.DEPENDENCY_CYCLE:ERROR_CODES.REGISTRY_INVALID,'registry verification failed','$.registry',{errors:checked.errors});
  }
  return checked.registry;
}

function refFor(record){ return Registry.formulaRef(record); }
function formulaKey(record){ return record.formulaId+'@'+record.version; }
function dependencyRecords(record,registry){
  return record.dependencies.filter(function(dependency){ return dependency.kind==='USES'||dependency.kind==='GUARDS'; }).map(function(dependency){
    return Registry.getFormula(registry,dependency.formula.formulaId,dependency.formula.version);
  });
}

function createContext(registry,options){
  var maxOperations=options&&options.maxOperations!==undefined?options.maxOperations:10000;
  var maxDepth=options&&options.maxDepth!==undefined?options.maxDepth:64;
  if(!Number.isInteger(maxOperations)||maxOperations<1) raise(ERROR_CODES.BUDGET_EXCEEDED,'maxOperations must be a positive integer','$.options.maxOperations');
  if(!Number.isInteger(maxDepth)||maxDepth<1) raise(ERROR_CODES.BUDGET_EXCEEDED,'maxDepth must be a positive integer','$.options.maxDepth');
  return {registry:registry,maxOperations:maxOperations,maxDepth:maxDepth,operations:0,memo:{},stack:[],frames:[],traceNodes:[],latestByFormula:{}};
}

function consume(context,path,depth){
  if(depth>context.maxDepth) raise(ERROR_CODES.BUDGET_EXCEEDED,'maximum AST depth exceeded',path);
  context.operations++;
  if(context.operations>context.maxOperations) raise(ERROR_CODES.BUDGET_EXCEEDED,'maximum operation budget exceeded',path,{maxOperations:context.maxOperations});
}

function descriptor(typed){ return {value:typed.value,typed:typed}; }
function rawDescriptor(value){ return {value:value,typed:null}; }

function numericArgs(args,path){
  var values=[],i;
  for(i=0;i<args.length;i++){
    if(typeof args[i].value!=='number'||!Number.isFinite(args[i].value)) raise(ERROR_CODES.TYPE_MISMATCH,'numeric operation requires finite numbers',path+'.args['+i+']');
    values.push(args[i].value);
  }
  return values;
}

function booleanArgs(args,path){
  var values=[],i;
  for(i=0;i<args.length;i++){
    if(typeof args[i].value!=='boolean') raise(ERROR_CODES.TYPE_MISMATCH,'boolean operation requires booleans',path+'.args['+i+']');
    values.push(args[i].value);
  }
  return values;
}

function applyOperation(operation,args,path){
  var values,result,i;
  if(operation==='and'||operation==='or'||operation==='not'){
    values=booleanArgs(args,path);
    if(operation==='not') return rawDescriptor(!values[0]);
    result=operation==='and';
    for(i=0;i<values.length;i++) result=operation==='and'?(result&&values[i]):(result||values[i]);
    return rawDescriptor(result);
  }
  values=numericArgs(args,path);
  if(operation==='add'){
    result=0; for(i=0;i<values.length;i++) result+=values[i];
  }else if(operation==='sub'){
    result=values[0]-values[1];
  }else if(operation==='mul'){
    result=1; for(i=0;i<values.length;i++) result*=values[i];
  }else if(operation==='div'){
    if(values[1]===0) raise(ERROR_CODES.DOMAIN_VIOLATION,'division by zero',path);
    result=values[0]/values[1];
  }else if(operation==='pow'){
    result=Math.pow(values[0],values[1]);
  }else if(operation==='sqrt'){
    if(values[0]<0) raise(ERROR_CODES.DOMAIN_VIOLATION,'square root requires a non-negative argument',path);
    result=Math.sqrt(values[0]);
  }else if(operation==='max'){
    result=Math.max.apply(Math,values);
  }else if(operation==='min'){
    result=Math.min.apply(Math,values);
  }else if(operation==='abs'){
    result=Math.abs(values[0]);
  }else if(operation==='neg'){
    result=-values[0];
  }else if(operation==='complement'){
    result=1-values[0];
  }else if(operation==='lt'){
    return rawDescriptor(values[0]<values[1]);
  }else if(operation==='lte'){
    return rawDescriptor(values[0]<=values[1]);
  }else if(operation==='gt'){
    return rawDescriptor(values[0]>values[1]);
  }else if(operation==='gte'){
    return rawDescriptor(values[0]>=values[1]);
  }else if(operation==='eq'){
    return rawDescriptor(values[0]===values[1]);
  }else{
    raise(ERROR_CODES.AST_INVALID,'unknown operation '+operation,path+'.operation');
  }
  if(typeof result!=='number'||!Number.isFinite(result)) raise(ERROR_CODES.NUMERIC_UNSTABLE,'operation produced a non-finite number',path);
  return rawDescriptor(result);
}

function pinnedDependency(parent,formulaId,version){
  var i,dependency;
  for(i=0;i<parent.dependencies.length;i++){
    dependency=parent.dependencies[i];
    if(dependency.formula.formulaId===Registry.normalizeFormulaId(formulaId)&&dependency.formula.version===version) return dependency;
  }
  return null;
}

function evaluateAst(ast,record,inputs,locals,context,path,depth){
  var i,args,value,test,target,dependency,bound={},keys,result,targetPort;
  consume(context,path,depth);
  if(!isObject(ast)||typeof ast.node!=='string') raise(ERROR_CODES.AST_INVALID,'AST node tag required',path);
  if(ast.node==='Literal') return descriptor(makeTypedValue(ast.type,ast.value));
  if(ast.node==='Input'){
    if(Object.prototype.hasOwnProperty.call(locals,ast.port)) return locals[ast.port];
    if(!Object.prototype.hasOwnProperty.call(inputs,ast.port)) raise(ERROR_CODES.INPUT_MISSING,'AST input unavailable',path+'.port',{port:ast.port});
    return descriptor(inputs[ast.port]);
  }
  if(ast.node==='Let'){
    value=evaluateAst(ast.value,record,inputs,locals,context,path+'.value',depth+1);
    locals=Object.assign({},locals); locals[ast.name]=value;
    return evaluateAst(ast.body,record,inputs,locals,context,path+'.body',depth+1);
  }
  if(ast.node==='Call'){
    if(!Registry.operations[ast.operation]) raise(ERROR_CODES.AST_INVALID,'unknown operation '+ast.operation,path+'.operation');
    args=[];
    for(i=0;i<ast.args.length;i++) args.push(evaluateAst(ast.args[i],record,inputs,locals,context,path+'.args['+i+']',depth+1));
    return applyOperation(ast.operation,args,path);
  }
  if(ast.node==='Tuple'){
    args=[];
    for(i=0;i<ast.items.length;i++) args.push(evaluateAst(ast.items[i],record,inputs,locals,context,path+'.items['+i+']',depth+1).value);
    return rawDescriptor(args);
  }
  if(ast.node==='If'){
    test=evaluateAst(ast.test,record,inputs,locals,context,path+'.test',depth+1);
    if(typeof test.value!=='boolean') raise(ERROR_CODES.TYPE_MISMATCH,'If test must be Bool',path+'.test');
    return evaluateAst(test.value?ast.then:ast.else,record,inputs,locals,context,path+(test.value?'.then':'.else'),depth+1);
  }
  if(ast.node==='FormulaRef'){
    dependency=pinnedDependency(record,ast.formulaId,ast.version);
    if(!dependency) raise(ERROR_CODES.DEPENDENCY_NOT_PROVED,'FormulaRef is not pinned',path);
    target=Registry.getFormula(context.registry,ast.formulaId,ast.version);
    if(!target||target.contentHash!==dependency.formula.contentHash) raise(ERROR_CODES.FORMULA_HASH_MISMATCH,'FormulaRef hash mismatch',path);
    keys=Object.keys(ast.bindings).sort();
    for(i=0;i<keys.length;i++){
      value=evaluateAst(ast.bindings[keys[i]],record,inputs,locals,context,path+'.bindings.'+keys[i],depth+1);
      targetPort=null;
      target.inputs.forEach(function(port){ if(port.name===keys[i]) targetPort=port; });
      if(!targetPort) raise(ERROR_CODES.AST_INVALID,'FormulaRef binding is unknown',path+'.bindings.'+keys[i]);
      bound[keys[i]]=value.typed||makeTypedValue(targetPort,value.value);
    }
    result=evaluateRecord(target,bound,context);
    if(context.frames.length) context.frames[context.frames.length-1].children.push(result.nodeId);
    return descriptor(result.output);
  }
  raise(ERROR_CODES.AST_INVALID,'unknown AST node '+ast.node,path+'.node');
}

function inputHashes(inputs){
  var hashes={},keys=Object.keys(inputs).sort(),i;
  for(i=0;i<keys.length;i++) hashes[keys[i]]=inputs[keys[i]].valueHash;
  return hashes;
}

function plainError(error,record){
  return {
    code:error.code||ERROR_CODES.AST_INVALID,
    formulaRef:record?formulaKey(record):null,
    port:error.details&&error.details.port||null,
    expected:error.details&&Object.prototype.hasOwnProperty.call(error.details,'expected')?error.details.expected:null,
    actual:error.details&&Object.prototype.hasOwnProperty.call(error.details,'actual')?error.details.actual:null,
    dependencyPath:error.details&&error.details.dependencyPath||[],
    path:error.path||'$',
    message:error.message||String(error)
  };
}

function traceNodeId(record,hashes){ return formulaKey(record)+'#'+Canonical.hashCanonical(hashes).slice(7,23); }
function uniqueSorted(values){
  var seen={},result=[];
  values.slice().sort().forEach(function(value){ if(!seen[value]){ seen[value]=true; result.push(value); } });
  return result;
}

function addTraceNode(context,record,hashes,nodeId,status,output,children,errors){
  var node=freeze({
    nodeId:nodeId,
    formula:refFor(record),
    inputHashes:hashes,
    outputHash:output?output.valueHash:null,
    status:status,
    evidence:'STRUCTURAL',
    evidenceLevel:'STRUCTURAL',
    soundness:'NOT_COMPUTED',
    semanticTruth:false,
    parentNodeIds:uniqueSorted(children),
    errors:errors||[]
  });
  context.traceNodes.push(node);
  return node;
}

function evaluateRecord(record,sourceInputs,context){
  var inputs=normalizeInputs(record,sourceInputs),hashes=inputHashes(inputs),memoKey=formulaKey(record)+':'+Canonical.hashCanonical(hashes);
  var nodeId=traceNodeId(record,hashes),frame,started,value,output,result,alreadyTraced;
  if(context.memo[memoKey]) return context.memo[memoKey];
  if(context.stack.indexOf(formulaKey(record))!==-1) raise(ERROR_CODES.DEPENDENCY_CYCLE,'dependency cycle during execution',record.formulaId,{dependencyPath:context.stack.concat([formulaKey(record)])});
  context.stack.push(formulaKey(record));
  frame={children:[]}; context.frames.push(frame); started=context.operations;
  try{
    value=evaluateAst(record.expression,record,inputs,{},context,record.formulaId+'.expression',0);
    output=makeTypedValue(record.output,value.value);
    if(context.operations-started>record.implementation.maxOperations) raise(ERROR_CODES.BUDGET_EXCEEDED,'formula exceeded declared maxOperations',record.formulaId,{maxOperations:record.implementation.maxOperations});
    context.frames.pop(); context.stack.pop();
    addTraceNode(context,record,hashes,nodeId,'READY',output,frame.children,[]);
    result=freeze({record:record,inputs:inputs,output:output,nodeId:nodeId,memoKey:memoKey});
    context.memo[memoKey]=result;
    context.latestByFormula[record.formulaId]=result;
    return result;
  }catch(error){
    context.frames.pop(); context.stack.pop();
    alreadyTraced=context.traceNodes.some(function(node){ return node.nodeId===nodeId; });
    if(!alreadyTraced) addTraceNode(context,record,hashes,nodeId,error.status||statusForCode(error.code),null,frame.children,[plainError(error,record)]);
    throw error;
  }
}

function makeTrace(context,rootRecord,resultHash){
  var payload={
    schema:TRACE_SCHEMA,
    version:VERSION,
    registryHash:context.registry.registryHash,
    rootFormula:rootRecord?refFor(rootRecord):null,
    nodes:context.traceNodes.slice(),
    topologicalOrder:context.traceNodes.map(function(node){ return node.nodeId; }),
    formulaOrder:context.traceNodes.map(function(node){ return node.formula.formulaId; }),
    resultHash:resultHash||null,
    deterministic:true
  };
  payload.traceId=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function emptyTrace(registry){
  var payload={schema:TRACE_SCHEMA,version:VERSION,registryHash:registry.registryHash,rootFormula:null,nodes:[],topologicalOrder:[],formulaOrder:[],resultHash:null,deterministic:true};
  payload.traceId=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function failureResult(status,code,error,registry,record,context){
  return freeze(merge({
    schema:RESULT_SCHEMA,
    version:VERSION,
    status:status,
    code:code,
    registryHash:registry?registry.registryHash:null,
    formula:record?refFor(record):null,
    inputs:null,
    output:null,
    value:null,
    current:null,
    operations:context?context.operations:0,
    errors:[plainError(error,record)],
    trace:context?makeTrace(context,record,null):(registry?emptyTrace(registry):null)
  },evidenceFields()));
}

function parseEvaluateArguments(first,second,third,fourth){
  if(isObject(first)&&first.schema===Registry.schema) return {registry:first,id:second,inputs:third,options:fourth||{}};
  return {registry:Registry.registry,id:first,inputs:second,options:third||{}};
}

function evaluateFormula(first,second,third,fourth){
  var args=parseEvaluateArguments(first,second,third,fourth),registry,record,context,result,trace,payload;
  try{
    registry=verifyRegistry(args.registry);
    record=Registry.getFormula(registry,args.id,args.options.version);
    if(!record) raise(ERROR_CODES.FORMULA_UNKNOWN,'formula not found','$.formulaId',{actual:args.id});
    if(record.lifecycle==='RETRACTED') raise(ERROR_CODES.FORMULA_UNKNOWN,'retracted formula is blocked','$.formulaId');
    context=createContext(registry,args.options);
    result=evaluateRecord(record,args.inputs,context);
    trace=makeTrace(context,record,result.output.valueHash);
    payload=merge({
      schema:RESULT_SCHEMA,
      version:VERSION,
      status:'READY',
      code:null,
      registryHash:registry.registryHash,
      formula:refFor(record),
      inputs:result.inputs,
      output:result.output,
      value:result.output.value,
      current:trace.nodes[trace.nodes.length-1]||null,
      operations:context.operations,
      errors:[],
      trace:trace
    },evidenceFields());
    return freeze(payload);
  }catch(error){
    return failureResult(error.status||statusForCode(error.code),error.code||ERROR_CODES.AST_INVALID,error,registry||null,record||null,context||null);
  }
}

function evaluate(formulaId,rawInput,options){
  var record=Registry.getFormula(Registry.registry,formulaId,options&&options.version),typed={},source=rawInput||{},i,port;
  if(!record) return evaluateFormula(formulaId,{},options||{});
  try{
    for(i=0;i<record.inputs.length;i++){
      port=record.inputs[i];
      if(Object.prototype.hasOwnProperty.call(source,port.name)) typed[port.name]=isObject(source[port.name])&&source[port.name].schema===TYPED_VALUE_SCHEMA?source[port.name]:makeTypedValue(port,source[port.name]);
    }
    return evaluateFormula(formulaId,typed,options||{});
  }catch(error){
    return failureResult(error.status||statusForCode(error.code),error.code||ERROR_CODES.TYPE_MISMATCH,error,Registry.registry,record,null);
  }
}

function planDAG(first,second){
  var sourceRegistry,roots,registry,rootList,selected={},visiting={},records=[];
  if(isObject(first)&&first.schema===Registry.schema){ sourceRegistry=first; roots=second; }
  else{ sourceRegistry=Registry.registry; roots=first; }
  try{
    registry=verifyRegistry(sourceRegistry);
    rootList=Array.isArray(roots)?roots.slice():[roots];
    function collect(root){
      var id=isObject(root)?root.formulaId:root,version=isObject(root)?root.version:undefined,record=Registry.getFormula(registry,id,version),key,deps;
      if(!record) raise(ERROR_CODES.FORMULA_UNKNOWN,'DAG root not found','$.roots');
      key=formulaKey(record);
      if(visiting[key]) raise(ERROR_CODES.DEPENDENCY_CYCLE,'dependency cycle in DAG',key);
      if(selected[key]) return;
      visiting[key]=true;
      deps=dependencyRecords(record,registry).slice().sort(function(a,b){ return formulaKey(a).localeCompare(formulaKey(b)); });
      deps.forEach(collect);
      delete visiting[key]; selected[key]=record; records.push(record);
    }
    rootList.forEach(collect);
    selected={}; records.forEach(function(record){ selected[formulaKey(record)]=record; });
    var indegree={},outgoing={};
    records.forEach(function(record){ indegree[formulaKey(record)]=0; outgoing[formulaKey(record)]=[]; });
    records.forEach(function(record){
      dependencyRecords(record,registry).forEach(function(dep){
        if(selected[formulaKey(dep)]){ indegree[formulaKey(record)]++; outgoing[formulaKey(dep)].push(record); }
      });
    });
    var ready=records.filter(function(record){ return indegree[formulaKey(record)]===0; }),order=[],current;
    ready.sort(function(a,b){ return formulaKey(a).localeCompare(formulaKey(b)); });
    while(ready.length){
      current=ready.shift(); order.push(current);
      outgoing[formulaKey(current)].sort(function(a,b){ return formulaKey(a).localeCompare(formulaKey(b)); }).forEach(function(next){
        indegree[formulaKey(next)]--;
        if(indegree[formulaKey(next)]===0){ ready.push(next); ready.sort(function(a,b){ return formulaKey(a).localeCompare(formulaKey(b)); }); }
      });
    }
    if(order.length!==records.length) raise(ERROR_CODES.DEPENDENCY_CYCLE,'DAG cannot be topologically sorted','$.roots');
    return freeze(merge({
      schema:'meridian.formula-plan/1',version:VERSION,status:'READY',code:null,registryHash:registry.registryHash,
      roots:rootList.map(function(root){ return refFor(Registry.getFormula(registry,isObject(root)?root.formulaId:root,isObject(root)?root.version:undefined)); }),
      order:order.map(refFor),formulaOrder:order.map(function(record){ return record.formulaId; }),errors:[]
    },evidenceFields()));
  }catch(error){
    return freeze(merge({schema:'meridian.formula-plan/1',version:VERSION,status:error.status||statusForCode(error.code),code:error.code||ERROR_CODES.REGISTRY_INVALID,registryHash:registry?registry.registryHash:null,roots:[],order:[],formulaOrder:[],errors:[plainError(error,null)]},evidenceFields()));
  }
}

function portMatchesGoal(port,goal){
  var expected=goal&&goal.expectedType?goal.expectedType:goal;
  return !!expected&&port.valueType===expected.valueType&&port.unit===expected.unit&&port.measureKind===expected.measureKind&&sameDimension(port.dimension,expected.dimension);
}

function planNext(first,second){
  var sourceRegistry,state,registry,active,lineage={},candidates=[],missing=[],errors=[],blocked=[],i,j,record,bindings,relevant,port,goalMatch,rank;
  if(isObject(first)&&first.schema===Registry.schema){ sourceRegistry=first; state=second||{}; }
  else{ sourceRegistry=Registry.registry; state=first||{}; }
  try{
    registry=verifyRegistry(sourceRegistry);
    (state.lineage||[]).forEach(function(item){ lineage[isObject(item)?item.formulaId:Registry.normalizeFormulaId(item)]=true; });
    active=Registry.activeFormulas(registry);
    for(i=0;i<active.length;i++){
      record=active[i];
      if(lineage[record.formulaId]) continue;
      if(state.budget&&Number.isInteger(state.budget.maxOperations)&&record.implementation.maxOperations>state.budget.maxOperations){
        blocked.push({code:ERROR_CODES.BUDGET_EXCEEDED,formulaRef:formulaKey(record),message:'candidate exceeds maxOperations'});
        continue;
      }
      try{
        relevant={};
        for(j=0;j<record.inputs.length;j++){
          port=record.inputs[j];
          if(Object.prototype.hasOwnProperty.call(state.values||{},port.name)) relevant[port.name]=state.values[port.name];
        }
        bindings=normalizeInputs(record,relevant);
        goalMatch=(state.openGoals||[]).some(function(goal){ return goal.required!==false&&portMatchesGoal(record.output,goal); })?0:1;
        rank=[goalMatch,record.implementation.maxOperations,record.formulaId,record.version];
        candidates.push(freeze({formula:refFor(record),bindings:bindings,rankTuple:rank,experimentalScore:null,reasons:freeze([goalMatch===0?'GOAL_PORT_MATCH':'LOW_COST','STABLE_TIE_BREAK'])}));
      }catch(error){
        if(error.code===ERROR_CODES.INPUT_MISSING){
          port=null; record.inputs.forEach(function(candidate){ if(candidate.name===error.details.port) port=candidate; });
          missing.push({goalId:'input:'+record.formulaId+':'+(error.details.port||'unknown'),name:error.details.port||'unknown',expectedType:port?typeShape(port):null,required:true,requiredEvidence:{},reason:'INPUT_MISSING'});
        }else{
          errors.push(plainError(error,record));
        }
      }
    }
    candidates.sort(function(a,b){
      var index;
      for(index=0;index<a.rankTuple.length;index++) if(a.rankTuple[index]!==b.rankTuple[index]) return a.rankTuple[index]<b.rankTuple[index]?-1:1;
      return 0;
    });
    if(candidates.length){
      return freeze(merge({schema:'meridian.next-formula/1',version:VERSION,status:'READY',code:null,selected:candidates[0].formula,bindings:candidates[0].bindings,alternatives:candidates,reasons:candidates[0].reasons,proofObligations:[],missing:[],errors:[],trace:emptyTrace(registry)},evidenceFields()));
    }
    if(errors.length) return freeze(merge({schema:'meridian.next-formula/1',version:VERSION,status:'ABSTAIN',code:errors[0].code,selected:null,bindings:{},alternatives:[],reasons:[],proofObligations:[],missing:missing,errors:errors,trace:emptyTrace(registry)},evidenceFields()));
    if(blocked.length) return freeze(merge({schema:'meridian.next-formula/1',version:VERSION,status:'BLOCKED',code:ERROR_CODES.BUDGET_EXCEEDED,selected:null,bindings:{},alternatives:[],reasons:[],proofObligations:[],missing:missing,errors:blocked,trace:emptyTrace(registry)},evidenceFields()));
    return freeze(merge({schema:'meridian.next-formula/1',version:VERSION,status:'PARTIAL',code:ERROR_CODES.INPUT_MISSING,selected:null,bindings:{},alternatives:[],reasons:[],proofObligations:[],missing:missing,errors:[],trace:emptyTrace(registry)},evidenceFields()));
  }catch(error){
    return freeze(merge({schema:'meridian.next-formula/1',version:VERSION,status:error.status||'INVALID',code:error.code||ERROR_CODES.REGISTRY_INVALID,selected:null,bindings:{},alternatives:[],reasons:[],proofObligations:[],missing:[],errors:[plainError(error,null)],trace:registry?emptyTrace(registry):null},evidenceFields()));
  }
}

function approximatelyEqual(left,right,policy){
  var difference,scale;
  if(typeof left!=='number'||typeof right!=='number'||!Number.isFinite(left)||!Number.isFinite(right)||!policy||policy.mode!=='FLOAT64') return false;
  difference=Math.abs(left-right);
  scale=Math.max(Math.abs(left),Math.abs(right));
  return difference<=policy.absoluteTolerance+policy.relativeTolerance*scale;
}

function ringInput(value,port){ return typeof value==='number'?makeTypedValue(port,value):value; }
function runRingMatryoshka(source,options){
  var registry,closure,bindings,context,partition,total,direction,margin,partitionRecord,policy,summary,currentNode,nextRecord,trace,payload;
  try{
    registry=verifyRegistry(options&&options.registry||Registry.registry);
    closure=Registry.getFormula(registry,'pressure.closure');
    if(!isObject(source)) raise(ERROR_CODES.INPUT_MISSING,'ring input object required','$.input');
    if(!Object.prototype.hasOwnProperty.call(source,'x')) raise(ERROR_CODES.INPUT_MISSING,'x is required','$.input.x',{port:'x'});
    if(!Object.prototype.hasOwnProperty.call(source,'y')) raise(ERROR_CODES.INPUT_MISSING,'y is required','$.input.y',{port:'y'});
    bindings=freeze({x:ringInput(source.x,closure.inputs[0]),y:ringInput(source.y,closure.inputs[1])});
    context=createContext(registry,options||{});
    partitionRecord=Registry.getFormula(registry,'pressure.partition');
    partition=evaluateRecord(partitionRecord,bindings,context);
    total=evaluateRecord(Registry.getFormula(registry,'pressure.orbit-total'),bindings,context);
    direction=evaluateRecord(Registry.getFormula(registry,'pressure.direction'),bindings,context);
    margin=evaluateRecord(Registry.getFormula(registry,'pressure.margin'),bindings,context);
    policy=partitionRecord.contract.numericPolicy;
    if(!approximatelyEqual(partition.output.value,1,policy)) raise(ERROR_CODES.POSTCONDITION_FAILED,'pressure partition is not approximately one','$.summary.partition');
    summary=freeze({
      x:bindings.x.value,
      y:bindings.y.value,
      closure:context.latestByFormula['pressure.closure'].output.value,
      edge:context.latestByFormula['pressure.edge'].output.value,
      orbitForward:context.latestByFormula['pressure.orbit-forward'].output.value,
      orbitReverse:context.latestByFormula['pressure.orbit-reverse'].output.value,
      partition:partition.output.value,
      orbitTotal:total.output.value,
      direction:direction.output.value,
      margin:margin.output.value,
      partitionTarget:1,
      partitionDelta:Math.abs(partition.output.value-1),
      partitionApproximatelyOne:true,
      numericPolicy:policy
    });
    trace=makeTrace(context,margin.record,margin.output.valueHash);
    currentNode=context.traceNodes.filter(function(node){ return node.formula.formulaId==='pressure.partition'; })[0];
    nextRecord=Registry.getFormula(registry,'pressure.orbit-total');
    payload=merge({
      schema:'meridian.ring-matryoshka/1',version:VERSION,status:'READY',code:null,registryHash:registry.registryHash,inputs:bindings,
      trace:trace,current:freeze({formula:refFor(partitionRecord),nodeId:currentNode.nodeId,output:partition.output}),
      next:freeze({status:'READY',selected:refFor(nextRecord),reasons:freeze(['STABLE_TIE_BREAK'])}),nextFormula:refFor(nextRecord),
      summary:summary,operations:context.operations,errors:[]
    },evidenceFields());
    return freeze(payload);
  }catch(error){
    var status=error.status||statusForCode(error.code),code=error.code||ERROR_CODES.AST_INVALID;
    if(status==='INVALID'&&(code===ERROR_CODES.TYPE_MISMATCH||code===ERROR_CODES.DIMENSION_MISMATCH||code===ERROR_CODES.MEASURE_KIND_MISMATCH||code===ERROR_CODES.UNIT_CONVERSION_MISSING)) status='ABSTAIN';
    return freeze(merge({
      schema:'meridian.ring-matryoshka/1',version:VERSION,status:status,code:code,registryHash:registry?registry.registryHash:null,inputs:null,
      trace:context?makeTrace(context,margin&&margin.record||partitionRecord||null,null):null,current:null,next:null,nextFormula:null,summary:null,
      operations:context?context.operations:0,errors:[plainError(error,partitionRecord||null)]
    },evidenceFields()));
  }
}

var registryCheck=Registry.verifyRegistry(Registry.registry);
var validation=freeze({status:registryCheck.status,code:registryCheck.code,errors:registryCheck.errors,registryHash:Registry.registry.registryHash});

global.MRDP78FormulaEngine=freeze({
  version:VERSION,
  schema:'meridian.formula-engine/1',
  resultSchema:RESULT_SCHEMA,
  traceSchema:TRACE_SCHEMA,
  stateSchema:STATE_SCHEMA,
  typedValueSchema:TYPED_VALUE_SCHEMA,
  status:'READY',
  registryHash:Registry.registry.registryHash,
  validation:validation,
  evidence:'STRUCTURAL',
  evidenceLevel:'STRUCTURAL',
  soundness:'NOT_COMPUTED',
  semanticTruth:false,
  errorCodes:ERROR_CODES,
  defaultRegistry:Registry.registry,
  makeTypedValue:makeTypedValue,
  unknownValue:unknownValue,
  approximatelyEqual:approximatelyEqual,
  evaluate:evaluate,
  evaluateFormula:evaluateFormula,
  planDAG:planDAG,
  planNext:planNext,
  runRingMatryoshka:runRingMatryoshka
});
})(typeof globalThis!=='undefined'?globalThis:this);
