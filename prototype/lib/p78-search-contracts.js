(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;

if(!Canonical){
  global.MRDP78SearchContracts=Object.freeze({
    version:VERSION,
    status:'BLOCKED',
    code:'CANONICAL_JSON_UNAVAILABLE'
  });
  return;
}

var freeze=Canonical.deepFreeze;
var SCHEMAS=freeze({
  semanticQuery:'meridian.semantic-query/1',
  sourceSnapshot:'meridian.source-snapshot/1',
  searchHit:'meridian.search-hit/1',
  indexManifest:'meridian.index-manifest/1',
  bidirectionalTrace:'meridian.bidirectional-search-trace/1'
});
var QUERY_MODES=freeze({
  EXACT:true,TOKEN:true,LEMMA:true,FORMULA_SHAPE:true,
  LINGUISTIC_STRUCTURE:true,CLAIM_PATTERN:true,VECTOR_OPTIONAL:true
});
var EXPANSION_CLASSES=freeze({EXACT:true,CURATED:true,HEURISTIC:true});
var MATCH_CLASSES=freeze({EXACT:true,TOKEN:true,LEMMA:true,SHAPE:true,VECTOR:true});
var TRACE_DIRECTIONS=freeze({GREP_TO_AST:true,AST_TO_GREP:true,EVIDENCE_GATE:true});
var TRACE_STEP_STATUSES=freeze({READY:true,EMPTY:true,AMBIGUOUS:true,ABSTAIN:true,ERROR:true});
var TRACE_FINAL_STATUSES=freeze({CONTINUE:true,REPAIR:true,ABSTAIN:true});
var STATUS_LADDER=freeze([
  'LOCATED','PARSED','STRUCTURAL_MATCH','EVIDENCE_CANDIDATE','SUPPORTED','REFUTED'
]);
var STATUS_NEXT=freeze({
  LOCATED:['PARSED'],
  PARSED:['STRUCTURAL_MATCH'],
  STRUCTURAL_MATCH:['EVIDENCE_CANDIDATE'],
  EVIDENCE_CANDIDATE:['SUPPORTED','REFUTED'],
  SUPPORTED:[],
  REFUTED:[]
});
var REASON_CODES=freeze({
  READY:'READY',
  MATCHES_LOCATED:'MATCHES_LOCATED',
  NO_MATCHES:'NO_MATCHES',
  OOV_TERM:'OOV_TERM',
  EMPTY_QUERY:'EMPTY_QUERY',
  INVALID_SCHEMA:'INVALID_SCHEMA',
  UNKNOWN_FIELD:'UNKNOWN_FIELD',
  REQUIRED_FIELD_MISSING:'REQUIRED_FIELD_MISSING',
  INVALID_VALUE:'INVALID_VALUE',
  INVALID_HASH:'INVALID_HASH',
  QUERY_HASH_MISMATCH:'QUERY_HASH_MISMATCH',
  SOURCE_HASH_MISMATCH:'SOURCE_HASH_MISMATCH',
  INDEX_HASH_MISMATCH:'INDEX_HASH_MISMATCH',
  TRACE_HASH_MISMATCH:'TRACE_HASH_MISMATCH',
  INVALID_QUERY_AST:'INVALID_QUERY_AST',
  QUERY_CYCLE:'QUERY_CYCLE',
  QUERY_DEPTH_EXCEEDED:'QUERY_DEPTH_EXCEEDED',
  QUERY_NODE_BUDGET_EXCEEDED:'QUERY_NODE_BUDGET_EXCEEDED',
  QUERY_NODE_UNSUPPORTED:'QUERY_NODE_UNSUPPORTED',
  QUERY_MODE_UNSUPPORTED:'QUERY_MODE_UNSUPPORTED',
  DUPLICATE_SOURCE:'DUPLICATE_SOURCE',
  SOURCE_REVISION_CONFLICT:'SOURCE_REVISION_CONFLICT',
  DUPLICATE_SPAN:'DUPLICATE_SPAN',
  STALE_INDEX:'STALE_INDEX',
  BUDGET_EXCEEDED:'BUDGET_EXCEEDED',
  CYCLE_DETECTED:'CYCLE_DETECTED',
  INVALID_LOCATOR:'INVALID_LOCATOR',
  STATUS_UNKNOWN:'STATUS_UNKNOWN',
  STATUS_JUMP_FORBIDDEN:'STATUS_JUMP_FORBIDDEN',
  LEXICAL_STATUS_FORBIDDEN:'LEXICAL_STATUS_FORBIDDEN',
  SEMANTIC_TRUTH_FORBIDDEN:'SEMANTIC_TRUTH_FORBIDDEN',
  CANONICAL_JSON_UNAVAILABLE:'CANONICAL_JSON_UNAVAILABLE'
});
var SEMVER=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
var ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
var FIELD_PATTERN=/^[A-Za-z][A-Za-z0-9._-]{0,127}$/;

function contractError(code,message,path){
  var error=new TypeError(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78SearchContractError';
  error.code=code;
  error.path=path||'$';
  return error;
}

function reject(code,message,path){ throw contractError(code,message,path); }
function isObject(value){ return Canonical.isPlainObject(value); }
function hasOwn(value,key){ return Object.prototype.hasOwnProperty.call(value,key); }

function assertObject(value,path){
  if(!isObject(value)) reject(REASON_CODES.INVALID_VALUE,'plain object required',path);
}

function assertExactKeys(value,required,optional,path){
  var allowed={},keys=Object.keys(value),i,key;
  for(i=0;i<required.length;i++) allowed[required[i]]=true;
  for(i=0;i<optional.length;i++) allowed[optional[i]]=true;
  for(i=0;i<required.length;i++){
    if(!hasOwn(value,required[i])) reject(REASON_CODES.REQUIRED_FIELD_MISSING,required[i],path+'.'+required[i]);
  }
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(!allowed[key]) reject(REASON_CODES.UNKNOWN_FIELD,key,path+'.'+key);
  }
}

function assertString(value,path,options){
  options=options||{};
  if(typeof value!=='string') reject(REASON_CODES.INVALID_VALUE,'string required',path);
  if(options.trimmed&&value.trim()!==value) reject(REASON_CODES.INVALID_VALUE,'surrounding whitespace forbidden',path);
  if(options.nonEmpty&&value.length===0) reject(REASON_CODES.INVALID_VALUE,'non-empty string required',path);
  if(options.max!==undefined&&value.length>options.max) reject(REASON_CODES.INVALID_VALUE,'string too long',path);
  if(options.pattern&&!options.pattern.test(value)) reject(REASON_CODES.INVALID_VALUE,'string format rejected',path);
}

function assertId(value,path){ assertString(value,path,{nonEmpty:true,trimmed:true,max:256,pattern:ID_PATTERN}); }
function assertSemVer(value,path){ assertString(value,path,{nonEmpty:true,trimmed:true,max:128,pattern:SEMVER}); }
function assertHash(value,path){
  if(!Canonical.isSha256(value)) reject(REASON_CODES.INVALID_HASH,'SHA-256 required',path);
}
function assertInteger(value,min,max,path){
  if(!Number.isInteger(value)||value<min||(max!==undefined&&value>max)) reject(REASON_CODES.INVALID_VALUE,'integer out of range',path);
}
function assertEnum(value,values,path){
  if(typeof value!=='string'||!values[value]) reject(REASON_CODES.INVALID_VALUE,'enumeration value rejected',path);
}
function assertStringArray(value,path,options){
  var seen={},i,item;
  options=options||{};
  if(!Array.isArray(value)) reject(REASON_CODES.INVALID_VALUE,'array required',path);
  if(options.max!==undefined&&value.length>options.max) reject(REASON_CODES.INVALID_VALUE,'array too long',path);
  if(options.nonEmpty&&value.length===0) reject(REASON_CODES.INVALID_VALUE,'non-empty array required',path);
  for(i=0;i<value.length;i++){
    item=value[i];
    assertString(item,path+'['+i+']',{nonEmpty:true,trimmed:true,max:options.itemMax||512});
    if(options.hashes) assertHash(item,path+'['+i+']');
    if(options.unique){
      if(seen[item]) reject(REASON_CODES.INVALID_VALUE,'duplicate array item',path+'['+i+']');
      seen[item]=true;
    }
  }
}

function without(value,keysToSkip){
  var result={},keys=Object.keys(value),i,key;
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(keysToSkip.indexOf(key)===-1) result[key]=value[key];
  }
  return result;
}

