const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const sources = [
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-controlled-russian-lexicon',
  'p78-claim-ir', 'p78-linguistic-parser-adapter',
];

function load() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  sources.forEach((name) => new vm.Script(fs.readFileSync(lib(name), 'utf8'), { filename: lib(name) }).runInContext(context));
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
const Parser = api.MRDP78LinguisticParserAdapter;
const ClaimIR = api.MRDP78ClaimIR;
const Canonical = api.MRDP78CanonicalJSON;
const Lexicon = api.MRDP78ControlledRussianLexicon;

check('adapter API is frozen, versioned, structural-only and pinned to the lexicon', () => {
  equal(Parser.status, 'READY', 'parser status');
  equal(Parser.version, '1.1.0', 'parser version');
  equal(Parser.lexiconHash, Lexicon.lexiconHash, 'lexicon pin');
  equal(Parser.semanticTruth, false, 'semantic truth');
  equal(Parser.evidenceStatus, 'NOT_COMPUTED', 'evidence status');
  assert(Object.isFrozen(Parser) && Object.isFrozen(Parser.parserRef), 'parser API is mutable');
});

check('controlled subject-predicate-object sentence produces a valid RESOLVED Claim AST', () => {
  const result = Parser.parse('Система сохраняет состояние.');
  equal(result.status, 'READY', 'status');
  equal(result.resolutionStatus, 'RESOLVED', 'resolution');
  equal(result.claimAst.predicate.lemma, 'сохранять', 'predicate lemma');
  equal(result.claimAst.predicate.relationTypeId, 'p78:predicate:preserve', 'predicate id');
  equal(result.claimAst.arguments.length, 2, 'argument count');
  equal(result.claimAst.arguments[0].role, 'AGENT', 'subject role');
  equal(result.claimAst.arguments[1].role, 'THEME', 'object role');
  equal(ClaimIR.validateClaimAst(result.claimAst).status, 'VALID', 'claim validation');
});

check('negation remains explicit and local to the predicate', () => {
  const result = Parser.parse('Система не сохраняет состояние.');
  equal(result.status, 'READY', 'status');
  equal(result.claimAst.polarity, 'NEGATIVE', 'polarity');
  equal(result.claimAst.modality, 'FACT', 'modality');
});

check('hypothesis and time qualifier are represented independently', () => {
  const hypothesis = Parser.parse('Возможно система изменяет параметр.');
  const timed = Parser.parse('Система изменяет параметр сейчас.');
  equal(hypothesis.status, 'READY', 'hypothesis status');
  equal(hypothesis.claimAst.modality, 'HYPOTHESIS', 'hypothesis modality');
  equal(timed.status, 'READY', 'timed status');
  equal(timed.claimAst.qualifiers.time, 'сейчас', 'time qualifier');
});
check('NONE quantifier covers masculine, feminine and neuter forms', () => {
  const cases = ['Ни один редактор не изменяет текст.', 'Ни одна система не сохраняет состояние.', 'Ни одно кольцо не выходит из системы.'];
  cases.forEach((text) => {
    const result = Parser.parse(text);
    equal(result.status, 'READY', `${text} status`);
    equal(result.claimAst.quantifier, 'NONE', `${text} quantifier`);
  });
});


check('ontology role constraints resolve polysemous ring and center', () => {
  const result = Parser.parse('Кольцо вращается вокруг центра.');
  equal(result.status, 'READY', 'status');
  equal(result.claimAst.arguments[0].senseId, 'p78:sense:ring.semantic', 'ring sense');
  equal(result.claimAst.arguments[1].senseId, 'p78:sense:center.geometry', 'center sense');
});

check('unresolved same-role senses remain AMBIGUOUS', () => {
  const result = Parser.parse('Система описывает движение.');
  equal(result.status, 'AMBIGUOUS', 'status');
  equal(result.resolutionStatus, 'AMBIGUOUS', 'resolution');
  assert(result.issues.some((item) => item.code === 'ROLE_AMBIGUOUS'), 'ambiguity reason missing');
  equal(result.semanticTruth, false, 'semantic truth');
});

check('unknown content remains OOV without an invented sense', () => {
  const result = Parser.parse('Система сохраняет квантовыйпирог.');
  equal(result.status, 'OOV', 'status');
  equal(result.resolutionStatus, 'OOV', 'resolution');
  assert(result.issues.some((item) => item.code === 'OOV_TOKEN'), 'OOV token missing');
  assert(!JSON.stringify(result).includes('p78:sense:квантовыйпирог'), 'invented sense');
});

check('multiple sentences and predicates fail closed', () => {
  const sentences = Parser.parse('Система сохраняет состояние. Система изменяет параметр.');
  const predicates = Parser.parse('Система сохраняет и изменяет состояние.');
  equal(sentences.status, 'AMBIGUOUS', 'multi-sentence status');
  equal(sentences.code, 'MULTI_SENTENCE_UNSUPPORTED', 'multi-sentence code');
  equal(sentences.claimAst, null, 'multi-sentence claim');
  equal(predicates.status, 'AMBIGUOUS', 'multi-predicate status');
  equal(predicates.code, 'MULTIPLE_PREDICATES', 'multi-predicate code');
});

