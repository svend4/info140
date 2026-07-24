'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
require(lib('p78-canonical-json'));
require(lib('p78-search-contracts'));
require(lib('p78-alpha-orbit-contracts'));
require(lib('p78-data7-adapter'));

const Canonical = global.MRDP78CanonicalJSON;
const Search = global.MRDP78SearchContracts;
const Alpha = global.MRDP78AlphaOrbitContracts;
const Adapter = global.MRDP78Data7Adapter;
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

function source(options = {}) {
  return Search.createSourceSnapshot({
    sourceId: options.sourceId || 'data7.adapter.source',
    revision: options.revision || 'r1',
    language: options.language || 'ru',
    text: options.text || 'Река несёт факты. Мост связывает берега. Тема продолжается.',
  });
}

function locatorsFor(snapshot) {
  const texts = ['Река несёт факты.', 'Мост связывает берега.', 'Тема продолжается.'];
  return texts.map((text, index) => {
    const start = snapshot.text.indexOf(text);
    return { start, end: start + text.length, label: `Сегмент ${index + 1}` };
  });
}

function batch(snapshot = source(), alpha = 0, locators = locatorsFor(snapshot)) {
  return Adapter.createSegmentBatch(snapshot, { alpha, locators });
}

function contextSegment(snapshot, alpha = 0) {
  return batch(snapshot, alpha, [
    { start: 0, end: snapshot.text.length, label: 'Полный контекст' },
  ]).segments[0];
}
function completeCosts(segments, overrides = {}) {
  const rows = [];
  for (const from of segments) {
    for (const to of segments) {
      if (from.segmentId === to.segmentId) continue;
      const key = `${from.segmentId}|${to.segmentId}`;
      rows.push({
        fromSegmentId: from.segmentId,
        toSegmentId: to.segmentId,
        cost: Object.hasOwn(overrides, key) ? overrides[key] : 0.8,
      });
    }
  }
  return rows;
}

function routeCosts(segments, order, low = 0.1) {
  const overrides = {};
  for (let index = 0; index < order.length - 1; index += 1) {
    overrides[`${segments[order[index]].segmentId}|${segments[order[index + 1]].segmentId}`] = low + index * 0.1;
  }
  return completeCosts(segments, overrides);
}

function copy(value) { return Canonical.deepCopy(value); }

check('API is frozen, versioned and limited to three non-authoritative operations', () => {
  assert.equal(Adapter.status, 'READY');
  assert.equal(Adapter.version, '1.0.0');
  assert.deepEqual(Adapter.operations, ['SEGMENT', 'ORBIT', 'LINK_CANDIDATE']);
  assert.deepEqual(Adapter.algorithms, ['DIRECTED_GREEDY']);
  assert.equal(Adapter.semanticTruth, false);
  assert.equal(Adapter.soundness, 'NOT_COMPUTED');
  assert.equal(Adapter.commitAllowed, false);
  assert.equal(Adapter.limits.maxSegments, 32);
  assert(Object.isFrozen(Adapter) && Object.isFrozen(Adapter.schemas));
});

check('SEGMENT creates exact located alpha artifacts and stable coverage', () => {
  const snapshot = source();
  const result = batch(snapshot);
  assert.equal(result.schema, 'meridian.data7-segment-batch/1');
  assert.equal(result.alpha, 0);
  assert.equal(result.kind, 'CONCEPT');
  assert.equal(result.segments.length, 3);
  assert.equal(result.coverage.coveredCodeUnits, result.segments.reduce((sum, item) => sum + item.text.length, 0));
  assert.equal(result.coverage.totalCodeUnits, snapshot.text.length);
  assert.equal(result.coverage.complete, false);
  assert.equal(Adapter.validateSegmentBatch(result).status, 'VALID');
  assert.equal(Adapter.validateSegmentBatchAgainst(result, snapshot).status, 'VALID');
  for (const segment of result.segments) {
    assert.equal(segment.text, snapshot.text.slice(segment.locator.start, segment.locator.end));
    assert.equal(segment.artifact.body, segment.text);
    assert.deepEqual(segment.artifact.sourceRefs, [snapshot.sourceHash]);
    assert.deepEqual(segment.artifact.qualifiers, ['EXACT_SOURCE_SPAN', 'SEGMENT_ONLY']);
    assert.equal(segment.artifact.authority, 'DRAFT');
    assert.equal(segment.semanticTruth, false);
    assert.equal(segment.commitAllowed, false);
    assert(Object.isFrozen(segment) && Object.isFrozen(segment.artifact));
  }
});

