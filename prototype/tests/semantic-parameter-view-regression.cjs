'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p78 = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
['semantic-core', 'semantic-reaction-rules', 'semantic-reaction-field', 'semantic-trace-continuation', 'semantic-parameter-counterfactual', 'semantic-parameter-view'].forEach((name) => require(lib(name)));

const counterfactual = global.MRDSemanticParameterCounterfactual;
const view = global.MRDSemanticParameterView;
const ARTICLE = 'Продолжить статью: город учится беречь воду, но жители спорят о цене. Нужны общий смысл, факты и следующий проверяемый шаг.';

class FakeNode {
  constructor(tag, doc) { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.parentNode = null; this.className = ''; this.textContent = ''; this.attributes = {}; this.onclick = null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  get firstChild() { return this.children[0] || null; }
}
class FakeDocument { createElement(tag) { return new FakeNode(tag, this); } }
function root() { const doc = new FakeDocument(); return new FakeNode('div', doc); }
function walk(node, predicate, out = []) { if (predicate(node)) out.push(node); node.children.forEach((child) => walk(child, predicate, out)); return out; }
function classes(node, name) { return walk(node, (item) => item.className.split(/\s+/).includes(name)); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

assert(counterfactual && view && typeof view.render === 'function', 'parameter view stack is incomplete');
const stable = counterfactual.compare(ARTICLE, '', .5);

check('stable pack renders exactly three scenario rows', () => {
  const host = root(), result = view.render(host, stable);
  assert(result.status === 'STABLE' && result.scenarios === 3, 'render metadata mismatch');
  assert(classes(host, 'counterfactualScenario').length === 3, 'scenario row count changed');
  assert(host.getAttribute('data-status') === 'STABLE', 'root status attribute missing');
});

check('scenario identity, status, effect, lambda and trace stay inspectable', () => {
  const host = root(); view.render(host, stable);
  const rows = classes(host, 'counterfactualScenario');
  assert(rows.map((row) => row.getAttribute('data-scenario-id')).join(',') === 'lower,current,upper', 'scenario ids changed');
  assert(rows.map((row) => row.getAttribute('data-lambda')).join(',') === '0.38,0.50,0.62', 'lambda attributes changed');
  rows.forEach((row) => {
    assert(row.getAttribute('data-status') === 'READY', 'ready status is not exposed');
    assert(row.getAttribute('data-effect'), 'effect is missing');
    assert(/^[0-9a-f]{8}$/.test(row.getAttribute('data-trace-hash')), 'trace hash is missing');
  });
  assert(host.getAttribute('data-comparison-hash') === stable.hashes.comparison, 'comparison hash changed');
});

check('current and best state use stable classes without nested actions', () => {
  const host = root(); view.render(host, stable);
  assert(classes(host, 'current').length === 1 && classes(host, 'best').length === 1, 'current or best marker missing');
  assert(classes(host, 'current')[0] === classes(host, 'best')[0], 'centered best is not current');
  assert(walk(host, (item) => item.tagName === 'button').length === 0, 'passive panel emitted a command');
  assert(walk(host, (item) => typeof item.onclick === 'function').length === 0, 'passive panel attached a callback');
});

check('sensitive pack exposes damped neighbor and changed summary', () => {
  const host = root(), pack = counterfactual.compare(ARTICLE, '', .22), result = view.render(host, pack);
  const rows = classes(host, 'counterfactualScenario');
  assert(result.status === 'SENSITIVE' && host.getAttribute('data-status') === 'SENSITIVE', 'sensitive status is hidden');
  assert(rows[0].getAttribute('data-status') === 'DAMPED' && rows[0].getAttribute('data-effect') === 'damped', 'damped lower scenario is hidden');
  assert(classes(host, 'counterfactualSummary')[0].textContent.includes('из 2'), 'sensitivity summary missing');
});

check('empty pack clears stale rows and remains non-actionable', () => {
  const host = root(); view.render(host, stable); const result = view.render(host, {});
  assert(result.status === 'EMPTY' && result.scenarios === 0, 'empty metadata changed');
  assert(classes(host, 'counterfactualScenario').length === 0 && host.getAttribute('data-status') === 'EMPTY', 'stale scenarios remain');
  assert(walk(host, (item) => item.tagName === 'button').length === 0, 'empty panel emitted an action');
});

check('p78 delegates rendering to the passive module', () => {
  const { html, runtime } = p78;
  const start = runtime.indexOf('function renderParameterCounterfactual()');
  const end = runtime.indexOf('function scheduleParameterCounterfactual()', start);
  const block = runtime.slice(start, end);
  assert(html.includes('lib/semantic-parameter-view.js?v=1.0.0') && html.includes('id="parameterCounterfactual"'), 'view or panel is missing');
  assert(block.includes('view.render(parameterCounterfactualEl,semanticState.parameterCounterfactual||{})'), 'p78 does not delegate the panel');
  assert(!block.includes('document.createElement'), 'parameter DOM was duplicated inline');
});

check('browser module is static and versioned', () => {
  const source = fs.readFileSync(lib('semantic-parameter-view'), 'utf8'), sandbox = { console };
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'dynamic evaluation is forbidden');
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: lib('semantic-parameter-view') }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  assert(sandbox.MRDSemanticParameterView.version === '1.0.0', 'browser export version missing');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
