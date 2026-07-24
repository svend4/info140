'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const modules = ['semantic-core', 'semantic-reaction-rules', 'semantic-reaction-field', 'semantic-reaction-runtime'];
global.window = global;
modules.forEach((name) => require(lib(name)));

const fieldEngine = global.MRDSemanticReactionField;
const runtime = global.MRDSemanticReactionRuntime;
const rulebook = global.MRDSemanticReactionRules;
const SOURCE = 'Смысл и деталь строят мост, чтобы продолжить движение по кругу.';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return value;
}

function finiteDeep(value, seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  Object.entries(value).forEach(([key, item]) => {
    if (typeof item === 'number') assert(Number.isFinite(item), `non-finite ${key}=${item}`);
    else finiteDeep(item, seen);
  });
}

function collect(root, names, out = [], seen = new Set()) {
  if (!root || typeof root !== 'object' || seen.has(root)) return out;
  seen.add(root);
  Object.entries(root).forEach(([key, value]) => {
    if (names.includes(key) && typeof value === 'string') out.push(value);
    if (value && typeof value === 'object') collect(value, names, out, seen);
  });
  return out;
}

function makeField() {
  const field = fieldEngine.simulate(SOURCE, 0.5);
  assert(field && field.kind === 'MRDSemanticReactionField', 'forecast field unavailable');
  return field;
}

function descriptorIndexes(field) {
  return field.particles.map((particle) => particle.index);
}

function differentIndex(field, current, offset = 1) {
  const values = descriptorIndexes(field);
  for (let i = 0; i < values.length; i += 1) {
    const value = values[(i + offset) % values.length];
    if (value !== current) return value;
  }
  throw new Error('field needs at least two token descriptors');
}

function particle(field, id, tokenIndex, x, y, extra = {}) {
  const descriptor = field.particles.find((item) => item.index === tokenIndex) || {};
  return {
    id,
    tokenIndex,
    token: descriptor.token || `p${id}`,
    x,
    y,
    u: extra.u == null ? 0.62 : extra.u,
    reactionRole: extra.reactionRole || descriptor.reactionRole || 'carrier',
    baseReactionRole: extra.baseReactionRole || descriptor.baseReactionRole || 'carrier',
    semanticRole: descriptor.semanticRole || 'neutral',
    q: extra.q == null ? 0 : extra.q,
    act: extra.act == null ? 0.95 : extra.act,
    thr: extra.thr == null ? 0.12 : extra.thr,
    mass: 1,
    ...extra,
  };
}

function seedParticle(field, id, x, y, extra = {}) {
  return particle(field, id, field.trigger.index, x, y, {
    reactionRole: 'seed',
    baseReactionRole: 'catalyst',
    ...extra,
  });
}

function createState(revision, field, particles, options = {}) {
  const state = runtime.create({
    revision,
    field,
    particles,
    options: {
      radius: 0.06,
      cellSize: 0.025,
      tickBudget: 4,
      candidateBudget: 96,
      pairBudget: 1200,
      cascadeBudget: 12,
      maxGeneration: 3,
      cooldown: 2,
      activationDelay: 1,
      cascadeTTL: 90,
      rearmAfter: 30,
      historyLimit: 24,
      ...options,
    },
  });
  assert(state.status !== 'BLOCKED', `create blocked: ${state.code}`);
  return state;
}

function stepState(state, revision, tick, particles, lambda = 0.5) {
  const result = runtime.step(state, { revision, tick, worldTick: tick * 48, lambda, particles });
  assert(result.status !== 'BLOCKED', `tick ${tick} blocked: ${result.code}`);
  assert(result.invariants && result.invariants.ok, `tick ${tick} invariants failed`);
  return result;
}

function applyEffects(particles, result) {
  const next = particles.map((item) => ({ ...item }));
  result.effects.forEach((effect) => {
    const target = next.find((item) => item.id === effect.targetId);
    if (target) target.u = effect.afterU;
  });
  return next;
}

function pairOf(event) {
  return `${event.sourceId}->${event.targetId}`;
}

function blocked(result, codePart) {
  assert(result.status === 'BLOCKED', `expected BLOCKED, got ${result.status}`);
  assert(result.events.length === 0 && result.effects.length === 0, 'blocked step emitted effects');
  assert(String(result.code).includes(codePart), `code=${result.code}, expected ${codePart}`);
}