function contentHash(value){ return Canonical.hashCanonical(without(value,['contentHash'])); }

function assertPatternRef(value,path){
  assertObject(value,path);
  assertExactKeys(value,['patternId','version','contentHash'],[],path);
  assertId(value.patternId,path+'.patternId');
  assertSemVer(value.version,path+'.version');
  assertHash(value.contentHash,path+'.contentHash');
}

function assertFormulaRef(value,path){
  assertObject(value,path);
  assertExactKeys(value,['formulaId','version','contentHash'],[],path);
  assertId(value.formulaId,path+'.formulaId');
  assertSemVer(value.version,path+'.version');
  assertHash(value.contentHash,path+'.contentHash');
}

function assertQueryAst(ast,path,state,ancestors){
  var i,keys;
  path=path||'$.expression';
  state=state||{nodes:0,maxNodes:256,maxDepth:32};
  ancestors=ancestors||[];
  if(!isObject(ast)) reject(REASON_CODES.INVALID_QUERY_AST,'plain AST node required',path);
  if(ancestors.indexOf(ast)!==-1) reject(REASON_CODES.QUERY_CYCLE,'cyclic Query AST',path);
  if(ancestors.length>=state.maxDepth) reject(REASON_CODES.QUERY_DEPTH_EXCEEDED,'Query AST depth exceeded',path);
  state.nodes++;
  if(state.nodes>state.maxNodes) reject(REASON_CODES.QUERY_NODE_BUDGET_EXCEEDED,'Query AST node budget exceeded',path);
  ancestors.push(ast);
  assertString(ast.node,path+'.node',{nonEmpty:true,trimmed:true,max:64});

  if(ast.node==='Term'){
    assertExactKeys(ast,['node','value','normalization'],[],path);
    assertString(ast.value,path+'.value',{nonEmpty:true,max:4096});
    if(ast.value.trim().length===0) reject(REASON_CODES.EMPTY_QUERY,'blank term',path+'.value');
    assertEnum(ast.normalization,{NONE:true,LOWER:true,LEMMA:true},path+'.normalization');
  }else if(ast.node==='Phrase'){
    assertExactKeys(ast,['node','terms','slop'],[],path);
    if(!Array.isArray(ast.terms)||ast.terms.length===0||ast.terms.length>64) reject(REASON_CODES.INVALID_QUERY_AST,'phrase terms rejected',path+'.terms');
    assertInteger(ast.slop,0,64,path+'.slop');
    for(i=0;i<ast.terms.length;i++){
      if(!isObject(ast.terms[i])||ast.terms[i].node!=='Term') reject(REASON_CODES.INVALID_QUERY_AST,'phrase accepts Term nodes only',path+'.terms['+i+']');
      assertQueryAst(ast.terms[i],path+'.terms['+i+']',state,ancestors);
    }
  }else if(ast.node==='And'||ast.node==='Or'){
    assertExactKeys(ast,['node','items'],[],path);
    if(!Array.isArray(ast.items)||ast.items.length===0||ast.items.length>64) reject(REASON_CODES.INVALID_QUERY_AST,'items rejected',path+'.items');
    for(i=0;i<ast.items.length;i++) assertQueryAst(ast.items[i],path+'.items['+i+']',state,ancestors);
  }else if(ast.node==='Not'){
    assertExactKeys(ast,['node','item'],[],path);
    assertQueryAst(ast.item,path+'.item',state,ancestors);
  }else if(ast.node==='Near'){
    assertExactKeys(ast,['node','left','right','maxDistance'],[],path);
    assertInteger(ast.maxDistance,0,4096,path+'.maxDistance');
    assertQueryAst(ast.left,path+'.left',state,ancestors);
    assertQueryAst(ast.right,path+'.right',state,ancestors);
  }else if(ast.node==='Field'){
    assertExactKeys(ast,['node','field','value'],[],path);
    assertString(ast.field,path+'.field',{nonEmpty:true,trimmed:true,max:128,pattern:FIELD_PATTERN});
    assertQueryAst(ast.value,path+'.value',state,ancestors);
  }else if(ast.node==='Structure'){
    assertExactKeys(ast,['node','patternRef'],[],path);
    assertPatternRef(ast.patternRef,path+'.patternRef');
  }else{
    reject(REASON_CODES.INVALID_QUERY_AST,'unknown Query AST node '+ast.node,path+'.node');
  }
  ancestors.pop();
  keys=Object.keys(ast);
  if(keys.length===0) reject(REASON_CODES.INVALID_QUERY_AST,'empty AST node',path);
  return state.nodes;
}

