'use strict';

const fs = require('node:fs');
const path = require('node:path');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'p78-search-contracts', 'p78-local-text-index', 'p78-search-corpus',
  'p78-formula-registry', 'p78-formula-shape-index', 'p78-formula-structural-matcher',
  'p78-query-projector', 'p78-bidirectional-retrieval',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const Contracts = global.MRDP78SearchContracts;
const Corpus = global.MRDP78SearchCorpus;
const Registry = global.MRDP78FormulaRegistry;
const Shape = global.MRDP78FormulaShapeIndex;
const Retrieval = global.MRDP78BidirectionalRetrieval;
const engine = Retrieval.create();

function assert(condition, message) { if (!condition) throw new Error(message); }
function equal(actual, expected, message) { if (actual !== expected) throw new Error(`${message}: ${actual} !== ${expected}`); }

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

check('bidirectional engine builds two pinned indexes without semantic authority', () => {
  equal(Retrieval.status, 'READY', 'retrieval API blocked');
  equal(engine.status, 'READY', 'engine blocked');
  assert(Object.isFrozen(Retrieval) && Object.isFrozen(engine) && Object.isFrozen(engine.textIndex), 'engine or indexes mutable');
  equal(engine.identity.sourceSetHash, Corpus.sourceSetHash, 'source set identity changed');
  equal(engine.identity.registryHash, Registry.registryHash, 'registry identity changed');
  equal(engine.identity.formulaIndexHash, Shape.indexHash, 'formula index identity changed');
  assert(Canonical.isSha256(engine.identity.indexHash), 'text index hash missing');
});

check('normative ring step separates located, structural and uncomputed evidence', () => {
  const result = engine.run('движение', 'pressure.margin');
  equal(result.status, 'READY', result.detail || 'normative run failed');
  equal(result.finalStatus, 'ABSTAIN', 'MVP overclaimed final evidence');
  assert(result.located.length >= 2, `located=${result.located.length}`);
  equal(result.structuralMatches.length, 1, 'selected formula did not match exactly once');
  equal(result.structuralMatches[0].bindings.formulaId, 'pressure.margin', 'wrong formula matched');
  assert(result.projection.queries.length >= 4, 'Formula AST projection missing');
  equal(result.evidenceCandidates.length, 0, 'evidence candidate was fabricated');
  equal(result.evidenceStatus, 'NOT_COMPUTED', 'evidence boundary changed');
  equal(result.semanticTruth, false, 'semantic truth claimed');
  result.located.forEach((hit) => equal(hit.status, 'LOCATED', 'lexical hit promoted'));
  result.structuralMatches.forEach((match) => equal(match.status, 'STRUCTURAL_MATCH', 'structural status changed'));
});

check('same inputs replay byte-identically with a valid three-step trace', () => {
  const first = engine.run('движение', 'pressure.margin');
  const replay = engine.replay('движение', 'pressure.margin');
  equal(JSON.stringify(first), JSON.stringify(replay), 'replay changed');
  equal(Contracts.validateBidirectionalSearchTrace(first.trace).status, 'VALID', 'trace contract rejected');
  equal(first.trace.steps.length, 3, 'trace step count changed');
  equal(first.trace.steps.map((step) => step.direction).join(','), 'GREP_TO_AST,AST_TO_GREP,EVIDENCE_GATE', 'direction order changed');
  equal(first.trace.steps[2].status, 'ABSTAIN', 'evidence gate did not abstain');
  assert(Canonical.isSha256(first.traceHash) && first.traceHash === first.trace.contentHash, 'trace identity missing');
  assert(Canonical.isSha256(first.resultHash), 'result identity missing');
});

check('exact Russian phrase preserves a bounded addressable span', () => {
  const result = engine.run('движение по окружности', 'ring.balance');
  equal(result.status, 'READY', result.detail || 'phrase search failed');
  const geometry = result.located.find((hit) => hit.sourceId === 'p78.geometry.2d' && hit.matchedText.toLowerCase() === 'движение по окружности');
  assert(geometry, 'exact phrase span not found');
  assert(geometry.contextText.includes('ограниченное обобщение') && geometry.contextText.length < 190, 'bounded context absent');
  equal(result.structuralMatches[0].bindings.formulaId, 'ring.balance', 'formula selector ignored');
});

check('formula selection changes structural match and exact projection predictably', () => {
  const balance = engine.run('баланс', 'ring.balance');
  const edge = engine.run('давление края', 'pressure.edge');
  equal(balance.structuralMatches[0].bindings.formulaId, 'ring.balance', 'balance match wrong');
  equal(edge.structuralMatches[0].bindings.formulaId, 'pressure.edge', 'edge match wrong');
  assert(balance.projection.queries.some((query) => query.expression.value === 'ring.balance'), 'balance formulaId not projected');
  assert(edge.projection.queries.some((query) => query.expression.value === 'pressure.edge'), 'edge formulaId not projected');
  assert(balance.traceHash !== edge.traceHash, 'different runs share trace identity');
});

check('empty, unknown formula and exhausted query budget abstain explicitly', () => {
  const empty = engine.run('   ', 'ring.balance');
  const unknown = engine.run('движение', 'not.registered');
  const budget = engine.run('движение', 'pressure.margin', { maxQueries: 1 });
  equal(`${empty.status}/${empty.code}`, 'ABSTAIN/EMPTY_QUERY', 'empty query fallback changed');
  equal(`${unknown.status}/${unknown.code}`, 'ABSTAIN/NO_MATCHES', 'unknown formula fallback changed');
  equal(`${budget.status}/${budget.code}`, 'ABSTAIN/BUDGET_EXCEEDED', 'query budget fallback changed');
});

check('cycle and all stale identities fail closed', () => {
  const ready = engine.run('движение', 'pressure.margin');
  const other = Canonical.hashText('other identity');
  const cycle = engine.run('движение', 'pressure.margin', { visitedQueryHashes: [ready.query.contentHash] });
  const staleSource = engine.run('движение', 'pressure.margin', { expectedSourceSetHash: other });
  const staleIndex = engine.run('движение', 'pressure.margin', { expectedIndexHash: other });
  const staleRegistry = engine.run('движение', 'pressure.margin', { expectedRegistryHash: other });
  equal(`${cycle.status}/${cycle.code}`, 'ABSTAIN/CYCLE_DETECTED', 'cycle accepted');
  [staleSource, staleIndex, staleRegistry].forEach((result) => equal(`${result.status}/${result.code}`, 'ABSTAIN/STALE_INDEX', 'stale identity accepted'));
});

check('invalid options are data errors, never dynamic fallback', () => {
  const unknown = engine.run('движение', 'ring.balance', { semanticTruth: true });
  const invalid = engine.run('движение', 'ring.balance', { maxHits: 0 });
  equal(`${unknown.status}/${unknown.code}`, 'INVALID/UNKNOWN_FIELD', 'unknown option accepted');
  equal(`${invalid.status}/${invalid.code}`, 'INVALID/INVALID_VALUE', 'invalid numeric option accepted');
});

check('runtime source has no DOM, network, clock, random, eval or commit path', () => {
  const source = fs.readFileSync(lib('p78-bidirectional-retrieval'), 'utf8');
  assert(!/document\.|querySelector|addEventListener|commitSemanticAction|actionController|executePortal/.test(source), 'pure retrieval reached UI or action path');
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(|Math\.random|Date\.now|fetch\s*\(/.test(source), 'retrieval is nondeterministic or dynamic');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
