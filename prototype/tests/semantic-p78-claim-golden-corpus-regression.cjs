'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const sources = [
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-controlled-russian-lexicon',
  'p78-claim-ir', 'p78-linguistic-parser-adapter', 'p78-claim-structural-matcher',
  'p78-claim-golden-corpus',
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
function canonical(value) { return JSON.stringify(value, Object.keys(value || {}).sort()); }
function sorted(values) { return values.slice().sort(); }
function sameArray(actual, expected, message) {
  equal(JSON.stringify(sorted(actual)), JSON.stringify(sorted(expected)), message);
}

const checks = [];
function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

const api = load();
const Parser = api.MRDP78LinguisticParserAdapter;
const Matcher = api.MRDP78ClaimStructuralMatcher;
const ClaimIR = api.MRDP78ClaimIR;
const Corpus = api.MRDP78ClaimGoldenCorpus;
const Canonical = api.MRDP78CanonicalJSON;
const parsed = Corpus.fixtures.map((fixture) => ({ fixture, result: Parser.parse(fixture.sentence) }));

check('corpus, parser, matcher and Claim IR are ready and pinned to one lexicon', () => {
  equal(Corpus.status, 'READY', 'corpus status');
  equal(Parser.status, 'READY', 'parser status');
  equal(Matcher.status, 'READY', 'matcher status');
  equal(Parser.lexiconHash, Corpus.lexiconHash, 'parser corpus lexicon pin');
  equal(Matcher.lexiconHash, Corpus.lexiconHash, 'matcher corpus lexicon pin');
  equal(Corpus.fixtureCount, 120, 'fixture count');
});

check('all 120 sentences produce valid immutable Claim AST records', () => {
  parsed.forEach(({ fixture, result }) => {
    assert(result.claimAst, `${fixture.fixtureId} has no Claim AST`);
    equal(ClaimIR.validateClaimAst(result.claimAst).status, 'VALID', `${fixture.fixtureId} invalid Claim AST`);
    assert(Object.isFrozen(result) && Object.isFrozen(result.claimAst), `${fixture.fixtureId} mutable result`);
  });
});

check('RESOLVED, AMBIGUOUS and OOV labels replay exactly', () => {
  const counts = {};
  parsed.forEach(({ fixture, result }) => {
    equal(result.resolutionStatus, fixture.expected.resolutionStatus, `${fixture.fixtureId} resolution`);
    counts[result.resolutionStatus] = (counts[result.resolutionStatus] || 0) + 1;
  });
  equal(JSON.stringify(counts), JSON.stringify({ RESOLVED: 96, AMBIGUOUS: 12, OOV: 12 }), 'status counts');
});

check('predicate, polarity and modality replay exactly for every fixture', () => {
  parsed.forEach(({ fixture, result }) => {
    const expected = fixture.expected;
    equal(result.claimAst.predicate.relationTypeId, expected.predicateRef.predicateId, `${fixture.fixtureId} predicate`);
    equal(result.claimAst.polarity, expected.polarity, `${fixture.fixtureId} polarity`);
    equal(result.claimAst.modality, expected.modality, `${fixture.fixtureId} modality`);
  });
});

check('surface roles and selected or unresolved senses replay exactly', () => {
  parsed.forEach(({ fixture, result }) => {
    const byRole = Object.fromEntries(result.claimAst.arguments.map((argument) => [argument.role, argument]));
    fixture.expected.arguments.forEach((expected) => {
      const actual = byRole[expected.role];
      assert(actual, `${fixture.fixtureId} missing role ${expected.role}`);
      equal(actual.senseId, expected.senseId, `${fixture.fixtureId} ${expected.role} sense`);
      equal(result.surfaceBySpanId[actual.surfaceSpanId], expected.surface, `${fixture.fixtureId} ${expected.role} surface`);
    });
  });
});

check('ambiguity candidates and OOV surfaces remain explicit', () => {
  parsed.forEach(({ fixture, result }) => {
    const ambiguous = result.issues
      .filter((item) => item.code === 'ROLE_AMBIGUOUS')
      .flatMap((item) => String(item.detail).split(':').slice(1).join(':').split(',').filter(Boolean));
    const oov = result.issues.filter((item) => item.code === 'OOV_TOKEN').map((item) => String(item.token).toLocaleLowerCase('ru-RU'));
    sameArray(ambiguous, fixture.expected.ambiguitySenseIds, `${fixture.fixtureId} ambiguity candidates`);
    sameArray(oov, fixture.expected.oovSurfaces.map((item) => item.toLocaleLowerCase('ru-RU')), `${fixture.fixtureId} OOV surfaces`);
  });
});

check('resolved fixtures reach only their expected structural pattern', () => {
  parsed.forEach(({ fixture, result }) => {
    const batch = Matcher.matchAll(result.claimAst);
    if (fixture.expected.resolutionStatus === 'RESOLVED') {
      equal(batch.status, 'STRUCTURAL_MATCH', `${fixture.fixtureId} match status`);
      equal(batch.matches.length, 1, `${fixture.fixtureId} match count`);
      equal(batch.matches[0].patternRef.patternId, fixture.expected.patternRef.patternId, `${fixture.fixtureId} pattern`);
    } else {
      equal(batch.matches.length, 0, `${fixture.fixtureId} unresolved match leak`);
    }
    equal(batch.evidenceStatus, 'NOT_COMPUTED', `${fixture.fixtureId} evidence boundary`);
    equal(batch.semanticTruth, false, `${fixture.fixtureId} truth leak`);
  });
});

check('scenario annotations absent from source are never fabricated as qualifiers', () => {
  parsed.forEach(({ fixture, result }) => {
    const expectedKeys = Object.keys(fixture.expected.qualifiers);
    if (expectedKeys.length) equal(Object.keys(result.claimAst.qualifiers).length, 0, `${fixture.fixtureId} invented qualifier`);
  });
});

check('all results replay byte-identically in a fresh VM', () => {
  const other = load();
  parsed.forEach(({ fixture, result }) => {
    const replay = other.MRDP78LinguisticParserAdapter.parse(fixture.sentence);
    equal(replay.resultHash, result.resultHash, `${fixture.fixtureId} result hash`);
    equal(replay.claimAst.contentHash, result.claimAst.contentHash, `${fixture.fixtureId} Claim AST hash`);
  });
  assert(/^sha256:[0-9a-f]{64}$/.test(Corpus.corpusHash), 'corpus hash malformed');
  assert(/^sha256:[0-9a-f]{64}$/.test(Canonical.hashCanonical(Corpus.corpus)), 'canonical hash unavailable');
});

check('parser source cannot consult the golden corpus or fixture identities', () => {
  const source = fs.readFileSync(lib('p78-linguistic-parser-adapter'), 'utf8');
  ['p78-claim-golden-corpus', 'MRDP78ClaimGoldenCorpus', 'p78:golden:', Corpus.corpusHash]
    .forEach((needle) => assert(!source.includes(needle), `parser leaks corpus token: ${needle}`));
  assert(!/\bg(?:0[0-9]{2}|1[01][0-9]|120)\b/.test(source), 'parser embeds fixture ids');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;

