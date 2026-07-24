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
  'p78-evidence-candidate-view',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const CascadeFactory = global.MRDP78ClaimEvidenceCascade;
const EngineFactory = global.MRDP78ControlledClaimEngine;
const Evidence = global.MRDP78EvidenceContracts;
const EvidenceView = global.MRDP78EvidenceCandidateView;
const cascade = CascadeFactory.create();
const engine = EngineFactory.create({ evidenceCascade: cascade });
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
function allText(element) { return [element._text || '', ...element.children.map(allText)].join(' '); }
class FakeElement {
  constructor(tag, document) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.dataset = {};
    this._text = '';
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  get firstChild() { return this.children[0] || null; }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return allText(this); }
}
class FakeDocument { createElement(tag) { return new FakeElement(tag, this); } }

function resolverFrom(result) {
  return (request) => {
    const passage = result.evidenceCascade.locatedPassages.find((item) =>
      item.sourceRef.sourceId === request.sourceRef.sourceId &&
      item.sourceRef.revision === request.sourceRef.revision &&
      item.sourceRef.sourceHash === request.sourceRef.sourceHash &&
      item.locator.sentenceIndex === request.locator.sentenceIndex &&
      item.locator.start === request.locator.start && item.locator.end === request.locator.end &&
      item.textHash === request.passageTextHash);
    return passage ? passage.text : null;
  };
}

check('factory builds one pinned immutable source-backed cascade', () => {
  assert.equal(CascadeFactory.status, 'READY');
  assert.equal(cascade.status, 'READY');
  assert.equal(cascade.index.passageCount, 30);
  assert(Canonical.isSha256(cascade.identity.sourceSetHash));
  assert(Canonical.isSha256(cascade.identity.linguisticIndexHash));
  assert(Object.isFrozen(cascade) && Object.isFrozen(cascade.index));
});