function normalizedEvent(event) {
  return {
    origin: event.origin,
    parentEventId: event.parentEventId,
    tick: event.tick,
    generation: event.generation,
    ruleId: event.ruleId,
    selectionReason: event.selectionReason,
    sourceId: event.sourceId,
    targetId: event.targetId,
    force: event.force,
    distance: event.distance,
    preStateHash: event.preStateHash,
  };
}

function causalTrace(revision, lambdaAtFirst = 0.5) {
  const field = makeField();
  const a = field.trigger.index;
  const b = differentIndex(field, a, 1);
  const c = differentIndex(field, b, 2);
  let particles = [
    seedParticle(field, 10, 0, 0),
    particle(field, 11, b, 0.04, 0),
    particle(field, 12, c, 0.12, 0),
  ];
  let state = createState(revision, field, particles, { radius: 0.055, tickBudget: 1 });
  const first = stepState(state, revision, 1, particles, lambdaAtFirst);
  state = first.state;
  particles = applyEffects(particles, first).map((item) => item.id === 10 ? { ...item, x: -0.5, y: -0.5 } : item.id === 12 ? { ...item, x: 0.08 } : item);
  const second = stepState(state, revision, 2, particles, 0.5);
  return { field, particles, state: second.state, first, second };
}

function arbitrationRun(order) {
  const field = makeField();
  const indexes = descriptorIndexes(field);
  while (indexes.length < 5) indexes.push(indexes.length);
  const raw = [
    particle(field, 1, indexes[0], 0.00, 0.00, { reactionRole: 'seed', baseReactionRole: 'catalyst' }),
    particle(field, 2, indexes[1], 0.10, 0.00),
    particle(field, 3, indexes[2], 0.05, 0.00),
    particle(field, 4, indexes[3], 0.00, 0.025),
    particle(field, 5, indexes[4], 0.10, 0.025),
  ];
  const particles = order ? order.map((index) => raw[index]) : raw;
  const created = createState('arb', field, particles, { radius: 0.065, tickBudget: 2 });
  const state = clone(created);
  state.mode = 'orbit';
  state.nodes.forEach((node) => {
    node.tags = ['same'];
    node.q = 0;
    node.act = 0.95;
    node.baseAct = 0.95;
    node.thr = 0.12;
    node.reactionRole = node.id === 1 ? 'seed' : 'carrier';
    node.baseReactionRole = node.id === 1 ? 'catalyst' : 'carrier';
    node.generation = node.id <= 2 ? 0 : null;
    node.activeAt = 0;
    node.cd = 0;
  });
  return stepState(state, 'arb', 1, particles);
}

function pairLocalTrace() {
  const field = {
    kind: 'MRDSemanticReactionField',
    lambda: 0.5,
    mode: 'orbit',
    formula: 'pair-local regression',
    trigger: { index: 0, signal: 0 },
    particles: [
      { index: 0, token: 'seed', reactionRole: 'seed', baseReactionRole: 'catalyst', semanticRole: 'bridge', act: 1, thr: 0.12, u: 0.50, mass: 1 },
      { index: 1, token: 'whole', reactionRole: 'synth', baseReactionRole: 'synth', semanticRole: 'core', act: 1, thr: 0.12, u: 0.65, mass: 1 },
      { index: 2, token: 'piece', reactionRole: 'fragment', baseReactionRole: 'fragment', semanticRole: 'detail', act: 1, thr: 0.12, u: 0.55, mass: 1 },
      { index: 3, token: 'next', reactionRole: 'carrier', baseReactionRole: 'carrier', semanticRole: 'neutral', act: 1, thr: 0.12, u: 0.45, mass: 1 },
    ],
  };
  let particles = field.particles.map((descriptor, index) => ({
    id: index,
    tokenIndex: index,
    token: descriptor.token,
    x: index * 0.04,
    y: 0,
    u: descriptor.u,
    reactionRole: descriptor.reactionRole,
    baseReactionRole: descriptor.baseReactionRole,
    semanticRole: descriptor.semanticRole,
    act: 1,
    thr: 0.12,
    mass: 1,
  }));
  let state = createState('pair-local', field, particles, {
    radius: 0.05,
    cellSize: 0.025,
    tickBudget: 1,
    candidateBudget: 20,
    pairBudget: 30,
    cascadeBudget: 6,
    maxGeneration: 3,
    cooldown: 2,
    activationDelay: 1,
  });
  const events = [];
  for (let tick = 1; tick <= 3; tick += 1) {
    const result = stepState(state, 'pair-local', tick, particles);
    events.push(...result.events);
    particles = applyEffects(particles, result);
    state = result.state;
  }
  return { events, state, particles };
}