check('SEGMENT canonicalizes locator order and replays content addressing exactly', () => {
  const snapshot = source();
  const locators = locatorsFor(snapshot);
  const first = batch(snapshot, 0, locators);
  const second = batch(snapshot, 0, [locators[2], locators[0], locators[1]]);
  assert.equal(first.batchId, second.batchId);
  assert.equal(first.contentHash, second.contentHash);
  assert.deepEqual(first.segments.map((item) => item.locator.start), locators.map((item) => item.start));
});

check('SEGMENT preserves UTF-16 locator semantics without normalization', () => {
  const snapshot = source({
    sourceId: 'data7.adapter.unicode',
    text: 'Точка 😀 движется. След остаётся.',
  });
  const text = 'Точка 😀 движется.';
  const result = batch(snapshot, -1, [{ start: 0, end: text.length, label: 'Unicode span' }]);
  assert.equal(result.segments[0].text, text);
  assert.equal(result.segments[0].locator.end, text.length);
  assert.equal(result.segments[0].artifact.kind, 'SPECIFICATION');
  assert.equal(result.segments[0].textHash, Canonical.hashText(text));
});

check('SEGMENT reports complete coverage only for contiguous full-source spans', () => {
  const snapshot = source({ sourceId: 'data7.adapter.complete', text: 'Первый.Второй.' });
  const result = batch(snapshot, 1, [
    { start: 0, end: 7, label: 'Первый' },
    { start: 7, end: snapshot.text.length, label: 'Второй' },
  ]);
  assert.equal(result.coverage.complete, true);
  assert.equal(result.coverage.coveredCodeUnits, snapshot.text.length);
});

check('SEGMENT fails closed on overlap, invalid bounds and boundary whitespace', () => {
  const snapshot = source();
  assert.throws(() => batch(snapshot, 0, [
    { start: 0, end: 10, label: 'A' },
    { start: 5, end: 15, label: 'B' },
  ]), /SEGMENT_OVERLAP/);
  assert.throws(() => batch(snapshot, 0, [
    { start: 0, end: snapshot.text.length + 1, label: 'Outside' },
  ]), /LOCATOR_OUTSIDE_SOURCE/);
  assert.throws(() => batch(snapshot, 0, [
    { start: 0, end: snapshot.text.indexOf('Мост'), label: 'Whitespace' },
  ]), /SEGMENT_BOUNDARY_WHITESPACE/);
  assert.throws(() => Adapter.createSegmentBatch(snapshot, { alpha: 5, locators: locatorsFor(snapshot) }), /INTEGER_OUT_OF_RANGE/);
  assert.throws(() => Adapter.createSegmentBatch(snapshot, { alpha: 0, locators: locatorsFor(snapshot), truth: true }), /UNKNOWN_FIELD/);
});

check('SEGMENT validation rejects stale sources and content tampering', () => {
  const snapshot = source();
  const result = batch(snapshot);
  const changed = source({ revision: 'r2', text: `${snapshot.text} Дополнение.` });
  assert.equal(Adapter.validateSegmentBatchAgainst(result, changed).code, 'SOURCE_SNAPSHOT_STALE');
  const textTamper = copy(result);
  textTamper.segments[0].text = 'Подмена.';
  assert.notEqual(Adapter.validateSegmentBatch(textTamper).status, 'VALID');
  const authorityTamper = copy(result);
  authorityTamper.semanticTruth = true;
  assert.equal(Adapter.validateSegmentBatch(authorityTamper).code, 'SEMANTIC_TRUTH_FORBIDDEN');
});

