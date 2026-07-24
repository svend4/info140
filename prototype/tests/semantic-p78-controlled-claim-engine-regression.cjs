const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const names = [
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-controlled-russian-lexicon', 'p78-claim-ir',
  'p78-linguistic-parser-adapter', 'p78-claim-structural-matcher', 'p78-controlled-claim-engine',
];
function load() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  names.forEach((name) => new vm.Script(fs.readFileSync(lib(name), 'utf8'), { filename: lib(name) }).runInContext(context));
  return sandbox;
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function equal(actual, expected, message) { assert(actual === expected, `${message}: ${actual} !== ${expected}`); }
const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

const api = load();
const EngineModule = api.MRDP78ControlledClaimEngine;
const Matcher = api.MRDP78ClaimStructuralMatcher;
const Parser = api.MRDP78LinguisticParserAdapter;
const Canonical = api.MRDP78CanonicalJSON;
const engine = EngineModule.create();

check('engine and matcher expose frozen pinned structural APIs', () => {
  equal(engine.status, 'READY', 'engine status');
  equal(Matcher.status, 'READY', 'matcher status');
  equal(engine.identity.lexiconHash, Parser.lexiconHash, 'lexicon identity');
  equal(engine.identity.patternSetHash, Matcher.patternSetHash, 'pattern identity');
  assert(Object.isFrozen(engine) && Object.isFrozen(Matcher), 'API mutable');
});

check('resolved positive claim matches the exact closed pattern', () => {
  const result = engine.run('Система сохраняет состояние.');
  equal(result.status, 'READY', 'result status');
  equal(result.resolutionStatus, 'RESOLVED', 'resolution');
  equal(result.structuralMatches.length, 1, 'match count');
  equal(result.structuralMatches[0].patternRef.patternId, 'p78:pattern:claim.preserve.positive', 'pattern');
  equal(result.structuralMatches[0].candidateKind, 'CLAIM_AST', 'candidate kind');
  assert(result.structuralMatches[0].constraints.every((item) => item.result === 'TRUE'), 'constraint failed');
});

check('negation selects a different pattern without changing argument senses', () => {
  const positive = engine.run('Система сохраняет состояние.');
  const negative = engine.run('Система не сохраняет состояние.');
  equal(negative.status, 'READY', 'negative status');
  equal(negative.claimAst.polarity, 'NEGATIVE', 'negative polarity');
  equal(negative.structuralMatches[0].patternRef.patternId, 'p78:pattern:claim.preserve.negative', 'negative pattern');
  equal(positive.claimAst.arguments[0].senseId, negative.claimAst.arguments[0].senseId, 'subject sense changed');
  equal(positive.claimAst.arguments[1].senseId, negative.claimAst.arguments[1].senseId, 'object sense changed');
});

check('ontology disambiguation reaches the rotate pattern', () => {
  const result = engine.run('Кольцо вращается вокруг центра.');
  equal(result.status, 'READY', 'status');
  equal(result.structuralMatches.length, 1, 'match count');
  equal(result.structuralMatches[0].patternRef.patternId, 'p78:pattern:claim.rotate.positive', 'pattern');
});

check('ambiguous and OOV claims never become structural matches', () => {
  const ambiguous = engine.run('Система описывает движение.');
  const oov = engine.run('Система сохраняет квантовыйпирог.');
  equal(ambiguous.status, 'AMBIGUOUS', 'ambiguous status');
  equal(ambiguous.structuralMatches.length, 0, 'ambiguous matches');
  equal(oov.status, 'OOV', 'OOV status');
  equal(oov.structuralMatches.length, 0, 'OOV matches');
  equal(ambiguous.semanticTruth, false, 'ambiguous truth');
  equal(oov.semanticTruth, false, 'OOV truth');
});

