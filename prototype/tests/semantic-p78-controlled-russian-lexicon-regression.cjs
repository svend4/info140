'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const canonicalPath = path.join(root, 'lib', 'p78-canonical-json.js');
const lexiconPath = path.join(root, 'lib', 'p78-controlled-russian-lexicon.js');
const corpusPath = path.join(root, 'lib', 'p78-claim-golden-corpus.js');
const libraryPaths = [lexiconPath, corpusPath];

[canonicalPath, lexiconPath, corpusPath].forEach((file) => require(file));

const Canonical = global.MRDP78CanonicalJSON;
const Lexicon = global.MRDP78ControlledRussianLexicon;
const Corpus = global.MRDP78ClaimGoldenCorpus;
const ZERO_HASH = `sha256:${'0'.repeat(64)}`;
const checks = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  assert(actual === expected, `${message}: ${actual} !== ${expected}`);
}

function same(actual, expected, message) {
  equal(independentCanonical(actual), independentCanonical(expected), message);
}

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true, detail: '' });
  } catch (error) {
    checks.push({ name, ok: false, detail: error && error.stack ? error.stack : String(error) });
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function independentCanonical(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(independentCanonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${independentCanonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError(`unsupported value: ${typeof value}`);
}

function nodeHashCanonical(value) {
  return `sha256:${crypto.createHash('sha256').update(independentCanonical(value), 'utf8').digest('hex')}`;
}

function without(value, ...keys) {
  const result = clone(value);
  keys.forEach((key) => delete result[key]);
  return result;
}

function deeplyFrozen(value, seen = new WeakSet()) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => deeplyFrozen(value[key], seen));
}

function unique(values, message) {
  equal(new Set(values).size, values.length, message);
}

function ids(values, key) {
  return values.map((value) => value[key]);
}

function statusCounts() {
  return Corpus.fixtures.reduce((counts, fixture) => {
    const status = fixture.expected.resolutionStatus;
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

check('versioned stable globals and detached integration APIs are ready', () => {
  assert(Canonical && Canonical.version === '1.0.0', 'canonical API unavailable');
  assert(Lexicon && Lexicon.status === 'READY' && Lexicon.version === '1.0.0', 'lexicon API unavailable');
  assert(Corpus && Corpus.status === 'READY' && Corpus.version === '1.0.0', 'corpus API unavailable');
  ['concepts', 'predicateFrames', 'structuralPatterns', 'lexiconHash', 'patternSetHash'].forEach((name) => {
    assert(Object.prototype.hasOwnProperty.call(Lexicon, name), `Lexicon.${name} missing`);
  });
  ['fixtures', 'corpusHash'].forEach((name) => {
    assert(Object.prototype.hasOwnProperty.call(Corpus, name), `Corpus.${name} missing`);
  });
  ['resolve', 'predicateFrame', 'validateLexicon', 'verifyLexicon'].forEach((name) => {
    assert(typeof Lexicon[name] === 'function', `Lexicon.${name} missing`);
  });
  ['validateFixture', 'validateCorpus', 'verifyCorpus'].forEach((name) => {
    assert(typeof Corpus[name] === 'function', `Corpus.${name} missing`);
  });
  const { resolve, predicateFrame } = Lexicon;
  equal(resolve('процесс').selectedSenseId, 'p78:sense:process.dynamic', 'detached resolve failed');
  equal(predicateFrame('двигаться').predicateId, 'p78:predicate:move', 'detached predicateFrame failed');
});

check('inventory sizes meet Controlled Russian AG3 gates', () => {
  assert(Lexicon.concepts.length >= 100, 'fewer than 100 concept/sense records');
  assert(Lexicon.predicateFrames.length >= 20, 'fewer than 20 predicate frames');
  assert(Lexicon.structuralPatterns.length >= 20 && Lexicon.structuralPatterns.length <= 50, 'pattern count outside 20-50');
  assert(Corpus.fixtures.length >= 100, 'fewer than 100 golden fixtures');
  equal(Lexicon.recordCount, 144, 'concept/sense inventory changed');
  equal(Lexicon.predicateCount, 24, 'predicate inventory changed');
  equal(Lexicon.patternCount, 30, 'pattern inventory changed');
  equal(Corpus.fixtureCount, 120, 'golden fixture inventory changed');
});

check('all identifiers, sentences, and per-record surface forms are unique where required', () => {
  unique(ids(Lexicon.concepts, 'senseId'), 'duplicate senseId');
  unique(ids(Lexicon.predicateFrames, 'predicateId'), 'duplicate predicateId');
  unique(ids(Lexicon.structuralPatterns, 'patternId'), 'duplicate patternId');
  unique(ids(Corpus.fixtures, 'fixtureId'), 'duplicate fixtureId');
  unique(Corpus.fixtures.map((fixture) => fixture.sentence), 'duplicate golden sentence');
  Lexicon.concepts.forEach((concept) => {
    unique(concept.surfaceForms, `${concept.senseId} repeats a surface form`);
    assert(concept.surfaceForms.includes(concept.lemma), `${concept.senseId} omits its lemma`);
  });
});

check('sense, predicate, and structural pattern hashes match independent SHA-256', () => {
  Lexicon.concepts.forEach((record) => {
    equal(record.contentHash, nodeHashCanonical(without(record, 'contentHash')), `${record.senseId} hash mismatch`);
  });
  Lexicon.predicateFrames.forEach((record) => {
    equal(record.contentHash, nodeHashCanonical(without(record, 'contentHash')), `${record.predicateId} hash mismatch`);
  });
  Lexicon.structuralPatterns.forEach((record) => {
    equal(record.contentHash, nodeHashCanonical(without(record, 'contentHash')), `${record.patternId} hash mismatch`);
  });
});

check('lexiconHash and patternSetHash are independently reproducible', () => {
  equal(Lexicon.lexiconHash, nodeHashCanonical(without(Lexicon.lexicon, 'contentHash')), 'lexiconHash mismatch');
  const refs = Lexicon.structuralPatterns.map((pattern) => ({
    patternId: pattern.patternId,
    version: pattern.version,
    contentHash: pattern.contentHash
  }));
  equal(Lexicon.patternSetHash, nodeHashCanonical(refs), 'patternSetHash mismatch');
  assert(Lexicon.verifyLexicon(clone(Lexicon.lexicon), Lexicon.lexiconHash).status === 'READY', 'lexicon replay failed');
});

check('fixture and corpus hashes are independently reproducible', () => {
  Corpus.fixtures.forEach((fixture) => {
    equal(fixture.contentHash, nodeHashCanonical(without(fixture, 'contentHash')), `${fixture.fixtureId} hash mismatch`);
  });
  equal(Corpus.corpusHash, nodeHashCanonical(without(Corpus.corpus, 'corpusHash')), 'corpusHash mismatch');
  assert(Corpus.verifyCorpus(clone(Corpus.corpus), Corpus.corpusHash, Lexicon.lexiconHash).status === 'READY', 'corpus replay failed');
});

check('exact resolution resolves one explicit sense without normalization guesses', () => {
  const lower = Lexicon.resolve('процесс');
  const capitalized = Lexicon.resolve('Процесс');
  equal(lower.status, 'RESOLVED', 'lowercase explicit form did not resolve');
  equal(capitalized.status, 'RESOLVED', 'capitalized explicit form did not resolve');
  equal(lower.selectedSenseId, 'p78:sense:process.dynamic', 'wrong lowercase sense');
  equal(capitalized.selectedSenseId, 'p78:sense:process.dynamic', 'wrong capitalized sense');
  assert(lower.matchMode === 'EXACT' && lower.code === 'EXACT_SINGLE', 'resolver mode or reason changed');
  equal(lower.contentHash, nodeHashCanonical(without(lower, 'contentHash')), 'resolution hash mismatch');
  [' процесс', 'процесс ', 'ПРОЦЕСС', 'процессы'].forEach((surface) => {
    equal(Lexicon.resolve(surface).status, 'OOV', `resolver guessed for ${JSON.stringify(surface)}`);
  });
});

check('exact homonyms remain AMBIGUOUS and preserve all candidates', () => {
  const cases = {
    кольцо: ['p78:sense:ring.object', 'p78:sense:ring.semantic'],
    центр: ['p78:sense:center.generalization', 'p78:sense:center.geometry'],
    источник: ['p78:sense:source.cause', 'p78:sense:source.document'],
    поле: ['p78:sense:field.physical', 'p78:sense:field.semantic'],
    связь: ['p78:sense:relation.communication', 'p78:sense:relation.semantic'],
    движение: ['p78:sense:movement.physical', 'p78:sense:movement.semantic']
  };
  Object.entries(cases).forEach(([surface, expected]) => {
    const result = Lexicon.resolve(surface);
    equal(result.status, 'AMBIGUOUS', `${surface} was guessed`);
    equal(result.selectedSenseId, null, `${surface} selected a sense`);
    same(result.candidates.map((item) => item.senseId).sort(), expected.sort(), `${surface} candidates changed`);
  });
});

check('unknown surfaces and stale resolution pins fail closed', () => {
  const oov = Lexicon.resolve('квазикольцо');
  const stale = Lexicon.resolve('процесс', ZERO_HASH);
  assert(oov.status === 'OOV' && oov.code === 'OOV_SURFACE' && oov.candidates.length === 0, 'OOV result changed');
  assert(stale.status === 'REJECTED' && stale.code === 'STALE_LEXICON', 'stale resolver pin was accepted');
  assert(stale.selectedSenseId === null && stale.candidates.length === 0, 'stale result leaks a resolution');
});

check('predicateFrame resolves only exact predicate id, sense id, or lemma', () => {
  const byLemma = Lexicon.predicateFrame('двигаться');
  const bySense = Lexicon.predicateFrame('p78:sense:move.process');
  const byId = Lexicon.predicateFrame('p78:predicate:move');
  assert(byLemma === bySense && bySense === byId, 'predicate frame lookup paths disagree');
  equal(byLemma.roles[0].role, 'THEME', 'move frame role changed');
  equal(Lexicon.predicateFrame('Двигаться'), null, 'predicateFrame guessed capitalization');
  equal(Lexicon.predicateFrame('движение'), null, 'predicateFrame guessed a related noun');
  equal(Lexicon.predicateFrame('unknown'), null, 'unknown predicate frame resolved');
});

check('predicate inventory covers required AG3 operations and semantic roles', () => {
  const required = [
    'move', 'continue', 'generalize', 'detail', 'split', 'merge', 'cause', 'preserve',
    'verify', 'describe', 'rotate', 'enter', 'exit', 'reach', 'avoid', 'balance',
    'support', 'refute', 'limit', 'depend', 'consist', 'include', 'follow', 'change'
  ].map((suffix) => `p78:predicate:${suffix}`);
  same(ids(Lexicon.predicateFrames, 'predicateId').slice().sort(), required.sort(), 'predicate domain changed');
  const roles = new Set(Lexicon.predicateFrames.flatMap((frame) => frame.roles.map((role) => role.role)));
  ['AGENT', 'THEME', 'PATH', 'CAUSE', 'EFFECT', 'WHOLE', 'PART', 'RESULT', 'CLAIM', 'METHOD'].forEach((role) => {
    assert(roles.has(role), `required semantic role ${role} missing`);
  });
});

check('all structural patterns pin live predicates and closed roles', () => {
  Lexicon.structuralPatterns.forEach((pattern) => {
    const frame = Lexicon.getPredicateFrame(pattern.predicateRef.predicateId);
    assert(frame, `${pattern.patternId} predicate missing`);
    equal(pattern.predicateRef.contentHash, frame.contentHash, `${pattern.patternId} stale predicate hash`);
    const frameRoles = new Set(frame.roles.map((role) => role.role));
    pattern.roles.forEach((role) => {
      assert(frameRoles.has(role), `${pattern.patternId} unknown role ${role}`);
      assert(pattern.surfaceTemplate.includes(`{${role}}`), `${pattern.patternId} template omits ${role}`);
    });
  });
});

check('golden fixture refs, polarity, modality, qualifiers, and roles are pinned data', () => {
  Corpus.fixtures.forEach((fixture) => {
    const expected = fixture.expected;
    const pattern = Lexicon.getStructuralPattern(expected.patternRef.patternId);
    const frame = Lexicon.getPredicateFrame(expected.predicateRef.predicateId);
    assert(pattern && frame, `${fixture.fixtureId} dangling refs`);
    equal(expected.patternRef.contentHash, pattern.contentHash, `${fixture.fixtureId} pattern hash stale`);
    equal(expected.predicateRef.contentHash, frame.contentHash, `${fixture.fixtureId} predicate hash stale`);
    equal(pattern.predicateRef.predicateId, frame.predicateId, `${fixture.fixtureId} pattern/predicate disagree`);
    equal(expected.polarity, pattern.polarity, `${fixture.fixtureId} polarity changed`);
    equal(expected.modality, pattern.modality, `${fixture.fixtureId} modality changed`);
    Object.keys(expected.qualifiers).forEach((key) => {
      assert(pattern.qualifierKeys.includes(key), `${fixture.fixtureId} qualifier ${key} not allowed`);
    });
    same(expected.arguments.map((arg) => arg.role).sort(), pattern.roles.slice().sort(), `${fixture.fixtureId} roles differ`);
    assert(Corpus.validateFixture(clone(fixture)), `${fixture.fixtureId} did not replay`);
  });
});

check('golden status classes are distinct and internally closed', () => {
  same(statusCounts(), { RESOLVED: 96, AMBIGUOUS: 12, OOV: 12 }, 'status distribution changed');
  Corpus.listByStatus('RESOLVED').forEach((fixture) => {
    assert(fixture.expected.arguments.every((arg) => arg.senseId && arg.candidateSenseIds.length === 0), `${fixture.fixtureId} unresolved RESOLVED argument`);
    assert(fixture.expected.ambiguitySenseIds.length === 0 && fixture.expected.oovSurfaces.length === 0, `${fixture.fixtureId} inconsistent RESOLVED summary`);
  });
  Corpus.listByStatus('AMBIGUOUS').forEach((fixture) => {
    assert(fixture.expected.ambiguitySenseIds.length >= 2, `${fixture.fixtureId} lacks ambiguity candidates`);
    assert(fixture.expected.oovSurfaces.length === 0, `${fixture.fixtureId} mixes ambiguity and OOV`);
  });
  Corpus.listByStatus('OOV').forEach((fixture) => {
    assert(fixture.expected.oovSurfaces.length >= 1, `${fixture.fixtureId} lacks OOV surfaces`);
    assert(fixture.expected.ambiguitySenseIds.length === 0, `${fixture.fixtureId} mixes OOV and ambiguity`);
  });
});

check('public APIs, records, fixtures, and returned results are deeply frozen', () => {
  assert(deeplyFrozen(Lexicon), 'lexicon API is mutable');
  assert(deeplyFrozen(Lexicon.lexicon), 'lexicon envelope is mutable');
  assert(deeplyFrozen(Corpus), 'corpus API is mutable');
  assert(deeplyFrozen(Corpus.corpus), 'corpus envelope is mutable');
  assert(deeplyFrozen(Lexicon.resolve('процесс')), 'resolution result is mutable');
  assert(deeplyFrozen(Corpus.listByStatus('RESOLVED')), 'fixture selection is mutable');
});

check('lexicon corruption, unknown fields, and stale hashes are rejected', () => {
  const corrupted = clone(Lexicon.lexicon);
  corrupted.senses[0].definition = 'Повреждённая запись.';
  const corruptResult = Lexicon.verifyLexicon(corrupted, Lexicon.lexiconHash);
  assert(corruptResult.status === 'REJECTED' && corruptResult.code === 'RECORD_HASH_MISMATCH', `corruption: ${corruptResult.code}`);

  const unknown = clone(Lexicon.lexicon);
  unknown.surprise = true;
  const unknownResult = Lexicon.verifyLexicon(unknown, Lexicon.lexiconHash);
  assert(unknownResult.status === 'REJECTED' && unknownResult.code === 'UNKNOWN_FIELD', `unknown field: ${unknownResult.code}`);

  const staleResult = Lexicon.verifyLexicon(clone(Lexicon.lexicon), ZERO_HASH);
  assert(staleResult.status === 'REJECTED' && staleResult.code === 'STALE_LEXICON', `stale lexicon: ${staleResult.code}`);
});

check('corpus corruption, stale corpus, and stale lexicon pins are rejected', () => {
  const corrupted = clone(Corpus.corpus);
  corrupted.fixtures[0].sentence = 'Повреждённое предложение.';
  const corruptResult = Corpus.verifyCorpus(corrupted, Corpus.corpusHash, Lexicon.lexiconHash);
  assert(corruptResult.status === 'REJECTED' && corruptResult.code === 'FIXTURE_HASH_MISMATCH', `corpus corruption: ${corruptResult.code}`);

  const staleCorpus = Corpus.verifyCorpus(clone(Corpus.corpus), ZERO_HASH, Lexicon.lexiconHash);
  assert(staleCorpus.status === 'REJECTED' && staleCorpus.code === 'STALE_CORPUS', `stale corpus: ${staleCorpus.code}`);

  const staleLexicon = Corpus.verifyCorpus(clone(Corpus.corpus), Corpus.corpusHash, ZERO_HASH);
  assert(staleLexicon.status === 'REJECTED' && staleLexicon.code === 'STALE_LEXICON', `stale lexicon: ${staleLexicon.code}`);

  const staleRef = clone(Corpus.corpus);
  staleRef.lexiconRef.patternSetHash = ZERO_HASH;
  const staleRefResult = Corpus.verifyCorpus(staleRef, Corpus.corpusHash, Lexicon.lexiconHash);
  assert(staleRefResult.status === 'REJECTED' && staleRefResult.code === 'STALE_LEXICON', `stale pattern set: ${staleRefResult.code}`);
});

check('fresh VM execution reproduces globals, hashes, counts, and exact outcomes', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(canonicalPath, 'utf8'), context, { filename: canonicalPath });
  vm.runInContext(fs.readFileSync(lexiconPath, 'utf8'), context, { filename: lexiconPath });
  vm.runInContext(fs.readFileSync(corpusPath, 'utf8'), context, { filename: corpusPath });
  const vmLexicon = context.MRDP78ControlledRussianLexicon;
  const vmCorpus = context.MRDP78ClaimGoldenCorpus;
  assert(vmLexicon && vmCorpus, 'VM globals missing');
  equal(vmLexicon.lexiconHash, Lexicon.lexiconHash, 'VM lexiconHash differs');
  equal(vmLexicon.patternSetHash, Lexicon.patternSetHash, 'VM patternSetHash differs');
  equal(vmCorpus.corpusHash, Corpus.corpusHash, 'VM corpusHash differs');
  equal(vmCorpus.fixtures.length, Corpus.fixtures.length, 'VM fixture count differs');
  equal(vmLexicon.resolve('кольцо').status, 'AMBIGUOUS', 'VM ambiguity differs');
  equal(vmLexicon.resolve('процесс').selectedSenseId, 'p78:sense:process.dynamic', 'VM exact resolution differs');
});

check('libraries contain no DOM, network, clock, random, eval, or dynamic code APIs', () => {
  const forbidden = [
    ['fetch', /\bfetch\s*\(/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['WebSocket', /\bWebSocket\s*\(/],
    ['DOM query', /\bdocument\.(?:querySelector|getElementById|createElement|body)\b/],
    ['window access', /\bwindow\.(?:document|location|fetch|setTimeout)\b/],
    ['Date.now', /\bDate\.now\s*\(/],
    ['new Date', /\bnew\s+Date\s*\(/],
    ['performance clock', /\bperformance\.(?:now|timeOrigin)\b/],
    ['random', /\bMath\.random\s*\(/],
    ['eval', /\beval\s*\(/],
    ['Function constructor', /\bnew\s+Function\s*\(/]
  ];
  libraryPaths.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    forbidden.forEach(([name, pattern]) => assert(!pattern.test(source), `${path.basename(file)} uses forbidden ${name}`));
  });
});

check('gold fixtures are literal data and do not call a claim parser', () => {
  const source = fs.readFileSync(corpusPath, 'utf8');
  assert(source.includes('var FIXTURE_ROWS=['), 'literal fixture rows missing');
  assert(source.includes("['g001'") && source.includes("['g120'"), 'fixture row boundaries missing');
  assert(!/\b(?:parseClaim|claimParser|dependencyParser|morphologyParser)\b/.test(source), 'fixture module invokes a parser');
  assert(!/\.parse\s*\(/.test(source), 'fixture module computes annotations through parse()');
});

const failed = checks.filter((item) => !item.ok);
checks.forEach((item) => {
  if (!item.ok) console.error(`FAIL: ${item.name}\n${item.detail}`);
});

if (failed.length > 0) {
  console.error(`FAIL: ${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(1);
}

console.log(`PASS: ${checks.length}/${checks.length} checks.`);
