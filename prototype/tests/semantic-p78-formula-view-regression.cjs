'use strict';

const fs = require('node:fs');
const path = require('node:path');
const p78 = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
['p78-canonical-json', 'p78-formula-registry', 'p78-formula-engine', 'p78-formula-view', 'p78-formula-adapter'].forEach((name) => require(lib(name)));

const Registry = global.MRDP78FormulaRegistry;
const Engine = global.MRDP78FormulaEngine;
const View = global.MRDP78FormulaView;
const Adapter = global.MRDP78FormulaAdapter;

function assert(condition, message) { if (!condition) throw new Error(message); }
function approx(actual, expected, tolerance, message) { if (Math.abs(actual - expected) > tolerance) throw new Error(`${message}: ${actual}`); }
function allText(element) { return [element._text || '', ...element.children.map(allText)].join(' '); }

class FakeElement {
  constructor(tag, document) {
    this.tagName = String(tag).toUpperCase(); this.ownerDocument = document; this.children = []; this.parentNode = null;
    this.className = ''; this.dataset = {}; this.title = ''; this._text = ''; this.value = '';
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
  get firstChild() { return this.children[0] || null; }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return allText(this); }
}
class FakeDocument {
  createElement(tag) { return new FakeElement(tag, this); }
}

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

const document = new FakeDocument();
const root = new FakeElement('div', document);
const xInput = new FakeElement('input', document), yInput = new FakeElement('input', document);
const xOutput = new FakeElement('output', document), yOutput = new FakeElement('output', document);
xInput.value = '85'; yInput.value = '20';
let semanticCalls = 0;
const semantic = {
  semanticPhi() {
    semanticCalls += 1;
    return { metrics: { growth: .7, novelty: .8, openness: .6, phi: .5 } };
  },
};
const adapter = Adapter.create({ registry: Registry, engine: Engine, view: View, semantic, root, xInput, yInput, xOutput, yOutput });

check('formula panel modules expose frozen versioned passive APIs', () => {
  assert(View.version === '1.0.0' && Adapter.version === '1.0.0', 'formula UI API version missing');
  assert(Object.isFrozen(View) && Object.isFrozen(Adapter) && Object.isFrozen(adapter), 'formula UI API is mutable');
  ['render', 'clear'].forEach((name) => assert(typeof View[name] === 'function', `${name} missing`));
});

check('normative x/y and lambda produce an eleven-node deterministic matryoshka', () => {
  const first = adapter.render('тема получает новую деталь и продолжается', .5, true);
  const replay = adapter.render('тема получает новую деталь и продолжается', .5, false);
  assert(first.status === 'READY' && first.trace.length === 11 && first.summary.completed === first.summary.total, `trace=${first.trace.length}/${first.summary.total}`);
  approx(first.summary.partition, 1, 1e-15, 'partition');
  approx(first.summary.margin, .54, 1e-15, 'margin');
  approx(first.summary.direction, .65, 1e-15, 'direction');
  approx(first.summary.balance, 1, 1e-15, 'balance');
  assert(JSON.stringify(first) === JSON.stringify(replay), 'same inputs changed normalized result');
  assert(semanticCalls === 1, `semantic metrics recomputed ${semanticCalls} times`);
  assert(xOutput.textContent === '0.85' && yOutput.textContent === '0.20', 'explicit input values are not visible');
});

check('typed controls react predictably without changing semantic evidence', () => {
  xInput.value = '50'; yInput.value = '50';
  const symmetric = adapter.render('тема получает новую деталь и продолжается', .5, false);
  approx(symmetric.summary.direction, 0, 1e-15, 'symmetric direction');
  approx(symmetric.summary.margin, .25, 1e-15, 'symmetric margin');
  xInput.value = '100'; yInput.value = '100';
  const center = adapter.render('тема получает новую деталь и продолжается', .5, false);
  approx(center.summary.margin, -1, 1e-15, 'center margin');
  assert(center.next.formulaId === 'pressure.margin', `center next=${center.next.formulaId}`);
  xInput.value = '85'; yInput.value = '20';
  const pole = adapter.render('тема получает новую деталь и продолжается', 0, false);
  approx(pole.summary.balance, 0, 1e-15, 'lambda pole balance');
  assert(pole.next.formulaId === 'ring.balance', `pole next=${pole.next.formulaId}`);
  assert(semanticCalls === 1, 'x/y/lambda controls recomputed text semantics');
});

