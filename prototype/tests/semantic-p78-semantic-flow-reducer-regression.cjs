'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts', 'p78-local-text-index',
  'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
  'p78-claim-structural-matcher', 'p78-evidence-contracts', 'p78-claim-evidence-corpus',
  'p78-linguistic-structure-index', 'p78-claim-evidence-cascade', 'p78-controlled-claim-engine',
  'p78-semantic-work-contracts', 'p78-semantic-flow-reducer',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const Cascade = global.MRDP78ClaimEvidenceCascade.create();
const Engine = global.MRDP78ControlledClaimEngine.create({ evidenceCascade: Cascade });
const PlainEngine = global.MRDP78ControlledClaimEngine.create();
const Flow = global.MRDP78SemanticFlowReducer;
const checks = [];
const MOVEMENT = '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435.';
const AMBIGUOUS = '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u043e\u043f\u0438\u0441\u044b\u0432\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435.';

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
function rehash(value, field) {
  delete value[field];
  value[field] = Canonical.hashCanonical(value);
}
function stage(frame, operator) { return frame.workItems.find((item) => item.operatorId === operator); }

check('API publishes an immutable routing-only policy', () => {
  assert.equal(Flow.status, 'READY');
  assert.equal(Flow.schema, 'meridian.semantic-flow-frame/1');
  assert(Object.isFrozen(Flow) && Object.isFrozen(Flow.policy));
  assert.equal(Flow.policy.authority, 'ROUTING_DIAGNOSTIC_ONLY');
  assert.equal(Flow.policy.terminalStatus, 'ABSTAIN');
  assert.equal(Flow.policy.executionModel, 'POST_HOC_AG4_PROJECTION');
  assert.equal(Flow.policy.metricDefinitions.relationConcentration.formula, 'maxProposedRelationCount/candidateCount; NOT_COMPUTED when candidateCount=0');
  assert.equal(Flow.deltaSchema, 'meridian.semantic-flow-delta/1');
});

check('real AG4 result becomes a fixed five-stage review queue', () => {
  const result = Engine.run(MOVEMENT);
  const frame = Flow.reduce(result);
  assert.equal(frame.state, 'REVIEW_QUEUE');
  assert.deepEqual(frame.workItems.map((item) => item.operatorId), ['INPUT', 'PARSE', 'DISCOVER', 'ALIGN', 'REVIEW']);
  assert.deepEqual(frame.workItems.map((item) => item.state), ['SHIPPED', 'SHIPPED', 'SHIPPED', 'SHIPPED', 'PARKED']);
  assert.deepEqual(stage(frame, 'REVIEW').reasonCodes, ['HUMAN_REVIEW_REQUIRED']);
  assert.equal(frame.semanticTruth, false);
  assert.equal(frame.finalStatus, 'ABSTAIN');
  assert.equal(frame.authority, 'ROUTING_DIAGNOSTIC_ONLY');
});

check('candidate metrics are measured from candidates and expose the conflict without resolving it', () => {
  const frame = Flow.reduce(Engine.run(MOVEMENT));
  assert.deepEqual({
    candidateCount: frame.metrics.candidateCount, supportCount: frame.metrics.supportCount,
    refuteCount: frame.metrics.refuteCount, qualifyCount: frame.metrics.qualifyCount,
    mentionCount: frame.metrics.mentionCount,
  }, { candidateCount: 7, supportCount: 1, refuteCount: 1, qualifyCount: 0, mentionCount: 5 });
  assert.equal(frame.metrics.stageCompletion.value, 1);
  assert.equal(frame.metrics.upstreamBlock.value, 0);
  assert.equal(frame.metrics.relationDispersion.status, 'COMPUTED');
  assert.equal(frame.metrics.relationDispersion.value, 0.6667);
  assert.equal(frame.metrics.relationConcentration.value, 0.7143);
  assert.equal(frame.metricNotice, 'OPERATIONAL_AND_RELATION_STATISTICS_NOT_SEMANTIC_TRUTH');
  assert.equal(frame.executionModel, 'POST_HOC_AG4_PROJECTION');
});

