'use strict';

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts', 'p78-controlled-russian-lexicon',
  'p78-claim-ir', 'p78-linguistic-parser-adapter', 'p78-claim-structural-matcher',
  'p78-controlled-claim-engine', 'p78-evidence-contracts', 'p78-claim-view', 'p78-claim-adapter',
].forEach((name) => require(lib(name)));

const Engine = global.MRDP78ControlledClaimEngine;
const View = global.MRDP78ClaimView;
const Adapter = global.MRDP78ClaimAdapter;

function assert(condition, message) { if (!condition) throw new Error(message); }
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
    this.value = '';
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  get firstChild() { return this.children[0] || null; }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return allText(this); }
}
class FakeDocument { createElement(tag) { return new FakeElement(tag, this); } }

const checks = [];
function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

const document = new FakeDocument();
const root = new FakeElement('div', document);
const input = new FakeElement('input', document);
input.value = 'Система сохраняет состояние.';
const engine = Engine.create();
const adapter = Adapter.create({ engine, view: View, root, input });

check('engine and adapter expose frozen passive APIs', () => {
  assert(Engine.status === 'READY' && engine.status === 'READY', 'claim engine unavailable');
  assert(Adapter.version === '1.0.0' && adapter.version === '1.0.0', 'adapter version');
  assert(Object.isFrozen(Engine) && Object.isFrozen(engine) && Object.isFrozen(Adapter) && Object.isFrozen(adapter), 'mutable API');
check('optional evidence contracts bind when loaded after the engine module', () => {
  const lateCascade = Object.freeze({
    status: 'READY',
    identity: Object.freeze({ linguisticIndexHash: null }),
    run() { throw new Error('not called by factory'); },
  });
  const lateBoundEngine = Engine.create({ evidenceCascade: lateCascade });
  assert(lateBoundEngine.status === 'READY', 'late evidence dependency did not bind');
});

});

check('default input renders structure, match and evidence boundary', () => {
  const result = adapter.render();
  const rendered = allText(root);
  assert(result.status === 'READY' && result.resolutionStatus === 'RESOLVED', 'default claim unresolved');
  assert(result.structuralMatches.length === 1, 'default pattern missing');
  assert(result.structuralMatches[0].patternRef.patternId === 'p78:pattern:claim.preserve.positive', 'wrong default pattern');
  ['CLAIM РАЗОБРАН', 'RESOLVED', 'сохранять', 'AGENT', 'THEME', 'STRUCTURAL_MATCH', 'NOT_COMPUTED', 'REQUIRES_REVIEW', 'ABSTAIN']
    .forEach((needle) => assert(rendered.includes(needle), `render missing ${needle}`));
  assert(root.dataset.status === 'READY' && root.dataset.resolution === 'RESOLVED', 'render status data absent');
  assert(root.dataset.traceHash === result.traceHash, 'trace identity absent');
  assert(adapter.current() === result, 'current result differs');
});

check('negation changes the trace and selects only the negative pattern', () => {
  const previous = adapter.current();
  input.value = 'Система не сохраняет состояние.';
  const result = adapter.render();
  assert(result.traceHash !== previous.traceHash, 'trace did not change');
  assert(result.claimAst.polarity === 'NEGATIVE', 'negative polarity lost');
  assert(result.structuralMatches.length === 1, 'negative pattern count');
  assert(result.structuralMatches[0].patternRef.patternId === 'p78:pattern:claim.preserve.negative', 'negative pattern missing');
});

check('ambiguity remains visible and cannot reach a structural match', () => {
  input.value = 'Система описывает движение.';
  const result = adapter.render();
  const rendered = allText(root);
  assert(result.status === 'AMBIGUOUS' && result.resolutionStatus === 'AMBIGUOUS', 'ambiguity hidden');
  assert(result.structuralMatches.length === 0, 'ambiguous claim matched');
  ['CLAIM ОСТАНОВЛЕН', 'AMBIGUOUS', 'STRUCTURAL_MATCH · 0', 'NOT_COMPUTED', 'ABSTAIN']
    .forEach((needle) => assert(rendered.includes(needle), `ambiguity render missing ${needle}`));
});

check('OOV remains visible and never invents a sense', () => {
  input.value = 'Система сохраняет квантовыйпирог.';
  const result = adapter.render();
  assert(result.status === 'OOV' && result.resolutionStatus === 'OOV', 'OOV hidden');
  assert(result.structuralMatches.length === 0, 'OOV claim matched');
  assert(!JSON.stringify(result).includes('p78:sense:квантовыйпирог'), 'invented OOV sense');
  assert(allText(root).includes('OOV'), 'OOV not rendered');
});