check('empty, stale and exhausted inputs return explicit bounded outcomes', () => {
  equal(Parser.parse('').code, 'EMPTY_INPUT', 'empty code');
  equal(Parser.parse('Система сохраняет состояние.', { expectedLexiconHash: Canonical.hashText('stale') }).code, 'STALE_LEXICON', 'stale code');
  equal(Parser.parse('Система не сохраняет состояние.', { maxTokens: 3 }).code, 'TOKEN_BUDGET_EXCEEDED', 'budget code');
});

check('claim text is bounded before expensive language analysis', () => {
  equal(Parser.limits.maxClaimCodeUnits, 8192, 'claim code-unit limit');
  equal(Parser.limits.overflowInputHashMode, 'CHUNK_CHAIN_SHA256', 'overflow hash mode');
  equal(Parser.limits.overflowHashChunkCodeUnits, 4096, 'overflow hash chunk');
  const oversized = `Система проверяет документ ${'условие '.repeat(1100)}.`;
  const result = Parser.parse(oversized);
  equal(result.code, 'CLAIM_TEXT_BUDGET_EXCEEDED', 'claim text budget code');
  equal(result.claimAst, null, 'oversized claim AST');
  assert(Canonical.isSha256(result.inputHash), 'bounded rejection fingerprint');
  equal(Parser.parse(oversized).inputHash, result.inputHash, 'rejection fingerprint replay');
  const middleA = 'а'.repeat(9000);
  const middleB = `${middleA.slice(0, 4500)}б${middleA.slice(4501)}`;
  assert(Parser.parse(middleA).inputHash !== Parser.parse(middleB).inputHash, 'middle input change not bound');
  assert(Parser.parse(middleA).resultHash !== Parser.parse(middleB).resultHash, 'middle result change not bound');
  const parserSource = fs.readFileSync(lib('p78-linguistic-parser-adapter'), 'utf8');
  let analyzeCalls = 0;
  const context = vm.createContext({
    MRDP78CanonicalJSON: Canonical,
    MRDSemanticLanguage: Object.freeze({ analyze() { analyzeCalls += 1; throw new Error('analysis must not run'); } }),
    MRDP78ControlledRussianLexicon: Lexicon,
    MRDP78ClaimIR: ClaimIR,
  });
  vm.runInContext(parserSource, context);
  const trapped = context.MRDP78LinguisticParserAdapter.parse(oversized);
  equal(trapped.code, 'CLAIM_TEXT_BUDGET_EXCEEDED', 'trapped budget code');
  equal(analyzeCalls, 0, 'language analysis ran before the claim budget');
});

check('parse replay is deterministic, immutable and input-preserving', () => {
  const options = { maxTokens: 32 };
  const before = JSON.stringify(options);
  const first = Parser.parse('Система проверяет формулу.', options);
  const second = Parser.replay('Система проверяет формулу.', options);
  equal(Canonical.canonicalize(first), Canonical.canonicalize(second), 'replay');
  equal(JSON.stringify(options), before, 'options mutated');
  assert(Object.isFrozen(first) && Object.isFrozen(first.claimAst) && Object.isFrozen(first.tokens), 'result is mutable');
  assert(/^sha256:[0-9a-f]{64}$/.test(first.resultHash), 'result hash');
});

check('result hash binds the exact parser result without host state', () => {
  const result = Parser.parse('Система сохраняет состояние.');
  const copy = JSON.parse(JSON.stringify(result));
  const hash = copy.resultHash;
  delete copy.resultHash;
  equal(hash, Canonical.hashCanonical(copy), 'result hash');
  assert(/^sha256:[0-9a-f]{64}$/.test(result.inputHash), 'input hash');
});

check('fresh VM replay produces the same Claim AST identity', () => {
  const other = load();
  const left = Parser.parse('Кольцо вращается вокруг центра.');
  const right = other.MRDP78LinguisticParserAdapter.parse('Кольцо вращается вокруг центра.');
  equal(left.claimAst.claimAstId, right.claimAst.claimAstId, 'claim identity');
  equal(left.resultHash, right.resultHash, 'result identity');
});

check('source has no DOM, network, clock, random, dynamic-code or loader dependency', () => {
  const source = fs.readFileSync(lib('p78-linguistic-parser-adapter'), 'utf8');
  ['document.', 'window.fetch', 'XMLHttpRequest', 'WebSocket', 'Date.now', 'performance.now', 'Math.random', 'eval(', 'new Function', 'require(']
    .forEach((needle) => assert(!source.includes(needle), `forbidden source token: ${needle}`));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
