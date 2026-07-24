'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const canonicalPath = path.join(root, 'lib', 'p78-canonical-json.js');
const registryPath = path.join(root, 'lib', 'p78-formula-registry.js');
const enginePath = path.join(root, 'lib', 'p78-formula-engine.js');
const sourcePaths = [canonicalPath, registryPath, enginePath];

sourcePaths.forEach((file) => require(file));

const Canonical = global.MRDP78CanonicalJSON;
const Registry = global.MRDP78FormulaRegistry;
const Engine = global.MRDP78FormulaEngine;
const checks = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  assert(actual === expected, `${message}: ${actual} !== ${expected}`);
}

function approx(actual, expected, tolerance, message) {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);
}

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true, detail: '' });
  } catch (error) {
    checks.push({ name, ok: false, detail: error && error.stack ? error.stack : String(error) });
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function independentCanonical(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(independentCanonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${independentCanonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError(`unsupported ${typeof value}`);
}

function nodeHashText(text) {
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function nodeHashCanonical(value) {
  return nodeHashText(independentCanonical(value));
}

function rehashRecord(record) {
  const payload = clone(record);
  delete payload.contentHash;
  record.contentHash = nodeHashCanonical(payload);
  return record;
}

function registryEnvelope(records) {
  const envelope = {
    schema: 'meridian.formula-registry/1',
    version: '1.0.0',
    records
  };
  envelope.registryHash = nodeHashCanonical(envelope);
  return envelope;
}

function deeplyFrozen(value, seen = new WeakSet()) {
  if ((value === null) || (typeof value !== 'object' && typeof value !== 'function')) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => deeplyFrozen(value[key], seen));
}

function expectErrorCode(fn, code, message) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  assert(caught && caught.code === code, `${message}: ${caught && caught.code}`);
}

function typedInputs(record, values) {
  const result = {};
  record.inputs.forEach((port) => { result[port.name] = Engine.makeTypedValue(port, values[port.name]); });
  return result;
}

function indexBefore(order, first, second) {
  return order.indexOf(first) !== -1 && order.indexOf(first) < order.indexOf(second);
}

check('versioned classic-global APIs are complete and deeply frozen', () => {
  assert(Canonical && Canonical.version === '1.0.0', 'canonical API missing');
  assert(Registry && Registry.version === '1.0.0' && Registry.status === 'READY', 'registry API missing');
  assert(Engine && Engine.version === '1.0.0' && Engine.status === 'READY', 'engine API missing');
  ['canonicalize', 'hashCanonical', 'copyAndFreeze'].forEach((name) => assert(typeof Canonical[name] === 'function', `${name} missing`));
  ['createRegistry', 'verifyRegistry', 'getFormula', 'activeFormulas'].forEach((name) => assert(typeof Registry[name] === 'function', `${name} missing`));
  ['makeTypedValue', 'unknownValue', 'evaluateFormula', 'planDAG', 'planNext', 'runRingMatryoshka'].forEach((name) => assert(typeof Engine[name] === 'function', `${name} missing`));
  assert(deeplyFrozen(Canonical) && deeplyFrozen(Registry) && deeplyFrozen(Engine), 'public API is mutable');
});

check('canonical JSON and UTF-8 SHA-256 agree with node:crypto', () => {
  const sampleA = { z: [3, 'Я', true], a: { beta: 2, alpha: -0 } };
  const sampleB = { a: { alpha: 0, beta: 2 }, z: [3, 'Я', true] };
  const expectedCanonical = independentCanonical(sampleA);
  equal(Canonical.canonicalize(sampleA), expectedCanonical, 'canonical serializer differs');
  equal(Canonical.canonicalize(sampleB), expectedCanonical, 'key insertion order leaked');
  equal(Canonical.hashCanonical(sampleA), nodeHashCanonical(sampleA), 'canonical SHA differs from node:crypto');
  equal(Canonical.hashText('abc'), 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'known SHA vector changed');
  equal(Canonical.hashText('P78 / Я / 🙂'), nodeHashText('P78 / Я / 🙂'), 'UTF-8 SHA differs from node:crypto');
});

check('canonical data copy is isolated, frozen, and rejects unsafe values', () => {
  const source = { b: { c: [1, 2] }, a: 'x' };
  const frozen = Canonical.copyAndFreeze(source);
  source.b.c[0] = 9;
  equal(frozen.b.c[0], 1, 'deep copy aliases source');
  assert(deeplyFrozen(frozen), 'copy is not deeply frozen');
  expectErrorCode(() => Canonical.canonicalize({ n: Infinity }), 'NON_FINITE_NUMBER', 'Infinity accepted');
  expectErrorCode(() => Canonical.canonicalize({ bad: undefined }), 'NON_JSON_VALUE', 'undefined accepted');
  expectErrorCode(() => Canonical.canonicalize('\ud800'), 'INVALID_UNICODE', 'unpaired surrogate accepted');
  const cyclic = {}; cyclic.self = cyclic;
  expectErrorCode(() => Canonical.canonicalize(cyclic), 'CYCLIC_VALUE', 'cycle accepted');
  class Box { constructor() { this.value = 1; } }
  expectErrorCode(() => Canonical.deepCopy(new Box()), 'NON_JSON_VALUE', 'class instance accepted');
});

check('registry schemas, independent hashes, SemVer, and formula inventory are exact', () => {
  equal(Registry.registry.schema, 'meridian.formula-registry/1', 'registry schema changed');
  assert(Registry.registry.records.length >= 10 && Registry.registry.records.length <= 20, Registry.registry.records.length);
  assert(/^sha256:[0-9a-f]{64}$/.test(Registry.registryHash), 'registry hash format invalid');
  const registryPayload = clone(Registry.registry);
  delete registryPayload.registryHash;
  equal(Registry.registryHash, nodeHashCanonical(registryPayload), 'registry hash differs from independent SHA');
  const expectedIds = [
    'ring.balance', 'pressure.closure', 'pressure.edge', 'pressure.orbit-forward', 'pressure.orbit-reverse',
    'pressure.orbit-total', 'pressure.partition', 'pressure.direction', 'pressure.margin', 'vitality.snapshot-geomean'
  ].sort();
  const activeIds = Registry.activeFormulas(Registry.registry).map((record) => record.formulaId);
  expectedIds.forEach((id) => assert(activeIds.includes(id), id));
  Registry.registry.records.forEach((record) => {
    equal(record.schema, 'meridian.formula/1', `${record.formulaId} schema changed`);
    assert(/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(record.version), `${record.formulaId} version is not SemVer`);
    assert(record.lifecycle === 'ACTIVE' && record.contract.deterministic, `${record.formulaId} is not deterministic ACTIVE`);
    const payload = clone(record); delete payload.contentHash;
    equal(record.contentHash, nodeHashCanonical(payload), `${record.formulaId} independent contentHash mismatch`);
    [...record.inputs, record.output].forEach((port) => {
      ['valueType', 'unit', 'dimension', 'measureKind', 'interval'].forEach((field) => assert(Object.prototype.hasOwnProperty.call(port, field), `${record.formulaId}.${port.name}.${field} missing`));
    });
  });
  assert(deeplyFrozen(Registry.registry), 'registry snapshot is mutable');
});

check('dependencies are fully pinned and registry replay verifies', () => {
  Registry.registry.records.forEach((record) => {
    record.dependencies.forEach((dependency) => {
      assert(dependency.formula.formulaId && dependency.formula.version, `${record.formulaId} dependency identity incomplete`);
      assert(/^sha256:[0-9a-f]{64}$/.test(dependency.formula.contentHash), `${record.formulaId} dependency hash unpinned`);
      const target = Registry.getFormula(Registry.registry, dependency.formula.formulaId, dependency.formula.version);
      equal(dependency.formula.contentHash, target.contentHash, `${record.formulaId} dependency hash drift`);
    });
  });
  const replay = Registry.verifyRegistry(clone(Registry.registry));
  assert(replay.status === 'READY' && replay.registry.registryHash === Registry.registryHash, 'registry replay failed');
  assert(deeplyFrozen(replay), 'registry verification result is mutable');
});

check('corruption and rehashed unknown operations fail closed', () => {
  const corrupted = clone(Registry.registry);
  const balance = corrupted.records.find((record) => record.formulaId === 'ring.balance');
  balance.expression.args[0].value = 5;
  const rejected = Registry.verifyRegistry(corrupted);
  assert(rejected.status === 'INVALID' && rejected.code === 'FORMULA_HASH_MISMATCH', `corruption code=${rejected.code}`);

  const unknown = clone(Registry.getFormula(Registry.registry, 'pressure.closure'));
  unknown.formulaId = 'test.unknown-operation';
  unknown.title = 'Unknown operation';
  unknown.expression.operation = 'execute-arbitrary';
  rehashRecord(unknown);
  const forged = Registry.verifyRegistry(registryEnvelope([unknown]));
  assert(forged.status === 'INVALID' && forged.code === 'AST_INVALID', `unknown operation code=${forged.code}`);
  const executed = Engine.evaluateFormula(registryEnvelope([unknown]), unknown.formulaId, typedInputs(unknown, { x: 0.5, y: 0.5 }));
  assert(executed.status === 'INVALID' && executed.output === null, 'invalid registry produced a number');
});

check('closed AST executes Let, If, Tuple, Call, Input, Literal, and FormulaRef', () => {
  const base = Registry.getFormula(Registry.registry, 'ring.balance');
  const literalType = clone(base.expression.args[0].type);
  literalType.interval = { min: 0.5, max: 0.5, closedMin: true, closedMax: true };

  const control = clone(base);
  control.formulaId = 'test.control-flow';
  control.title = 'Control flow';
  control.expression = {
    node: 'Let', name: 'v', value: { node: 'Input', port: 'u' },
    body: {
      node: 'If',
      test: { node: 'Call', operation: 'gte', args: [{ node: 'Input', port: 'v' }, { node: 'Literal', value: 0.5, type: literalType }] },
      then: { node: 'Call', operation: 'complement', args: [{ node: 'Input', port: 'v' }] },
      else: { node: 'Input', port: 'v' }
    }
  };
  control.implementation.maxOperations = 20;
  rehashRecord(control);

  const tuple = clone(base);
  tuple.formulaId = 'test.tuple';
  tuple.title = 'Tuple';
  tuple.output.valueType = 'Tuple';
  tuple.output.measureKind = 'PureNumber';
  tuple.output.interval = null;
  tuple.expression = { node: 'Tuple', items: [{ node: 'Input', port: 'u' }, { node: 'Literal', value: 0.5, type: literalType }] };
  tuple.implementation.maxOperations = 10;
  rehashRecord(tuple);

  const custom = Registry.createRegistry([control, tuple]);
  const low = Engine.evaluateFormula(custom, control.formulaId, typedInputs(control, { u: 0.25 }));
  const high = Engine.evaluateFormula(custom, control.formulaId, typedInputs(control, { u: 0.75 }));
  const pair = Engine.evaluateFormula(custom, tuple.formulaId, typedInputs(tuple, { u: 0.25 }));
  assert(low.status === 'READY' && high.status === 'READY', 'Let/If formula failed');
  approx(low.output.value, 0.25, 0, 'false branch changed');
  approx(high.output.value, 0.25, 0, 'true branch changed');
  equal(JSON.stringify(pair.output.value), JSON.stringify([0.25, 0.5]), 'Tuple result changed');
  const composite = Engine.evaluateFormula('pressure.partition', typedInputs(Registry.getFormula(Registry.registry, 'pressure.partition'), { x: 0.85, y: 0.2 }));
  assert(composite.status === 'READY' && composite.trace.nodes.length === 5, 'FormulaRef composition failed');
});

check('typed boundaries distinguish status and never repair invalid input', () => {
  const record = Registry.getFormula(Registry.registry, 'ring.balance');
  const port = record.inputs[0];
  const ready = Engine.evaluateFormula('ring.balance', { u: Engine.makeTypedValue(port, 0.25) });
  const partial = Engine.evaluateFormula('ring.balance', {});
  const abstain = Engine.evaluateFormula('ring.balance', { u: Engine.unknownValue(port) });

  const intSpec = clone(port); intSpec.valueType = 'Int';
  const invalidType = Engine.evaluateFormula('ring.balance', { u: Engine.makeTypedValue(intSpec, 0) });
  const pressurePort = Registry.getFormula(Registry.registry, 'pressure.closure').output;
  const invalidMeasure = Engine.evaluateFormula('ring.balance', { u: Engine.makeTypedValue(pressurePort, 0.25) });
  const unitSpec = clone(port); unitSpec.unit = 'rad';
  const invalidUnit = Engine.evaluateFormula('ring.balance', { u: Engine.makeTypedValue(unitSpec, 0.25) });
  const wideSpec = clone(port); wideSpec.interval.max = 2;
  const invalidDomain = Engine.evaluateFormula('ring.balance', { u: Engine.makeTypedValue(wideSpec, 1.25) });

  equal(ready.status, 'READY', 'READY missing');
  equal(partial.status, 'PARTIAL', 'missing value is not PARTIAL');
  equal(abstain.status, 'ABSTAIN', 'UNKNOWN did not abstain');
  assert(invalidType.status === 'INVALID' && invalidType.code === 'TYPE_MISMATCH', `type code=${invalidType.code}`);
  assert(invalidMeasure.status === 'INVALID' && invalidMeasure.code === 'MEASURE_KIND_MISMATCH', `measure code=${invalidMeasure.code}`);
  assert(invalidUnit.status === 'INVALID' && invalidUnit.code === 'UNIT_CONVERSION_MISSING', `unit code=${invalidUnit.code}`);
  assert(invalidDomain.status === 'INVALID' && invalidDomain.code === 'DOMAIN_VIOLATION' && invalidDomain.output === null, 'domain value was clamped or evaluated');
  expectErrorCode(() => Engine.makeTypedValue(port, NaN), 'TYPE_MISMATCH', 'NaN accepted');
  expectErrorCode(() => Engine.makeTypedValue(port, Infinity), 'TYPE_MISMATCH', 'Infinity accepted');
});

check('formula values match the normative ring example', () => {
  const run = Engine.runRingMatryoshka({ x: 0.85, y: 0.2 });
  assert(run.status === 'READY', `run code=${run.code}`);
  approx(run.summary.closure, 0.17, 1e-15, 'closure');
  approx(run.summary.edge, 0.12, 1e-15, 'edge');
  approx(run.summary.orbitForward, 0.68, 1e-15, 'orbit forward');
  approx(run.summary.orbitReverse, 0.03, 1e-15, 'orbit reverse');
  approx(run.summary.partition, 1, 1e-15, 'partition');
  approx(run.summary.orbitTotal, 0.71, 1e-15, 'orbit total');
  approx(run.summary.direction, 0.65, 1e-15, 'direction');
  approx(run.summary.margin, 0.54, 1e-15, 'margin');

  const balance = Registry.getFormula(Registry.registry, 'ring.balance');
  [
    [0, 0], [0.25, 0.75], [0.5, 1], [0.75, 0.75], [1, 0]
  ].forEach(([u, expected]) => {
    const result = Engine.evaluateFormula('ring.balance', { u: Engine.makeTypedValue(balance.inputs[0], u) });
    assert(result.status === 'READY', `balance(${u}) failed`);
    approx(result.output.value, expected, 1e-15, `balance(${u})`);
  });
});

check('all pressure formulas execute independently with finite values', () => {
  const expected = {
    'pressure.closure': 0.17,
    'pressure.edge': 0.12,
    'pressure.orbit-forward': 0.68,
    'pressure.orbit-reverse': 0.03,
    'pressure.orbit-total': 0.71,
    'pressure.partition': 1,
    'pressure.direction': 0.65,
    'pressure.margin': 0.54
  };
  Object.entries(expected).forEach(([id, value]) => {
    const record = Registry.getFormula(Registry.registry, id);
    const result = Engine.evaluateFormula(id, typedInputs(record, { x: 0.85, y: 0.2 }));
    assert(result.status === 'READY' && Number.isFinite(result.output.value), `${id} failed`);
    approx(result.output.value, value, 1e-15, id);
  });
});

check('partition uses explicit FLOAT64 tolerance across the closed square', () => {
  const values = [0, 0.25, 0.5, 0.75, 1];
  const partition = Registry.getFormula(Registry.registry, 'pressure.partition');
  assert(partition.contract.numericPolicy.mode === 'FLOAT64', 'partition mode is not FLOAT64');
  assert(partition.contract.numericPolicy.absoluteTolerance > 0 && partition.contract.numericPolicy.relativeTolerance > 0, 'partition tolerance is implicit');
  values.forEach((x) => values.forEach((y) => {
    const run = Engine.runRingMatryoshka({ x, y });
    assert(run.status === 'READY', `run(${x},${y})=${run.status}`);
    assert(Engine.approximatelyEqual(run.summary.partition, 1, run.summary.numericPolicy), `partition(${x},${y})=${run.summary.partition}`);
    assert(run.summary.partitionApproximatelyOne && run.summary.partitionDelta <= 2e-12, 'partition evidence changed');
  }));
});

check('snapshot vitality formula remains a distinct finite heuristic', () => {
  const record = Registry.getFormula(Registry.registry, 'vitality.snapshot-geomean');
  const result = Engine.evaluateFormula(record.formulaId, typedInputs(record, {
    growth: 0.81,
    novelty: 0.64,
    openness: 0.25,
    balance: 1
  }));
  assert(result.status === 'READY' && result.formula.formulaId === 'vitality.snapshot-geomean', 'vitality formula identity missing');
  approx(result.output.value, 0.36, 1e-15, 'snapshot vitality');
  assert(result.semanticTruth === false && result.soundness === 'NOT_COMPUTED', 'vitality overstates truth');
});

check('DAG planner is stable, dependency-first, and cycle rejecting', () => {
  const first = Engine.planDAG(['pressure.partition', 'pressure.margin']);
  const second = Engine.planDAG(['pressure.margin', 'pressure.partition']);
  assert(first.status === 'READY' && second.status === 'READY', 'DAG plan failed');
  equal(first.formulaOrder.join('|'), second.formulaOrder.join('|'), 'root order changed topological order');
  const order = first.formulaOrder;
  assert(indexBefore(order, 'pressure.orbit-forward', 'pressure.orbit-total'), 'forward dependency follows total');
  assert(indexBefore(order, 'pressure.orbit-reverse', 'pressure.orbit-total'), 'reverse dependency follows total');
  assert(indexBefore(order, 'pressure.orbit-total', 'pressure.margin'), 'total dependency follows margin');
  assert(indexBefore(order, 'pressure.closure', 'pressure.partition'), 'closure dependency follows partition');

  function cycleRecord(id, target) {
    const record = clone(Registry.getFormula(Registry.registry, 'pressure.closure'));
    record.formulaId = id;
    record.title = id;
    record.expression = {
      node: 'FormulaRef', formulaId: target, version: '1.0.0',
      bindings: { x: { node: 'Input', port: 'x' }, y: { node: 'Input', port: 'y' } }
    };
    record.dependencies = [{
      kind: 'USES',
      formula: { formulaId: target, version: '1.0.0', contentHash: `sha256:${'0'.repeat(64)}` },
      bindings: { x: 'x', y: 'y' }
    }];
    record.implementation.maxOperations = 20;
    return rehashRecord(record);
  }
  expectErrorCode(() => Registry.createRegistry([cycleRecord('test.cycle-a', 'test.cycle-b'), cycleRecord('test.cycle-b', 'test.cycle-a')]), 'DEPENDENCY_CYCLE', 'cycle was not rejected');
});

check('operation budget blocks instead of returning a partial number', () => {
  const record = Registry.getFormula(Registry.registry, 'ring.balance');
  const input = { u: Engine.makeTypedValue(record.inputs[0], 0.5) };
  const blocked = Engine.evaluateFormula('ring.balance', input, { maxOperations: 4 });
  assert(blocked.status === 'BLOCKED' && blocked.code === 'BUDGET_EXCEEDED', `budget status=${blocked.status}/${blocked.code}`);
  assert(blocked.output === null && blocked.trace.nodes.some((node) => node.status === 'BLOCKED'), 'budget failure leaked output or trace status');
});

check('next-formula planner applies stable tie-breaks and abstains on bad measures', () => {
  const closure = Registry.getFormula(Registry.registry, 'pressure.closure');
  const values = typedInputs(closure, { x: 0.4, y: 0.6 });
  const state = { schema: 'meridian.formula-state/1', revision: 'r1', values, lineage: [], openGoals: [], budget: { maxOperations: 100 } };
  const first = Engine.planNext(state);
  const second = Engine.planNext(clone(state));
  assert(first.status === 'READY' && first.selected.formulaId === 'pressure.closure', `selected=${first.selected && first.selected.formulaId}`);
  equal(JSON.stringify(first), JSON.stringify(second), 'planner replay changed');
  assert(first.alternatives.every((item) => item.formula.formulaId && item.rankTuple.length === 4), 'illegal alternative found');

  const pressureValue = Engine.makeTypedValue(closure.output, 0.5);
  const wrong = Engine.planNext({ values: { x: pressureValue, y: pressureValue }, lineage: [], openGoals: [], budget: { maxOperations: 100 } });
  assert(wrong.status === 'ABSTAIN' && wrong.alternatives.length === 0, 'bad measure produced a candidate');
});

check('ring matryoshka exposes exact trace/current/next/summary boundaries', () => {
  const run = Engine.runRingMatryoshka({ x: 0.85, y: 0.2 });
  const expectedOrder = [
    'pressure.closure', 'pressure.edge', 'pressure.orbit-forward', 'pressure.orbit-reverse',
    'pressure.partition', 'pressure.orbit-total', 'pressure.direction', 'pressure.margin'
  ];
  equal(run.trace.formulaOrder.join('|'), expectedOrder.join('|'), 'matryoshka trace order changed');
  equal(run.current.formula.formulaId, 'pressure.partition', 'current formula changed');
  equal(run.next.selected.formulaId, 'pressure.orbit-total', 'stable next formula changed');
  equal(run.nextFormula.contentHash, run.next.selected.contentHash, 'next formula pin changed');
  assert(run.trace.nodes.every((node) => node.status === 'READY' && node.outputHash && node.semanticTruth === false), 'trace node evidence/status invalid');
  assert(run.evidence === 'STRUCTURAL' && run.soundness === 'NOT_COMPUTED' && run.semanticTruth === false, 'run overstates evidence');
  assert(/^sha256:[0-9a-f]{64}$/.test(run.trace.traceId), 'deterministic trace hash missing');
});

check('status vocabulary is observable through ring entry points', () => {
  const closure = Registry.getFormula(Registry.registry, 'pressure.closure');
  const partial = Engine.runRingMatryoshka({ x: 0.5 });
  const unknown = Engine.runRingMatryoshka({ x: Engine.unknownValue(closure.inputs[0]), y: 0.5 });
  const pressureValue = Engine.makeTypedValue(closure.output, 0.5);
  const abstain = Engine.runRingMatryoshka({ x: pressureValue, y: pressureValue });
  const invalid = Engine.runRingMatryoshka({ x: 2, y: 0.5 });
  const blocked = Engine.runRingMatryoshka({ x: 0.5, y: 0.5 }, { maxOperations: 1 });
  equal(partial.status, 'PARTIAL', 'PARTIAL missing');
  equal(unknown.status, 'ABSTAIN', 'UNKNOWN ABSTAIN missing');
  equal(abstain.status, 'ABSTAIN', 'typed ABSTAIN missing');
  equal(invalid.status, 'INVALID', 'INVALID missing');
  equal(blocked.status, 'BLOCKED', 'BLOCKED missing');
});

check('replay is deterministic, input-preserving, and deeply immutable', () => {
  const input = { x: 0.137, y: 0.863 };
  const before = JSON.stringify(input);
  const first = Engine.runRingMatryoshka(input);
  const serialized = JSON.stringify(first);
  for (let i = 0; i < 8; i += 1) equal(JSON.stringify(Engine.runRingMatryoshka(input)), serialized, `replay ${i + 1} changed`);
  equal(JSON.stringify(input), before, 'input mutated');
  assert(deeplyFrozen(first), 'run result is mutable');
  assert(deeplyFrozen(Engine.evaluateFormula('pressure.partition', first.inputs)), 'formula result is mutable');
});

check('library sources contain no host, dynamic-code, clock, random, or loader hazards', () => {
  const source = sourcePaths.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const forbidden = [
    /\bdocument\b/, /\bwindow\b/, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b/,
    /https?:\/\//i, /\beval\s*\(/, /\bnew\s+Function\b/, /\bDate\b/, /\bperformance\b/,
    /Math\.random\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/,
    /\bmodule\.exports\b/, /\brequire\s*\(/, /\bimport\s*\(/, /\bexport\s+/
  ];
  forbidden.forEach((pattern) => assert(!pattern.test(source), `forbidden source pattern ${pattern}`));
  assert(sourcePaths.every((file) => fs.readFileSync(file, 'utf8').startsWith('(function(global){')), 'classic IIFE wrapper missing');
  assert(sourcePaths.every((file) => /typeof globalThis/.test(fs.readFileSync(file, 'utf8'))), 'globalThis fallback missing');

  const sandbox = {};
  vm.createContext(sandbox);
  sourcePaths.forEach((file) => vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: path.basename(file) }));
  const isolated = sandbox.MRDP78FormulaEngine.runRingMatryoshka({ x: 0.85, y: 0.2 });
  assert(isolated.status === 'READY' && isolated.summary.partition === 1, 'isolated browser-style execution failed');
  equal(isolated.trace.traceId, Engine.runRingMatryoshka({ x: 0.85, y: 0.2 }).trace.traceId, 'isolated trace changed');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? `\n${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
