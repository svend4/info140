'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const canonicalPath = path.join(root, 'lib', 'p78-canonical-json.js');
const contractsPath = path.join(root, 'lib', 'p78-search-contracts.js');
const indexPath = path.join(root, 'lib', 'p78-local-text-index.js');
const sourcePaths = [canonicalPath, contractsPath, indexPath];

sourcePaths.forEach((file) => require(file));

const Canonical = global.MRDP78CanonicalJSON;
const Contracts = global.MRDP78SearchContracts;
const LocalIndex = global.MRDP78LocalTextIndex;
const checks = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  assert(actual === expected, `${message}: ${actual} !== ${expected}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true, detail: '' });
  } catch (error) {
    checks.push({ name, ok: false, detail: error && error.stack ? error.stack : String(error) });
  }
}

function independentCanonical(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(independentCanonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${independentCanonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError(`unsupported ${typeof value}`);
}

function nodeHashText(text) {
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function nodeHashCanonical(value) {
  return nodeHashText(independentCanonical(value));
}

function deeplyFrozen(value, seen = new WeakSet()) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => deeplyFrozen(value[key], seen));
}

function expectErrorCode(fn, code, message) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  assert(caught && caught.code === code, `${message}: ${caught && caught.code}`);
}

function source(api, sourceId, revision, text, language = 'ru') {
  return api.createSourceSnapshot({ sourceId, revision, language, text });
}

function userOrigin(api, text) {
  return { kind: 'USER', inputHash: api.hashText(text) };
}

function termNode(value, normalization = 'LOWER') {
  return { node: 'Term', value, normalization };
}

function query(api, hashApi, queryId, mode, expression, filters = { requiredSourceStatus: 'ADMITTED' }) {
  return api.createSemanticQuery({
    queryId,
    revision: '1',
    mode,
    expression,
    filters,
    origin: userOrigin(hashApi, queryId),
    expansionClass: 'EXACT'
  });
}

const textA = 'Живое кольцо движется по кругу. Ёж наблюдает кольцо. Поиск-цикл продолжается 🙂.';
const textB = 'Кольцо хранит продолжение. Живое кольцо не останавливается; кольцо движется.';
const textC = 'Слово «кольцо» встречается в цитате.';
const sourceA = source(Contracts, 'source-a', '1', textA);
const sourceB = source(Contracts, 'source-b', '7', textB);
const sourceC = source(Contracts, 'source-c', '2', textC);
const corpus = [sourceA, sourceB, sourceC];
const index = LocalIndex.createIndex(corpus, { indexId: 'p78.test-russian' });
const ringQuery = query(Contracts, Canonical, 'q-ring-token', 'TOKEN', termNode('кольцо'));
const phraseQuery = query(Contracts, Canonical, 'q-living-ring', 'EXACT', {
  node: 'Phrase',
  terms: [termNode('живое'), termNode('кольцо')],
  slop: 0
});

check('classic-global APIs are complete, immutable, and explicitly non-semantic', () => {
  assert(Canonical && Canonical.status !== 'BLOCKED', 'canonical API missing');
  assert(Contracts && Contracts.version === '1.0.0' && Contracts.status === 'READY', 'contracts API missing');
  assert(LocalIndex && LocalIndex.version === '1.0.0' && LocalIndex.status === 'READY', 'local index API missing');
  ['createSemanticQuery', 'createSourceSnapshot', 'createSearchHit', 'createBidirectionalSearchTrace', 'assertStatusTransition']
    .forEach((name) => assert(typeof Contracts[name] === 'function', `${name} missing`));
  ['createIndex', 'validateIndex', 'search', 'replay', 'tokenize']
    .forEach((name) => assert(typeof LocalIndex[name] === 'function', `${name} missing`));
  assert(deeplyFrozen(Contracts) && deeplyFrozen(LocalIndex), 'public API is mutable');
  equal(Contracts.semanticTruth, false, 'contracts claim semantic truth');
  equal(LocalIndex.semanticTruth, false, 'index claims semantic truth');
  equal(LocalIndex.maxOutputStatus, 'LOCATED', 'lexical output status cap changed');
});

check('SourceSnapshot is closed, independently hashed, copied, and deeply frozen', () => {
  equal(sourceA.schema, 'meridian.source-snapshot/1', 'source schema changed');
  equal(sourceA.textHash, nodeHashText(textA), 'UTF-8 text hash differs from node:crypto');
  const payload = clone(sourceA); delete payload.sourceHash;
  equal(sourceA.sourceHash, nodeHashCanonical(payload), 'source hash differs from independent hash');
  assert(deeplyFrozen(sourceA), 'source snapshot is mutable');
  const mutable = { sourceId: 'isolated', revision: '1', language: 'ru', text: 'Исходный текст.' };
  const isolated = Contracts.createSourceSnapshot(mutable);
  mutable.text = 'Изменённый текст.';
  equal(isolated.text, 'Исходный текст.', 'snapshot aliases source definition');
  expectErrorCode(
    () => Contracts.createSourceSnapshot({ sourceId: 'bad', revision: '1', language: 'ru', text: 'x', extra: true }),
    'UNKNOWN_FIELD',
    'unknown source field accepted'
  );
});

check('SourceSnapshot validator detects stale text and closed hash fields', () => {
  const stale = clone(sourceA);
  stale.text = stale.text.replace('Живое', 'Иное');
  const report = Contracts.validateSourceSnapshot(stale);
  equal(report.status, 'INVALID', 'stale source validates');
  equal(report.code, 'SOURCE_HASH_MISMATCH', 'stale source reason changed');
  const corrupted = clone(sourceA);
  corrupted.textHash = nodeHashText('forged');
  equal(Contracts.validateSourceSnapshot(corrupted).code, 'SOURCE_HASH_MISMATCH', 'text hash corruption accepted');
});

check('SemanticQuery and Query AST are closed, hashed, and reject empty/unknown/cyclic input', () => {
  const payload = clone(ringQuery); delete payload.contentHash;
  equal(ringQuery.contentHash, nodeHashCanonical(payload), 'query hash differs from independent hash');
  equal(Contracts.validateSemanticQuery(ringQuery).status, 'VALID', 'valid query rejected');
  equal(Contracts.validateQueryAst({ node: 'Execute', code: 'x' }).code, 'INVALID_QUERY_AST', 'unknown AST node accepted');
  expectErrorCode(
    () => query(Contracts, Canonical, 'q-empty', 'TOKEN', termNode('   ')),
    'EMPTY_QUERY',
    'blank term accepted'
  );
  const cyclic = { node: 'Not', item: null };
  cyclic.item = cyclic;
  equal(Contracts.validateQueryAst(cyclic).code, 'QUERY_CYCLE', 'cyclic Query AST accepted');
});

check('status ladder permits only adjacent transitions and branches at evidence', () => {
  equal(Contracts.statusLadder.join('>'), 'LOCATED>PARSED>STRUCTURAL_MATCH>EVIDENCE_CANDIDATE>SUPPORTED>REFUTED', 'status inventory changed');
  assert(Contracts.canTransition('LOCATED', 'PARSED'), 'LOCATED -> PARSED blocked');
  assert(Contracts.canTransition('PARSED', 'STRUCTURAL_MATCH'), 'PARSED -> STRUCTURAL_MATCH blocked');
  assert(Contracts.canTransition('STRUCTURAL_MATCH', 'EVIDENCE_CANDIDATE'), 'structural transition blocked');
  assert(Contracts.canTransition('EVIDENCE_CANDIDATE', 'SUPPORTED'), 'support branch blocked');
  assert(Contracts.canTransition('EVIDENCE_CANDIDATE', 'REFUTED'), 'refute branch blocked');
  assert(!Contracts.canTransition('LOCATED', 'SUPPORTED'), 'LOCATED jumps to SUPPORTED');
  expectErrorCode(() => Contracts.assertStatusTransition('LOCATED', 'SUPPORTED'), 'STATUS_JUMP_FORBIDDEN', 'status jump accepted');
  expectErrorCode(() => Contracts.assertStatusTransition('SUPPORTED', 'REFUTED'), 'STATUS_JUMP_FORBIDDEN', 'terminal status changed');
});

check('SearchHit cannot be created or validated above LOCATED', () => {
  const result = LocalIndex.search(index, ringQuery);
  const hit = result.hits[0];
  equal(hit.status, 'LOCATED', 'lexical hit status changed');
  expectErrorCode(
    () => Contracts.createSearchHit({
      queryRef: hit.queryRef,
      indexRef: hit.indexRef,
      sourceId: hit.sourceId,
      sourceRevision: hit.sourceRevision,
      sourceHash: hit.sourceHash,
      locator: hit.locator,
      matchedTextHash: hit.matchedTextHash,
      contextSpanHash: hit.contextSpanHash,
      matchClass: hit.matchClass,
      status: 'SUPPORTED'
    }),
    'LEXICAL_STATUS_FORBIDDEN',
    'factory created supported lexical hit'
  );
  const forged = clone(hit);
  forged.status = 'SUPPORTED';
  equal(Contracts.validateSearchHit(forged).code, 'LEXICAL_STATUS_FORBIDDEN', 'validator accepted supported lexical hit');
});

check('index is order-independent, fully hashed, valid, and deeply immutable', () => {
  const reversed = LocalIndex.createIndex([sourceC, sourceA, sourceB], { indexId: 'p78.test-russian' });
  equal(JSON.stringify(reversed), JSON.stringify(index), 'source input order changed index');
  equal(Contracts.computeSourceSetHash([sourceC, sourceA, sourceB]), index.manifest.sourceSetHash, 'source set hash depends on order');
  const indexPayload = clone(index); delete indexPayload.indexHash;
  equal(index.indexHash, nodeHashCanonical(indexPayload), 'index hash differs from independent hash');
  const manifestPayload = clone(index.manifest); delete manifestPayload.contentHash;
  equal(index.manifest.contentHash, nodeHashCanonical(manifestPayload), 'manifest hash differs from independent hash');
  equal(LocalIndex.validateIndex(index).status, 'VALID', 'valid index rejected');
  assert(deeplyFrozen(index), 'index is mutable');
  equal(index.sources.map((item) => item.sourceId).join(','), 'source-a,source-b,source-c', 'source order is unstable');
});

check('duplicate and conflicting source revisions fail closed', () => {
  expectErrorCode(() => LocalIndex.createIndex([sourceA, sourceA]), 'DUPLICATE_SOURCE', 'duplicate snapshot indexed');
  const changedSameRevision = source(Contracts, 'source-a', '1', 'Другой текст той же ревизии.');
  expectErrorCode(
    () => LocalIndex.createIndex([sourceA, changedSameRevision]),
    'SOURCE_REVISION_CONFLICT',
    'same revision with different text indexed'
  );
  const secondRevision = source(Contracts, 'source-a', '2', textA);
  expectErrorCode(
    () => LocalIndex.createIndex([sourceA, secondRevision]),
    'SOURCE_REVISION_CONFLICT',
    'multiple revisions in one index accepted'
  );
});

check('Unicode tokenizer preserves Russian UTF-16 positions and deterministic token hashes', () => {
  const tokens = LocalIndex.tokenize(textA);
  const surfaces = tokens.map((token) => textA.slice(token.start, token.end));
  assert(surfaces.includes('Ёж'), 'Cyrillic token Ёж missing');
  assert(surfaces.includes('Поиск-цикл'), 'hyphenated Russian token split');
  assert(!surfaces.includes('🙂'), 'emoji became lexical token');
  tokens.forEach((token, ordinal) => {
    equal(token.ordinal, ordinal, 'token ordinal changed');
    equal(token.rawHash, nodeHashText(textA.slice(token.start, token.end)), 'token hash differs from source slice');
  });
});

check('token search locates every exact normalized token with correct positions', () => {
  const result = LocalIndex.search(index, ringQuery, { contextChars: 12 });
  equal(result.status, 'READY', 'token search not ready');
  equal(result.code, 'MATCHES_LOCATED', 'token search reason changed');
  equal(result.hits.length, 6, 'wrong ring token count');
  result.hits.forEach((hit) => {
    const src = index.sources.find((item) => item.sourceId === hit.sourceId);
    equal(src.text.slice(hit.locator.start, hit.locator.end).toLowerCase(), 'кольцо', 'token locator slices wrong text');
    equal(hit.matchClass, 'TOKEN', 'token match class changed');
    equal(hit.status, 'LOCATED', 'token hit exceeded LOCATED');
  });
});

check('exact phrase search is positional, case-normalized, and source-filterable', () => {
  const result = LocalIndex.search(index, phraseQuery, { contextChars: 0 });
  equal(result.status, 'READY', 'phrase search not ready');
  equal(result.hits.length, 2, 'wrong exact phrase count');
  result.hits.forEach((hit) => {
    const src = index.sources.find((item) => item.sourceId === hit.sourceId);
    equal(src.text.slice(hit.locator.start, hit.locator.end), 'Живое кольцо', 'phrase locator changed');
    equal(hit.matchClass, 'EXACT', 'phrase match class changed');
  });
  const filtered = query(Contracts, Canonical, 'q-filtered-phrase', 'EXACT', clone(phraseQuery.expression), {
    sourceIds: ['source-b'], requiredSourceStatus: 'ADMITTED'
  });
  const filteredResult = LocalIndex.search(index, filtered);
  equal(filteredResult.hits.length, 1, 'source filter ignored');
  equal(filteredResult.hits[0].sourceId, 'source-b', 'source filter selected wrong source');
});

check('NONE normalization remains case-sensitive', () => {
  const upper = query(Contracts, Canonical, 'q-upper', 'EXACT', termNode('Живое', 'NONE'));
  const lower = query(Contracts, Canonical, 'q-lower', 'EXACT', termNode('живое', 'NONE'));
  equal(LocalIndex.search(index, upper).hits.length, 2, 'uppercase exact token count changed');
  const lowerResult = LocalIndex.search(index, lower);
  equal(lowerResult.status, 'EMPTY', 'lowercase NONE unexpectedly matched uppercase');
  equal(lowerResult.code, 'OOV_TERM', 'case-sensitive miss reason changed');
});

check('Or branches deduplicate identical source spans and hit identities', () => {
  const duplicateQuery = query(Contracts, Canonical, 'q-duplicate-or', 'TOKEN', {
    node: 'Or', items: [termNode('кольцо'), termNode('кольцо')]
  });
  const result = LocalIndex.search(index, duplicateQuery);
  equal(result.hits.length, 6, 'duplicate Or produced duplicate hits');
  equal(new Set(result.hits.map((hit) => hit.hitId)).size, result.hits.length, 'hit IDs are duplicated');
  equal(new Set(result.hits.map((hit) => `${hit.sourceHash}:${hit.locator.start}:${hit.locator.end}`)).size, result.hits.length, 'source spans are duplicated');
});

check('matched, context, source, and hit hashes independently bind exact spans', () => {
  const result = LocalIndex.search(index, phraseQuery, { contextChars: 7 });
  result.hits.forEach((hit) => {
    const src = index.sources.find((item) => item.sourceId === hit.sourceId);
    const context = result.contexts.find((item) => item.spanHash === hit.contextSpanHash);
    const matched = src.text.slice(hit.locator.start, hit.locator.end);
    equal(hit.matchedTextHash, nodeHashText(matched), 'matched span hash differs');
    equal(context.text, src.text.slice(context.start, context.end), 'context text differs from source');
    equal(context.textHash, nodeHashText(context.text), 'context text hash differs');
    const contextPayload = clone(context); delete contextPayload.spanId; delete contextPayload.spanHash;
    equal(context.spanHash, nodeHashCanonical(contextPayload), 'context span hash differs');
    const hitPayload = clone(hit); delete hitPayload.hitId;
    equal(hit.hitId, `hit:${nodeHashCanonical(hitPayload).slice(7)}`, 'hit identity differs');
    assert(context.end - context.start <= matched.length + 16, 'bounded context exceeded allowance');
  });
});

check('OOV and unsupported AG2 queries return bounded non-semantic outcomes', () => {
  const missing = query(Contracts, Canonical, 'q-oov', 'TOKEN', termNode('несуществующийтермин'));
  const missingResult = LocalIndex.search(index, missing);
  equal(missingResult.status, 'EMPTY', 'OOV did not return EMPTY');
  equal(missingResult.code, 'OOV_TERM', 'OOV reason changed');
  equal(missingResult.hits.length, 0, 'OOV produced hits');
  equal(missingResult.semanticTruth, false, 'OOV claims semantic truth');
  const lemma = query(Contracts, Canonical, 'q-lemma', 'LEMMA', termNode('кольцо', 'LEMMA'));
  const lemmaResult = LocalIndex.search(index, lemma);
  equal(lemmaResult.status, 'ABSTAIN', 'unsupported lemma mode did not abstain');
  equal(lemmaResult.code, 'QUERY_MODE_UNSUPPORTED', 'unsupported mode reason changed');
  const andQuery = query(Contracts, Canonical, 'q-and', 'EXACT', {
    node: 'And', items: [termNode('живое'), termNode('кольцо')]
  });
  equal(LocalIndex.search(index, andQuery).code, 'QUERY_NODE_UNSUPPORTED', 'unsupported AST node silently evaluated');
});

check('stale source-set, index hash, and mutated snapshot are refused', () => {
  const otherHash = nodeHashText('different snapshot set');
  const staleSet = LocalIndex.search(index, ringQuery, { expectedSourceSetHash: otherHash });
  equal(staleSet.status, 'ABSTAIN', 'stale source set did not abstain');
  equal(staleSet.code, 'STALE_INDEX', 'stale source set reason changed');
  const staleIndex = LocalIndex.search(index, ringQuery, { expectedIndexHash: otherHash });
  equal(staleIndex.code, 'STALE_INDEX', 'stale index hash accepted');
  const mutated = clone(index);
  mutated.sources[0].text = mutated.sources[0].text.replace('Живое', 'Иное');
  equal(LocalIndex.validateIndex(mutated).code, 'SOURCE_HASH_MISMATCH', 'mutated source validates inside index');
  const mutatedResult = LocalIndex.search(mutated, ringQuery);
  equal(mutatedResult.status, 'ABSTAIN', 'mutated index did not abstain');
  equal(mutatedResult.code, 'SOURCE_HASH_MISMATCH', 'mutated index reason changed');
});

check('operation and hit budgets fail closed without partial lexical output', () => {
  const operationBound = LocalIndex.search(index, phraseQuery, { maxOperations: 1 });
  equal(operationBound.status, 'ABSTAIN', 'operation budget did not abstain');
  equal(operationBound.code, 'BUDGET_EXCEEDED', 'operation budget reason changed');
  equal(operationBound.hits.length, 0, 'operation budget leaked partial hits');
  const hitBound = LocalIndex.search(index, ringQuery, { maxHits: 1 });
  equal(hitBound.status, 'ABSTAIN', 'hit budget did not abstain');
  equal(hitBound.code, 'BUDGET_EXCEEDED', 'hit budget reason changed');
  equal(hitBound.hits.length, 0, 'hit budget leaked partial hits');
});

check('visited query hash is a deterministic cycle refusal', () => {
  const result = LocalIndex.search(index, ringQuery, { visitedQueryHashes: [ringQuery.contentHash] });
  equal(result.status, 'ABSTAIN', 'visited query did not abstain');
  equal(result.code, 'CYCLE_DETECTED', 'cycle reason changed');
  equal(result.hits.length, 0, 'cycle returned hits');
  equal(result.trace.finalStatus, 'ABSTAIN', 'cycle trace final status changed');
});

check('search replay is deterministic, immutable, input-preserving, and trace-valid', () => {
  const options = { contextChars: 9, maxOperations: 10000, maxHits: 50 };
  const beforeIndex = JSON.stringify(index);
  const beforeQuery = JSON.stringify(phraseQuery);
  const first = LocalIndex.search(index, phraseQuery, options);
  const serialized = JSON.stringify(first);
  for (let i = 0; i < 8; i += 1) equal(JSON.stringify(LocalIndex.replay(index, phraseQuery, options)), serialized, `replay ${i + 1} changed`);
  equal(JSON.stringify(index), beforeIndex, 'search mutated index');
  equal(JSON.stringify(phraseQuery), beforeQuery, 'search mutated query');
  assert(deeplyFrozen(first), 'search result is mutable');
  equal(Contracts.validateBidirectionalSearchTrace(first.trace).status, 'VALID', 'trace contract invalid');
  equal(first.resultHash, nodeHashCanonical((() => { const value = clone(first); delete value.resultHash; return value; })()), 'result hash differs');
});

check('lexical results never contain semantic terminal status or truth assertion', () => {
  const result = LocalIndex.search(index, ringQuery);
  equal(result.maxStatus, 'LOCATED', 'lexical cap changed');
  equal(result.semanticTruth, false, 'lexical result claims truth');
  assert(result.hits.every((hit) => hit.status === 'LOCATED'), 'hit exceeded LOCATED');
  assert(!/"status":"(?:SUPPORTED|REFUTED)"/.test(JSON.stringify(result)), 'terminal semantic status leaked into lexical result');
  assert(result.trace.steps.every((step) => step.direction === 'GREP_TO_AST'), 'lexical trace claims later stage');
  assert(result.trace.parserVersions.length === 0, 'lexical trace claims parser execution');
});

check('browser-style VM execution matches host hashes and results', () => {
  const sandbox = {};
  vm.createContext(sandbox);
  sourcePaths.forEach((file) => vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: path.basename(file) }));
  const SC = sandbox.MRDP78SearchContracts;
  const SL = sandbox.MRDP78LocalTextIndex;
  const SA = source(SC, 'source-a', '1', textA);
  const SB = source(SC, 'source-b', '7', textB);
  const SS = source(SC, 'source-c', '2', textC);
  const SI = SL.createIndex([SA, SB, SS], { indexId: 'p78.test-russian' });
  const SQ = query(SC, sandbox.MRDP78CanonicalJSON, 'q-living-ring', 'EXACT', clone(phraseQuery.expression));
  const isolated = SL.search(SI, SQ, { contextChars: 9, maxOperations: 10000, maxHits: 50 });
  const host = LocalIndex.search(index, phraseQuery, { contextChars: 9, maxOperations: 10000, maxHits: 50 });
  equal(SI.indexHash, index.indexHash, 'VM index hash differs');
  equal(SQ.contentHash, phraseQuery.contentHash, 'VM query hash differs');
  equal(isolated.resultHash, host.resultHash, 'VM search result differs');
});

check('library sources contain no host, network, clock, random, dynamic-code, or loader dependency', () => {
  const sources = sourcePaths.map((file) => fs.readFileSync(file, 'utf8'));
  const joined = sources.join('\n');
  const forbidden = [
    /\bdocument\b/, /\bwindow\b/, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b/,
    /https?:\/\//i, /\beval\s*\(/, /\bnew\s+Function\b/, /\bDate\b/, /\bperformance\b/,
    /Math\.random\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/,
    /\bmodule\.exports\b/, /\brequire\s*\(/, /\bimport\s*\(/, /\bexport\s+/
  ];
  forbidden.forEach((pattern) => assert(!pattern.test(joined), `forbidden source pattern ${pattern}`));
  sources.forEach((text) => assert(text.startsWith('(function(global){'), 'classic IIFE wrapper missing'));
  sources.forEach((text) => assert(/typeof globalThis/.test(text), 'globalThis fallback missing'));
  const localSource = fs.readFileSync(indexPath, 'utf8');
  assert(!/\b(?:SUPPORTED|REFUTED)\b/.test(localSource), 'lexical implementation contains terminal semantic statuses');
  assert(!/semanticTruth\s*:\s*true/.test(joined), 'library asserts semantic truth');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? `\n${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
