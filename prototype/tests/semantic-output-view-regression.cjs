'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixture = require('./p78-fixture.cjs');

const lib = path.join(__dirname, '..', 'lib', 'semantic-output-view.js');
global.window = global;
require(lib);
const view = global.MRDSemanticOutputView;

class FakeNode {
  constructor(tag, doc) {
    this.tagName = tag;
    this.ownerDocument = doc;
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.textContent = '';
    this.type = '';
    this.disabled = false;
    this.onclick = null;
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
  get firstChild() { return this.children[0] || null; }
}
class FakeDocument {
  createElement(tag) { return new FakeNode(tag, this); }
}
function root() { const doc = new FakeDocument(); return new FakeNode('div', doc); }
function walk(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  node.children.forEach((child) => walk(child, predicate, out));
  return out;
}
function classes(node, name) { return walk(node, (item) => item.className.split(/\s+/).includes(name)); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

assert(view && typeof view.renderText === 'function' && typeof view.renderMenu === 'function', 'output view API is incomplete');

check('text pack renders rows and observed projection', () => {
  const host = root();
  const pack = { status: 'continue', title: 'result', formula: 'forecast + observed', summary: 'alive', outputLine: 'continue', observedLine: 't4 R_CATALYZE', insertLine: 'insert', rows: [{ label: 'guard', value: 'safe', score: .95 }, { label: 'observed', value: 't4', score: .43 }] };
  const result = view.renderText(host, pack, {});
  assert(result.rows === 2 && result.observed && result.actionable, 'render metadata mismatch');
  assert(classes(host, 'resultRow').length === 2 && classes(host, 'observed').length === 1, 'rendered structure mismatch');
});

check('text callbacks receive the exact pack', () => {
  const host = root(), pack = { insertLine: 'line', rows: [] };
  let refreshed = null, applied = null;
  view.renderText(host, pack, { onRefresh: (value) => { refreshed = value; }, onApply: (value) => { applied = value; } });
  const buttons = walk(host, (item) => item.tagName === 'button');
  buttons[0].onclick(); buttons[1].onclick();
  assert(refreshed === pack && applied === pack, 'callback identity changed');
});

check('rerender clears stale observation and disables absent insertion', () => {
  const host = root();
  view.renderText(host, { observedLine: 'old', insertLine: 'old', rows: [] }, {});
  view.renderText(host, { outputLine: 'new', rows: [] }, {});
  const buttons = walk(host, (item) => item.tagName === 'button');
  assert(classes(host, 'observed').length === 0 && buttons[1].disabled, 'stale or unsafe state remains');
});

check('menu preserves item kind, score and callback identity', () => {
  const host = root(), observed = { id: 'observed', kind: 'observed', label: 'observed', text: 't8', score: .43, insertLine: 't8' };
  let selected = null;
  const result = view.renderMenu(host, { status: 'continue', items: [observed] }, { onApplyItem: (item) => { selected = item; } });
  const button = walk(host, (item) => item.tagName === 'button')[0];
  button.onclick();
  assert(result.items === 1 && result.actionable === 1 && classes(host, 'observed').length === 1, 'menu structure mismatch');
  assert(selected === observed && walk(host, (item) => item.tagName === 'i')[0].textContent === '0.43', 'menu payload changed');
});

check('empty menu has no command', () => {
  const host = root(), result = view.renderMenu(host, { status: 'empty', summary: 'empty', items: [] }, {});
  assert(result.items === 0 && walk(host, (item) => item.tagName === 'button').length === 0, 'empty menu is actionable');
});

check('p78 delegates both renderers and removes legacy item builder', () => {
  const { html, runtime } = fixture;
  assert(html.includes('lib/semantic-output-view.js?v=1.0.0'), 'view script missing');
  assert(html.includes('lib/text-result.js?v=1.13.0'), 'text result script version is stale');
  const text = runtime.slice(runtime.indexOf('function renderTextResult()'), runtime.indexOf('function applyTextResult()'));
  const menu = runtime.slice(runtime.indexOf('function renderOutputMenu()'), runtime.indexOf('function semanticActionCode('));
  assert(text.includes('view.renderText') && !text.includes('document.createElement'), 'text DOM remains inline');
  assert(menu.includes('view.renderMenu') && !menu.includes('document.createElement'), 'menu DOM remains inline');
  assert(!runtime.includes('function renderOutputItem('), 'legacy item renderer remains');
});

check('browser IIFE is static and export is versioned', () => {
  const source = fs.readFileSync(lib, 'utf8'), sandbox = { console };
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'dynamic evaluation is forbidden');
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: lib }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  assert(sandbox.MRDSemanticOutputView.version === '1.0.0', 'browser export missing');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