function assertQueryFilters(value,path){
  assertObject(value,path);
  assertExactKeys(value,[],['sourceIds','language','dateCutoff','genre','requiredSourceStatus'],path);
  if(hasOwn(value,'sourceIds')) assertStringArray(value.sourceIds,path+'.sourceIds',{nonEmpty:true,max:256,unique:true,itemMax:256});
  if(hasOwn(value,'language')) assertString(value.language,path+'.language',{nonEmpty:true,trimmed:true,max:64});
  if(hasOwn(value,'dateCutoff')) assertString(value.dateCutoff,path+'.dateCutoff',{nonEmpty:true,trimmed:true,max:64});
  if(hasOwn(value,'genre')) assertString(value.genre,path+'.genre',{nonEmpty:true,trimmed:true,max:128});
  if(hasOwn(value,'requiredSourceStatus')&&value.requiredSourceStatus!=='ADMITTED') reject(REASON_CODES.INVALID_VALUE,'only ADMITTED is supported',path+'.requiredSourceStatus');
}

function assertQueryOrigin(value,path){
  assertObject(value,path);
  assertString(value.kind,path+'.kind',{nonEmpty:true,trimmed:true,max:64});
  if(value.kind==='USER'){
    assertExactKeys(value,['kind','inputHash'],[],path);
    assertHash(value.inputHash,path+'.inputHash');
  }else if(value.kind==='FORMULA_AST'){
    assertExactKeys(value,['kind','formulaRef','astPath'],[],path);
    assertFormulaRef(value.formulaRef,path+'.formulaRef');
    assertString(value.astPath,path+'.astPath',{nonEmpty:true,trimmed:true,max:1024});
  }else if(value.kind==='CLAIM_AST'){
    assertExactKeys(value,['kind','claimId','astPath'],[],path);
    assertId(value.claimId,path+'.claimId');
    assertString(value.astPath,path+'.astPath',{nonEmpty:true,trimmed:true,max:1024});
  }else if(value.kind==='RULE'){
    assertExactKeys(value,['kind','ruleId','version','contentHash'],[],path);
    assertId(value.ruleId,path+'.ruleId');
    assertSemVer(value.version,path+'.version');
    assertHash(value.contentHash,path+'.contentHash');
  }else if(value.kind==='MODEL_PROPOSAL'){
    assertExactKeys(value,['kind','provider','providerVersion'],[],path);
    assertId(value.provider,path+'.provider');
    assertString(value.providerVersion,path+'.providerVersion',{nonEmpty:true,trimmed:true,max:128});
  }else{
    reject(REASON_CODES.INVALID_VALUE,'unknown query origin',path+'.kind');
  }
}

