'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p78 = require('./p78-fixture.cjs');

const filename = path.join(__dirname, '..', 'lib', 'p78-runtime-state.js');
const source = fs.readFileSync(filename, 'utf8');
const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
new vm.Script(source, { filename }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
const api = sandbox.MRDP78RuntimeState;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function sameKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = expected.slice().sort();
  assert(JSON.stringify(actual) === JSON.stringify(wanted), `${label}: ${actual.join(', ')}`);
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

check('browser IIFE exports the state owner API', () => {
  assert(api && api.version === '1.2.0', 'versioned export missing');
  ['createState', 'snapshot', 'reset'].forEach((name) => assert(typeof api[name] === 'function', `${name} missing`));
  sameKeys(Object.fromEntries(api.sections.map((name) => [name, true])), ['worldState', 'reactionState', 'semanticState', 'uiState'], 'sections');
  return `v${api.version}`;
});

check('defaults match the four current runtime domains', () => {
  const state = api.createState();
  assert(state.kind === 'MRDP78RuntimeState', `kind=${state.kind}`);
  assert(state.worldState.seed === 987654321 && state.worldState.running === true, 'world defaults changed');
  assert(state.worldState.frame.serial === 0 && state.worldState.frame.healthSamples.length === 0, 'frame defaults changed');
  assert(state.reactionState.revision === '' && state.reactionState.runtimeEpoch === 0, 'reaction identity defaults changed');
  assert(state.reactionState.stepScheduled === false && state.reactionState.stepScheduledEpoch === null, 'step ownership defaults changed');
  assert(state.reactionState.uiScheduled === false && state.reactionState.uiScheduledEpoch === null && state.reactionState.uiPayloadEpoch === null, 'UI ownership defaults changed');
  assert(state.semanticState.analysis === null && state.semanticState.renderSource === '', 'semantic defaults changed');
  assert(state.uiState.panelUpdateScheduled === false && state.uiState.portalUndo.length === 0, 'ui defaults changed');
});

check('createState produces independent collections', () => {
  const left = api.createState();
  const right = api.createState();
  left.worldState.drops.push({ id: 1 });
  left.worldState.frame.healthSamples.push(33);
  left.uiState.portalUndo.push('x');
  assert(right.worldState.drops.length === 0, 'world array shared');
  assert(right.worldState.frame.healthSamples.length === 0, 'nested frame array shared');
  assert(right.uiState.portalUndo.length === 0, 'ui array shared');
});

check('known overrides are copied and unknown keys are ignored', () => {
  const overrides = {
    worldState: { drops: [{ id: 7 }], unknown: 1 },
    reactionState: { revision: 'r7', runtimeEpoch: 7 },
    semanticState: { analysis: { tokens: ['bridge'] } },
    uiState: { portalLog: ['created'] },
    unknownState: { value: true },
  };
  const state = api.createState(overrides);
  overrides.worldState.drops[0].id = 99;
  overrides.semanticState.analysis.tokens.push('mutated');
  assert(state.worldState.drops[0].id === 7, 'override array leaked');
  assert(state.semanticState.analysis.tokens.length === 1, 'override object leaked');
  assert(!('unknown' in state.worldState) && !('unknownState' in state), 'unknown override accepted');
  assert(state.reactionState.revision === 'r7' && state.reactionState.runtimeEpoch === 7, 'known reaction override lost');
  assert(state.uiState.portalLog[0] === 'created', 'known UI override lost');
});

check('snapshot is a deep frozen detached projection', () => {
  const state = api.createState({ worldState: { drops: [{ id: 3, meta: { u: 0.5 } }] } });
  const snap = api.snapshot(state);
  assert(snap.kind === 'MRDP78RuntimeStateSnapshot' && snap.version === api.version, 'snapshot metadata changed');
  assert(Object.isFrozen(snap) && Object.isFrozen(snap.worldState) && Object.isFrozen(snap.worldState.drops[0].meta), 'snapshot not deeply frozen');
  try { snap.worldState.drops[0].meta.u = 0.9; } catch (_) {}
  assert(state.worldState.drops[0].meta.u === 0.5, 'snapshot mutation reached live state');
  state.worldState.drops[0].meta.u = 0.25;
  assert(snap.worldState.drops[0].meta.u === 0.5, 'live mutation changed old snapshot');
});

check('snapshot handles cycles and removes opaque values', () => {
  const cycle = { label: 'cycle' };
  cycle.self = cycle;
  const state = api.createState({
    semanticState: { analysis: cycle, dataLoadPromise: Promise.resolve('x'), ledger: () => true },
    uiState: { backgroundGradient: new Date(0) },
  });
  const snap = api.snapshot(state);
  assert(snap.semanticState.analysis.self === snap.semanticState.analysis, 'cycle was not preserved safely');
  assert(snap.semanticState.dataLoadPromise === null && snap.semanticState.ledger === null, 'opaque semantic value leaked');
  assert(snap.uiState.backgroundGradient === null, 'host-like UI value leaked');
});

check('reset preserves identities, restores defaults, and advances epoch monotonically', () => {
  const state = api.createState({ reactionState: { revision: 'seed', runtimeEpoch: 4 } });
  const root = state;
  const sections = api.sections.map((name) => state[name]);
  state.worldState.drops.push({ id: 1 });
  state.uiState.panelUpdateScheduled = true;
  const returned = api.reset(state, { reactionState: { revision: 'next', runtimeEpoch: 999 } });
  assert(returned === root, 'root identity changed');
  api.sections.forEach((name, index) => assert(state[name] === sections[index], name + ' identity changed'));
  assert(state.worldState.drops.length === 0 && state.uiState.panelUpdateScheduled === false, 'defaults not restored');
  assert(state.reactionState.revision === 'next', 'reset override not applied');
  assert(state.reactionState.runtimeEpoch === 5, 'reset override replaced the monotonic epoch');
  api.reset(state);
  assert(state.reactionState.revision === '', 'reset override persisted as seed');
  assert(state.reactionState.runtimeEpoch === 6, 'second reset did not advance epoch');
});

check('reset rejects invalid or exhausted epoch before mutation', () => {
  [-1, 1.5, Number.MAX_SAFE_INTEGER].forEach((runtimeEpoch) => {
    const state = api.createState({ reactionState: { runtimeEpoch, revision: 'keep' } });
    const before = api.snapshot(state);
    let error = null;
    try {
      api.reset(state);
    } catch (caught) {
      error = caught;
    }
    assert(error, 'invalid epoch was accepted: ' + runtimeEpoch);
    const expected = runtimeEpoch === Number.MAX_SAFE_INTEGER ? 'P78_RUNTIME_EPOCH_EXHAUSTED' : 'P78_RUNTIME_STATE_INVALID';
    assert(error.message === expected, 'wrong epoch error: ' + error.message);
    assert(state.reactionState.runtimeEpoch === before.reactionState.runtimeEpoch && state.reactionState.revision === 'keep', 'failed reset mutated state');
  });
});
check('source is static classic JavaScript without external effects', () => {
  assert(!/\beval\s*\(|\bnew\s+Function\b/.test(source), 'dynamic evaluation found');
  assert(!/JSON\.(?:parse|stringify)/.test(source), 'JSON cloning found');
  assert(!/https?:\/\//i.test(source), 'network URL found');
  assert(!/\bdocument\b|getElementById|querySelector/.test(source), 'DOM access found');
  new vm.Script(source, { filename });
});

check('HTML loads state, reaction kernel, and runtime exactly once in dependency order', () => {
  const stateScript = 'lib/p78-runtime-state.js?v=1.2.0';
  const kernelScript = 'lib/p78-reaction-kernel.js?v=1.0.0';
  assert(p78.scriptSources.filter((item) => item === stateScript).length === 1, 'versioned state owner script count changed');
  assert(p78.scriptSources.filter((item) => item === kernelScript).length === 1, 'versioned reaction kernel script count changed');
  p78.assertScriptOrder('lib/semantic-decision-view.js', 'lib/p78-runtime-state.js', 'lib/p78-reaction-kernel.js', 'lib/p78-living-ring-runtime.js');
});

check('runtime creates one owner and uses all four live sections', () => {
  const runtime = p78.runtime;
  assert((runtime.match(/RuntimeState\.createState\(/g) || []).length === 1, 'runtime owner must be created exactly once');
  [
    'worldState=p78State.worldState',
    'reactionState=p78State.reactionState',
    'semanticState=p78State.semanticState',
    'uiState=p78State.uiState',
  ].forEach((needle) => assert(runtime.includes(needle), `live section missing: ${needle}`));
  assert(runtime.includes("throw new Error('P78_RUNTIME_STATE_UNAVAILABLE')"), 'missing explicit load failure');
});

check('legacy reaction and scheduler globals are no longer state owners', () => {
  const runtime = p78.runtime;
  const legacy = [
    'reactionFieldState', 'reactionRuntimeState', 'reactionRuntimeLastResult', 'reactionRuntimeRevision',
    'reactionRuntimeTick', 'reactionStepScheduled', 'reactionUiScheduled', 'reactionUiTextDirty',
    'reactionUiMenuDirty', 'reactionUiEvent', 'frameSerial', 'frameLastAt', 'frameHealthSamples',
    'frameRuntimeMs', 'frameWorkMs', 'frameSimulationMs', 'frameDrawMs', 'simulationSubsteps',
  ];
  legacy.forEach((name) => {
    const bare = new RegExp(`(?<![.A-Za-z0-9_$])${name}\\b`);
    assert(!bare.test(runtime), `bare legacy state remains: ${name}`);
  });
});

check('reaction kernel owns epoch-aware mutation while the runtime remains a passive adapter', () => {
  const runtime = p78.runtime;
  const kernel = p78.reactionKernel;
  assert((runtime.match(/ReactionKernel\.create\(/g) || []).length === 1, 'reaction controller must be created exactly once');
  ['function scheduleReactionRuntimeStep(){', 'function advanceReactionRuntime(){', 'function scheduleReactionRuntimeUi(']
    .forEach((needle) => assert(!runtime.includes(needle), 'legacy scheduler remains: ' + needle));
  assert(!/\breactionState\.(?:field|runtime|lastResult|revision|tick|runtimeEpoch|stepScheduled|stepScheduledEpoch|uiScheduled|uiScheduledEpoch|uiTextDirty|uiMenuDirty|uiEvent|uiPayloadEpoch|runtimeMs)\s*=/.test(runtime), 'runtime still writes kernel-owned reaction state');
  assert(kernel.includes('state.runtimeEpoch=nextEpoch(state.runtimeEpoch);'), 'kernel does not advance epoch before initialize');
  assert(kernel.includes('state.stepScheduledEpoch===scheduledEpoch'), 'step lock has no epoch owner');
  assert(kernel.includes('state.uiPayloadEpoch!==scheduledEpoch'), 'UI payload has no epoch owner');

  const flushStart = runtime.indexOf('function flushReactionRuntimeUi(payload){');
  const flushEnd = runtime.indexOf('function applyReactionRuntimeResult(', flushStart);
  const flush = runtime.slice(flushStart, flushEnd);
  assert(flushStart >= 0 && flushEnd > flushStart, 'passive UI adapter missing');
  assert(flush.includes('renderReactionField();'), 'passive UI adapter does not render the field');
  assert(!/\breactionState\.[A-Za-z_$][\w$]*\s*=/.test(flush), 'passive UI adapter mutates reaction state');
});checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
