(function(global){
'use strict';

var VERSION='1.0.0';
var INDEX_SCHEMA='meridian.local-text-index/1';
var RESULT_SCHEMA='meridian.local-search-result/1';
var CONTEXT_SCHEMA='meridian.context-span/1';
var TOKENIZER_VERSION='p78-unicode-tokenizer/1.0.0';
var NORMALIZATION_VERSION='p78-nfc-lower/1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var Contracts=global.MRDP78SearchContracts;

if(!Canonical||!Contracts||Contracts.status!=='READY'){
  global.MRDP78LocalTextIndex=Object.freeze({
    version:VERSION,
    status:'BLOCKED',
    code:!Canonical?'CANONICAL_JSON_UNAVAILABLE':'SEARCH_CONTRACTS_UNAVAILABLE'
  });
  return;
}

var freeze=Canonical.deepFreeze;
var Reasons=Contracts.reasonCodes;
var TOKEN_SOURCE='[\\p{L}\\p{M}\\p{N}]+(?:[-\'\\u2019][\\p{L}\\p{M}\\p{N}]+)*';
var EMPTY_FORMULA_REGISTRY_HASH=Canonical.hashCanonical({schema:'meridian.formula-registry/none',version:VERSION});

function indexError(code,message,path){
  var error=new TypeError(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78LocalTextIndexError';
  error.code=code;
  error.path=path||'$';
  return error;
}

function reject(code,message,path){ throw indexError(code,message,path); }
function hasOwn(value,key){ return Object.prototype.hasOwnProperty.call(value,key); }
function isObject(value){ return Canonical.isPlainObject(value); }
function assertObject(value,path){ if(!isObject(value)) reject(Reasons.INVALID_VALUE,'plain object required',path); }
function assertHash(value,path){ if(!Canonical.isSha256(value)) reject(Reasons.INVALID_HASH,'SHA-256 required',path); }
function assertInteger(value,min,max,path){
  if(!Number.isInteger(value)||value<min||(max!==undefined&&value>max)) reject(Reasons.INVALID_VALUE,'integer out of range',path);
}
function assertString(value,path,nonEmpty){
  if(typeof value!=='string'||(nonEmpty&&value.length===0)) reject(Reasons.INVALID_VALUE,'string rejected',path);
}
function assertExactKeys(value,required,optional,path){
  var allowed={},keys=Object.keys(value),i,key;
  for(i=0;i<required.length;i++) allowed[required[i]]=true;
  for(i=0;i<optional.length;i++) allowed[optional[i]]=true;
  for(i=0;i<required.length;i++) if(!hasOwn(value,required[i])) reject(Reasons.REQUIRED_FIELD_MISSING,required[i],path+'.'+required[i]);
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(!allowed[key]) reject(Reasons.UNKNOWN_FIELD,key,path+'.'+key);
  }
}
function without(value,keyToSkip){
  var result={},keys=Object.keys(value),i,key;
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(key!==keyToSkip) result[key]=value[key];
  }
  return result;
}
function normalizeNfc(value){ return value.normalize('NFC'); }
function normalizeLower(value){ return normalizeNfc(value).toLowerCase(); }
function sourceKey(source){ return source.sourceId+'@'+source.revision; }
function compareText(a,b){ return a<b?-1:a>b?1:0; }

function tokenize(text){
  var pattern=new RegExp(TOKEN_SOURCE,'gu'),tokens=[],match,raw;
  while((match=pattern.exec(text))!==null){
    raw=match[0];
    tokens.push({
      ordinal:tokens.length,
      start:match.index,
      end:match.index+raw.length,
      rawHash:Canonical.hashText(raw),
      nfc:normalizeNfc(raw),
      lower:normalizeLower(raw)
    });
  }
  return tokens;
}

function addPosting(groups,normalization,value,posting){
  var internalKey=normalization+'\u0000'+value,group=groups[internalKey];
  if(!group){
    group={normalization:normalization,value:value,postings:[]};
    groups[internalKey]=group;
  }
  group.postings.push(posting);
}

function buildTerms(tokenStreams){
  var groups=Object.create(null),terms=[],i,j,token,posting,keys,k;
  for(i=0;i<tokenStreams.length;i++){
    for(j=0;j<tokenStreams[i].tokens.length;j++){
      token=tokenStreams[i].tokens[j];
      posting={sourceIndex:i,tokenOrdinal:token.ordinal,start:token.start,end:token.end};
      addPosting(groups,'NONE',token.nfc,posting);
      addPosting(groups,'LOWER',token.lower,posting);
    }
  }
  keys=Object.keys(groups).sort();
  for(k=0;k<keys.length;k++) terms.push(groups[keys[k]]);
  terms.sort(function(a,b){
    var byNormalization=compareText(a.normalization,b.normalization);
    return byNormalization||compareText(a.value,b.value);
  });
  return terms;
}

function validateSource(source,path){
  var report=Contracts.validateSourceSnapshot(source);
  if(report.status!=='VALID') reject(report.code,'invalid source snapshot',path);
}

function validateManifest(manifest,path){
  var report=Contracts.validateIndexManifest(manifest);
  if(report.status!=='VALID') reject(report.code,'invalid index manifest',path);
}

function validateToken(token,source,ordinal,path){
  var raw;
  assertObject(token,path);
  assertExactKeys(token,['ordinal','start','end','rawHash','nfc','lower'],[],path);
  assertInteger(token.ordinal,0,Number.MAX_SAFE_INTEGER,path+'.ordinal');
  if(token.ordinal!==ordinal) reject(Reasons.INVALID_VALUE,'token ordinals must be contiguous',path+'.ordinal');
  assertInteger(token.start,0,source.text.length,path+'.start');
  assertInteger(token.end,0,source.text.length,path+'.end');
  if(token.end<=token.start) reject(Reasons.INVALID_LOCATOR,'token range rejected',path);
  assertHash(token.rawHash,path+'.rawHash');
  assertString(token.nfc,path+'.nfc',true);
  assertString(token.lower,path+'.lower',true);
  raw=source.text.slice(token.start,token.end);
  if(Canonical.hashText(raw)!==token.rawHash) reject(Reasons.SOURCE_HASH_MISMATCH,'token text changed',path+'.rawHash');
  if(normalizeNfc(raw)!==token.nfc||normalizeLower(raw)!==token.lower) reject(Reasons.SOURCE_HASH_MISMATCH,'token normalization changed',path);
  if(ordinal>0&&token.start<0) reject(Reasons.INVALID_LOCATOR,'token ordering rejected',path+'.start');
}

function validatePosting(posting,tokenStreams,path){
  var stream,token;
  assertObject(posting,path);
  assertExactKeys(posting,['sourceIndex','tokenOrdinal','start','end'],[],path);
  assertInteger(posting.sourceIndex,0,tokenStreams.length-1,path+'.sourceIndex');
  stream=tokenStreams[posting.sourceIndex];
  assertInteger(posting.tokenOrdinal,0,stream.tokens.length-1,path+'.tokenOrdinal');
  token=stream.tokens[posting.tokenOrdinal];
  if(posting.start!==token.start||posting.end!==token.end) reject(Reasons.INDEX_HASH_MISMATCH,'posting range differs from token',path);
}

function assertIndex(index){
  var i,j,source,stream,expectedTerms,totalTokens=0,expectedSourceSetHash,expectedIndexHash;
  assertObject(index,'$');
  assertExactKeys(index,['schema','version','manifest','sources','tokenStreams','terms','indexHash'],[],'$');
  if(index.schema!==INDEX_SCHEMA) reject(Reasons.INVALID_SCHEMA,'local index schema','$.schema');
  if(index.version!==VERSION) reject(Reasons.INVALID_VALUE,'local index version','$.version');
  validateManifest(index.manifest,'$.manifest');
  if(!Array.isArray(index.sources)||index.sources.length===0) reject(Reasons.INVALID_VALUE,'non-empty source array required','$.sources');
  if(!Array.isArray(index.tokenStreams)||index.tokenStreams.length!==index.sources.length) reject(Reasons.INVALID_VALUE,'token stream count mismatch','$.tokenStreams');
  if(!Array.isArray(index.terms)) reject(Reasons.INVALID_VALUE,'term array required','$.terms');
  assertHash(index.indexHash,'$.indexHash');

  for(i=0;i<index.sources.length;i++){
    source=index.sources[i];
    validateSource(source,'$.sources['+i+']');
    if(i>0&&compareText(sourceKey(index.sources[i-1]),sourceKey(source))>=0) reject(Reasons.DUPLICATE_SOURCE,'sources must be unique and sorted','$.sources['+i+']');
    stream=index.tokenStreams[i];
    assertObject(stream,'$.tokenStreams['+i+']');
    assertExactKeys(stream,['sourceId','sourceRevision','sourceHash','tokens'],[],'$.tokenStreams['+i+']');
    if(stream.sourceId!==source.sourceId||stream.sourceRevision!==source.revision||stream.sourceHash!==source.sourceHash) reject(Reasons.SOURCE_HASH_MISMATCH,'token stream source reference changed','$.tokenStreams['+i+']');
    if(!Array.isArray(stream.tokens)) reject(Reasons.INVALID_VALUE,'tokens array required','$.tokenStreams['+i+'].tokens');
    for(j=0;j<stream.tokens.length;j++){
      validateToken(stream.tokens[j],source,j,'$.tokenStreams['+i+'].tokens['+j+']');
      if(j>0&&stream.tokens[j].start<stream.tokens[j-1].end) reject(Reasons.INVALID_LOCATOR,'overlapping tokens','$.tokenStreams['+i+'].tokens['+j+']');
    }
    totalTokens+=stream.tokens.length;
  }

  for(i=0;i<index.terms.length;i++){
    assertObject(index.terms[i],'$.terms['+i+']');
    assertExactKeys(index.terms[i],['normalization','value','postings'],[],'$.terms['+i+']');
    if(index.terms[i].normalization!=='NONE'&&index.terms[i].normalization!=='LOWER') reject(Reasons.INVALID_VALUE,'term normalization rejected','$.terms['+i+'].normalization');
    assertString(index.terms[i].value,'$.terms['+i+'].value',true);
    if(!Array.isArray(index.terms[i].postings)||index.terms[i].postings.length===0) reject(Reasons.INVALID_VALUE,'postings required','$.terms['+i+'].postings');
    for(j=0;j<index.terms[i].postings.length;j++) validatePosting(index.terms[i].postings[j],index.tokenStreams,'$.terms['+i+'].postings['+j+']');
  }

  expectedSourceSetHash=Contracts.computeSourceSetHash(index.sources);
  if(expectedSourceSetHash!==index.manifest.sourceSetHash) reject(Reasons.STALE_INDEX,'source set hash changed','$.manifest.sourceSetHash');
  if(index.manifest.recordCount!==totalTokens) reject(Reasons.INDEX_HASH_MISMATCH,'manifest record count changed','$.manifest.recordCount');
  expectedTerms=buildTerms(index.tokenStreams);
  if(Canonical.canonicalize(expectedTerms)!==Canonical.canonicalize(index.terms)) reject(Reasons.INDEX_HASH_MISMATCH,'term postings changed','$.terms');
  expectedIndexHash=Canonical.hashCanonical(without(index,'indexHash'));
  if(expectedIndexHash!==index.indexHash) reject(Reasons.INDEX_HASH_MISMATCH,'local index hash changed','$.indexHash');
  return true;
}

function createIndex(sources,options){
  var sorted,sourceSetHash,tokenStreams=[],totalTokens=0,i,tokens,manifest,index;
  options=options||{};
  assertObject(options,'$.options');
  assertExactKeys(options,[],['indexId'],'$.options');
  if(!Array.isArray(sources)||sources.length===0) reject(Reasons.INVALID_VALUE,'non-empty source array required','$.sources');
  for(i=0;i<sources.length;i++) validateSource(sources[i],'$.sources['+i+']');
  sourceSetHash=Contracts.computeSourceSetHash(sources);
  sorted=sources.slice().sort(function(a,b){ return compareText(sourceKey(a),sourceKey(b)); });
  sorted=sorted.map(function(source){ return Canonical.deepCopy(source); });
  for(i=0;i<sorted.length;i++){
    tokens=tokenize(sorted[i].text);
    totalTokens+=tokens.length;
    tokenStreams.push({
      sourceId:sorted[i].sourceId,
      sourceRevision:sorted[i].revision,
      sourceHash:sorted[i].sourceHash,
      tokens:tokens
    });
  }
  manifest=Contracts.createIndexManifest({
    indexId:hasOwn(options,'indexId')?options.indexId:'p78.local-text',
    indexType:'TOKEN_POSITION_EXACT',
    version:VERSION,
    sourceSetHash:sourceSetHash,
    tokenizerVersion:TOKENIZER_VERSION,
    normalizationPolicyVersion:NORMALIZATION_VERSION,
    recordCount:totalTokens
  });
  index={
    schema:INDEX_SCHEMA,
    version:VERSION,
    manifest:manifest,
    sources:sorted,
    tokenStreams:tokenStreams,
    terms:buildTerms(tokenStreams)
  };
  index.indexHash=Canonical.hashCanonical(index);
  assertIndex(index);
  return Canonical.copyAndFreeze(index);
}

function validationReport(assertion,value){
  try{
    assertion(value);
    return freeze({status:'VALID',code:null,errors:[]});
  }catch(error){
    return freeze({
      status:'INVALID',
      code:error&&error.code?error.code:Reasons.INVALID_VALUE,
      errors:[{
        code:error&&error.code?error.code:Reasons.INVALID_VALUE,
        path:error&&error.path?error.path:'$',
        message:error&&error.message?error.message:String(error)
      }]
    });
  }
}

function createBudget(options){
  var budget={
    maxOperations:hasOwn(options,'maxOperations')?options.maxOperations:100000,
    maxHits:hasOwn(options,'maxHits')?options.maxHits:256,
    contextChars:hasOwn(options,'contextChars')?options.contextChars:96,
    operations:0
  };
  assertInteger(budget.maxOperations,1,10000000,'$.options.maxOperations');
  assertInteger(budget.maxHits,1,100000,'$.options.maxHits');
  assertInteger(budget.contextChars,0,4096,'$.options.contextChars');
  return budget;
}

function spend(budget,count){
  budget.operations+=count||1;
  if(budget.operations>budget.maxOperations) reject(Reasons.BUDGET_EXCEEDED,'search operation budget exceeded','$');
}

function queryTermValue(term){
  var parsed;
  if(term.normalization==='LEMMA') reject(Reasons.QUERY_MODE_UNSUPPORTED,'lemma index is not part of AG2','$.expression');
  parsed=tokenize(term.value);
  if(parsed.length!==1||parsed[0].start!==0||parsed[0].end!==term.value.length) reject(Reasons.EMPTY_QUERY,'Term must contain exactly one token','$.expression');
  return term.normalization==='NONE'?parsed[0].nfc:parsed[0].lower;
}

function termCompare(entry,normalization,value){
  var byNormalization=compareText(entry.normalization,normalization);
  return byNormalization||compareText(entry.value,value);
}

function findTerm(index,normalization,value,budget){
  var low=0,high=index.terms.length-1,mid,comparison;
  while(low<=high){
    spend(budget,1);
    mid=(low+high)>>>1;
    comparison=termCompare(index.terms[mid],normalization,value);
    if(comparison===0) return index.terms[mid];
    if(comparison<0) low=mid+1;
    else high=mid-1;
  }
  return null;
}

function sourceAllowed(source,filters){
  if(hasOwn(filters,'sourceIds')&&filters.sourceIds.indexOf(source.sourceId)===-1) return false;
  if(hasOwn(filters,'language')&&filters.language!==source.language) return false;
  return true;
}

function matchTerm(index,query,term,budget){
  var value=queryTermValue(term),entry=findTerm(index,term.normalization,value,budget),matches=[],i,posting,source;
  if(!entry) return matches;
  for(i=0;i<entry.postings.length;i++){
    spend(budget,1);
    posting=entry.postings[i];
    source=index.sources[posting.sourceIndex];
    if(!sourceAllowed(source,query.filters)) continue;
    matches.push({
      sourceIndex:posting.sourceIndex,
      start:posting.start,
      end:posting.end,
      tokenStart:posting.tokenOrdinal,
      tokenEnd:posting.tokenOrdinal,
      matchClass:query.mode==='TOKEN'?'TOKEN':'EXACT'
    });
  }
  return matches;
}

function tokenMatchesTerm(token,term){
  var value=queryTermValue(term);
  return term.normalization==='NONE'?token.nfc===value:token.lower===value;
}

function matchPhrase(index,query,phrase,budget){
  var matches=[],i,j,start,stream,tokens,matched;
  if(phrase.slop!==0) reject(Reasons.QUERY_NODE_UNSUPPORTED,'AG2 supports exact phrase slop=0 only','$.expression.slop');
  for(i=0;i<index.tokenStreams.length;i++){
    if(!sourceAllowed(index.sources[i],query.filters)) continue;
    stream=index.tokenStreams[i];
    tokens=stream.tokens;
    for(start=0;start+phrase.terms.length<=tokens.length;start++){
      matched=true;
      for(j=0;j<phrase.terms.length;j++){
        spend(budget,1);
        if(!tokenMatchesTerm(tokens[start+j],phrase.terms[j])){
          matched=false;
          break;
        }
      }
      if(matched){
        matches.push({
          sourceIndex:i,
          start:tokens[start].start,
          end:tokens[start+phrase.terms.length-1].end,
          tokenStart:start,
          tokenEnd:start+phrase.terms.length-1,
          matchClass:'EXACT'
        });
      }
    }
  }
  return matches;
}

function evaluateExpression(index,query,expression,budget){
  var matches=[],i,child;
  if(expression.node==='Term') return matchTerm(index,query,expression,budget);
  if(expression.node==='Phrase') return matchPhrase(index,query,expression,budget);
  if(expression.node==='Or'){
    for(i=0;i<expression.items.length;i++){
      child=evaluateExpression(index,query,expression.items[i],budget);
      matches=matches.concat(child);
    }
    return matches;
  }
  reject(Reasons.QUERY_NODE_UNSUPPORTED,'Query AST node is outside AG2 exact index','$.expression.node');
}

function matchKey(match,index){
  return index.sources[match.sourceIndex].sourceHash+':'+match.start+':'+match.end;
}

function deduplicateMatches(matches,index){
  var seen=Object.create(null),result=[],i,key;
  matches.sort(function(a,b){
    var sourceOrder=compareText(sourceKey(index.sources[a.sourceIndex]),sourceKey(index.sources[b.sourceIndex]));
    if(sourceOrder) return sourceOrder;
    if(a.start!==b.start) return a.start-b.start;
    if(a.end!==b.end) return a.end-b.end;
    return compareText(a.matchClass,b.matchClass);
  });
  for(i=0;i<matches.length;i++){
    key=matchKey(matches[i],index);
    if(seen[key]) continue;
    seen[key]=true;
    result.push(matches[i]);
  }
  return result;
}

function safeContextStart(text,value){
  if(value>0&&value<text.length){
    if(text.charCodeAt(value)>=0xdc00&&text.charCodeAt(value)<=0xdfff&&text.charCodeAt(value-1)>=0xd800&&text.charCodeAt(value-1)<=0xdbff) return value-1;
  }
  return value;
}

function safeContextEnd(text,value){
  if(value>0&&value<text.length){
    if(text.charCodeAt(value-1)>=0xd800&&text.charCodeAt(value-1)<=0xdbff&&text.charCodeAt(value)>=0xdc00&&text.charCodeAt(value)<=0xdfff) return value+1;
  }
  return value;
}

function createContext(source,match,contextChars){
  var start=safeContextStart(source.text,Math.max(0,match.start-contextChars));
  var end=safeContextEnd(source.text,Math.min(source.text.length,match.end+contextChars));
  var text=source.text.slice(start,end),textHash=Canonical.hashText(text),payload,spanHash;
  payload={
    schema:CONTEXT_SCHEMA,
    sourceId:source.sourceId,
    sourceRevision:source.revision,
    sourceHash:source.sourceHash,
    start:start,
    end:end,
    text:text,
    textHash:textHash
  };
  spanHash=Canonical.hashCanonical(payload);
  payload.spanId='span:'+spanHash.slice(7);
  payload.spanHash=spanHash;
  return payload;
}

function queryRef(query){
  return {queryId:query.queryId,revision:query.revision,contentHash:query.contentHash};
}

function indexRef(index){
  return {indexId:index.manifest.indexId,version:index.version,contentHash:index.indexHash};
}

function makeTrace(index,query,status,code,hits,operationCount){
  var outputs=hits.map(function(hit){ return Canonical.hashCanonical(hit); });
  var stepStatus=status==='READY'?'READY':status==='EMPTY'?'EMPTY':'ABSTAIN';
  var finalStatus=status==='READY'?'CONTINUE':status==='EMPTY'?'REPAIR':'ABSTAIN';
  var queryRegistryHash=Canonical.hashCanonical({schema:'meridian.query-set/1',queries:[queryRef(query)]});
  return Contracts.createBidirectionalSearchTrace({
    sourceSetHash:index.manifest.sourceSetHash,
    queryRegistryHash:queryRegistryHash,
    formulaRegistryHash:EMPTY_FORMULA_REGISTRY_HASH,
    thesaurusHash:null,
    parserVersions:[],
    indexManifests:[index.manifest],
    steps:[{
      ordinal:0,
      direction:'GREP_TO_AST',
      inputHashes:[query.contentHash,index.indexHash],
      outputHashes:outputs,
      status:stepStatus,
      reasonCodes:[code],
      operationCount:operationCount
    }],
    finalStatus:finalStatus
  });
}

function makeResult(index,query,status,code,hits,contexts,operationCount){
  var trace=makeTrace(index,query,status,code,hits,operationCount),value;
  value={
    schema:RESULT_SCHEMA,
    status:status,
    code:code,
    semanticTruth:false,
    maxStatus:'LOCATED',
    queryRef:queryRef(query),
    indexRef:indexRef(index),
    sourceSetHash:index.manifest.sourceSetHash,
    hits:hits,
    contexts:contexts,
    operationCount:operationCount,
    trace:trace
  };
  value.resultHash=Canonical.hashCanonical(value);
  return Canonical.copyAndFreeze(value);
}

function refuse(index,query,code,operationCount){
  return makeResult(index,query,'ABSTAIN',hasOwn(Reasons,code)?code:Reasons.INVALID_VALUE,[],[],operationCount||0);
}

function assertOptions(options){
  var i;
  assertObject(options,'$.options');
  assertExactKeys(options,[],[
    'maxOperations','maxHits','contextChars','expectedSourceSetHash','expectedIndexHash','visitedQueryHashes'
  ],'$.options');
  if(hasOwn(options,'expectedSourceSetHash')) assertHash(options.expectedSourceSetHash,'$.options.expectedSourceSetHash');
  if(hasOwn(options,'expectedIndexHash')) assertHash(options.expectedIndexHash,'$.options.expectedIndexHash');
  if(hasOwn(options,'visitedQueryHashes')){
    if(!Array.isArray(options.visitedQueryHashes)) reject(Reasons.INVALID_VALUE,'visited query hashes array required','$.options.visitedQueryHashes');
    for(i=0;i<options.visitedQueryHashes.length;i++) assertHash(options.visitedQueryHashes[i],'$.options.visitedQueryHashes['+i+']');
  }
}

function search(index,query,options){
  var budget,matches,hits=[],contexts=[],i,source,context,hit,indexReport,queryReport;
  options=options||{};
  assertOptions(options);
  queryReport=Contracts.validateSemanticQuery(query);
  if(queryReport.status!=='VALID') reject(queryReport.code,'invalid semantic query','$');
  indexReport=validationReport(assertIndex,index);
  if(indexReport.status!=='VALID') return refuse(index,query,indexReport.code,0);
  budget=createBudget(options);

  if(hasOwn(options,'expectedSourceSetHash')&&options.expectedSourceSetHash!==index.manifest.sourceSetHash) return refuse(index,query,Reasons.STALE_INDEX,budget.operations);
  if(hasOwn(options,'expectedIndexHash')&&options.expectedIndexHash!==index.indexHash) return refuse(index,query,Reasons.STALE_INDEX,budget.operations);
  if(hasOwn(options,'visitedQueryHashes')&&options.visitedQueryHashes.indexOf(query.contentHash)!==-1) return refuse(index,query,Reasons.CYCLE_DETECTED,budget.operations);
  if(query.mode!=='EXACT'&&query.mode!=='TOKEN') return refuse(index,query,Reasons.QUERY_MODE_UNSUPPORTED,budget.operations);
  if(hasOwn(query.filters,'dateCutoff')||hasOwn(query.filters,'genre')) return refuse(index,query,Reasons.QUERY_MODE_UNSUPPORTED,budget.operations);

  try{
    matches=evaluateExpression(index,query,query.expression,budget);
    matches=deduplicateMatches(matches,index);
    if(matches.length>budget.maxHits) return refuse(index,query,Reasons.BUDGET_EXCEEDED,budget.operations);
    if(matches.length===0) return makeResult(index,query,'EMPTY',Reasons.OOV_TERM,[],[],budget.operations);

    for(i=0;i<matches.length;i++){
      source=index.sources[matches[i].sourceIndex];
      context=createContext(source,matches[i],budget.contextChars);
      hit=Contracts.createSearchHit({
        queryRef:queryRef(query),
        indexRef:indexRef(index),
        sourceId:source.sourceId,
        sourceRevision:source.revision,
        sourceHash:source.sourceHash,
        locator:{start:matches[i].start,end:matches[i].end},
        matchedTextHash:Canonical.hashText(source.text.slice(matches[i].start,matches[i].end)),
        contextSpanHash:context.spanHash,
        matchClass:matches[i].matchClass
      });
      contexts.push(context);
      hits.push(hit);
    }
    return makeResult(index,query,'READY',Reasons.MATCHES_LOCATED,hits,contexts,budget.operations);
  }catch(error){
    if(error&&error.code) return refuse(index,query,error.code,budget.operations);
    throw error;
  }
}

var api=freeze({
  version:VERSION,
  status:'READY',
  schema:INDEX_SCHEMA,
  resultSchema:RESULT_SCHEMA,
  contextSchema:CONTEXT_SCHEMA,
  tokenizerVersion:TOKENIZER_VERSION,
  normalizationPolicyVersion:NORMALIZATION_VERSION,
  semanticTruth:false,
  maxOutputStatus:'LOCATED',
  createIndex:createIndex,
  validateIndex:function(value){ return validationReport(assertIndex,value); },
  search:search,
  replay:search,
  tokenize:function(text){
    assertString(text,'$',false);
    return Canonical.copyAndFreeze(tokenize(text));
  }
});

global.MRDP78LocalTextIndex=api;
})(typeof globalThis!=='undefined'?globalThis:this);