check('out-of-domain control fails closed instead of clamping', () => {
  xInput.value = '150'; yInput.value = '20';
  const invalid = adapter.render('тема', .5, false);
  assert(invalid.status === 'INVALID' && invalid.code === 'DOMAIN_VIOLATION', `${invalid.status}/${invalid.code}`);
  assert(root.dataset.status === 'INVALID' && allText(root).includes('DOMAIN_VIOLATION'), 'failure is invisible');
  xInput.value = '85'; yInput.value = '20';
});

check('view exposes route, values, registry hash and honest evidence boundary', () => {
  const result = adapter.render('тема получает новую деталь и продолжается', .5, false);
  const text = allText(root);
  assert(root.dataset.status === 'READY' && root.dataset.registryHash === Registry.registryHash, 'view identity missing');
  ['цепь исполнена', 'баланс кольца', 'запас 2D', 'STRUCTURAL', 'NOT_COMPUTED'].forEach((needle) => assert(text.includes(needle), `view text missing: ${needle}`));
  assert(text.includes('математическая доказанность') && text.includes('семантическая истинность'), 'evidence limitation hidden');
  assert(result.semanticTruth === false && result.soundness === 'NOT_COMPUTED', 'adapter overstates evidence');
});

check('shell loads formula modules in exact dependency order before the last runtime', () => {
  const order = [
    'lib/p78-canonical-json.js', 'lib/p78-formula-registry.js', 'lib/p78-formula-engine.js',
    'lib/p78-formula-view.js', 'lib/p78-formula-adapter.js', 'lib/p78-living-ring-runtime.js',
  ];
  order.forEach((source) => assert(p78.html.includes(`${source}?v=`), `${source} is unversioned or absent`));
  for (let index = 1; index < order.length; index += 1) p78.assertScriptOrder(order[index - 1], order[index]);
  assert(p78.html.includes('id="formulaX"') && p78.html.includes('id="formulaY"') && p78.html.includes('id="formulaTrace"'), 'formula controls absent');
  assert(p78.html.includes('p78-formula-view.css?v=1.0.0'), 'formula stylesheet absent');
});

check('runtime refreshes analysis and parameters without a formula commit path', () => {
  const runtime = p78.runtime;
  assert(runtime.includes('FormulaAdapter.create({') && runtime.includes('formulaAdapter.render(condition.value,+lambda.value/100,true)'), 'adapter is not connected to apply');
  assert(runtime.includes("formulaX.addEventListener('input'") && runtime.includes("formulaY.addEventListener('input'"), 'formula controls are not live');
  const sources = ['p78-formula-view', 'p78-formula-adapter'].map((name) => fs.readFileSync(lib(name), 'utf8')).join('\n');
  assert(!/commitSemanticAction|actionController|executePortal|addEventListener/.test(sources), 'formula UI gained an action/commit path');
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(|Math\.random|Date\.now|fetch\s*\(/.test(sources), 'formula UI is nondeterministic or dynamic');
});

check('formula stylesheet uses stable responsive tracks and bounded horizontal trace', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'p78-formula-view.css'), 'utf8');
  ['grid-template-columns:repeat(2,minmax(0,1fr))', 'overflow-x:auto', 'flex:0 0 154px', '@media (max-width:680px)', 'overflow-wrap:anywhere'].forEach((needle) => assert(css.includes(needle), `CSS contract missing: ${needle}`));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
