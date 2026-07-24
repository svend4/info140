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
  'p78-linguistic-structure-index', 'p78-claim-evidence-cascade', 'p78-controlled-claim-engine',
  'p78-semantic-work-contracts', 'p78-semantic-flow-reducer', 'p78-semantic-flow-view',
].forEach((name) => require(lib(name)));

const Cascade = global.MRDP78ClaimEvidenceCascade.create();
const Engine = global.MRDP78ControlledClaimEngine.create({ evidenceCascade: Cascade });
const Flow = global.MRDP78SemanticFlowReducer;
const View = global.MRDP78SemanticFlowView;
const MOVEMENT = '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435.';
const AMBIGUOUS = '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u043e\u043f\u0438\u0441\u044b\u0432\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435.';
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
function allText(element) { return [element._text || '', ...element.children.map(allText)].join(' '); }
function flatten(element) { return [element, ...element.children.flatMap(flatten)]; }
function byClass(root, name) { return flatten(root).filter((item) => (` ${item.className} `).includes(` ${name} `)); }
class FakeElement {
  constructor(tag, document) {
    this.tagName = String(tag).toUpperCase(); this.ownerDocument = document;
    this.children = []; this.parentNode = null; this.className = ''; this.dataset = {}; this.attributes = {}; this._text = '';
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  get firstChild() { return this.children[0] || null; }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return allText(this); }
}
class FakeDocument { createElement(tag) { return new FakeElement(tag, this); } }
function rootFixture() { const document = new FakeDocument(); return new FakeElement('div', document); }

check('view API is passive, immutable and versioned', () => {
  assert.equal(View.status, 'READY');
  assert.equal(View.version, '1.1.0');
  assert(Object.isFrozen(View));
  assert.equal(typeof View.render, 'function');
});

check('valid snapshot renders exactly five ordered orbit nodes', () => {
  const root = rootFixture();
  const frame = Flow.reduce(Engine.run(MOVEMENT));
  View.render(root, frame);
  const nodes = byClass(root, 'semanticFlowNode');
  assert.equal(root.dataset.status, 'REVIEW_QUEUE');
  assert.equal(root.dataset.authority, 'ROUTING_DIAGNOSTIC_ONLY');
  assert.equal(root.dataset.executionModel, 'POST_HOC_AG4_PROJECTION');
  assert.equal(root.dataset.semanticTruth, 'false');
  assert.equal(nodes.length, 5);
  assert.deepEqual(nodes.map((item) => item.dataset.operator), ['INPUT', 'PARSE', 'DISCOVER', 'ALIGN', 'REVIEW']);
  assert.deepEqual(nodes.map((item) => item.dataset.state), ['SHIPPED', 'SHIPPED', 'SHIPPED', 'SHIPPED', 'PARKED']);
});

check('view exposes neutral relation statistics and preserves ABSTAIN', () => {
  const root = rootFixture();
  View.render(root, Flow.reduce(Engine.run(MOVEMENT)));
  const rendered = allText(root);
  assert(rendered.includes('ABSTAIN'));
  assert(rendered.includes('\u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043e\u0442\u043d\u043e\u0448\u0435\u043d\u0438\u0439'));
  assert(!rendered.includes('\u0434\u0440\u043e\u0431\u043d\u043e\u0441\u0442\u044c'));
  assert(!rendered.includes('\u0441\u0436\u0430\u0442\u0438\u0435'));
  assert(!rendered.includes('\u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435'));
  assert.equal(byClass(root, 'semanticFlowMetric').length, 7);
  assert.equal(byClass(root, 'semanticFlowRelation').length, 4);
});

check('delta is separate, validated and never changes snapshot content', () => {
  const first = Flow.reduce(Engine.run(MOVEMENT));
  const replay = Flow.reduce(Engine.run(MOVEMENT));
  const changed = Flow.reduce(Engine.run(AMBIGUOUS));
  const root = rootFixture();
  View.render(root, replay, Flow.createDelta(first, replay));
  assert.equal(root.dataset.changedCount, '0');
  View.render(root, changed, Flow.createDelta(replay, changed));
  assert.equal(root.dataset.changedCount, '5');
  assert.equal(first.contentHash, replay.contentHash);
});