function calibrationArbitration(enabled = true) {
  const field = {
    kind: 'MRDSemanticReactionField',
    lambda: 0.5,
    mode: 'orbit',
    formula: 'calibration regression',
    trigger: { index: 0, signal: 0 },
    events: [{ direction: 'orbit' }, { direction: 'detail' }],
    metrics: { directionCounts: { generalize: 0, detail: 1, orbit: 1, repair: 0 } },
    particles: [
      { index: 0, token: 'seed', reactionRole: 'seed', baseReactionRole: 'catalyst', semanticRole: 'bridge', act: 1, thr: 0.12, u: 0.50, mass: 1 },
      { index: 1, token: 'orbit-target', reactionRole: 'carrier', baseReactionRole: 'carrier', semanticRole: 'neutral', act: 1, thr: 0.12, u: 0.55, mass: 1 },
      { index: 2, token: 'fragment-source', reactionRole: 'fragment', baseReactionRole: 'fragment', semanticRole: 'detail', act: 1, thr: 0.12, u: 0.60, mass: 1 },
      { index: 3, token: 'detail-target', reactionRole: 'carrier', baseReactionRole: 'carrier', semanticRole: 'neutral', act: 1, thr: 0.12, u: 0.55, mass: 1 },
    ],
  };
  const particles = field.particles.map((descriptor, index) => ({
    id: index,
    tokenIndex: index,
    token: descriptor.token,
    x: index < 2 ? index * 0.04 : 0.50 + (index - 2) * 0.04,
    y: 0,
    u: descriptor.u,
    reactionRole: descriptor.reactionRole,
    baseReactionRole: descriptor.baseReactionRole,
    semanticRole: descriptor.semanticRole,
    act: 1,
    thr: 0.12,
    mass: 1,
  }));
  const state = clone(createState('calibration', field, particles, {
    radius: 0.05,
    cellSize: 0.025,
    tickBudget: 1,
    candidateBudget: 20,
    pairBudget: 30,
    cascadeBudget: 6,
    maxGeneration: 3,
    cooldown: 2,
    activationDelay: 1,
    calibrationGain: enabled ? 0.12 : 0,
    calibrationPriority: enabled ? 20 : 0,
  }));
  state.nodes.forEach((node) => {
    node.tags = ['same'];
    node.q = 0;
    node.act = 1;
    node.baseAct = 1;
    node.thr = 0.12;
    node.cd = 0;
    node.activeAt = 0;
    node.generation = node.id === 0 || node.id === 2 ? 0 : null;
    node.reactionRole = node.id === 0 ? 'seed' : node.id === 2 ? 'fragment' : 'carrier';
    node.baseReactionRole = node.id === 0 ? 'catalyst' : node.id === 2 ? 'fragment' : 'carrier';
  });
  state.metrics.directionCounts = { generalize: 0, detail: 0, orbit: 8, repair: 0 };
  state.metrics.totalEvents = 8;
  state.metrics.directionSampleSize = 8;
  state.metrics.directionDivergence = state.directionProfile.target.detail;
  return stepState(state, 'calibration', 1, particles);
}