function assertSemanticQuery(value){
  assertObject(value,'$');
  assertExactKeys(value,['schema','queryId','revision','mode','expression','filters','origin','expansionClass','contentHash'],[],'$');
  if(value.schema!==SCHEMAS.semanticQuery) reject(REASON_CODES.INVALID_SCHEMA,'semantic query schema','$' + '.schema');
  assertId(value.queryId,'$.queryId');
  assertString(value.revision,'$.revision',{nonEmpty:true,trimmed:true,max:128});
  assertEnum(value.mode,QUERY_MODES,'$.mode');
  assertQueryAst(value.expression,'$.expression',{nodes:0,maxNodes:256,maxDepth:32},[]);
  assertQueryFilters(value.filters,'$.filters');
  assertQueryOrigin(value.origin,'$.origin');
  assertEnum(value.expansionClass,EXPANSION_CLASSES,'$.expansionClass');
  assertHash(value.contentHash,'$.contentHash');
  if(contentHash(value)!==value.contentHash) reject(REASON_CODES.QUERY_HASH_MISMATCH,'semantic query hash mismatch','$.contentHash');
  return true;
}

function createSemanticQuery(definition){
  var value;
  assertObject(definition,'$');
  assertExactKeys(definition,['queryId','revision','mode','expression','filters','origin','expansionClass'],[],'$');
  value={
    schema:SCHEMAS.semanticQuery,
    queryId:definition.queryId,
    revision:definition.revision,
    mode:definition.mode,
    expression:definition.expression,
    filters:definition.filters,
    origin:definition.origin,
    expansionClass:definition.expansionClass
  };
  value.contentHash=Canonical.hashCanonical(value);
  assertSemanticQuery(value);
  return Canonical.copyAndFreeze(value);
}

