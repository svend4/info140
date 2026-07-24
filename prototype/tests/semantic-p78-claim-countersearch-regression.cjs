'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts',
  'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
  'p78-evidence-contracts', 'p78-local-text-index', 'p78-claim-countersearch',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const Search = global.MRDP78SearchContracts;
const LocalIndex = global.MRDP78LocalTextIndex;
const Parser = global.MRDP78LinguisticParserAdapter;
const Countersearch = global.MRDP78ClaimCountersearch;
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hash(label) { return Canonical.hashText(label); }
function source(sourceId, text) {
  return Search.createSourceSnapshot({ sourceId, revision: '1.0.0', language: 'ru', text });
}

const target = Parser.parse('Система сохраняет состояние.').claimAst;
const sources = [
  source(
    'p78.ag5.primary',
    'Сохранять состояние важно. Не сохранять состояние рискованно. Удерживать состояние означает продолжать его.',
  ),
  source(
    'p78.ag5.dependency',
    'Вторичный источник должен сохранять ссылку на первичный источник.',
  ),
];
const index = LocalIndex.createIndex(sources, { indexId: 'p78.ag5.countersearch-fixture' });
const options = {
  curatedTerms: ['удерживать'],
  dependencySourceIds: ['p78.ag5.dependency'],
};

