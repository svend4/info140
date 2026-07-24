'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts',
  'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
  'p78-evidence-contracts',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const Search = global.MRDP78SearchContracts;
const Parser = global.MRDP78LinguisticParserAdapter;
const Evidence = global.MRDP78EvidenceContracts;
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
function hash(label) { return Canonical.hashText(label); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

const source = Search.createSourceSnapshot({
  sourceId: 'p78.ag4.contract-fixture', revision: '1.0.0', language: 'ru',
  text: '  Система сохраняет состояние. Система не сохраняет состояние.',
});
const firstStart = source.text.indexOf('Система');
const firstEnd = source.text.indexOf('.') + 1;
const secondStart = source.text.indexOf('Система', firstEnd);
const passage = Evidence.createSourcePassage(source, { start: firstStart, end: firstEnd, sentenceIndex: 0 });
const target = Parser.parse(passage.text).claimAst;
const negative = Parser.parse(source.text.slice(secondStart)).claimAst;
const provenance = {
  sourceSetHash: Search.computeSourceSetHash([source]), queryHash: hash('query'), lexicalIndexHash: hash('lexical'),
  linguisticIndexHash: hash('linguistic'), lexiconHash: Parser.lexiconHash, parserRef: Parser.parserRef,
  alignerVersion: '1.0.0',
};
const sourceRef = { sourceId: source.sourceId, revision: source.revision, sourceHash: source.sourceHash };
function definition(claim, relation, alignment, status) {
  return {
    targetClaimRef: Evidence.claimRef(target), passageClaimRef: Evidence.claimRef(claim),
    hitIds: [`hit:${'a'.repeat(64)}`], sourceSpanIds: [passage.sourceSpanId], sourceRef,
    locator: passage.locator, passageTextHash: passage.textHash, proposedRelation: relation,
    alignment, status, reasonCodes: [
      'BROAD_LEXICAL_MATCH', 'SOURCE_PASSAGE_PINNED', 'HUMAN_REVIEW_REQUIRED',
    ], provenance,
  };
}
const exactAlignment = {
  predicate: 'TRUE', arguments: 'TRUE', polarity: 'TRUE', modality: 'TRUE', quantifier: 'TRUE', qualifiers: 'TRUE',
};

check('contract API is ready, passive and immutable', () => {
  assert.equal(Evidence.status, 'READY');
  assert.equal(Evidence.maxOutputStatus, 'EVIDENCE_CANDIDATE');
  assert.equal(Evidence.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(Evidence.semanticTruth, false);
  assert(Object.isFrozen(Evidence) && Object.isFrozen(Evidence.reasonCodes));
});

check('source passage pins an exact UTF-16 source slice despite leading whitespace', () => {
  assert.equal(passage.text, 'Система сохраняет состояние.');
  assert.equal(source.text.slice(passage.locator.start, passage.locator.end), passage.text);
  assert.equal(passage.textHash, Canonical.hashText(passage.text));
  assert.equal(Evidence.validateSourcePassage(passage).status, 'VALID');
  assert(Object.isFrozen(passage) && Object.isFrozen(passage.locator));
});

check('source passage identity changes when its source locator changes', () => {
  const other = Evidence.createSourcePassage(source, {
    start: secondStart, end: source.text.length, sentenceIndex: 1,
  });
  assert.notEqual(other.passageId, passage.passageId);
  assert.notEqual(other.sourceSpanId, passage.sourceSpanId);
  assert.notEqual(other.contentHash, passage.contentHash);
});

check('tampered source passages fail closed', () => {
  const changed = clone(passage);
  changed.text = 'Система изменяет состояние.';
  const report = Evidence.validateSourcePassage(changed);
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'PASSAGE_TEXT_HASH_MISMATCH');
});

check('complete same-claim alignment creates only a reviewable SUPPORTS proposal', () => {
  const candidate = Evidence.createEvidenceCandidate(definition(target, 'SUPPORTS', exactAlignment, 'STRUCTURALLY_ALIGNED'));
  assert.equal(Evidence.validateEvidenceCandidate(candidate).status, 'VALID');
  assert.equal(candidate.proposedRelation, 'SUPPORTS');
  assert.equal(candidate.evidenceStatus, 'EVIDENCE_CANDIDATE');
  assert.equal(candidate.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(candidate.finalRelation, 'NOT_COMPUTED');
  assert.equal(candidate.semanticTruth, false);
  assert.equal(candidate.soundness, 'NOT_COMPUTED');
  assert(Object.isFrozen(candidate) && Object.isFrozen(candidate.alignment));
});

check('opposite polarity creates only a reviewable REFUTES proposal', () => {
  const alignment = { ...exactAlignment, polarity: 'FALSE' };
  const candidate = Evidence.createEvidenceCandidate(definition(negative, 'REFUTES', alignment, 'STRUCTURALLY_ALIGNED'));
  assert.equal(candidate.proposedRelation, 'REFUTES');
  assert.equal(candidate.finalRelation, 'NOT_COMPUTED');
});

check('quantifier or modality differences cannot pass as SUPPORTS', () => {
  const quantifierMismatch = { ...exactAlignment, quantifier: 'FALSE' };
  assert.throws(
    () => Evidence.createEvidenceCandidate(definition(target, 'SUPPORTS', quantifierMismatch, 'STRUCTURALLY_ALIGNED')),
    (error) => error.code === 'RELATION_ALIGNMENT_MISMATCH',
  );
  const modalityMismatch = { ...exactAlignment, modality: 'FALSE' };
  const qualified = Evidence.createEvidenceCandidate(definition(target, 'QUALIFIES', modalityMismatch, 'STRUCTURALLY_ALIGNED'));
  assert.equal(qualified.proposedRelation, 'QUALIFIES');
});

check('unresolved Claim AST records are forbidden as evidence candidates', () => {
  const unresolved = Parser.parse('Система продолжает метапоток.').claimAst;
  assert.equal(unresolved.resolutionStatus, 'OOV');
  assert.throws(
    () => Evidence.createEvidenceCandidate(definition(unresolved, 'MENTIONS', {
      predicate: 'TRUE', arguments: 'UNKNOWN', polarity: 'TRUE', modality: 'TRUE', quantifier: 'TRUE', qualifiers: 'TRUE',
    }, 'REQUIRES_REVIEW')),
    (error) => error.code === 'UNRESOLVED_EVIDENCE_FORBIDDEN',
  );
});

check('candidate exact-key and content-address checks reject mutation', () => {
  const candidate = Evidence.createEvidenceCandidate(definition(target, 'SUPPORTS', exactAlignment, 'STRUCTURALLY_ALIGNED'));
  const extra = clone(candidate);
  extra.accepted = true;
  assert.equal(Evidence.validateEvidenceCandidate(extra).code, 'UNKNOWN_FIELD');
  const changed = clone(candidate);
  changed.proposedRelation = 'MENTIONS';
  assert.equal(Evidence.validateEvidenceCandidate(changed).code, 'CANDIDATE_ID_MISMATCH');
});

check('replay is deterministic across factories', () => {
  const leftPassage = Evidence.createSourcePassage(source, passage.locator);
  const rightPassage = Evidence.createSourcePassage(source, passage.locator);
  assert.equal(leftPassage.contentHash, rightPassage.contentHash);
  const left = Evidence.createEvidenceCandidate(definition(target, 'SUPPORTS', exactAlignment, 'STRUCTURALLY_ALIGNED'));
  const right = Evidence.createEvidenceCandidate(definition(target, 'SUPPORTS', exactAlignment, 'STRUCTURALLY_ALIGNED'));
  assert.equal(left.candidateId, right.candidateId);
  assert.equal(left.contentHash, right.contentHash);
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
