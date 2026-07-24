'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p78 = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const modules = ['semantic-core', 'semantic-reaction-rules', 'semantic-reaction-field', 'semantic-reaction-runtime', 'semantic-trace-continuation', 'text-result', 'output-menu'];
global.window = global;
modules.forEach((name) => require(lib(name)));

const rules = global.MRDSemanticReactionRules;
const fieldEngine = global.MRDSemanticReactionField;
const runtime = global.MRDSemanticReactionRuntime;
const textResult = global.MRDTextResult;
const outputMenu = global.MRDOutputMenu;
const MIXED = 'Идея продолжение конкретный факт затем событие.';
const SOURCE = '\u0421\u043c\u044b\u0441\u043b \u0441\u043f\u043e\u0440\u0438\u0442 \u0441 \u0448\u0443\u043c\u043e\u043c, \u0430 \u043c\u043e\u0441\u0442 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435.';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function particlesFor(field) {
  return field.particles.map((particle, index) => ({
    id: index,
    tokenIndex: particle.index,
    token: particle.token,
    x: 0.42 + (index % 4) * 0.012,
    y: 0.46 + Math.floor(index / 4) * 0.012,
    u: particle.u,
    semanticRole: particle.semanticRole,
    reactionRole: particle.reactionRole,
    baseReactionRole: particle.baseReactionRole,
    q: particle.q,
    act: 1,
    thr: 0.12,
    mass: 1,
  }));
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

assert(rules && fieldEngine && runtime && textResult && outputMenu, 'reaction stack exports are missing');
const catalog = rules.list();
const forecast = fieldEngine.simulate(SOURCE, 0.5);
const samples = particlesFor(forecast);
let liveState = runtime.create({
  revision: 'rules-regression',
  field: forecast,
  particles: samples,
  options: { cellSize: 0.05, radius: 0.16, tickBudget: 3, candidateBudget: 80, pairBudget: 400, cascadeBudget: 12, maxGeneration: 3 },
});
const liveResult = runtime.step(liveState, { revision: 'rules-regression', tick: 1, worldTick: 48, lambda: 0.5, particles: samples });
liveState = liveResult.state;
const observed = runtime.snapshot(liveState);

check('catalog schema is complete and unique', () => {
  assert(catalog.length === 5, `rules=${catalog.length}`);
  assert(new Set(catalog.map((rule) => rule.id)).size === catalog.length, 'duplicate rule ids');
  catalog.forEach((rule) => {
    assert(/^R_[A-Z_]+$/.test(rule.id), `bad id=${rule.id}`);
    assert(rule.inputPort && rule.outputPort && rule.contract.pre && rule.contract.inv && rule.contract.post && rule.contract.proof, `incomplete rule=${rule.id}`);
  });
  assert(rules.policyVersion === '1.0.0', 'policy='+rules.policyVersion);
  return rules.version+'/'+rules.policyVersion+'/'+rules.hash;
});

check('catalog copies cannot mutate the source', () => {
  const copy = rules.get('R_SYNTH');
  copy.priority = -1;
  copy.contract.pre = 'tampered';
  assert(rules.get('R_SYNTH').priority === 70, 'priority leaked through copy');
  assert(rules.get('R_SYNTH').contract.pre !== 'tampered', 'contract leaked through copy');
});

check('selector maps explicit modes, local types and guards deterministically', () => {
  const seed = rules.select({ mode: 'orbit', sourceReactionRole: 'seed', sourceBaseRole: 'synth' });
  const synth = rules.select({ mode: 'orbit', sourceBaseRole: 'synth' });
  const fragment = rules.select({ mode: 'orbit', sourceBaseRole: 'fragment' });
  assert(seed.id === 'R_CATALYZE' && seed.selectionReason === 'source:seed', 'seed mapping');
  assert(synth.id === 'R_SYNTH' && synth.selectionReason === 'source:synth', 'local synth mapping');
  assert(fragment.id === 'R_FRAGMENT' && fragment.selectionReason === 'source:fragment', 'local fragment mapping');
  assert(rules.select({ mode: 'generalize', sourceBaseRole: 'fragment' }).id === 'R_SYNTH', 'explicit generalize mapping');
  assert(rules.select({ mode: 'detail', sourceBaseRole: 'synth' }).id === 'R_FRAGMENT', 'explicit detail mapping');
  assert(rules.select({ mode: 'repair', targetBaseRole: 'anti' }).id === 'R_MEDIATE', 'repair mapping');
  const guard = rules.select({ mode: 'detail', guarded: true });
  assert(guard.id === 'R_HOMEOSTASIS' && guard.selectionReason === 'guard:open-ring', 'guard mapping');
});

check('forecast events are catalog-valid', () => {
  assert(forecast.events.length > 0, 'forecast has no events');
  forecast.events.forEach((event) => assert(rules.validateEvent(event).ok, `${event.ruleId}: ${rules.validateEvent(event).failures.join(',')}`));
  assert(forecast.ruleVersion === rules.version && forecast.ruleHash === rules.hash, 'forecast catalog identity mismatch');
});

check('selection evidence rejects a changed rule reason or input', () => {
  const changedReason = JSON.parse(JSON.stringify(forecast.events[0]));
  changedReason.selectionReason = 'source:fragment';
  const reasonCheck = rules.validateEvent(changedReason);
  assert(!reasonCheck.ok && reasonCheck.failures.includes('selectionReason'), 'changed reason was accepted');
  const changedInput = JSON.parse(JSON.stringify(forecast.events[0]));
  changedInput.selectionInput = { ...changedInput.selectionInput, mode: 'detail', guarded: false };
  const inputCheck = rules.validateEvent(changedInput);
  assert(!inputCheck.ok && inputCheck.failures.includes('ruleSelection'), 'changed selection input was accepted');
});

check('ordinary orbit can mix local reaction directions', () => {
  const mixed = fieldEngine.simulate(MIXED, 0.5);
  const directions = new Set(mixed.events.map((event) => event.direction));
  assert(mixed.mode === 'orbit', 'mode='+mixed.mode);
  assert(directions.has('orbit') && directions.has('detail'), 'directions='+Array.from(directions).join(','));
  assert(mixed.events.some((event) => event.selectionReason === 'source:fragment'), 'fragment particle did not select detail');
  mixed.events.forEach((event) => assert(rules.validateEvent(event).ok, 'mixed '+event.ruleId+' invalid'));
  assert(mixed.metrics.directionCounts.orbit > 0 && mixed.metrics.directionCounts.detail > 0, 'direction counters are incomplete');
});

check('observed events use the same catalog', () => {
  assert(liveResult.events.length > 0, 'runtime has no observed event');
  liveResult.events.forEach((event) => assert(rules.validateEvent(event).ok, `${event.ruleId}: ${rules.validateEvent(event).failures.join(',')}`));
  assert(observed.ruleVersion === rules.version && observed.ruleHash === rules.hash, 'runtime catalog identity mismatch');
});

check('typed paths are identical in forecast and observed layers', () => {
  [...forecast.events, ...liveResult.events].forEach((event) => {
    assert(event.portPath === rules.typedPath(event.ruleId), `path mismatch=${event.ruleId}`);
  });
});

check('text result and output menu expose a read-only observed projection', () => {
  const result = textResult.summarize(SOURCE, '', { lambda: 0.5, reaction: forecast, observed });
  assert(result.observation && result.observation.origin === 'observed', 'observed projection missing');
  assert(result.observation.selectionReason && result.observation.selectionInput, 'observed selection evidence missing');
  assert(result.observation.directionCounts && Object.values(result.observation.directionCounts).reduce((sum, value) => sum + value, 0) > 0, 'observed direction summary missing');
  assert(result.observation.directionTarget && result.observation.directionProfile && Number.isFinite(result.observation.directionDivergence), 'forecast/observed mix evidence missing');
  assert(result.observation.directionReachableProfile && Number.isFinite(result.observation.directionAvailabilityDivergence) && Number.isFinite(result.observation.directionControlDivergence), 'spatial opportunity evidence missing');
  assert(result.observation.calibrationReason && result.observation.calibrationMultiplier >= 0.88 && result.observation.calibrationMultiplier <= 1.12, 'bounded calibration evidence missing');
  assert(result.observedLine && result.observedLine.includes(result.observation.ruleId) && result.observedLine.includes(result.observation.selectionReason) && result.observedLine.includes('накоплено:') && result.observedLine.includes('цель:') && result.observedLine.includes('доступно:') && result.observedLine.includes('Δmix') && result.observedLine.includes('Δspace') && result.observedLine.includes('Δcontrol'), 'observed rule reason or opportunity evidence is absent from text');
  assert(result.rows.some((row) => row.label === '\u043d\u0430\u0431\u043b\u044e\u0434.'), 'observed metrics row missing');
  assert(result.observation.evidenceLevel === 'STRUCTURAL' && result.observation.soundness === 'NOT_COMPUTED', 'evidence boundary changed');
  const menu = outputMenu.build(SOURCE, '', { lambda: 0.5, reaction: forecast, observed });
  const observedItem = menu.items.find((item) => item.id === 'observed');
  assert(observedItem && observedItem.text === result.observedLine, 'observed output-menu item missing');
});

check('p78 loads the catalog before both engines', () => {
  const { html, runtime: p78Runtime } = p78;
  const ruleIndex = html.indexOf('lib/semantic-reaction-rules.js?v=1.1.0');
  const fieldIndex = html.indexOf('lib/semantic-reaction-field.js?v=1.2.0');
  const runtimeIndex = html.indexOf('lib/semantic-reaction-runtime.js?v=2.6.0');
  assert(ruleIndex >= 0 && ruleIndex < fieldIndex && fieldIndex < runtimeIndex, 'script dependency order is wrong');
  const traceIndex = html.indexOf('lib/semantic-trace-continuation.js?v=1.2.0');
  const textIndex = html.indexOf('lib/text-result.js?v=1.13.0');
  assert(html.includes('lib/semantic-reaction-field-view.js?v=1.8.0') && traceIndex > runtimeIndex && traceIndex < textIndex && html.includes('lib/output-menu.js?v=1.3.0'), 'selection output versions or trace dependency order are stale');
  assert(p78Runtime.includes('if(observed===undefined) observed=reactionController.snapshot()') &&
    p78Runtime.includes('var context=semanticOutputContext();'),
  'text output does not receive observed state through the shared semantic context');
});

check('browser IIFE export has no dynamic evaluation', () => {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  modules.forEach((name) => {
    const filename = lib(name);
    const source = fs.readFileSync(filename, 'utf8');
    assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), `dynamic evaluation in ${name}`);
    new vm.Script(source, { filename }).runInContext(context, { timeout: 2000 });
  });
  assert(sandbox.MRDSemanticReactionRules.hash === rules.hash, 'browser catalog differs');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