check('invalid frame or mismatched delta fails closed in the panel', () => {
  const first = Flow.reduce(Engine.run(MOVEMENT));
  const changed = Flow.reduce(Engine.run(AMBIGUOUS));
  const root = rootFixture();
  const invalid = global.MRDP78CanonicalJSON.deepCopy(first);
  invalid.metrics.queueLength = 0;
  View.render(root, invalid);
  assert.equal(root.dataset.status, 'INVALID');
  View.render(root, first, Flow.createDelta(first, changed));
  assert.equal(root.dataset.status, 'INVALID');
  assert(allText(root).includes('DELTA_TARGET_MISMATCH'));
});

check('render is idempotent and creates no interactive commands', () => {
  const root = rootFixture();
  const frame = Flow.reduce(Engine.run(MOVEMENT));
  View.render(root, frame); View.render(root, frame);
  assert.equal(root.className.split(/\s+/).filter((name) => name === 'semanticFlowView').length, 1);
  assert.equal(byClass(root, 'semanticFlowHead').length, 1);
  assert.equal(flatten(root).filter((item) => item.tagName === 'BUTTON').length, 0);
  assert.equal(flatten(root).filter((item) => item.attributes.role === 'listitem').length, 5);
});

check('browser shell loads contracts, reducer, view and stylesheet before runtime', () => {
  const html = fs.readFileSync(path.join(rootDir, 'p78-living-ring-interface.html'), 'utf8');
  const names = ['p78-semantic-work-contracts.js', 'p78-semantic-flow-reducer.js', 'p78-semantic-flow-view.js', 'p78-living-ring-runtime.js'];
  const positions = names.map((name) => html.indexOf(name));
  assert(positions.every((position) => position >= 0));
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b));
  assert(html.includes('p78-semantic-flow-view.css'));
  assert(html.includes('id="semanticFlowView"'));
});

check('runtime keeps the panel lazy and fail-isolated from Claim evidence', () => {
  const runtime = fs.readFileSync(lib('p78-living-ring-runtime'), 'utf8');
  assert(runtime.includes("if(!semanticFlowEl) return null;"));
  assert(runtime.includes("semanticFlowEl.dataset.status='BLOCKED'"));
  assert(runtime.includes('SemanticFlowReducer.createDelta(previous,frame)'));
  assert(runtime.includes('SemanticFlowView.render(semanticFlowEl,frame,delta)'));
  assert(runtime.includes('renderSemanticFlow(semanticState.claimTrace);'));
  assert(!runtime.includes('{previousFrame:semanticState.semanticFlowFrame}'));
});

check('CSS fixes orbit dimensions and contains no perpetual animation', () => {
  const css = fs.readFileSync(path.join(rootDir, 'p78-semantic-flow-view.css'), 'utf8');
  assert(css.includes('.semanticFlowOrbit{position:relative;width:100%;height:238px'));
  assert(css.includes('.semanticFlowNode.position-0'));
  assert(css.includes('@media (max-width:360px)'));
  assert(/\.semanticFlowNode b\{[^}]*font-size:10px[^}]*white-space:nowrap/.test(css));
  assert(!/@keyframes|animation\s*:/.test(css));
  assert(!/font-size\s*:[^;]*(?:vw|vh)/.test(css));
  assert(!css.includes('is-heuristic'));
});

check('view source has no HTML injection, event binding or authority command', () => {
  const source = fs.readFileSync(lib('p78-semantic-flow-view'), 'utf8');
  ['innerHTML', 'onclick', 'addEventListener', 'semanticTruth=true', 'ACCEPT', 'COMMIT'].forEach((term) => assert(!source.includes(term), `${term} must be absent`));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
