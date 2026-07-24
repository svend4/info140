'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filename = path.join(__dirname, '..', 'lib', 'p78-reaction-kernel.js');
const source = fs.readFileSync(filename, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
function same(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  assert(left === right, `${message}: ${left} !== ${right}`);
}
function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
function loadKernel(useWindow = true) {
  const sandbox = { console };
  if (useWindow) sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new vm.Script(source, { filename }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  return sandbox.MRDP78ReactionKernel;
}

const api = loadKernel();
const RUNTIME_OPTIONS = {
  cellSize: 0.025,
  radius: 0.045,
  tickBudget: 3,
  candidateBudget: 160,
  pairBudget: 2800,
  cascadeBudget: 12,
  maxGeneration: 3,
  cooldown: 2,
  activationDelay: 1,
  cascadeTTL: 90,
  rearmAfter: 24,
  historyLimit: 18,
  calibrationGain: 0.12,
  calibrationPriority: 20,
  opportunityDecay: 0.92,
};

function createReactionState(overrides = {}) {
  return {
    field: null,
    runtime: null,
    lastResult: null,
    revision: '',
    tick: 0,
    runtimeEpoch: 0,
    stepScheduled: false,
    stepScheduledEpoch: null,
    uiScheduled: false,
    uiScheduledEpoch: null,
    uiPayloadEpoch: null,
    uiTextDirty: false,
    uiMenuDirty: false,
    uiEvent: '',
    runtimeMs: 0,
    ...overrides,
  };
}

function createHarness(options = {}) {
  const state = options.state || createReactionState();
  const queue = [];
  const calls = {
    fields: [],
    fieldOptionRefs: [],
    creates: [],
    createOptionRefs: [],
    steps: [],
    snapshots: [],
    applies: [],
    flushes: [],
    flushStates: [],
    idleTimeouts: [],
    revisionReads: [],
    runningReads: [],
    runtimeReads: [],
    hashes: [],
  };
  let clock = hasOwn(options, 'clock') ? options.clock : 100;
  const clockIncrement = hasOwn(options, 'clockIncrement') ? options.clockIncrement : 5;
  let revisionInput = {
    analysisHash: 17,
    lambdaRaw: 64,
    target: 'target',
    mode: 'orbit',
    triggerToken: 'seed',
    ...(options.revisionInput || {}),
  };
  let runtimeInput = {
    running: true,
    worldTick: 0,
    lambda: 0.64,
    particles: [{ id: 'p0', u: 0.5 }],
    ...(options.runtimeInput || {}),
  };

  const defaultFieldEngine = {
    simulate(input, lambda, fieldOptions) {
      calls.fieldOptionRefs.push(fieldOptions);
      calls.fields.push({ input, lambda, options: plain(fieldOptions) });
      if (options.simulate) return options.simulate(input, lambda, fieldOptions, calls);
      return {
        kind: 'MRDSemanticReactionField',
        input,
        lambda,
        mode: revisionInput.mode,
        trigger: { token: revisionInput.triggerToken },
        particles: [{ index: 0, token: 'seed' }, { index: 1, token: 'bridge' }],
      };
    },
  };
  const defaultRuntimeEngine = {
    create(input) {
      calls.createOptionRefs.push(input.options);
      calls.creates.push({
        revision: input.revision,
        field: input.field,
        particles: plain(input.particles),
        options: plain(input.options),
      });
      if (options.createResult) return options.createResult(input, calls);
      return {
        kind: 'FakeReactionRuntime',
        status: 'READY',
        revision: input.revision,
        tick: 0,
        serial: calls.creates.length,
      };
    },
    step(runtime, input) {
      calls.steps.push({ runtime: plain(runtime), input: plain(input) });
      if (options.stepResult) return options.stepResult(runtime, input, calls);
      return {
        state: { ...runtime, status: 'READY', tick: input.tick },
        status: 'READY',
        code: null,
        events: [],
        effects: [],
      };
    },
    snapshot(runtime) {
      calls.snapshots.push(plain(runtime));
      if (options.snapshotResult) return options.snapshotResult(runtime, calls);
      return { kind: 'FakeObservedSnapshot', revision: runtime.revision, tick: runtime.tick };
    },
  };

  const fieldEngine = hasOwn(options, 'fieldEngine') ? options.fieldEngine : defaultFieldEngine;
  const runtimeEngine = hasOwn(options, 'runtimeEngine') ? options.runtimeEngine : defaultRuntimeEngine;
  const rulebook = hasOwn(options, 'rulebook') ? options.rulebook : { hash: 'rules-v1' };

  const controller = api.create({
    state,
    fieldEngine,
    runtimeEngine,
    rulebook,
    scheduleIdle(task, timeout) {
      queue.push({ task, timeout });
      calls.idleTimeouts.push(timeout);
    },
    now() {
      const value = clock;
      clock += clockIncrement;
      return value;
    },
    hashText(text) {
      calls.hashes.push(text);
      return `hash(${text})`;
    },
    readRevisionInput() {
      calls.revisionReads.push({ epoch: state.runtimeEpoch, input: plain(revisionInput) });
      if (options.onRevisionRead) options.onRevisionRead(state, revisionInput, calls);
      return revisionInput;
    },
    isRunning() {
      calls.runningReads.push(runtimeInput.running);
      return runtimeInput.running;
    },
    readRuntimeInput() {
      calls.runtimeReads.push(plain(runtimeInput));
      return runtimeInput;
    },
    applyResult(result) {
      calls.applies.push(result);
      if (options.applyResult) return options.applyResult(result, state, calls);
      return `event@${result.state.tick}`;
    },
    flushUi(payload) {
      calls.flushes.push(plain(payload));
      calls.flushStates.push({
        textDirty: state.uiTextDirty,
        menuDirty: state.uiMenuDirty,
        event: state.uiEvent,
        payloadEpoch: state.uiPayloadEpoch,
      });
      if (options.flushUi) return options.flushUi(payload, state, calls);
      return undefined;
    },
  });

  return {
    state,
    queue,
    calls,
    controller,
    get revisionInput() { return revisionInput; },
    set revisionInput(value) { revisionInput = value; },
    get runtimeInput() { return runtimeInput; },
    set runtimeInput(value) { runtimeInput = value; },
    run(index = 0) {
      assert(queue[index], `idle callback ${index} missing`);
      const job = queue.splice(index, 1)[0];
      job.task();
      return job;
    },
  };
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

check('classic IIFE exports a frozen v1.0.0 API through window and globalThis', () => {
  assert(api && api.version === '1.0.0', 'versioned export missing');
  same(Object.keys(api).sort(), ['create', 'defaults', 'version'], 'public API keys changed');
  ['recalculate', 'initialize', 'scheduleStep', 'advance', 'scheduleUi', 'snapshot', 'particle', 'getField']
    .forEach((name) => {
      const harness = createHarness();
      assert(typeof harness.controller[name] === 'function', `${name} missing`);
    });
  assert(Object.isFrozen(api) && Object.isFrozen(api.defaults), 'API defaults are mutable');
  assert(Object.isFrozen(api.defaults.field) && Object.isFrozen(api.defaults.runtime), 'nested defaults are mutable');
  const fallback = loadKernel(false);
  assert(fallback && fallback.version === api.version, 'globalThis fallback export missing');
  return `v${api.version}`;
});

check('defaults preserve field, cadence, timeout, and full runtime create options', () => {
  same(plain(api.defaults.field), { maxDepth: 3, budget: 8 }, 'field defaults changed');
  same(plain(api.defaults.runtime), RUNTIME_OPTIONS, 'runtime create options changed');
  assert(api.defaults.revisionPrefix === 'p78-r3', `prefix=${api.defaults.revisionPrefix}`);
  assert(api.defaults.outputInterval === 6, `outputInterval=${api.defaults.outputInterval}`);
  assert(api.defaults.stepTimeout === 320, `stepTimeout=${api.defaults.stepTimeout}`);
  assert(api.defaults.uiTimeout === 260, `uiTimeout=${api.defaults.uiTimeout}`);
});

check('field calculation uses detached defaults and exposes field particles', () => {
  const harness = createHarness();
  const first = harness.controller.recalculate('alpha', 0.4);
  assert(first === harness.state.field && harness.controller.getField() === first, 'field identity lost');
  assert(harness.controller.particle(0) === first.particles[0], 'particle lookup failed');
  assert(harness.controller.particle(-1) === null && harness.controller.particle(99) === null, 'particle bounds changed');
  same(harness.calls.fields[0].options, { maxDepth: 3, budget: 8 }, 'simulate options changed');
  assert(harness.calls.fieldOptionRefs[0] !== api.defaults.field, 'field defaults passed by reference');
  harness.calls.fieldOptionRefs[0].budget = 1;
  harness.controller.recalculate('beta', 0.6);
  assert(harness.calls.fieldOptionRefs[1].budget === 8, 'field option mutation leaked to next call');
  assert(api.defaults.field.budget === 8, 'exported field defaults mutated');
});

check('initialize increments epoch first, preserves locks, and creates exact revision/options', () => {
  const state = createReactionState({
    tick: 9,
    lastResult: { stale: true },
    runtimeMs: 19,
    runtimeEpoch: 11,
    stepScheduled: true,
    stepScheduledEpoch: 11,
    uiScheduled: true,
    uiScheduledEpoch: 11,
    uiPayloadEpoch: 11,
    uiTextDirty: true,
    uiMenuDirty: true,
    uiEvent: 'stale',
  });
  const harness = createHarness({
    state,
    revisionInput: { analysisHash: 31, lambdaRaw: 72, target: 'goal', mode: 'repair', triggerToken: 'bridge' },
  });
  harness.controller.recalculate('input', 0.72);
  const runtime = harness.controller.initialize();
  const expectedRevision = 'p78-r3|rules-v1|31|72|hash(goal)|repair|bridge';
  assert(runtime && state.runtime === runtime, 'runtime not installed');
  assert(state.runtimeEpoch === 12, `epoch=${state.runtimeEpoch}`);
  assert(harness.calls.revisionReads[0].epoch === 12, 'epoch was not changed before revision input was read');
  assert(state.revision === expectedRevision, `revision=${state.revision}`);
  assert(state.tick === 0 && state.lastResult === null && state.runtimeMs === 0, 'runtime counters not reset');
  assert(!state.uiTextDirty && !state.uiMenuDirty && state.uiEvent === '' && state.uiPayloadEpoch === null, 'old UI payload survived');
  assert(state.stepScheduled && state.stepScheduledEpoch === 11, 'step lock was reset');
  assert(state.uiScheduled && state.uiScheduledEpoch === 11, 'UI lock was reset');
  same(harness.calls.creates[0].options, RUNTIME_OPTIONS, 'runtime options changed');
  assert(harness.calls.createOptionRefs[0] !== api.defaults.runtime, 'runtime defaults passed by reference');
  harness.calls.createOptionRefs[0].radius = 9;
  const firstRevision = state.revision;
  harness.controller.initialize();
  assert(state.runtimeEpoch === 13 && state.revision === firstRevision, 'same revision did not receive a new epoch');
  assert(harness.calls.createOptionRefs[1].radius === 0.045, 'runtime option mutation leaked to next create');
  assert(harness.calls.createOptionRefs[0] !== harness.calls.createOptionRefs[1], 'runtime create reused options object');
  assert(api.defaults.runtime.radius === 0.045, 'exported runtime defaults mutated');
});

check('initialize rejects epoch exhaustion before mutating reaction state', () => {
  const state = createReactionState({
    runtimeEpoch: Number.MAX_SAFE_INTEGER,
    revision: 'keep',
    tick: 9,
    uiEvent: 'keep',
  });
  const harness = createHarness({ state });
  const before = plain(state);
  let error = null;
  try {
    harness.controller.initialize();
  } catch (caught) {
    error = caught;
  }
  assert(error && error.name === 'RangeError' && error.message === 'P78_RUNTIME_EPOCH_EXHAUSTED', 'epoch exhaustion was not explicit');
  same(plain(state), before, 'exhausted initialize mutated state');
});

check('null engines fail closed while initialize still invalidates the old epoch', () => {
  const harness = createHarness({ fieldEngine: null, runtimeEngine: null, rulebook: null });
  assert(harness.controller.recalculate('input', 0.5) === null, 'missing field engine did not return null');
  assert(harness.controller.initialize() === null, 'missing runtime engine did not return null');
  assert(harness.state.runtimeEpoch === 1, 'unavailable engine did not increment epoch');
  assert(harness.state.revision.startsWith('p78-r3|no-rules|'), 'no-rules revision changed');
  assert(harness.controller.snapshot() === null && harness.controller.advance() === null, 'missing runtime remained observable');
});

check('step queue coalesces, honors pause, reads live inputs, and advances exactly once', () => {
  const harness = createHarness();
  harness.controller.recalculate('input', 0.64);
  harness.controller.initialize();
  const readsAfterInitialize = harness.calls.runtimeReads.length;
  harness.runtimeInput = { running: false, worldTick: 1, lambda: 0.1, particles: [{ id: 'paused' }] };
  assert(harness.controller.scheduleStep() === false && harness.queue.length === 0, 'paused step was scheduled');
  assert(harness.calls.runtimeReads.length === readsAfterInitialize, 'pause probe assembled runtime particles');

  harness.runtimeInput = { running: true, worldTick: 2, lambda: 0.2, particles: [{ id: 'early' }] };
  assert(harness.controller.scheduleStep() === true, 'live step was not scheduled');
  assert(harness.controller.scheduleStep() === false, 'same-epoch step did not coalesce');
  assert(harness.calls.runtimeReads.length === readsAfterInitialize, 'queue probe assembled runtime particles');
  assert(harness.queue.length === 1 && harness.queue[0].timeout === 320, 'step timeout or queue count changed');
  harness.runtimeInput = { running: false, worldTick: 3, lambda: 0.3, particles: [{ id: 'late-paused' }] };
  harness.run();
  assert(harness.calls.steps.length === 0, 'callback advanced after pause');
  assert(harness.calls.runtimeReads.length === readsAfterInitialize, 'paused callback assembled runtime particles');
  assert(!harness.state.stepScheduled && harness.state.stepScheduledEpoch === null, 'paused callback did not release own lock');

  harness.runtimeInput = { running: true, worldTick: 8, lambda: 0.8, particles: [{ id: 'scheduled' }] };
  assert(harness.controller.scheduleStep() === true, 'resumed step was not scheduled');
  assert(harness.controller.scheduleStep() === false, 'resumed burst did not coalesce');
  harness.runtimeInput = { running: true, worldTick: 88, lambda: 0.72, particles: [{ id: 'live' }] };
  harness.run();
  assert(harness.calls.steps.length === 1, `steps=${harness.calls.steps.length}`);
  assert(harness.calls.runtimeReads.length === readsAfterInitialize + 1, 'active callback did not read runtime input exactly once');
  same(harness.calls.steps[0].input, {
    revision: harness.state.revision,
    tick: 1,
    worldTick: 88,
    lambda: 0.72,
    particles: [{ id: 'live' }],
  }, 'step did not use callback-time input');
  assert(harness.state.tick === 1 && harness.state.runtime.tick === 1, 'tick did not advance exactly once');
  assert(harness.state.runtimeMs === 5, `runtimeMs=${harness.state.runtimeMs}`);
  assert(harness.calls.applies.length === 1, 'result applied more than once');
  assert(harness.queue.length === 1 && harness.queue[0].timeout === 260, 'tick did not queue one UI flush');
  assert(harness.state.uiTextDirty && harness.state.uiMenuDirty, 'tick 1 output was not requested');
});

check('output refresh occurs on tick 1 and every sixth tick only', () => {
  const harness = createHarness();
  harness.controller.recalculate('input', 0.64);
  harness.controller.initialize();
  harness.controller.advance();
  assert(harness.state.tick === 1 && harness.state.uiTextDirty, 'tick 1 output missing');
  harness.run();
  harness.controller.advance();
  assert(harness.state.tick === 2 && !harness.state.uiTextDirty && !harness.state.uiMenuDirty, 'tick 2 output unexpectedly dirty');
  harness.run();
  harness.state.runtime.tick = 5;
  harness.state.tick = 5;
  harness.controller.advance();
  assert(harness.state.tick === 6 && harness.state.uiTextDirty && harness.state.uiMenuDirty, 'tick 6 output missing');
});

check('same-revision A-B-A stale step cannot clear or advance the new epoch', () => {
  const harness = createHarness();
  harness.controller.recalculate('input', 0.64);
  harness.revisionInput = { analysisHash: 1, lambdaRaw: 50, target: 'A', mode: 'orbit', triggerToken: 'seed' };
  harness.controller.initialize();
  const revisionA = harness.state.revision;
  const epochA = harness.state.runtimeEpoch;
  assert(harness.controller.scheduleStep() === true, 'A callback missing');

  harness.revisionInput = { analysisHash: 1, lambdaRaw: 50, target: 'B', mode: 'orbit', triggerToken: 'seed' };
  harness.controller.initialize();
  harness.revisionInput = { analysisHash: 1, lambdaRaw: 50, target: 'A', mode: 'orbit', triggerToken: 'seed' };
  harness.controller.initialize();
  assert(harness.state.revision === revisionA, 'A revision was not deterministic');
  assert(harness.state.runtimeEpoch === epochA + 2, 'A-B-A epochs did not advance');
  const currentEpoch = harness.state.runtimeEpoch;
  assert(harness.controller.scheduleStep() === true, 'new A callback blocked by old lock');
  assert(harness.queue.length === 2, `callbacks=${harness.queue.length}`);
  assert(harness.state.stepScheduledEpoch === currentEpoch, 'new step lock owner missing');

  harness.run(0);
  assert(harness.calls.steps.length === 0 && harness.calls.applies.length === 0, 'old A callback advanced new A runtime');
  assert(harness.state.tick === 0, 'old A callback changed tick');
  assert(harness.state.stepScheduled && harness.state.stepScheduledEpoch === currentEpoch, 'old A callback cleared new lock');
  harness.run(0);
  assert(harness.calls.steps.length === 1 && harness.calls.applies.length === 1, 'current A callback did not advance once');
  assert(harness.calls.steps[0].runtime.serial === 3, 'stale runtime instance was stepped');
  assert(harness.state.tick === 1 && !harness.state.stepScheduled, 'current step did not release its lock');
});

check('stale UI callback preserves the new lock and same-epoch bursts coalesce', () => {
  const harness = createHarness();
  harness.controller.recalculate('input', 0.64);
  harness.controller.initialize();
  assert(harness.controller.scheduleUi('old', false) === true, 'old UI callback missing');
  const oldEpoch = harness.state.runtimeEpoch;
  harness.controller.initialize();
  const newEpoch = harness.state.runtimeEpoch;
  assert(newEpoch === oldEpoch + 1, 'UI epoch did not advance');
  assert(harness.controller.scheduleUi('new', true) === true, 'new UI callback blocked by stale lock');
  assert(harness.controller.scheduleUi('newest', false) === false, 'same-epoch UI burst did not coalesce');
  assert(harness.queue.length === 2, `UI callbacks=${harness.queue.length}`);
  assert(harness.state.uiScheduledEpoch === newEpoch && harness.state.uiPayloadEpoch === newEpoch, 'new UI ownership missing');

  harness.run(0);
  assert(harness.calls.flushes.length === 0, 'stale UI callback rendered');
  assert(harness.state.uiScheduled && harness.state.uiScheduledEpoch === newEpoch, 'stale UI callback cleared new lock');
  assert(harness.state.uiEvent === 'newest' && harness.state.uiTextDirty, 'stale UI callback cleared new payload');
  harness.run(0);
  same(harness.calls.flushes[0], { textDirty: true, menuDirty: true, event: 'newest' }, 'coalesced UI payload changed');
  same(harness.calls.flushStates[0], {
    textDirty: true,
    menuDirty: true,
    event: 'newest',
    payloadEpoch: newEpoch,
  }, 'UI payload cleared before flush');
  assert(!harness.state.uiScheduled && harness.state.uiScheduledEpoch === null, 'current UI lock not released');
  assert(!harness.state.uiTextDirty && !harness.state.uiMenuDirty && harness.state.uiEvent === '', 'current UI payload not cleared');
  assert(harness.state.uiPayloadEpoch === null, 'current UI epoch tag not cleared');
});

check('failed UI flush retains payload for a later callback', () => {
  let shouldThrow = true;
  const harness = createHarness({
    flushUi() {
      if (shouldThrow) throw new Error('render failed');
    },
  });
  harness.controller.recalculate('input', 0.64);
  harness.controller.initialize();
  harness.controller.scheduleUi('retry', true);
  let error = null;
  try {
    harness.run();
  } catch (caught) {
    error = caught;
  }
  assert(error && error.message === 'render failed', 'flush failure was hidden');
  assert(!harness.state.uiScheduled && harness.state.uiScheduledEpoch === null, 'failed callback retained its lock');
  assert(harness.state.uiPayloadEpoch === harness.state.runtimeEpoch, 'failed flush cleared payload epoch');
  assert(harness.state.uiTextDirty && harness.state.uiMenuDirty && harness.state.uiEvent === 'retry', 'failed flush cleared payload');
  shouldThrow = false;
  assert(harness.controller.scheduleUi('', false) === true, 'retained payload could not be rescheduled');
  harness.run();
  assert(harness.calls.flushes.length === 2, 'retained payload was not retried');
  assert(harness.state.uiPayloadEpoch === null && harness.state.uiEvent === '', 'successful retry did not clear payload');
});

check('BLOCKED runtime never steps, while a blocked result is recorded without world effects', () => {
  const initiallyBlocked = createHarness({
    createResult(input) {
      return { kind: 'FakeReactionRuntime', status: 'BLOCKED', code: 'CREATE_BLOCKED', revision: input.revision, tick: 0 };
    },
  });
  initiallyBlocked.controller.recalculate('input', 0.64);
  initiallyBlocked.controller.initialize();
  assert(initiallyBlocked.controller.advance() === null, 'already BLOCKED runtime advanced');
  assert(initiallyBlocked.calls.steps.length === 0 && initiallyBlocked.calls.applies.length === 0, 'already BLOCKED runtime produced work');

  const worldEffects = [];
  const blockedStep = createHarness({
    stepResult(runtime, input) {
      return {
        state: { ...runtime, status: 'BLOCKED', code: 'STEP_BLOCKED', tick: input.tick },
        status: 'BLOCKED',
        code: 'STEP_BLOCKED',
        events: [],
        effects: [],
      };
    },
    applyResult(result) {
      if (result.status !== 'BLOCKED') worldEffects.push(...result.effects);
      return `blocked:${result.code}`;
    },
  });
  blockedStep.controller.recalculate('input', 0.64);
  blockedStep.controller.initialize();
  const result = blockedStep.controller.advance();
  assert(result && result.status === 'BLOCKED', 'blocked result was not returned');
  assert(blockedStep.state.runtime.status === 'BLOCKED' && blockedStep.state.tick === 1, 'blocked state was not recorded');
  assert(blockedStep.calls.applies.length === 1, 'blocked adapter did not receive result message');
  assert(worldEffects.length === 0, 'BLOCKED result applied world effects');
  assert(blockedStep.state.uiEvent === 'blocked:STEP_BLOCKED', 'BLOCKED message was not queued');
  assert(blockedStep.controller.advance() === null && blockedStep.calls.steps.length === 1, 'BLOCKED state stepped twice');
});

check('snapshot is delegated and identical scenarios are deterministic', () => {
  function scenario() {
    const harness = createHarness();
    const field = harness.controller.recalculate('deterministic input', 0.64);
    harness.controller.initialize();
    const snap = harness.controller.snapshot();
    harness.runtimeInput = { running: true, worldTick: 144, lambda: 0.64, particles: [{ id: 'p0', u: 0.5 }] };
    harness.controller.scheduleStep();
    harness.run();
    harness.run();
    return {
      field: plain(field),
      revision: harness.state.revision,
      snapshot: snap,
      creates: plain(harness.calls.creates),
      steps: plain(harness.calls.steps),
      flushes: plain(harness.calls.flushes),
      state: {
        epoch: harness.state.runtimeEpoch,
        tick: harness.state.tick,
        runtimeMs: harness.state.runtimeMs,
        runtime: plain(harness.state.runtime),
      },
    };
  }
  const first = scenario();
  const second = scenario();
  assert(first.snapshot.kind === 'FakeObservedSnapshot', 'snapshot was not delegated');
  same(first, second, 'same inputs produced different kernel trace');
});

check('source is static classic JavaScript with no host or dynamic hazards', () => {
  assert((source.match(/MRDP78ReactionKernel/g) || []).length === 1, 'kernel export count changed');
  assert(!/\bdocument\b|getElementById|querySelector|createElement/.test(source), 'host tree access found');
  assert(!/\bcanvas\b|getContext\s*\(/i.test(source), 'drawing surface access found');
  assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b/.test(source), 'network API found');
  assert(!/https?:\/\//i.test(source), 'external URL found');
  assert(!/\beval\s*\(|\bnew\s+Function\b/.test(source), 'dynamic evaluation found');
  assert(!/\brequestAnimationFrame\b|\brequestIdleCallback\b|\bsetTimeout\b/.test(source), 'host scheduler access found');
  assert(!/\bDate\.now\b|\bperformance\b/.test(source), 'host clock access found');
  assert(!/\bmodule\.exports\b|\brequire\s*\(|\bimport\s*\(|\bexport\s+/.test(source), 'module loader syntax found');
  assert(!/JSON\.(?:parse|stringify)/.test(source), 'JSON cloning found in kernel');
  new vm.Script(source, { filename });
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
