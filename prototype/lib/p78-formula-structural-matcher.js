(function(global){
'use strict';

var VERSION='1.0.0';
var PATTERN_SCHEMA='meridian.formula-pattern/1';
var PATTERN_REGISTRY_SCHEMA='meridian.formula-pattern-registry/1';
var MATCH_SCHEMA='meridian.structural-match/1';
var BATCH_SCHEMA='meridian.structural-match-batch/1';
var Canonical=global.MRDP78CanonicalJSON||global.MRDP78CanonicalJson;
var Registry=global.MRDP78FormulaRegistry;
var Shape=global.MRDP78FormulaShapeIndex;

if(!Canonical||!Registry||!Shape||Registry.status!=='READY'||Shape.status!=='READY'){
  global.MRDP78FormulaStructuralMatcher=Object.freeze({version:VERSION,status:'INVALID',code:'FORMULA_SHAPE_INDEX_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var hasOwn=Object.prototype.hasOwnProperty;
var VALUE_TYPES=freeze({Real:true,Int:true,Bool:true,Tuple:true});
var ROOT_NODES=freeze({Literal:true,Input:true,Let:true,Call:true,Tuple:true,If:true,FormulaRef:true});
var CONSTRAINT_KINDS=freeze({EXACT_SHAPE:true,FORMULA_ID:true,ROOT_NODE:true,OPERATION:true,INPUT_TYPE_UNIT:true,OUTPUT_TYPE_UNIT:true,DEPENDENCY:true,LITERAL_KIND:true,ASSUMPTION:true});
var ERROR_CODES=freeze({
  PATTERN_INVALID:'PATTERN_INVALID',
  UNKNOWN_PATTERN_FIELD:'UNKNOWN_PATTERN_FIELD',
  UNKNOWN_CONSTRAINT:'UNKNOWN_CONSTRAINT',
  UNKNOWN_OPERATION:'UNKNOWN_OPERATION',
  UNKNOWN_TYPE:'UNKNOWN_TYPE',
  PATTERN_HASH_MISMATCH:'PATTERN_HASH_MISMATCH',
  PATTERN_DUPLICATE:'PATTERN_DUPLICATE',
  PATTERN_REGISTRY_INVALID:'PATTERN_REGISTRY_INVALID',
  PATTERN_SET_HASH_MISMATCH:'PATTERN_SET_HASH_MISMATCH',
  STALE_PATTERN:'STALE_PATTERN',
  STALE_REGISTRY:'STALE_REGISTRY',
  STALE_INDEX:'STALE_INDEX',
  CANDIDATE_INVALID:'CANDIDATE_INVALID',
  CANDIDATE_UNKNOWN:'CANDIDATE_UNKNOWN',
  CYCLE_DETECTED:'CYCLE_DETECTED',
  BUDGET_EXCEEDED:'BUDGET_EXCEEDED',
  NO_MATCH:'NO_MATCH'
});

function Fault(code,status,message,path,details){
  this.name='P78FormulaStructuralMatcherFault';
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
function evidenceFields(){ return {evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED',semanticTruth:false,mathematicalEquivalence:'NOT_COMPUTED'}; }
function errorRecord(error){ return {code:error.code||ERROR_CODES.PATTERN_INVALID,path:error.path||'$',message:error.message||String(error),details:error.details||{}}; }

function mappedError(error,fallback){
  var code=error&&error.code||fallback;
  if(code==='CYCLIC_VALUE'||code===Shape.errorCodes.CYCLE_DETECTED) code=ERROR_CODES.CYCLE_DETECTED;
  if(code===Shape.errorCodes.STALE_REGISTRY) code=ERROR_CODES.STALE_REGISTRY;
  if(code===Shape.errorCodes.STALE_INDEX) code=ERROR_CODES.STALE_INDEX;
  if(code===Shape.errorCodes.BUDGET_EXCEEDED) code=ERROR_CODES.BUDGET_EXCEEDED;
  return new Fault(code,error&&error.status||'INVALID',error&&error.message||code,error&&error.path||'$',error&&error.details||{});
}

function outcome(status,code,error,extra){
  return freeze(merge({schema:'meridian.formula-structural-outcome/1',version:VERSION,status:status,code:code||null,errors:error?[errorRecord(error)]:[]},merge(evidenceFields(),extra||{})));
}

function copyData(value){
  try{ return Canonical.deepCopy(value); }
  catch(error){ throw mappedError(error,ERROR_CODES.PATTERN_INVALID); }
}

function assertKnownFields(value,allowed,code,path){
  var keys,i;
  if(!isObject(value)) fail(code,'INVALID','object required',path);
  keys=Object.keys(value);
  for(i=0;i<keys.length;i++) if(!allowed[keys[i]]) fail(code,'INVALID','unknown field '+keys[i],path+'.'+keys[i]);
}

function canonicalCompare(left,right){
  var a=Canonical.canonicalize(left),b=Canonical.canonicalize(right);
  return a<b?-1:(a>b?1:0);
}

function omitOwn(value,key){
  var result={},keys=Object.keys(value),i,name;
  for(i=0;i<keys.length;i++){
    name=keys[i];
    if(name!==key) result[name]=value[name];
  }
  return result;
}

function patternRef(pattern){ return freeze({patternId:pattern.patternId,version:pattern.version,contentHash:pattern.contentHash}); }

var PATTERN_FIELDS=freeze({schema:true,patternId:true,version:true,lifecycle:true,candidateKind:true,matchMode:true,constraints:true,contentHash:true});
var COMMON_CONSTRAINT_FIELDS={kind:true,constraintId:true};

function fieldsForConstraint(kind){
  var fields={kind:true,constraintId:true};
  if(kind==='EXACT_SHAPE') fields.shapeHash=true;
  else if(kind==='FORMULA_ID'){ fields.formulaId=true; fields.version=true; fields.contentHash=true; }
  else if(kind==='ROOT_NODE') fields.rootNode=true;
  else if(kind==='OPERATION'){ fields.operation=true; fields.minCount=true; fields.maxCount=true; }
  else if(kind==='INPUT_TYPE_UNIT'){ fields.valueType=true; fields.unit=true; fields.measureKind=true; fields.minCount=true; }
  else if(kind==='OUTPUT_TYPE_UNIT'){ fields.valueType=true; fields.unit=true; fields.measureKind=true; }
  else if(kind==='DEPENDENCY'){ fields.formulaId=true; fields.version=true; fields.contentHash=true; }
  else if(kind==='LITERAL_KIND'){ fields.literalKind=true; fields.minCount=true; }
  else if(kind==='ASSUMPTION'){ fields.predicateId=true; fields.version=true; }
  return fields;
}

function normalizeCount(value,name,path,minimum){
  if(value===undefined) return minimum;
  if(!Number.isInteger(value)||value<minimum) fail(ERROR_CODES.PATTERN_INVALID,'INVALID',name+' invalid',path+'.'+name);
  return value;
}

function normalizeConstraint(source,path){
  var kind,result,minCount,maxCount;
  if(!isObject(source)||!CONSTRAINT_KINDS[source.kind]) fail(ERROR_CODES.UNKNOWN_CONSTRAINT,'INVALID','unknown constraint '+(source&&source.kind),path+'.kind');
  kind=source.kind;
  assertKnownFields(source,fieldsForConstraint(kind),ERROR_CODES.UNKNOWN_PATTERN_FIELD,path);
  result={kind:kind};
  if(source.constraintId!==undefined){
    if(typeof source.constraintId!=='string'||!source.constraintId) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','constraintId invalid',path+'.constraintId');
    result.constraintId=source.constraintId;
  }
  if(kind==='EXACT_SHAPE'){
    if(!Canonical.isSha256(source.shapeHash)) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','shapeHash invalid',path+'.shapeHash');
    result.shapeHash=source.shapeHash;
  }else if(kind==='FORMULA_ID'||kind==='DEPENDENCY'){
    if(typeof source.formulaId!=='string'||!source.formulaId) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','formulaId required',path+'.formulaId');
    result.formulaId=Registry.normalizeFormulaId(source.formulaId);
    if(source.version!==undefined){ if(!isSemVer(source.version)) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','version invalid',path+'.version'); result.version=source.version; }
    if(source.contentHash!==undefined){ if(!Canonical.isSha256(source.contentHash)) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','contentHash invalid',path+'.contentHash'); result.contentHash=source.contentHash; }
  }else if(kind==='ROOT_NODE'){
    if(!ROOT_NODES[source.rootNode]) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','rootNode invalid',path+'.rootNode');
    result.rootNode=source.rootNode;
  }else if(kind==='OPERATION'){
    if(!Registry.operations[source.operation]) fail(ERROR_CODES.UNKNOWN_OPERATION,'INVALID','unknown operation '+source.operation,path+'.operation');
    minCount=normalizeCount(source.minCount,'minCount',path,1);
    maxCount=source.maxCount===undefined||source.maxCount===null?null:normalizeCount(source.maxCount,'maxCount',path,minCount);
    result.operation=source.operation; result.minCount=minCount; result.maxCount=maxCount;
  }else if(kind==='INPUT_TYPE_UNIT'||kind==='OUTPUT_TYPE_UNIT'){
    if(!VALUE_TYPES[source.valueType]) fail(ERROR_CODES.UNKNOWN_TYPE,'INVALID','unknown valueType '+source.valueType,path+'.valueType');
    if(typeof source.unit!=='string'||!source.unit) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','unit required',path+'.unit');
    result.valueType=source.valueType; result.unit=source.unit;
    if(source.measureKind!==undefined){ if(typeof source.measureKind!=='string'||!source.measureKind) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','measureKind invalid',path+'.measureKind'); result.measureKind=source.measureKind; }
    if(kind==='INPUT_TYPE_UNIT') result.minCount=normalizeCount(source.minCount,'minCount',path,1);
  }else if(kind==='LITERAL_KIND'){
    if(!Shape.literalKinds[source.literalKind]) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','literalKind invalid',path+'.literalKind');
    result.literalKind=source.literalKind; result.minCount=normalizeCount(source.minCount,'minCount',path,1);
  }else if(kind==='ASSUMPTION'){
    if(typeof source.predicateId!=='string'||!source.predicateId) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','predicateId required',path+'.predicateId');
    result.predicateId=source.predicateId;
    if(source.version!==undefined){ if(!isSemVer(source.version)) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','assumption version invalid',path+'.version'); result.version=source.version; }
  }
  return result;
}

function compilePattern(draft){
  var source,pattern,constraints,providedHash,ids={},i;
  try{
    source=copyData(draft);
    assertKnownFields(source,PATTERN_FIELDS,ERROR_CODES.UNKNOWN_PATTERN_FIELD,'$.pattern');
    if(source.schema!==undefined&&source.schema!==PATTERN_SCHEMA) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','pattern schema mismatch','$.pattern.schema');
    if(typeof source.patternId!=='string'||!/^[a-z0-9][a-z0-9._-]*$/.test(source.patternId)) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','patternId invalid','$.pattern.patternId');
    if(!isSemVer(source.version)) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','pattern version must be SemVer','$.pattern.version');
    if(source.lifecycle!==undefined&&source.lifecycle!=='ACTIVE') fail(ERROR_CODES.PATTERN_INVALID,'INVALID','only ACTIVE patterns execute','$.pattern.lifecycle');
    if(source.candidateKind!==undefined&&source.candidateKind!=='FORMULA_AST') fail(ERROR_CODES.PATTERN_INVALID,'INVALID','candidateKind must be FORMULA_AST','$.pattern.candidateKind');
    if(source.matchMode!==undefined&&source.matchMode!=='ALL') fail(ERROR_CODES.PATTERN_INVALID,'INVALID','only ALL match mode is supported','$.pattern.matchMode');
    if(!Array.isArray(source.constraints)||!source.constraints.length) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','non-empty constraints required','$.pattern.constraints');
    constraints=source.constraints.map(function(item,index){ return normalizeConstraint(item,'$.pattern.constraints['+index+']'); }).sort(canonicalCompare);
    for(i=0;i<constraints.length;i++){
      if(!constraints[i].constraintId) constraints[i].constraintId=source.patternId+':c'+(i+1);
      if(ids[constraints[i].constraintId]) fail(ERROR_CODES.PATTERN_INVALID,'INVALID','duplicate constraintId','$.pattern.constraints['+i+'].constraintId');
      ids[constraints[i].constraintId]=true;
    }
    pattern={schema:PATTERN_SCHEMA,patternId:source.patternId,version:source.version,lifecycle:'ACTIVE',candidateKind:'FORMULA_AST',matchMode:'ALL',constraints:constraints};
    providedHash=source.contentHash;
    pattern.contentHash=Canonical.hashCanonical(pattern);
    if(providedHash!==undefined&&providedHash!==pattern.contentHash) fail(ERROR_CODES.PATTERN_HASH_MISMATCH,'INVALID','pattern hash mismatch','$.pattern.contentHash');
    pattern=freeze(pattern);
    return outcome('READY',null,null,{pattern:pattern,patternRef:patternRef(pattern),patternHash:pattern.contentHash});
  }catch(error){
    error=mappedError(error,ERROR_CODES.PATTERN_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{pattern:null,patternRef:null,patternHash:null});
  }
}

function createPattern(patternId,constraints,version){ return compilePattern({patternId:patternId,version:version||VERSION,constraints:constraints}); }

function normalizeCompiledPattern(value){
  var compiled=value&&value.status==='READY'&&value.pattern?value:compilePattern(value);
  if(compiled.status!=='READY') fail(compiled.code,compiled.status,'pattern compilation failed','$.pattern',{errors:compiled.errors});
  return compiled.pattern;
}

var PATTERN_REGISTRY_FIELDS=freeze({schema:true,version:true,status:true,patternCount:true,patterns:true,sourceSetHash:true,patternSetHash:true,evidence:true,evidenceLevel:true,soundness:true,semanticTruth:true,mathematicalEquivalence:true});
function createPatternRegistry(sourcePatterns,expectedHash){
  var patterns,seen={},i,key,payload;
  try{
    if(!Array.isArray(sourcePatterns)||!sourcePatterns.length) fail(ERROR_CODES.PATTERN_REGISTRY_INVALID,'INVALID','non-empty patterns array required','$.patterns');
    patterns=sourcePatterns.map(normalizeCompiledPattern).sort(function(a,b){ return (a.patternId+'@'+a.version).localeCompare(b.patternId+'@'+b.version); });
    for(i=0;i<patterns.length;i++){
      key=patterns[i].patternId+'@'+patterns[i].version;
      if(seen[key]) fail(ERROR_CODES.PATTERN_DUPLICATE,'INVALID','duplicate pattern '+key,'$.patterns['+i+']');
      seen[key]=true;
    }
    payload=merge({
      schema:PATTERN_REGISTRY_SCHEMA,
      version:VERSION,
      status:'READY',
      patternCount:patterns.length,
      patterns:patterns,
      sourceSetHash:Canonical.hashCanonical(patterns.map(patternRef))
    },evidenceFields());
    payload.patternSetHash=Canonical.hashCanonical(payload);
    if(expectedHash!==undefined&&expectedHash!==payload.patternSetHash) fail(ERROR_CODES.PATTERN_SET_HASH_MISMATCH,'INVALID','pattern set hash mismatch','$.patternSetHash');
    return freeze(payload);
  }catch(error){
    error=mappedError(error,ERROR_CODES.PATTERN_REGISTRY_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{patterns:[],patternCount:0,sourceSetHash:null,patternSetHash:null});
  }
}

function verifyPatternRegistry(registry,expectedHash){
  var copied,rebuilt;
  try{
    copied=copyData(registry);
    assertKnownFields(copied,PATTERN_REGISTRY_FIELDS,ERROR_CODES.PATTERN_REGISTRY_INVALID,'$.patternRegistry');
    if(copied.schema!==PATTERN_REGISTRY_SCHEMA||copied.version!==VERSION||copied.status!=='READY'||!Array.isArray(copied.patterns)||copied.patternCount!==copied.patterns.length) fail(ERROR_CODES.PATTERN_REGISTRY_INVALID,'INVALID','pattern registry envelope invalid','$.patternRegistry');
    rebuilt=createPatternRegistry(copied.patterns,copied.patternSetHash);
    if(rebuilt.status!=='READY') fail(rebuilt.code,rebuilt.status,'pattern registry rebuild failed','$.patternRegistry',{errors:rebuilt.errors});
    if(expectedHash!==undefined&&expectedHash!==copied.patternSetHash) fail(ERROR_CODES.STALE_PATTERN,'INVALID','pattern set is stale','$.patternRegistry.patternSetHash');
    return outcome('READY',null,null,{patternRegistry:rebuilt,patterns:rebuilt.patterns,patternCount:rebuilt.patternCount,sourceSetHash:rebuilt.sourceSetHash,patternSetHash:rebuilt.patternSetHash});
  }catch(error){
    error=mappedError(error,ERROR_CODES.PATTERN_REGISTRY_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{patternRegistry:null,patterns:[],patternCount:0,sourceSetHash:null,patternSetHash:null});
  }
}

function getPattern(patternRegistry,id,version){
  var normalized=id,matches;
  if(!patternRegistry||!Array.isArray(patternRegistry.patterns)) return null;
  matches=patternRegistry.patterns.filter(function(pattern){ return pattern.patternId===normalized&&(version===undefined||pattern.version===version); });
  if(!matches.length) return null;
  matches.sort(function(a,b){ return a.version.localeCompare(b.version); });
  return matches[matches.length-1];
}

function createBudget(options,defaultOperations){
  var maxOperations=options&&options.maxOperations!==undefined?options.maxOperations:defaultOperations;
  if(!Number.isInteger(maxOperations)||maxOperations<0) fail(ERROR_CODES.BUDGET_EXCEEDED,'ABSTAIN','maxOperations must be non-negative','$.options.maxOperations');
  return {operations:0,maxOperations:maxOperations};
}

function consume(budget,path){
  budget.operations++;
  if(budget.operations>budget.maxOperations) fail(ERROR_CODES.BUDGET_EXCEEDED,'ABSTAIN','matcher budget exceeded',path,{maxOperations:budget.maxOperations});
}

function resolveIndex(options){
  var index=options&&options.index||Shape.defaultIndex;
  var checked=Shape.verifyIndex(index,{expectedRegistryHash:options&&options.expectedRegistryHash,expectedIndexHash:options&&options.expectedIndexHash});
  if(checked.status!=='READY') fail(checked.code,checked.status,'shape index verification failed','$.index',{errors:checked.errors});
  return checked.index;
}

function resolveCandidate(candidate,index){
  var signature=null,verified,i;
  if(typeof candidate==='string'){
    for(i=0;i<index.signatures.length;i++){
      if(index.signatures[i].shapeHash===candidate||index.signatures[i].formulaRef.formulaId===Registry.normalizeFormulaId(candidate)){ signature=index.signatures[i]; break; }
    }
  }else if(isObject(candidate)&&candidate.schema===Shape.signatureSchema){
    signature=candidate;
  }else if(isObject(candidate)&&candidate.shapeHash){
    for(i=0;i<index.signatures.length;i++) if(index.signatures[i].shapeHash===candidate.shapeHash){ signature=index.signatures[i]; break; }
  }
  if(!signature) fail(ERROR_CODES.CANDIDATE_UNKNOWN,'ABSTAIN','formula shape candidate not found','$.candidate');
  verified=Shape.verifySignature(signature);
  if(verified.status!=='READY') fail(ERROR_CODES.CANDIDATE_INVALID,'INVALID','candidate signature invalid','$.candidate',{errors:verified.errors});
  for(i=0;i<index.signatures.length;i++) if(index.signatures[i].shapeHash===verified.signature.shapeHash) return index.signatures[i];
  fail(ERROR_CODES.CANDIDATE_INVALID,'INVALID','candidate is not in the pinned index','$.candidate.shapeHash');
}

function countMatches(values,predicate){
  var count=0,i;
  for(i=0;i<values.length;i++) if(predicate(values[i])) count++;
  return count;
}

function typeMatches(type,constraint){ return type.valueType===constraint.valueType&&type.unit===constraint.unit&&(constraint.measureKind===undefined||type.measureKind===constraint.measureKind); }

function constraintResult(constraint,signature,budget){
  var result=false,rationale='',count=0;
  consume(budget,'$.constraints.'+constraint.constraintId);
  if(constraint.kind==='EXACT_SHAPE'){
    result=signature.shapeHash===constraint.shapeHash;
    rationale=result?'shape hash is exact':'shape hash differs';
  }else if(constraint.kind==='FORMULA_ID'){
    result=signature.formulaRef.formulaId===constraint.formulaId&&(constraint.version===undefined||signature.formulaRef.version===constraint.version)&&(constraint.contentHash===undefined||signature.formulaRef.contentHash===constraint.contentHash);
    rationale=result?'formula reference matches':'formula reference differs';
  }else if(constraint.kind==='ROOT_NODE'){
    result=signature.rootNode===constraint.rootNode;
    rationale=result?'root node matches':'root node differs';
  }else if(constraint.kind==='OPERATION'){
    count=signature.operationMultiset[constraint.operation]||0;
    result=count>=constraint.minCount&&(constraint.maxCount===null||count<=constraint.maxCount);
    rationale='operation count '+count;
  }else if(constraint.kind==='INPUT_TYPE_UNIT'){
    count=countMatches(signature.inputTypes,function(type){ return typeMatches(type,constraint); });
    result=count>=constraint.minCount;
    rationale='matching input count '+count;
  }else if(constraint.kind==='OUTPUT_TYPE_UNIT'){
    result=typeMatches(signature.outputType,constraint);
    rationale=result?'output type and unit match':'output type or unit differs';
  }else if(constraint.kind==='DEPENDENCY'){
    count=countMatches(signature.dependencyRefs,function(ref){ return ref.formulaId===constraint.formulaId&&(constraint.version===undefined||ref.version===constraint.version)&&(constraint.contentHash===undefined||ref.contentHash===constraint.contentHash); });
    result=count>0;
    rationale='matching dependency count '+count;
  }else if(constraint.kind==='LITERAL_KIND'){
    count=countMatches(signature.literalKinds,function(kind){ return kind===constraint.literalKind; });
    result=count>=constraint.minCount;
    rationale='matching literal count '+count;
  }else if(constraint.kind==='ASSUMPTION'){
    count=countMatches(signature.assumptions,function(assumption){ return assumption.predicateId===constraint.predicateId&&(constraint.version===undefined||assumption.version===constraint.version); });
    result=count>0;
    rationale='matching assumption count '+count;
  }else{
    fail(ERROR_CODES.UNKNOWN_CONSTRAINT,'INVALID','constraint is not closed','$.constraints.'+constraint.constraintId);
  }
  return freeze({constraintId:constraint.constraintId,result:result?'TRUE':'FALSE',rationale:rationale});
}

function performMatch(pattern,signature,index,budget){
  var results=pattern.constraints.map(function(constraint){ return constraintResult(constraint,signature,budget); });
  var status=results.every(function(item){ return item.result==='TRUE'; })?'STRUCTURAL_MATCH':'STRUCTURAL_REJECT';
  var trace={
    schema:'meridian.structural-match-trace/1',
    version:VERSION,
    sourceHash:signature.sourceHash,
    sourceSetHash:index.sourceSetHash,
    registryHash:index.registryHash,
    indexHash:index.indexHash,
    patternHash:pattern.contentHash,
    candidateShapeHash:signature.shapeHash,
    constraintOrder:results.map(function(item){ return item.constraintId; }),
    operations:budget.operations,
    maxOperations:budget.maxOperations,
    deterministic:true
  };
  trace.traceHash=Canonical.hashCanonical(trace);
  var match=merge({
    schema:MATCH_SCHEMA,
    version:VERSION,
    patternRef:patternRef(pattern),
    candidateRef:signature.formulaRef.formulaId+'@'+signature.formulaRef.version+'#'+signature.shapeHash,
    candidateKind:'FORMULA_AST',
    bindings:{formulaId:signature.formulaRef.formulaId,formulaVersion:signature.formulaRef.version,shapeHash:signature.shapeHash,sourceHash:signature.sourceHash},
    constraints:results,
    status:status,
    code:null,
    parserVersion:'formula-ast/1',
    matcherVersion:VERSION,
    sourceHash:signature.sourceHash,
    sourceSetHash:index.sourceSetHash,
    registryHash:index.registryHash,
    indexHash:index.indexHash,
    patternHash:pattern.contentHash,
    trace:trace,
    errors:[]
  },evidenceFields());
  match.contentHash=Canonical.hashCanonical(match);
  match.matchId='match:'+match.contentHash.slice(7);
  return freeze(match);
}

function matchPattern(patternSource,candidate,options){
  var index,pattern,signature,budget;
  try{
    index=resolveIndex(options||{});
    pattern=normalizeCompiledPattern(patternSource);
    if(options&&options.expectedPatternHash!==undefined&&options.expectedPatternHash!==pattern.contentHash) fail(ERROR_CODES.STALE_PATTERN,'INVALID','pattern hash is stale','$.expectedPatternHash',{expected:options.expectedPatternHash,actual:pattern.contentHash});
    signature=resolveCandidate(candidate,index);
    budget=createBudget(options,1024);
    return performMatch(pattern,signature,index,budget);
  }catch(error){
    error=mappedError(error,ERROR_CODES.PATTERN_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{
      matchId:null,
      contentHash:null,
      patternRef:pattern?patternRef(pattern):null,
      candidateRef:null,
      candidateKind:'FORMULA_AST',
      constraints:[],
      sourceHash:signature?signature.sourceHash:null,
      sourceSetHash:index?index.sourceSetHash:null,
      registryHash:index?index.registryHash:null,
      indexHash:index?index.indexHash:null,
      patternHash:pattern?pattern.contentHash:null,
      trace:null
    });
  }
}

function matchAll(patternSource,options){
  var index,pattern,budget,matches,rejects,all,batch;
  try{
    index=resolveIndex(options||{});
    pattern=normalizeCompiledPattern(patternSource);
    if(options&&options.expectedPatternHash!==undefined&&options.expectedPatternHash!==pattern.contentHash) fail(ERROR_CODES.STALE_PATTERN,'INVALID','pattern hash is stale','$.expectedPatternHash');
    budget=createBudget(options,16384);
    all=index.signatures.map(function(signature){ return performMatch(pattern,signature,index,budget); });
    matches=all.filter(function(item){ return item.status==='STRUCTURAL_MATCH'; });
    rejects=all.filter(function(item){ return item.status==='STRUCTURAL_REJECT'; });
    batch=merge({
      schema:BATCH_SCHEMA,
      version:VERSION,
      status:matches.length?'STRUCTURAL_MATCH':'ABSTAIN',
      code:matches.length?null:ERROR_CODES.NO_MATCH,
      patternRef:patternRef(pattern),
      patternHash:pattern.contentHash,
      sourceSetHash:index.sourceSetHash,
      registryHash:index.registryHash,
      indexHash:index.indexHash,
      matches:matches,
      rejects:rejects,
      operations:budget.operations,
      errors:[]
    },evidenceFields());
    batch.contentHash=Canonical.hashCanonical(batch);
    return freeze(batch);
  }catch(error){
    error=mappedError(error,ERROR_CODES.PATTERN_INVALID);
    return outcome(error.status||'INVALID',error.code,error,{patternRef:pattern?patternRef(pattern):null,patternHash:pattern?pattern.contentHash:null,sourceSetHash:index?index.sourceSetHash:null,registryHash:index?index.registryHash:null,indexHash:index?index.indexHash:null,matches:[],rejects:[],operations:budget?budget.operations:0,contentHash:null});
  }
}

var ringSignature=Shape.signatures.filter(function(signature){ return signature.formulaRef.formulaId==='ring.balance'; })[0];
var DEFAULT_PATTERN_REGISTRY=createPatternRegistry([
  createPattern('p78.pattern.exact-ring-balance',[{kind:'EXACT_SHAPE',shapeHash:ringSignature.shapeHash}]),
  createPattern('p78.pattern.operation-mul',[{kind:'OPERATION',operation:'mul',minCount:1}]),
  createPattern('p78.pattern.output-real-unit-one',[{kind:'OUTPUT_TYPE_UNIT',valueType:'Real',unit:'1'}]),
  createPattern('p78.pattern.depends-on-orbit-forward',[{kind:'DEPENDENCY',formulaId:'pressure.orbit-forward'}])
]);

global.MRDP78FormulaStructuralMatcher=freeze({
  version:VERSION,
  schema:MATCH_SCHEMA,
  patternSchema:PATTERN_SCHEMA,
  patternRegistrySchema:PATTERN_REGISTRY_SCHEMA,
  batchSchema:BATCH_SCHEMA,
  status:DEFAULT_PATTERN_REGISTRY.status,
  code:DEFAULT_PATTERN_REGISTRY.code||null,
  evidence:'STRUCTURAL',
  evidenceLevel:'STRUCTURAL',
  soundness:'NOT_COMPUTED',
  semanticTruth:false,
  mathematicalEquivalence:'NOT_COMPUTED',
  maximumStatus:'STRUCTURAL_MATCH',
  errorCodes:ERROR_CODES,
  constraintKinds:CONSTRAINT_KINDS,
  defaultPatternRegistry:DEFAULT_PATTERN_REGISTRY,
  patternRegistry:DEFAULT_PATTERN_REGISTRY,
  patternSetHash:DEFAULT_PATTERN_REGISTRY.patternSetHash||null,
  patterns:DEFAULT_PATTERN_REGISTRY.patterns||freeze([]),
  createPattern:createPattern,
  compilePattern:compilePattern,
  createPatternRegistry:createPatternRegistry,
  verifyPatternRegistry:verifyPatternRegistry,
  getPattern:getPattern,
  matchPattern:matchPattern,
  matchAll:matchAll
});
})(typeof globalThis!=='undefined'?globalThis:this);