function assertSourceSnapshot(value){
  var expectedTextHash,expectedSourceHash;
  assertObject(value,'$');
  assertExactKeys(value,['schema','sourceId','revision','language','status','text','textHash','sourceHash'],[],'$');
  if(value.schema!==SCHEMAS.sourceSnapshot) reject(REASON_CODES.INVALID_SCHEMA,'source snapshot schema','$.schema');
  assertId(value.sourceId,'$.sourceId');
  assertString(value.revision,'$.revision',{nonEmpty:true,trimmed:true,max:128});
  assertString(value.language,'$.language',{nonEmpty:true,trimmed:true,max:64});
  if(value.status!=='ADMITTED') reject(REASON_CODES.INVALID_VALUE,'source must be ADMITTED','$.status');
  assertString(value.text,'$.text',{nonEmpty:true,max:2000000});
  if(value.text.length===0) reject(REASON_CODES.INVALID_VALUE,'empty source text','$.text');
  assertHash(value.textHash,'$.textHash');
  assertHash(value.sourceHash,'$.sourceHash');
  expectedTextHash=Canonical.hashText(value.text);
  if(expectedTextHash!==value.textHash) reject(REASON_CODES.SOURCE_HASH_MISMATCH,'text hash mismatch','$.textHash');
  expectedSourceHash=contentHash(without(value,['sourceHash']));
  if(expectedSourceHash!==value.sourceHash) reject(REASON_CODES.SOURCE_HASH_MISMATCH,'source hash mismatch','$.sourceHash');
  return true;
}

function createSourceSnapshot(definition){
  var value;
  assertObject(definition,'$');
  assertExactKeys(definition,['sourceId','revision','language','text'],['status'],'$');
  value={
    schema:SCHEMAS.sourceSnapshot,
    sourceId:definition.sourceId,
    revision:definition.revision,
    language:definition.language,
    status:hasOwn(definition,'status')?definition.status:'ADMITTED',
    text:definition.text,
    textHash:Canonical.hashText(definition.text)
  };
  value.sourceHash=Canonical.hashCanonical(value);
  assertSourceSnapshot(value);
  return Canonical.copyAndFreeze(value);
}

function computeSourceSetHash(sources){
  var refs=[],keys={},sourceIds={},i,source,key;
  if(!Array.isArray(sources)||sources.length===0) reject(REASON_CODES.INVALID_VALUE,'non-empty sources required','$');
  for(i=0;i<sources.length;i++){
    source=sources[i];
    assertSourceSnapshot(source);
    key=source.sourceId+'@'+source.revision;
    if(keys[key]){
      if(keys[key]===source.sourceHash) reject(REASON_CODES.DUPLICATE_SOURCE,'duplicate source snapshot','$['+i+']');
      reject(REASON_CODES.SOURCE_REVISION_CONFLICT,'same source revision has different content','$['+i+']');
    }
    if(sourceIds[source.sourceId]&&sourceIds[source.sourceId]!==source.revision) reject(REASON_CODES.SOURCE_REVISION_CONFLICT,'multiple revisions in one source set','$['+i+']');
    keys[key]=source.sourceHash;
    sourceIds[source.sourceId]=source.revision;
    refs.push({sourceId:source.sourceId,revision:source.revision,sourceHash:source.sourceHash});
  }
  refs.sort(function(a,b){
    var ak=a.sourceId+'@'+a.revision,bk=b.sourceId+'@'+b.revision;
    return ak<bk?-1:ak>bk?1:0;
  });
  return Canonical.hashCanonical({schema:'meridian.source-set/1',sources:refs});
}

function assertQueryRef(value,path){
  assertObject(value,path);
  assertExactKeys(value,['queryId','revision','contentHash'],[],path);
  assertId(value.queryId,path+'.queryId');
  assertString(value.revision,path+'.revision',{nonEmpty:true,trimmed:true,max:128});
  assertHash(value.contentHash,path+'.contentHash');
}

function assertIndexRef(value,path){
  assertObject(value,path);
  assertExactKeys(value,['indexId','version','contentHash'],[],path);
  assertId(value.indexId,path+'.indexId');
  assertSemVer(value.version,path+'.version');
  assertHash(value.contentHash,path+'.contentHash');
}

