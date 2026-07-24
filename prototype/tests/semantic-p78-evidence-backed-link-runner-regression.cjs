'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts',
  'p78-local-text-index', 'p78-controlled-russian-lexicon', 'p78-claim-ir',
  'p78-linguistic-parser-adapter', 'p78-claim-structural-matcher', 'p78-evidence-contracts',
  'p78-claim-evidence-corpus', 'p78-linguistic-structure-index', 'p78-claim-evidence-cascade',
  'p78-controlled-claim-engine', 'p78-alpha-orbit-contracts', 'p78-data7-adapter',
  'p78-qualifier-direction-contracts', 'p78-evidence-backed-link-adapter',
  'p78-evidence-backed-link-projector', 'p78-evidence-backed-link-runner',
].forEach((name) => require(lib(name)));

const Runner = global.MRDP78EvidenceBackedLinkRunner;
const Projector = global.MRDP78EvidenceBackedLinkProjector;
const Cascade = global.MRDP78ClaimEvidenceCascade.create();
const Engine = global.MRDP78ControlledClaimEngine.create({ evidenceCascade: Cascade });
const TARGET = 'Система сохраняет состояние.';
const definition = {
  targetText: TARGET,
  cascadeResult: Engine.run(TARGET).evidenceCascade,
  linguisticIndex: Cascade.index,
};
const projected = Projector.project(definition);
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
class FakeWorker {
  constructor(url) {
    this.url = url;
    this.messages = [];
    this.listeners = { message: [], error: [] };
    this.terminated = false;
  }
  addEventListener(type, callback) { this.listeners[type].push(callback); }
  postMessage(message) { this.messages.push(message); }
  emit(type, data) { for (const callback of this.listeners[type]) callback(type === 'message' ? { data } : { error: data }); }
  terminate() { this.terminated = true; }
}
function harness() {
  let worker;
  const runner = Runner.create({
    workerUrl: 'lib/test-worker.js',
    timeoutMs: 5000,
    workerFactory(url) { worker = new FakeWorker(url); return worker; },
  });
  return { runner, get worker() { return worker; } };
}
function response(requestId, status, model, code = null) {
  return { schema: Runner.responseSchema, version: '1.0.0', requestId, status, model: model || null, code };
}

check('runner API is frozen, worker-only and carries no semantic authority', () => {
  assert.equal(Runner.status, 'READY');
  assert.equal(Runner.version, '1.0.0');
  assert.equal(Runner.projectorVersion, '1.1.0');
  assert.equal(Runner.semanticTruth, false);
  assert.equal(Runner.commitAllowed, false);
  assert(Object.isFrozen(Runner));
});

check('projection is queued through the versioned worker protocol and accepts a valid model', () => {
  const item = harness();
  let outcome = null;
  const ticket = item.runner.project(definition, (value) => { outcome = value; });
  assert.equal(ticket.status, 'QUEUED');
  assert.equal(item.worker.messages.length, 1);
  assert.equal(item.worker.messages[0].schema, Runner.requestSchema);
  assert.equal(item.worker.messages[0].type, 'PROJECT');
  item.worker.emit('message', response(ticket.requestId, 'READY', projected));
  assert.equal(outcome.status, 'READY');
  assert.equal(outcome.model.contentHash, projected.contentHash);
  item.runner.destroy();
});

check('a newer request cancels delivery of stale worker output', () => {
  const item = harness();
  let staleCalls = 0;
  let current = null;
  const first = item.runner.project(definition, () => { staleCalls += 1; });
  const firstWorker = item.worker;
  const second = item.runner.project(definition, (value) => { current = value; });
  assert.equal(firstWorker.terminated, true);
  assert.notEqual(item.worker, firstWorker);
  const secondWorker = item.worker;
  firstWorker.emit('message', {});
  firstWorker.emit('error', new Error('late stale worker error'));
  assert.equal(secondWorker.terminated, false);
  assert.equal(item.runner.getState(), 'READY');
  firstWorker.emit('message', response(first.requestId, 'READY', projected));
  assert.equal(staleCalls, 0);
  assert.equal(current, null);
  item.worker.emit('message', response(second.requestId, 'READY', projected));
  assert.equal(current.status, 'READY');
  item.runner.destroy();
});

check('invalid worker models and explicit projection errors fail closed', () => {
  const invalidItem = harness();
  let invalid = null;
  const invalidTicket = invalidItem.runner.project(definition, (value) => { invalid = value; });
  invalidItem.worker.emit('message', response(invalidTicket.requestId, 'READY', {}));
  assert.equal(invalid.status, 'ERROR');
  assert.equal(invalid.code, 'WORKER_MODEL_INVALID');
  invalidItem.runner.destroy();

  const errorItem = harness();
  let failed = null;
  const errorTicket = errorItem.runner.project(definition, (value) => { failed = value; });
  errorItem.worker.emit('message', response(errorTicket.requestId, 'ERROR', null, 'PROJECTOR_REJECTED'));
  assert.equal(failed.status, 'ERROR');
  assert.equal(failed.code, 'PROJECTOR_REJECTED');
  errorItem.runner.destroy();
});

check('worker runtime failure closes the active request and terminates the worker', () => {
  const item = harness();
  let outcome = null;
  item.runner.project(definition, (value) => { outcome = value; });
  item.worker.emit('error', new Error('worker failed'));
  assert.equal(outcome.status, 'ERROR');
  assert.equal(outcome.code, 'WORKER_RUNTIME_FAILED');
  assert.equal(item.worker.terminated, true);
  item.runner.destroy();
});

check('runner never executes replay synchronously and worker exposes only projection messages', () => {
  const runnerSource = fs.readFileSync(lib('p78-evidence-backed-link-runner'), 'utf8');
  const workerSource = fs.readFileSync(lib('p78-evidence-backed-link-worker'), 'utf8');
  assert(!runnerSource.includes('Projector.project('));
  assert(runnerSource.includes('new global.Worker'));
  assert(workerSource.includes('Projector.project(message.definition)'));
  assert(workerSource.includes("message.type!=='PROJECT'"));
  assert(!/commitAllowed\s*:\s*true|semanticTruth\s*:\s*true/.test(`${runnerSource}\n${workerSource}`));
});

for (const item of checks) {
  process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? `\n${item.detail}` : ''}\n`);
}
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
process.exitCode = passed === checks.length ? 0 : 1;
