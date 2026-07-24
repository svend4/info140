'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const canonicalPath = path.join(root, 'lib', 'p78-canonical-json.js');
const contractsPath = path.join(root, 'lib', 'p78-search-contracts.js');
const corpusPath = path.join(root, 'lib', 'p78-claim-evidence-corpus.js');
const corpusSource = fs.readFileSync(corpusPath, 'utf8');

vm.runInThisContext(fs.readFileSync(canonicalPath, 'utf8'), { filename: canonicalPath });
vm.runInThisContext(fs.readFileSync(contractsPath, 'utf8'), { filename: contractsPath });
vm.runInThisContext(corpusSource, { filename: corpusPath });

const Canonical = globalThis.MRDP78CanonicalJSON;
const Contracts = globalThis.MRDP78SearchContracts;
const Corpus = globalThis.MRDP78ClaimEvidenceCorpus;
const checks = [];

function check(name, callback) {
  try {
    callback();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      detail: error && error.stack ? error.stack : String(error)
    });
  }
}

function equal(actual, expected, message) {
  assert.equal(actual, expected, message);
}

function same(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
}

function independentCanonical(value) {
  const type = typeof value;
  if (value === null) return 'null';
  if (type === 'string' || type === 'boolean') return JSON.stringify(value);
  if (type === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(independentCanonical).join(',') + ']';
  }
  if (value && type === 'object') {
    return '{' + Object.keys(value).sort().map(function(key) {
      return JSON.stringify(key) + ':' + independentCanonical(value[key]);
    }).join(',') + '}';
  }
  throw new TypeError('unsupported value: ' + type);
}

