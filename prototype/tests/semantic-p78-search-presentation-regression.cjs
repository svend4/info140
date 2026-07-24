'use strict';

const fs = require('node:fs');
const path = require('node:path');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
['p78-canonical-json', 'p78-search-contracts', 'p78-search-corpus', 'p78-query-projector', 'p78-search-view'].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const Corpus = global.MRDP78SearchCorpus;
const Projector = global.MRDP78QueryProjector;
const View = global.MRDP78SearchView;

function assert(condition, message) { if (!condition) throw new Error(message); }
function allText(element) { return [element._text || '', ...element.children.map(allText)].join(' '); }

class FakeElement {
  constructor(tag, document) {
    this.tagName = String(tag).toUpperCase(); this.ownerDocument = document; this.children = []; this.parentNode = null;
    this.className = ''; this.dataset = {}; this._text = '';
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
  get firstChild() { return this.children[0] || null; }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return allText(this); }
}
class FakeDocument { createElement(tag) { return new FakeElement(tag, this); } }

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

const shape = Canonical.copyAndFreeze({
  schema: 'meridian.formula-shape/1',
  formulaRef: {
    formulaId: 'pressure.margin',
    version: '1.0.0',
    contentHash: Canonical.hashText('pressure.margin@1.0.0'),
  },
  rootNode: 'Subtract',
  operationMultiset: { Max: 1, Subtract: 1 },
  operationPaths: ['$.Subtract', '$.Subtract.right.Max'],
  inputTypes: [{ kind: 'NUMBER', unit: '1' }, { kind: 'NUMBER', unit: '1' }],
  outputType: { kind: 'NUMBER', unit: '1' },
  dependencyRefs: [{ formulaId: 'pressure.orbit-total', version: '1.0.0', contentHash: Canonical.hashText('pressure.orbit-total@1.0.0') }],
  literalKinds: [],
  assumptions: [],
  shapeHash: Canonical.hashText('pressure.margin.shape'),
});

check('fixed P78 corpus is admitted, immutable and content-addressed', () => {
  assert(Corpus.version === '1.0.0' && Corpus.records.length === 9, `records=${Corpus.records.length}`);
  assert(Canonical.isSha256(Corpus.sourceSetHash), 'source set hash missing');
  assert(Object.isFrozen(Corpus) && Object.isFrozen(Corpus.records), 'corpus is mutable');
  Corpus.records.forEach((record) => {
    const payload = { ...record }; delete payload.sourceHash;
    assert(record.status === 'ADMITTED', `${record.sourceId} is not admitted`);
    assert(record.sourceHash === Canonical.hashCanonical(payload), `${record.sourceId} hash mismatch`);
  });
});

check('Formula AST projection is exact, bounded and deterministic', () => {
  const first = Projector.projectFormula(shape);
  const replay = Projector.projectFormula(shape);
  assert(first.status === 'READY' && JSON.stringify(first) === JSON.stringify(replay), 'projection replay changed');
  assert(first.projection.queries.length >= 4, `queries=${first.projection.queries.length}`);
  assert(first.projection.completenessClaim === 'BOUNDED_VOCABULARY_ONLY', 'projection overstates completeness');
  assert(first.projection.queries.every((query) => query.mode === 'EXACT' && query.expansionClass === 'EXACT'), 'heuristic query leaked into exact projection');
  assert(first.projection.queries.some((query) => query.expression.value === 'pressure.margin'), 'formulaId query absent');
  assert(first.projection.queries.some((query) => query.expression.value === 'pressure.orbit-total'), 'dependency query absent');
  assert(Canonical.isSha256(first.projection.contentHash), 'projection hash absent');
});

check('projector fails closed on unknown shape fields and exhausted budget', () => {
  const unknown = { ...shape, semanticTruth: true };
  const invalid = Projector.projectFormula(unknown);
  const blocked = Projector.projectFormula(shape, { operationBudget: 1 });
  assert(invalid.status === 'INVALID' && invalid.code === 'FORMULA_SHAPE_UNKNOWN_FIELD', `${invalid.status}/${invalid.code}`);
  assert(blocked.status === 'BLOCKED' && blocked.code === 'OPERATION_BUDGET_EXCEEDED', `${blocked.status}/${blocked.code}`);
});

check('passive view keeps located, structural and evidence layers separate', () => {
  const document = new FakeDocument();
  const root = new FakeElement('div', document);
  const trace = {
    contentHash: Canonical.hashText('trace'),
    steps: [
      { ordinal: 1, direction: 'GREP_TO_AST', status: 'READY' },
      { ordinal: 2, direction: 'AST_TO_GREP', status: 'READY' },
      { ordinal: 3, direction: 'EVIDENCE_GATE', status: 'ABSTAIN' },
    ],
  };
  View.render(root, {
    status: 'READY', sourceSetHash: Corpus.sourceSetHash, indexHash: Canonical.hashText('index'), trace,
    located: [{ sourceId: 'p78.formula.margin', title: 'Запас', contextText: 'pressure.margin сравнивает орбиту', status: 'LOCATED' }],
    structuralMatches: [{ formulaId: 'pressure.margin', patternId: 'formula.root.subtract', status: 'STRUCTURAL_MATCH' }],
    evidenceCandidates: [], evidenceStatus: 'NOT_COMPUTED', semanticTruth: false,
  });
  const rendered = allText(root);
  assert(root.dataset.status === 'READY' && Canonical.isSha256(root.dataset.traceHash), 'view identity missing');
  ['найдено', 'LOCATED', 'структурно', 'STRUCTURAL_MATCH', 'доказательность', 'NOT_COMPUTED', 'ABSTAIN'].forEach((needle) => assert(rendered.includes(needle), `missing ${needle}`));
  assert(!rendered.includes('SUPPORTED'), 'view promoted an unverified hit');
});

check('search view contains no action or commit path', () => {
  const sources = ['p78-search-corpus', 'p78-query-projector', 'p78-search-view'].map((name) => fs.readFileSync(lib(name), 'utf8')).join('\n');
  assert(!/commitSemanticAction|actionController|executePortal|addEventListener/.test(sources), 'search presentation gained an action path');
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(|Math\.random|Date\.now|fetch\s*\(/.test(sources), 'search presentation is nondeterministic or dynamic');
});

check('responsive stylesheet uses bounded layers without page overflow rules', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'p78-search-view.css'), 'utf8');
  ['grid-template-columns:repeat(3,minmax(0,1fr))', 'overflow-x:auto', '@media (max-width:1100px)', '@media (max-width:680px)', 'overflow-wrap:anywhere'].forEach((needle) => assert(css.includes(needle), `CSS contract missing: ${needle}`));
  assert(!/border-radius:(?:1[0-9]|[2-9][0-9])px/.test(css), 'oversized card radius introduced');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
