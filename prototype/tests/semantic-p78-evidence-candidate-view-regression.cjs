'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts', 'p78-local-text-index',
  'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
  'p78-claim-structural-matcher', 'p78-evidence-contracts', 'p78-claim-evidence-corpus',
  'p78-linguistic-structure-index', 'p78-evidence-candidate-view',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const Parser = global.MRDP78LinguisticParserAdapter;
const Corpus = global.MRDP78ClaimEvidenceCorpus;
const Linguistic = global.MRDP78LinguisticStructureIndex;
const View = global.MRDP78EvidenceCandidateView;
const index = Linguistic.create(Corpus.records);
const cascade = Linguistic.findCandidates(index, Parser.parse('Система сохраняет состояние.'));

function allText(element) { return [element._text || '', ...element.children.map(allText)].join(' '); }

class FakeElement {
  constructor(tag, document) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.dataset = {};
    this._text = '';
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) {
    const indexOfChild = this.children.indexOf(child);
    if (indexOfChild >= 0) this.children.splice(indexOfChild, 1);
    child.parentNode = null;
    return child;
  }
  get firstChild() { return this.children[0] || null; }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return allText(this); }
}

class FakeDocument { createElement(tag) { return new FakeElement(tag, this); } }

function sourceFor(candidate) {
  return Corpus.records.find((source) => source.sourceId === candidate.sourceRef.sourceId && source.revision === candidate.sourceRef.revision);
}

function exactText(candidate) {
  const source = sourceFor(candidate);
  return source.text.slice(candidate.locator.start, candidate.locator.end);
}

function render(payload, options) {
  const document = new FakeDocument();
  const root = new FakeElement('div', document);
  View.render(root, payload, options);
  return { root, text: allText(root) };
}

const checks = [];
function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

check('passive view exposes a frozen ready API', () => {
  assert.equal(View.status, 'READY');
  assert.equal(View.version, '1.0.0');
  assert.equal(View.resolverRequestSchema, 'meridian.evidence-text-resolution-request/1');
  assert(Object.isFrozen(View));
});