function nodeHashText(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function nodeHashCanonical(value) {
  return nodeHashText(independentCanonical(value));
}

function without(value, key) {
  const result = JSON.parse(JSON.stringify(value));
  delete result[key];
  return result;
}

function sourceSetPayload(records) {
  const refs = records.map(function(record) {
    return {
      sourceId: record.sourceId,
      revision: record.revision,
      sourceHash: record.sourceHash
    };
  }).sort(function(left, right) {
    const a = left.sourceId + '@' + left.revision;
    const b = right.sourceId + '@' + right.revision;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return { schema: 'meridian.source-set/1', sources: refs };
}

function corpusManifest(corpus) {
  return {
    schema: 'meridian.claim-evidence-corpus-manifest/1',
    version: corpus.version,
    sourceSchema: corpus.sourceSchema,
    sourceSetHash: corpus.sourceSetHash,
    records: corpus.records.map(function(record) {
      return {
        sourceId: record.sourceId,
        revision: record.revision,
        textHash: record.textHash,
        sourceHash: record.sourceHash
      };
    }),
    metadata: corpus.metadata,
    counts: corpus.counts
  };
}

function segmentSentences(text) {
  return text.split(/(?<=[.!?])\s+/u).filter(function(sentence) {
    return sentence.length > 0;
  });
}

function deeplyFrozen(value, seen) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return true;
  seen = seen || new WeakSet();
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every(function(key) {
    return deeplyFrozen(value[key], seen);
  });
}

check('classic IIFE exports a ready versioned sidecar API', function() {
  assert(Canonical && Canonical.status !== 'BLOCKED', 'canonical dependency unavailable');
  assert(Contracts && Contracts.status === 'READY', 'search contracts unavailable');
  assert(Corpus, 'corpus global missing');
  equal(Corpus.version, '1.0.0', 'version changed');
  equal(Corpus.schema, 'meridian.claim-evidence-corpus/1', 'schema changed');
  equal(Corpus.status, 'READY', 'corpus is not ready');
  equal(Corpus.sourceSchema, Contracts.schemas.sourceSnapshot, 'source schema differs');
});

check('inventory contains exactly ten admitted sources and thirty passages', function() {
  equal(Corpus.records.length, 10, 'source count changed');
  equal(Corpus.metadata.length, 10, 'metadata count changed');
  same(Corpus.counts, {
    sourceCount: 10,
    admittedSourceCount: 10,
    passageSentenceCount: 30
  }, 'published counts changed');
  equal(Corpus.records.filter(function(record) {
    return record.status === 'ADMITTED';
  }).length, 10, 'not every source is admitted');
});

check('source and metadata identifiers are unique and aligned', function() {
  const sourceIds = Corpus.records.map(function(record) { return record.sourceId; });
  const metadataIds = Corpus.metadata.map(function(item) { return item.sourceId; });
  equal(new Set(sourceIds).size, 10, 'duplicate sourceId');
  equal(new Set(metadataIds).size, 10, 'duplicate metadata sourceId');
  same(metadataIds.slice().sort(), sourceIds.slice().sort(), 'metadata/source domains differ');
  same(Object.keys(Corpus.metadataBySourceId).sort(), sourceIds.slice().sort(), 'metadata map domain differs');
  Corpus.metadata.forEach(function(item) {
    assert.strictEqual(Corpus.metadataBySourceId[item.sourceId], item, 'metadata map copied or replaced ' + item.sourceId);
  });
});

check('every record is a valid closed SourceSnapshot', function() {
  Corpus.records.forEach(function(record) {
    const validation = Contracts.validateSourceSnapshot(record);
    equal(validation.status, 'VALID', record.sourceId + ' is invalid: ' + validation.code);
    same(Object.keys(record).sort(), [
      'language', 'revision', 'schema', 'sourceHash', 'sourceId', 'status', 'text', 'textHash'
    ], record.sourceId + ' contains non-contract fields');
    equal(record.language, 'ru', record.sourceId + ' language changed');
    equal(record.revision, '1.0.0', record.sourceId + ' revision changed');
  });
});

check('independent sentence segmentation yields three per source and thirty total', function() {
  let total = 0;
  Corpus.records.forEach(function(record) {
    const sentences = segmentSentences(record.text);
    equal(sentences.length, 3, record.sourceId + ' does not contain exactly three sentences');
    sentences.forEach(function(sentence) {
      assert(/^[А-ЯЁ][^.!?]*[.!?]$/u.test(sentence), 'malformed short passage: ' + sentence);
      assert(sentence.length <= 72, 'passage is not short: ' + sentence);
    });
    total += sentences.length;
  });
  equal(total, 30, 'segmented passage total changed');
  equal(total, Corpus.counts.passageSentenceCount, 'published passage count is stale');
});

check('mandatory AG3 contrasts, exact rotation, near misses, ambiguity, and OOV surfaces are present', function() {
  const sentences = Corpus.records.flatMap(function(record) {
    return segmentSentences(record.text);
  });
  [
    'Частица движется по орбите.',
    'Частица не движется по орбите.',
    'Частица вращается вокруг орбиты.',
    'Система сохраняет состояние.',
    'Система не сохраняет состояние.',
    'Система изменяет состояние.',
    'Редактор не обобщает утверждение.',
    'Параметр не вызывает коллапс.',
    'Система описывает движение.',
    'Кольцо выходит из системы.',
    'Источник поддерживает тезис.',
    'Условие ограничивает связь.',
    'Связь зависит от контекста.',
    'Поле включает частицу.',
    'Система продолжает метапоток.',
    'Редактор детализирует квазитекст.',
    'Метаполе входит в систему.'
  ].forEach(function(sentence) {
    assert(sentences.includes(sentence), 'required passage missing: ' + sentence);
  });
});

check('record, source-set, and corpus SHA-256 values reproduce independently', function() {
  Corpus.records.forEach(function(record) {
    equal(record.textHash, nodeHashText(record.text), record.sourceId + ' textHash mismatch');
    equal(record.sourceHash, nodeHashCanonical(without(record, 'sourceHash')), record.sourceId + ' sourceHash mismatch');
  });
  equal(Corpus.sourceSetHash, nodeHashCanonical(sourceSetPayload(Corpus.records)), 'sourceSetHash mismatch');
  equal(Corpus.corpusHash, nodeHashCanonical(corpusManifest(Corpus)), 'corpusHash mismatch');
  assert(/^sha256:[0-9a-f]{64}$/.test(Corpus.sourceSetHash), 'sourceSetHash format changed');
  assert(/^sha256:[0-9a-f]{64}$/.test(Corpus.corpusHash), 'corpusHash format changed');
  same(Corpus.hashes, {
    sourceSetHash: Corpus.sourceSetHash,
    corpusHash: Corpus.corpusHash
  }, 'hash summary differs');
});

check('metadata is separate from the closed source records and covered by corpusHash', function() {
  Corpus.records.forEach(function(record) {
    assert(!Object.prototype.hasOwnProperty.call(record, 'title'), record.sourceId + ' embeds title');
    assert(!Object.prototype.hasOwnProperty.call(record, 'collection'), record.sourceId + ' embeds collection');
    assert(!Object.prototype.hasOwnProperty.call(record, 'ordinal'), record.sourceId + ' embeds ordinal');
  });
  Corpus.metadata.forEach(function(item, index) {
    same(Object.keys(item).sort(), ['collection', 'ordinal', 'sourceId', 'title'], 'metadata shape changed');
    equal(item.collection, 'p78.ag4.claim-passages', item.sourceId + ' collection changed');
    equal(item.ordinal, index + 1, item.sourceId + ' ordinal changed');
  });
});

check('the complete public graph is deeply frozen', function() {
  assert(deeplyFrozen(Corpus), 'corpus API is mutable');
  assert(deeplyFrozen(Corpus.records), 'records are mutable');
  assert(deeplyFrozen(Corpus.metadata), 'metadata is mutable');
  assert(deeplyFrozen(Corpus.metadataBySourceId), 'metadata map is mutable');
  assert(deeplyFrozen(Corpus.counts), 'counts are mutable');
  assert(deeplyFrozen(Corpus.hashes), 'hashes are mutable');
  assert.throws(function() {
    Corpus.records.push(null);
  }, TypeError, 'frozen records accepted a mutation');
});

check('fresh VM replay reproduces data and does not call semantic machinery', function() {
  let externalCalls = 0;
  function trap() {
    externalCalls += 1;
    throw new Error('unexpected external semantic call');
  }
  const context = vm.createContext({
    MRDP78LinguisticParserAdapter: Object.freeze({ parse: trap, replay: trap }),
    MRDP78ClaimIR: Object.freeze({ createClaimAst: trap }),
    MRDP78ControlledClaimEngine: Object.freeze({ run: trap }),
    MRDP78ClaimEvidenceEngine: Object.freeze({ evaluate: trap })
  });
  vm.runInContext(fs.readFileSync(canonicalPath, 'utf8'), context, { filename: canonicalPath });
  vm.runInContext(fs.readFileSync(contractsPath, 'utf8'), context, { filename: contractsPath });
  vm.runInContext(corpusSource, context, { filename: corpusPath });
  const replay = context.MRDP78ClaimEvidenceCorpus;
  assert(replay && replay.status === 'READY', 'fresh VM corpus unavailable');
  equal(externalCalls, 0, 'semantic machinery was called');
  equal(replay.sourceSetHash, Corpus.sourceSetHash, 'VM sourceSetHash differs');
  equal(replay.corpusHash, Corpus.corpusHash, 'VM corpusHash differs');
  same(JSON.parse(JSON.stringify(replay.counts)), Corpus.counts, 'VM counts differ');
  equal(replay.records.length, 10, 'VM source count differs');
  assert(deeplyFrozen(replay), 'VM corpus is mutable');
});

check('module depends only on canonical JSON and search contracts', function() {
  const refs = Array.from(corpusSource.matchAll(/global\.(MRDP78[A-Za-z0-9]+)/g), function(match) {
    return match[1];
  });
  same(Array.from(new Set(refs)).sort(), [
    'MRDP78CanonicalJSON',
    'MRDP78ClaimEvidenceCorpus',
    'MRDP78SearchContracts'
  ], 'unexpected MRDP78 dependency');
  assert(!/\bMRDP78(?:LinguisticParserAdapter|ClaimIR|ControlledClaimEngine|ClaimEvidenceEngine)\b/.test(corpusSource),
    'parser, Claim AST, or evidence engine dependency found');
  assert(!/\.(?:parse|replay|run|evaluate|evaluateEvidence|proposeRelation)\s*\(/.test(corpusSource),
    'parser or evidence call found');
});

check('corpus carries no gold, relation, support, or truth labels', function() {
  [
    ['gold label', /\b(?:goldLabel|goldLabels|goldenLabel|expected)\b/],
    ['proposed relation', /\bproposedRelation\b/],
    ['support status', /['"]SUPPORTED['"]/],
    ['semantic truth', /\bsemanticTruth\s*:\s*true\b/],
    ['resolution label', /\bresolutionStatus\b/]
  ].forEach(function(entry) {
    assert(!entry[1].test(corpusSource), 'corpus contains forbidden ' + entry[0]);
  });
});

check('corpus uses no network, DOM, storage, clock, random, dynamic code, or Node host APIs', function() {
  [
    ['network API', /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/],
    ['DOM API', /\b(?:document|window|navigator)\b/],
    ['storage API', /\b(?:localStorage|sessionStorage|indexedDB)\b/],
    ['clock API', /\b(?:Date\.now|new\s+Date|performance\.(?:now|timeOrigin))\b/],
    ['random API', /\bMath\.random\s*\(/],
    ['timer API', /\b(?:setTimeout|setInterval|requestAnimationFrame)\s*\(/],
    ['eval', /\beval\s*\(/],
    ['Function constructor', /\b(?:new\s+)?Function\s*\(/],
    ['dynamic import', /\bimport\s*\(/],
    ['Node require', /\brequire\s*\(/],
    ['Node process', /\bprocess\./]
  ].forEach(function(entry) {
    assert(!entry[1].test(corpusSource), 'corpus uses forbidden ' + entry[0]);
  });
});

const failed = checks.filter(function(item) { return !item.ok; });
checks.forEach(function(item) {
  if (!item.ok) {
    console.error('FAIL: ' + item.name + '\n' + item.detail);
  }
});

if (failed.length > 0) {
  console.error('FAIL: ' + (checks.length - failed.length) + '/' + checks.length + ' checks passed.');
  process.exit(1);
}

console.log('PASS: ' + checks.length + '/' + checks.length + ' checks.');
