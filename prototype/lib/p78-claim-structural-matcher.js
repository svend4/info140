(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var ClaimIR=global.MRDP78ClaimIR;
var Lexicon=global.MRDP78ControlledRussianLexicon;

if(!Canonical||!ClaimIR||ClaimIR.status!=='READY'||!Lexicon||Lexicon.status!=='READY'){
  global.MRDP78ClaimStructuralMatcher=Object.freeze({version:VERSION,status:'BLOCKED',code:'CLAIM_MATCHER_DEPENDENCY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var patternSetHash=Canonical.hashCanonical({
  schema:'meridian.claim-pattern-set/1',
  patterns:Lexicon.structuralPatterns.map(function(pattern){ return {patternId:pattern.patternId,version:pattern.version,contentHash:pattern.contentHash}; })
});

function patternRef(pattern){ return {patternId:pattern.patternId,version:pattern.version,contentHash:pattern.contentHash}; }
function constraint(id,result,rationale){ return {constraintId:id,result:result?'TRUE':'FALSE',rationale:rationale}; }
function actualRoles(claim){
  var roles={};
  claim.arguments.forEach(function(argument){ roles[argument.role]=argument; });
  return roles;
}
function actualQualifierKeys(claim){
  return Object.keys(claim.qualifiers||{}).map(function(key){ return key.toUpperCase(); }).sort();
}
function subset(values,allowed){ return values.every(function(value){ return allowed.indexOf(value)!==-1; }); }
function matchPattern(claim,pattern){
  var roles=actualRoles(claim),qualifierKeys=actualQualifierKeys(claim),predicate=claim.predicate.relationTypeId===pattern.predicateRef.predicateId,
    roleMatch=pattern.roles.every(function(role){ return !!roles[role]; }),polarity=claim.polarity===pattern.polarity,
    modality=claim.modality===pattern.modality,qualifiers=subset(qualifierKeys,pattern.qualifierKeys),constraints,bindings,record;
  if(!predicate||!roleMatch||!polarity||!modality||!qualifiers) return null;
  constraints=[
    constraint(pattern.patternId+':predicate',predicate,'predicateRef equals relationTypeId'),
    constraint(pattern.patternId+':roles',roleMatch,'all closed pattern roles are bound'),
    constraint(pattern.patternId+':polarity',polarity,'polarity is preserved'),
    constraint(pattern.patternId+':modality',modality,'modality is preserved'),
    constraint(pattern.patternId+':qualifiers',qualifiers,'claim qualifiers are admitted by the pattern')
  ];
  bindings={predicate:claim.predicate.senseId||claim.predicate.lemma};
  pattern.roles.forEach(function(role){ bindings[role]=roles[role].senseId||roles[role].surfaceSpanId; });
  record={
    schema:'meridian.structural-match/1',patternRef:patternRef(pattern),candidateRef:claim.claimAstId,candidateKind:'CLAIM_AST',
    bindings:bindings,constraints:constraints,status:'STRUCTURAL_MATCH',parserVersion:claim.parserRef.version,matcherVersion:VERSION
  };
  record.matchId='claim-match:'+Canonical.hashCanonical(record).slice(7);
  record.contentHash=Canonical.hashCanonical(record);
  return freeze(record);
}
function failure(status,code,claimId,operations){
  var payload={
    schema:'meridian.claim-structural-match-batch/1',version:VERSION,status:status,code:code,claimAstId:claimId||null,
    lexiconHash:Lexicon.lexiconHash,patternSetHash:patternSetHash,matches:[],matchCount:0,operations:operations||0,
    evidenceStatus:'NOT_COMPUTED',semanticTruth:false,soundness:'NOT_COMPUTED'
  };
  payload.contentHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}
function matchAll(claim,rawOptions){
  var options=rawOptions||{},keys=Object.keys(options),maxOperations,validation,matches=[],operations=0,i,match,payload;
  try{
    for(i=0;i<keys.length;i++) if(keys[i]!=='expectedLexiconHash'&&keys[i]!=='expectedPatternSetHash'&&keys[i]!=='maxOperations') throw Object.assign(new TypeError('unknown option '+keys[i]),{code:'UNKNOWN_FIELD'});
    if(own.call(options,'expectedLexiconHash')&&options.expectedLexiconHash!==Lexicon.lexiconHash) return failure('ABSTAIN','STALE_LEXICON',claim&&claim.claimAstId,0);
    if(own.call(options,'expectedPatternSetHash')&&options.expectedPatternSetHash!==patternSetHash) return failure('ABSTAIN','STALE_PATTERN_SET',claim&&claim.claimAstId,0);
    maxOperations=own.call(options,'maxOperations')?options.maxOperations:256;
    if(!Number.isInteger(maxOperations)||maxOperations<1) return failure('INVALID','INVALID_BUDGET',claim&&claim.claimAstId,0);
    validation=ClaimIR.validateClaimAst(claim);
    if(validation.status!=='VALID') return failure('INVALID',validation.code||'CLAIM_INVALID',claim&&claim.claimAstId,0);
    if(claim.resolutionStatus!=='RESOLVED') return failure(claim.resolutionStatus,claim.resolutionStatus,claim.claimAstId,0);
    for(i=0;i<Lexicon.structuralPatterns.length;i++){
      operations+=5;
      if(operations>maxOperations) return failure('ABSTAIN','BUDGET_EXCEEDED',claim.claimAstId,operations);
      match=matchPattern(claim,Lexicon.structuralPatterns[i]);
      if(match) matches.push(match);
    }
    matches.sort(function(a,b){ return a.patternRef.patternId.localeCompare(b.patternRef.patternId); });
    payload={
      schema:'meridian.claim-structural-match-batch/1',version:VERSION,status:matches.length?'STRUCTURAL_MATCH':'STRUCTURAL_REJECT',
      code:matches.length?null:'NO_MATCHES',claimAstId:claim.claimAstId,lexiconHash:Lexicon.lexiconHash,patternSetHash:patternSetHash,
      matches:matches,matchCount:matches.length,operations:operations,evidenceStatus:'NOT_COMPUTED',semanticTruth:false,soundness:'NOT_COMPUTED'
    };
    payload.contentHash=Canonical.hashCanonical(payload);
    return freeze(payload);
  }catch(error){ return failure('INVALID',error&&error.code||'INVALID_VALUE',claim&&claim.claimAstId,operations); }
}

global.MRDP78ClaimStructuralMatcher=freeze({
  version:VERSION,status:'READY',schema:'meridian.claim-structural-matcher/1',lexiconHash:Lexicon.lexiconHash,
  patternSetHash:patternSetHash,patternCount:Lexicon.structuralPatterns.length,evidenceStatus:'NOT_COMPUTED',semanticTruth:false,
  matchAll:matchAll,replay:matchAll
});
})(typeof globalThis!=='undefined'?globalThis:this);