function handoffArbitration(enabled = true) {
  const field = {
    kind: 'MRDSemanticReactionField',
    lambda: 0.5,
    mode: 'orbit',
    formula: 'handoff regression',
    trigger: { index: 0, signal: 0 },
    events: [{ direction: 'orbit' }, { direction: 'detail' }],
    metrics: { directionCounts: { generalize: 0, detail: 1, orbit: 1, repair: 0 } },
    particles: [
      { index: 0, token: 'seed', reactionRole: 'seed', baseReactionRole: 'catalyst', semanticRole: 'bridge', act: 1, thr: 0.12, u: 0.50, mass: 1 },
      { index: 1, token: 'carrier-target', reactionRole: 'carrier', baseReactionRole: 'carrier', semanticRole: 'neutral', act: 1, thr: 0.12, u: 0.55, mass: 1 },
      { index: 2, token: 'fragment-target', reactionRole: 'fragment', baseReactionRole: 'fragment', semanticRole: 'detail', act: 1, thr: 0.12, u: 0.60, mass: 1 },
      { index: 3, token: 'detail-next', reactionRole: 'carrier', baseReactionRole: 'carrier', semanticRole: 'neutral', act: 1, thr: 0.12, u: 0.55, mass: 1 },
    ],
  };
  let particles = field.particles.map((descriptor, index) => ({
    id: index,
    tokenIndex: index,
    token: descriptor.token,
    x: index === 0 ? 0 : index === 1 ? 0.04 : index === 2 ? -0.04 : -0.08,
    y: 0,
    u: descriptor.u,
    reactionRole: descriptor.reactionRole,
    baseReactionRole: descriptor.baseReactionRole,
    semanticRole: descriptor.semanticRole,
    act: 1,
    thr: 0.12,
    mass: 1,
  }));
  const state = clone(createState('handoff', field, particles, {
    radius: 0.05,
    cellSize: 0.025,
    tickBudget: 1,
    candidateBudget: 20,
    pairBudget: 30,
    cascadeBudget: 6,
    maxGeneration: 3,
    cooldown: 2,
    activationDelay: 1,
    calibrationGain: enabled ? 0.12 : 0,
    calibrationPriority: enabled ? 20 : 0,
  }));
  state.nodes.forEach((node) => {
    node.tags = ['same'];
    node.q = 0;
    node.act = 1;
    node.baseAct = 1;
    node.thr = 0.12;
    node.cd = 0;
    node.activeAt = 0;
    node.generation = node.id === 0 ? 0 : null;
  });
  state.metrics.directionCounts = { generalize: 0, detail: 0, orbit: 8, repair: 0 };
  state.metrics.totalEvents = 8;
  state.metrics.directionSampleSize = 8;
  const first = stepState(state, 'handoff', 1, particles);
  particles = applyEffects(particles, first);
  const second = stepState(first.state, 'handoff', 2, particles);
  return { first, second };
}

function denseBase(field) {
  const indexes = descriptorIndexes(field);
  return Array.from({ length: 280 }, (_, id) => {
    const column = id % 20;
    const row = Math.floor(id / 20);
    const tokenIndex = id === 0 ? field.trigger.index : indexes[id % indexes.length];
    return particle(field, id, tokenIndex, -0.475 + column * 0.05, -0.325 + row * 0.05, {
      u: 0.24 + (id % 11) * 0.05,
      reactionRole: id === 0 ? 'seed' : undefined,
      baseReactionRole: id === 0 ? 'catalyst' : undefined,
    });
  });
}

function denseFrame(base, state, tick) {
  const nodes = new Map(state.nodes.map((node) => [node.id, node]));
  return base.map((item) => {
    const node = nodes.get(item.id);
    return {
      ...item,
      x: item.x + Math.sin((tick + item.id) * 0.013) * 0.004,
      y: item.y + Math.cos((tick * 0.011) + item.id) * 0.004,
      u: node ? node.u : item.u,
    };
  });
}

