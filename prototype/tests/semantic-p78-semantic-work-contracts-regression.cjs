'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
require(lib('p78-canonical-json'));
require(lib('p78-semantic-work-contracts'));

const Canonical = global.MRDP78CanonicalJSON;
const Contracts = global.MRDP78SemanticWorkContracts;
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
function hash(label) { return Canonical.hashText(label); }
function runFixture(overrides = {}) {
  return Contracts.createRun({
    inputHash: hash('input'),
    policyHash: hash('policy'),
    sourceSetHash: hash('sources'),
    budget: { maxOperations: 1200, maxCandidates: 16, maxMilliseconds: 800 },
    ...overrides,
  });
}
function workFixture(run, overrides = {}) {
  return Contracts.createWorkItem(run, {
    operatorId: 'INPUT', lane: 'SOURCE', ordinal: 0, dependsOn: [],
    inputRefs: [run.inputHash], state: 'SHIPPED', epoch: 1,
    outputHash: hash('normalized input'), reasonCodes: [], ...overrides,
  });
}

check('API is immutable, versioned and contains only bounded 2D work vocabulary', () => {
  assert.equal(Contracts.status, 'READY');
  assert.equal(Contracts.version, '1.0.1');
  assert(Object.isFrozen(Contracts) && Object.isFrozen(Contracts.limits));
  assert.deepEqual(Contracts.operators, ['INPUT', 'PARSE', 'DISCOVER', 'ALIGN', 'REVIEW']);
  assert(!Contracts.operators.includes('COMMIT'));
});

check('SemanticRun is deterministic across insertion order and deeply frozen', () => {
  const a = runFixture();
  const b = Contracts.createRun({
    sourceSetHash: hash('sources'), policyHash: hash('policy'), inputHash: hash('input'),
    budget: { maxMilliseconds: 800, maxCandidates: 16, maxOperations: 1200 },
  });
  assert.equal(a.runId, b.runId);
  assert.equal(a.contentHash, b.contentHash);
  assert(Object.isFrozen(a) && Object.isFrozen(a.budget));
  assert.equal(Contracts.validateRun(a).status, 'VALID');
});

check('budgets are strict positive integers inside published limits', () => {
  assert.throws(() => runFixture({ budget: { maxOperations: 0, maxCandidates: 1, maxMilliseconds: 1 } }), /BOUNDED_INTEGER_REQUIRED/);
  assert.throws(() => runFixture({ budget: { maxOperations: 1, maxCandidates: 10001, maxMilliseconds: 1 } }), /BOUNDED_INTEGER_REQUIRED/);
  assert.throws(() => runFixture({ budget: { maxOperations: 1.5, maxCandidates: 1, maxMilliseconds: 1 } }), /BOUNDED_INTEGER_REQUIRED/);
  assert.throws(() => Contracts.createRun({ ...runFixture(), extra: true }), /UNKNOWN_FIELD/);
});

check('work identity and fencing token are deterministic but epoch-sensitive', () => {
  const run = runFixture();
  const first = workFixture(run);
  const replay = workFixture(run);
  const nextEpoch = workFixture(run, { epoch: 2 });
  assert.equal(first.workId, replay.workId);
  assert.equal(first.contentHash, replay.contentHash);
  assert.equal(first.workId, nextEpoch.workId);
  assert.notEqual(first.fencingToken, nextEpoch.fencingToken);
  assert.notEqual(first.contentHash, nextEpoch.contentHash);
  assert.equal(Contracts.validateWorkItem(first).status, 'VALID');
});

check('work dependencies and references must be sorted unique content hashes', () => {
  const run = runFixture();
  const reversed = [hash('a'), hash('b')].sort().reverse();
  assert.throws(() => workFixture(run, { inputRefs: reversed }), /ARRAY_NOT_SORTED_UNIQUE/);
  assert.throws(() => workFixture(run, { dependsOn: [hash('same'), hash('same')] }), /ARRAY_NOT_SORTED_UNIQUE/);
  assert.throws(() => workFixture(run, { inputRefs: ['not-a-hash'] }), /HASH_REQUIRED/);
});

check('state transitions carry explicit output or parking reason', () => {
  const run = runFixture();
  assert.throws(() => workFixture(run, { outputHash: null }), /SHIPPED_OUTPUT_REQUIRED/);
  assert.throws(() => workFixture(run, { state: 'PARKED', outputHash: null }), /REASON_CODE_REQUIRED/);
  const parked = workFixture(run, { state: 'PARKED', outputHash: null, reasonCodes: ['HUMAN_REVIEW_REQUIRED'] });
  assert.equal(parked.state, 'PARKED');
  assert.equal(Contracts.validateWorkItem(parked).status, 'VALID');
});