function assertLocator(value,path){
  assertObject(value,path);
  assertExactKeys(value,['start','end'],['sentenceIndex','paragraphIndex','section','page'],path);
  assertInteger(value.start,0,Number.MAX_SAFE_INTEGER,path+'.start');
  assertInteger(value.end,0,Number.MAX_SAFE_INTEGER,path+'.end');
  if(value.end<=value.start) reject(REASON_CODES.INVALID_LOCATOR,'end must be greater than start',path+'.end');
  if(hasOwn(value,'sentenceIndex')) assertInteger(value.sentenceIndex,0,Number.MAX_SAFE_INTEGER,path+'.sentenceIndex');
  if(hasOwn(value,'paragraphIndex')) assertInteger(value.paragraphIndex,0,Number.MAX_SAFE_INTEGER,path+'.paragraphIndex');
  if(hasOwn(value,'section')) assertString(value.section,path+'.section',{nonEmpty:true,max:512});
  if(hasOwn(value,'page')) assertInteger(value.page,1,Number.MAX_SAFE_INTEGER,path+'.page');
}

function assertSearchHit(value){
  var payload,expectedId;
  assertObject(value,'$');
  assertExactKeys(value,[
    'schema','hitId','queryRef','indexRef','sourceId','sourceRevision','sourceHash',
    'locator','matchedTextHash','contextSpanHash','matchClass','status'
  ],[],'$');
  if(value.schema!==SCHEMAS.searchHit) reject(REASON_CODES.INVALID_SCHEMA,'search hit schema','$.schema');
  assertString(value.hitId,'$.hitId',{nonEmpty:true,trimmed:true,max:128});
  assertQueryRef(value.queryRef,'$.queryRef');
  assertIndexRef(value.indexRef,'$.indexRef');
  assertId(value.sourceId,'$.sourceId');
  assertString(value.sourceRevision,'$.sourceRevision',{nonEmpty:true,trimmed:true,max:128});
  assertHash(value.sourceHash,'$.sourceHash');
  assertLocator(value.locator,'$.locator');
  assertHash(value.matchedTextHash,'$.matchedTextHash');
  assertHash(value.contextSpanHash,'$.contextSpanHash');
  assertEnum(value.matchClass,MATCH_CLASSES,'$.matchClass');
  if(value.status!=='LOCATED') reject(REASON_CODES.LEXICAL_STATUS_FORBIDDEN,'SearchHit status must be LOCATED','$.status');
  payload=without(value,['hitId']);
  expectedId='hit:'+Canonical.hashCanonical(payload).slice(7);
  if(value.hitId!==expectedId) reject(REASON_CODES.INVALID_HASH,'search hit identity mismatch','$.hitId');
  return true;
}

function createSearchHit(definition){
  var value;
  assertObject(definition,'$');
  assertExactKeys(definition,[
    'queryRef','indexRef','sourceId','sourceRevision','sourceHash','locator',
    'matchedTextHash','contextSpanHash','matchClass'
  ],['status'],'$');
  if(hasOwn(definition,'status')&&definition.status!=='LOCATED') reject(REASON_CODES.LEXICAL_STATUS_FORBIDDEN,'lexical hit cannot exceed LOCATED','$.status');
  value={
    schema:SCHEMAS.searchHit,
    queryRef:definition.queryRef,
    indexRef:definition.indexRef,
    sourceId:definition.sourceId,
    sourceRevision:definition.sourceRevision,
    sourceHash:definition.sourceHash,
    locator:definition.locator,
    matchedTextHash:definition.matchedTextHash,
    contextSpanHash:definition.contextSpanHash,
    matchClass:definition.matchClass,
    status:'LOCATED'
  };
  value.hitId='hit:'+Canonical.hashCanonical(value).slice(7);
  assertSearchHit(value);
  return Canonical.copyAndFreeze(value);
}

function assertIndexManifest(value){
  assertObject(value,'$');
  assertExactKeys(value,[
    'schema','indexId','indexType','version','sourceSetHash','tokenizerVersion',
    'normalizationPolicyVersion','recordCount','contentHash'
  ],[],'$');
  if(value.schema!==SCHEMAS.indexManifest) reject(REASON_CODES.INVALID_SCHEMA,'index manifest schema','$.schema');
  assertId(value.indexId,'$.indexId');
  assertString(value.indexType,'$.indexType',{nonEmpty:true,trimmed:true,max:128,pattern:ID_PATTERN});
  assertSemVer(value.version,'$.version');
  assertHash(value.sourceSetHash,'$.sourceSetHash');
  assertString(value.tokenizerVersion,'$.tokenizerVersion',{nonEmpty:true,trimmed:true,max:128});
  assertString(value.normalizationPolicyVersion,'$.normalizationPolicyVersion',{nonEmpty:true,trimmed:true,max:128});
  assertInteger(value.recordCount,0,Number.MAX_SAFE_INTEGER,'$.recordCount');
  assertHash(value.contentHash,'$.contentHash');
  if(contentHash(value)!==value.contentHash) reject(REASON_CODES.INDEX_HASH_MISMATCH,'index manifest hash mismatch','$.contentHash');
  return true;
}