check('frames are deterministic, content-addressed and deeply frozen', () => {
  const result = Engine.run(MOVEMENT);
  const a = Flow.reduce(result);
  const b = Flow.reduce(result);
  assert.equal(a.contentHash, b.contentHash);
  assert.equal(a.run.runId, b.run.runId);
  assert.equal(Flow.validateFlowFrame(a).status, 'VALID');
  assert(Object.isFrozen(a) && Object.isFrozen(a.metrics) && Object.isFrozen(a.workItems[0]));
});

check('snapshot hash is history-free while comparison lives in a separate delta', () => {
  const result = Engine.run(MOVEMENT);
  const first = Flow.reduce(result);
  const second = Flow.reduce(result);
  const unchanged = Flow.createDelta(first, second);
  const different = Flow.reduce(Engine.run(AMBIGUOUS));
  const changed = Flow.createDelta(first, different);
  assert.equal(first.contentHash, second.contentHash);
  assert.deepEqual(unchanged.changedWorkIds, []);
  assert.equal(changed.changedWorkIds.length, 5);
  assert.equal(Flow.validateFlowDelta(unchanged).status, 'VALID');
  assert(!Object.hasOwn(first, 'changedWorkIds'));
  assert.deepEqual(second.workItems.map((item) => item.ordinal), [0, 1, 2, 3, 4]);
});

check('an ambiguous source is parked at parse and remains ABSTAIN', () => {
  const result = Engine.run(AMBIGUOUS);
  const frame = Flow.reduce(result);
  assert.equal(result.status, 'AMBIGUOUS');
  assert.equal(frame.state, 'ABSTAIN');
  assert.equal(stage(frame, 'PARSE').state, 'PARKED');
  assert.equal(stage(frame, 'DISCOVER').state, 'PARKED');
  assert.equal(stage(frame, 'REVIEW').state, 'PARKED');
  assert.equal(frame.metrics.queueLength, 0);
});

check('an engine without a source cascade parks discovery instead of fabricating evidence', () => {
  const result = PlainEngine.run(MOVEMENT);
  const frame = Flow.reduce(result);
  assert.equal(stage(frame, 'PARSE').state, 'SHIPPED');
  assert.equal(stage(frame, 'DISCOVER').state, 'PARKED');
  assert.deepEqual(stage(frame, 'DISCOVER').reasonCodes, ['EVIDENCE_NOT_COMPUTED']);
  assert.equal(frame.state, 'PARKED');
});

check('candidate capacity and budget fail closed before review', () => {
  const result = Engine.run(MOVEMENT);
  const capacity = Flow.reduce(result, { capacity: 4 });
  const budget = Flow.reduce(result, { budget: { maxOperations: 50000, maxCandidates: 4, maxMilliseconds: 1000 } });
  [capacity, budget].forEach((frame) => {
    assert.equal(frame.state, 'PARKED');
    assert.equal(stage(frame, 'ALIGN').state, 'PARKED');
    assert.deepEqual(stage(frame, 'ALIGN').reasonCodes, ['CANDIDATE_BUDGET_EXCEEDED']);
    assert.equal(frame.semanticTruth, false);
  });
});

check('cascade summary counters must agree with counts derived from candidate contracts', () => {
  const forged = Canonical.deepCopy(Engine.run(MOVEMENT));
  forged.evidenceCascade.metrics.relationCounts = { SUPPORTS: 99, REFUTES: 0, QUALIFIES: 0, MENTIONS: 0 };
  rehash(forged.evidenceCascade, 'resultHash');
  rehash(forged, 'resultHash');
  assert.throws(() => Flow.reduce(forged), /CASCADE_METRIC_MISMATCH/);
});

check('authority escalation and corrupted source hashes are rejected', () => {
  const elevated = Canonical.deepCopy(Engine.run(MOVEMENT));
  elevated.semanticTruth = true;
  rehash(elevated, 'resultHash');
  assert.throws(() => Flow.reduce(elevated), /AUTHORITY_BOUNDARY_VIOLATION/);
  const corrupt = Canonical.deepCopy(Engine.run(MOVEMENT));
  corrupt.status = 'OOV';
  assert.throws(() => Flow.reduce(corrupt), /CONTENT_HASH_MISMATCH/);
});

