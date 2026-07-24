'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Inputs = require('./fixtures/p78-ag4-external-holdout-inputs-v1.cjs');
const Gold = require('./fixtures/p78-ag4-external-holdout-gold-v1.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts', 'p78-local-text-index',
  'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
  'p78-claim-structural-matcher', 'p78-evidence-contracts', 'p78-claim-evidence-corpus',
  'p78-linguistic-structure-index',
].forEach((name) => require(lib(name)));

const Corpus = global.MRDP78ClaimEvidenceCorpus;
const Evaluator = require('./fixtures/p78-ag4-external-holdout-evaluator.cjs');
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

function metricValues(report) {
  return {
    targetResolutionCoverage: report.metrics.targetResolutionCoverage.value,
    lexicalGoldPassageRecall: report.metrics.lexicalGoldPassageRecall.value,
    candidateGoldPassageRecall: report.metrics.candidateGoldPassageRecall.value,
    candidatePassagePrecision: report.metrics.candidatePassagePrecision.value,
    relationMacroF1: report.metrics.relationMacroF1,
    noneFalsePositiveRate: report.metrics.noneFalsePositiveRate.value,
    guardRecall: report.metrics.guardRecall.value,
    provenanceCompleteness: report.metrics.provenanceCompleteness.value,
    authorityViolations: report.metrics.authorityViolations,
    staleSourceRejection: report.staleSourceRejection.value,
  };
}

check('holdout inputs and gold are immutable, separate and pilot-sized', () => {
  assert.equal(Inputs.schema, 'meridian.ag4-external-holdout-inputs/1');
  assert.equal(Gold.schema, 'meridian.ag4-external-holdout-gold/1');
  assert(Object.isFrozen(Inputs) && Object.isFrozen(Inputs.sources) && Object.isFrozen(Inputs.cases));
  assert(Object.isFrozen(Gold) && Object.isFrozen(Gold.cases) && Object.isFrozen(Gold.thresholds));
  assert.equal(Inputs.datasetId, Gold.datasetId);
  assert.equal(Inputs.status, 'SEALED');
  assert.equal(Gold.status, 'SEALED');
  assert(Inputs.sources.length >= 8);
  assert(Inputs.cases.length >= 10);
  assert(!Object.prototype.hasOwnProperty.call(Inputs, 'gold'));
  assert(!Object.prototype.hasOwnProperty.call(Inputs, 'thresholds'));
});

check('external provenance, short excerpts, fixture pins and development split validate', () => {
  const validation = Evaluator.validateFixtures(Inputs, Gold, Corpus);
  assert.equal(validation.status, 'VALID', JSON.stringify(validation.errors));
  assert.deepEqual(validation.errors, []);
});

check('gold annotations are absent from runtime corpus, browser entrypoint and holdout inputs', () => {
  const corpusSource = fs.readFileSync(lib('p78-claim-evidence-corpus'), 'utf8');
  const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'p78-living-ring-interface.html'), 'utf8');
  const inputsSource = fs.readFileSync(path.join(__dirname, 'fixtures', 'p78-ag4-external-holdout-inputs-v1.cjs'), 'utf8');
  assert(!corpusSource.includes('p78-ag4-external-holdout'));
  assert(!htmlSource.includes('p78-ag4-external-holdout'));
  assert(!htmlSource.includes('external-holdout-evaluator'));
  assert(!inputsSource.includes('targetResolution'));
  assert(!inputsSource.includes("relation: 'SUPPORTS'"));
  assert(!inputsSource.includes("relation: 'REFUTES'"));
  assert(!inputsSource.includes("relation: 'QUALIFIES'"));
});

const report = Evaluator.evaluate(Inputs, Gold);

check('current AG4 is measured without changing its review-only authority boundary', () => {
  assert.equal(report.schema, 'meridian.ag4-external-holdout-report/1');
  assert.equal(report.metrics.evaluatedCaseCount, Inputs.cases.length);
  assert.equal(report.metrics.authorityViolations, 0);
  report.cases.forEach((item) => {
    assert.equal(item.finalStatus, 'ABSTAIN', item.caseId);
    assert.equal(item.finalRelation, 'NOT_COMPUTED', item.caseId);
    assert.equal(item.reviewStatus, 'REQUIRES_REVIEW', item.caseId);
    assert.equal(item.semanticTruth, false, item.caseId);
  });
});

check('OOV guard and stale-source probe fail closed before evidence authority', () => {
  const guard = report.cases.find((item) => item.caseId === 'unknown-metaflow');
  assert(guard);
  assert.equal(guard.targetResolutionActual, 'OOV');
  assert.equal(guard.resultStatus, 'ABSTAIN');
  assert.equal(guard.resultCode, 'TARGET_CLAIM_UNRESOLVED');
  assert.deepEqual(guard.candidates, []);
  assert.equal(report.staleSourceRejection.value, 1);
  assert.equal(report.staleSourceRejection.code, 'STALE_SOURCE_SET');
  assert.equal(report.staleSourceRejection.candidateCount, 0);
});

check('all emitted candidates retain complete source and index provenance', () => {
  const candidates = report.cases.flatMap((item) => item.candidates);
  assert(candidates.every((candidate) => candidate.provenanceComplete));
  assert.equal(report.metrics.provenanceCompleteness.value, 1);
});

check('external pilot exposes the AG4 transfer gap and blocks AG5', () => {
  assert.equal(report.gateStatus, 'BLOCKED_FOR_AG5');
  const failed = report.gates.filter((item) => !item.passed).map((item) => item.metric);
  assert(failed.length > 0, 'pilot unexpectedly passed every gate');
  assert(
    failed.includes('candidateGoldPassageRecall') || failed.includes('relationMacroF1'),
    `semantic transfer gates did not fail: ${failed.join(', ')}`,
  );
});

check('sealed baseline pins the exact report and aggregate metrics', () => {
  assert.equal(report.gateStatus, Gold.baseline.gateStatus);
  assert.equal(report.reportHash, Gold.baseline.reportHash);
  assert.deepEqual(metricValues(report), Gold.baseline.metrics);
});

check('fresh replay and source-order permutation are content-address identical', () => {
  const replay = Evaluator.evaluate(Inputs, Gold);
  const reversed = Evaluator.evaluate(Inputs, Gold, { reverseSourceOrder: true });
  assert.deepEqual(replay, report);
  assert.deepEqual(reversed, report);
  assert.equal(replay.reportHash, report.reportHash);
  assert.equal(reversed.reportHash, report.reportHash);
});

console.log(`HOLDOUT | dataset=${Inputs.datasetId} | seal=${report.holdoutHash}`);
console.log(`GATE | ${report.gateStatus} | passed=${report.gates.filter((item) => item.passed).length}/${report.gates.length}`);
console.log(`BASELINE_JSON | ${JSON.stringify({
  hashes: Evaluator.computeFixtureHashes(Inputs, Gold),
  reportHash: report.reportHash,
  gateStatus: report.gateStatus,
  metrics: metricValues(report),
  failedGates: report.gates.filter((item) => !item.passed).map((item) => item.metric),
})}`);
checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
