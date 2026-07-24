(function(global){
'use strict';

var VERSION='1.0.0';
var INDEX_SCHEMA='meridian.linguistic-structure-index/1';
var RESULT_SCHEMA='meridian.claim-candidate-cascade/1';
var SEGMENTER_REF={id:'p78:segmenter:controlled-sentence',version:VERSION,offsetUnit:'UTF16_CODE_UNIT'};
var Canonical=global.MRDP78CanonicalJSON;
var SearchContracts=global.MRDP78SearchContracts;
var LocalTextIndex=global.MRDP78LocalTextIndex;
var Parser=global.MRDP78LinguisticParserAdapter;
var Matcher=global.MRDP78ClaimStructuralMatcher;
var Lexicon=global.MRDP78ControlledRussianLexicon;
var ClaimIR=global.MRDP78ClaimIR;
var Evidence=global.MRDP78EvidenceContracts;

if(!Canonical||!SearchContracts||SearchContracts.status!=='READY'||!LocalTextIndex||LocalTextIndex.status!=='READY'||
  !Parser||Parser.status!=='READY'||!Matcher||Matcher.status!=='READY'||!Lexicon||Lexicon.status!=='READY'||
  !ClaimIR||ClaimIR.status!=='READY'||!Evidence||Evidence.status!=='READY'){
  global.MRDP78LinguisticStructureIndex=Object.freeze({version:VERSION,status:'BLOCKED',code:'LINGUISTIC_INDEX_DEPENDENCY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var STOP=freeze({
  'и':1,'а':1,'но':1,'или':1,'не':1,'ни':1,'нет':1,'без':1,'в':1,'во':1,'на':1,'к':1,'ко':1,'с':1,'со':1,
  'из':1,'от':1,'по':1,'под':1,'над':1,'при':1,'через':1,'между':1,'для':1,'до':1,'после':1,'вокруг':1,
  'что':1,'ли':1,'если':1,'как':1,'это':1,'один':1,'одна':1,'одно':1,'некоторые':1,'все':1,'всё':1,
  'каждый':1,'каждая':1,'большинство':1,'возможно':1,'вероятно':1,'согласно':1,'данным':1
});
var QUALIFIER_ROLES=freeze({TIME:1,PLACE:1,POPULATION:1,METHOD:1,CONDITION:1,MEASURE:1});


function fail(code,message){
  var error=new TypeError(code+(message?': '+message:''));
  error.name='P78LinguisticStructureIndexError';
  error.code=code;
  throw error;
}
function exactOptions(value,allowed){
  Object.keys(value||{}).forEach(function(key){ if(!allowed[key]) fail('UNKNOWN_FIELD',key); });
}
function compareText(a,b){ return a<b?-1:a>b?1:0; }
function sourceKey(value){ return value.sourceId+'@'+value.revision; }
function claimRef(claim){ return Evidence.claimRef(claim); }
function hashWithout(value,key){
  var copy={},keys=Object.keys(value),i;
  for(i=0;i<keys.length;i++) if(keys[i]!==key) copy[keys[i]]=value[keys[i]];
  return Canonical.hashCanonical(copy);
}
function sourceRef(source){ return {sourceId:source.sourceId,revision:source.revision,sourceHash:source.sourceHash}; }
function queryRef(query){ return {queryId:query.queryId,revision:query.revision,contentHash:query.contentHash}; }
function indexRef(index){ return {indexId:index.manifest.indexId,version:index.version,contentHash:index.indexHash}; }
function passageRef(passage){ return {passageId:passage.passageId,sourceSpanId:passage.sourceSpanId,contentHash:passage.contentHash}; }
function matchRefs(batch){
  return (batch.matches||[]).map(function(match){ return {matchId:match.matchId,contentHash:match.contentHash}; }).sort(function(a,b){ return compareText(a.matchId,b.matchId); });
}

function sentenceLocators(text){
  var pattern=/[^.!?]+[.!?]+|[^.!?]+$/gu,locators=[],match,raw,leading,trailing,start,end;
  while((match=pattern.exec(text))!==null){
    raw=match[0];
    leading=(raw.match(/^\s*/u)||[''])[0].length;
    trailing=(raw.match(/\s*$/u)||[''])[0].length;
    start=match.index+leading;
    end=match.index+raw.length-trailing;
    if(end>start) locators.push({start:start,end:end,sentenceIndex:locators.length});
  }
  return locators;
}
function segmentSources(sources){
  var passages=[];
  sources.slice().sort(function(a,b){ return compareText(sourceKey(a),sourceKey(b)); }).forEach(function(source){
    sentenceLocators(source.text).forEach(function(locator){ passages.push(Evidence.createSourcePassage(source,locator)); });
  });
  return passages;
}
function create(sources,rawOptions){
  var options=rawOptions||{},lexicalIndex,passages,base,index;
  exactOptions(options,{indexId:1});
  lexicalIndex=LocalTextIndex.createIndex(sources,{indexId:options.indexId||'p78.claim-evidence.lexical'});
  passages=segmentSources(lexicalIndex.sources);
  base={
    schema:INDEX_SCHEMA,version:VERSION,sourceSetHash:lexicalIndex.manifest.sourceSetHash,
    lexicalIndexHash:lexicalIndex.indexHash,parserRef:Parser.parserRef,lexiconHash:Lexicon.lexiconHash,
    patternSetHash:Matcher.patternSetHash,segmenterRef:SEGMENTER_REF,
    passageRefs:passages.map(passageRef)
  };
  index={
    schema:INDEX_SCHEMA,version:VERSION,sourceSetHash:base.sourceSetHash,lexicalIndexHash:base.lexicalIndexHash,
    parserRef:base.parserRef,lexiconHash:base.lexiconHash,patternSetHash:base.patternSetHash,
    segmenterRef:base.segmenterRef,lexicalIndex:lexicalIndex,passages:passages,passageCount:passages.length
  };
  index.linguisticIndexHash=Canonical.hashCanonical(base);
  return Canonical.copyAndFreeze(index);
}
function validateIndex(index){
  var errors=[],base,expected,expectedPassages,i,report,passage;
  try{
    if(!index||index.schema!==INDEX_SCHEMA||index.version!==VERSION) fail('INVALID_SCHEMA');
    if(index.sourceSetHash!==SearchContracts.computeSourceSetHash(index.lexicalIndex.sources)) fail('STALE_SOURCE_SET');
    if(index.lexicalIndexHash!==index.lexicalIndex.indexHash||LocalTextIndex.validateIndex(index.lexicalIndex).status!=='VALID') fail('STALE_LEXICAL_INDEX');
    if(index.parserRef.id!==Parser.parserRef.id||index.parserRef.version!==Parser.parserRef.version) fail('PARSER_IDENTITY_STALE');
    if(index.lexiconHash!==Lexicon.lexiconHash) fail('LEXICON_STALE');
    if(index.patternSetHash!==Matcher.patternSetHash) fail('PATTERN_SET_STALE');
    if(Canonical.hashCanonical(index.segmenterRef)!==Canonical.hashCanonical(SEGMENTER_REF)) fail('SEGMENTER_IDENTITY_STALE');
    if(!Array.isArray(index.passages)||index.passageCount!==index.passages.length) fail('PASSAGE_COUNT_MISMATCH');
    expectedPassages=segmentSources(index.lexicalIndex.sources);
    if(expectedPassages.length!==index.passages.length) fail('PASSAGE_SOURCE_MISMATCH');
    for(i=0;i<index.passages.length;i++){
      passage=index.passages[i];
      report=Evidence.validateSourcePassage(passage);
      if(report.status!=='VALID') fail(report.code||'PASSAGE_INVALID');
      if(passage.passageId!==expectedPassages[i].passageId||passage.contentHash!==expectedPassages[i].contentHash||
        passage.sourceRef.sourceHash!==expectedPassages[i].sourceRef.sourceHash||passage.text!==expectedPassages[i].text){
        fail('PASSAGE_SOURCE_MISMATCH');
      }
    }
    base={
      schema:index.schema,version:index.version,sourceSetHash:index.sourceSetHash,lexicalIndexHash:index.lexicalIndexHash,
      parserRef:index.parserRef,lexiconHash:index.lexiconHash,patternSetHash:index.patternSetHash,
      segmenterRef:index.segmenterRef,passageRefs:index.passages.map(passageRef)
    };
    expected=Canonical.hashCanonical(base);
    if(expected!==index.linguisticIndexHash) fail('LINGUISTIC_INDEX_HASH_MISMATCH');
    return freeze({status:'VALID',code:null,errors:[]});
  }catch(error){
    errors.push({code:error&&error.code||'INVALID_VALUE',detail:error&&error.message||String(error)});
    return freeze({status:'INVALID',code:errors[0].code,errors:errors});
  }
}

function queryTerms(parsed){
  var seen={},terms=[];
  (parsed.tokens||[]).forEach(function(item){
    var value=String(item.token||item.surface||'').toLocaleLowerCase('ru-RU');
    if(value.length<2||STOP[value]||seen[value]) return;
    seen[value]=true;
    terms.push(value);
  });
  terms.sort(compareText);
  return terms.slice(0,16);
}
function makeQuery(parsed){
  var terms=queryTerms(parsed),items,expression;
  if(!terms.length) fail('EMPTY_DISCOVERY_QUERY');
  items=terms.map(function(value){ return {node:'Term',value:value,normalization:'LOWER'}; });
  expression=items.length===1?items[0]:{node:'Or',items:items};
  return SearchContracts.createSemanticQuery({
    queryId:'p78:claim-query:'+parsed.claimAst.contentHash.slice(7,39),revision:VERSION,mode:'TOKEN',
    expression:expression,filters:{language:'ru',requiredSourceStatus:'ADMITTED'},
    origin:{kind:'CLAIM_AST',claimId:parsed.claimAst.claimAstId,astPath:'$'},expansionClass:'EXACT'
  });
}
function passageForHit(index,hit){
  var i,passage;
  for(i=0;i<index.passages.length;i++){
    passage=index.passages[i];
    if(passage.sourceRef.sourceId===hit.sourceId&&passage.sourceRef.revision===hit.sourceRevision&&
      passage.sourceRef.sourceHash===hit.sourceHash&&
      hit.locator.start>=passage.locator.start&&hit.locator.end<=passage.locator.end) return passage;
  }
  return null;
}
function locatedGroups(index,lexicalResult){
  var groups={},result=[],i,hit,passage,group;
  for(i=0;i<lexicalResult.hits.length;i++){
    hit=lexicalResult.hits[i]; passage=passageForHit(index,hit);
    if(!passage) continue;
    group=groups[passage.passageId];
    if(!group){ group=groups[passage.passageId]={passage:passage,hitIds:[]}; result.push(group); }
    if(group.hitIds.indexOf(hit.hitId)===-1) group.hitIds.push(hit.hitId);
  }
  result.forEach(function(item){ item.hitIds.sort(compareText); });
  result.sort(function(a,b){
    var sourceOrder=compareText(sourceKey(a.passage.sourceRef),sourceKey(b.passage.sourceRef));
    return sourceOrder||a.passage.locator.start-b.passage.locator.start;
  });
  return result;
}
function parserSpanId(textHash,start,end){
  return 'span:'+Canonical.hashCanonical({schema:'meridian.claim-source-span/1',textHash:textHash,start:start,end:end}).slice(7);
}
function spanRecord(spanId,kind,role,passage,start,end){
  var text=passage.text.slice(start,end);
  return {
    spanId:spanId,kind:kind,role:role,localStart:start,localEnd:end,
    sourceStart:passage.locator.start+start,sourceEnd:passage.locator.start+end,textHash:Canonical.hashText(text)
  };
}
function surfaceSpans(parsed,passage){
  var spans=[],claim=parsed.claimAst,bySpan={},frame,forms,predicateToken;
  spans.push(spanRecord(claim.sourceSpanIds[0],'CLAIM',null,passage,0,passage.text.length));
  (parsed.tokens||[]).forEach(function(token){
    bySpan[parserSpanId(parsed.inputHash,token.offset,token.offset+token.surface.length)]=token;
  });
  claim.arguments.forEach(function(argument){
    var token=bySpan[argument.surfaceSpanId];
    if(token) spans.push(spanRecord(argument.surfaceSpanId,'ARGUMENT',argument.role,passage,token.offset,token.offset+token.surface.length));
  });
  frame=Lexicon.getPredicateFrame(claim.predicate.relationTypeId);
  forms=frame?frame.surfaceForms.map(function(value){ return value.toLocaleLowerCase('ru-RU'); }):[];
  predicateToken=(parsed.tokens||[]).filter(function(token){ return forms.indexOf(token.token)!==-1; })[0];
  if(predicateToken){
    spans.push(spanRecord(
      'predicate-span:'+Canonical.hashCanonical({passageId:passage.passageId,start:predicateToken.offset,end:predicateToken.offset+predicateToken.surface.length}).slice(7),
      'PREDICATE',null,passage,predicateToken.offset,predicateToken.offset+predicateToken.surface.length
    ));
  }
  spans.sort(function(a,b){ return a.localStart-b.localStart||a.localEnd-b.localEnd||compareText(a.kind,b.kind); });
  return spans;
}
function createPassageClaim(group,query,index){
  var passage=group.passage,parsed=Parser.parse(passage.text,{expectedLexiconHash:index.lexiconHash}),batch,spans=[],reasonCodes=[],base,value;
  if(parsed.inputHash!==passage.textHash) fail('PASSAGE_TEXT_HASH_MISMATCH');
  if(parsed.claimAst){
    batch=Matcher.matchAll(parsed.claimAst,{expectedLexiconHash:index.lexiconHash,expectedPatternSetHash:index.patternSetHash});
    spans=surfaceSpans(parsed,passage);
  }else batch={status:'NOT_COMPUTED',code:parsed.code,matches:[]};
  reasonCodes.push(parsed.resolutionStatus==='RESOLVED'?'CLAIM_PARSED':parsed.resolutionStatus==='AMBIGUOUS'?'CLAIM_PARSE_AMBIGUOUS':'CLAIM_PARSE_OOV');
  reasonCodes.push(batch.status==='STRUCTURAL_MATCH'?'STRUCTURAL_MATCH':batch.status==='NOT_COMPUTED'?'STRUCTURAL_NOT_COMPUTED':'STRUCTURAL_REJECT');
  base={
    schema:'meridian.passage-claim/1',passageRef:passageRef(passage),sourceRef:passage.sourceRef,
    discoveryRefs:{hitIds:group.hitIds,queryRef:queryRef(query),indexRef:indexRef(index.lexicalIndex)},
    claimAstRef:parsed.claimAst?claimRef(parsed.claimAst):null,parseResultHash:parsed.resultHash,
    resolutionStatus:parsed.resolutionStatus,surfaceSpans:spans,
    spanMapStatus:parsed.claimAst&&spans.length===parsed.claimAst.arguments.length+2?'COMPLETE':'PARTIAL',
    parserIdentity:{parserRef:Parser.parserRef,lexiconHash:index.lexiconHash},
    structural:{status:batch.status,matchRefs:matchRefs(batch),matcherVersion:Matcher.version,patternSetHash:index.patternSetHash},
    reasonCodes:reasonCodes
  };
  value=Canonical.deepCopy(base);
  value.passageClaimId='passage-claim:'+Canonical.hashCanonical(base).slice(7);
  value.contentHash=Canonical.hashCanonical(value);
  return {record:Canonical.copyAndFreeze(value),parsed:parsed,batch:batch};
}

function argumentMap(claim){
  var map={};
  claim.arguments.forEach(function(argument){
    if(!QUALIFIER_ROLES[argument.role]) map[argument.role]=argument;
  });
  return map;
}
function argumentAlignment(target,candidate){
  var left=argumentMap(target),right=argumentMap(candidate),roles=Object.keys(left).concat(Object.keys(right)).filter(function(role,index,all){ return all.indexOf(role)===index; }).sort(compareText),unknown=false,mismatch=false,records=[];
  roles.forEach(function(role){
    var a=left[role],b=right[role],result;
    if(!a||!b) result='MISMATCH';
    else if(a.senseId===null||b.senseId===null) result='UNKNOWN';
    else result=a.senseId===b.senseId?'EXACT':'MISMATCH';
    if(result==='UNKNOWN') unknown=true;
    if(result==='MISMATCH') mismatch=true;
    records.push({role:role,targetSenseId:a?a.senseId:null,passageSenseId:b?b.senseId:null,result:result});
  });
  return {overall:mismatch?'FALSE':unknown?'UNKNOWN':'TRUE',roles:records};
}
function qualifierAlignment(target,candidate){
  var keys=Object.keys(target.qualifiers).concat(Object.keys(candidate.qualifiers)).filter(function(key,index,all){ return all.indexOf(key)===index; }).sort(compareText),records=[],same=true;
  keys.forEach(function(key){
    var hasTarget=own.call(target.qualifiers,key),hasCandidate=own.call(candidate.qualifiers,key),result;
    if(hasTarget&&hasCandidate) result=target.qualifiers[key]===candidate.qualifiers[key]?'EXACT':'CONFLICT';
    else result=hasTarget?'TARGET_ONLY':'PASSAGE_ONLY';
    if(result!=='EXACT') same=false;
    records.push({key:key,targetValue:hasTarget?target.qualifiers[key]:null,passageValue:hasCandidate?candidate.qualifiers[key]:null,result:result});
  });
  return {overall:same?'TRUE':'FALSE',items:records};
}
function createAlignment(target,passageClaim,candidate){
  var predicate=target.predicate.relationTypeId&&candidate.predicate.relationTypeId?
    (target.predicate.relationTypeId===candidate.predicate.relationTypeId?'TRUE':'FALSE'):'UNKNOWN';
  var argumentsResult=argumentAlignment(target,candidate),qualifiersResult=qualifierAlignment(target,candidate);
  var polarity=target.polarity===candidate.polarity?'TRUE':'FALSE';
  var modality=target.modality===candidate.modality?'TRUE':'FALSE';
  var quantifier=target.quantifier===candidate.quantifier?'TRUE':'FALSE';
  var simple={predicate:predicate,arguments:argumentsResult.overall,polarity:polarity,modality:modality,quantifier:quantifier,qualifiers:qualifiersResult.overall};
  var reasons=[
    predicate==='TRUE'?'PREDICATE_ALIGNED':predicate==='FALSE'?'PREDICATE_MISMATCH':'PREDICATE_UNKNOWN',
    argumentsResult.overall==='TRUE'?'ARGUMENTS_ALIGNED':argumentsResult.overall==='FALSE'?'ARGUMENTS_MISMATCH':'ARGUMENTS_UNKNOWN',
    polarity==='TRUE'?'POLARITY_ALIGNED':'POLARITY_OPPOSITE',modality==='TRUE'?'MODALITY_ALIGNED':'MODALITY_MISMATCH',
    quantifier==='TRUE'?'QUANTIFIER_ALIGNED':'QUANTIFIER_MISMATCH',qualifiersResult.overall==='TRUE'?'QUALIFIERS_ALIGNED':'QUALIFIERS_MISMATCH'
  ];
  var base={
    schema:'meridian.claim-alignment/1',targetClaimRef:claimRef(target),passageClaimRef:{passageClaimId:passageClaim.passageClaimId,contentHash:passageClaim.contentHash},
    predicate:{result:predicate==='TRUE'?'EXACT':predicate==='FALSE'?'MISMATCH':'UNKNOWN'},
    arguments:{overall:argumentsResult.overall==='TRUE'?'EXACT':argumentsResult.overall==='FALSE'?'MISMATCH':'UNKNOWN',roles:argumentsResult.roles},
    polarity:{target:target.polarity,passage:candidate.polarity,result:polarity==='TRUE'?'SAME':'OPPOSITE'},
    modality:{target:target.modality,passage:candidate.modality,result:modality==='TRUE'?'EXACT':'MISMATCH'},
    quantifier:{target:target.quantifier,passage:candidate.quantifier,result:quantifier==='TRUE'?'EXACT':'MISMATCH'},
    qualifiers:qualifiersResult.items,gateStatus:predicate==='TRUE'&&argumentsResult.overall==='TRUE'?'CLAIM_ALIGNED':'REJECTED',
    evaluatorRef:{id:'p78:aligner:claim-structure',version:VERSION},reasonCodes:reasons
  },record=Canonical.deepCopy(base);
  record.alignmentId='claim-alignment:'+Canonical.hashCanonical(base).slice(7);
  record.contentHash=Canonical.hashCanonical(record);
  return {simple:simple,reasons:reasons,record:Canonical.copyAndFreeze(record)};
}
function relationFor(alignment){
  if(alignment.predicate!=='TRUE'||alignment.arguments!=='TRUE') return 'MENTIONS';
  if(alignment.polarity==='FALSE'&&alignment.modality==='TRUE'&&alignment.quantifier==='TRUE'&&alignment.qualifiers==='TRUE') return 'REFUTES';
  if(alignment.polarity==='TRUE'&&alignment.modality==='TRUE'&&alignment.quantifier==='TRUE'&&alignment.qualifiers==='TRUE') return 'SUPPORTS';
  if(alignment.polarity==='TRUE') return 'QUALIFIES';
  return 'MENTIONS';
}
function createCandidate(target,passageClaim,passage,alignment,query,index){
  var relation=relationFor(alignment.simple),status=alignment.simple.predicate==='TRUE'&&alignment.simple.arguments==='TRUE'?'STRUCTURALLY_ALIGNED':'CANDIDATE';
  return Evidence.createEvidenceCandidate({
    targetClaimRef:claimRef(target),passageClaimRef:passageClaim.claimAstRef,
    hitIds:passageClaim.discoveryRefs.hitIds,sourceSpanIds:[passage.sourceSpanId],sourceRef:passage.sourceRef,
    locator:passage.locator,passageTextHash:passage.textHash,proposedRelation:relation,alignment:alignment.simple,status:status,
    reasonCodes:['BROAD_LEXICAL_MATCH','SOURCE_PASSAGE_PINNED'].concat(alignment.reasons).concat(['HUMAN_REVIEW_REQUIRED']),
    provenance:{
      sourceSetHash:index.sourceSetHash,queryHash:query.contentHash,lexicalIndexHash:index.lexicalIndexHash,
      linguisticIndexHash:index.linguisticIndexHash,lexiconHash:index.lexiconHash,parserRef:index.parserRef,alignerVersion:VERSION
    }
  });
}
function resultPayload(index,target,query,lexicalResult,passageClaims,alignments,candidates,status,code,operationCount){
  var relationCounts={SUPPORTS:0,REFUTES:0,QUALIFIES:0,MENTIONS:0};
  candidates.forEach(function(candidate){ relationCounts[candidate.proposedRelation]++; });
  var passageById={};
  index.passages.forEach(function(passage){ passageById[passage.passageId]=passage; });
  var locatedPassages=passageClaims.map(function(record){
    return passageById[record.passageRef.passageId]||null;
  }).filter(function(passage){ return !!passage; });
  var value={
    schema:RESULT_SCHEMA,version:VERSION,status:status,code:code,targetClaimRef:claimRef(target),
    sourceSetHash:index.sourceSetHash,linguisticIndexHash:index.linguisticIndexHash,query:query,
    lexicalResult:lexicalResult,locatedPassages:locatedPassages,passageClaims:passageClaims,alignments:alignments,evidenceCandidates:candidates,
    metrics:{
      lexicalHitCount:lexicalResult.hits.length,locatedPassageCount:passageClaims.length,parsedPassageCount:passageClaims.length,
      operationCount:operationCount||0,
      resolvedPassageCount:passageClaims.filter(function(item){ return item.resolutionStatus==='RESOLVED'; }).length,
      structuralPassageCount:passageClaims.filter(function(item){ return item.structural.status==='STRUCTURAL_MATCH'; }).length,
      evidenceCandidateCount:candidates.length,relationCounts:relationCounts
    },
    evidenceStatus:candidates.length?'EVIDENCE_CANDIDATE':'NOT_COMPUTED',reviewStatus:'REQUIRES_REVIEW',
    finalStatus:'ABSTAIN',finalRelation:'NOT_COMPUTED',semanticTruth:false,soundness:'NOT_COMPUTED'
  };
  value.resultHash=Canonical.hashCanonical(value);
  return Canonical.copyAndFreeze(value);
}
function abstain(index,parsed,code){
  var emptyQuery={schema:'meridian.semantic-query/none',contentHash:Canonical.hashCanonical({code:code})};
  var emptyLexical={status:'ABSTAIN',code:code,hits:[],contexts:[],resultHash:Canonical.hashCanonical({code:code,indexHash:index.linguisticIndexHash})};
  return resultPayload(index,parsed.claimAst,emptyQuery,emptyLexical,[],[],[],'ABSTAIN',code);
}
function boundedInteger(options,key,min,max,fallback){
  var value=own.call(options,key)?options[key]:fallback;
  if(!Number.isInteger(value)||value<min||value>max) fail('INVALID_BUDGET',key);
  return value;
}

function findCandidates(index,parsed,rawOptions){
  var options=rawOptions||{},validation,query,lexical,groups,passageClaims=[],alignments=[],candidates=[],i,built,alignment,maxOperations,maxHits,maxPassages,operations=0;
  exactOptions(options,{maxOperations:1,maxHits:1,maxPassages:1,expectedSourceSetHash:1,expectedLinguisticIndexHash:1});
  maxOperations=boundedInteger(options,'maxOperations',1,10000000,100000);
  maxHits=boundedInteger(options,'maxHits',1,100000,512);
  maxPassages=boundedInteger(options,'maxPassages',0,10000,128);
  validation=validateIndex(index);
  if(validation.status!=='VALID') return abstain(index,parsed,validation.code);
  if(own.call(options,'expectedSourceSetHash')&&options.expectedSourceSetHash!==index.sourceSetHash) return abstain(index,parsed,'STALE_SOURCE_SET');
  if(own.call(options,'expectedLinguisticIndexHash')&&options.expectedLinguisticIndexHash!==index.linguisticIndexHash) return abstain(index,parsed,'STALE_LINGUISTIC_INDEX');
  if(!parsed||!parsed.claimAst||ClaimIR.validateClaimAst(parsed.claimAst).status!=='VALID') fail('TARGET_CLAIM_INVALID');
  if(parsed.claimAst.resolutionStatus!=='RESOLVED') return abstain(index,parsed,'TARGET_CLAIM_UNRESOLVED');
  query=makeQuery(parsed);
  lexical=LocalTextIndex.search(index.lexicalIndex,query,{
    maxOperations:maxOperations,maxHits:maxHits,contextChars:0,
    expectedSourceSetHash:index.sourceSetHash,expectedIndexHash:index.lexicalIndexHash
  });
  operations=lexical.operationCount||0;
  if(lexical.status!=='READY') return resultPayload(index,parsed.claimAst,query,lexical,[],[],[],lexical.status,lexical.code,operations);
  groups=locatedGroups(index,lexical);
  operations+=lexical.hits.length;
  if(operations>maxOperations) return resultPayload(index,parsed.claimAst,query,lexical,[],[],[],'ABSTAIN','CASCADE_BUDGET_EXCEEDED',operations);
  if(groups.length>maxPassages) return resultPayload(index,parsed.claimAst,query,lexical,[],[],[],'ABSTAIN','PASSAGE_BUDGET_EXCEEDED',operations);
  for(i=0;i<groups.length;i++){
    built=createPassageClaim(groups[i],query,index); passageClaims.push(built.record);
    operations+=built.parsed.tokens.length+(built.batch.operations||0)+6;
    if(operations>maxOperations) return resultPayload(index,parsed.claimAst,query,lexical,passageClaims,[],[],'ABSTAIN','CASCADE_BUDGET_EXCEEDED',operations);
    if(!built.parsed.claimAst||built.parsed.claimAst.resolutionStatus!=='RESOLVED'||built.batch.status!=='STRUCTURAL_MATCH') continue;
    alignment=createAlignment(parsed.claimAst,built.record,built.parsed.claimAst);
    alignments.push(alignment.record);
    candidates.push(createCandidate(parsed.claimAst,built.record,groups[i].passage,alignment,query,index));
  }
  candidates.sort(function(a,b){ return compareText(a.candidateId,b.candidateId); });
  alignments.sort(function(a,b){ return compareText(a.alignmentId,b.alignmentId); });
  return resultPayload(index,parsed.claimAst,query,lexical,passageClaims,alignments,candidates,'READY',null,operations);
}

global.MRDP78LinguisticStructureIndex=freeze({
  version:VERSION,status:'READY',schema:INDEX_SCHEMA,resultSchema:RESULT_SCHEMA,segmenterRef:freeze(SEGMENTER_REF),
  evidenceStatus:'EVIDENCE_CANDIDATE',reviewStatus:'REQUIRES_REVIEW',semanticTruth:false,soundness:'NOT_COMPUTED',
  create:create,validateIndex:validateIndex,findCandidates:findCandidates,replay:findCandidates,
  segment:function(source){
    if(SearchContracts.validateSourceSnapshot(source).status!=='VALID') fail('SOURCE_INVALID');
    return Canonical.copyAndFreeze(sentenceLocators(source.text).map(function(locator){ return Evidence.createSourcePassage(source,locator); }));
  }
});
})(typeof globalThis!=='undefined'?globalThis:this);
