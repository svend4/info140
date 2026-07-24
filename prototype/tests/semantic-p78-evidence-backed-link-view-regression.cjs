'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts',
  'p78-local-text-index', 'p78-controlled-russian-lexicon', 'p78-claim-ir',
  'p78-linguistic-parser-adapter', 'p78-claim-structural-matcher', 'p78-evidence-contracts',
  'p78-claim-evidence-corpus', 'p78-linguistic-structure-index', 'p78-claim-evidence-cascade',
  'p78-controlled-claim-engine', 'p78-alpha-orbit-contracts', 'p78-data7-adapter',
  'p78-qualifier-direction-contracts', 'p78-evidence-backed-link-adapter',
  'p78-evidence-backed-link-projector', 'p78-evidence-backed-link-view',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const Cascade = global.MRDP78ClaimEvidenceCascade.create();
const Engine = global.MRDP78ControlledClaimEngine.create({ evidenceCascade: Cascade });
const Projector = global.MRDP78EvidenceBackedLinkProjector;
const View = global.MRDP78EvidenceBackedLinkView;
const checks = [];
const TARGET = 'Система сохраняет состояние.';

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
function allText(element) { return [element._text || '', ...element.children.map(allText)].join(' '); }
function allTags(element) { return [element.tagName, ...element.children.flatMap(allTags)]; }
function allElements(element) { return [element, ...element.children.flatMap(allElements)]; }

class FakeElement {
  constructor(tag, document) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.dataset = {};
    this.attributes = {};
    this._text = '';
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  get firstChild() { return this.children[0] || null; }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return allText(this); }
  set innerHTML(_) { throw new Error('innerHTML forbidden'); }
}
class FakeDocument { createElement(tag) { return new FakeElement(tag, this); } }

function model(targetText = TARGET) {
  const result = Engine.run(TARGET).evidenceCascade;
  return Projector.project({ targetText, cascadeResult: result, linguisticIndex: Cascade.index });
}
function render(value) {
  const document = new FakeDocument();
  const root = new FakeElement('div', document);
  View.render(root, value);
  return { document, root, text: allText(root) };
}

