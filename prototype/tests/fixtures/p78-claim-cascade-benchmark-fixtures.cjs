'use strict';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return Object.freeze(value);
}

const pins = {
  corpusHash: 'sha256:2c86c05ddead778a58c995a05206f2de4416c38aae6b1b0f903c71d7297126b3',
  sourceSetHash: 'sha256:e1773dad0c379923f6d0b30ef5a04089db163c1f4bbebaaad8b10eee3e4d99b4',
  sourceCount: 10,
  passageCount: 30,
};

const retrievalTargets = [
  {
    id: 'preserve-positive',
    text: 'Система сохраняет состояние.',
    expectedResolution: 'RESOLVED',
    goldRelevantPassages: [
      'p78.ag4.preservation-contrast#0',
      'p78.ag4.preservation-contrast#1',
    ],
    expectedRelations: {
      SUPPORTS: ['p78.ag4.preservation-contrast#0'],
      REFUTES: ['p78.ag4.preservation-contrast#1'],
      MENTIONS: ['p78.ag4.preservation-contrast#2'],
    },
    expectedUnresolvedCandidates: {
      OOV: ['p78.ag4.continuation-generalization#0'],
      AMBIGUOUS: ['p78.ag4.verification-description#2'],
    },
  },
  {
    id: 'preserve-negative',
    text: 'Система не сохраняет состояние.',
    expectedResolution: 'RESOLVED',
    goldRelevantPassages: [
      'p78.ag4.preservation-contrast#0',
      'p78.ag4.preservation-contrast#1',
    ],
    expectedRelations: {
      SUPPORTS: ['p78.ag4.preservation-contrast#1'],
      REFUTES: ['p78.ag4.preservation-contrast#0'],
      MENTIONS: ['p78.ag4.preservation-contrast#2'],
    },
    expectedUnresolvedCandidates: {
      OOV: ['p78.ag4.continuation-generalization#0'],
      AMBIGUOUS: ['p78.ag4.verification-description#2'],
    },
  },
  {
    id: 'move-positive',
    text: 'Частица движется по орбите.',
    expectedResolution: 'RESOLVED',
    goldRelevantPassages: [
      'p78.ag4.movement-contrast#0',
      'p78.ag4.movement-contrast#1',
    ],
    expectedRelations: {
      SUPPORTS: ['p78.ag4.movement-contrast#0'],
      REFUTES: ['p78.ag4.movement-contrast#1'],
      MENTIONS: ['p78.ag4.movement-contrast#2'],
    },
    expectedUnresolvedCandidates: { OOV: [], AMBIGUOUS: [] },
  },
  {
    id: 'move-negative',
    text: 'Частица не движется по орбите.',
    expectedResolution: 'RESOLVED',
    goldRelevantPassages: [
      'p78.ag4.movement-contrast#0',
      'p78.ag4.movement-contrast#1',
    ],
    expectedRelations: {
      SUPPORTS: ['p78.ag4.movement-contrast#1'],
      REFUTES: ['p78.ag4.movement-contrast#0'],
      MENTIONS: ['p78.ag4.boundary-transition#2'],
    },
    expectedUnresolvedCandidates: { OOV: [], AMBIGUOUS: [] },
  },
  {
    id: 'cause-collapse',
    text: 'Давление вызывает распад.',
    expectedResolution: 'RESOLVED',
    goldRelevantPassages: ['p78.ag4.composition-causality#1'],
    expectedRelations: {
      SUPPORTS: ['p78.ag4.composition-causality#1'],
      REFUTES: [],
      MENTIONS: ['p78.ag4.composition-causality#2'],
    },
    expectedUnresolvedCandidates: { OOV: [], AMBIGUOUS: [] },
  },
  {
    id: 'rotate-orbit',
    text: 'Частица вращается вокруг орбиты.',
    expectedResolution: 'RESOLVED',
    goldRelevantPassages: ['p78.ag4.movement-contrast#2'],
    expectedRelations: {
      SUPPORTS: ['p78.ag4.movement-contrast#2'],
      REFUTES: [],
      MENTIONS: ['p78.ag4.movement-contrast#0'],
    },
    expectedUnresolvedCandidates: { OOV: [], AMBIGUOUS: [] },
  },
  {
    id: 'verify-document',
    text: 'Система проверяет документ.',
    expectedResolution: 'RESOLVED',
    goldRelevantPassages: ['p78.ag4.verification-description#0'],
    expectedRelations: {
      SUPPORTS: ['p78.ag4.verification-description#0'],
      REFUTES: [],
      MENTIONS: ['p78.ag4.verification-description#1'],
    },
    expectedUnresolvedCandidates: {
      OOV: ['p78.ag4.continuation-generalization#0'],
      AMBIGUOUS: ['p78.ag4.verification-description#2'],
    },
  },
  {
    id: 'generalize-information',
    text: 'Система обобщает информацию.',
    expectedResolution: 'RESOLVED',
    goldRelevantPassages: ['p78.ag4.continuation-generalization#2'],
    expectedRelations: {
      SUPPORTS: ['p78.ag4.continuation-generalization#2'],
      REFUTES: [],
      MENTIONS: ['p78.ag4.generalization-detail#0'],
    },
    expectedUnresolvedCandidates: {
      OOV: ['p78.ag4.continuation-generalization#0'],
      AMBIGUOUS: ['p78.ag4.verification-description#2'],
    },
  },
];

const guardTargets = [
  {
    id: 'target-oov-metaflow',
    text: 'Система продолжает метапоток.',
    expectedResolution: 'OOV',
    expectedCascadeCode: 'TARGET_CLAIM_UNRESOLVED',
  },
  {
    id: 'target-ambiguous-description',
    text: 'Система описывает движение.',
    expectedResolution: 'AMBIGUOUS',
    expectedCascadeCode: 'TARGET_CLAIM_UNRESOLVED',
  },
];

const expectedAggregate = {
  evaluatedTargetCount: 8,
  guardTargetCount: 2,
  goldRelevantCount: 12,
  lexical: { retrieved: 54, truePositive: 12, falsePositive: 42, falseNegative: 0 },
  structural: { retrieved: 12, truePositive: 12, falsePositive: 0, falseNegative: 0 },
};

module.exports = deepFreeze({
  schema: 'meridian.claim-cascade-benchmark-fixtures/1',
  version: '1.0.0',
  pins,
  retrievalTargets,
  guardTargets,
  expectedAggregate,
});
