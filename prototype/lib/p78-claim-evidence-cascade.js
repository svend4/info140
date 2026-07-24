(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var LinguisticIndex=global.MRDP78LinguisticStructureIndex;
var DefaultCorpus=global.MRDP78ClaimEvidenceCorpus;

if(!Canonical||!LinguisticIndex||LinguisticIndex.status!=='READY'){
  global.MRDP78ClaimEvidenceCascade=Object.freeze({version:VERSION,status:'BLOCKED',code:'CLAIM_EVIDENCE_CASCADE_DEPENDENCY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
function create(rawOptions){
  var options=rawOptions||{},sources=options.sources||(DefaultCorpus&&DefaultCorpus.records),index,identity;
  Object.keys(options).forEach(function(key){ if(key!=='sources'&&key!=='indexId') throw Object.assign(new TypeError('unknown option '+key),{code:'UNKNOWN_FIELD'}); });
  if(!Array.isArray(sources)||!sources.length) throw Object.assign(new TypeError('admitted sources required'),{code:'SOURCES_REQUIRED'});
  index=LinguisticIndex.create(sources,{indexId:options.indexId||'p78.claim-evidence.lexical'});
  identity=freeze({
    sourceSetHash:index.sourceSetHash,linguisticIndexHash:index.linguisticIndexHash,lexicalIndexHash:index.lexicalIndexHash,
    parserRef:index.parserRef,lexiconHash:index.lexiconHash,patternSetHash:index.patternSetHash
  });
  function run(parsed,runOptions){
    var optionsCopy={},keys=Object.keys(runOptions||{}),i;
    for(i=0;i<keys.length;i++) optionsCopy[keys[i]]=runOptions[keys[i]];
    optionsCopy.expectedSourceSetHash=identity.sourceSetHash;
    optionsCopy.expectedLinguisticIndexHash=identity.linguisticIndexHash;
    return LinguisticIndex.findCandidates(index,parsed,optionsCopy);
  }
  return freeze({
    version:VERSION,status:'READY',schema:'meridian.claim-evidence-cascade-runtime/1',identity:identity,
    evidenceStatus:'EVIDENCE_CANDIDATE',reviewStatus:'REQUIRES_REVIEW',finalStatus:'ABSTAIN',semanticTruth:false,
    run:run,replay:run,index:index
  });
}

global.MRDP78ClaimEvidenceCascade=freeze({
  version:VERSION,status:'READY',schema:'meridian.claim-evidence-cascade-factory/1',create:create,
  maxOutputStatus:'EVIDENCE_CANDIDATE',reviewStatus:'REQUIRES_REVIEW',semanticTruth:false
});
})(typeof globalThis!=='undefined'?globalThis:this);
