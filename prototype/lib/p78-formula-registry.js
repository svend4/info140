(function(global){
'use strict';

var VERSION='1.0.0';
var REGISTRY_SCHEMA='meridian.formula-registry/1';
var FORMULA_SCHEMA='meridian.formula/1';
var Canonical=global.MRDP78CanonicalJSON;

if(!Canonical){
  global.MRDP78FormulaRegistry=Object.freeze({
    version:VERSION,
    status:'BLOCKED',
    code:'CANONICAL_JSON_UNAVAILABLE'
  });
  return;
}

var freeze=Canonical.deepFreeze;
var DIMENSION_KEYS=freeze(['length','mass','time','current','temperature','amount','luminosity']);
var VALUE_TYPES=freeze({Real:true,Int:true,Bool:true,Tuple:true});
var LAYERS=freeze({MATHEMATICAL:true,EMPIRICAL_POLICY:true,INTERPRETATION:true});
var KINDS=freeze({ATOM:true,COMPOSITE:true,PREDICATE:true,AGGREGATOR:true,FIXPOINT:true});
var LIFECYCLES=freeze({DRAFT:true,ACTIVE:true,DEPRECATED:true,RETRACTED:true});
var DEPENDENCY_KINDS=freeze({USES:true,GUARDS:true,PROVES:true,REFUTES:true,CALIBRATES:true,INTERPRETS:true,REALIZES:true});
var OPERATIONS=freeze({
  add:{min:2,max:null},
  sub:{min:2,max:2},
  mul:{min:2,max:null},
  div:{min:2,max:2},
  pow:{min:2,max:2},
  sqrt:{min:1,max:1},
  max:{min:1,max:null},
  min:{min:1,max:null},
  abs:{min:1,max:1},
  neg:{min:1,max:1},
  complement:{min:1,max:1},
  lt:{min:2,max:2},
  lte:{min:2,max:2},
  gt:{min:2,max:2},
  gte:{min:2,max:2},
  eq:{min:2,max:2},
  and:{min:2,max:null},
  or:{min:2,max:null},
  not:{min:1,max:1}
});

var ERROR_CODES=freeze({
  CANONICAL_JSON_UNAVAILABLE:'CANONICAL_JSON_UNAVAILABLE',
  REGISTRY_SCHEMA_INVALID:'REGISTRY_SCHEMA_INVALID',
  FORMULA_SCHEMA_INVALID:'FORMULA_SCHEMA_INVALID',
  SEMVER_INVALID:'SEMVER_INVALID',
  FORMULA_HASH_MISMATCH:'FORMULA_HASH_MISMATCH',
  REGISTRY_HASH_MISMATCH:'REGISTRY_HASH_MISMATCH',
  FORMULA_DUPLICATE:'FORMULA_DUPLICATE',
  FORMULA_UNKNOWN:'FORMULA_UNKNOWN',
  PORT_INVALID:'PORT_INVALID',
  NUMERIC_POLICY_INVALID:'NUMERIC_POLICY_INVALID',
  AST_INVALID:'AST_INVALID',
  DEPENDENCY_UNPINNED:'DEPENDENCY_UNPINNED',
  DEPENDENCY_MISSING:'DEPENDENCY_MISSING',
  DEPENDENCY_CYCLE:'DEPENDENCY_CYCLE'
});

function registryError(code,message,path){
  var error=new Error(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78FormulaRegistryError';
  error.code=code;
  error.path=path||'$';
  return error;
}

function reject(code,message,path){ throw registryError(code,message,path); }
function isObject(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function isSemVer(value){ return typeof value==='string'&&/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value); }
function normalizeFormulaId(value){ return typeof value==='string'&&value.indexOf('mrd:formula:')===0?value.slice(12):value; }
function formulaKey(id,version){ return normalizeFormulaId(id)+'@'+version; }

function omitOwn(value,key){
  var result={},keys=Object.keys(value),i,name;
  for(i=0;i<keys.length;i++){
    name=keys[i];
    if(name!==key) result[name]=value[name];
  }
  return result;
}

function computeRecordHash(record){ return Canonical.hashCanonical(omitOwn(record,'contentHash')); }
function computeRegistryHash(registry){ return Canonical.hashCanonical(omitOwn(registry,'registryHash')); }

function validateDimension(value,path){
  var keys,i,key;
  if(!isObject(value)) reject(ERROR_CODES.PORT_INVALID,'dimension object required',path);
  keys=Object.keys(value).sort();
  if(keys.length!==DIMENSION_KEYS.length) reject(ERROR_CODES.PORT_INVALID,'dimension vector must contain seven axes',path);
  for(i=0;i<DIMENSION_KEYS.length;i++){
    key=DIMENSION_KEYS[i];
    if(!Object.prototype.hasOwnProperty.call(value,key)||typeof value[key]!=='number'||!Number.isFinite(value[key])){
      reject(ERROR_CODES.PORT_INVALID,'finite dimension axis required',path+'.'+key);
    }
  }
}

function validateInterval(value,path){
  if(value===null) return;
  if(!isObject(value)||typeof value.min!=='number'||typeof value.max!=='number'||!Number.isFinite(value.min)||!Number.isFinite(value.max)||
    typeof value.closedMin!=='boolean'||typeof value.closedMax!=='boolean'||value.min>value.max){
    reject(ERROR_CODES.PORT_INVALID,'finite ordered interval required',path);
  }
  if(value.min===value.max&&(!value.closedMin||!value.closedMax)) reject(ERROR_CODES.PORT_INVALID,'empty interval',path);
}

function validateTypeSpec(value,path,requireName){
  if(!isObject(value)) reject(ERROR_CODES.PORT_INVALID,'typed port required',path);
  if(requireName&&(typeof value.name!=='string'||!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value.name))) reject(ERROR_CODES.PORT_INVALID,'invalid port name',path+'.name');
  if(!VALUE_TYPES[value.valueType]) reject(ERROR_CODES.PORT_INVALID,'unknown valueType',path+'.valueType');
  if(typeof value.unit!=='string'||!value.unit) reject(ERROR_CODES.PORT_INVALID,'unit required',path+'.unit');
  validateDimension(value.dimension,path+'.dimension');
  if(typeof value.measureKind!=='string'||!value.measureKind) reject(ERROR_CODES.PORT_INVALID,'measureKind required',path+'.measureKind');
  if(!Object.prototype.hasOwnProperty.call(value,'interval')) reject(ERROR_CODES.PORT_INVALID,'explicit interval required',path+'.interval');
  validateInterval(value.interval,path+'.interval');
  if(requireName&&typeof value.required!=='boolean') reject(ERROR_CODES.PORT_INVALID,'required flag missing',path+'.required');
  if(requireName&&typeof value.description!=='string') reject(ERROR_CODES.PORT_INVALID,'description missing',path+'.description');
}

function compatiblePorts(left,right){
  var i,key;
  if(left.valueType!==right.valueType||left.unit!==right.unit||left.measureKind!==right.measureKind) return false;
  for(i=0;i<DIMENSION_KEYS.length;i++){
    key=DIMENSION_KEYS[i];
    if(left.dimension[key]!==right.dimension[key]) return false;
  }
  return true;
}

function findPort(inputs,name){
  var i;
  for(i=0;i<inputs.length;i++) if(inputs[i].name===name) return inputs[i];
  return null;
}

function validateAst(ast,record,path,depth,locals,refs){
  var i,keys,operation,name;
  if(depth>64) reject(ERROR_CODES.AST_INVALID,'AST depth exceeds 64',path);
  if(!isObject(ast)||typeof ast.node!=='string') reject(ERROR_CODES.AST_INVALID,'node tag required',path);
  if(ast.node==='Literal'){
    if(typeof ast.value==='number'&&!Number.isFinite(ast.value)) reject(ERROR_CODES.AST_INVALID,'literal must be finite',path+'.value');
    if(typeof ast.value!=='number'&&typeof ast.value!=='boolean'&&typeof ast.value!=='string') reject(ERROR_CODES.AST_INVALID,'invalid literal value',path+'.value');
    validateTypeSpec(ast.type,path+'.type',false);
    return;
  }
  if(ast.node==='Input'){
    if(typeof ast.port!=='string'||(!findPort(record.inputs,ast.port)&&locals.indexOf(ast.port)===-1)) reject(ERROR_CODES.AST_INVALID,'unknown input '+ast.port,path+'.port');
    return;
  }
  if(ast.node==='Let'){
    if(typeof ast.name!=='string'||!/^[A-Za-z][A-Za-z0-9_-]*$/.test(ast.name)) reject(ERROR_CODES.AST_INVALID,'invalid let name',path+'.name');
    validateAst(ast.value,record,path+'.value',depth+1,locals,refs);
    validateAst(ast.body,record,path+'.body',depth+1,locals.concat([ast.name]),refs);
    return;
  }
  if(ast.node==='Call'){
    operation=OPERATIONS[ast.operation];
    if(!operation) reject(ERROR_CODES.AST_INVALID,'unknown operation '+ast.operation,path+'.operation');
    if(!Array.isArray(ast.args)||ast.args.length<operation.min||(operation.max!==null&&ast.args.length>operation.max)) reject(ERROR_CODES.AST_INVALID,'invalid operation arity',path+'.args');
    for(i=0;i<ast.args.length;i++) validateAst(ast.args[i],record,path+'.args['+i+']',depth+1,locals,refs);
    return;
  }
  if(ast.node==='Tuple'){
    if(!Array.isArray(ast.items)) reject(ERROR_CODES.AST_INVALID,'tuple items required',path+'.items');
    for(i=0;i<ast.items.length;i++) validateAst(ast.items[i],record,path+'.items['+i+']',depth+1,locals,refs);
    return;
  }
  if(ast.node==='If'){
    validateAst(ast.test,record,path+'.test',depth+1,locals,refs);
    validateAst(ast.then,record,path+'.then',depth+1,locals,refs);
    validateAst(ast.else,record,path+'.else',depth+1,locals,refs);
    return;
  }
  if(ast.node==='FormulaRef'){
    if(typeof ast.formulaId!=='string'||!ast.formulaId||!isSemVer(ast.version)||!isObject(ast.bindings)) reject(ERROR_CODES.AST_INVALID,'invalid FormulaRef',path);
    keys=Object.keys(ast.bindings).sort();
    for(i=0;i<keys.length;i++) validateAst(ast.bindings[keys[i]],record,path+'.bindings.'+keys[i],depth+1,locals,refs);
    name=formulaKey(ast.formulaId,ast.version);
    refs.push({key:name,path:path});
    return;
  }
  reject(ERROR_CODES.AST_INVALID,'unknown node '+ast.node,path+'.node');
}

function validateNumericPolicy(policy,path){
  if(!isObject(policy)||['EXACT_INT','RATIONAL','FLOAT64','INTERVAL'].indexOf(policy.mode)===-1||
    typeof policy.absoluteTolerance!=='number'||!Number.isFinite(policy.absoluteTolerance)||policy.absoluteTolerance<0||
    typeof policy.relativeTolerance!=='number'||!Number.isFinite(policy.relativeTolerance)||policy.relativeTolerance<0||
    ['NONE','HALF_EVEN','DOWN','UP'].indexOf(policy.rounding)===-1||policy.overflow!=='ERROR'){
    reject(ERROR_CODES.NUMERIC_POLICY_INVALID,'invalid numeric policy',path);
  }
}

function validateRecord(record,index){
  var path='$.records['+index+']',ports={},i,refs=[],dependencies={};
  if(!isObject(record)||record.schema!==FORMULA_SCHEMA) reject(ERROR_CODES.FORMULA_SCHEMA_INVALID,'formula schema mismatch',path+'.schema');
  if(typeof record.formulaId!=='string'||!record.formulaId||normalizeFormulaId(record.formulaId)!==record.formulaId) reject(ERROR_CODES.FORMULA_SCHEMA_INVALID,'canonical formulaId required',path+'.formulaId');
  if(!isSemVer(record.version)) reject(ERROR_CODES.SEMVER_INVALID,'formula version must be SemVer',path+'.version');
  if(!Canonical.isSha256(record.contentHash)||record.contentHash!==computeRecordHash(record)) reject(ERROR_CODES.FORMULA_HASH_MISMATCH,'formula content hash mismatch',path+'.contentHash');
  if(typeof record.title!=='string'||!record.title) reject(ERROR_CODES.FORMULA_SCHEMA_INVALID,'title required',path+'.title');
  if(!LAYERS[record.layer]||!KINDS[record.kind]||!LIFECYCLES[record.lifecycle]) reject(ERROR_CODES.FORMULA_SCHEMA_INVALID,'formula classification invalid',path);
  if(!Array.isArray(record.inputs)||!record.inputs.length) reject(ERROR_CODES.PORT_INVALID,'at least one input required',path+'.inputs');
  for(i=0;i<record.inputs.length;i++){
    validateTypeSpec(record.inputs[i],path+'.inputs['+i+']',true);
    if(ports[record.inputs[i].name]) reject(ERROR_CODES.PORT_INVALID,'duplicate input '+record.inputs[i].name,path+'.inputs['+i+']');
    ports[record.inputs[i].name]=true;
  }
  validateTypeSpec(record.output,path+'.output',true);
  if(!isObject(record.contract)||!Array.isArray(record.contract.pre)||!Array.isArray(record.contract.invariants)||!Array.isArray(record.contract.post)||
    ['TOTAL','PARTIAL'].indexOf(record.contract.totality)===-1||record.contract.deterministic!==true){
    reject(ERROR_CODES.FORMULA_SCHEMA_INVALID,'invalid formula contract',path+'.contract');
  }
  validateNumericPolicy(record.contract.numericPolicy,path+'.contract.numericPolicy');
  if(!Array.isArray(record.dependencies)) reject(ERROR_CODES.DEPENDENCY_UNPINNED,'dependencies array required',path+'.dependencies');
  for(i=0;i<record.dependencies.length;i++){
    validateDependency(record.dependencies[i],path+'.dependencies['+i+']');
    dependencies[formulaKey(record.dependencies[i].formula.formulaId,record.dependencies[i].formula.version)]=true;
  }
  validateAst(record.expression,record,path+'.expression',0,[],refs);
  for(i=0;i<refs.length;i++) if(!dependencies[refs[i].key]) reject(ERROR_CODES.DEPENDENCY_UNPINNED,'FormulaRef lacks pinned dependency',refs[i].path);
  if(!Array.isArray(record.claims)||!isObject(record.evidence)||!isObject(record.provenance)||!isObject(record.implementation)||
    record.implementation.evaluator!=='closed-ast-v1'||typeof record.implementation.maxOperations!=='number'||
    !Number.isInteger(record.implementation.maxOperations)||record.implementation.maxOperations<1){
    reject(ERROR_CODES.FORMULA_SCHEMA_INVALID,'metadata or implementation invalid',path);
  }
}

function validateDependency(dependency,path){
  if(!isObject(dependency)||!DEPENDENCY_KINDS[dependency.kind]||!isObject(dependency.formula)||
    typeof dependency.formula.formulaId!=='string'||normalizeFormulaId(dependency.formula.formulaId)!==dependency.formula.formulaId||
    !isSemVer(dependency.formula.version)||!Canonical.isSha256(dependency.formula.contentHash)||!isObject(dependency.bindings)){
    reject(ERROR_CODES.DEPENDENCY_UNPINNED,'dependency must pin id, version and hash',path);
  }
}

function resolveDependencies(records,indexByKey){
  var i,j,k,record,dependency,target,targetInput,parentInput,bindingKeys,astRefs=[];
  for(i=0;i<records.length;i++){
    record=records[i];
    for(j=0;j<record.dependencies.length;j++){
      dependency=record.dependencies[j];
      target=indexByKey[formulaKey(dependency.formula.formulaId,dependency.formula.version)];
      if(!target) reject(ERROR_CODES.DEPENDENCY_MISSING,'dependency not found',record.formulaId+'.dependencies['+j+']');
      if(target.contentHash!==dependency.formula.contentHash) reject(ERROR_CODES.FORMULA_HASH_MISMATCH,'pinned dependency hash mismatch',record.formulaId+'.dependencies['+j+']');
      if(dependency.kind==='USES'||dependency.kind==='GUARDS'){
        bindingKeys=Object.keys(dependency.bindings).sort();
        for(k=0;k<target.inputs.length;k++){
          targetInput=target.inputs[k];
          if(!Object.prototype.hasOwnProperty.call(dependency.bindings,targetInput.name)) reject(ERROR_CODES.DEPENDENCY_UNPINNED,'dependency input is unbound',record.formulaId+'->'+target.formulaId+'.'+targetInput.name);
          parentInput=findPort(record.inputs,dependency.bindings[targetInput.name]);
          if(!parentInput||!compatiblePorts(parentInput,targetInput)) reject(ERROR_CODES.PORT_INVALID,'dependency binding is not type compatible',record.formulaId+'->'+target.formulaId+'.'+targetInput.name);
        }
        if(bindingKeys.length!==target.inputs.length) reject(ERROR_CODES.DEPENDENCY_UNPINNED,'dependency has unknown bindings',record.formulaId+'->'+target.formulaId);
      }
    }
    astRefs.length=0;
    validateAst(record.expression,record,record.formulaId+'.expression',0,[],astRefs);
    for(j=0;j<astRefs.length;j++) if(!indexByKey[astRefs[j].key]) reject(ERROR_CODES.DEPENDENCY_MISSING,'FormulaRef target missing',astRefs[j].path);
  }
}

function detectCycles(records,indexByKey){
  var state={},stack=[];
  function visit(record){
    var key=formulaKey(record.formulaId,record.version),deps,i,target;
    if(state[key]===2) return;
    if(state[key]===1) reject(ERROR_CODES.DEPENDENCY_CYCLE,stack.concat([key]).join(' -> '),key);
    state[key]=1; stack.push(key);
    deps=record.dependencies.filter(function(item){ return item.kind==='USES'||item.kind==='GUARDS'; }).slice().sort(function(a,b){
      return formulaKey(a.formula.formulaId,a.formula.version).localeCompare(formulaKey(b.formula.formulaId,b.formula.version));
    });
    for(i=0;i<deps.length;i++){
      target=indexByKey[formulaKey(deps[i].formula.formulaId,deps[i].formula.version)];
      visit(target);
    }
    stack.pop(); state[key]=2;
  }
  records.forEach(visit);
}

function semverParts(value){ return value.split(/[+-]/)[0].split('.').map(function(part){ return Number(part); }); }
function recordCompare(a,b){
  var id=a.formulaId.localeCompare(b.formulaId),left,right,i;
  if(id) return id;
  left=semverParts(a.version); right=semverParts(b.version);
  for(i=0;i<3;i++) if(left[i]!==right[i]) return left[i]-right[i];
  return a.version.localeCompare(b.version);
}

function createRegistry(sourceRecords,expectedHash){
  var records,indexByKey={},i,key,payload,registryHash;
  if(!Array.isArray(sourceRecords)||!sourceRecords.length) reject(ERROR_CODES.REGISTRY_SCHEMA_INVALID,'non-empty records array required','$.records');
  records=Canonical.deepCopy(sourceRecords);
  for(i=0;i<records.length;i++) validateRecord(records[i],i);
  records.sort(recordCompare);
  for(i=0;i<records.length;i++){
    key=formulaKey(records[i].formulaId,records[i].version);
    if(indexByKey[key]) reject(ERROR_CODES.FORMULA_DUPLICATE,'duplicate '+key,'$.records['+i+']');
    indexByKey[key]=records[i];
  }
  detectCycles(records,indexByKey);
  resolveDependencies(records,indexByKey);
  payload={schema:REGISTRY_SCHEMA,version:VERSION,records:records};
  registryHash=Canonical.hashCanonical(payload);
  if(expectedHash!==undefined&&expectedHash!==registryHash) reject(ERROR_CODES.REGISTRY_HASH_MISMATCH,'registry hash mismatch','$.registryHash');
  payload.registryHash=registryHash;
  return freeze(payload);
}

function verifyRegistry(snapshot){
  var registry;
  try{
    if(!isObject(snapshot)||snapshot.schema!==REGISTRY_SCHEMA||snapshot.version!==VERSION||!Canonical.isSha256(snapshot.registryHash)){
      reject(ERROR_CODES.REGISTRY_SCHEMA_INVALID,'registry envelope invalid','$');
    }
    if(Object.keys(snapshot).sort().join(',')!=='records,registryHash,schema,version') reject(ERROR_CODES.REGISTRY_SCHEMA_INVALID,'unknown registry fields','$');
    registry=createRegistry(snapshot.records,snapshot.registryHash);
    return freeze({status:'READY',code:null,registry:registry,errors:[]});
  }catch(error){
    return freeze({status:'INVALID',code:error.code||ERROR_CODES.REGISTRY_SCHEMA_INVALID,registry:null,errors:[{
      code:error.code||ERROR_CODES.REGISTRY_SCHEMA_INVALID,
      path:error.path||'$',
      message:error.message
    }]});
  }
}

function getFormula(registry,id,version){
  var normalized=normalizeFormulaId(id),matches,i;
  if(!registry||!Array.isArray(registry.records)) return null;
  matches=registry.records.filter(function(record){ return record.formulaId===normalized&&(version===undefined||record.version===version); });
  if(!matches.length) return null;
  if(version!==undefined) return matches[0];
  matches.sort(recordCompare);
  for(i=matches.length-1;i>=0;i--) if(matches[i].lifecycle==='ACTIVE') return matches[i];
  return matches[matches.length-1];
}

function activeFormulas(registry){
  if(!registry||!Array.isArray(registry.records)) return freeze([]);
  return freeze(registry.records.filter(function(record){ return record.lifecycle==='ACTIVE'; }).slice().sort(recordCompare));
}

function formulaRef(record){ return freeze({formulaId:record.formulaId,version:record.version,contentHash:record.contentHash}); }

var ZERO_DIMENSION=freeze({length:0,mass:0,time:0,current:0,temperature:0,amount:0,luminosity:0});
function interval(min,max){ return {min:min,max:max,closedMin:true,closedMax:true}; }
function typeSpec(valueType,measureKind,min,max){
  return {valueType:valueType,unit:'1',dimension:ZERO_DIMENSION,measureKind:measureKind,interval:min===null?null:interval(min,max)};
}
function port(name,measureKind,min,max,description){
  var value=typeSpec('Real',measureKind,min,max);
  value.name=name; value.required=true; value.description=description;
  return value;
}
function literal(value){ return {node:'Literal',value:value,type:typeSpec('Real','PureNumber',value,value)}; }
function input(name){ return {node:'Input',port:name}; }
function call(operation,args){ return {node:'Call',operation:operation,args:args}; }
function formulaNode(record,bindings){ return {node:'FormulaRef',formulaId:record.formulaId,version:record.version,bindings:bindings}; }
function dependency(record,bindings){ return {kind:'USES',formula:formulaRef(record),bindings:bindings}; }
function xyBindings(){ return {x:input('x'),y:input('y')}; }
function numericPolicy(){ return {mode:'FLOAT64',absoluteTolerance:1e-12,relativeTolerance:1e-12,rounding:'NONE',overflow:'ERROR'}; }
function evidence(){ return {integrity:'HASH_VERIFIED',structural:'VALID',mathematical:'NOT_COMPUTED',empirical:'NOT_APPLICABLE',interpretive:'NOT_APPLICABLE'}; }
function provenance(){ return {sourceType:'PROJECT',sourceId:'docs/28-formula-nesting-and-linguistic-mathematics.md',sourceRevision:'sections-5-10-27',retrievedAt:null,license:null,parentHashes:[]}; }

function makeRecord(id,title,kind,inputs,output,expression,dependencies,invariants,maxOperations,layer){
  var draft={
    schema:FORMULA_SCHEMA,
    formulaId:id,
    version:'1.0.0',
    title:title,
    layer:layer||'MATHEMATICAL',
    kind:kind,
    lifecycle:'ACTIVE',
    inputs:inputs,
    output:output,
    expression:expression,
    contract:{
      pre:[],
      invariants:invariants||[],
      post:[],
      totality:'TOTAL',
      deterministic:true,
      numericPolicy:numericPolicy()
    },
    dependencies:dependencies||[],
    claims:[],
    evidence:evidence(),
    provenance:provenance(),
    implementation:{evaluator:'closed-ast-v1',complexity:'O(1)',maxOperations:maxOperations}
  };
  draft.contentHash=Canonical.hashCanonical(draft);
  return freeze(draft);
}

var X_PORT=port('x','RingCoordinate',0,1,'First ring coordinate.');
var Y_PORT=port('y','RingCoordinate',0,1,'Second ring coordinate.');
function xyPorts(){ return [X_PORT,Y_PORT]; }
function pressureOutput(name){ return port(name,'Probability',0,1,'Pressure share.'); }

var RING_BALANCE=makeRecord(
  'ring.balance','Ring balance','ATOM',
  [port('u','RingCoordinate',0,1,'Ring coordinate.')],
  port('balance','RingBalance',0,1,'Symmetric ring balance.'),
  call('mul',[literal(4),input('u'),call('complement',[input('u')])]),[],[],8
);
var PRESSURE_CLOSURE=makeRecord(
  'pressure.closure','Closure pressure','ATOM',xyPorts(),pressureOutput('closure'),
  call('mul',[input('x'),input('y')]),[],[],4
);
var PRESSURE_EDGE=makeRecord(
  'pressure.edge','Edge pressure','ATOM',xyPorts(),pressureOutput('edge'),
  call('mul',[call('complement',[input('x')]),call('complement',[input('y')])]),[],[],8
);
var PRESSURE_FORWARD=makeRecord(
  'pressure.orbit-forward','Forward orbit pressure','ATOM',xyPorts(),pressureOutput('orbitForward'),
  call('mul',[input('x'),call('complement',[input('y')])]),[],[],6
);
var PRESSURE_REVERSE=makeRecord(
  'pressure.orbit-reverse','Reverse orbit pressure','ATOM',xyPorts(),pressureOutput('orbitReverse'),
  call('mul',[call('complement',[input('x')]),input('y')]),[],[],6
);
var PRESSURE_TOTAL=makeRecord(
  'pressure.orbit-total','Total orbit pressure','COMPOSITE',xyPorts(),pressureOutput('orbitTotal'),
  call('add',[formulaNode(PRESSURE_FORWARD,xyBindings()),formulaNode(PRESSURE_REVERSE,xyBindings())]),
  [dependency(PRESSURE_FORWARD,{x:'x',y:'y'}),dependency(PRESSURE_REVERSE,{x:'x',y:'y'})],[],24
);
var PRESSURE_PARTITION=makeRecord(
  'pressure.partition','Pressure partition','COMPOSITE',xyPorts(),port('partition','PureNumber',0,4,'Sum of four pressure shares.'),
  call('add',[
    formulaNode(PRESSURE_CLOSURE,xyBindings()),
    formulaNode(PRESSURE_EDGE,xyBindings()),
    formulaNode(PRESSURE_FORWARD,xyBindings()),
    formulaNode(PRESSURE_REVERSE,xyBindings())
  ]),
  [
    dependency(PRESSURE_CLOSURE,{x:'x',y:'y'}),
    dependency(PRESSURE_EDGE,{x:'x',y:'y'}),
    dependency(PRESSURE_FORWARD,{x:'x',y:'y'}),
    dependency(PRESSURE_REVERSE,{x:'x',y:'y'})
  ],
  [{predicateId:'partition.approximately-one',version:'1.0.0',bindings:{value:'output'}}],48
);
var PRESSURE_DIRECTION=makeRecord(
  'pressure.direction','Orbit direction','COMPOSITE',xyPorts(),port('direction','PureNumber',-1,1,'Signed orbit direction.'),
  call('sub',[formulaNode(PRESSURE_FORWARD,xyBindings()),formulaNode(PRESSURE_REVERSE,xyBindings())]),
  [dependency(PRESSURE_FORWARD,{x:'x',y:'y'}),dependency(PRESSURE_REVERSE,{x:'x',y:'y'})],[],24
);
var PRESSURE_MARGIN=makeRecord(
  'pressure.margin','Orbit margin','COMPOSITE',xyPorts(),port('margin','PureNumber',-1,1,'Orbit pressure minus the stronger pole.'),
  call('sub',[
    formulaNode(PRESSURE_TOTAL,xyBindings()),
    call('max',[formulaNode(PRESSURE_CLOSURE,xyBindings()),formulaNode(PRESSURE_EDGE,xyBindings())])
  ]),
  [
    dependency(PRESSURE_TOTAL,{x:'x',y:'y'}),
    dependency(PRESSURE_CLOSURE,{x:'x',y:'y'}),
    dependency(PRESSURE_EDGE,{x:'x',y:'y'})
  ],[],48
);
var VITALITY_SNAPSHOT=makeRecord(
  'vitality.snapshot-geomean','Snapshot vitality heuristic','AGGREGATOR',
  [
    port('growth','Growth',0,1,'Connected growth axis.'),
    port('novelty','Novelty',0,1,'Non-repetition axis.'),
    port('openness','Openness',0,1,'Continuation openness axis.'),
    port('balance','RingBalance',0,1,'Ring balance axis.')
  ],
  port('vitality','PolicyScore',0,1,'Square root of the four-axis product.'),
  call('sqrt',[call('mul',[input('growth'),input('novelty'),input('openness'),input('balance')])]),
  [],[],10,'EMPIRICAL_POLICY'
);
var VITALITY_TRAJECTORY=makeRecord(
  'vitality.trajectory','Vitality trajectory','COMPOSITE',
  [
    port('growth','Growth',0,1,'Connected growth axis.'),
    port('novelty','Novelty',0,1,'Non-repetition axis.'),
    port('openness','Openness',0,1,'Continuation openness axis.'),
    port('balance','RingBalance',0,1,'Ring balance axis.'),
    port('previousVitality','PolicyScore',0,1,'Previous deterministic vitality snapshot.')
  ],
  port('trajectory','PolicyScore',0,1,'Mean of current and previous deterministic vitality.'),
  call('div',[
    call('add',[
      formulaNode(VITALITY_SNAPSHOT,{growth:input('growth'),novelty:input('novelty'),openness:input('openness'),balance:input('balance')}),
      input('previousVitality')
    ]),
    literal(2)
  ]),
  [dependency(VITALITY_SNAPSHOT,{growth:'growth',novelty:'novelty',openness:'openness',balance:'balance'})],
  [],48,'EMPIRICAL_POLICY'
);

var DEFAULT_RECORDS=freeze([
  RING_BALANCE,
  PRESSURE_CLOSURE,
  PRESSURE_EDGE,
  PRESSURE_FORWARD,
  PRESSURE_REVERSE,
  PRESSURE_TOTAL,
  PRESSURE_PARTITION,
  PRESSURE_DIRECTION,
  PRESSURE_MARGIN,
  VITALITY_SNAPSHOT,
  VITALITY_TRAJECTORY
]);
var DEFAULT_REGISTRY=createRegistry(DEFAULT_RECORDS);

global.MRDP78FormulaRegistry=freeze({
  version:VERSION,
  schema:REGISTRY_SCHEMA,
  formulaSchema:FORMULA_SCHEMA,
  status:'READY',
  evidence:'STRUCTURAL',
  soundness:'NOT_COMPUTED',
  semanticTruth:false,
  errorCodes:ERROR_CODES,
  operations:OPERATIONS,
  dimensionKeys:DIMENSION_KEYS,
  dimensionless:ZERO_DIMENSION,
  records:DEFAULT_REGISTRY.records,
  registry:DEFAULT_REGISTRY,
  defaultRegistry:DEFAULT_REGISTRY,
  registryHash:DEFAULT_REGISTRY.registryHash,
  computeRecordHash:computeRecordHash,
  computeRegistryHash:computeRegistryHash,
  createRegistry:createRegistry,
  verifyRegistry:verifyRegistry,
  getFormula:getFormula,
  activeFormulas:activeFormulas,
  formulaRef:formulaRef,
  normalizeFormulaId:normalizeFormulaId
});
})(typeof globalThis!=='undefined'?globalThis:this);
