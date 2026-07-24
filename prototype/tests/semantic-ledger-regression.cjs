'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p78Fixture = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const modules = [
  'semantic-core',
  'continuation-protocol',
  'semantic-branch-evaluator',
  'semantic-command-dsl',
  'semantic-transaction',
  'semantic-decision',
  'semantic-action-gate',
  'semantic-ledger',
];

global.window = global;
modules.forEach((name) => require(lib(name)));

const decision = global.MRDSemanticDecision;
const transaction = global.MRDSemanticTransaction;
const ledger = global.MRDSemanticLedger;
const SOURCE = '\u0421\u043c\u044b\u0441\u043b \u0441\u043f\u043e\u0440\u0438\u0442 \u0441 \u0448\u0443\u043c\u043e\u043c, \u0430 \u043c\u043e\u0441\u0442 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435.';
const TARGET = '\u0443\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u0440\u0430\u0441\u0441\u043a\u0430\u0437\u0430';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture(id = 'fixture', source = SOURCE) {
  const semantic = decision.decide(source, TARGET);
  assert(semantic.decision === 'apply', `fixture decision=${semantic.decision}`);
  const tx = transaction.prepare(source, semantic, TARGET);
  assert(tx.status === 'READY', `fixture transaction=${tx.status}`);
  const result = transaction.commit(tx, source, TARGET);
  assert(result.status === 'COMMITTED', `fixture commit=${result.status}`);
  const plan = {
    action: { id, label: `label ${id}`, origin: 'ledger-test' },
    portPath: 'ID -> STATE -> EFFECT -> STATE',
    transaction: tx,
    typedProgram: semantic.typedProgram,
  };
  return { semantic, tx, result, plan };
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

assert(ledger && transaction && decision, 'semantic ledger dependencies are missing');
['create', 'record', 'markRolledBack', 'canReplay', 'replay', 'recent'].forEach((name) => {
  assert(typeof ledger[name] === 'function', `MRDSemanticLedger.${name} is missing`);
});

let state = ledger.create(3);
const first = fixture('first');

check('committed transaction is recorded with typed contract evidence', () => {
  state = ledger.record(state, {
    transaction: first.tx,
    result: first.result,
    plan: first.plan,
    meta: { id: 'first', label: 'first action', origin: 'test' },
  });
  assert(state.entries.length === 1 && state.nextSeq === 2, 'deterministic sequence is incorrect');
  const entry = state.entries[0];
  assert(entry.seq === 1 && entry.status === 'COMMITTED', 'entry status/sequence is incorrect');
  assert(entry.beforeText === SOURCE && entry.afterText === first.tx.afterText, 'exact text snapshots are missing');
  assert(entry.portPath === 'ID -> STATE -> EFFECT -> STATE', 'typed port path is missing');
  for (const phase of ['pre', 'inv', 'post']) {
    assert(entry.contract[phase].total > 0, `${phase} total is missing`);
    assert(entry.contract[phase].passed === entry.contract[phase].total, `${phase} did not pass`);
  }
  assert(entry.evidence === 'STRUCTURAL' && entry.soundness === 'NOT_COMPUTED', 'evidence bounds changed');
});

check('ledger is bounded and keeps deterministic newest entries', () => {
  for (const id of ['second', 'third', 'fourth']) {
    const item = fixture(id);
    state = ledger.record(state, { transaction: item.tx, result: item.result, plan: item.plan, meta: { id } });
  }
  assert(state.entries.length === 3, 'ledger limit was not enforced');
  assert(state.entries.map((entry) => entry.seq).join(',') === '2,3,4', 'bounded sequence order changed');
  assert(ledger.recent(state, 2).map((entry) => entry.seq).join(',') === '4,3', 'recent order is incorrect');
});

check('rollback marks the exact receipt entry', () => {
  const last = state.entries[state.entries.length - 1];
  state = ledger.markRolledBack(state, last.transactionId, last.seq);
  const marked = state.entries[state.entries.length - 1];
  assert(marked.status === 'ROLLED_BACK', 'entry was not marked ROLLED_BACK');
  assert(marked.previousStatus === 'COMMITTED', 'previous status was not retained');
  assert(ledger.canReplay(marked, marked.beforeText, marked.target), 'exact rolled-back entry cannot replay');
});

check('replay delegates to exact transaction CAS', () => {
  const entry = state.entries[state.entries.length - 1];
  const replayed = ledger.replay(entry, entry.beforeText, entry.target);
  assert(replayed.status === 'COMMITTED' && replayed.changed === true, 'exact replay did not commit');
  assert(replayed.text === entry.afterText, 'replay output differs from transaction afterText');
});

check('stale source and target cannot replay', () => {
  const entry = state.entries[state.entries.length - 1];
  assert(!ledger.canReplay(entry, `${entry.beforeText}\nexternal`, entry.target), 'stale source passed canReplay');
  assert(!ledger.canReplay(entry, entry.beforeText, 'other target'), 'stale target passed canReplay');
  const staleSource = ledger.replay(entry, `${entry.beforeText}\nexternal`, entry.target);
  const staleTarget = ledger.replay(entry, entry.beforeText, 'other target');
  assert(staleSource.code === 'TX_STALE_SOURCE' && staleSource.changed === false, 'stale source was not CAS blocked');
  assert(staleTarget.code === 'TX_STALE_TARGET' && staleTarget.changed === false, 'stale target was not CAS blocked');
});

check('active and tampered entries cannot replay', () => {
  const active = clone(state.entries[state.entries.length - 2]);
  assert(ledger.replay(active, active.beforeText, active.target).code === 'LEDGER_NOT_ROLLED_BACK', 'active entry replayed');
  const tampered = clone(state.entries[state.entries.length - 1]);
  tampered.afterText += '\nforged';
  const result = ledger.replay(tampered, tampered.beforeText, tampered.target);
  assert(result.code === 'LEDGER_ENTRY_INTEGRITY' && result.changed === false, 'tampered entry replayed');
});

check('replay provenance is retained by the next record', () => {
  const entry = state.entries[state.entries.length - 1];
  const result = ledger.replay(entry, entry.beforeText, entry.target);
  state = ledger.record(state, {
    transaction: entry.transaction,
    result,
    plan: { portPath: entry.portPath, action: { id: entry.actionId, label: entry.actionLabel, origin: 'ledger-replay' } },
    meta: { id: entry.actionId, label: 'replay', origin: 'ledger-replay', replayOf: entry.seq },
  });
  const replayRecord = state.entries[state.entries.length - 1];
  assert(replayRecord.replayOf === entry.seq, 'replayOf provenance is missing');
  assert(replayRecord.origin === 'ledger-replay', 'replay origin is missing');
});

check('record ignores blocked results', () => {
  const before = state.entries.length;
  const next = ledger.record(state, { transaction: first.tx, result: { status: 'BLOCKED' } });
  assert(next.entries.length === before && next.nextSeq === state.nextSeq, 'blocked result entered the ledger');
});

check('p78 controller owns ledger record, rollback and replay projection', () => {
  const { html, runtime } = p78Fixture;
  assert(html.includes('lib/semantic-ledger.js?v=1.0.0'), 'ledger script is not loaded');
  assert(html.includes('lib/semantic-decision.js?v=1.4.0'), 'semantic decision script version is stale');
  assert(html.includes('lib/semantic-decision-view.js?v=1.6.0'), 'semantic decision view script version is stale');
  assert(html.includes('lib/p78-semantic-action-controller.js?v=1.0.0'), 'action controller is not loaded');
  const controllerSource = fs.readFileSync(lib('p78-semantic-action-controller'), 'utf8');
  assert(controllerSource.includes('engines.ledger.record('), 'controller does not record successful commits');
  assert(controllerSource.includes('engines.ledger.markRolledBack('), 'controller does not mark exact rollback');
  assert(controllerSource.includes('engines.ledger.replay('), 'controller does not own replay');
  assert(!runtime.includes('MRDSemanticLedger.record(semanticState.ledger'), 'runtime still records ledger directly');
  assert(!runtime.includes('MRDSemanticLedger.markRolledBack(semanticState.ledger'), 'runtime still marks rollback directly');
  assert(runtime.includes('function replaySemanticLedgerEntry(entry)'), 'runtime replay adapter is missing');
  assert(runtime.includes('ledger:semanticState.ledger') && runtime.includes('onReplay:replaySemanticLedgerEntry'),
    'ledger state/replay callback is not projected to the protocol view');
  const viewSource = fs.readFileSync(lib('semantic-decision-view'), 'utf8');
  assert(viewSource.includes("className='transactionReplay'"), 'compact replay control is missing');
  assert(viewSource.includes("className='transactionUndo'"), 'local undo control is missing');
});

check('browser IIFE has no dynamic evaluation', () => {
  const source = fs.readFileSync(lib('semantic-ledger'), 'utf8');
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'dynamic evaluation is forbidden');
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  modules.forEach((name) => {
    const filename = lib(name);
    new vm.Script(fs.readFileSync(filename, 'utf8'), { filename }).runInContext(context, { timeout: 2000 });
  });
  assert(sandbox.MRDSemanticLedger, 'browser IIFE export MRDSemanticLedger is missing');
});

checks.forEach((result) => {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
});
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