check('unknown operators, fields and authority claims fail closed', () => {
  const run = runFixture();
  assert.throws(() => workFixture(run, { operatorId: 'TRUTH' }), /ENUM_VALUE_INVALID/);
  assert.throws(() => Contracts.createWorkItem(run, {
    operatorId: 'INPUT', lane: 'SOURCE', ordinal: 0, dependsOn: [], inputRefs: [run.inputHash],
    state: 'SHIPPED', epoch: 1, outputHash: hash('out'), reasonCodes: [], semanticTruth: true,
  }), /AUTHORITY_FIELD_FORBIDDEN/);
  assert.throws(() => Contracts.createRun({
    inputHash: hash('input'), policyHash: hash('policy'), sourceSetHash: hash('sources'),
    budget: { maxOperations: 1, maxCandidates: 1, maxMilliseconds: 1 }, commit: true,
  }), /AUTHORITY_FIELD_FORBIDDEN/);
});

check('stale epochs and fencing tokens are rejected without throwing', () => {
  const run = runFixture();
check('hidden object and array fields cannot disappear during canonicalization', () => {
  const base = {
    inputHash: hash('input'), policyHash: hash('policy'), sourceSetHash: hash('sources'),
    budget: { maxOperations: 10, maxCandidates: 2, maxMilliseconds: 10 },
  };
  const symbolic = { ...base };
  symbolic[Symbol('accepted')] = true;
  assert.throws(() => Contracts.createRun(symbolic), /SYMBOL_FIELD_FORBIDDEN/);
  const hidden = { ...base };
  Object.defineProperty(hidden, 'accepted', { value: true, enumerable: false });
  assert.throws(() => Contracts.createRun(hidden), /NON_ENUMERABLE_FIELD_FORBIDDEN/);
  const accessor = { ...base };
  Object.defineProperty(accessor, 'inputHash', { enumerable: true, get() { return hash('input'); } });
  assert.throws(() => Contracts.createRun(accessor), /ACCESSOR_FORBIDDEN/);

  const run = runFixture();
  const symbolicRefs = [run.inputHash];
  symbolicRefs[Symbol('accepted')] = true;
  assert.throws(() => workFixture(run, { inputRefs: symbolicRefs }), /ARRAY_SYMBOL_FIELD_FORBIDDEN/);
  const hiddenRefs = [run.inputHash];
  Object.defineProperty(hiddenRefs, 'accepted', { value: true, enumerable: false });
  assert.throws(() => workFixture(run, { inputRefs: hiddenRefs }), /ARRAY_PROPERTY_FORBIDDEN/);
  const accessorRefs = [run.inputHash];
  Object.defineProperty(accessorRefs, '0', { enumerable: true, get() { return run.inputHash; } });
  assert.throws(() => workFixture(run, { inputRefs: accessorRefs }), /SPARSE_OR_ACCESSOR_ARRAY_FORBIDDEN/);
});

  const item = workFixture(run, { epoch: 4 });
  assert.equal(Contracts.isCurrent(item, run.runId, 4, item.fencingToken), true);
  assert.equal(Contracts.isCurrent(item, run.runId, 3, item.fencingToken), false);
  assert.equal(Contracts.isCurrent(item, run.runId, 4, hash('forged token')), false);
  assert.equal(Contracts.isCurrent(item, hash('another run'), 4, item.fencingToken), false);
});

check('content corruption is detected for runs and work items', () => {
  const run = runFixture();
  const changedRun = Canonical.deepCopy(run);
  changedRun.budget.maxOperations += 1;
  assert.equal(Contracts.validateRun(changedRun).code, 'RUN_ID_MISMATCH');
  const item = workFixture(run);
  const changedItem = Canonical.deepCopy(item);
  changedItem.reasonCodes = ['REPLAYED'];
  assert.equal(Contracts.validateWorkItem(changedItem).code, 'CONTENT_HASH_MISMATCH');
});

check('fresh VM replay needs no DOM, clock, random, network or evaluator', () => {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(lib('p78-canonical-json'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(lib('p78-semantic-work-contracts'), 'utf8'), sandbox);
  const api = sandbox.MRDP78SemanticWorkContracts;
  const run = api.createRun({
    inputHash: sandbox.MRDP78CanonicalJSON.hashText('input'),
    policyHash: sandbox.MRDP78CanonicalJSON.hashText('policy'),
    sourceSetHash: sandbox.MRDP78CanonicalJSON.hashText('sources'),
    budget: { maxOperations: 20, maxCandidates: 2, maxMilliseconds: 10 },
  });
  assert.equal(api.validateRun(run).status, 'VALID');
  const source = fs.readFileSync(lib('p78-semantic-work-contracts'), 'utf8');
  ['document', 'Date.now', 'Math.random', 'fetch(', 'XMLHttpRequest', 'eval(', 'new Function'].forEach((term) => assert(!source.includes(term), `${term} must be absent`));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
