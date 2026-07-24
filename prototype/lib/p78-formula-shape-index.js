(function(global){
'use strict';

var VERSION='1.0.0';
var SIGNATURE_SCHEMA='meridian.formula-shape/1';
var INDEX_SCHEMA='meridian.formula-shape-index/1';
var MANIFEST_SCHEMA='meridian.index-manifest/1';
var QUERY_SCHEMA='meridian.formula-shape-query/1';
var SEARCH_SCHEMA='meridian.formula-shape-search/1';
var HIT_SCHEMA='meridian.formula-shape-hit/1';
var Canonical=global.MRDP78CanonicalJSON||global.MRDP78CanonicalJson;
var Registry=global.MRDP78FormulaRegistry;

if(!Canonical||!Registry||Registry.status!=='READY'){
  global.MRDP78FormulaShapeIndex=Object.freeze({version:VERSION,status:'INVALID',code:'FORMULA_REGISTRY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var hasOwn=Object.prototype.hasOwnProperty;
var VALUE_TYPES=freeze({Real:true,Int:true,Bool:true,Tuple:true});
var AST_NODES=freeze({Literal:true,Input:true,Let:true,Call:true,Tuple:true,If:true,FormulaRef:true});
var LITERAL_KINDS=freeze({NUMBER_INTEGER:true,NUMBER_REAL:true,BOOLEAN:true,STRING:true});
var ERROR_CODES=freeze({
  REGISTRY_INVALID:'REGISTRY_INVALID',
  STALE_REGISTRY:'STALE_REGISTRY',
  STALE_INDEX:'STALE_INDEX',
  INDEX_INVALID:'INDEX_INVALID',
  INDEX_HASH_MISMATCH:'INDEX_HASH_MISMATCH',
  SHAPE_HASH_MISMATCH:'SHAPE_HASH_MISMATCH',
  SOURCE_HASH_MISMATCH:'SOURCE_HASH_MISMATCH',
  AST_INVALID:'AST_INVALID',
  UNKNOWN_AST_NODE:'UNKNOWN_AST_NODE',
  UNKNOWN_QUERY_FIELD:'UNKNOWN_QUERY_FIELD',
  UNKNOWN_TYPE:'UNKNOWN_TYPE',
  UNKNOWN_OPERATION:'UNKNOWN_OPERATION',
  QUERY_INVALID:'QUERY_INVALID',
  QUERY_HASH_MISMATCH:'QUERY_HASH_MISMATCH',
  CYCLE_DETECTED:'CYCLE_DETECTED',
  DEPENDENCY_CYCLE:'DEPENDENCY_CYCLE',
  BUDGET_EXCEEDED:'BUDGET_EXCEEDED',
  NO_MATCH:'NO_MATCH'
});

function Fault(code,status,message,path,details){
  this.name='P78FormulaShapeFault';
  this.code=code;
  this.status=status;
  this.message=message||code;
  this.path=path||'$';
  this.details=details||{};
}

function fail(code,status,message,path,details){ throw new Fault(code,status,message,path,details); }
function isObject(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function isSemVer(value){ return typeof value==='string'&&/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value); }
function merge(target,source){ Object.keys(source).forEach(function(key){ target[key]=source[key]; }); return target; }
function evidenceFields(){ return {evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED',semanticTruth:false}; }
function errorRecord(error){ return {code:error.code||ERROR_CODES.INDEX_INVALID,path:error.path||'$',message:error.message||String(error),details:error.details||{}}; }

function mappedError(error,fallback){
  var code=error&&error.code||fallback;
  if(code==='CYCLIC_VALUE'||code==='CYCLE_DETECTED') code=ERROR_CODES.CYCLE_DETECTED;
  if(code===Registry.errorCodes.DEPENDENCY_CYCLE) code=ERROR_CODES.DEPENDENCY_CYCLE;
  return new Fault(code,error&&error.status||'INVALID',error&&error.message||code,error&&error.path||'$',error&&error.details||{});
}

function outcome(status,code,error,extra){
  return freeze(merge({
    schema:'meridian.formula-shape-outcome/1',
    version:VERSION,
    status:status,
    code:code||null,
    errors:error?[errorRecord(error)]:[]
  },merge(evidenceFields(),extra||{})));
}

function assertKnownFields(value,allowed,code,path){
  var keys,i;
  if(!isObject(value)) fail(code,'INVALID','object required',path);
  keys=Object.keys(value);
  for(i=0;i<keys.length;i++) if(!allowed[keys[i]]) fail(code,'INVALID','unknown field '+keys[i],path+'.'+keys[i]);
}

function copyData(value,path){
  try{ return Canonical.deepCopy(value); }
  catch(error){ throw mappedError(error,ERROR_CODES.INDEX_INVALID); }
}

function omitOwn(value,key){
  var result={},keys=Object.keys(value),i,name;
  for(i=0;i<keys.length;i++){
    name=keys[i];
    if(name!==key) result[name]=value[name];
  }
  return result;
}

function canonicalCompare(left,right){
  var a=Canonical.canonicalize(left),b=Canonical.canonicalize(right);
  return a<b?-1:(a>b?1:0);
}

function sortedObject(source){
  var result={},keys=Object.keys(source).sort(),i;
  for(i=0;i<keys.length;i++) result[keys[i]]=source[keys[i]];
  return result;
}

function typeShape(port){
  return {
    valueType:port.valueType,
    unit:port.unit,
    dimension:copyData(port.dimension,'$.dimension'),
    measureKind:port.measureKind,
    interval:port.interval===null?null:copyData(port.interval,'$.interval')
  };
}

function typeUnitKey(type){ return type.valueType+'|'+type.unit; }
function dependencyKey(ref){ return ref.formulaId; }
function formulaRef(record){ return {formulaId:record.formulaId,version:record.version,contentHash:record.contentHash}; }

function literalKind(value){
  if(typeof value==='number') return Number.isInteger(value)?'NUMBER_INTEGER':'NUMBER_REAL';
  if(typeof value==='boolean') return 'BOOLEAN';
  if(typeof value==='string') return 'STRING';
  fail(ERROR_CODES.AST_INVALID,'INVALID','unsupported literal value','$.expression.value');
}

function createBudget(options,defaultOperations){
  var maxOperations=options&&options.maxOperations!==undefined?options.maxOperations:defaultOperations;
  var maxDepth=options&&options.maxDepth!==undefined?options.maxDepth:64;
  if(!Number.isInteger(maxOperations)||maxOperations<0) fail(ERROR_CODES.BUDGET_EXCEEDED,'ABSTAIN','maxOperations must be a non-negative integer','$.options.maxOperations');
  if(!Number.isInteger(maxDepth)||maxDepth<1) fail(ERROR_CODES.BUDGET_EXCEEDED,'ABSTAIN','maxDepth must be a positive integer','$.options.maxDepth');
  return {operations:0,maxOperations:maxOperations,maxDepth:maxDepth};
}

function consume(budget,path,depth){
  if(depth>budget.maxDepth) fail(ERROR_CODES.BUDGET_EXCEEDED,'ABSTAIN','maximum depth exceeded',path,{maxDepth:budget.maxDepth});
  budget.operations++;
  if(budget.operations>budget.maxOperations) fail(ERROR_CODES.BUDGET_EXCEEDED,'ABSTAIN','maximum operation budget exceeded',path,{maxOperations:budget.maxOperations});
}

function inspectAst(expression,budget){
  var operationCounts={},operationPaths=[],literalKinds=[],ancestors=[];
  function visit(node,path,depth){
    var i,keys;
    consume(budget,path,depth);
    if(!isObject(node)||typeof node.node!=='string') fail(ERROR_CODES.AST_INVALID,'INVALID','AST node required',path);
    if(!AST_NODES[node.node]) fail(ERROR_CODES.UNKNOWN_AST_NODE,'INVALID','unknown AST node '+node.node,path+'.node');
    if(ancestors.indexOf(node)!==-1) fail(ERROR_CODES.CYCLE_DETECTED,'INVALID','AST cycle detected',path);
    ancestors.push(node);
    if(node.node==='Literal'){
      literalKinds.push(literalKind(node.value));
    }else if(node.node==='Input'){
      if(typeof node.port!=='string'||!node.port) fail(ERROR_CODES.AST_INVALID,'INVALID','input port required',path+'.port');
    }else if(node.node==='Let'){
      visit(node.value,path+'.value',depth+1);
      visit(node.body,path+'.body',depth+1);
    }else if(node.node==='Call'){
      if(!Registry.operations[node.operation]) fail(ERROR_CODES.UNKNOWN_OPERATION,'INVALID','unknown operation '+node.operation,path+'.operation');
      if(!Array.isArray(node.args)) fail(ERROR_CODES.AST_INVALID,'INVALID','call args required',path+'.args');
      operationCounts[node.operation]=(operationCounts[node.operation]||0)+1;
      operationPaths.push(path+':'+node.operation);
      for(i=0;i<node.args.length;i++) visit(node.args[i],path+'.args['+i+']',depth+1);
    }else if(node.node==='Tuple'){
      if(!Array.isArray(node.items)) fail(ERROR_CODES.AST_INVALID,'INVALID','tuple items required',path+'.items');
      for(i=0;i<node.items.length;i++) visit(node.items[i],path+'.items['+i+']',depth+1);
    }else if(node.node==='If'){
      visit(node.test,path+'.test',depth+1);
      visit(node.then,path+'.then',depth+1);
      visit(node.else,path+'.else',depth+1);
    }else if(node.node==='FormulaRef'){
      if(!isObject(node.bindings)) fail(ERROR_CODES.AST_INVALID,'INVALID','FormulaRef bindings required',path+'.bindings');
      keys=Object.keys(node.bindings).sort();
      for(i=0;i<keys.length;i++) visit(node.bindings[keys[i]],path+'.bindings.'+keys[i],depth+1);
    }
    ancestors.pop();
  }
  visit(expression,'$.expression',0);
  return {
    operationMultiset:sortedObject(operationCounts),
    operationPaths:operationPaths.sort(),
    literalKinds:literalKinds.sort()
  };
}

function buildSignature(record,budget){
  var inspected,dependencies,assumptions,payload;
  if(!isObject(record)||record.schema!==Registry.formulaSchema) fail(ERROR_CODES.INDEX_INVALID,'INVALID','formula record schema mismatch','$.record');
  if(!Canonical.isSha256(record.contentHash)) fail(ERROR_CODES.SOURCE_HASH_MISMATCH,'INVALID','formula source hash missing','$.record.contentHash');
  if(Registry.computeRecordHash(record)!==record.contentHash) fail(ERROR_CODES.SOURCE_HASH_MISMATCH,'INVALID','formula source hash mismatch','$.record.contentHash');
  inspected=inspectAst(record.expression,budget);
  dependencies=record.dependencies.map(function(dependency){ return copyData(dependency.formula,'$.dependency'); }).sort(canonicalCompare);
  assumptions=(record.contract.pre||[]).map(function(item){ return copyData(item,'$.assumption'); }).sort(canonicalCompare);
  payload={
    schema:SIGNATURE_SCHEMA,
    version:VERSION,
    formulaRef:formulaRef(record),
    sourceHash:record.contentHash,
    rootNode:record.expression.node,
    operationMultiset:inspected.operationMultiset,
    operationPaths:inspected.operationPaths,
    inputTypes:record.inputs.map(typeShape),
    outputType:typeShape(record.output),
    dependencyRefs:dependencies,
    literalKinds:inspected.literalKinds,
    assumptions:assumptions
  };
  payload.shapeHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}

function createSignature(record,options){
  var copied,budget,signature;
  try{
    copied=copyData(record,'$.record');
    budget=createBudget(options,4096);
    signature=buildSignature(copied,budget);
    return outcome('READY',null,null,{signature:signature,operations:budget.operations,sourceHash:signature.sourceHash,shapeHash:signature.shapeHash});
  }catch(error){
    error=mappedError(error,ERROR_CODES.INDEX_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{signature:null,operations:budget?budget.operations:0,sourceHash:null,shapeHash:null});
  }
}

var SIGNATURE_FIELDS=freeze({schema:true,version:true,formulaRef:true,sourceHash:true,rootNode:true,operationMultiset:true,operationPaths:true,inputTypes:true,outputType:true,dependencyRefs:true,literalKinds:true,assumptions:true,shapeHash:true});
function verifySignature(signature){
  var copied,expected;
  try{
    copied=copyData(signature,'$.signature');
    assertKnownFields(copied,SIGNATURE_FIELDS,ERROR_CODES.INDEX_INVALID,'$.signature');
    if(copied.schema!==SIGNATURE_SCHEMA||copied.version!==VERSION) fail(ERROR_CODES.INDEX_INVALID,'INVALID','signature schema/version mismatch','$.signature');
    if(!isObject(copied.formulaRef)||copied.sourceHash!==copied.formulaRef.contentHash||!Canonical.isSha256(copied.sourceHash)) fail(ERROR_CODES.SOURCE_HASH_MISMATCH,'INVALID','signature source hash mismatch','$.signature.sourceHash');
    if(!AST_NODES[copied.rootNode]||!isObject(copied.operationMultiset)||!Array.isArray(copied.operationPaths)||!Array.isArray(copied.inputTypes)||!isObject(copied.outputType)||!Array.isArray(copied.dependencyRefs)||!Array.isArray(copied.literalKinds)||!Array.isArray(copied.assumptions)) fail(ERROR_CODES.INDEX_INVALID,'INVALID','signature fields invalid','$.signature');
    expected=Canonical.hashCanonical(omitOwn(copied,'shapeHash'));
    if(!Canonical.isSha256(copied.shapeHash)||copied.shapeHash!==expected) fail(ERROR_CODES.SHAPE_HASH_MISMATCH,'INVALID','shape hash mismatch','$.signature.shapeHash');
    return outcome('READY',null,null,{signature:freeze(copied),shapeHash:copied.shapeHash,sourceHash:copied.sourceHash});
  }catch(error){
    error=mappedError(error,ERROR_CODES.INDEX_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{signature:null,shapeHash:null,sourceHash:null});
  }
}

function pushMap(map,key,value){
  if(!hasOwn.call(map,key)) Object.defineProperty(map,key,{value:[],enumerable:true,writable:true,configurable:true});
  if(map[key].indexOf(value)===-1) map[key].push(value);
}

function sortMap(map){
  var result={},keys=Object.keys(map).sort(),i,key;
  for(i=0;i<keys.length;i++){
    key=keys[i];
    result[key]=map[key].slice().sort();
  }
  return result;
}

function buildMaps(signatures){
  var maps={byFormulaId:{},byOperation:{},byInputTypeUnit:{},byOutputTypeUnit:{},byDependency:{},byShapeHash:{}},i,j,signature,operations;
  for(i=0;i<signatures.length;i++){
    signature=signatures[i];
    pushMap(maps.byFormulaId,signature.formulaRef.formulaId,signature.shapeHash);
    pushMap(maps.byShapeHash,signature.shapeHash,signature.shapeHash);
    operations=Object.keys(signature.operationMultiset).sort();
    for(j=0;j<operations.length;j++) pushMap(maps.byOperation,operations[j],signature.shapeHash);
    for(j=0;j<signature.inputTypes.length;j++) pushMap(maps.byInputTypeUnit,typeUnitKey(signature.inputTypes[j]),signature.shapeHash);
    pushMap(maps.byOutputTypeUnit,typeUnitKey(signature.outputType),signature.shapeHash);
    for(j=0;j<signature.dependencyRefs.length;j++) pushMap(maps.byDependency,dependencyKey(signature.dependencyRefs[j]),signature.shapeHash);
  }
  return {
    byFormulaId:sortMap(maps.byFormulaId),
    byOperation:sortMap(maps.byOperation),
    byInputTypeUnit:sortMap(maps.byInputTypeUnit),
    byOutputTypeUnit:sortMap(maps.byOutputTypeUnit),
    byDependency:sortMap(maps.byDependency),
    byShapeHash:sortMap(maps.byShapeHash)
  };
}

function createManifest(sourceSetHash,recordCount){
  var manifest={
    schema:MANIFEST_SCHEMA,
    indexId:'p78-formula-shape-index',
    indexType:'FORMULA_AST_SHAPE',
    version:VERSION,
    sourceSetHash:sourceSetHash,
    normalizationPolicyVersion:'formula-shape-v1',
    recordCount:recordCount
  };
  manifest.contentHash=Canonical.hashCanonical(manifest);
  return freeze(manifest);
}

function verifyRegistrySnapshot(source,expectedHash){
  var checked=Registry.verifyRegistry(source);
  if(checked.status!=='READY'){
    var code=checked.code===Registry.errorCodes.DEPENDENCY_CYCLE?ERROR_CODES.DEPENDENCY_CYCLE:ERROR_CODES.REGISTRY_INVALID;
    fail(code,'INVALID','registry verification failed','$.registry',{errors:checked.errors});
  }
  if(expectedHash!==undefined&&expectedHash!==checked.registry.registryHash) fail(ERROR_CODES.STALE_REGISTRY,'INVALID','registry hash is stale','$.expectedRegistryHash',{expected:expectedHash,actual:checked.registry.registryHash});
  return checked.registry;
}

function buildIndex(sourceRegistry,options){
  var registry,budget,records,signatures,sourceSetHash,manifest,payload;
  try{
    registry=verifyRegistrySnapshot(sourceRegistry||Registry.registry,options&&options.expectedRegistryHash);
    budget=createBudget(options,65536);
    records=Registry.activeFormulas(registry).slice().sort(function(a,b){ return (a.formulaId+'@'+a.version).localeCompare(b.formulaId+'@'+b.version); });
    signatures=records.map(function(record){ return buildSignature(record,budget); });
    sourceSetHash=Canonical.hashCanonical(signatures.map(function(signature){ return {formulaRef:signature.formulaRef,sourceHash:signature.sourceHash}; }));
    manifest=createManifest(sourceSetHash,signatures.length);
    payload=merge({
      schema:INDEX_SCHEMA,
      version:VERSION,
      indexId:'p78-formula-shape-index',
      status:'READY',
      sourceSetHash:sourceSetHash,
      registryHash:registry.registryHash,
      normalizationPolicyVersion:'formula-shape-v1',
      recordCount:signatures.length,
      manifest:manifest,
      signatures:signatures,
      indexes:buildMaps(signatures),
      operations:budget.operations
    },evidenceFields());
    payload.indexHash=Canonical.hashCanonical(payload);
    if(options&&options.expectedIndexHash!==undefined&&options.expectedIndexHash!==payload.indexHash) fail(ERROR_CODES.STALE_INDEX,'INVALID','index hash is stale','$.expectedIndexHash',{expected:options.expectedIndexHash,actual:payload.indexHash});
    return freeze(payload);
  }catch(error){
    error=mappedError(error,ERROR_CODES.INDEX_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{
      indexHash:null,
      registryHash:registry?registry.registryHash:null,
      sourceSetHash:null,
      recordCount:0,
      signatures:[],
      operations:budget?budget.operations:0
    });
  }
}

var INDEX_FIELDS=freeze({schema:true,version:true,indexId:true,status:true,sourceSetHash:true,registryHash:true,normalizationPolicyVersion:true,recordCount:true,manifest:true,signatures:true,indexes:true,operations:true,evidence:true,evidenceLevel:true,soundness:true,semanticTruth:true,indexHash:true});
function verifyIndex(index,options){
  var copied,expected,sourceSetHash,maps,i,verified,manifestPayload;
  try{
    copied=copyData(index,'$.index');
    assertKnownFields(copied,INDEX_FIELDS,ERROR_CODES.INDEX_INVALID,'$.index');
    if(copied.schema!==INDEX_SCHEMA||copied.version!==VERSION||copied.status!=='READY') fail(ERROR_CODES.INDEX_INVALID,'INVALID','index schema/version/status mismatch','$.index');
    expected=Canonical.hashCanonical(omitOwn(copied,'indexHash'));
    if(!Canonical.isSha256(copied.indexHash)||copied.indexHash!==expected) fail(ERROR_CODES.INDEX_HASH_MISMATCH,'INVALID','index hash mismatch','$.index.indexHash');
    if(copied.registryHash!==(options&&options.expectedRegistryHash||Registry.registryHash)) fail(ERROR_CODES.STALE_REGISTRY,'INVALID','index registry hash is stale','$.index.registryHash',{expected:options&&options.expectedRegistryHash||Registry.registryHash,actual:copied.registryHash});
    if(options&&options.expectedIndexHash!==undefined&&copied.indexHash!==options.expectedIndexHash) fail(ERROR_CODES.STALE_INDEX,'INVALID','unexpected index hash','$.index.indexHash');
    if(!Array.isArray(copied.signatures)||copied.recordCount!==copied.signatures.length) fail(ERROR_CODES.INDEX_INVALID,'INVALID','record count mismatch','$.index.recordCount');
    for(i=0;i<copied.signatures.length;i++){
      verified=verifySignature(copied.signatures[i]);
      if(verified.status!=='READY') fail(verified.code,'INVALID','invalid signature','$.index.signatures['+i+']',{errors:verified.errors});
    }
    sourceSetHash=Canonical.hashCanonical(copied.signatures.map(function(signature){ return {formulaRef:signature.formulaRef,sourceHash:signature.sourceHash}; }));
    if(sourceSetHash!==copied.sourceSetHash) fail(ERROR_CODES.SOURCE_HASH_MISMATCH,'INVALID','source set hash mismatch','$.index.sourceSetHash');
    maps=buildMaps(copied.signatures);
    if(Canonical.canonicalize(maps)!==Canonical.canonicalize(copied.indexes)) fail(ERROR_CODES.INDEX_INVALID,'INVALID','index maps do not match signatures','$.index.indexes');
    manifestPayload=omitOwn(copied.manifest,'contentHash');
    if(copied.manifest.schema!==MANIFEST_SCHEMA||copied.manifest.sourceSetHash!==copied.sourceSetHash||copied.manifest.recordCount!==copied.recordCount||Canonical.hashCanonical(manifestPayload)!==copied.manifest.contentHash) fail(ERROR_CODES.INDEX_INVALID,'INVALID','manifest mismatch','$.index.manifest');
    return outcome('READY',null,null,{index:freeze(copied),indexHash:copied.indexHash,registryHash:copied.registryHash,sourceSetHash:copied.sourceSetHash,recordCount:copied.recordCount});
  }catch(error){
    error=mappedError(error,ERROR_CODES.INDEX_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{index:null,indexHash:null,registryHash:null,sourceSetHash:null,recordCount:0});
  }
}

var QUERY_FIELDS=freeze({schema:true,version:true,formulaId:true,operation:true,inputType:true,outputType:true,dependency:true,exactShapeHash:true,expectedRegistryHash:true,expectedIndexHash:true,maxResults:true,queryHash:true});
var TYPE_FILTER_FIELDS=freeze({valueType:true,unit:true,measureKind:true});
var DEPENDENCY_FILTER_FIELDS=freeze({formulaId:true,version:true,contentHash:true});

function normalizeTypeFilter(value,path){
  assertKnownFields(value,TYPE_FILTER_FIELDS,ERROR_CODES.UNKNOWN_QUERY_FIELD,path);
  if(!VALUE_TYPES[value.valueType]) fail(ERROR_CODES.UNKNOWN_TYPE,'INVALID','unknown valueType '+value.valueType,path+'.valueType');
  if(typeof value.unit!=='string'||!value.unit) fail(ERROR_CODES.QUERY_INVALID,'INVALID','unit required',path+'.unit');
  if(value.measureKind!==undefined&&(typeof value.measureKind!=='string'||!value.measureKind)) fail(ERROR_CODES.QUERY_INVALID,'INVALID','measureKind invalid',path+'.measureKind');
  var result={valueType:value.valueType,unit:value.unit};
  if(value.measureKind!==undefined) result.measureKind=value.measureKind;
  return result;
}

function normalizeDependencyFilter(value,path){
  assertKnownFields(value,DEPENDENCY_FILTER_FIELDS,ERROR_CODES.UNKNOWN_QUERY_FIELD,path);
  if(typeof value.formulaId!=='string'||!value.formulaId) fail(ERROR_CODES.QUERY_INVALID,'INVALID','dependency formulaId required',path+'.formulaId');
  var result={formulaId:Registry.normalizeFormulaId(value.formulaId)};
  if(value.version!==undefined){ if(!isSemVer(value.version)) fail(ERROR_CODES.QUERY_INVALID,'INVALID','dependency version invalid',path+'.version'); result.version=value.version; }
  if(value.contentHash!==undefined){ if(!Canonical.isSha256(value.contentHash)) fail(ERROR_CODES.QUERY_INVALID,'INVALID','dependency hash invalid',path+'.contentHash'); result.contentHash=value.contentHash; }
  return result;
}

function compileQuery(draft){
  var source,query,providedHash,selectorCount=0;
  try{
    source=copyData(draft,'$.query');
    assertKnownFields(source,QUERY_FIELDS,ERROR_CODES.UNKNOWN_QUERY_FIELD,'$.query');
    if(source.schema!==undefined&&source.schema!==QUERY_SCHEMA) fail(ERROR_CODES.QUERY_INVALID,'INVALID','query schema mismatch','$.query.schema');
    if(source.version!==undefined&&source.version!==VERSION) fail(ERROR_CODES.QUERY_INVALID,'INVALID','query version mismatch','$.query.version');
    query={schema:QUERY_SCHEMA,version:VERSION};
    if(source.formulaId!==undefined){ if(typeof source.formulaId!=='string'||!source.formulaId) fail(ERROR_CODES.QUERY_INVALID,'INVALID','formulaId invalid','$.query.formulaId'); query.formulaId=Registry.normalizeFormulaId(source.formulaId); selectorCount++; }
    if(source.operation!==undefined){ if(!Registry.operations[source.operation]) fail(ERROR_CODES.UNKNOWN_OPERATION,'INVALID','unknown operation '+source.operation,'$.query.operation'); query.operation=source.operation; selectorCount++; }
    if(source.inputType!==undefined){ query.inputType=normalizeTypeFilter(source.inputType,'$.query.inputType'); selectorCount++; }
    if(source.outputType!==undefined){ query.outputType=normalizeTypeFilter(source.outputType,'$.query.outputType'); selectorCount++; }
    if(source.dependency!==undefined){ query.dependency=normalizeDependencyFilter(source.dependency,'$.query.dependency'); selectorCount++; }
    if(source.exactShapeHash!==undefined){ if(!Canonical.isSha256(source.exactShapeHash)) fail(ERROR_CODES.QUERY_INVALID,'INVALID','exact shape hash invalid','$.query.exactShapeHash'); query.exactShapeHash=source.exactShapeHash; selectorCount++; }
    if(!selectorCount) fail(ERROR_CODES.QUERY_INVALID,'INVALID','at least one selector required','$.query');
    if(source.expectedRegistryHash!==undefined){ if(!Canonical.isSha256(source.expectedRegistryHash)) fail(ERROR_CODES.QUERY_INVALID,'INVALID','expected registry hash invalid','$.query.expectedRegistryHash'); query.expectedRegistryHash=source.expectedRegistryHash; }
    if(source.expectedIndexHash!==undefined){ if(!Canonical.isSha256(source.expectedIndexHash)) fail(ERROR_CODES.QUERY_INVALID,'INVALID','expected index hash invalid','$.query.expectedIndexHash'); query.expectedIndexHash=source.expectedIndexHash; }
    if(source.maxResults!==undefined){ if(!Number.isInteger(source.maxResults)||source.maxResults<1) fail(ERROR_CODES.QUERY_INVALID,'INVALID','maxResults must be positive','$.query.maxResults'); query.maxResults=source.maxResults; }
    providedHash=source.queryHash;
    query.queryHash=Canonical.hashCanonical(query);
    if(providedHash!==undefined&&providedHash!==query.queryHash) fail(ERROR_CODES.QUERY_HASH_MISMATCH,'INVALID','query hash mismatch','$.query.queryHash');
    return outcome('READY',null,null,{query:freeze(query),queryHash:query.queryHash});
  }catch(error){
    error=mappedError(error,ERROR_CODES.QUERY_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{query:null,queryHash:null});
  }
}

function intersect(left,right){
  if(left===null) return right.slice();
  return left.filter(function(value){ return right.indexOf(value)!==-1; });
}

function typeFilterMatch(type,filter){ return type.valueType===filter.valueType&&type.unit===filter.unit&&(filter.measureKind===undefined||type.measureKind===filter.measureKind); }
function dependencyFilterMatch(ref,filter){ return ref.formulaId===filter.formulaId&&(filter.version===undefined||ref.version===filter.version)&&(filter.contentHash===undefined||ref.contentHash===filter.contentHash); }

function matchesQuery(signature,query,budget){
  var i,matched=[];
  consume(budget,'$.search.candidate.'+signature.formulaRef.formulaId,0);
  if(query.formulaId!==undefined){ if(signature.formulaRef.formulaId!==query.formulaId) return null; matched.push('FORMULA_ID'); }
  if(query.operation!==undefined){ if(!hasOwn.call(signature.operationMultiset,query.operation)) return null; matched.push('OPERATION'); }
  if(query.inputType!==undefined){
    for(i=0;i<signature.inputTypes.length;i++) if(typeFilterMatch(signature.inputTypes[i],query.inputType)) break;
    if(i===signature.inputTypes.length) return null;
    matched.push('INPUT_TYPE_UNIT');
  }
  if(query.outputType!==undefined){ if(!typeFilterMatch(signature.outputType,query.outputType)) return null; matched.push('OUTPUT_TYPE_UNIT'); }
  if(query.dependency!==undefined){
    for(i=0;i<signature.dependencyRefs.length;i++) if(dependencyFilterMatch(signature.dependencyRefs[i],query.dependency)) break;
    if(i===signature.dependencyRefs.length) return null;
    matched.push('DEPENDENCY');
  }
  if(query.exactShapeHash!==undefined){ if(signature.shapeHash!==query.exactShapeHash) return null; matched.push('EXACT_SHAPE'); }
  return matched;
}

function hitFor(signature,index,query,matchedBy){
  var hit=merge({
    schema:HIT_SCHEMA,
    version:VERSION,
    status:'LOCATED',
    formulaRef:signature.formulaRef,
    sourceHash:signature.sourceHash,
    shapeHash:signature.shapeHash,
    matchedBy:matchedBy,
    sourceSetHash:index.sourceSetHash,
    registryHash:index.registryHash,
    indexHash:index.indexHash,
    queryHash:query.queryHash
  },evidenceFields());
  hit.hitHash=Canonical.hashCanonical(hit);
  return freeze(hit);
}

function search(first,second,third){
  var index,rawQuery,options,checked,compiled,query,budget,candidateHashes=null,signaturesByHash={},signatures,hits=[],visited=[],i,signature,matched,maxResults,trace,result;
  if(isObject(first)&&first.schema===INDEX_SCHEMA){ index=first; rawQuery=second; options=third||{}; }
  else{ index=DEFAULT_INDEX; rawQuery=first; options=second||{}; }
  try{
    checked=verifyIndex(index,{expectedRegistryHash:rawQuery&&rawQuery.expectedRegistryHash||options.expectedRegistryHash,expectedIndexHash:rawQuery&&rawQuery.expectedIndexHash||options.expectedIndexHash});
    if(checked.status!=='READY') fail(checked.code,checked.status,'index verification failed','$.index',{errors:checked.errors});
    index=checked.index;
    compiled=rawQuery&&rawQuery.status==='READY'&&rawQuery.query?rawQuery:compileQuery(rawQuery);
    if(compiled.status!=='READY') fail(compiled.code,compiled.status,'query compilation failed','$.query',{errors:compiled.errors});
    query=compiled.query;
    if(query.expectedRegistryHash!==undefined&&query.expectedRegistryHash!==index.registryHash) fail(ERROR_CODES.STALE_REGISTRY,'INVALID','query registry hash is stale','$.query.expectedRegistryHash');
    if(query.expectedIndexHash!==undefined&&query.expectedIndexHash!==index.indexHash) fail(ERROR_CODES.STALE_INDEX,'INVALID','query index hash is stale','$.query.expectedIndexHash');
    budget=createBudget(options,4096);
    if(query.formulaId!==undefined) candidateHashes=intersect(candidateHashes,index.indexes.byFormulaId[query.formulaId]||[]);
    if(query.operation!==undefined) candidateHashes=intersect(candidateHashes,index.indexes.byOperation[query.operation]||[]);
    if(query.inputType!==undefined) candidateHashes=intersect(candidateHashes,index.indexes.byInputTypeUnit[typeUnitKey(query.inputType)]||[]);
    if(query.outputType!==undefined) candidateHashes=intersect(candidateHashes,index.indexes.byOutputTypeUnit[typeUnitKey(query.outputType)]||[]);
    if(query.dependency!==undefined) candidateHashes=intersect(candidateHashes,index.indexes.byDependency[query.dependency.formulaId]||[]);
    if(query.exactShapeHash!==undefined) candidateHashes=intersect(candidateHashes,index.indexes.byShapeHash[query.exactShapeHash]||[]);
    index.signatures.forEach(function(item){ signaturesByHash[item.shapeHash]=item; });
    candidateHashes=(candidateHashes||index.signatures.map(function(item){ return item.shapeHash; })).slice().sort();
    signatures=candidateHashes.map(function(hash){ return signaturesByHash[hash]; }).filter(Boolean).sort(function(a,b){ return (a.formulaRef.formulaId+'@'+a.formulaRef.version).localeCompare(b.formulaRef.formulaId+'@'+b.formulaRef.version); });
    for(i=0;i<signatures.length;i++){
      signature=signatures[i]; visited.push(signature.shapeHash);
      matched=matchesQuery(signature,query,budget);
      if(matched) hits.push(hitFor(signature,index,query,matched));
    }
    maxResults=query.maxResults||hits.length;
    hits=hits.slice(0,maxResults);
    trace={schema:'meridian.formula-shape-search-trace/1',version:VERSION,sourceSetHash:index.sourceSetHash,registryHash:index.registryHash,indexHash:index.indexHash,queryHash:query.queryHash,visitedShapeHashes:visited,operations:budget.operations,maxOperations:budget.maxOperations,deterministic:true};
    trace.traceHash=Canonical.hashCanonical(trace);
    result=merge({schema:SEARCH_SCHEMA,version:VERSION,status:hits.length?'READY':'ABSTAIN',code:hits.length?null:ERROR_CODES.NO_MATCH,sourceSetHash:index.sourceSetHash,registryHash:index.registryHash,indexHash:index.indexHash,queryHash:query.queryHash,hits:hits,trace:trace,errors:[]},evidenceFields());
    return freeze(result);
  }catch(error){
    error=mappedError(error,ERROR_CODES.INDEX_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{sourceSetHash:index&&index.sourceSetHash||null,registryHash:index&&index.registryHash||null,indexHash:index&&index.indexHash||null,queryHash:query&&query.queryHash||null,hits:[],trace:null,operations:budget?budget.operations:0});
  }
}

function queryAndSearch(criteria,options){
  var compiled=compileQuery(criteria);
  return compiled.status==='READY'?search(compiled,options):compiled;
}
function findExact(shapeHash,options){ return queryAndSearch({exactShapeHash:shapeHash},options); }
function findByOperation(operation,options){ return queryAndSearch({operation:operation},options); }
function findByFormulaId(formulaId,options){ return queryAndSearch({formulaId:formulaId},options); }
function findByInputType(valueType,unit,measureKind,options){
  var filter={valueType:valueType,unit:unit};
  if(measureKind!==undefined&&measureKind!==null) filter.measureKind=measureKind;
  return queryAndSearch({inputType:filter},options);
}
function findByOutputType(valueType,unit,measureKind,options){
  var filter={valueType:valueType,unit:unit};
  if(measureKind!==undefined&&measureKind!==null) filter.measureKind=measureKind;
  return queryAndSearch({outputType:filter},options);
}
function findByDependency(formulaId,options){ return queryAndSearch({dependency:{formulaId:formulaId}},options); }

var DEFAULT_INDEX=buildIndex(Registry.registry,{expectedRegistryHash:Registry.registryHash});

global.MRDP78FormulaShapeIndex=freeze({
  version:VERSION,
  schema:INDEX_SCHEMA,
  signatureSchema:SIGNATURE_SCHEMA,
  manifestSchema:MANIFEST_SCHEMA,
  querySchema:QUERY_SCHEMA,
  searchSchema:SEARCH_SCHEMA,
  hitSchema:HIT_SCHEMA,
  status:DEFAULT_INDEX.status,
  code:DEFAULT_INDEX.code||null,
  evidence:'STRUCTURAL',
  evidenceLevel:'STRUCTURAL',
  soundness:'NOT_COMPUTED',
  semanticTruth:false,
  maximumClaim:'STRUCTURAL_ONLY',
  errorCodes:ERROR_CODES,
  literalKinds:LITERAL_KINDS,
  defaultIndex:DEFAULT_INDEX,
  index:DEFAULT_INDEX,
  signatures:DEFAULT_INDEX.signatures||freeze([]),
  sourceSetHash:DEFAULT_INDEX.sourceSetHash||null,
  registryHash:DEFAULT_INDEX.registryHash||null,
  indexHash:DEFAULT_INDEX.indexHash||null,
  createSignature:createSignature,
  verifySignature:verifySignature,
  buildIndex:buildIndex,
  verifyIndex:verifyIndex,
  compileQuery:compileQuery,
  search:search,
  findExact:findExact,
  findByOperation:findByOperation,
  findByFormulaId:findByFormulaId,
  findByInputType:findByInputType,
  findByOutputType:findByOutputType,
  findByDependency:findByDependency,
  typeUnitKey:typeUnitKey
});
})(typeof globalThis!=='undefined'?globalThis:this);