const checks = [];
function check(name, run) {
  try {
    const detail = run() || '';
    checks.push({ ok: true, name, detail });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

assert(runtime && fieldEngine, 'reaction runtime dependencies missing');
['create', 'step', 'snapshot', 'windowAt'].forEach((name) => assert(typeof runtime[name] === 'function', `runtime.${name} missing`));

check('API_IMMUTABLE_STATE', () => {
  const field = makeField();
  const other = differentIndex(field, field.trigger.index);
  const particles = [seedParticle(field, 1, 0, 0), particle(field, 2, other, 0.04, 0, { u: 0.70 })];
  const state = createState('api', field, particles);
  const stateBytes = JSON.stringify(state);
  const particleBytes = JSON.stringify(particles);
  const result = stepState(state, 'api', 1, particles);
  assert(JSON.stringify(state) === stateBytes, 'step mutated its input state');
  assert(JSON.stringify(particles) === particleBytes, 'step mutated particle snapshot');
  assert(result.state !== state && result.events.length === 1, 'step did not return a new firing state');
  const snapshot = runtime.snapshot(result.state);
  assert(snapshot.kind === 'MRDSemanticReactionRuntimeSnapshot' && snapshot.origin === 'observed', 'public snapshot invalid');
});

check('GRID_COMPLETE', () => {
  const field = makeField();
  const other = differentIndex(field, field.trigger.index);
  const particles = [seedParticle(field, 1, 0.199, 0.40), particle(field, 2, other, 0.301, 0.40)];
  const state = createState('grid', field, particles, { radius: 0.135, cellSize: 0.05, tickBudget: 1 });
  const result = stepState(state, 'grid', 1, particles);
  assert(result.events.length === 1, 'cross-cell contact was missed');
  assert(pairOf(result.events[0]) === '1->2', `pair=${pairOf(result.events[0])}`);
  assert(Math.abs(result.events[0].distance - 0.102) < 1e-6, `distance=${result.events[0].distance}`);
});

check('NON_LOCAL_AND_STALE', () => {
  const field = makeField();
  const other = differentIndex(field, field.trigger.index);
  const particles = [seedParticle(field, 1, 0, 0), particle(field, 2, other, 0.9, 0.9)];
  const state = createState('stale', field, particles);
  const quiet = stepState(state, 'stale', 1, particles);
  assert(quiet.events.length === 0 && quiet.metrics.candidateChecks === 0, 'non-local pair reacted');
  const before = JSON.stringify(quiet.state);
  blocked(runtime.step(quiet.state, { revision: 'stale', tick: 1, lambda: 0.5, particles }), 'TICK');
  blocked(runtime.step(quiet.state, { revision: 'wrong', tick: 2, lambda: 0.5, particles }), 'REVISION');
  blocked(runtime.step(quiet.state, { revision: 'stale', tick: 2, lambda: 0.5, particles: particles.slice(0, 1) }), 'STALE');
  assert(JSON.stringify(quiet.state) === before, 'blocked calls mutated valid state');
});

check('COOLDOWN_EXACT', () => {
  const field = makeField();
  const i0 = field.trigger.index;
  const i1 = differentIndex(field, i0, 1);
  const i2 = differentIndex(field, i1, 2);
  let particles = [
    seedParticle(field, 1, 0, 0),
    particle(field, 2, i1, 0.04, 0),
    particle(field, 3, i2, 0.8, 0.8),
  ];
  let state = createState('cool', field, particles, { cooldown: 2, maxGeneration: 1, tickBudget: 1 });
  const first = stepState(state, 'cool', 1, particles);
  assert(first.events.length === 1 && pairOf(first.events[0]) === '1->2', 'initial fire failed');
  state = first.state;
  particles = applyEffects(particles, first).map((item) => item.id === 2 ? { ...item, x: 0.8, y: 0.8 } : item.id === 3 ? { ...item, x: 0.04, y: 0 } : item);
  const plusOne = stepState(state, 'cool', 2, particles);
  const plusTwo = stepState(plusOne.state, 'cool', 3, particles);
  const plusThree = stepState(plusTwo.state, 'cool', 4, particles);
  assert(plusOne.events.length === 0, 'cooldown did not block t+1');
  assert(plusTwo.events.length === 0, 'cooldown did not block t+2');
  assert(plusThree.events.length === 1 && pairOf(plusThree.events[0]) === '1->3', 'cooldown did not permit t+3');
});

check('GLOBAL_ARBITRATION', () => {
  const result = arbitrationRun();
  const pairs = result.events.map(pairOf).sort();
  assert(pairs.join(',') === '1->4,2->5', `global pairs=${pairs.join(',')}`);
  const touched = result.events.flatMap((event) => [event.sourceId, event.targetId]);
  assert(new Set(touched).size === touched.length, 'one particle was used twice');
  for (let i = 1; i < result.events.length; i += 1) {
    const previous = result.events[i - 1];
    const current = result.events[i];
    assert(previous.priority > current.priority || previous.force >= current.force, 'accepted events are not globally ordered');
  }
});

check('ORDER_INVARIANCE', () => {
  const a = arbitrationRun();
  const b = arbitrationRun([4, 2, 0, 3, 1]);
  assert(JSON.stringify(a.events.map(normalizedEvent)) === JSON.stringify(b.events.map(normalizedEvent)), 'event trace depends on input order');
  assert(JSON.stringify(a.metrics) === JSON.stringify(b.metrics), 'metrics depend on input order');
});

check('CAUSAL_COUNTERFACTUAL', () => {
  const factual = causalTrace('cause');
  assert(factual.first.events.length === 1 && factual.second.events.length === 1, 'causal handoff missing');
  const parent = factual.first.events[0];
  const child = factual.second.events[0];
  assert(pairOf(parent) === '10->11' && pairOf(child) === '11->12', 'causal particle handoff invalid');
  assert(parent.parentEventId == null, 'seed event has a parent');
  assert(child.parentEventId === parent.eventId, 'child does not cite its activating event');
  assert(parent.tick < child.tick, 'child propagated in the same tick');
  const counter = causalTrace('counter', 0.05);
  assert(counter.first.events.length === 0 && counter.second.events.length === 0, 'counterfactual inactive source propagated');
});

check('DRY_LIVE_BOUNDARY', () => {
  const field = makeField();
  field.origin = 'forecast';
  const other = differentIndex(field, field.trigger.index);
  const particles = [seedParticle(field, 1, 0, 0), particle(field, 2, other, 0.04, 0, { u: 0.72 })];
  const fieldBytes = JSON.stringify(field);
  const particleBytes = JSON.stringify(particles);
  deepFreeze(field);
  deepFreeze(particles);
  const state = createState('boundary', field, particles);
  const result = stepState(state, 'boundary', 1, particles);
  assert(JSON.stringify(field) === fieldBytes && JSON.stringify(particles) === particleBytes, 'runtime mutated forecast inputs');
  assert(result.events[0].origin === 'observed' && result.effects[0].origin === 'observed', 'live output is not marked observed');
  assert(result.events[0].origin !== field.origin, 'forecast and observed origins collapsed');
  assert(result.events[0].afterU !== result.events[0].beforeU, 'observed effect did not change particle state');
});

check('RESET_REPLAY', () => {
  const first = causalTrace('replay');
  const second = causalTrace('replay');
  const trace = (value) => [value.first, value.second].map((result) => result.events.map(normalizedEvent));
  assert(JSON.stringify(trace(first)) === JSON.stringify(trace(second)), 'same revision did not replay identically');
  const before = JSON.stringify(first.state);
  blocked(runtime.step(first.state, { revision: 'new', tick: 3, lambda: 0.5, particles: first.particles }), 'REVISION');
  assert(JSON.stringify(first.state) === before, 'revision mismatch mutated old state');
  const reset = createState('new', first.field, [
    seedParticle(first.field, 10, 0, 0),
    particle(first.field, 11, differentIndex(first.field, first.field.trigger.index), 0.04, 0),
  ]);
  assert(reset.sequence === 0 && reset.history.length === 0 && Object.keys(reset.lineage).length === 0, 'new revision retained lineage');
  assert(reset.nodes.every((node) => node.activationEventId == null), 'new revision retained node parent');
});

check('TYPED_CONTRACT_EVIDENCE', () => {
  const trace = causalTrace('contract');
  [trace.first.events[0], trace.second.events[0]].forEach((event) => {
    assert(event.contract.pre.ok && event.contract.inv.ok && event.contract.post.ok, 'event contract failed');
    assert(event.portPath === `${event.inputPort} -> ${event.outputPort} -> STATE<PARTICLE_FIELD>`, 'typed path invalid');
    assert(event.preStateHash && event.eventId && event.revision === 'contract', 'event identity evidence missing');
    assert(event.distanceSquared <= event.radius * event.radius + 1e-9, 'non-local event accepted');
  });
  const observed = [trace.state, trace.first, trace.second, runtime.snapshot(trace.state)];
  observed.forEach((value) => {
    const evidence = collect(value, ['evidence', 'evidenceLevel']);
    const soundness = collect(value, ['soundness']);
    assert(evidence.length && evidence.every((item) => item === 'STRUCTURAL'), 'evidence escaped STRUCTURAL');
    assert(soundness.length && soundness.every((item) => item === 'NOT_COMPUTED'), 'soundness escaped NOT_COMPUTED');
  });
});

check('HETEROGENEOUS_ONLY', () => {
  const field = makeField();
  const index = field.trigger.index;
  const particles = [
    seedParticle(field, 1, 0, 0),
    particle(field, 2, index, 0.02, 0),
    particle(field, 3, differentIndex(field, index), 0.04, 0),
  ];
  const state = createState('hetero', field, particles, { tickBudget: 1 });
  const result = stepState(state, 'hetero', 1, particles);
  assert(result.events.length === 1 && result.events[0].targetId === 3, 'same-token copy reacted instead of a different token');
  assert(result.metrics.homogeneousRejected >= 1, 'homogeneous rejection was not observed');
});

check('PAIR_LOCAL_POLICY', () => {
  const trace = pairLocalTrace();
  assert(trace.events.length === 3, 'event count='+trace.events.length);
  assert(trace.events.map((event) => event.ruleId).join(',') === 'R_CATALYZE,R_SYNTH,R_FRAGMENT', 'rule sequence='+trace.events.map((event) => event.ruleId).join(','));
  assert(trace.events.map((event) => event.selectionReason).join(',') === 'source:seed,source:synth,source:fragment', 'reason sequence='+trace.events.map((event) => event.selectionReason).join(','));
  assert(trace.events[1].deltaU < 0 && trace.events[2].deltaU > 0, 'local directions did not control deltaU');
  trace.events.forEach((event) => {
    assert(event.selectionInput && event.selectionInput.sourceBaseRole, 'selection input missing');
    assert(rulebook.validateEvent(event).ok, 'event policy validation failed for '+event.ruleId);
  });
  assert(trace.state.rulePolicyVersion === rulebook.policyVersion, 'runtime policy identity mismatch');
  assert(trace.state.metrics.directionCounts.orbit === 1 && trace.state.metrics.directionCounts.generalize === 1 && trace.state.metrics.directionCounts.detail === 1, 'direction metrics='+JSON.stringify(trace.state.metrics.directionCounts));
  return trace.events.map((event) => event.ruleId+'['+event.selectionReason+']').join(' -> ');
});

check('DIRECTION_CALIBRATION', () => {
  assert(runtime.defaults.opportunityDecay === 0.92, 'opportunity decay default changed');
  const explicitGeneralize = runtime.directionProfile({ mode: 'generalize', events: [{ direction: 'detail' }], particles: [{ baseReactionRole: 'fragment' }] });
  const explicitDetail = runtime.directionProfile({ mode: 'detail', events: [{ direction: 'generalize' }], particles: [{ baseReactionRole: 'synth' }] });
  assert(explicitGeneralize.source === 'explicit' && explicitGeneralize.target.generalize === 1, 'explicit generalize target was diluted');
  assert(explicitDetail.source === 'explicit' && explicitDetail.target.detail === 1, 'explicit detail target was diluted');
  const baseline = calibrationArbitration(false);
  const result = calibrationArbitration(true);
  assert(baseline.events.length === 1 && baseline.events[0].ruleId === 'R_CATALYZE', 'uncalibrated counterexample did not prefer orbit');
  assert(result.events.length === 1, 'calibration event count='+result.events.length);
  const event = result.events[0];
  assert(event.sourceId === 2 && event.ruleId === 'R_FRAGMENT', 'underrepresented fragment was not selected');
  assert(event.calibrationReason === 'direction:underrepresented' && event.calibrationDebt === 1, 'calibration evidence is incomplete');
  assert(event.rawForce < event.force && event.calibrationMultiplier > 1 && event.calibrationMultiplier <= 1.12, 'force calibration escaped its bound');
  assert(event.effectivePriority > event.priority && event.effectivePriority <= event.priority + 20, 'priority calibration escaped its bound');
  assert(event.expectedDirectionShare > 0 && event.observedDirectionShareBefore === 0, 'target/observation evidence is wrong');
  assert(result.metrics.directionDivergence < baseline.metrics.directionDivergence, 'calibration did not improve the uncalibrated counterexample');
  assert(result.metrics.directionDivergence < result.state.directionProfile.target.detail, 'direction divergence did not decrease');
  assert(result.metrics.directionOpportunitySampleSize > 0 && result.attemptsSummary.eligibleOpportunities > 0, 'eligible opportunity sample is missing');
  assert(Math.abs(Object.values(result.metrics.directionReachableProfile).reduce((sum, value) => sum + value, 0) - 1) < 1e-5, 'reachable opportunity profile is not normalized');
  assert(result.metrics.directionAvailabilityDivergence >= 0 && result.metrics.directionAvailabilityDivergence <= 1, 'availability divergence escaped bounds');
  assert(result.metrics.directionControlDivergence >= 0 && result.metrics.directionControlDivergence <= 1, 'control divergence escaped bounds');
  assert(rulebook.validateEvent(event).ok && result.invariants.ok, 'calibration violated the typed runtime contract');
  const baselineRoute = handoffArbitration(false);
  const calibratedRoute = handoffArbitration(true);
  assert(baselineRoute.first.events[0].targetId === 1, 'uncalibrated route counterexample changed');
  assert(calibratedRoute.first.events[0].targetId === 2, 'handoff did not activate the underrepresented fragment type');
  assert(calibratedRoute.first.events[0].calibrationReason === 'handoff:underrepresented' && calibratedRoute.first.events[0].handoffDirection === 'detail', 'handoff evidence is incomplete');
  assert(calibratedRoute.first.metrics.lastHandoffOpportunities.detail > 0 && calibratedRoute.first.metrics.handoffOpportunityProfile.detail > 0, 'detail handoff opportunity was not measured');
  assert(calibratedRoute.second.events.length === 1 && calibratedRoute.second.events[0].ruleId === 'R_FRAGMENT', 'handoff did not produce the next local detail event');
  return 'detail debt='+event.calibrationDebt+'; divergence='+result.metrics.directionDivergence+'; handoff=fragment';
});

check('DENSE_1000_TICKS', () => {
  const field = makeField();
  const base = denseBase(field);
  const options = {
    radius: 0.055,
    cellSize: 0.025,
    tickBudget: 3,
    candidateBudget: 80,
    pairBudget: 700,
    cascadeBudget: 9,
    cooldown: 2,
    cascadeTTL: 60,
    rearmAfter: 12,
    historyLimit: 12,
  };
  let state = createState('dense', field, base, options);
  let totalEvents = 0;
  let maxPairs = 0;
  let maxCandidates = 0;
  for (let tick = 1; tick <= 1000; tick += 1) {
    const frame = denseFrame(base, state, tick);
    const result = stepState(state, 'dense', tick, frame);
    assert(result.metrics.pairChecks <= options.pairBudget, `tick ${tick}: pair budget`);
    assert(result.metrics.candidateChecks <= options.candidateBudget, `tick ${tick}: candidate budget`);
    assert(result.events.length <= options.tickBudget, `tick ${tick}: event budget`);
    assert(result.state.history.length <= options.historyLimit, `tick ${tick}: history bound`);
    assert(result.metrics.mass === 280, `tick ${tick}: mass=${result.metrics.mass}`);
    assert(result.metrics.minU > 0.18 && result.metrics.maxU < 0.82, `tick ${tick}: u escaped`);
    assert(result.metrics.directionOpportunitySampleSize <= options.candidateBudget / (1 - runtime.defaults.opportunityDecay) + 1, 'opportunity window is unbounded');
    finiteDeep(result.metrics);
    totalEvents += result.events.length;
    maxPairs = Math.max(maxPairs, result.metrics.pairChecks);
    maxCandidates = Math.max(maxCandidates, result.metrics.candidateChecks);
    state = result.state;
  }
  assert(state.tick === 1000, `final tick=${state.tick}`);
  assert(totalEvents > 0 && totalEvents <= 3000, `total events=${totalEvents}`);
  finiteDeep(state);
  return `events=${totalEvents}; pairs<=${maxPairs}; candidates<=${maxCandidates}`;
});

check('BROWSER_IIFE_NO_EVAL', () => {
  const source = fs.readFileSync(lib('semantic-reaction-runtime'), 'utf8');
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'dynamic evaluation is forbidden');
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  modules.forEach((name) => {
    const filename = lib(name);
    new vm.Script(fs.readFileSync(filename, 'utf8'), { filename }).runInContext(context, { timeout: 2000 });
  });
  assert(sandbox.MRDSemanticReactionRuntime.version === '2.6.0', 'browser export/version missing');
  assert(sandbox.MRDSemanticReactionRuntime.rulePolicyVersion === '1.0.0', 'browser policy version missing');
  assert(typeof sandbox.MRDSemanticReactionRuntime.directionProfile === 'function', 'browser direction profile API missing');
});

checks.forEach((result) => {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
});
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