check('hidden, symbolic and accessor request fields cannot disappear during hashing', () => {
  const snapshot = source();
  const definition = { alpha: 0, locators: locatorsFor(snapshot) };
  Object.defineProperty(definition, 'accepted', { value: true, enumerable: false });
  assert.throws(() => Adapter.createSegmentBatch(snapshot, definition), /NON_ENUMERABLE_FIELD_FORBIDDEN/);
  const symbolic = { alpha: 0, locators: locatorsFor(snapshot) };
  symbolic[Symbol('truth')] = true;
  assert.throws(() => Adapter.createSegmentBatch(snapshot, symbolic), /SYMBOL_FIELD_FORBIDDEN/);
  const accessor = { locators: locatorsFor(snapshot) };
  Object.defineProperty(accessor, 'alpha', { enumerable: true, get() { return 0; } });
  assert.throws(() => Adapter.createSegmentBatch(snapshot, accessor), /ACCESSOR_FORBIDDEN/);
});

check('ORBIT deterministically applies directed greedy ordering without an alpha receipt', () => {
  const segments = batch().segments;
  const costs = routeCosts(segments, [0, 2, 1]);
  const proposal = Adapter.createOrbitProposal(segments, {
    startSegmentId: segments[0].segmentId,
    costs: costs.slice().reverse(),
  });
  assert.deepEqual(proposal.beforeOrder, segments.map((item) => item.segmentId));
  assert.deepEqual(proposal.afterOrder, [segments[0].segmentId, segments[2].segmentId, segments[1].segmentId]);
  assert(Math.abs(proposal.pathCost - 0.3) < 1e-12);
  assert.equal(proposal.improvementStatus, 'NOT_COMPUTED');
  assert.equal(proposal.alphaTransitionReceipt, null);
  assert.equal(Adapter.validateOrbitProposal(proposal).status, 'VALID');
  assert.equal(Adapter.validateOrbitProposalAgainst(proposal, segments).status, 'VALID');
});

check('ORBIT is independent of cost-row insertion order', () => {
  const segments = batch().segments;
  const costs = routeCosts(segments, [0, 2, 1]);
  const first = Adapter.createOrbitProposal(segments, { startSegmentId: segments[0].segmentId, costs });
  const second = Adapter.createOrbitProposal(segments, { startSegmentId: segments[0].segmentId, costs: costs.slice().reverse() });
  assert.equal(first.proposalId, second.proposalId);
  assert.equal(first.contentHash, second.contentHash);
});

check('ORBIT resolves equal directed costs by canonical segment id', () => {
  const segments = batch().segments;
  const memberIds = segments.map((item) => item.segmentId).sort();
  const start = memberIds[0];
  const before = segments.findIndex((item) => item.segmentId === start) === 0 ? segments.slice().reverse() : segments;
  const costs = completeCosts(before);
  const proposal = Adapter.createOrbitProposal(before, { startSegmentId: start, costs });
  assert.deepEqual(proposal.afterOrder, memberIds);
});

check('ORBIT refuses a no-op route instead of manufacturing movement', () => {
  const segments = batch().segments;
  const costs = routeCosts(segments, [0, 1, 2]);
  assert.throws(() => Adapter.createOrbitProposal(segments, {
    startSegmentId: segments[0].segmentId,
    costs,
  }), /ORBIT_PROGRESS_REQUIRED/);
});

check('ORBIT requires one complete directed cost for every ordered pair', () => {
  const segments = batch().segments;
  const costs = routeCosts(segments, [0, 2, 1]);
  assert.throws(() => Adapter.createOrbitProposal(segments, {
    startSegmentId: segments[0].segmentId,
    costs: costs.slice(1),
  }), /ARRAY_TOO_SHORT/);
  const duplicate = costs.slice();
  duplicate[1] = { ...duplicate[0] };
  assert.throws(() => Adapter.createOrbitProposal(segments, {
    startSegmentId: segments[0].segmentId,
    costs: duplicate,
  }), /DUPLICATE_COST/);
  const negative = costs.map((item, index) => index ? item : { ...item, cost: -1 });
  assert.throws(() => Adapter.createOrbitProposal(segments, {
    startSegmentId: segments[0].segmentId,
    costs: negative,
  }), /NUMBER_OUT_OF_RANGE/);
});

