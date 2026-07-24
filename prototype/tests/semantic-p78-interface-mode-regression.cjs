'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lib = path.join(__dirname, '..', 'lib', 'p78-interface-mode.js');
const source = fs.readFileSync(lib, 'utf8');

class FakeClassList {
  constructor(node) { this.node = node; }
  values() { return this.node.className.split(/\s+/).filter(Boolean); }
  contains(name) { return this.values().includes(name); }
  toggle(name, force) {
    const values = this.values().filter((value) => value !== name);
    const on = force === undefined ? !this.contains(name) : Boolean(force);
    if (on) values.push(name);
    this.node.className = values.join(' ');
    return on;
  }
}

class FakeNode {
  constructor(tag, doc, data = {}) {
    this.tagName = tag;
    this.ownerDocument = doc;
    this.parentNode = null;
    this.children = [];
    this.dataset = { ...data };
    this.attributes = {};
    this.className = '';
    this.classList = new FakeClassList(this);
    this.hidden = false;
    this.listeners = new Map();
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  querySelectorAll(selector) {
    const key = selector === '[data-mode]' ? 'mode' : selector === '[data-surface]' ? 'surface' : null;
    const found = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (key && Object.prototype.hasOwnProperty.call(child.dataset, key)) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const values = this.listeners.get(type) || [];
    this.listeners.set(type, values.filter((value) => value !== listener));
  }
  dispatch(type, extra = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...extra,
    };
    (this.listeners.get(type) || []).slice().forEach((listener) => listener(event));
    return event;
  }
  focus() { this.ownerDocument.activeElement = this; }
}

class FakeDocument {
  constructor() { this.activeElement = null; }
  node(tag, data) { return new FakeNode(tag, this, data); }
}

function fixture() {
  const document = new FakeDocument();
  const root = document.node('div');
  const flowButton = root.appendChild(document.node('button', { mode: 'flow' }));
  const analysisButton = root.appendChild(document.node('button', { mode: 'analysis' }));
  const flow = root.appendChild(document.node('section', { surface: 'flow' }));
  const analysis = root.appendChild(document.node('section', { surface: 'analysis' }));
  const shared = root.appendChild(document.node('section', { surface: 'shared' }));
  const unknown = root.appendChild(document.node('section', { surface: 'unknown' }));
  return { document, root, flowButton, analysisButton, flow, analysis, shared, unknown };
}

function load() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: lib }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  return sandbox.MRDP78InterfaceMode;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

const api = load();

check('classic IIFE exports the versioned passive API', () => {
  assert(api && api.version === '1.0.0', 'versioned export missing');
  assert(typeof api.create === 'function' && api.create.length === 1, 'create(root) missing');
  assert(typeof api.visible === 'function' && api.visible.length === 2, 'visible(surface, mode) missing');
  const instance = api.create(fixture().root);
  ['select', 'snapshot', 'destroy'].forEach((name) => assert(typeof instance[name] === 'function', `${name} missing`));
});

check('visible is a closed flow-analysis truth table', () => {
  assert(api.visible('flow', 'flow'), 'flow surface is hidden in flow mode');
  assert(api.visible('analysis', 'analysis'), 'analysis surface is hidden in analysis mode');
  assert(api.visible('shared', 'flow') && api.visible('shared', 'analysis'), 'shared surface is not shared');
  ['analysis', 'unknown', '', null].forEach((surface) => assert(!api.visible(surface, 'flow'), `surface ${surface} leaked in flow mode`));
  ['flow', 'unknown', '', null].forEach((surface) => assert(!api.visible(surface, 'analysis'), `surface ${surface} leaked in analysis mode`));
  ['unknown', '', null, undefined].forEach((mode) => assert(!api.visible('shared', mode), `shared leaked for mode ${mode}`));
});

check('create defaults to flow and projects only DOM state', () => {
  const view = fixture();
  const childIdentities = view.root.children.slice();
  const controller = api.create(view.root);
  assert(view.root.dataset.mode === 'flow', 'root mode is not flow');
  assert(!view.flow.hidden && view.analysis.hidden && !view.shared.hidden && view.unknown.hidden, 'flow visibility mismatch');
  assert(view.flowButton.getAttribute('aria-pressed') === 'true' && view.flowButton.classList.contains('on'), 'flow button is not on');
  assert(view.analysisButton.getAttribute('aria-pressed') === 'false' && !view.analysisButton.classList.contains('on'), 'analysis button is on');
  assert(view.root.children.length === childIdentities.length && view.root.children.every((node, index) => node === childIdentities[index]), 'controller changed DOM structure');
  const state = controller.snapshot();
  assert(state.version === '1.0.0' && state.mode === 'flow' && Object.isFrozen(state), 'initial snapshot mismatch');
});

