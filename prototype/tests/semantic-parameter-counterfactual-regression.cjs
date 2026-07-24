'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p78 = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
['semantic-core', 'semantic-reaction-rules', 'semantic-reaction-field', 'semantic-trace-continuation', 'semantic-parameter-counterfactual'].forEach((name) => require(lib(name)));

const core = global.MRDSemanticCore;
const counterfactual = global.MRDSemanticParameterCounterfactual;
const ARTICLE = 'Продолжить статью: город учится беречь воду, но жители спорят о цене. Нужны общий смысл, факты и следующий проверяемый шаг.';

function assert(condition, message) { if (!condition) throw new Error(message); }
const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

assert(core && counterfactual && typeof counterfactual.compare === 'function', 'counterfactual stack is incomplete');
const centered = counterfactual.compare(ARTICLE, '', .5);

check('comparison emits exact lower, current and upper scenarios', () => {
  assert(centered.scenarios.length === 3, `count=${centered.scenarios.length}`);
  assert(centered.scenarios.map((item) => item.id).join(',') === 'lower,current,upper', 'scenario order changed');
  assert(centered.scenarios.map((item) => item.lambda).join(',') === '0.38,0.5,0.62', 'default span changed');
  assert(centered.scenarios[1].effect === 'baseline', 'current scenario is not the baseline');
});

check('centered article is structurally stable', () => {
  assert(centered.status === 'STABLE' && centered.sensitivity === 0, `status=${centered.status}`);
  assert(centered.scenarios.every((item) => item.status === 'READY' && item.effect !== 'changed'), 'stable window contains a changed forecast');
  assert(new Set(centered.scenarios.map((item) => item.traceHash)).size === 1, 'stable window changed the trace');
  return centered.summary;
});

check('window function is symmetric around one half', () => {
  const [lower, current, upper] = centered.scenarios;
  assert(lower.window === upper.window && current.window === 1, `M=${lower.window}/${current.window}/${upper.window}`);
  assert(lower.window === .9424, `unexpected M(.38)=${lower.window}`);
});

check('near-boundary lambda exposes deterministic sensitivity', () => {
  const low = counterfactual.compare(ARTICLE, '', .22);
  const high = counterfactual.compare(ARTICLE, '', .70);
  assert(low.status === 'SENSITIVE' && low.scenarios[0].status === 'DAMPED' && low.best.id === 'upper', 'low boundary is not visible');
  assert(high.status === 'SENSITIVE' && high.scenarios[2].status === 'DAMPED' && high.best.id === 'lower', 'high boundary is not visible');
  assert(low.sensitivity === .5 && high.sensitivity === .5, 'sensitivity fraction changed');
});

check('extreme lambda and thin source abstain explicitly', () => {
  const extreme = counterfactual.compare(ARTICLE, '', .95);
  const thin = counterfactual.compare('Круг.', '', .5);
  assert(extreme.status === 'ABSTAIN' && extreme.scenarios[1].status === 'DAMPED', `extreme=${extreme.status}`);
  assert(thin.status === 'ABSTAIN' && thin.scenarios.every((item) => item.continuationCode === 'TRACE_SOURCE_THIN'), 'thin source fabricated a continuation');
});

check('comparison is deterministic and input analysis remains immutable', () => {
  const analysis = core.analyzeText(ARTICLE), before = JSON.stringify(analysis);
  const first = counterfactual.compare(ARTICLE, 'проверяемый шаг', .5, { analysis });
  const second = counterfactual.compare(ARTICLE, 'проверяемый шаг', .5, { analysis });
  assert(JSON.stringify(first) === JSON.stringify(second), 'repeated comparison changed');
  assert(JSON.stringify(analysis) === before, 'provided analysis was mutated');
});

