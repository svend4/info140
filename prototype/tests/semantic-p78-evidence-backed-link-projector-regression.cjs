'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts',
  'p78-local-text-index', 'p78-controlled-russian-lexicon', 'p78-claim-ir',
  'p78-linguistic-parser-adapter', 'p78-claim-structural-matcher', 'p78-evidence-contracts',
  'p78-claim-evidence-corpus', 'p78-linguistic-structure-index', 'p78-claim-evidence-cascade',
  'p78-controlled-claim-engine', 'p78-alpha-orbit-contracts', 'p78-data7-adapter',
  'p78-qualifier-direction-contracts', 'p78-evidence-backed-link-adapter',
  'p78-evidence-backed-link-projector',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const Search = global.MRDP78SearchContracts;
const Parser = global.MRDP78LinguisticParserAdapter;
const Linguistic = global.MRDP78LinguisticStructureIndex;
const Cascade = global.MRDP78ClaimEvidenceCascade.create();
const Engine = global.MRDP78ControlledClaimEngine.create({ evidenceCascade: Cascade });
const Adapter = global.MRDP78EvidenceBackedLinkAdapter;
const Projector = global.MRDP78EvidenceBackedLinkProjector;
const checks = [];
const TARGET = 'Система сохраняет состояние.';
const PLAIN = 'Система проверяет документ.';
const METHOD = 'Система проверяет документ через формулу.';
const CONFIG = Object.freeze({ maxOperations: 100000, maxHits: 512, maxPassages: 128 });

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
function copy(value) { return Canonical.deepCopy(value); }
function rehashModel(value) {
  const result = copy(value);
  delete result.contentHash;
  result.contentHash = Canonical.hashCanonical(result);
  return result;
}
function defaultModel(targetText = TARGET, result = Engine.run(TARGET).evidenceCascade) {
  return Projector.project({ targetText, cascadeResult: result, linguisticIndex: Cascade.index });
}
function qualifierFixture() {
  const source = Search.createSourceSnapshot({
    sourceId: 'p78.projector.qualifier', revision: 'r1', language: 'ru', text: `${PLAIN} ${METHOD}`,
  });
  const index = Linguistic.create([source], { indexId: 'p78.projector.qualifier.index' });
  const parsed = Parser.replay(PLAIN, { expectedLexiconHash: index.lexiconHash });
  const result = Linguistic.replay(index, parsed, {
    ...CONFIG, expectedSourceSetHash: index.sourceSetHash,
    expectedLinguisticIndexHash: index.linguisticIndexHash,
  });
  return { source, index, result, model: Projector.project({ targetText: PLAIN, cascadeResult: result, linguisticIndex: index }) };
}

