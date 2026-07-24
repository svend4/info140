'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', 'lib', 'semantic-asymmetric-balance.js');
const source = fs.readFileSync(sourcePath, 'utf8');
global.window = global;
require(sourcePath);
const balance = global.MRDSemanticAsymmetricBalance;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function close(actual, expected, tolerance = 1e-12) {
  return Math.abs(actual - expected) <= tolerance;
}

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

check('classic API is complete, frozen and versioned', () => {
  assert(balance && balance.version === '1.0.0' && Object.isFrozen(balance), 'API export is missing or mutable');
  ['crossState', 'buildFlags', 'rankTransitions', 'aggregate'].forEach((name) => assert(typeof balance[name] === 'function', `${name} is missing`));
});

check('three exact corners expose 3D, 1D and forward 2D', () => {
  const center = balance.crossState(1, 1);
  const edge = balance.crossState(0, 0);
  const orbit = balance.crossState(1, 0);
  assert(center.components.p3d === 1 && center.dominant === '3d', 'center corner changed');
  assert(edge.components.p1d === 1 && edge.dominant === '1d', 'edge corner changed');
  assert(orbit.components.p2dForward === 1 && orbit.components.p2d === 1 && orbit.direction === 'forward', 'forward orbit corner changed');
});

check('cross components are a bounded partition of one', () => {
  const state = balance.crossState(.85, .20);
  assert(state.status === 'READY' && state.contract.inv.ok, 'state is not READY');
  assert(close(state.components.p3d, .17) && close(state.components.p1d, .12), 'extreme components changed');
  assert(close(state.components.p2dForward, .68) && close(state.components.p2dReverse, .03), 'directional components changed');
  assert(close(state.components.p2d, .71) && close(state.sum, 1), 'partition does not sum to one');
  return `3D=${state.components.p3d}; 2D=${state.components.p2d}; 1D=${state.components.p1d}`;
});

check('swapping cross weights reverses direction but preserves total 2D', () => {
  const forward = balance.crossState(.85, .20);
  const reverse = balance.crossState(.20, .85);
  assert(forward.direction === 'forward' && reverse.direction === 'reverse', 'direction did not reverse');
  assert(close(forward.components.p2d, reverse.components.p2d), 'total 2D changed under swap');
  assert(close(forward.components.p3d, reverse.components.p3d) && close(forward.components.p1d, reverse.components.p1d), 'extremes changed under swap');
});

check('invalid cross weights fail closed', () => {
  [[-1, 0], [0, 2], [NaN, .5], ['.5', .5], [null, .5]].forEach(([x, y]) => {
    const state = balance.crossState(x, y);
    assert(state.status === 'INVALID' && state.code === 'ASYMMETRIC_INPUT_RANGE' && !state.components, `accepted invalid ${x},${y}`);
  });
});

check('explicit pair builder evaluates only injected cross relations', () => {
  const weights = new Map([
    ['topic>support-b', .85],
    ['detail>support-a', .20],
  ]);
  const pack = balance.buildFlags([
    { id: 'a', a: 'topic', b: 'support-a' },
    { id: 'b', a: 'detail', b: 'support-b' },
  ], { weight: (from, to) => weights.get(`${from}>${to}`) ?? 0 });
  assert(pack.status === 'READY' && pack.flagCount === 1, 'flag builder did not produce one comparison');
  assert(pack.flags[0].state.direction === 'forward' && close(pack.flags[0].state.components.p2d, .71), 'cross relation changed');
});

check('pair builder rejects missing, duplicate and out-of-range evidence', () => {
  assert(balance.buildFlags([], {}).status === 'ABSTAIN', 'thin pair set did not abstain');
  assert(balance.buildFlags([{ id: 'a', a: 1, b: 2 }, { id: 'a', a: 3, b: 4 }], { weight: () => .5 }).code === 'ASYMMETRIC_PAIR_DUPLICATE', 'duplicate ids were accepted');
  assert(balance.buildFlags([{ id: 'a', a: 1, b: 2 }, { id: 'b', a: 3, b: 4 }], { weight: () => 2 }).code === 'ASYMMETRIC_WEIGHT_RANGE', 'invalid weight was accepted');
});

check('ranking follows the declared continuation formula deterministically', () => {
  const items = [
    { id: 'b', x: .70, y: .25, semFit: .8, novelty: .7, guardAfter: .9, conflictRisk: .1, confidence: .8 },
    { id: 'a', x: .85, y: .20, semFit: .9, novelty: .8, guardAfter: .95, conflictRisk: .05, confidence: .9 },
  ];
  const first = balance.rankTransitions(items);
  const second = balance.rankTransitions(items);
  const expected = .71 * .9 * .8 * .95 * .95;
  assert(first.status === 'READY' && first.items[0].id === 'a', 'best transition changed');
  assert(close(first.items[0].score, expected), 'continuation score formula changed');
  assert(first.items.every((item) => item.status === 'SCORED'), 'unrequested thresholds became actionable');
  assert(JSON.stringify(first) === JSON.stringify(second), 'ranking is nondeterministic');
});

check('explicit thresholds distinguish eligible and blocked scores', () => {
  const pack = balance.rankTransitions([
    { id: 'orbit', x: .9, y: .1, semFit: .9, novelty: .9, guardAfter: .9, conflictRisk: .05 },
    { id: 'closed', x: .98, y: .98, semFit: 1, novelty: 1, guardAfter: .9, conflictRisk: 0 },
  ], { thresholds: { minScore: .25, minGuardAfter: .5, maxCenter: .8, maxEdge: .8 } });
  const orbit = pack.items.find((item) => item.id === 'orbit');
  const closed = pack.items.find((item) => item.id === 'closed');
  assert(orbit.status === 'ELIGIBLE', 'directed orbit was not eligible');
  assert(closed.status === 'BLOCKED' && closed.reasons.includes('center'), 'closed state did not hit center limit');
  assert(pack.eligibleCount === 1, 'eligible count changed');
});

check('weighted aggregate preserves the partition and ignores zero confidence', () => {
  const items = [
    { x: .85, y: .20, confidence: .75 },
    { x: .20, y: .85, confidence: .25 },
    { x: 1, y: 1, confidence: 0 },
  ];
  const before = JSON.stringify(items);
  const pack = balance.aggregate(items);
  assert(pack.status === 'READY' && pack.used === 2 && pack.ignoredZeroWeight === 1, 'aggregate counts changed');
  assert(close(pack.sum, 1) && pack.contract.inv.ok, 'aggregate partition is invalid');
  assert(pack.direction === 'forward' && close(pack.components.p2d, .71), 'weighted direction changed');
  assert(JSON.stringify(items) === before, 'aggregate mutated its input');
});

check('browser IIFE is static and has no DOM, network or action side effects', () => {
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'dynamic evaluation is forbidden');
  ['document.', 'fetch(', 'XMLHttpRequest', 'condition.value', 'transaction.commit', 'ledger.record'].forEach((token) => {
    assert(!source.includes(token), `side effect token found: ${token}`);
  });
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: sourcePath }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  assert(sandbox.MRDSemanticAsymmetricBalance.version === '1.0.0', 'browser export is missing');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
