(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var Contracts=global.MRDP78SearchContracts;
var LocalIndex=global.MRDP78LocalTextIndex;
var Corpus=global.MRDP78SearchCorpus;
var Registry=global.MRDP78FormulaRegistry;
var Shape=global.MRDP78FormulaShapeIndex;
var Matcher=global.MRDP78FormulaStructuralMatcher;
var Projector=global.MRDP78QueryProjector;

if(!Canonical||!Contracts||!LocalIndex||!Corpus||!Registry||!Shape||!Matcher||!Projector){
  global.MRDP78BidirectionalRetrieval=Object.freeze({version:VERSION,status:'BLOCKED',code:'BIDIRECTIONAL_DEPENDENCY_UNAVAILABLE'});
  return;
}

var OPTION_KEYS={maxQueries:1,maxOperations:1,maxHits:1,contextChars:1,expectedSourceSetHash:1,expectedIndexHash:1,expectedRegistryHash:1,visitedQueryHashes:1};

function frozen(value){ return Canonical.deepFreeze(value); }
function own(value,key){ return Object.prototype.hasOwnProperty.call(value,key); }
function shortHash(value){ return String(value||'').replace(/^sha256:/,'').slice(0,24); }
function failure(status,code,detail,identity){
  return frozen({
    schema:'meridian.bidirectional-search-result/1',version:VERSION,status:status,code:code,detail:detail||'',
    finalStatus:'ABSTAIN',sourceSetHash:identity&&identity.sourceSetHash||null,indexHash:identity&&identity.indexHash||null,
    registryHash:identity&&identity.registryHash||null,formulaIndexHash:identity&&identity.formulaIndexHash||null,
    patternHash:null,query:null,formulaId:null,located:[],structuralMatches:[],projection:null,evidenceCandidates:[],
    evidenceStatus:'NOT_COMPUTED',semanticTruth:false,soundness:'NOT_COMPUTED',trace:null,traceHash:null,resultHash:null
  });
}
function validateOptions(options){
  var keys=Object.keys(options),i;
  for(i=0;i<keys.length;i++) if(!OPTION_KEYS[keys[i]]) throw Object.assign(new TypeError('unknown option '+keys[i]),{code:'UNKNOWN_FIELD'});
  ['maxQueries','maxOperations','maxHits','contextChars'].forEach(function(key){
    if(own(options,key)&&(!Number.isInteger(options[key])||options[key]<1)) throw Object.assign(new TypeError(key+' must be a positive integer'),{code:'INVALID_VALUE'});
  });
  ['expectedSourceSetHash','expectedIndexHash','expectedRegistryHash'].forEach(function(key){
    if(own(options,key)&&!Canonical.isSha256(options[key])) throw Object.assign(new TypeError(key+' must be SHA-256'),{code:'INVALID_HASH'});
  });
  if(own(options,'visitedQueryHashes')){
    if(!Array.isArray(options.visitedQueryHashes)) throw Object.assign(new TypeError('visitedQueryHashes must be an array'),{code:'INVALID_VALUE'});
    options.visitedQueryHashes.forEach(function(hash){ if(!Canonical.isSha256(hash)) throw Object.assign(new TypeError('visited query hash must be SHA-256'),{code:'INVALID_HASH'}); });
  }
}
function findSignature(formulaId){
  var signatures=Shape.signatures||[],i;
  for(i=0;i<signatures.length;i++) if(signatures[i].formulaRef.formulaId===formulaId) return signatures[i];
  return null;
}
function queryFromText(text){
  var source=String(text||'').trim(),tokens,terms,expression,inputHash;
  if(!source) return null;
  tokens=LocalIndex.tokenize(source);
  if(!tokens.length) return null;
  terms=tokens.map(function(token){ return {node:'Term',value:token.lower,normalization:'LOWER'}; });
  expression=terms.length===1?terms[0]:{node:'Phrase',terms:terms,slop:0};
  inputHash=Canonical.hashText(source);
  return Contracts.createSemanticQuery({
    queryId:'user-'+shortHash(inputHash),revision:'1.0.0',mode:'EXACT',expression:expression,
    filters:{language:'ru',requiredSourceStatus:'ADMITTED'},origin:{kind:'USER',inputHash:inputHash},expansionClass:'EXACT'
  });
}
function sourceById(index,sourceId){
  var i;
  for(i=0;i<index.sources.length;i++) if(index.sources[i].sourceId===sourceId) return index.sources[i];
  return null;
}
function contextByHash(result,hash){
  var contexts=result&&result.contexts||[],i;
  for(i=0;i<contexts.length;i++) if(contexts[i].spanHash===hash) return contexts[i];
  return null;
}
function decorateHit(hit,result,index){
  var context=contextByHash(result,hit.contextSpanHash),source=sourceById(index,hit.sourceId),meta=Corpus.metadataBySourceId[hit.sourceId]||{};
  return frozen({
    hitId:hit.hitId,status:hit.status,sourceId:hit.sourceId,sourceRevision:hit.sourceRevision,sourceHash:hit.sourceHash,
    locator:hit.locator,matchedTextHash:hit.matchedTextHash,contextSpanHash:hit.contextSpanHash,matchClass:hit.matchClass,
    title:meta.title||hit.sourceId,section:meta.section||'',matchedText:source?source.text.slice(hit.locator.start,hit.locator.end):'',
    contextText:context?context.text:'',hitHash:Canonical.hashCanonical(hit)
  });
}
function mergeLocated(groups,index){
  var bySpan={},result=[],i,j,group,hit,key;
  for(i=0;i<groups.length;i++){
    group=groups[i];
    for(j=0;j<(group.hits||[]).length;j++){
      hit=decorateHit(group.hits[j],group,index);
      key=hit.sourceId+'@'+hit.sourceRevision+':'+hit.locator.start+':'+hit.locator.end+':'+hit.matchedTextHash;
      if(!bySpan[key]||hit.hitId<bySpan[key].hitId) bySpan[key]=hit;
    }
  }
  Object.keys(bySpan).sort().forEach(function(key){ result.push(bySpan[key]); });
  return result;
}
function queryRegistryHash(queries){
  var refs=queries.map(function(query){ return {queryId:query.queryId,revision:query.revision,contentHash:query.contentHash}; });
  refs.sort(function(a,b){ return a.contentHash.localeCompare(b.contentHash); });
  return Canonical.hashCanonical({schema:'meridian.query-set/1',queries:refs});
}
function hashes(values,field){
  return values.map(function(value){ return field&&value[field]?value[field]:Canonical.hashCanonical(value); }).sort();
}
function patternForFormula(formulaId){
  return Matcher.createPattern('p78.ui.formula.'+formulaId,[{kind:'FORMULA_ID',formulaId:formulaId}],VERSION);
}

function create(){
  var textIndex=LocalIndex.createIndex(Corpus.records,{indexId:'p78.local-corpus'});
  var formulaManifest=Contracts.createIndexManifest({
    indexId:'p78.formula-shape',indexType:'FORMULA_AST_SHAPE',version:VERSION,sourceSetHash:Shape.sourceSetHash,
    tokenizerVersion:'formula-ast/1',normalizationPolicyVersion:'formula-shape/1.0.0',recordCount:Shape.signatures.length
  });
  var identity=frozen({sourceSetHash:Corpus.sourceSetHash,indexHash:textIndex.indexHash,registryHash:Registry.registryHash,formulaIndexHash:Shape.indexHash});

  function run(text,formulaId,rawOptions){
    var options=rawOptions||{},maxQueries,maxOperations,maxHits,contextChars,visited,directQuery,directResult,shapeSearch,signature,patternOutcome,batch,projectionOutcome,projection,projectedResults=[],queries=[],seenQueries={},operationCount=0,i,query,result,located,steps,trace,payload;
    try{
      validateOptions(options);
      maxQueries=own(options,'maxQueries')?options.maxQueries:24;
      maxOperations=own(options,'maxOperations')?options.maxOperations:4096;
      maxHits=own(options,'maxHits')?options.maxHits:24;
      contextChars=own(options,'contextChars')?options.contextChars:72;
      visited=options.visitedQueryHashes||[];
      if(own(options,'expectedSourceSetHash')&&options.expectedSourceSetHash!==identity.sourceSetHash) return failure('ABSTAIN','STALE_INDEX','source set changed',identity);
      if(own(options,'expectedIndexHash')&&options.expectedIndexHash!==identity.indexHash) return failure('ABSTAIN','STALE_INDEX','text index changed',identity);
      if(own(options,'expectedRegistryHash')&&options.expectedRegistryHash!==identity.registryHash) return failure('ABSTAIN','STALE_INDEX','formula registry changed',identity);
      directQuery=queryFromText(text);
      if(!directQuery) return failure('ABSTAIN','EMPTY_QUERY','enter an exact token or phrase',identity);
      if(visited.indexOf(directQuery.contentHash)!==-1) return failure('ABSTAIN','CYCLE_DETECTED','query was already visited',identity);
      signature=findSignature(formulaId);
      if(!signature) return failure('ABSTAIN','NO_MATCHES','unknown formulaId',identity);

      directResult=LocalIndex.search(textIndex,directQuery,{maxOperations:maxOperations,maxHits:maxHits,contextChars:contextChars,expectedSourceSetHash:identity.sourceSetHash,expectedIndexHash:identity.indexHash});
      operationCount+=directResult.operationCount||0;
      shapeSearch=Shape.findByFormulaId(formulaId,{expectedRegistryHash:identity.registryHash,expectedIndexHash:identity.formulaIndexHash,maxOperations:maxOperations});
      if(shapeSearch.status!=='READY') return failure(shapeSearch.status||'ABSTAIN',shapeSearch.code||'NO_MATCHES','formula shape not found',identity);
      patternOutcome=patternForFormula(formulaId);
      if(patternOutcome.status!=='READY') return failure(patternOutcome.status||'INVALID',patternOutcome.code||'INVALID_VALUE','formula pattern rejected',identity);
      batch=Matcher.matchAll(patternOutcome,{expectedRegistryHash:identity.registryHash,expectedIndexHash:identity.formulaIndexHash,maxOperations:maxOperations});
      operationCount+=batch.operations||0;
      if(batch.status!=='STRUCTURAL_MATCH') return failure(batch.status||'ABSTAIN',batch.code||'NO_MATCHES','formula structure not matched',identity);

      projectionOutcome=Projector.projectFormula(signature,{operationBudget:Math.min(maxOperations,512)});
      if(projectionOutcome.status!=='READY') return failure(projectionOutcome.status,projectionOutcome.code,'formula projection stopped',identity);
      projection=projectionOutcome.projection;
      operationCount+=projectionOutcome.operationCount||0;
      queries=[directQuery]; seenQueries[directQuery.contentHash]=true;
      for(i=0;i<projection.queries.length;i++){
        query=projection.queries[i];
        if(seenQueries[query.contentHash]) continue;
        if(visited.indexOf(query.contentHash)!==-1) continue;
        if(queries.length>=maxQueries) return failure('ABSTAIN','BUDGET_EXCEEDED','query projection budget exceeded',identity);
        seenQueries[query.contentHash]=true; queries.push(query);
        result=LocalIndex.search(textIndex,query,{maxOperations:maxOperations,maxHits:maxHits,contextChars:contextChars,expectedSourceSetHash:identity.sourceSetHash,expectedIndexHash:identity.indexHash});
        operationCount+=result.operationCount||0;
        projectedResults.push(result);
        if(operationCount>maxOperations) return failure('ABSTAIN','BUDGET_EXCEEDED','combined operation budget exceeded',identity);
      }
      located=mergeLocated([directResult].concat(projectedResults),textIndex);
      steps=[
        {ordinal:0,direction:'GREP_TO_AST',inputHashes:[directQuery.contentHash],outputHashes:hashes(directResult.hits||[]).concat(hashes(batch.matches||[],'contentHash')).sort(),status:(directResult.hits.length||batch.matches.length)?'READY':'EMPTY',reasonCodes:[(directResult.hits.length||batch.matches.length)?'MATCHES_LOCATED':'NO_MATCHES'],operationCount:(directResult.operationCount||0)+(batch.operations||0)},
        {ordinal:1,direction:'AST_TO_GREP',inputHashes:[signature.shapeHash],outputHashes:hashes(projection.queries,'contentHash').concat(hashes([].concat.apply([],projectedResults.map(function(item){ return item.hits||[]; })))).sort(),status:projection.queries.length?'READY':'EMPTY',reasonCodes:[projection.queries.length?'READY':'NO_MATCHES'],operationCount:(projectionOutcome.operationCount||0)+projectedResults.reduce(function(sum,item){ return sum+(item.operationCount||0); },0)},
        {ordinal:2,direction:'EVIDENCE_GATE',inputHashes:hashes(located,'hitHash').concat(hashes(batch.matches||[],'contentHash')).sort(),outputHashes:[],status:'ABSTAIN',reasonCodes:['SEMANTIC_TRUTH_FORBIDDEN'],operationCount:0}
      ];
      trace=Contracts.createBidirectionalSearchTrace({
        sourceSetHash:identity.sourceSetHash,queryRegistryHash:queryRegistryHash(queries),formulaRegistryHash:identity.registryHash,
        thesaurusHash:null,parserVersions:['formula-ast/1'],indexManifests:[textIndex.manifest,formulaManifest],steps:steps,finalStatus:'ABSTAIN'
      });
      payload={
        schema:'meridian.bidirectional-search-result/1',version:VERSION,status:'READY',code:null,detail:'',finalStatus:'ABSTAIN',
        sourceSetHash:identity.sourceSetHash,indexHash:identity.indexHash,registryHash:identity.registryHash,formulaIndexHash:identity.formulaIndexHash,
        patternHash:batch.patternHash,query:directQuery,formulaId:formulaId,located:located,structuralMatches:batch.matches,
        projection:projection,evidenceCandidates:[],evidenceStatus:'NOT_COMPUTED',semanticTruth:false,soundness:'NOT_COMPUTED',
        trace:trace,traceHash:trace.contentHash
      };
      payload.resultHash=Canonical.hashCanonical(payload);
      return frozen(payload);
    }catch(error){
      return failure('INVALID',error&&error.code||'INVALID_VALUE',error&&error.message||String(error),identity);
    }
  }

  return frozen({version:VERSION,status:'READY',identity:identity,textIndex:textIndex,formulaManifest:formulaManifest,run:run,replay:run});
}

global.MRDP78BidirectionalRetrieval=frozen({version:VERSION,status:'READY',schema:'meridian.bidirectional-retrieval/1',create:create});
})(typeof globalThis!=='undefined'?globalThis:this);
