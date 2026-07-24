(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var Contracts=global.MRDP78SearchContracts;
if(!Canonical||!Contracts) throw new Error('P78_QUERY_PROJECTOR_DEPENDENCY_UNAVAILABLE');

var ALLOWED_KEYS={formulaRef:1,rootNode:1,operationMultiset:1,operationPaths:1,inputTypes:1,outputType:1,dependencyRefs:1,literalKinds:1,assumptions:1,shapeHash:1,schema:1,version:1,sourceHash:1};

function fail(status,code,detail){ return Canonical.deepFreeze({status:status,code:code,detail:detail||'',projection:null,operationCount:0}); }
function shortHash(value){ return String(value).replace(/^sha256:/,'').slice(0,20); }
function ownKeys(value){ return value&&typeof value==='object'?Object.keys(value):[]; }
function formulaRefValid(ref){
  return ref&&typeof ref.formulaId==='string'&&ref.formulaId&&typeof ref.version==='string'&&Canonical.isSha256(ref.contentHash);
}
function typeToken(type){
  if(!type||typeof type!=='object') return [];
  var values=[];
  if(typeof type.valueType==='string') values.push(type.valueType);
  if(typeof type.kind==='string') values.push(type.kind);
  if(typeof type.typeId==='string') values.push(type.typeId);
  if(typeof type.measureKind==='string') values.push(type.measureKind);
  if(typeof type.unit==='string'&&type.unit!=='1') values.push(type.unit);
  if(typeof type.dimension==='string'&&type.dimension!=='1') values.push(type.dimension);
  return values;
}
function ruleRef(){
  var payload={patternId:'formula.exact-query-projection',version:VERSION,patternKind:'FORMULA_AST_EXACT'};
  payload.contentHash=Canonical.hashCanonical(payload);
  return payload;
}
function termQuery(value,signature,index){
  var seed={value:value,formulaHash:signature.formulaRef.contentHash,index:index};
  var payload={
    queryId:'sq-'+shortHash(Canonical.hashCanonical(seed)),
    revision:'1.0.0',
    mode:'EXACT',
    expression:{node:'Term',value:value,normalization:'LOWER'},
    filters:{language:'ru',requiredSourceStatus:'ADMITTED'},
    origin:{kind:'FORMULA_AST',formulaRef:signature.formulaRef,astPath:'$'},
    expansionClass:'EXACT'
  };
  return Contracts.createSemanticQuery(payload);
}
function collectTerms(signature,budget){
  var values=[signature.formulaRef.formulaId,signature.rootNode],operations=ownKeys(signature.operationMultiset).sort(),dependencies=signature.dependencyRefs||[],types=signature.inputTypes||[],i;
  for(i=0;i<operations.length;i++) values.push(operations[i]);
  for(i=0;i<types.length;i++) values=values.concat(typeToken(types[i]));
  values=values.concat(typeToken(signature.outputType));
  for(i=0;i<dependencies.length;i++) values.push(dependencies[i].formulaId);
  values=values.filter(function(value){ return typeof value==='string'&&value.trim(); }).map(function(value){ return value.trim().toLowerCase(); });
  values=values.filter(function(value,index,array){ return array.indexOf(value)===index; }).sort();
  if(values.length>budget) return null;
  return values;
}
function validate(signature){
  var keys=ownKeys(signature),i;
  if(!signature||signature.schema!=='meridian.formula-shape/1'||!formulaRefValid(signature.formulaRef)||!Canonical.isSha256(signature.shapeHash)) return 'FORMULA_SHAPE_INVALID';
  for(i=0;i<keys.length;i++) if(!ALLOWED_KEYS[keys[i]]) return 'FORMULA_SHAPE_UNKNOWN_FIELD';
  if(typeof signature.rootNode!=='string'||!signature.rootNode||!signature.operationMultiset||typeof signature.operationMultiset!=='object') return 'FORMULA_SHAPE_INVALID';
  if(!Array.isArray(signature.inputTypes)||!signature.outputType||!Array.isArray(signature.dependencyRefs)) return 'FORMULA_SHAPE_INVALID';
  return null;
}
function projectFormula(signature,options){
  options=options||{};
  var allowed={operationBudget:1},optionKeys=ownKeys(options),i,error,terms,queries,payload,projectionHash,budget=options.operationBudget==null?64:options.operationBudget;
  for(i=0;i<optionKeys.length;i++) if(!allowed[optionKeys[i]]) return fail('INVALID','PROJECTOR_UNKNOWN_OPTION',optionKeys[i]);
  if(!Number.isInteger(budget)||budget<1||budget>512) return fail('INVALID','PROJECTOR_BUDGET_INVALID');
  error=validate(signature);
  if(error) return fail('INVALID',error);
  terms=collectTerms(signature,budget);
  if(!terms) return fail('BLOCKED','OPERATION_BUDGET_EXCEEDED');
  if(!terms.length) return fail('ABSTAIN','NO_EXACT_PROJECTION');
  queries=terms.map(function(value,index){ return termQuery(value,signature,index); });
  payload={
    schema:'meridian.query-projection/1',
    sourceStructureRef:signature.shapeHash,
    ruleRef:ruleRef(),
    queries:queries,
    purpose:'DUPLICATE_CHECK',
    completenessClaim:'BOUNDED_VOCABULARY_ONLY',
    omittedKnownVariants:[]
  };
  projectionHash=Canonical.hashCanonical(payload);
  payload.projectionId='qp-'+shortHash(projectionHash);
  payload.contentHash=Canonical.hashCanonical(payload);
  return Canonical.deepFreeze({status:'READY',code:null,projection:payload,operationCount:terms.length});
}

global.MRDP78QueryProjector=Canonical.deepFreeze({
  version:VERSION,
  schema:'meridian.query-projector/1',
  projectFormula:projectFormula
});
})(typeof globalThis!=='undefined'?globalThis:this);