function createIndexManifest(definition){
  var value;
  assertObject(definition,'$');
  assertExactKeys(definition,[
    'indexId','indexType','version','sourceSetHash','tokenizerVersion',
    'normalizationPolicyVersion','recordCount'
  ],[],'$');
  value={
    schema:SCHEMAS.indexManifest,
    indexId:definition.indexId,
    indexType:definition.indexType,
    version:definition.version,
    sourceSetHash:definition.sourceSetHash,
    tokenizerVersion:definition.tokenizerVersion,
    normalizationPolicyVersion:definition.normalizationPolicyVersion,
    recordCount:definition.recordCount
  };
  value.contentHash=Canonical.hashCanonical(value);
  assertIndexManifest(value);
  return Canonical.copyAndFreeze(value);
}

function assertTraceStep(value,path,index){
  var i;
  assertObject(value,path);
  assertExactKeys(value,['ordinal','direction','inputHashes','outputHashes','status','reasonCodes','operationCount'],[],path);
  assertInteger(value.ordinal,0,Number.MAX_SAFE_INTEGER,path+'.ordinal');
  if(value.ordinal!==index) reject(REASON_CODES.INVALID_VALUE,'trace ordinal must be contiguous',path+'.ordinal');
  assertEnum(value.direction,TRACE_DIRECTIONS,path+'.direction');
  assertStringArray(value.inputHashes,path+'.inputHashes',{max:4096,hashes:true});
  assertStringArray(value.outputHashes,path+'.outputHashes',{max:4096,hashes:true});
  assertEnum(value.status,TRACE_STEP_STATUSES,path+'.status');
  assertStringArray(value.reasonCodes,path+'.reasonCodes',{nonEmpty:true,max:128,unique:true,itemMax:128});
  for(i=0;i<value.reasonCodes.length;i++){
    if(!hasOwn(REASON_CODES,value.reasonCodes[i])) reject(REASON_CODES.INVALID_VALUE,'unknown reason code',path+'.reasonCodes['+i+']');
  }
  assertInteger(value.operationCount,0,Number.MAX_SAFE_INTEGER,path+'.operationCount');
}

function traceBase(value){
  return {
    schema:value.schema,
    sourceSetHash:value.sourceSetHash,
    queryRegistryHash:value.queryRegistryHash,
    formulaRegistryHash:value.formulaRegistryHash,
    thesaurusHash:value.thesaurusHash,
    parserVersions:value.parserVersions,
    indexManifests:value.indexManifests,
    steps:value.steps,
    finalStatus:value.finalStatus
  };
}

function assertBidirectionalSearchTrace(value){
  var i,base,expectedId,expectedHash;
  assertObject(value,'$');
  assertExactKeys(value,[
    'schema','traceId','sourceSetHash','queryRegistryHash','formulaRegistryHash',
    'thesaurusHash','parserVersions','indexManifests','steps','finalStatus','contentHash'
  ],[],'$');
  if(value.schema!==SCHEMAS.bidirectionalTrace) reject(REASON_CODES.INVALID_SCHEMA,'trace schema','$.schema');
  assertString(value.traceId,'$.traceId',{nonEmpty:true,trimmed:true,max:128});
  assertHash(value.sourceSetHash,'$.sourceSetHash');
  assertHash(value.queryRegistryHash,'$.queryRegistryHash');
  assertHash(value.formulaRegistryHash,'$.formulaRegistryHash');
  if(value.thesaurusHash!==null) assertHash(value.thesaurusHash,'$.thesaurusHash');
  assertStringArray(value.parserVersions,'$.parserVersions',{max:128,unique:true,itemMax:128});
  if(!Array.isArray(value.indexManifests)) reject(REASON_CODES.INVALID_VALUE,'index manifests array required','$.indexManifests');
  for(i=0;i<value.indexManifests.length;i++) assertIndexManifest(value.indexManifests[i]);
  if(!Array.isArray(value.steps)) reject(REASON_CODES.INVALID_VALUE,'trace steps array required','$.steps');
  for(i=0;i<value.steps.length;i++) assertTraceStep(value.steps[i],'$.steps['+i+']',i);
  assertEnum(value.finalStatus,TRACE_FINAL_STATUSES,'$.finalStatus');
  assertHash(value.contentHash,'$.contentHash');
  base=traceBase(value);
  expectedId='trace:'+Canonical.hashCanonical(base).slice(7);
  if(value.traceId!==expectedId) reject(REASON_CODES.INVALID_HASH,'trace identity mismatch','$.traceId');
  expectedHash=Canonical.hashCanonical(without(value,['contentHash']));
  if(value.contentHash!==expectedHash) reject(REASON_CODES.TRACE_HASH_MISMATCH,'trace content hash mismatch','$.contentHash');
  return true;
}

