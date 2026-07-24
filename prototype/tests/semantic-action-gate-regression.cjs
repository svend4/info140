'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { runtime } = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const modules = [
  'semantic-core',
  'continuation-protocol',
  'semantic-branch-evaluator',
  'semantic-command-dsl',
  'semantic-transaction',
  'semantic-decision',
  'semantic-action-gate',
];

global.window = global;
modules.forEach((name) => require(lib(name)));

const core = global.MRDSemanticCore;
const decision = global.MRDSemanticDecision;
const gate = global.MRDSemanticActionGate;

const SOURCE = '\u0421\u043c\u044b\u0441\u043b \u0441\u043f\u043e\u0440\u0438\u0442 \u0441 \u0448\u0443\u043c\u043e\u043c, \u0430 \u043c\u043e\u0441\u0442 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435.';
const TARGET = '\u0443\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u0440\u0430\u0441\u0441\u043a\u0430\u0437\u0430';
const NONSENSE = '\u0424\u044b\u0440 \u0430\u0431\u0440\u0430 \u043a\u0430\u0434\u0430\u0431\u0440\u0430 \u0448\u043c\u044f\u043a \u0431\u0443\u043b\u044c.';
const SHORT = '\u041c\u043e\u0441\u0442.';
const TAMPERED = '\u041f\u043e\u0434\u0434\u0435\u043b\u044c\u043d\u0430\u044f \u0441\u0442\u0440\u043e\u043a\u0430.';