check('ORBIT rejects duplicate, mixed-alpha and mixed-language segments', () => {
  const snapshot = source();
  const segments = batch(snapshot).segments;
  assert.throws(() => Adapter.createOrbitProposal([segments[0], segments[0]], {
    startSegmentId: segments[0].segmentId,
    costs: [],
  }), /DUPLICATE_SEGMENT/);
  const otherAlpha = batch(snapshot, 1).segments[1];
  const mixedAlpha = [segments[0], otherAlpha];
  assert.throws(() => Adapter.createOrbitProposal(mixedAlpha, {
    startSegmentId: mixedAlpha[0].segmentId,
    costs: routeCosts(mixedAlpha, [0, 1]),
  }), /ORBIT_ALPHA_KIND_MISMATCH/);
  const english = source({ sourceId: 'data7.adapter.en', language: 'en', text: 'River carries facts. Bridge links banks.' });
  const englishSegment = batch(english, 0, [{ start: 0, end: 20, label: 'English' }]).segments[0];
  const mixedLanguage = [segments[0], englishSegment];
  assert.throws(() => Adapter.createOrbitProposal(mixedLanguage, {
    startSegmentId: mixedLanguage[0].segmentId,
    costs: routeCosts(mixedLanguage, [0, 1]),
  }), /ORBIT_LANGUAGE_MISMATCH/);
});

check('ORBIT validation detects route, cost and authority-boundary tampering', () => {
  const segments = batch().segments;
  const proposal = Adapter.createOrbitProposal(segments, {
    startSegmentId: segments[0].segmentId,
    costs: routeCosts(segments, [0, 2, 1]),
  });
  const routeTamper = copy(proposal);
  [routeTamper.afterOrder[1], routeTamper.afterOrder[2]] = [routeTamper.afterOrder[2], routeTamper.afterOrder[1]];
  assert.notEqual(Adapter.validateOrbitProposal(routeTamper).status, 'VALID');
  const receiptTamper = copy(proposal); receiptTamper.alphaTransitionReceipt = {};
  assert.notEqual(Adapter.validateOrbitProposal(receiptTamper).status, 'VALID');
  const reorderedSegments = [segments[1], segments[0], segments[2]];
  assert.equal(Adapter.validateOrbitProposalAgainst(proposal, reorderedSegments).code, 'ORBIT_SEGMENT_REF_MISMATCH');
});