check('rehashing cannot make a malformed evidence candidate admissible', () => {
  const forged = Canonical.deepCopy(Engine.run(MOVEMENT));
  forged.evidenceCandidates[0].confidence = 1;
  rehash(forged.evidenceCandidates[0], 'contentHash');
  forged.evidenceCascade.evidenceCandidates[0] = Canonical.deepCopy(forged.evidenceCandidates[0]);
  rehash(forged.evidenceCascade, 'resultHash');
  rehash(forged, 'resultHash');
  assert.throws(() => Flow.reduce(forged), /EVIDENCE_CANDIDATE_INVALID/);
});

check('hidden, symbolic and accessor fields are rejected before canonical replay', () => {
  const symbolic = Canonical.deepCopy(Engine.run(MOVEMENT));
  symbolic[Symbol('accepted')] = true;
  assert.throws(() => Flow.reduce(symbolic), /SYMBOL_FIELD_FORBIDDEN/);
  const hidden = Canonical.deepCopy(Engine.run(MOVEMENT));
  Object.defineProperty(hidden, 'accepted', { value: true, enumerable: false });
  assert.throws(() => Flow.reduce(hidden), /NON_ENUMERABLE_FIELD_FORBIDDEN/);
  const accessor = Canonical.deepCopy(Engine.run(MOVEMENT));
  Object.defineProperty(accessor, 'shadow', { enumerable: true, get() { return true; } });
  assert.throws(() => Flow.reduce(accessor), /ACCESSOR_FORBIDDEN/);
});

check('successful empty alignment is distinct from an upstream failure', () => {
  const empty = Canonical.deepCopy(Engine.run(MOVEMENT));
  empty.evidenceCandidates = [];
  empty.evidenceStatus = 'NOT_COMPUTED';
  empty.evidenceCascade.evidenceCandidates = [];
  empty.evidenceCascade.alignments = [];
  empty.evidenceCascade.evidenceStatus = 'NOT_COMPUTED';
  empty.evidenceCascade.metrics.evidenceCandidateCount = 0;
  empty.evidenceCascade.metrics.relationCounts = { SUPPORTS: 0, REFUTES: 0, QUALIFIES: 0, MENTIONS: 0 };
  rehash(empty.evidenceCascade, 'resultHash');
  rehash(empty, 'resultHash');
  const frame = Flow.reduce(empty);
  assert.equal(stage(frame, 'DISCOVER').state, 'SHIPPED');
  assert.equal(stage(frame, 'ALIGN').state, 'SHIPPED');
  assert.deepEqual(stage(frame, 'ALIGN').reasonCodes, ['NO_ALIGNED_CANDIDATES']);
  assert.deepEqual(stage(frame, 'REVIEW').reasonCodes, ['NO_ALIGNED_CANDIDATES']);
  assert.equal(frame.state, 'PARKED');
  assert.equal(frame.metrics.relationDispersion.status, 'NOT_COMPUTED');
  assert.equal(frame.metrics.relationConcentration.value, null);
});

check('delta rejects malformed frames and epoch regression', () => {
  const result = Engine.run(MOVEMENT);
  const prior = Canonical.deepCopy(Flow.reduce(result, { epoch: 3 }));
  prior.metrics.queueLength = 0;
  assert.throws(() => Flow.createDelta(prior, Flow.reduce(result, { epoch: 3 })), /PREVIOUS_FRAME_INVALID/);
  assert.throws(() => Flow.createDelta(Flow.reduce(result, { epoch: 3 }), Flow.reduce(result, { epoch: 2 })), /EPOCH_REGRESSION/);
  assert.throws(() => Flow.reduce(result, { previousFrame: prior }), /UNKNOWN_FIELD/);
  assert.throws(() => Flow.reduce(result, { epoch: 0 }), /BOUNDED_INTEGER_REQUIRED/);
  assert.throws(() => Flow.reduce(result, { capacity: 0 }), /BOUNDED_INTEGER_REQUIRED/);
  assert.throws(() => Flow.reduce(result, { mystery: true }), /UNKNOWN_FIELD/);
});

check('core source has no DOM, clock, random, network, evaluator or commit path', () => {
  const source = fs.readFileSync(lib('p78-semantic-flow-reducer'), 'utf8');
  ['document', 'Date.now', 'Math.random', 'fetch(', 'XMLHttpRequest', 'eval(', 'new Function', "operatorId:'COMMIT'"].forEach((term) => assert(!source.includes(term), `${term} must be absent`));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
