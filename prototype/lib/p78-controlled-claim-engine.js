(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var Parser=global.MRDP78LinguisticParserAdapter;
var Matcher=global.MRDP78ClaimStructuralMatcher;
var Lexicon=global.MRDP78ControlledRussianLexicon;
var Evidence=global.MRDP78EvidenceContracts;

if(!Canonical||!Parser||Parser.status!=='READY'||!Matcher||Matcher.status!=='READY'||!Lexicon||Lexicon.status!=='READY'){
  global.MRDP78ControlledClaimEngine=Object.freeze({version:VERSION,status:'BLOCKED',code:'CONTROLLED_CLAIM_DEPENDENCY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;

function traceStep(ordinal,stage,inputHashes,outputHashes,status,reasons,operations){
  return {ordinal:ordinal,stage:stage,inputHashes:inputHashes.slice().sort(),outputHashes:outputHashes.slice().sort(),status:status,reasonCodes:reasons,operationCount:operations||0};
}
function hashValues(values,field){
  return (values||[]).map(function(value){ return field&&value[field]?value[field]:Canonical.hashCanonical(value); }).sort();
}
function failure(status,code,identity,inputHash,issues){
  var trace={
    schema:'meridian.claim-analysis-trace/1',version:VERSION,parserRef:Parser.parserRef,lexiconHash:identity.lexiconHash,
    patternSetHash:identity.patternSetHash,steps:[traceStep(0,'PARSE_STRUCTURE',[inputHash],[],status,[code],0)],finalStatus:'ABSTAIN'
  },payload;
  trace.contentHash=Canonical.hashCanonical(trace);
  payload={
    schema:'meridian.controlled-claim-result/1',version:VERSION,status:status,code:code,resolutionStatus:status==='AMBIGUOUS'?'AMBIGUOUS':'OOV',
    lexiconHash:identity.lexiconHash,patternSetHash:identity.patternSetHash,inputHash:inputHash,claimAst:null,surfaceBySpanId:{},
    structuralMatches:[],corpusMatches:[],issues:issues||[],evidenceCandidates:[],evidenceStatus:'NOT_COMPUTED',reviewStatus:'REQUIRES_REVIEW',
    semanticTruth:false,soundness:'NOT_COMPUTED',finalStatus:'ABSTAIN',trace:trace,traceHash:trace.contentHash
  };
  payload.resultHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}
function evidenceFailure(code,detail){
  var error=new TypeError(detail||code); error.code=code; throw error;
}
function validateEvidenceResult(value,parsed,cascadeIdentity){
  var candidates,i,report,copy,expectedHash;
  if(!value||typeof value!=='object'||Array.isArray(value)) evidenceFailure('EVIDENCE_CASCADE_RESULT_INVALID','object required');
  candidates=value.evidenceCandidates;
  if(!Array.isArray(candidates)||!Array.isArray(value.passageClaims)) evidenceFailure('EVIDENCE_CASCADE_RESULT_INVALID','candidate arrays required');
  if(value.evidenceStatus!==(candidates.length?'EVIDENCE_CANDIDATE':'NOT_COMPUTED')||value.reviewStatus!=='REQUIRES_REVIEW'||
    value.finalStatus!=='ABSTAIN'||value.finalRelation!=='NOT_COMPUTED'||value.semanticTruth!==false||value.soundness!=='NOT_COMPUTED'){
    evidenceFailure('EVIDENCE_AUTHORITY_BOUNDARY_VIOLATION','cascade exceeded candidate authority');
  }
  if(!value.targetClaimRef||value.targetClaimRef.contentHash!==parsed.claimAst.contentHash) evidenceFailure('EVIDENCE_TARGET_MISMATCH');
  if(cascadeIdentity&&cascadeIdentity.sourceSetHash&&value.sourceSetHash!==cascadeIdentity.sourceSetHash) evidenceFailure('EVIDENCE_SOURCE_SET_MISMATCH');
  if(cascadeIdentity&&cascadeIdentity.linguisticIndexHash&&value.linguisticIndexHash!==cascadeIdentity.linguisticIndexHash) evidenceFailure('EVIDENCE_INDEX_MISMATCH');
  for(i=0;i<candidates.length;i++){
    report=Evidence.validateEvidenceCandidate(candidates[i]);
    if(report.status!=='VALID') evidenceFailure('EVIDENCE_CANDIDATE_INVALID',report.code||'candidate invalid');
    if(candidates[i].targetClaimRef.contentHash!==parsed.claimAst.contentHash) evidenceFailure('EVIDENCE_TARGET_MISMATCH');
  }
  copy=Canonical.deepCopy(value); expectedHash=copy.resultHash; delete copy.resultHash;
  if(!Canonical.isSha256(expectedHash)||Canonical.hashCanonical(copy)!==expectedHash) evidenceFailure('EVIDENCE_RESULT_HASH_MISMATCH');
  return true;
}

function create(rawConfig){
  var config=rawConfig||{},configKeys=Object.keys(config),evidenceCascade=null,i;
  for(i=0;i<configKeys.length;i++) if(configKeys[i]!=='evidenceCascade') throw Object.assign(new TypeError('unknown config '+configKeys[i]),{code:'UNKNOWN_FIELD'});
  if(own.call(config,'evidenceCascade')){
    evidenceCascade=config.evidenceCascade;
    Evidence=Evidence||global.MRDP78EvidenceContracts;
    if(!Evidence||Evidence.status!=='READY'||typeof Evidence.validateEvidenceCandidate!=='function') throw Object.assign(new TypeError('evidence contracts unavailable'),{code:'EVIDENCE_CONTRACTS_UNAVAILABLE'});
    if(!evidenceCascade||evidenceCascade.status!=='READY'||typeof evidenceCascade.run!=='function') throw Object.assign(new TypeError('evidence cascade unavailable'),{code:'EVIDENCE_CASCADE_UNAVAILABLE'});
  }
  var identity=freeze({
    lexiconHash:Lexicon.lexiconHash,patternSetHash:Matcher.patternSetHash,parserRef:Parser.parserRef,
    evidenceCascadeHash:evidenceCascade&&evidenceCascade.identity?evidenceCascade.identity.linguisticIndexHash:null
  });
  function run(text,rawOptions){
    var options=rawOptions||{},keys=Object.keys(options),parserOptions={},matcherOptions={},inputHash=Canonical.hashText(String(text||'').trim()),parsed,batch,steps,trace,status,code,payload,evidence=null,evidenceError=null,evidenceCandidates=[],corpusMatches=[],evidenceStatus='NOT_COMPUTED',j;
    try{
      for(j=0;j<keys.length;j++) if(keys[j]!=='expectedLexiconHash'&&keys[j]!=='expectedPatternSetHash'&&keys[j]!=='maxTokens'&&keys[j]!=='maxOperations') throw Object.assign(new TypeError('unknown option '+keys[j]),{code:'UNKNOWN_FIELD'});
      if(own.call(options,'expectedLexiconHash')) parserOptions.expectedLexiconHash=options.expectedLexiconHash;
      if(own.call(options,'maxTokens')) parserOptions.maxTokens=options.maxTokens;
      if(own.call(options,'expectedPatternSetHash')) matcherOptions.expectedPatternSetHash=options.expectedPatternSetHash;
      if(own.call(options,'expectedLexiconHash')) matcherOptions.expectedLexiconHash=options.expectedLexiconHash;
      if(own.call(options,'maxOperations')) matcherOptions.maxOperations=options.maxOperations;
      parsed=Parser.parse(text,parserOptions);
      if(!parsed.claimAst) return failure(parsed.status,parsed.code,identity,inputHash,parsed.issues);
      batch=Matcher.matchAll(parsed.claimAst,matcherOptions);
      status=parsed.status==='READY'&&batch.status==='STRUCTURAL_MATCH'?'READY':parsed.status;
      code=status==='READY'?null:(parsed.code||batch.code||'STRUCTURAL_REJECT');
      if(parsed.status==='READY'&&batch.status!=='STRUCTURAL_MATCH'){ status='ABSTAIN'; code=batch.code||'STRUCTURAL_REJECT'; }
      if(status==='READY'&&evidenceCascade){
        try{
          evidence=evidenceCascade.run(parsed);
          validateEvidenceResult(evidence,parsed,evidenceCascade.identity);
          evidenceCandidates=evidence.evidenceCandidates;
          corpusMatches=evidence.passageClaims;
          evidenceStatus=evidenceCandidates.length?'EVIDENCE_CANDIDATE':'NOT_COMPUTED';
        }
        catch(cascadeError){
          evidence=null; evidenceCandidates=[]; corpusMatches=[]; evidenceStatus='NOT_COMPUTED';
          evidenceError={code:cascadeError&&cascadeError.code||'EVIDENCE_CASCADE_ERROR',detail:cascadeError&&cascadeError.message||String(cascadeError)};
        }
      }
      steps=[
        traceStep(0,'PARSE_STRUCTURE',[parsed.inputHash],[parsed.claimAst.contentHash],parsed.status,parsed.code?[parsed.code]:['PARSED'],parsed.tokens.length),
        traceStep(1,'MATCH_PATTERN',[parsed.claimAst.contentHash],hashValues(batch.matches,'contentHash'),batch.status==='STRUCTURAL_MATCH'?'READY':batch.status,[batch.code||'STRUCTURAL_MATCH'],batch.operations)
      ];
      if(evidenceCascade){
        steps.push(traceStep(
          2,'DISCOVER_PASSAGES',[parsed.claimAst.contentHash,identity.evidenceCascadeHash],
          evidence&&evidence.query&&evidence.query.contentHash?[evidence.query.contentHash]:[],
          evidenceError?'ABSTAIN':evidence&&evidence.status==='READY'?'READY':evidence&&evidence.status||'EMPTY',
          [evidenceError?evidenceError.code:evidence&&evidence.code||'BROAD_DISCOVERY_COMPLETE'],
          evidence&&evidence.metrics?evidence.metrics.lexicalHitCount:0
        ));
        steps.push(traceStep(
          3,'ALIGN_CLAIMS',hashValues(corpusMatches,'contentHash'),hashValues(evidenceCandidates,'contentHash'),
          evidenceCandidates.length?'READY':'EMPTY',
          [evidenceCandidates.length?'EVIDENCE_CANDIDATES_REVIEW_ONLY':'NO_ALIGNED_CANDIDATES'],
          evidence&&evidence.metrics?evidence.metrics.parsedPassageCount:0
        ));
        steps.push(traceStep(4,'EVIDENCE_GATE',hashValues(evidenceCandidates,'contentHash'),[],'ABSTAIN',['HUMAN_REVIEW_REQUIRED'],0));
      }else{
        steps.push(traceStep(2,'EVIDENCE_GATE',hashValues(batch.matches,'contentHash'),[],'ABSTAIN',['EVIDENCE_NOT_COMPUTED'],0));
      }
      trace={
        schema:'meridian.claim-analysis-trace/1',version:VERSION,parserRef:Parser.parserRef,lexiconHash:identity.lexiconHash,
        patternSetHash:identity.patternSetHash,steps:steps,finalStatus:'ABSTAIN'
      };
      trace.contentHash=Canonical.hashCanonical(trace);
      payload={
        schema:'meridian.controlled-claim-result/1',version:VERSION,status:status,code:code,resolutionStatus:parsed.resolutionStatus,
        lexiconHash:identity.lexiconHash,patternSetHash:identity.patternSetHash,inputHash:parsed.inputHash,claimAst:parsed.claimAst,
        surfaceBySpanId:parsed.surfaceBySpanId,structuralMatches:batch.matches,corpusMatches:corpusMatches,issues:parsed.issues,
        evidenceCandidates:evidenceCandidates,evidenceStatus:evidenceStatus,reviewStatus:'REQUIRES_REVIEW',
        evidenceCascade:evidence,evidenceError:evidenceError,semanticTruth:false,soundness:'NOT_COMPUTED',
        finalStatus:'ABSTAIN',trace:trace,traceHash:trace.contentHash
      };
      payload.resultHash=Canonical.hashCanonical(payload);
      return freeze(payload);
    }catch(error){ return failure('OOV',error&&error.code||'INVALID_VALUE',identity,inputHash,[{code:error&&error.code||'INVALID_VALUE',detail:error&&error.message||String(error)}]); }
  }
  return freeze({version:VERSION,status:'READY',identity:identity,run:run,replay:run});
}

global.MRDP78ControlledClaimEngine=freeze({version:VERSION,status:'READY',schema:'meridian.controlled-claim-engine/1',create:create});
})(typeof globalThis!=='undefined'?globalThis:this);
