'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p78 = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const modules = ['semantic-core', 'semantic-reaction-rules', 'semantic-reaction-field', 'semantic-reaction-field-view', 'text-result'];
global.window = global;
modules.forEach((name) => require(lib(name)));

const engine = global.MRDSemanticReactionField;
const textResult = global.MRDTextResult;
const SOURCE = '\u0421\u043c\u044b\u0441\u043b \u0441\u043f\u043e\u0440\u0438\u0442 \u0441 \u0448\u0443\u043c\u043e\u043c, \u0430 \u043c\u043e\u0441\u0442 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435.';
const GENERALIZE = '\u041e\u0431\u043e\u0431\u0449\u0438\u0442\u044c \u0434\u0435\u0442\u0430\u043b\u0438 \u0438 \u0441\u043e\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u043a\u0442\u044b \u0432 \u0433\u043b\u0430\u0432\u043d\u044b\u0439 \u0442\u0435\u0437\u0438\u0441.';
const DETAIL = '\u0420\u0430\u0437\u0431\u0438\u0442\u044c \u0441\u043b\u043e\u0432\u043e \u043d\u0430 \u0431\u0443\u043a\u0432\u044b, \u0441\u043b\u043e\u0433\u0438 \u0438 \u0434\u0435\u0442\u0430\u043b\u0438.';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collect(root, names, out = [], seen = new Set()) {
  if (!root || typeof root !== 'object' || seen.has(root)) return out;
  seen.add(root);
  for (const [key, value] of Object.entries(root)) {
    if (names.includes(key) && typeof value === 'string') out.push(value);
    if (value && typeof value === 'object') collect(value, names, out, seen);
  }
  return out;
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

assert(engine, 'MRDSemanticReactionField export is missing');
assert(typeof engine.simulate === 'function' && typeof engine.windowAt === 'function', 'reaction field API is incomplete');

const central = engine.simulate(SOURCE, 0.5);

check('particles are heterogeneous with exactly one trigger', () => {
  const roles = new Set(central.particles.map((particle) => particle.reactionRole));
  assert(roles.size >= 4, `expected >=4 reaction roles, got ${[...roles].join(',')}`);
  assert(central.particles.filter((particle) => particle.reactionRole === 'seed').length === 1, 'trigger seed is not unique');
  assert(central.trigger && central.trigger.token === '\u043c\u043e\u0441\u0442', `unexpected trigger=${central.trigger && central.trigger.token}`);
});

check('central lambda creates a bounded causal chain', () => {
  assert(central.status === 'critical', `status=${central.status}`);
  assert(central.metrics.depth === 3 && central.events.length === 3, `depth/events=${central.metrics.depth}/${central.events.length}`);
  for (let index = 0; index < central.events.length - 1; index += 1) {
    assert(central.events[index].targetId === central.events[index + 1].sourceId, `causal link ${index} is broken`);
  }
  assert(central.gamma === 1, `gamma=${central.gamma}`);
});

check('simulation is deterministic', () => {
  const repeated = engine.simulate(SOURCE, 0.5);
  assert(JSON.stringify(repeated) === JSON.stringify(clone(central)), 'same input/lambda produced a different field');
});

check('lambda window damps both polar climates', () => {
  const low = engine.simulate(SOURCE, 0.05);
  const high = engine.simulate(SOURCE, 0.95);
  assert(low.status === 'damped' && high.status === 'damped', `low/high=${low.status}/${high.status}`);
  assert(low.events.length < central.events.length && high.events.length < central.events.length, 'polar lambda did not shorten the cascade');
  assert(engine.windowAt(0.05) === engine.windowAt(0.95), 'M(lambda) lost symmetry');
  assert(/не передает сигнал/.test(low.text.output) && /не передает сигнал/.test(high.text.output), 'damped text contradicts the threshold');
});

check('explicit generalization moves inward without collapse', () => {
  const result = engine.simulate(GENERALIZE, 0.5);
  assert(result.mode === 'generalize', `mode=${result.mode}`);
  assert(result.events.length >= 2, 'generalization has no causal continuation');
  assert(result.events.every((event) => event.deltaU <= 0), 'generalization moved a particle outward');
  assert(result.metrics.minU > 0.18 && result.metrics.maxU < 0.82, 'generalization left the open ring');
  assert(/\u0442\u0435\u0437\u0438\u0441/.test(result.text.output), 'generalization text output is missing');
});

check('explicit detail moves outward without disintegration', () => {
  const result = engine.simulate(DETAIL, 0.5);
  assert(result.mode === 'detail', `mode=${result.mode}`);
  assert(result.events.length >= 2, 'detail has no causal continuation');
  assert(result.events.every((event) => event.deltaU >= 0), 'detail moved a particle inward');
  assert(result.metrics.minU > 0.18 && result.metrics.maxU < 0.82, 'detail left the open ring');
  assert(/\u0434\u0435\u0442\u0430\u043b/.test(result.text.output), 'detail text output is missing');
});

check('conflict is mediated instead of propagated raw', () => {
  assert(central.mode === 'repair', `mode=${central.mode}`);
  assert(central.events.some((event) => event.ruleId === 'R_MEDIATE'), 'R_MEDIATE did not fire');
  assert(central.particles.some((particle) => particle.reactionRole === 'mediated'), 'mediated particle state is missing');
  assert(/\u043f\u043e\u0441\u0440\u0435\u0434\u043d\u0438\u0447/.test(central.text.output), 'repair explanation is missing');
});

check('mass, open ring and cascade budget invariants hold', () => {
  [central, engine.simulate(GENERALIZE, 0.5), engine.simulate(DETAIL, 0.5)].forEach((result) => {
    assert(result.invariants.every((invariant) => invariant.ok), `invariant failed for ${result.mode}`);
    assert(result.metrics.massBefore === result.metrics.massAfter, `mass changed for ${result.mode}`);
    assert(result.metrics.depth <= 3 && result.events.length <= result.metrics.budget, `budget failed for ${result.mode}`);
    result.events.forEach((event) => {
      assert(event.portPath === `${event.inputPort} -> ${event.outputPort} -> STATE<PARTICLE_FIELD>`, 'typed event path is inconsistent');
      assert(event.contract.pre.ok && event.contract.inv.ok && event.contract.post.ok, `contract failed for ${event.ruleId}`);
    });
  });
});

check('evidence remains structural and soundness uncomputed', () => {
  const evidence = collect(central, ['evidence', 'evidenceLevel']);
  const soundness = collect(central, ['soundness']);
  assert(evidence.length && evidence.every((value) => value === 'STRUCTURAL' || value === 'UNVERIFIED'), 'evidence escaped bounds');
  assert(soundness.length && soundness.every((value) => value === 'NOT_COMPUTED'), 'soundness was overstated');
});

check('text result exposes the calculated cascade', () => {
  const result = textResult.summarize(SOURCE, '', { lambda: 0.5, reaction: central });
  const row = result.rows.find((item) => item.label === 'цепь');
  assert(row && /3 пок/.test(row.value) && /3 сраб/.test(row.value), 'cascade row is missing from text output');
  assert(result.formula.includes('cascade'), 'text formula omits the cascade');
  assert(result.summary.includes(central.text.summary) && result.summary.includes(central.text.output), 'causal explanation is missing');
  assert(result.summary.includes('Прогноз локальной реакции:'), 'dry-run boundary is not explicit');
  assert(result.reaction === central, 'calculated reaction snapshot was not preserved');
});

check('p78 wires reaction kernel, view and canvas causality', () => {
  const { html, runtime, reactionKernel, css } = p78;
  [
    'lib/semantic-reaction-rules.js?v=1.1.0',
    'lib/semantic-reaction-field.js?v=1.2.0',
    'lib/semantic-reaction-runtime.js?v=2.6.0',
    'lib/semantic-reaction-field-view.js?v=1.8.0',
    'lib/p78-reaction-kernel.js?v=1.0.0',
    'id="reactionField"',
  ].forEach((needle) => assert(html.includes(needle), 'p78 integration missing: '+needle));
  [
    'reactionController=ReactionKernel.create({',
    'fieldEngine:window.MRDSemanticReactionField||null',
    'runtimeEngine:window.MRDSemanticReactionRuntime||null',
    'reactionController.recalculate(',
    'function reactionRuntimeParticles()',
    'reactionController.initialize()',
    'worldState.frame.serial%REACTION_RUNTIME_FRAME_INTERVAL===0',
    'reactionController.scheduleStep()',
    'function applyReactionRuntimeResult(result)',
    'function flushReactionRuntimeUi(payload)',
    'function drawReactionCascade()',
    'function drawObservedReactions()',
    'drawReactionCascade(); drawObservedReactions(); drawDrops()',
    'updateReactionField(); renderTextResult()',
    'reaction:reactionState.field',
    'if(observed===undefined) observed=reactionController.snapshot()',
    'var context=semanticOutputContext();',
  ].forEach((needle) => assert(runtime.includes(needle), 'p78 integration missing: '+needle));
  assert(!/reactionState\.[A-Za-z_$][\w$]*\s*(?:=|\+\+|--|\+=|\|=)/.test(runtime), 'living runtime still writes reactionState directly');
  assert(runtime.includes('MRDSemanticReactionFieldView.paintParticle') && runtime.includes('painter(ctx,q.x,q.y,p.size,p,alpha)'), 'heterogeneous particle painter is not used');
  const viewSource = fs.readFileSync(lib('semantic-reaction-field-view'), 'utf8');
  assert(viewSource.includes('data-selection-reason') && viewSource.includes('data-calibration-reason') && viewSource.includes('directionSummary(metrics)') && viewSource.includes('targetSummary(live)') && viewSource.includes('reachableSummary(metrics)') && viewSource.includes('directionDivergence') && viewSource.includes('directionAvailabilityDivergence') && viewSource.includes('directionControlDivergence') && viewSource.includes('handoff:underrepresented'), 'reaction reason or forecast/observed opportunity output is missing');
  ['calibrationGain', 'calibrationPriority', 'opportunityDecay'].forEach((key) => assert(reactionKernel.includes(key), `bounded kernel option missing: ${key}`));
  assert(runtime.includes("function roleForce(role){ return role==='core' ? -.00042 : role==='detail' ? .00042 : 0; }"), 'legacy runaway role force remains');
  assert(runtime.includes('var boundaryGain=1-Math.pow(.65,scale);') && runtime.includes('if(p.u<.18) p.u+=(.18-p.u)*boundaryGain;') && runtime.includes('else if(p.u>.82) p.u+=(.82-p.u)*boundaryGain;'), 'scaled canvas open-ring barrier is missing');
  assert(css.includes('align-items:start;min-height:0;min-width:0') && css.includes('aspect-ratio:1080/690') && css.includes('position:sticky;top:10px'), 'canvas layout is not stable');
});
check('browser IIFE export has no dynamic evaluation', () => {
  const source = fs.readFileSync(lib('semantic-reaction-field'), 'utf8');
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'dynamic evaluation is forbidden');
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  modules.forEach((name) => {
    const filename = lib(name);
    new vm.Script(fs.readFileSync(filename, 'utf8'), { filename }).runInContext(context, { timeout: 2000 });
  });
  assert(sandbox.MRDSemanticReactionField, 'browser export is missing');
});

checks.forEach((result) => {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
});
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