check('LINK_CANDIDATE records exact-context co-occurrence without inventing an Alpha edge', () => {
  const snapshot = source();
  const segments = batch(snapshot).segments;
  const context = contextSegment(snapshot);
  const candidate = Adapter.createLinkCandidate(segments[0], segments[1], context, { relation: 'CO_OCCURS_WITH' });
  assert.equal(candidate.schema, 'meridian.data7-link-candidate/1');
  assert.equal(candidate.basis, 'EXACT_CONTEXT_COOCCURRENCE');
  assert.equal(candidate.relation, 'CO_OCCURS_WITH');
  assert.equal(candidate.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(candidate.finalRelation, 'NOT_COMPUTED');
  assert.equal(candidate.edge, null);
  assert.equal(candidate.alphaTransitionReceipt, null);
  assert(context.locator.start <= segments[0].locator.start);
  assert(context.locator.end >= segments[1].locator.end);
  assert.equal(candidate.semanticTruth, false);
  assert.equal(candidate.commitAllowed, false);
  assert.equal(Adapter.validateLinkCandidate(candidate).status, 'VALID');
  assert.equal(Adapter.validateLinkCandidateAgainst(candidate, segments[0], segments[1], context).status, 'VALID');
});

check('LINK_CANDIDATE rejects self-links, semantic relations and incomplete context witnesses', () => {
  const snapshot = source();
  const segments = batch(snapshot).segments;
  const context = contextSegment(snapshot);
  assert.throws(() => Adapter.createLinkCandidate(segments[0], segments[0], context, { relation: 'CO_OCCURS_WITH' }), /SELF_LINK_FORBIDDEN/);
  assert.throws(() => Adapter.createLinkCandidate(segments[0], segments[1], context, { relation: 'SUPPORTS' }), /LINK_RELATION_NOT_SAFE/);
  assert.throws(() => Adapter.createLinkCandidate(segments[0], segments[1], segments[2], { relation: 'CO_OCCURS_WITH' }), /LINK_WITNESS_CONTEXT_INCOMPLETE/);
  const otherSource = source({ sourceId: 'data7.adapter.other' });
  const other = contextSegment(otherSource);
  assert.throws(() => Adapter.createLinkCandidate(segments[0], segments[1], other, { relation: 'CO_OCCURS_WITH' }), /COMMON_EXACT_SOURCE_REQUIRED/);
});

check('LINK_CANDIDATE rejects cross-alpha endpoints and tampered evidence', () => {
  const snapshot = source();
  const segments = batch(snapshot).segments;
  const otherAlpha = batch(snapshot, 1).segments[1];
  const context = contextSegment(snapshot);
  assert.throws(() => Adapter.createLinkCandidate(segments[0], otherAlpha, context, { relation: 'CO_OCCURS_WITH' }), /LINK_ALPHA_KIND_MISMATCH/);
  const candidate = Adapter.createLinkCandidate(segments[0], segments[1], context, { relation: 'CO_OCCURS_WITH' });
  const tampered = copy(candidate);
  tampered.edge = { status: 'PROPOSED' };
  assert.notEqual(Adapter.validateLinkCandidate(tampered).status, 'VALID');
  assert.equal(Adapter.validateLinkCandidateAgainst(candidate, segments[1], segments[0], context).code, 'LINK_SEGMENT_REF_MISMATCH');
});

check('fresh VM replay is deterministic and missing dependencies fail explicitly', () => {
  const canonicalSource = fs.readFileSync(lib('p78-canonical-json'), 'utf8');
  const searchSource = fs.readFileSync(lib('p78-search-contracts'), 'utf8');
  const alphaSource = fs.readFileSync(lib('p78-alpha-orbit-contracts'), 'utf8');
  const adapterSource = fs.readFileSync(lib('p78-data7-adapter'), 'utf8');
  const blockedContext = vm.createContext({});
  vm.runInContext(canonicalSource, blockedContext);
  vm.runInContext(adapterSource, blockedContext);
  assert.equal(blockedContext.MRDP78Data7Adapter.status, 'BLOCKED');
  assert.equal(blockedContext.MRDP78Data7Adapter.code, 'DATA7_ADAPTER_DEPENDENCY_UNAVAILABLE');

  const context = vm.createContext({});
  vm.runInContext(canonicalSource, context);
  vm.runInContext(searchSource, context);
  vm.runInContext(alphaSource, context);
  vm.runInContext(adapterSource, context);
  const snapshot = context.MRDP78SearchContracts.createSourceSnapshot({
    sourceId: 'data7.adapter.source', revision: 'r1', language: 'ru',
    text: 'Река несёт факты. Мост связывает берега. Тема продолжается.',
  });
  const replay = context.MRDP78Data7Adapter.createSegmentBatch(snapshot, {
    alpha: 0,
    locators: JSON.parse(JSON.stringify(locatorsFor(source()))),
  });
  assert.equal(replay.contentHash, batch().contentHash);
});

check('adapter source has no DOM, network, clock, randomness, evaluator or commit path', () => {
  const sourceText = fs.readFileSync(lib('p78-data7-adapter'), 'utf8');
  assert(!/\bdocument\b|querySelector|getElementById|innerHTML/.test(sourceText));
  assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//.test(sourceText));
  assert(!/Math\.random|Date\.now|new Date|performance\.now/.test(sourceText));
  assert(!/\beval\s*\(|new Function/.test(sourceText));
  assert(!/commitAllowed\s*:\s*true|semanticTruth\s*:\s*true/.test(sourceText));
  assert(!/SYNTHESIZE|RATIONALIZE|GENERALIZE|SPECIALIZE/.test(Adapter.operations.join('|')));
});

for (const item of checks) {
  process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? `\n${item.detail}` : ''}\n`);
}
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
process.exitCode = passed === checks.length ? 0 : 1;