check('HTML loads Claim dependencies in strict order before runtime', () => {
  const html = fs.readFileSync(path.join(rootDir, 'p78-living-ring-interface.html'), 'utf8');
  const order = [
    'lib/semantic-language.js', 'lib/p78-canonical-json.js', 'lib/p78-search-contracts.js',
    'lib/p78-controlled-russian-lexicon.js', 'lib/p78-claim-ir.js', 'lib/p78-linguistic-parser-adapter.js',
    'lib/p78-claim-structural-matcher.js', 'lib/p78-controlled-claim-engine.js', 'lib/p78-local-text-index.js',
    'lib/p78-evidence-contracts.js', 'lib/p78-claim-evidence-corpus.js', 'lib/p78-linguistic-structure-index.js',
    'lib/p78-claim-evidence-cascade.js', 'lib/p78-claim-view.js', 'lib/p78-evidence-candidate-view.js',
    'lib/p78-claim-adapter.js', 'lib/p78-living-ring-runtime.js',
  ];
  order.forEach((source) => assert(html.includes(`${source}?v=`), `${source} absent or unversioned`));
  for (let index = 1; index < order.length; index += 1) {
    assert(html.indexOf(order[index - 1]) < html.indexOf(order[index]), `${order[index - 1]} must precede ${order[index]}`);
  }
  ['controlledClaimInput', 'controlledClaimRun', 'controlledClaimTrace', 'controlledClaimEvidence'].forEach((id) => assert(html.includes(`id="${id}"`), `${id} absent`));
  assert(html.includes('p78-claim-view.css?v=1.0.0'), 'claim stylesheet absent');
  assert(html.includes('p78-evidence-candidate-view.css?v=1.0.1'), 'evidence stylesheet absent');
  assert(html.includes('p78-living-ring-runtime.js?v=1.10.0'), 'runtime version stale');
});

check('runtime binds local diagnostics without semantic commit authority', () => {
  const runtime = fs.readFileSync(lib('p78-living-ring-runtime'), 'utf8');
  assert(runtime.includes('var claimEvidenceCascade=null'), 'optional evidence cascade state absent');
  assert(runtime.includes('claimEvidenceCascade=ClaimEvidenceCascade.create();'), 'evidence cascade creation absent');
  assert(runtime.includes('ControlledClaimEngine.create(claimEvidenceCascade?{evidenceCascade:claimEvidenceCascade}:undefined)'), 'claim engine fallback absent');
  assert(runtime.includes('semanticState.claimTrace=controlledClaimAdapter.render();'), 'claim result not retained');
  assert(runtime.includes('controlledClaimRun.onclick=renderControlledClaim;'), 'claim command not bound');
  assert(runtime.includes("controlledClaimInput.addEventListener('keydown'"), 'claim Enter binding absent');
  assert(runtime.includes('EvidenceCandidateView.render(controlledClaimEvidenceEl'), 'evidence view not rendered');
  assert(runtime.includes('resolveClaimEvidenceText'), 'exact source resolver absent');
  const passive = ['p78-claim-view', 'p78-claim-adapter', 'p78-evidence-candidate-view', 'p78-claim-evidence-cascade'].map((name) => fs.readFileSync(lib(name), 'utf8')).join('\n');
  assert(runtime.includes("if(interfaceMode.snapshot().mode==='analysis') renderControlledClaim(); else semanticState.claimTrace=null;"), 'hidden diagnostics are computed eagerly');
  assert(runtime.includes("analysisModeBtn.addEventListener('click'"), 'analysis mode lazy render absent');
  assert(runtime.includes('passage.locator.sentenceIndex===request.locator.sentenceIndex'), 'sentence locator pin absent');
  assert(!runtime.includes("throw new Error('P78_CLAIM_EVIDENCE"), 'optional evidence diagnostics became mandatory');
  assert(!runtime.includes("throw new Error('P78_EVIDENCE_CANDIDATE_VIEW"), 'optional evidence view became mandatory');
  assert(!/commitSemanticAction|actionController|executePortal/.test(passive), 'claim UI gained commit authority');
});

check('claim controls and diagnostic layers have stable responsive geometry', () => {
  const css = fs.readFileSync(path.join(rootDir, 'p78-claim-view.css'), 'utf8');
  [
    'container-type:inline-size', 'grid-template-columns:minmax(0,1fr) auto',
    'grid-template-columns:repeat(2,minmax(0,1fr))', '@container (max-width:520px)',
    '@media (max-width:680px)', 'min-width:0', 'overflow-wrap:anywhere',
  ].forEach((needle) => assert(css.includes(needle), `CSS contract missing: ${needle}`));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;