check('resolved but uncovered qualifier shape abstains instead of guessing', () => {
  const result = engine.run('Система сохраняет состояние сейчас.');
  equal(result.resolutionStatus, 'RESOLVED', 'resolution');
  equal(result.status, 'ABSTAIN', 'status');
  equal(result.code, 'NO_MATCHES', 'code');
  equal(result.structuralMatches.length, 0, 'matches');
});

check('trace keeps parse, pattern and evidence stages separate', () => {
  const result = engine.run('Система проверяет формулу.');
  equal(result.trace.steps.length, 3, 'trace steps');
  equal(result.trace.steps.map((step) => step.stage).join(','), 'PARSE_STRUCTURE,MATCH_PATTERN,EVIDENCE_GATE', 'stages');
  equal(result.trace.steps[0].status, 'READY', 'parse stage');
  equal(result.trace.steps[1].status, 'READY', 'pattern stage');
  equal(result.trace.steps[2].status, 'ABSTAIN', 'evidence stage');
  equal(result.finalStatus, 'ABSTAIN', 'final status');
  equal(result.evidenceStatus, 'NOT_COMPUTED', 'evidence status');
  equal(result.reviewStatus, 'REQUIRES_REVIEW', 'review status');
});

check('structural matching validates candidate identity and corruption', () => {
  const parsed = Parser.parse('Система сохраняет состояние.');
  const valid = Matcher.matchAll(parsed.claimAst);
  const corrupt = JSON.parse(JSON.stringify(parsed.claimAst));
  corrupt.polarity = 'NEGATIVE';
  equal(valid.status, 'STRUCTURAL_MATCH', 'valid status');
  equal(Matcher.matchAll(corrupt).status, 'INVALID', 'corrupt status');
});

check('stale identities and operation budgets fail closed', () => {
  const staleLexicon = engine.run('Система сохраняет состояние.', { expectedLexiconHash: Canonical.hashText('stale') });
  const stalePatterns = engine.run('Система сохраняет состояние.', { expectedPatternSetHash: Canonical.hashText('stale') });
  const budget = engine.run('Система сохраняет состояние.', { maxOperations: 1 });
  equal(staleLexicon.code, 'STALE_LEXICON', 'stale lexicon');
  equal(stalePatterns.code, 'STALE_PATTERN_SET', 'stale patterns');
  equal(budget.status, 'ABSTAIN', 'budget status');
  equal(budget.code, 'BUDGET_EXCEEDED', 'budget code');
});

check('same input replays byte-identically with bound hashes', () => {
  const first = engine.run('Система сохраняет состояние.');
  const second = engine.replay('Система сохраняет состояние.');
  equal(Canonical.canonicalize(first), Canonical.canonicalize(second), 'replay');
  const copy = JSON.parse(JSON.stringify(first));
  const hash = copy.resultHash;
  delete copy.resultHash;
  equal(hash, Canonical.hashCanonical(copy), 'result hash');
  assert(/^sha256:[0-9a-f]{64}$/.test(first.traceHash), 'trace hash');
});

check('fresh VM produces the same claim, match and trace identities', () => {
  const other = load().MRDP78ControlledClaimEngine.create();
  const left = engine.run('Кольцо вращается вокруг центра.');
  const right = other.run('Кольцо вращается вокруг центра.');
  equal(left.claimAst.claimAstId, right.claimAst.claimAstId, 'claim id');
  equal(left.structuralMatches[0].matchId, right.structuralMatches[0].matchId, 'match id');
  equal(left.traceHash, right.traceHash, 'trace id');
});

check('pure runtime sources have no commit, DOM, network, clock, random or dynamic-code path', () => {
  const source = ['p78-claim-structural-matcher', 'p78-controlled-claim-engine'].map((name) => fs.readFileSync(lib(name), 'utf8')).join('\n');
  ['actionController', 'commitSemanticAction', 'document.', 'window.fetch', 'XMLHttpRequest', 'WebSocket', 'Date.now', 'performance.now', 'Math.random', 'eval(', 'new Function', 'require(']
    .forEach((needle) => assert(!source.includes(needle), `forbidden source token: ${needle}`));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
