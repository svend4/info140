'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p78 = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const modules = ['semantic-core', 'semantic-reaction-rules', 'semantic-reaction-field', 'semantic-trace-continuation', 'semantic-trace-view'];
global.window = global;
modules.forEach((name) => require(lib(name)));

const core = global.MRDSemanticCore;
const field = global.MRDSemanticReactionField;
const composer = global.MRDSemanticTraceContinuation;
const view = global.MRDSemanticTraceView;
const ARTICLE = 'Продолжить статью: город учится беречь воду, но жители спорят о цене. Нужны общий смысл, факты и следующий проверяемый шаг.';

function assert(condition, message) { if (!condition) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function particlesFor(analysis, offset = 100) {
  return analysis.tokens.map((token, index) => ({ id: offset + index, tokenIndex: index, label: token, x: 100 + index * 23, y: 160 + (index % 4) * 31 }));
}
function snapshot(events) {
  return {
    version: 'fixture', kind: 'MRDSemanticReactionRuntimeSnapshot', origin: 'observed', status: 'FIRED', tick: events.length,
    nodes: [{ id: 'n0' }], metrics: { minU: .27, maxU: .73 }, history: events, lastEvents: events.slice(-1),
    evidence: 'STRUCTURAL', evidenceLevel: 'STRUCTURAL', soundness: 'NOT_COMPUTED',
  };
}
function observedEvent(id, parentEventId, sourceId, targetId, sourceTokenIndex, targetTokenIndex, sourceToken, targetToken, tick) {
  return {
    origin: 'observed', eventId: id, parentEventId, tick, generation: tick, ruleId: tick === 1 ? 'R_CATALYZE' : 'R_FRAGMENT',
    direction: tick === 1 ? 'orbit' : 'detail', selectionReason: tick === 1 ? 'source:seed' : 'source:fragment',
    sourceId, targetId, sourceTokenIndex, targetTokenIndex, sourceToken, targetToken, force: .66, threshold: .28,
    evidence: 'STRUCTURAL', evidenceLevel: 'STRUCTURAL', soundness: 'NOT_COMPUTED',
  };
}

class FakeContext {
  constructor() { this.calls = []; }
  save() { this.calls.push(['save']); }
  restore() { this.calls.push(['restore']); }
  setLineDash(value) { this.calls.push(['dash', value.slice()]); }
  beginPath() { this.calls.push(['begin']); }
  moveTo(x, y) { this.calls.push(['move', x, y]); }
  lineTo(x, y) { this.calls.push(['line', x, y]); }
  quadraticCurveTo(cx, cy, x, y) { this.calls.push(['curve', cx, cy, x, y]); }
  arc(x, y, r) { this.calls.push(['arc', x, y, r]); }
  stroke() { this.calls.push(['stroke']); }
  fill() { this.calls.push(['fill']); }
  fillText(value, x, y) { this.calls.push(['text', String(value), x, y]); }
}

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

assert(core && field && composer && view, 'semantic trace view stack is incomplete');
const analysis = core.analyzeText(ARTICLE);
const reaction = field.simulate(analysis, .5);
const continuation = composer.compose({ text: ARTICLE, analysis, rails: core.semanticRails(ARTICLE), reaction });
const particles = particlesFor(analysis);
const overlay = view.build(continuation, particles);

check('READY continuation exposes exact token indices for all witnesses', () => {
  assert(continuation.status === 'READY', `continuation=${continuation.status}`);
  ['topic', 'bridge', 'detail'].forEach((slot) => assert(Number.isInteger(continuation.witnesses[slot].tokenIndex), `${slot} tokenIndex missing`));
  assert(continuation.witnesses.topic.tokenIndex !== continuation.witnesses.bridge.tokenIndex, 'topic and bridge share an index');
  return continuation.sentence;
});

check('overlay maps three distinct witnesses and the forecast causal path', () => {
  assert(overlay.status === 'READY' && overlay.contract.pre.ok && overlay.contract.inv.ok && overlay.contract.post.ok, `overlay=${overlay.status}`);
  assert(overlay.metrics.mappedWitnesses === 3 && overlay.metrics.mappedEdges === continuation.trace.length, 'mapping counts are incomplete');
  assert(new Set(overlay.witnesses.map((item) => item.particleId)).size === 3, 'witness particles are not distinct');
  overlay.edges.forEach((edge) => assert(edge.mapped && edge.sourceParticleId !== edge.targetParticleId, `edge ${edge.eventId} is unmapped`));
});

check('observed event ids take precedence over token representatives', () => {
  const cityIndex = analysis.tokens.indexOf('город'), articleIndex = analysis.tokens.indexOf('статью'), factIndex = analysis.tokens.indexOf('факты');
  const events = [
    observedEvent('obs/e1', null, 900, 901, cityIndex, articleIndex, 'город', 'статью', 1),
    observedEvent('obs/e2', 'obs/e1', 901, 902, articleIndex, factIndex, 'статью', 'факты', 2),
  ];
  const observed = composer.compose({ text: ARTICLE, analysis, rails: core.semanticRails(ARTICLE), reaction, observed: snapshot(events) });
  const exactParticles = particles.concat([
    { id: 900, tokenIndex: cityIndex, label: 'город', x: 310, y: 280 },
    { id: 901, tokenIndex: articleIndex, label: 'статью', x: 380, y: 240 },
    { id: 902, tokenIndex: factIndex, label: 'факты', x: 440, y: 300 },
  ]);
  const result = view.build(observed, exactParticles);
  assert(result.status === 'READY' && result.origin === 'observed', `status=${result.status}`);
  assert(result.edges[0].sourceParticleId === 900 && result.edges[0].targetParticleId === 901, 'first observed ids were replaced');
  assert(result.edges[1].sourceParticleId === 901 && result.edges[1].targetParticleId === 902, 'second observed ids were replaced');
});

check('mapping is deterministic and does not mutate semantic or particle input', () => {
  const before = JSON.stringify({ continuation, particles });
  const repeated = view.build(continuation, particles);
  assert(JSON.stringify(repeated) === JSON.stringify(clone(overlay)), 'same trace produced a different overlay');
  assert(JSON.stringify({ continuation, particles }) === before, 'build mutated its input');
  assert(repeated.overlayHash === overlay.overlayHash && repeated.traceHash === continuation.hashes.trace, 'overlay identity changed');
});

check('missing witness particle produces PARTIAL instead of a false READY', () => {
  const detailIndex = continuation.witnesses.detail.tokenIndex;
  const incomplete = view.build(continuation, particles.filter((particle) => particle.tokenIndex !== detailIndex));
  assert(incomplete.status === 'PARTIAL' && incomplete.code === 'TRACE_VIEW_MAPPING_INCOMPLETE', `status=${incomplete.status}`);
  assert(incomplete.metrics.mappedWitnesses === 2 && !incomplete.contract.post.ok, 'partial mapping overstated completion');
});

check('ABSTAIN continuation creates no active edge or witness overlay', () => {
  const abstain = composer.compose({ text: 'Круг.', analysis: core.analyzeText('Круг.') });
  const result = view.build(abstain, particles);
  assert(result.status === 'ABSTAIN' && result.code === 'TRACE_SOURCE_THIN', `status=${result.status}`);
  assert(result.metrics.mappedWitnesses === 0 && result.metrics.mappedEdges === 0 && result.contract.post.ok, 'abstain emitted active graphics');
});

check('painter renders bounded causal curves, three slot markers and status', () => {
  const ctx = new FakeContext(), byId = new Map(particles.map((particle) => [String(particle.id), particle]));
  const before = JSON.stringify(overlay);
  const result = view.paint(ctx, overlay, { resolveParticle: (id) => byId.get(String(id)), projectParticle: (particle) => ({ x: particle.x, y: particle.y }), tick: 37, bounds: { width: 1080, height: 690, cx: 484, cy: 348 } });
  const texts = ctx.calls.filter((call) => call[0] === 'text').map((call) => call[1]);
  assert(result.status === 'READY' && result.witnessesPainted === 3 && result.edgesPainted === overlay.metrics.mappedEdges, 'paint counts differ from overlay');
  assert(ctx.calls.some((call) => call[0] === 'curve') && ctx.calls.some((call) => call[0] === 'dash' && call[1].length > 0), 'forecast causal path style missing');
  ['Т', 'М', 'Д'].forEach((label) => assert(texts.includes(label), `marker ${label} missing`));
  assert(texts.some((text) => text.includes('TRACE · FC')), 'overlay status label missing');
  assert(JSON.stringify(overlay) === before, 'paint mutated overlay state');
});

check('ABSTAIN painter shows status only', () => {
  const ctx = new FakeContext(), abstain = view.build(composer.compose({ text: 'Круг.', analysis: core.analyzeText('Круг.') }), particles);
  const result = view.paint(ctx, abstain, { tick: 1, bounds: { width: 1080, height: 690 } });
  const texts = ctx.calls.filter((call) => call[0] === 'text').map((call) => call[1]);
  assert(result.status === 'ABSTAIN' && result.edgesPainted === 0 && result.witnessesPainted === 0, 'abstain painted causal geometry');
  assert(texts.some((text) => text.includes('TRACE · ABSTAIN · TRACE_SOURCE_THIN')), 'abstain status is invisible');
});

check('overlay preserves structural evidence boundary', () => {
  assert(overlay.evidenceLevel === 'STRUCTURAL' && overlay.soundness === 'NOT_COMPUTED', 'overlay overstated evidence');
  assert(overlay.kind === 'MRDSemanticTraceOverlay' && overlay.version === '1.0.0', 'overlay schema identity missing');
});

check('p78 loads, refreshes, exposes and paints the cached overlay', () => {
  const { html, runtime } = p78;
  const continuationIndex = html.indexOf('lib/semantic-trace-continuation.js?v=1.2.0');
  const viewIndex = html.indexOf('lib/semantic-trace-view.js?v=1.0.0');
  const textIndex = html.indexOf('lib/text-result.js?v=1.13.0');
  assert(continuationIndex >= 0 && continuationIndex < viewIndex && viewIndex < textIndex, 'trace view dependency order is wrong');
  ['function updateSemanticTraceOverlay()', 'view.build(continuation,worldState.drops)', 'canvas.dataset.traceStatus', 'canvas.dataset.traceWitnesses', 'canvas.dataset.traceEdges', 'canvas.dataset.traceHash', 'function rebuildSemanticTraceParticleLookup()', 'function drawSemanticTraceOverlay()', 'resolveParticle:traceParticleResolve', 'drawDrops(); drawSemanticTraceOverlay(); drawCore()'].forEach((needle) => assert(runtime.includes(needle), `p78 overlay integration missing: ${needle}`));
});

check('browser IIFE is static and versioned', () => {
  const source = fs.readFileSync(lib('semantic-trace-view'), 'utf8'), sandbox = { console };
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'dynamic evaluation is forbidden');
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: lib('semantic-trace-view') }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  assert(sandbox.MRDSemanticTraceView.version === '1.0.0', 'browser export version missing');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