check('source-backed candidates retain the review-only boundary', () => {
  const rendered = render(cascade, { resolver: (request) => {
    const candidate = cascade.evidenceCandidates.find((item) => item.candidateId === request.candidateId);
    return exactText(candidate);
  } });
  assert.equal(rendered.root.dataset.status, 'EVIDENCE_CANDIDATE');
  assert.equal(rendered.root.dataset.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(rendered.root.dataset.finalRelation, 'NOT_COMPUTED');
  ['EVIDENCE_CANDIDATE', 'REQUIRES_REVIEW', 'NOT_COMPUTED'].forEach((value) => assert(rendered.text.includes(value), `missing ${value}`));
  assert(!rendered.text.includes('ACCEPTED_EVIDENCE'));
});

check('SUPPORTS and REFUTES remain an explicit unresolved conflict', () => {
  const rendered = render(cascade, { resolver: (request) => {
    const candidate = cascade.evidenceCandidates.find((item) => item.candidateId === request.candidateId);
    return exactText(candidate);
  } });
  assert.equal(rendered.root.dataset.conflict, 'true');
  assert(rendered.text.includes('КОНФЛИКТ'));
  assert(rendered.text.includes('SUPPORTS + REFUTES'));
  assert(rendered.text.includes('SUPPORTS') && rendered.text.includes('REFUTES'));
});

check('actionable relations precede a collapsed MENTIONS group', () => {
  const rendered = render(cascade, { resolver: (request) => {
    const candidate = cascade.evidenceCandidates.find((item) => item.candidateId === request.candidateId);
    return exactText(candidate);
  } });
  const list = rendered.root.children.find((child) => child.className === 'evidenceCandidateList');
  assert(list, 'candidate list missing');
  assert.equal(list.children[0].dataset.relation, 'SUPPORTS');
  assert.equal(list.children[1].dataset.relation, 'REFUTES');
  assert.equal(list.children[2].tagName, 'DETAILS');
  assert(allText(list.children[2]).includes('MENTIONS'));
});

check('resolver receives pinned coordinates and exact text is hash verified', () => {
  const requests = [];
  const rendered = render(cascade, { resolver: (request) => {
    requests.push(request);
    const candidate = cascade.evidenceCandidates.find((item) => item.candidateId === request.candidateId);
    return { text: exactText(candidate) };
  } });
  assert.equal(requests.length, cascade.evidenceCandidates.length);
  requests.forEach((request) => {
    assert.equal(request.schema, 'meridian.evidence-text-resolution-request/1');
    assert(Canonical.isSha256(request.sourceRef.sourceHash));
    assert(Canonical.isSha256(request.passageTextHash));
    assert(Number.isInteger(request.locator.start) && request.locator.end > request.locator.start);
    assert(Object.isFrozen(request));
  });
  assert(rendered.text.includes('EXACT_TEXT_VERIFIED'));
  assert(rendered.text.includes('Система сохраняет состояние.'));
  assert(rendered.text.includes('Система не сохраняет состояние.'));
});

check('full source, passage and candidate pins plus locator are visible', () => {
  const candidate = cascade.evidenceCandidates[0];
  const rendered = render([candidate], { resolver: () => exactText(candidate) });
  [candidate.sourceRef.sourceId, candidate.sourceRef.revision, candidate.sourceRef.sourceHash, candidate.passageTextHash, candidate.contentHash]
    .forEach((value) => assert(rendered.text.includes(value), `missing pin ${value}`));
  assert(rendered.text.includes(`UTF16_CODE_UNIT [${candidate.locator.start}, ${candidate.locator.end})`));
  assert(rendered.text.includes(`sentenceIndex=${candidate.locator.sentenceIndex}`));
});

check('all alignment dimensions including quantifier are rendered', () => {
  const candidate = cascade.evidenceCandidates.find((item) => item.proposedRelation === 'REFUTES');
  const rendered = render([candidate], { resolver: () => exactText(candidate) });
  ['предикат', 'аргументы', 'полярность', 'модальность', 'квантор', 'ограничители', 'TRUE', 'FALSE']
    .forEach((value) => assert(rendered.text.includes(value), `missing alignment ${value}`));
});

check('embedded exact text takes precedence over the resolver', () => {
  const candidate = cascade.evidenceCandidates[0];
  let resolverCalls = 0;
  const rendered = render({
    evidenceCandidates: [candidate],
    exactTextByCandidateId: { [candidate.candidateId]: exactText(candidate) },
  }, { resolver: () => { resolverCalls += 1; return 'unexpected'; } });
  assert.equal(resolverCalls, 0);
  assert(rendered.text.includes('EXACT_TEXT_VERIFIED'));
  assert(rendered.text.includes('EMBEDDED'));
});

check('mismatched or missing exact text fails closed', () => {
  const candidate = cascade.evidenceCandidates[0];
  const forged = 'Поддельный фрагмент не должен отображаться.';
  const mismatched = render({
    evidenceCandidates: [candidate],
    exactTextByCandidateId: { [candidate.candidateId]: forged },
  });
  assert(mismatched.text.includes('PASSAGE_TEXT_HASH_MISMATCH'));
  assert(!mismatched.text.includes(forged));
  const unavailable = render([candidate]);
  assert(unavailable.text.includes('EXACT_TEXT_UNAVAILABLE'));
  assert(!unavailable.text.includes(exactText(candidate)));
});

check('invalid candidates are isolated and never reach the resolver', () => {
  const invalid = { ...cascade.evidenceCandidates[0], finalRelation: 'SUPPORTS' };
  let calls = 0;
  const rendered = render([invalid], { resolver: () => { calls += 1; return 'unexpected'; } });
  assert.equal(calls, 0);
  assert.equal(rendered.root.dataset.status, 'NOT_COMPUTED');
  assert.equal(rendered.root.dataset.reviewStatus, 'NOT_COMPUTED');
  assert.equal(rendered.root.dataset.candidateCount, '0');
  assert.equal(rendered.root.dataset.inputCandidateCount, '1');
  assert.equal(rendered.root.dataset.validCandidateCount, '0');
  assert(rendered.text.includes('INVALID_CANDIDATE'));
  assert(rendered.text.includes('FINAL_RELATION_FORBIDDEN'));
});

check('component has no command, portal or dynamic execution path', () => {
  const source = fs.readFileSync(lib('p78-evidence-candidate-view'), 'utf8');
  assert(!/commitSemanticAction|actionController|executePortal|addEventListener|fetch\s*\(|\beval\s*\(|\bnew\s+Function\s*\(/.test(source));
  assert(source.includes('evidenceCandidateLiveStatus'), 'short live status absent');
});

check('stylesheet provides bounded responsive geometry and wrapping', () => {
  const css = fs.readFileSync(path.join(rootDir, 'p78-evidence-candidate-view.css'), 'utf8');
  [
    'container-type:inline-size', 'grid-template-columns:repeat(2,minmax(0,1fr))',
    'grid-template-columns:repeat(3,minmax(0,1fr))', '@container (max-width:720px)',
    '@container (max-width:480px)', '@media (max-width:680px)', 'min-width:0',
    'overflow-wrap:anywhere', 'word-break:break-word',
  ].forEach((value) => assert(css.includes(value), `CSS contract missing: ${value}`));
  assert(!/border-radius:(?:1[0-9]|[2-9][0-9])px/.test(css));
  assert(!/font-size:(?:8|9)px/.test(css), 'service text is too small');
});

check('prototype loads the reviewed passive view before runtime', () => {
  const html = fs.readFileSync(path.join(rootDir, 'p78-living-ring-interface.html'), 'utf8');
  assert(html.includes('p78-evidence-candidate-view.js?v=1.0.1'));
  assert(html.includes('p78-evidence-candidate-view.css?v=1.0.1'));
  assert(html.indexOf('p78-evidence-candidate-view.js') < html.indexOf('p78-living-ring-runtime.js'));
  assert(html.includes('id="controlledClaimEvidence"'));
  assert(!/<div id="controlledClaimEvidence"[^>]*aria-live=/.test(html), 'whole evidence panel must not be a live region');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