const unsafe = [
  ['center', '\u0421\u043c\u044b\u0441\u043b.', '\u0421\u0436\u0430\u0442\u044c \u0432\u0441\u0435 \u043f\u0440\u0438\u043c\u0435\u0440\u044b \u0438 \u0434\u0435\u0442\u0430\u043b\u0438 \u0432 \u043e\u0434\u043d\u043e \u0433\u043b\u0430\u0432\u043d\u043e\u0435 \u0441\u043b\u043e\u0432\u043e, \u0443\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u043a\u0442\u044b \u0438 \u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0438\u0442\u043e\u0433.'],
  ['edge', '\u0424\u0430\u043a\u0442.', '\u0420\u0430\u0441\u043f\u0430\u0434 \u0432 1D: \u0440\u0430\u0437\u0431\u0438\u0442\u044c \u0431\u0443\u043a\u0432\u044b, \u0441\u043b\u043e\u0433\u0438, \u0447\u0430\u0441\u0442\u0438, \u0434\u0435\u0442\u0430\u043b\u0438, \u0444\u0430\u043a\u0442\u044b, \u0430\u0442\u043e\u043c\u044b, \u043e\u0441\u043a\u043e\u043b\u043a\u0438, \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b, \u0442\u0435\u0433\u0438, \u0443\u0441\u043b\u043e\u0432\u0438\u044f \u0438 \u043a\u0440\u043e\u0445\u0438.'],
  ['conflict', '\u0421\u043c\u044b\u0441\u043b \u0434\u0432\u0438\u0436\u0435\u0442\u0441\u044f.', '\u0428\u0443\u043c \u0441\u043f\u043e\u0440\u0438\u0442 \u0441\u043e \u0441\u043c\u044b\u0441\u043b\u043e\u043c \u0431\u0435\u0437 \u043c\u043e\u0441\u0442\u0430, \u0430 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u0435\u0442 \u043a\u043e\u043b\u043b\u0430\u043f\u0441.'],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function collect(root, names, out = [], seen = new Set()) {
  if (!root || typeof root !== 'object' || seen.has(root)) return out;
  seen.add(root);
  for (const [key, value] of Object.entries(root)) {
    if (names.includes(key) && typeof value === 'string') out.push(value);
    if (value && typeof value === 'object') collect(value, names, out, seen);
  }
  return out;
}

function hasStatus(value, expected) {
  return collect(value, ['status', 'state', 'code', 'errorCode'])
    .map(normalize).includes(expected);
}

function assertStatus(value, expected, label) {
  assert(hasStatus(value, expected), `${label}: expected ${expected}`);
}

function directField(value, names) {
  for (const record of [value, value && value.result, value && value.commit]) {
    if (!record || typeof record !== 'object') continue;
    for (const name of names) if (record[name] !== undefined) return record[name];
  }
  return undefined;
}

function findRecord(root, predicate, seen = new Set()) {
  if (!root || typeof root !== 'object' || seen.has(root)) return null;
  seen.add(root);
  if (predicate(root)) return root;
  for (const value of Object.values(root)) {
    const found = findRecord(value, predicate, seen);
    if (found) return found;
  }
  return null;
}

function action(type, line, fullText) {
  return { action: type, kind: type, type, line, addition: line, fullText };
}

function extracted(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return value.addition || value.insertLine || value.line || '';
}

const checks = [];
const observed = [];
function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

assert(core && decision && gate, 'semantic action gate dependencies are missing');
['plan', 'commit', 'additionFromText'].forEach((name) => {
  assert(typeof gate[name] === 'function', `MRDSemanticActionGate.${name} is missing`);
});

const baseDecision = decision.decide(SOURCE, TARGET);
const LINE = baseDecision.insertLine;
const AFTER = `${SOURCE}\n${LINE}`;
let ready;

check('bridge and continuation actions are READY and typed', () => {
  assert(LINE, 'fixture decision has no insertLine');
  const plans = [
    gate.plan(SOURCE, action('bridge', LINE), TARGET),
    gate.plan(SOURCE, action('continuation', undefined, AFTER), TARGET),
  ];
  plans.forEach((plan, index) => {
    observed.push(plan);
    assertStatus(plan, 'READY', `plan ${index}`);
    const paths = collect(plan, ['portPath']);
    assert(paths.includes('ID -> STATE -> EFFECT -> STATE'), `plan ${index}: typed path missing`);
  });
  ready = plans[0];
});

check('commit is exact and repeat is idempotent', () => {
  const committed = gate.commit(ready, SOURCE, TARGET);
  const repeated = gate.commit(ready, AFTER, TARGET);
  observed.push(committed, repeated);
  assertStatus(committed, 'COMMITTED', 'commit');
  assert(committed.changed === true, 'commit.changed must be true');
  assert(directField(committed, ['text', 'afterText', 'outputText']) === AFTER, 'commit text is not exact');
  assertStatus(repeated, 'ALREADY_COMMITTED', 'repeat commit');
  assert(repeated.changed === false, 'repeat commit changed text');
});

check('stale source and target are BLOCKED', () => {
  const staleSource = gate.commit(ready, `${SOURCE}\nexternal`, TARGET);
  const staleTarget = gate.commit(ready, SOURCE, 'other target');
  observed.push(staleSource, staleTarget);
  assertStatus(staleSource, 'BLOCKED', 'stale source');
  assertStatus(staleSource, 'TX_STALE_SOURCE', 'stale source code');
  assertStatus(staleTarget, 'BLOCKED', 'stale target');
  assertStatus(staleTarget, 'TX_STALE_TARGET', 'stale target code');
  assert(staleSource.changed !== true && staleTarget.changed !== true, 'stale commit changed text');
});

check('nonsense, short and empty input are GATED', () => {
  const cases = [
    gate.plan(NONSENSE, action('continuation', LINE), ''),
    gate.plan(SHORT, action('continuation', LINE), ''),
    gate.plan(SOURCE, action('continuation', SHORT), TARGET),
    gate.plan(SOURCE, action('continuation', ''), TARGET),
  ];
  cases.forEach((plan, index) => {
    observed.push(plan);
    assertStatus(plan, 'GATED', `gated case ${index}`);
  });
});

check('unsafe center, edge and conflict additions do not commit', () => {
  for (const [zone, source, line] of unsafe) {
    const after = `${source}\n${line}`;
    assert(core.stabilityGuard(after).zone === zone, `${zone}: fixture missed zone`);
    const plan = gate.plan(source, action('continuation', line, after), '');
    const committed = gate.commit(plan, source, '');
    observed.push(plan, committed);
    assert(hasStatus(plan, 'ROLLBACK') || hasStatus(plan, 'BLOCKED'), `${zone}: plan was not rejected`);
    assertStatus(committed, 'BLOCKED', `${zone}: commit`);
    assert(committed.changed !== true, `${zone}: rejected addition changed text`);
  }
});

check('additionFromText requires an exact source prefix', () => {
  const one = gate.additionFromText(SOURCE, `${SOURCE}\n${LINE}`);
  const manyText = `${LINE}\nsecond appended line`;
  const many = gate.additionFromText(SOURCE, `${SOURCE}\n${manyText}`);
  const foreign = gate.additionFromText(SOURCE, `foreign source\n${LINE}`);
  assert(extracted(one) === LINE, 'one appended line was not extracted');
  assert(extracted(many) === manyText, 'multiple appended lines were not extracted');
  assert(!extracted(foreign), 'foreign fullText exposed an addition');
  assert(foreign == null || foreign.ok === false || hasStatus(foreign, 'BLOCKED') || hasStatus(foreign, 'GATED'),
    'foreign fullText was not blocked');
});

check('tampered planned line fails transaction integrity', () => {
  const tampered = clone(ready);
  const tx = findRecord(tampered, (value) => value.sourceHash != null && typeof value.afterText === 'string');
  assert(tx, 'planned transaction was not exposed');
  tx.insertLine = TAMPERED;
  tx.candidate = TAMPERED;
  tx.afterText = `${SOURCE}\n${TAMPERED}`;
  const result = gate.commit(tampered, SOURCE, TARGET);
  observed.push(result);
  assertStatus(result, 'BLOCKED', 'tampered commit');
  assertStatus(result, 'TX_TRANSACTION_INTEGRITY', 'tampered commit code');
  assert(result.changed !== true, 'tampered commit changed text');
});

check('evidence and soundness remain bounded', () => {
  observed.forEach((value, index) => {
    const evidence = collect(value, ['evidence', 'evidenceLevel']);
    const soundness = collect(value, ['soundness']);
    assert(evidence.length && evidence.every((item) => item === 'STRUCTURAL' || item === 'UNVERIFIED'),
      `result ${index}: invalid evidence`);
    assert(soundness.length && soundness.every((item) => item === 'NOT_COMPUTED'),
      `result ${index}: soundness must be NOT_COMPUTED`);
  });
});

check('browser IIFE export has no eval dependency', () => {
  const actionSource = fs.readFileSync(lib('semantic-action-gate'), 'utf8');
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(actionSource), 'dynamic evaluation is forbidden');
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  modules.forEach((name) => {
    const filename = lib(name);
    new vm.Script(fs.readFileSync(filename, 'utf8'), { filename }).runInContext(context, { timeout: 2000 });
  });
  assert(sandbox.MRDSemanticActionGate, 'browser IIFE export MRDSemanticActionGate is missing');
});