check('all alternatives remain forecast-only structural evidence', () => {
  centered.scenarios.forEach((item) => {
    assert(item.origin === 'forecast', `${item.id} origin=${item.origin}`);
    assert(item.evidenceLevel === 'STRUCTURAL' && item.soundness === 'NOT_COMPUTED', `${item.id} overstates evidence`);
  });
  assert(centered.evidenceLevel === 'STRUCTURAL' && centered.soundness === 'NOT_COMPUTED', 'pack evidence boundary changed');
});

check('open-ring, mass and depth invariants gate every scenario', () => {
  assert(centered.contract.pre.ok && centered.contract.inv.ok && centered.contract.post.ok, 'comparison contract is incomplete');
  centered.scenarios.forEach((item) => {
    assert(item.safe && item.minU > .18 && item.maxU < .82 && item.depth <= 3, `${item.id} escaped the bounded forecast`);
  });
  assert(/mass, depth/.test(centered.contract.inv.text), 'invariant description is missing');
});

check('best scenario selection is stable and baseline-biased on a tie', () => {
  assert(centered.best && centered.best.id === 'current' && centered.best.lambda === .5, `best=${centered.best && centered.best.id}`);
  const repeated = counterfactual.compare(ARTICLE, '', .5);
  assert(repeated.best.id === centered.best.id && repeated.best.score === centered.best.score, 'best selection is nondeterministic');
});

check('hashes and baseline deltas make the comparison auditable', () => {
  assert(/^[0-9a-f]{8}$/.test(centered.hashes.input) && /^[0-9a-f]{8}$/.test(centered.hashes.comparison), 'pack hashes are missing');
  const baseline = centered.scenarios[1];
  assert(baseline.delta.events === 0 && baseline.delta.criticality === 0 && baseline.delta.ringMargin === 0, 'baseline delta is not zero');
  centered.scenarios.forEach((item) => assert(/^[0-9a-f]{8}$/.test(item.reactionHash) && /^[0-9a-f]{8}$/.test(item.traceHash), `${item.id} hashes are incomplete`));
});

check('missing dependencies return a non-actionable empty contract', () => {
  const source = fs.readFileSync(lib('semantic-parameter-counterfactual'), 'utf8');
  const sandbox = { console }; sandbox.window = sandbox; sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: lib('semantic-parameter-counterfactual') }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  const empty = sandbox.MRDSemanticParameterCounterfactual.compare(ARTICLE, '', .5);
  assert(empty.status === 'EMPTY' && empty.code === 'COUNTERFACTUAL_API_UNAVAILABLE', `status=${empty.status}`);
  assert(!empty.contract.pre.ok && !empty.contract.post.ok && empty.scenarios.length === 0, 'empty contract became actionable');
});

check('p78 loads dependencies in order and schedules slider recomputation off-frame', () => {
  const { html, runtime } = p78;
  const trace = html.indexOf('lib/semantic-trace-continuation.js?v=1.2.0');
  const engine = html.indexOf('lib/semantic-parameter-counterfactual.js?v=1.0.0');
  const view = html.indexOf('lib/semantic-parameter-view.js?v=1.0.0');
  const result = html.indexOf('lib/text-result.js?v=1.13.0');
  assert(trace >= 0 && trace < engine && engine < view && view < result, 'counterfactual dependency order is wrong');
  assert(html.includes('id="parameterCounterfactual"') && runtime.includes('function scheduleParameterCounterfactual()'), 'panel integration missing');
  const slider = runtime.slice(runtime.indexOf('lambda.oninput='), runtime.indexOf('applyCondition();', runtime.indexOf('lambda.oninput=')));
  assert(slider.includes('scheduleParameterCounterfactual()') && !slider.includes('renderParameterCounterfactual()'), 'slider runs the full comparison synchronously');
});

check('browser module is static and versioned', () => {
  const source = fs.readFileSync(lib('semantic-parameter-counterfactual'), 'utf8'), sandbox = { console };
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'dynamic evaluation is forbidden');
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: lib('semantic-parameter-counterfactual') }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  assert(sandbox.MRDSemanticParameterCounterfactual.version === '1.0.0', 'browser export version missing');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