check('select switches projections and rejects unsupported modes', () => {
  const view = fixture();
  const controller = api.create(view.root);
  assert(controller.select('analysis') === true, 'analysis selection rejected');
  assert(view.root.dataset.mode === 'analysis', 'root mode did not change');
  assert(view.flow.hidden && !view.analysis.hidden && !view.shared.hidden && view.unknown.hidden, 'analysis visibility mismatch');
  assert(view.flowButton.getAttribute('aria-pressed') === 'false' && !view.flowButton.classList.contains('on'), 'flow button stayed on');
  assert(view.analysisButton.getAttribute('aria-pressed') === 'true' && view.analysisButton.classList.contains('on'), 'analysis button is not on');
  assert(controller.select('unsupported') === false, 'unsupported mode was accepted');
  assert(controller.snapshot().mode === 'analysis' && view.root.dataset.mode === 'analysis' && view.unknown.hidden, 'unsupported mode changed state');
});

check('click selects the exact button mode', () => {
  const view = fixture();
  const controller = api.create(view.root);
  view.analysisButton.dispatch('click');
  assert(controller.snapshot().mode === 'analysis', 'analysis click did not select analysis');
  view.flowButton.dispatch('click');
  assert(controller.snapshot().mode === 'flow', 'flow click did not select flow');
});

check('arrow, Home and End keys select, wrap and focus', () => {
  const view = fixture();
  const controller = api.create(view.root);
  let event = view.flowButton.dispatch('keydown', { key: 'ArrowRight' });
  assert(event.defaultPrevented && controller.snapshot().mode === 'analysis' && view.document.activeElement === view.analysisButton, 'ArrowRight mismatch');
  event = view.analysisButton.dispatch('keydown', { key: 'ArrowRight' });
  assert(event.defaultPrevented && controller.snapshot().mode === 'flow' && view.document.activeElement === view.flowButton, 'ArrowRight did not wrap');
  event = view.flowButton.dispatch('keydown', { key: 'ArrowLeft' });
  assert(event.defaultPrevented && controller.snapshot().mode === 'analysis' && view.document.activeElement === view.analysisButton, 'ArrowLeft did not wrap');
  event = view.analysisButton.dispatch('keydown', { key: 'Home' });
  assert(event.defaultPrevented && controller.snapshot().mode === 'flow' && view.document.activeElement === view.flowButton, 'Home mismatch');
  event = view.flowButton.dispatch('keydown', { key: 'End' });
  assert(event.defaultPrevented && controller.snapshot().mode === 'analysis' && view.document.activeElement === view.analysisButton, 'End mismatch');
  event = view.analysisButton.dispatch('keydown', { key: 'Enter' });
  assert(!event.defaultPrevented && controller.snapshot().mode === 'analysis', 'unhandled key changed mode');
});

check('destroy is idempotent and leaves the controller inert', () => {
  const view = fixture();
  const controller = api.create(view.root);
  assert(controller.destroy() === true && controller.destroy() === false, 'destroy is not idempotent');
  view.analysisButton.dispatch('click');
  view.flowButton.dispatch('keydown', { key: 'ArrowLeft' });
  assert(controller.select('analysis') === false, 'destroyed controller accepted selection');
  assert(controller.snapshot().mode === 'flow' && view.root.dataset.mode === 'flow', 'destroyed controller changed state');
  assert((view.flowButton.listeners.get('click') || []).length === 0 && (view.flowButton.listeners.get('keydown') || []).length === 0, 'flow listeners remain');
  assert((view.analysisButton.listeners.get('click') || []).length === 0 && (view.analysisButton.listeners.get('keydown') || []).length === 0, 'analysis listeners remain');
});

check('source has no semantic hooks, persistence, insertion, network or dynamic evaluation', () => {
  const hazards = [
    [/\b(?:eval)\s*\(|\bnew\s+Function\b/, 'dynamic evaluation'],
    [/\b(?:localStorage|sessionStorage|indexedDB)\b/, 'storage'],
    [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/, 'network'],
    [/\b(?:createElement|appendChild|insertBefore|insertAdjacentHTML|innerHTML)\b/, 'DOM insertion'],
    [/\b(?:onSemantic|semanticCallback|onModeChange|onChange)\b/i, 'semantic callback'],
  ];
  hazards.forEach(([pattern, label]) => assert(!pattern.test(source), `${label} is forbidden`));
});

check('invalid roots fail before any DOM work', () => {
  [null, {}, { querySelectorAll: null }].forEach((root) => {
    let error = null;
    try { api.create(root); } catch (value) { error = value; }
    assert(error && error.message === 'P78_INTERFACE_MODE_ROOT_REQUIRED', 'invalid root did not fail closed');
  });
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