check('all p78 forward writes use the action gate', () => {
  assert(!runtime.includes('portalUndo.push(condition.value)'), 'legacy string undo snapshot remains');
  assert(!runtime.includes('appendTextLocal(condition.value'), 'direct append bypass remains');
  const assignments = [...runtime.matchAll(/condition\.value\s*=/g)];
  assert(assignments.length === 2, `unexpected condition.value assignments: ${assignments.length}`);
  assert(runtime.includes("condition.value=String(outcome.text||'')"), 'controller outcome is not projected to the input');
  assert(runtime.includes('sampleBtn.onclick=function(){ condition.value=examples['), 'sample selection no longer owns its explicit input reset');

  const routed = [
    'applyArchipelagoBridge', 'applyWeaveLine', 'applyWindowRhythm', 'applyBacktrackAction',
    'applyGoalAction', 'applyPhiAction', 'applyRailsAction', 'applyTextResult', 'applyOutputItem',
    'applyBalanceRepair', 'applyTrajectoryAction', 'executePortalAction', 'applyImpulsePack',
    'applyContinuationItem',
  ];
  routed.forEach((name) => {
    const start = runtime.indexOf(`function ${name}(`);
    const end = runtime.indexOf('\nfunction ', start + 10);
    const body = runtime.slice(start, end < 0 ? runtime.length : end);
    assert(start >= 0 && /commitSemantic(?:Action|Text)\(/.test(body), `${name} bypasses semantic action gate`);
  });
  const decisionStart = runtime.indexOf('function applySemanticDecisionLine(');
  const decisionEnd = runtime.indexOf('\nfunction ', decisionStart + 10);
  const decisionBody = runtime.slice(decisionStart, decisionEnd);
  assert(decisionBody.includes('actionController.commitPrepared('), 'semantic decision bypasses controller preparation');
  assert(decisionBody.includes('finishSemanticOutcome('), 'semantic decision bypasses receipt outcome');
  assert(!/condition\.value\s*=/.test(decisionBody), 'semantic decision writes the input directly');
});

checks.forEach((result) => {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
});
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