check('projector API is frozen, bounded and has no decision authority', () => {
  assert.equal(Projector.status, 'READY');
  assert.equal(Projector.version, '1.1.0');
  assert.equal(Projector.viewModelSchema, 'meridian.evidence-backed-link-view-model/1');
  assert.equal(Projector.maxAttempts, 8);
  assert.equal(Projector.maxScanCandidates, 512);
  assert.equal(Projector.sourceAuthority, 'UNVERIFIED');
  assert.equal(Projector.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(Projector.semanticTruth, false);
  assert.equal(Projector.commitAllowed, false);
  assert(Object.isFrozen(Projector) && Object.isFrozen(Projector.replayConfig));
});

check('default claim yields one REFUTES proposal, one self-link rejection and five skips', () => {
  const model = defaultModel();
  assert.equal(model.status, 'REPLAYED');
  assert.equal(model.candidateCount, 7);
  assert.equal(model.attemptedCount, 2);
  assert.equal(model.proposalCount, 1);
  assert.equal(model.rejectionCount, 1);
  assert.equal(model.skippedCount, 5);
  assert.equal(model.proposals[0].relation, 'REFUTES');
  assert.equal(model.proposals[0].direction, 'PASSAGE_TO_TARGET');
  assert.equal(model.rejections[0].code, 'SELF_LINK_FORBIDDEN');
  assert.equal(Projector.inspectViewModel(model).status, 'VALID');
});

check('exact target and passage text remain bound to one admitted local snapshot', () => {
  const proposal = defaultModel().proposals[0];
  assert.equal(proposal.target.text, TARGET);
  assert.equal(proposal.passage.text, 'Система не сохраняет состояние.');
  assert.equal(proposal.target.sourceRef.sourceHash, proposal.passage.sourceRef.sourceHash);
  assert.equal(proposal.sourceSetRef.primarySourceHash, proposal.target.sourceRef.sourceHash);
  assert.equal(proposal.validation.evidenceBundleRef.targetTextHash, proposal.target.textHash);
  assert.equal(proposal.validation.evidenceBundleRef.passageTextHash, proposal.passage.textHash);
  assert.equal(proposal.validation.evidenceBundleRef.targetSegmentHash, proposal.target.contentHash);
  assert.equal(proposal.validation.evidenceBundleRef.passageSegmentHash, proposal.passage.contentHash);
  assert.equal(proposal.validation.evidenceBundleRef.queryHash, proposal.pins.queryHash);
  assert.equal(proposal.validation.evidenceBundleRef.indexHash, proposal.pins.indexHash);
  assert.equal(proposal.validation.evidenceBundleRef.evidenceCandidateHash, proposal.pins.evidenceCandidateHash);
  assert.equal(proposal.validation.evidenceBundleRef.sourceRef.sourceId, proposal.target.sourceRef.sourceId);
  assert.deepEqual(proposal.validation.evidenceBundleRef.targetLocator, proposal.target.locator);
});

check('referential replay is explicit while source authority and semantic truth stay unverified', () => {
  const model = defaultModel();
  const proposal = model.proposals[0];
  assert.equal(model.validationScope, 'REFERENTIAL_REPLAY');
  assert.equal(model.referentialReplay, 'PERFORMED');
  assert.equal(model.sourceAuthority, 'UNVERIFIED');
  assert.equal(proposal.validation.status, 'VALID');
  assert.equal(proposal.validation.subjectRef.proposalId, proposal.subjectRef.proposalId);
  assert.equal(proposal.storedVerificationStatus, 'REPLAY_REQUIRED');
  assert.equal(proposal.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(proposal.finalRelation, 'NOT_COMPUTED');
  assert.equal(proposal.semanticTruth, false);
  assert.equal(proposal.commitAllowed, false);
  assert.equal(proposal.alphaTransitionReceipt, null);
});

check('controlled method clause produces a NARROWER QUALIFIES proposal', () => {
  const { model } = qualifierFixture();
  const proposal = model.proposals.find((item) => item.relation === 'QUALIFIES');
  assert(proposal, 'QUALIFIES proposal missing');
  assert.equal(proposal.qualifier.status, 'DIRECTED');
  assert.equal(proposal.qualifier.scopeDirection, 'NARROWER');
  assert.equal(proposal.qualifier.witness.qualifiedSide, 'PASSAGE');
  assert.equal(proposal.passage.text, METHOD);
});

check('projection is byte-deterministic and deeply frozen', () => {
  const left = defaultModel();
  const right = defaultModel();
  assert.equal(Canonical.canonicalize(left), Canonical.canonicalize(right));
  assert.equal(left.contentHash, right.contentHash);
  assert(Object.isFrozen(left) && Object.isFrozen(left.proposals) && Object.isFrozen(left.proposals[0].validation));
});

check('missing exact target in the common source abstains without fabricating an edge', () => {
  const model = defaultModel('Система вычисляет неизвестное состояние.');
  assert.equal(model.status, 'ABSTAIN');
  assert.equal(model.proposalCount, 0);
  assert.equal(model.rejectionCount, 2);
  assert(model.rejections.every((item) => item.code === 'TARGET_NOT_IN_COMMON_SOURCE'));
  assert.equal(model.relationStatus, 'NOT_COMPUTED');
  assert.equal(model.referentialReplay, 'NOT_PERFORMED');
  assert.equal(model.sourceAuthority, 'NOT_ASSESSED');
  assert.equal(Projector.inspectViewModel(model).status, 'VALID');
});

check('validation receipt from another proposal cannot be cross-wired into a rehashed model', () => {
  const model = copy(defaultModel());
  const other = qualifierFixture().model.proposals.find((item) => item.relation === 'QUALIFIES');
  model.proposals[0].validation = copy(other.validation);
  const report = Projector.inspectViewModel(rehashModel(model));
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'REPLAY_BINDING_INVALID');
});

check('upstream parser abstention stays ABSTAIN when it has no evidence candidates', () => {
  const targetText = 'Система вычисляет неизвестное состояние.';
  const upstream = Engine.run(targetText);
  assert.equal(upstream.status, 'OOV');
  assert.equal(upstream.evidenceCandidates.length, 0);
  const projected = Projector.project({ targetText, cascadeResult: upstream, linguisticIndex: Cascade.index });
  assert.equal(projected.status, 'ABSTAIN');
  assert.equal(projected.candidateCount, 0);
  assert.equal(projected.proposalCount, 0);
  assert.equal(projected.rejectionCount, 0);
  assert.equal(Projector.inspectViewModel(projected).status, 'VALID');
});

check('forged endpoint text remains invalid even after the outer model hash is recomputed', () => {
  const model = copy(defaultModel());
  model.proposals[0].target.text = 'Подмена';
  model.proposals[0].target.textHash = Canonical.hashText('Подмена');
  model.proposals[0].target.locator.end = model.proposals[0].target.locator.start + 'Подмена'.length;
  const report = Projector.inspectViewModel(rehashModel(model));
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'REPLAY_BUNDLE_BINDING_INVALID');
});

check('authority escalation is rejected even when the model content hash is recomputed', () => {
  const model = copy(defaultModel());
  model.commitAllowed = true;
  const report = Projector.inspectViewModel(rehashModel(model));
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'MODEL_AUTHORITY_BOUNDARY_VIOLATION');
});