check('configured engine exposes source-backed candidates while preserving ABSTAIN', () => {
  const result = engine.run('Система сохраняет состояние.');
  assert.equal(result.status, 'READY');
  assert.equal(result.evidenceStatus, 'EVIDENCE_CANDIDATE');
  assert.equal(result.evidenceCandidates.length, 7);
  assert.equal(result.evidenceCascade.metrics.locatedPassageCount, 9);
  assert.equal(result.finalStatus, 'ABSTAIN');
  assert.equal(result.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(result.semanticTruth, false);
  assert.equal(result.soundness, 'NOT_COMPUTED');
});

check('engine trace keeps discovery, alignment and final evidence gate separate', () => {
  const result = engine.run('Система сохраняет состояние.');
  assert.deepEqual(result.trace.steps.map((step) => step.stage), [
    'PARSE_STRUCTURE', 'MATCH_PATTERN', 'DISCOVER_PASSAGES', 'ALIGN_CLAIMS', 'EVIDENCE_GATE',
  ]);
  assert.equal(result.trace.steps[2].status, 'READY');
  assert.equal(result.trace.steps[3].status, 'READY');
  assert.equal(result.trace.steps[4].status, 'ABSTAIN');
  assert.equal(result.trace.steps[4].reasonCodes[0], 'HUMAN_REVIEW_REQUIRED');
});

check('support, refute and mentions coexist as proposals', () => {
  const result = engine.run('Система сохраняет состояние.');
  const counts = result.evidenceCascade.metrics.relationCounts;
  assert.deepEqual(counts, { SUPPORTS: 1, REFUTES: 1, QUALIFIES: 0, MENTIONS: 5 });
  result.evidenceCandidates.forEach((candidate) => {
    assert.equal(Evidence.validateEvidenceCandidate(candidate).status, 'VALID');
    assert.equal(candidate.finalRelation, 'NOT_COMPUTED');
  });
});

check('passive view verifies and renders exact admitted source text', () => {
  const result = engine.run('Система сохраняет состояние.');
  const document = new FakeDocument();
  const root = new FakeElement('div', document);
  EvidenceView.render(root, result.evidenceCascade, { resolver: resolverFrom(result) });
  const rendered = allText(root);
  assert.equal(root.dataset.status, 'EVIDENCE_CANDIDATE');
  assert.equal(root.dataset.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(root.dataset.finalRelation, 'NOT_COMPUTED');
  assert.equal(root.dataset.conflict, 'true');
  assert(rendered.includes('Система сохраняет состояние.'));
  assert(rendered.includes('Система не сохраняет состояние.'));
  assert(rendered.includes('EXACT_TEXT_VERIFIED'));
  EvidenceView.render(root, result.evidenceCascade, { resolver: resolverFrom(result) });
  assert.equal(root.className.split(/\s+/).filter((name) => name === 'evidenceCandidateView').length, 1);
});

check('source resolver rejects a changed passage instead of displaying it', () => {
  const result = engine.run('Система сохраняет состояние.');
  const document = new FakeDocument();
  const root = new FakeElement('div', document);
  EvidenceView.render(root, result.evidenceCascade, { resolver: () => 'Подменённый текст.' });
  const rendered = allText(root);
  assert(rendered.includes('PASSAGE_TEXT_HASH_MISMATCH'));
  assert(!rendered.includes('Подменённый текст.'));
});

check('an internal cascade failure remains evidence ABSTAIN and does not relabel the Claim as OOV', () => {
  const failing = Object.freeze({
    status: 'READY', identity: Object.freeze({ linguisticIndexHash: Canonical.hashText('failing cascade') }),
    run() { const error = new Error('fixture failure'); error.code = 'CASCADE_FIXTURE_FAILURE'; throw error; },
  });
  const isolated = EngineFactory.create({ evidenceCascade: failing }).run('Система сохраняет состояние.');
  assert.equal(isolated.status, 'READY');
  assert.equal(isolated.resolutionStatus, 'RESOLVED');
  assert.equal(isolated.evidenceStatus, 'NOT_COMPUTED');
  assert.equal(isolated.evidenceError.code, 'CASCADE_FIXTURE_FAILURE');
  assert.equal(isolated.finalStatus, 'ABSTAIN');
});

check('engine rejects a cascade that tries to promote a candidate to truth', () => {
  const hostile = Object.freeze({
    status: 'READY',
    identity: cascade.identity,
    run(parsed) {
      const forged = Canonical.deepCopy(cascade.run(parsed));
      forged.evidenceStatus = 'ACCEPTED_EVIDENCE';
      forged.finalRelation = 'SUPPORTS';
      forged.semanticTruth = true;
      delete forged.resultHash;
      forged.resultHash = Canonical.hashCanonical(forged);
      return forged;
    },
  });
  const isolated = EngineFactory.create({ evidenceCascade: hostile }).run('Система сохраняет состояние.');
  assert.equal(isolated.status, 'READY');
  assert.equal(isolated.resolutionStatus, 'RESOLVED');
  assert.equal(isolated.evidenceStatus, 'NOT_COMPUTED');
  assert.equal(isolated.evidenceCandidates.length, 0);
  assert.equal(isolated.evidenceError.code, 'EVIDENCE_AUTHORITY_BOUNDARY_VIOLATION');
  assert.equal(isolated.finalStatus, 'ABSTAIN');
});

check('engine isolates a malformed candidate without relabeling the resolved Claim', () => {
  const hostile = Object.freeze({
    status: 'READY',
    identity: cascade.identity,
    run(parsed) {
      const forged = Canonical.deepCopy(cascade.run(parsed));
      forged.evidenceCandidates = [null];
      delete forged.resultHash;
      forged.resultHash = Canonical.hashCanonical(forged);
      return forged;
    },
  });
  const isolated = EngineFactory.create({ evidenceCascade: hostile }).run('Система сохраняет состояние.');
  assert.equal(isolated.status, 'READY');
  assert.equal(isolated.resolutionStatus, 'RESOLVED');
  assert.equal(isolated.evidenceStatus, 'NOT_COMPUTED');
  assert.equal(isolated.evidenceCandidates.length, 0);
  assert.equal(isolated.evidenceError.code, 'EVIDENCE_CANDIDATE_INVALID');
  assert.equal(isolated.finalStatus, 'ABSTAIN');
});

check('unconfigured engine preserves the original three-stage AG3 behavior', () => {
  const result = EngineFactory.create().run('Система сохраняет состояние.');
  assert.equal(result.evidenceStatus, 'NOT_COMPUTED');
  assert.equal(result.evidenceCandidates.length, 0);
  assert.deepEqual(result.trace.steps.map((step) => step.stage), ['PARSE_STRUCTURE', 'MATCH_PATTERN', 'EVIDENCE_GATE']);
});

check('browser shell loads production modules but no gold benchmark fixture', () => {
  const html = fs.readFileSync(path.join(rootDir, 'p78-living-ring-interface.html'), 'utf8');
  [
    'p78-evidence-contracts.js', 'p78-claim-evidence-corpus.js', 'p78-linguistic-structure-index.js',
    'p78-claim-evidence-cascade.js', 'p78-evidence-candidate-view.js',
  ].forEach((name) => assert(html.includes(name), `${name} missing`));
  assert(!html.includes('p78-claim-cascade-benchmark-fixtures'));
  assert(!html.includes('p78-claim-golden-corpus'));
  assert(fs.statSync(path.join(rootDir, 'p78-living-ring-interface.html')).size < 24000);
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
