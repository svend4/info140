'use strict';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return Object.freeze(value);
}


const cases = [
  {
    caseId: 'system-composition',
    targetResolution: 'RESOLVED',
    answerability: 'ANSWERABLE',
    passages: [{ sourceId: 'p78.holdout.ruwiki.system', sentenceIndex: 0, relation: 'SUPPORTS' }],
  },
  {
    caseId: 'system-negation',
    targetResolution: 'RESOLVED',
    answerability: 'ANSWERABLE',
    passages: [{ sourceId: 'p78.holdout.ruwiki.system', sentenceIndex: 0, relation: 'REFUTES' }],
  },
  {
    caseId: 'document-information',
    targetResolution: 'RESOLVED',
    answerability: 'ANSWERABLE',
    passages: [{ sourceId: 'p78.holdout.ruwiki.document', sentenceIndex: 0, relation: 'SUPPORTS' }],
  },
  {
    caseId: 'algorithm-sequence',
    targetResolution: 'RESOLVED',
    answerability: 'ANSWERABLE',
    passages: [{ sourceId: 'p78.holdout.ruwiki.algorithm', sentenceIndex: 0, relation: 'QUALIFIES' }],
  },
  {
    caseId: 'orbit-motion',
    targetResolution: 'RESOLVED',
    answerability: 'ANSWERABLE',
    passages: [{ sourceId: 'p78.holdout.ruwiki.orbit', sentenceIndex: 0, relation: 'SUPPORTS' }],
  },
  {
    caseId: 'sentence-words',
    targetResolution: 'RESOLVED',
    answerability: 'ANSWERABLE',
    passages: [{ sourceId: 'p78.holdout.ruwiki.sentence', sentenceIndex: 0, relation: 'SUPPORTS' }],
  },
  {
    caseId: 'hypothesis-check',
    targetResolution: 'RESOLVED',
    answerability: 'NONE',
    passages: [],
  },
  {
    caseId: 'model-process',
    targetResolution: 'RESOLVED',
    answerability: 'ANSWERABLE',
    passages: [{ sourceId: 'p78.holdout.ruwiki.modeling', sentenceIndex: 0, relation: 'QUALIFIES' }],
  },
  {
    caseId: 'information-motion',
    targetResolution: 'RESOLVED',
    answerability: 'NONE',
    passages: [],
  },
  {
    caseId: 'text-composition',
    targetResolution: 'RESOLVED',
    answerability: 'ANSWERABLE',
    passages: [{ sourceId: 'p78.holdout.ruwiki.text', sentenceIndex: 0, relation: 'SUPPORTS' }],
  },
  {
    caseId: 'formula-statement',
    targetResolution: 'RESOLVED',
    answerability: 'ANSWERABLE',
    passages: [{ sourceId: 'p78.holdout.ruwiki.formula', sentenceIndex: 0, relation: 'QUALIFIES' }],
  },
  {
    caseId: 'unknown-metaflow',
    targetResolution: 'OOV',
    answerability: 'GUARD',
    expectedGuardCode: 'TARGET_CLAIM_UNRESOLVED',
    passages: [],
  },
];

const thresholds = {
  targetResolutionCoverageMin: 0.80,
  lexicalGoldPassageRecallMin: 0.80,
  candidateGoldPassageRecallMin: 0.70,
  candidatePassagePrecisionMin: 0.80,
  relationMacroF1Min: 0.75,
  noneFalsePositiveRateMax: 0,
  guardRecallMin: 1,
  provenanceCompletenessMin: 1,
  authorityViolationsMax: 0,
  staleSourceRejectionMin: 1,
};

module.exports = deepFreeze({
  schema: 'meridian.ag4-external-holdout-gold/1',
  datasetId: 'p78.ag4.ru.wikipedia-definitions.pilot.v1',
  version: '1.0.0',
  status: 'SEALED',
  annotationPolicy: 'MANUAL_SEMANTIC_LABELS_FROZEN_BEFORE_ENGINE_RUN',
  thresholds,
  cases,
  pins: {
    inputHash: 'sha256:85544bc901d997a559ca6f18138c19cd9b4b72a64dafef7fbd55846db163f692',
    annotationsHash: 'sha256:58521adef05815007bbb44eade8a277ee38889c366f3cf31657b848d5d29507e',
    sourceSetHash: 'sha256:86c5a577ed63a063a75192dfdcb0bdafcda40ea8d89a93cecbf4e1d1d213dbcf',
    holdoutHash: 'sha256:61bee4ff1404dc510d14954e08b3ed11b593176c1ee7332bf66551b04e695466',
    developmentCorpusHash: 'sha256:2c86c05ddead778a58c995a05206f2de4416c38aae6b1b0f903c71d7297126b3',
    developmentSourceSetHash: 'sha256:e1773dad0c379923f6d0b30ef5a04089db163c1f4bbebaaad8b10eee3e4d99b4',
  },
  baseline: {
    evaluatorVersion: '1.0.0',
    gateStatus: 'BLOCKED_FOR_AG5',
    reportHash: 'sha256:83fb9a8db320455181d39bbd6750d0f24ea62d57a7e756064ad2f843e512ed22',
    metrics: {
      targetResolutionCoverage: 0.9090909090909091,
      lexicalGoldPassageRecall: 0.6666666666666666,
      candidateGoldPassageRecall: 0,
      candidatePassagePrecision: null,
      relationMacroF1: 0,
      noneFalsePositiveRate: 0,
      guardRecall: 1,
      provenanceCompleteness: 1,
      authorityViolations: 0,
      staleSourceRejection: 1,
    },
  },
});