function createBidirectionalSearchTrace(definition){
  var value,base;
  assertObject(definition,'$');
  assertExactKeys(definition,[
    'sourceSetHash','queryRegistryHash','formulaRegistryHash','thesaurusHash',
    'parserVersions','indexManifests','steps','finalStatus'
  ],[],'$');
  value={
    schema:SCHEMAS.bidirectionalTrace,
    sourceSetHash:definition.sourceSetHash,
    queryRegistryHash:definition.queryRegistryHash,
    formulaRegistryHash:definition.formulaRegistryHash,
    thesaurusHash:definition.thesaurusHash,
    parserVersions:definition.parserVersions,
    indexManifests:definition.indexManifests,
    steps:definition.steps,
    finalStatus:definition.finalStatus
  };
  base=traceBase(value);
  value.traceId='trace:'+Canonical.hashCanonical(base).slice(7);
  value.contentHash=Canonical.hashCanonical(value);
  assertBidirectionalSearchTrace(value);
  return Canonical.copyAndFreeze(value);
}

function canTransition(from,to){
  if(!hasOwn(STATUS_NEXT,from)||!hasOwn(STATUS_NEXT,to)) return false;
  return STATUS_NEXT[from].indexOf(to)!==-1;
}

function assertStatusTransition(from,to){
  if(!hasOwn(STATUS_NEXT,from)) reject(REASON_CODES.STATUS_UNKNOWN,'unknown source status','$.from');
  if(!hasOwn(STATUS_NEXT,to)) reject(REASON_CODES.STATUS_UNKNOWN,'unknown target status','$.to');
  if(!canTransition(from,to)) reject(REASON_CODES.STATUS_JUMP_FORBIDDEN,from+' -> '+to,'$');
  return true;
}

function validationReport(assertion,value){
  try{
    assertion(value);
    return freeze({status:'VALID',code:null,errors:[]});
  }catch(error){
    return freeze({
      status:'INVALID',
      code:error&&error.code?error.code:REASON_CODES.INVALID_VALUE,
      errors:[{
        code:error&&error.code?error.code:REASON_CODES.INVALID_VALUE,
        path:error&&error.path?error.path:'$',
        message:error&&error.message?error.message:String(error)
      }]
    });
  }
}

var api=freeze({
  version:VERSION,
  status:'READY',
  semanticTruth:false,
  schemas:SCHEMAS,
  reasonCodes:REASON_CODES,
  statusLadder:STATUS_LADDER,
  statusNext:STATUS_NEXT,
  createSemanticQuery:createSemanticQuery,
  validateSemanticQuery:function(value){ return validationReport(assertSemanticQuery,value); },
  createSourceSnapshot:createSourceSnapshot,
  validateSourceSnapshot:function(value){ return validationReport(assertSourceSnapshot,value); },
  computeSourceSetHash:computeSourceSetHash,
  createSearchHit:createSearchHit,
  validateSearchHit:function(value){ return validationReport(assertSearchHit,value); },
  createIndexManifest:createIndexManifest,
  validateIndexManifest:function(value){ return validationReport(assertIndexManifest,value); },
  createBidirectionalSearchTrace:createBidirectionalSearchTrace,
  validateBidirectionalSearchTrace:function(value){ return validationReport(assertBidirectionalSearchTrace,value); },
  validateQueryAst:function(value){ return validationReport(function(ast){assertQueryAst(ast,'$',{nodes:0,maxNodes:256,maxDepth:32},[]);},value); },
  canTransition:canTransition,
  assertStatusTransition:assertStatusTransition
});

global.MRDP78SearchContracts=api;
})(typeof globalThis!=='undefined'?globalThis:this);