check('view API is frozen, passive and carries no command authority', () => {
  assert.equal(View.status, 'READY');
  assert.equal(View.version, '1.1.0');
  assert.equal(View.viewModelSchema, Projector.viewModelSchema);
  assert.equal(View.passive, true);
  assert.equal(View.hasCommands, false);
  assert.equal(View.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(View.semanticTruth, false);
  assert.equal(View.commitAllowed, false);
  assert(Object.isFrozen(View));
});

check('valid model renders exact endpoints and passage-to-target relation', () => {
  const { root, text } = render(model());
  assert.equal(root.dataset.status, 'REPLAYED');
  assert.equal(root.dataset.proposalCount, '1');
  assert.equal(root.dataset.rejectionCount, '1');
  assert.equal(root.dataset.skippedCount, '5');
  assert(text.includes('Система не сохраняет состояние.'));
  assert(text.includes(TARGET));
  assert(text.includes('REFUTES'));
  assert(text.includes('PASSAGE -> TARGET'));
  assert(text.indexOf('Система не сохраняет состояние.') < text.indexOf(TARGET));
});

check('stored proposal, performed replay, source authority and review remain separate', () => {
  const { root, text } = render(model());
  assert.equal(root.dataset.validationScope, 'REFERENTIAL_REPLAY');
  assert.equal(root.dataset.referentialReplay, 'PERFORMED');
  assert.equal(root.dataset.sourceAuthority, 'UNVERIFIED');
  assert.equal(root.dataset.relationStatus, 'PROPOSED');
  assert.equal(root.dataset.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(root.dataset.finalRelation, 'NOT_COMPUTED');
  assert.equal(root.dataset.commitAllowed, 'false');
  ['REPLAY_REQUIRED', 'PERFORMED', 'UNVERIFIED', 'REQUIRES_REVIEW', 'NOT_COMPUTED', 'false'].forEach((value) => assert(text.includes(value)));
});

check('provenance pins and bounded projection diagnostics are visible', () => {
  const value = model();
  const { text } = render(value);
  assert(text.includes(value.proposals[0].sourceSetRef.sourceSetHash));
  assert(text.includes(value.proposals[0].pins.queryHash));
  assert(text.includes(value.proposals[0].pins.linguisticIndexHash));
  assert(text.includes(value.proposals[0].pins.evidenceCandidateHash));
  assert(text.includes(value.proposals[0].pins.validatorVersion));
  assert(text.includes('SELF_LINK_FORBIDDEN'));
  assert(text.includes('STRUCTURAL_ALIGNMENT_REQUIRED'));
});

check('DOM output contains no command or executable elements', () => {
  const { root } = render(model());
  const forbidden = new Set(['BUTTON', 'A', 'SCRIPT', 'IMG', 'IFRAME', 'FORM', 'INPUT', 'SELECT', 'TEXTAREA']);
  assert(!allTags(root).some((tag) => forbidden.has(tag)));
  assert(!allElements(root).some((item) => Object.keys(item.attributes).some((name) => /^on/i.test(name))));
});

check('invalid input clears a previously valid display and fails closed', () => {
  const document = new FakeDocument();
  const root = new FakeElement('div', document);
  View.render(root, model());
  assert(allText(root).includes(TARGET));
  View.render(root, { schema: Projector.viewModelSchema });
  const text = allText(root);
  assert.equal(root.dataset.status, 'INVALID');
  assert.equal(root.dataset.proposalCount, '0');
  assert.equal(root.dataset.commitAllowed, 'false');
  assert(!text.includes(TARGET));
  assert(text.includes('INVALID'));
});

check('ABSTAIN model displays diagnostics without inventing a relation', () => {
  const value = model('Система вычисляет неизвестное состояние.');
  const { root, text } = render(value);
  assert.equal(root.dataset.status, 'ABSTAIN');
  assert.equal(root.dataset.referentialReplay, 'NOT_PERFORMED');
  assert.equal(root.dataset.proposalCount, '0');
  assert(text.includes('ABSTAIN'));
  assert(text.includes('TARGET_NOT_IN_COMMON_SOURCE'));
  assert(!text.includes('PASSAGE -> TARGET'));
});

check('render is idempotent and does not duplicate the root class', () => {
  const document = new FakeDocument();
  const root = new FakeElement('div', document);
  const value = model();
  View.render(root, value);
  View.render(root, value);
  assert.equal(root.className.split(/\s+/).filter((name) => name === 'evidenceBackedLinkView').length, 1);
  assert.equal(root.dataset.proposalCount, '1');
});

check('render uses an immutable accepted snapshot rather than mutable input after validation', () => {
  const document = new FakeDocument();
  const root = new FakeElement('div', document);
  const mutable = Canonical.deepCopy(model());
  const expected = mutable.proposals[0].target.text;
  const values = {};
  let changed = false;
  root.dataset = new Proxy(values, {
    set(target, key, value) {
      if (!changed) {
        changed = true;
        mutable.proposals[0].target.text = 'MUTATED_AFTER_VALIDATION';
      }
      target[key] = value;
      return true;
    },
  });
  View.render(root, mutable);
  assert(allText(root).includes(expected));
  assert(!allText(root).includes('MUTATED_AFTER_VALIDATION'));
});

check('malformed authority model never reaches proposal rendering', () => {
  const forged = Canonical.deepCopy(model());
  forged.proposals[0].semanticTruth = true;
  delete forged.contentHash;
  forged.contentHash = Canonical.hashCanonical(forged);
  const { root, text } = render(forged);
  assert.equal(root.dataset.status, 'INVALID');
  assert(!text.includes('PASSAGE -> TARGET'));
  assert(!text.includes(TARGET));
});

check('only the compact live status is an aria-live region', () => {
  const { root } = render(model());
  assert.equal(root.attributes['aria-live'], undefined);
  const live = allElements(root).filter((item) => item.attributes['aria-live']);
  assert.equal(live.length, 1);
  assert.equal(live[0].attributes['aria-live'], 'polite');
});

check('view source uses textContent only and has no callbacks or ambient I/O', () => {
  const source = fs.readFileSync(lib('p78-evidence-backed-link-view'), 'utf8');
  assert(source.includes('textContent'));
  assert(source.includes('snapshotViewModel'));
  assert(!/innerHTML|outerHTML|insertAdjacentHTML/.test(source));
  assert(!/addEventListener|onclick|onkeydown|requestAnimationFrame|setTimeout|setInterval/.test(source));
  assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|clipboard/.test(source));
  assert(!/\beval\s*\(|new Function/.test(source));
  assert(!/commitAllowed\s*:\s*true|semanticTruth\s*:\s*true/.test(source));
});

check('stylesheet is responsive, wrap-safe and contains no decorative gradient or animation', () => {
  const css = fs.readFileSync(path.join(rootDir, 'p78-evidence-backed-link-view.css'), 'utf8');
  assert(css.includes('container-type:inline-size'));
  assert(css.includes('@container (max-width:760px)'));
  assert(css.includes('@container (max-width:480px)'));
  assert(css.includes('overflow-wrap:anywhere'));
  assert(css.includes('unicode-bidi:plaintext'));
  assert(!/linear-gradient|radial-gradient|animation\s*:|@keyframes/.test(css));
  const radii = [...css.matchAll(/border-radius:\s*(\d+)px/g)].map((match) => Number(match[1]));
  assert(radii.length && Math.max(...radii) <= 6);
});

check('HTML loads the complete stack before runtime and places the panel between candidates and flow', () => {
  const html = fs.readFileSync(path.join(rootDir, 'p78-living-ring-interface.html'), 'utf8');
  const ids = ['controlledClaimEvidence', 'evidenceBackedLinkView', 'semanticFlowView'].map((id) => html.indexOf(`id="${id}"`));
  assert(ids[0] >= 0 && ids[0] < ids[1] && ids[1] < ids[2]);
  const scripts = [
    'p78-alpha-orbit-contracts.js', 'p78-data7-adapter.js', 'p78-qualifier-direction-contracts.js',
    'p78-evidence-backed-link-adapter.js', 'p78-evidence-backed-link-projector.js',
    'p78-evidence-backed-link-view.js', 'p78-evidence-backed-link-runner.js', 'p78-living-ring-runtime.js',
  ].map((name) => html.indexOf(name));
  assert(scripts.every((position) => position >= 0));
  assert(scripts.every((position, index) => index === 0 || scripts[index - 1] < position));
  assert(html.includes('p78-evidence-backed-link-view.css?v=1.1.0'));
  assert(html.includes('p78-linguistic-parser-adapter.js?v=1.1.0'));
  assert(html.includes('p78-evidence-backed-link-adapter.js?v=1.4.0'));
  assert(html.includes('p78-evidence-backed-link-projector.js?v=1.1.0'));
  assert(html.includes('p78-evidence-backed-link-view.js?v=1.1.0'));
  assert(html.includes('p78-evidence-backed-link-runner.js?v=1.0.0'));
  assert(html.includes('p78-living-ring-runtime.js?v=1.10.0'));
});

check('runtime projects only from explicit claim render and keeps flow failure-isolated', () => {
  const source = fs.readFileSync(lib('p78-living-ring-runtime'), 'utf8');
  const claimStart = source.indexOf('function renderControlledClaim()');
  const claimEnd = source.indexOf('function applyCondition()', claimStart);
  const claimBody = source.slice(claimStart, claimEnd);
  assert(claimBody.includes('renderEvidenceBackedLink(semanticState.claimTrace)'));
  assert(source.includes('EvidenceBackedLinkRunner.create({'));
  assert(source.includes('evidenceBackedLinkRunner.project({'));
  assert(source.includes("workerUrl:'lib/p78-evidence-backed-link-worker.js?v=1.0.0'"));
  assert(source.includes('EvidenceBackedLinkView.render(evidenceBackedLinkEl,outcome.model)'));
  assert(!source.includes('EvidenceBackedLinkProjector.project({'));
  assert(!source.slice(source.indexOf('function frame('), source.indexOf('requestAnimationFrame(frame)')).includes('renderEvidenceBackedLink'));
  assert(claimBody.includes('renderSemanticFlow(semanticState.claimTrace)'));
});

for (const item of checks) {
  process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? `\n${item.detail}` : ''}\n`);
}
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
process.exitCode = passed === checks.length ? 0 : 1;