check('draft API is immutable, disconnected and authority-bounded', () => {
  assert.equal(Countersearch.status, 'READY');
  assert.equal(Countersearch.integrationStatus, 'DISCONNECTED_DRAFT');
  assert.equal(Countersearch.finalStatus, 'ABSTAIN');
  assert.equal(Countersearch.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(Countersearch.maxOutputStatus, 'LOCATED');
  assert.equal(Countersearch.semanticTruth, false);
  assert.equal(Countersearch.commitAllowed, false);
  assert(Object.isFrozen(Countersearch) && Object.isFrozen(Countersearch.requiredPurposes));
});

check('projection emits all five mandatory purposes in stable order', () => {
  const outcome = Countersearch.project(target, options);
  assert.equal(outcome.status, 'READY');
  assert.deepEqual(outcome.projection.requiredPurposes, [
    'SUPPORT', 'POLARITY_COUNTER', 'QUALIFIER_SCOPE', 'ALTERNATE_DEFINITION', 'SOURCE_DEPENDENCY',
  ]);
  assert.deepEqual(
    outcome.projection.items.map((item) => item.purpose),
    outcome.projection.requiredPurposes,
  );
  assert.equal(new Set(outcome.projection.items.map((item) => item.query.contentHash)).size, 5);
  assert.equal(Countersearch.validateProjection(outcome.projection).status, 'VALID');
  assert.equal(outcome.finalStatus, 'ABSTAIN');
});

check('projection pins Claim, rules, thesaurus and dependency source filters', () => {
  const projection = Countersearch.project(target, options).projection;
  assert.equal(projection.targetClaimRef.contentHash, target.contentHash);
  assert.equal(projection.projectionRuleSetHash, Countersearch.projectionRuleSetHash);
  assert(Canonical.isSha256(projection.thesaurusHash));
  const dependency = projection.items.find((item) => item.purpose === 'SOURCE_DEPENDENCY');
  assert.deepEqual(dependency.query.filters.sourceIds, ['p78.ag5.dependency']);
  projection.items.forEach((item) => {
    assert.equal(item.query.origin.kind, 'CLAIM_AST');
    assert.equal(item.query.origin.claimId, target.claimAstId);
  });
});

check('content addressing is deterministic across option ordering and replay', () => {
  const leftOptions = {
    curatedTerms: ['хранить', 'удерживать'],
    dependencySourceIds: ['p78.ag5.primary', 'p78.ag5.dependency'],
  };
  const rightOptions = {
    curatedTerms: ['удерживать', 'хранить'],
    dependencySourceIds: ['p78.ag5.dependency', 'p78.ag5.primary'],
  };
  const leftProjection = Countersearch.project(target, leftOptions).projection;
  const rightProjection = Countersearch.project(target, rightOptions).projection;
  assert.equal(leftProjection.projectionId, rightProjection.projectionId);
  assert.equal(leftProjection.contentHash, rightProjection.contentHash);
  const first = Countersearch.run(index, target, options);
  const second = Countersearch.replay(index, target, options);
  assert.equal(first.runId, second.runId);
  assert.equal(first.contentHash, second.contentHash);
  assert.deepEqual(first, second);
});

check('bounded local run records pinned attempts and never resolves evidence', () => {
  const result = Countersearch.run(index, target, options);
  assert.equal(result.status, 'EXECUTED');
  assert.equal(result.code, 'COUNTERSEARCH_RESULTS_REQUIRE_REVIEW');
  assert.equal(result.attempts.length, 5);
  assert(result.attempts.every((attempt) => attempt.status === 'HITS'));
  assert(result.attempts.every((attempt) => Canonical.isSha256(attempt.resultHash)));
  assert(result.attempts.every((attempt) => attempt.passageClaimIds.length === 0));
  assert(result.attempts.every((attempt) => attempt.evidenceCandidateIds.length === 0));
  assert.equal(result.finalStatus, 'ABSTAIN');
  assert.equal(result.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(result.finalRelation, 'NOT_COMPUTED');
  assert.equal(result.semanticTruth, false);
  assert.equal(result.commitAllowed, false);
  assert.equal(Countersearch.validateRun(result).status, 'VALID');
  assert(Object.isFrozen(result) && Object.isFrozen(result.attempts[0]));
  assert(!/\b(?:SUPPORTED|REFUTED)\b/.test(JSON.stringify(result)));
});

check('fully empty bounded search states only scoped non-discovery', () => {
  const emptySource = source(
    'p78.ag5.empty',
    'Кольцо продолжает движение. Центр остаётся неподвижным.',
  );
  const emptyIndex = LocalIndex.createIndex([emptySource], { indexId: 'p78.ag5.empty-fixture' });
  const result = Countersearch.run(emptyIndex, target, {
    curatedTerms: ['удерживать'], dependencySourceIds: ['p78.ag5.empty'],
  });
  assert.equal(result.status, 'EXECUTED');
  assert.equal(result.code, 'NO_COUNTEREVIDENCE_FOUND_WITHIN_SCOPE');
  assert.equal(result.attempts.length, 5);
  result.attempts.forEach((attempt) => {
    assert.equal(attempt.status, 'EMPTY');
    assert.deepEqual(attempt.reasonCodes, ['NO_COUNTEREVIDENCE_FOUND_WITHIN_SCOPE']);
  });
  assert.deepEqual(result.reasonCodes, ['NO_COUNTEREVIDENCE_FOUND_WITHIN_SCOPE']);
  assert.equal(result.finalStatus, 'ABSTAIN');
});

check('visited query hashes stop a cycle before executing any search', () => {
  const projection = Countersearch.project(target, options).projection;
  const result = Countersearch.run(index, target, {
    ...options,
    visitedQueryHashes: [projection.items[2].query.contentHash],
  });
  assert.equal(result.status, 'ABSTAIN');
  assert.equal(result.code, 'CYCLE_DETECTED');
  assert.equal(result.attempts.length, 0);
  assert.equal(result.finalStatus, 'ABSTAIN');
});

check('query-count and operation budgets fail closed', () => {
  const queryBudget = Countersearch.run(index, target, { ...options, maxQueries: 4 });
  assert.equal(`${queryBudget.status}/${queryBudget.code}`, 'ABSTAIN/BUDGET_EXCEEDED');
  assert.equal(queryBudget.attempts.length, 0);
  const operationBudget = Countersearch.run(index, target, { ...options, maxOperations: 1 });
  assert.equal(`${operationBudget.status}/${operationBudget.code}`, 'ABSTAIN/BUDGET_EXCEEDED');
  assert(operationBudget.attempts.length <= 1);
  assert.equal(operationBudget.finalStatus, 'ABSTAIN');
});

check('all source, index, Claim, rule-set and thesaurus pins fail stale-closed', () => {
  const projection = Countersearch.project(target, options).projection;
  const stale = hash('stale');
  const cases = [
    ['STALE_SOURCE_SET', { expectedSourceSetHash: stale }],
    ['STALE_INDEX', { expectedIndexHash: stale }],
    ['STALE_CLAIM', { expectedClaimHash: stale }],
    ['STALE_PROJECTION_RULE_SET', { expectedProjectionRuleSetHash: stale }],
    ['STALE_THESAURUS', { expectedThesaurusHash: stale }],
  ];
  cases.forEach(([code, extra]) => {
    const result = Countersearch.run(index, target, { ...options, ...extra });
    assert.equal(`${result.status}/${result.code}`, `ABSTAIN/${code}`);
    assert.equal(result.finalStatus, 'ABSTAIN');
  });
  const pinned = Countersearch.run(index, target, {
    ...options,
    expectedSourceSetHash: index.manifest.sourceSetHash,
    expectedIndexHash: index.indexHash,
    expectedClaimHash: target.contentHash,
    expectedProjectionRuleSetHash: Countersearch.projectionRuleSetHash,
    expectedThesaurusHash: projection.thesaurusHash,
  });
  assert.equal(pinned.status, 'EXECUTED');
});

check('unresolved Claim AST cannot enter countersearch', () => {
  const unresolved = Parser.parse('Система сохраняет квантовыйпирог.').claimAst;
  assert.equal(unresolved.resolutionStatus, 'OOV');
  const result = Countersearch.run(index, unresolved, options);
  assert.equal(`${result.status}/${result.code}`, 'ABSTAIN/CLAIM_UNRESOLVED');
  assert.equal(result.projection, null);
  assert.equal(result.finalStatus, 'ABSTAIN');
});

check('unknown and malformed options are INVALID data, not fallback behavior', () => {
  const unknown = Countersearch.run(index, target, { ...options, semanticTruth: true });
  const malformed = Countersearch.run(index, target, { ...options, maxQueries: 0 });
  assert.equal(`${unknown.status}/${unknown.code}`, 'INVALID/UNKNOWN_OPTION');
  assert.equal(`${malformed.status}/${malformed.code}`, 'INVALID/INVALID_OPTION');
  assert.equal(unknown.finalStatus, 'ABSTAIN');
  assert.equal(malformed.finalStatus, 'ABSTAIN');
});

check('validators reject authority escalation and content mutation', () => {
  const projection = Countersearch.project(target, options).projection;
  const changedProjection = clone(projection);
  changedProjection.items[0].purpose = 'SOURCE_DEPENDENCY';
  assert.equal(Countersearch.validateProjection(changedProjection).status, 'INVALID');
  const result = Countersearch.run(index, target, options);
  const changedRun = clone(result);
  changedRun.finalStatus = 'CONTINUE';
  assert.equal(Countersearch.validateRun(changedRun).status, 'INVALID');
  const changedHash = clone(result);
  changedHash.code = 'NO_COUNTEREVIDENCE_FOUND_WITHIN_SCOPE';
  assert.equal(Countersearch.validateRun(changedHash).status, 'INVALID');
});

check('visited hashes and operation accounting are complete and deterministic', () => {
  const seed = hash('prior query');
  const result = Countersearch.run(index, target, { ...options, visitedQueryHashes: [seed] });
  const queryHashes = result.projection.items.map((item) => item.query.contentHash);
  assert.equal(result.visitedQueryHashes.length, 6);
  assert(result.visitedQueryHashes.includes(seed));
  queryHashes.forEach((queryHash) => assert(result.visitedQueryHashes.includes(queryHash)));
  assert.equal(
    result.operationCount,
    result.attempts.reduce((sum, attempt) => sum + attempt.operationCount, 0),
  );
});

check('module remains absent from HTML and contains no UI, network, clock or random path', () => {
  const moduleSource = fs.readFileSync(lib('p78-claim-countersearch'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'p78-living-ring-interface.html'), 'utf8');
  assert(!html.includes('p78-claim-countersearch.js'));
  assert(!/document\.|querySelector|addEventListener|fetch\s*\(|XMLHttpRequest|WebSocket|Date\.now|Math\.random|\beval\s*\(|\bnew\s+Function\s*\(/.test(moduleSource));
  assert(!/actionController|commitSemanticAction|executePortal/.test(moduleSource));
  assert(!/\b(?:SUPPORTED|REFUTED)\b/.test(moduleSource));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