check('displayed pins and source labels cannot detach from the replay receipt', () => {
  const query = copy(defaultModel());
  query.proposals[0].pins.queryHash = Canonical.hashText('forged query');
  let report = Projector.inspectViewModel(rehashModel(query));
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'REPLAY_BUNDLE_BINDING_INVALID');

  const validator = copy(defaultModel());
  validator.proposals[0].pins.validatorVersion = 'forged-validator@1';
  report = Projector.inspectViewModel(rehashModel(validator));
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'VALIDATOR_BINDING_INVALID');

  const source = copy(defaultModel());
  for (const endpoint of [source.proposals[0].target, source.proposals[0].passage, source.proposals[0].context]) {
    endpoint.sourceRef.sourceId = 'forged.source';
    endpoint.sourceRef.revision = 'r9';
  }
  report = Projector.inspectViewModel(rehashModel(source));
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'REPLAY_BUNDLE_BINDING_INVALID');
});

check('nested validation receipt cannot raise review, truth or commit authority', () => {
  const model = copy(defaultModel());
  model.proposals[0].validation.reviewStatus = 'REVIEWED';
  model.proposals[0].validation.semanticTruth = true;
  model.proposals[0].validation.commitAllowed = true;
  const report = Projector.inspectViewModel(rehashModel(model));
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'VALIDATION_AUTHORITY_BOUNDARY_VIOLATION');
});

check('validated render snapshot is detached and deeply frozen', () => {
  const mutable = copy(defaultModel());
  const expectedText = mutable.proposals[0].target.text;
  const accepted = Projector.snapshotViewModel(mutable);
  assert.equal(accepted.status, 'VALID');
  assert.notEqual(accepted.model, mutable);
  assert(Object.isFrozen(accepted) && Object.isFrozen(accepted.model) && Object.isFrozen(accepted.model.proposals[0]));
  mutable.proposals[0].target.text = 'MUTATED_AFTER_ACCEPT';
  assert.equal(accepted.model.proposals[0].target.text, expectedText);
});

check('candidate scanning and proposal attempts remain bounded', () => {
  const result = copy(Engine.run(TARGET).evidenceCascade);
  const support = result.evidenceCandidates.find((item) => item.proposedRelation === 'SUPPORTS');
  result.evidenceCandidates = Array.from({ length: 600 }, () => copy(support));
  const model = defaultModel(TARGET, result);
  assert.equal(model.candidateCount, 600);
  assert.equal(model.attemptedCount, 8);
  assert.equal(model.proposalCount, 0);
  assert.equal(model.rejectionCount, 8);
  assert.equal(model.skippedCount, 592);
  assert(model.skipReasons.some((item) => item.code === 'INPUT_SCAN_CAP' && item.count === 88));
  assert(model.skipReasons.some((item) => item.code === 'ATTEMPT_CAP' && item.count === 504));
});

check('invalid mutable data shapes fail closed', () => {
  const accessor = {};
  Object.defineProperty(accessor, 'schema', { enumerable: true, get() { return Projector.viewModelSchema; } });
  assert.equal(Projector.inspectViewModel(accessor).status, 'INVALID');
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(Projector.inspectViewModel(cyclic).code, 'CYCLIC_MODEL_FORBIDDEN');
  const sparse = []; sparse.length = 1;
  assert.equal(Projector.inspectViewModel(sparse).status, 'INVALID');
  const nested = copy(defaultModel());
  const proposal = nested.proposals[0];
  let reads = 0;
  Object.defineProperty(nested.proposals, '0', {
    enumerable: true, configurable: true,
    get() { reads += 1; return proposal; },
  });
  assert.equal(Projector.snapshotViewModel(nested).status, 'INVALID');
  assert.equal(reads, 0);
});

check('adapter validation receipts are proposal-bound and version-pinned', () => {
  const proposal = defaultModel().proposals[0];
  assert.equal(Adapter.version, '1.4.0');
  assert.equal(Adapter.validatorVersion, 'p78-evidence-backed-link-adapter@1.4.0');
  assert.equal(proposal.validation.schema, Adapter.validationReportSchema);
  assert.equal(proposal.validation.validatorRef.version, Adapter.version);
  assert.equal(proposal.validation.validatorRef.validatorVersion, Adapter.validatorVersion);
  assert(Canonical.isSha256(proposal.validation.validatorRef.qualifierDirectionRulesetHash));
});

check('projector source has no DOM, network, storage, clock, randomness or authority path', () => {
  const source = fs.readFileSync(lib('p78-evidence-backed-link-projector'), 'utf8');
  assert(!/\bdocument\b|querySelector|getElementById|innerHTML/.test(source));
  assert(source.includes('createEvidenceBackedLinkWithValidation'));
  assert(!source.includes('validateEvidenceBackedLinkAgainst'));
  assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|clipboard/.test(source));
  assert(!/requestAnimationFrame|setTimeout|setInterval|Math\.random|Date\.now|new Date/.test(source));
  assert(!/\beval\s*\(|new Function/.test(source));
  assert(!/commitAllowed\s*:\s*true|semanticTruth\s*:\s*true/.test(source));
});

for (const item of checks) {
  process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? `\n${item.detail}` : ''}\n`);
}
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
process.exitCode = passed === checks.length ? 0 : 1;
