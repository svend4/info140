'use strict';

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'p78-search-contracts', 'p78-local-text-index', 'p78-search-corpus',
  'p78-formula-registry', 'p78-formula-shape-index', 'p78-formula-structural-matcher',
  'p78-query-projector', 'p78-bidirectional-retrieval', 'p78-search-view', 'p78-search-adapter',
].forEach((name) => require(lib(name)));

const Registry = global.MRDP78FormulaRegistry;
const Retrieval = global.MRDP78BidirectionalRetrieval;
const View = global.MRDP78SearchView;
const Adapter = global.MRDP78SearchAdapter;

function assert(condition, message) { if (!condition) throw new Error(message); }
function allText(element) { return [element._text || '', ...element.children.map(allText)].join(' '); }

class FakeElement {
  constructor(tag, document) {
    this.tagName = String(tag).toUpperCase(); this.ownerDocument = document; this.children = []; this.parentNode = null;
    this.className = ''; this.dataset = {}; this._text = ''; this.value = ''; this.selected = false;
  }
  appendChild(child) {
    child.parentNode = this; this.children.push(child);
    if (this.tagName === 'SELECT' && child.tagName === 'OPTION' && (child.selected || !this.value)) this.value = child.value;
    return child;
  }
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

const document = new FakeDocument();
const root = new FakeElement('div', document);
const queryInput = new FakeElement('input', document);
const formulaSelect = new FakeElement('select', document);
queryInput.value = 'движение';
const engine = Retrieval.create();
const adapter = Adapter.create({ engine, view: View, root, queryInput, formulaSelect, registry: Registry });

check('adapter exposes a frozen passive API and all active formula options', () => {
  assert(Adapter.version === '1.0.0' && adapter.version === '1.0.0', 'adapter version missing');
  assert(Object.isFrozen(Adapter) && Object.isFrozen(adapter), 'adapter mutable');
  assert(formulaSelect.children.length === 11, `options=${formulaSelect.children.length}`);
  assert(formulaSelect.value === 'pressure.margin', `default=${formulaSelect.value}`);
});

check('initial rendering exposes three honest layers and reproducible identities', () => {
  const result = adapter.render();
  const rendered = allText(root);
  assert(result.status === 'READY' && result.located.length >= 2 && result.structuralMatches.length === 1, 'initial search did not complete');
  ['найдено', 'LOCATED', 'структурно', 'STRUCTURAL_MATCH', 'доказательность', 'NOT_COMPUTED', 'ABSTAIN'].forEach((needle) => assert(rendered.includes(needle), `missing ${needle}`));
  assert(root.dataset.status === 'READY' && root.dataset.traceHash === result.traceHash, 'render identity missing');
  assert(adapter.current() === result, 'current snapshot does not reference rendered result');
});

check('query and formula controls produce a different predictable trace', () => {
  const previous = adapter.current();
  queryInput.value = 'движение по окружности';
  formulaSelect.value = 'ring.balance';
  const next = adapter.render();
  assert(next.traceHash !== previous.traceHash, 'changed controls reused trace');
  assert(next.located.some((hit) => hit.matchedText.toLowerCase() === 'движение по окружности'), 'exact phrase missing');
  assert(next.structuralMatches[0].bindings.formulaId === 'ring.balance', 'formula selector ignored');
  assert(allText(root).includes('ring.balance'), 'selected formula invisible');
});

check('HTML loads search dependencies in strict order before runtime', () => {
  const html = fs.readFileSync(path.join(rootDir, 'p78-living-ring-interface.html'), 'utf8');
  const order = [
    'lib/p78-canonical-json.js', 'lib/p78-search-contracts.js', 'lib/p78-local-text-index.js', 'lib/p78-search-corpus.js',
    'lib/p78-formula-registry.js', 'lib/p78-formula-shape-index.js', 'lib/p78-formula-structural-matcher.js',
    'lib/p78-query-projector.js', 'lib/p78-bidirectional-retrieval.js', 'lib/p78-search-view.js', 'lib/p78-search-adapter.js',
    'lib/p78-living-ring-runtime.js',
  ];
  order.forEach((source) => assert(html.includes(`${source}?v=`), `${source} absent or unversioned`));
  for (let index = 1; index < order.length; index += 1) assert(html.indexOf(order[index - 1]) < html.indexOf(order[index]), `${order[index - 1]} must precede ${order[index]}`);
  ['semanticSearchQuery', 'semanticSearchFormula', 'semanticSearchRun', 'semanticSearchTrace'].forEach((id) => assert(html.includes(`id="${id}"`), `${id} absent`));
  assert(html.includes('p78-search-view.css?v=1.0.0'), 'search stylesheet absent');
  assert(html.includes('p78-living-ring-runtime.js?v=1.10.0'), 'runtime version stale');
});

check('runtime renders on apply and binds only local diagnostic controls', () => {
  const runtime = fs.readFileSync(lib('p78-living-ring-runtime'), 'utf8');
  assert(runtime.includes('var searchEngine=BidirectionalRetrieval.create();'), 'search engine not created');
  assert(runtime.includes('semanticState.searchTrace=searchAdapter.render();'), 'search result not retained');
  assert(runtime.includes('semanticSearchRun.onclick=renderSemanticSearch;'), 'search command not bound');
  assert(runtime.includes("semanticSearchFormula.addEventListener('change',renderSemanticSearch)"), 'formula selector not live');
  const passive = ['p78-search-view', 'p78-search-adapter'].map((name) => fs.readFileSync(lib(name), 'utf8')).join('\n');
  assert(!/commitSemanticAction|actionController|executePortal/.test(passive), 'search UI gained commit authority');
});

check('search controls and layers have stable responsive geometry', () => {
  const css = fs.readFileSync(path.join(rootDir, 'p78-search-view.css'), 'utf8');
  ['grid-template-columns:minmax(0,1fr) minmax(132px,.7fr) auto', 'grid-template-columns:repeat(3,minmax(0,1fr))', 'container-type:inline-size', '@container (max-width:520px)', '@media (max-width:1100px)', '@media (max-width:680px)', 'min-width:0'].forEach((needle) => assert(css.includes(needle), `CSS contract missing: ${needle}`));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
