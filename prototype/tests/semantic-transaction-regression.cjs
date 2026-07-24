'use strict';

const path = require('node:path');

global.window = global;

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
[
  'semantic-core',
  'continuation-protocol',
  'semantic-branch-evaluator',
  'semantic-command-dsl',
  'semantic-decision',
].forEach((name) => require(lib(name)));

const exportedTransaction = require(lib('semantic-transaction'));
const core = global.MRDSemanticCore;
const semanticDecision = global.MRDSemanticDecision;
const transaction = exportedTransaction && Object.keys(exportedTransaction).length
  ? exportedTransaction
  : global.MRDSemanticTransaction;

const SOURCE = '\u0421\u043c\u044b\u0441\u043b \u0441\u043f\u043e\u0440\u0438\u0442 \u0441 \u0448\u0443\u043c\u043e\u043c \u0431\u0435\u0437 \u043c\u043e\u0441\u0442\u0430, \u0430 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u0435\u0442 \u043a\u043e\u043b\u043b\u0430\u043f\u0441.';
const NONSENSE = '\u0424\u044b\u0440 \u0430\u0431\u0440\u0430 \u043a\u0430\u0434\u0430\u0431\u0440\u0430 \u0448\u043c\u044f\u043a \u0431\u0443\u043b\u044c.';
const NEGATED = '\u041d\u0435 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0442\u044c \u0440\u0430\u0441\u0441\u043a\u0430\u0437 \u0438 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435.';
const TAMPERED = '\u041f\u043e\u0434\u0434\u0435\u043b\u044c\u043d\u0430\u044f \u0441\u0442\u0440\u043e\u043a\u0430.';

const unsafeCases = [
  {
    zone: 'center',
    source: '\u0421\u043c\u044b\u0441\u043b.',
    candidate: '\u0421\u0436\u0430\u0442\u044c \u0432\u0441\u0435 \u043f\u0440\u0438\u043c\u0435\u0440\u044b \u0438 \u0434\u0435\u0442\u0430\u043b\u0438 \u0432 \u043e\u0434\u043d\u043e \u0433\u043b\u0430\u0432\u043d\u043e\u0435 \u0441\u043b\u043e\u0432\u043e, \u0443\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u043a\u0442\u044b \u0438 \u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0438\u0442\u043e\u0433.',
  },
  {
    zone: 'edge',
    source: '\u0424\u0430\u043a\u0442.',
    candidate: '\u0420\u0430\u0441\u043f\u0430\u0434 \u0432 1D: \u0440\u0430\u0437\u0431\u0438\u0442\u044c \u0431\u0443\u043a\u0432\u044b, \u0441\u043b\u043e\u0433\u0438, \u0447\u0430\u0441\u0442\u0438, \u0434\u0435\u0442\u0430\u043b\u0438, \u0444\u0430\u043a\u0442\u044b, \u0430\u0442\u043e\u043c\u044b, \u043e\u0441\u043a\u043e\u043b\u043a\u0438, \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b, \u0442\u0435\u0433\u0438, \u0443\u0441\u043b\u043e\u0432\u0438\u044f \u0438 \u043a\u0440\u043e\u0445\u0438.',
  },
  {
    zone: 'conflict',
    source: '\u0421\u043c\u044b\u0441\u043b \u0434\u0432\u0438\u0436\u0435\u0442\u0441\u044f.',
    candidate: '\u0428\u0443\u043c \u0441\u043f\u043e\u0440\u0438\u0442 \u0441\u043e \u0441\u043c\u044b\u0441\u043b\u043e\u043c \u0431\u0435\u0437 \u043c\u043e\u0441\u0442\u0430, \u0430 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u0435\u0442 \u043a\u043e\u043b\u043b\u0430\u043f\u0441.',
  },
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

function statusValues(value) {
  const nested = value && value.result && typeof value.result === 'object' ? value.result : null;
  const error = value && value.error && typeof value.error === 'object' ? value.error : null;
  return [value && value.status, value && value.state, value && value.code,
    nested && nested.status, nested && nested.code, error && error.code]
    .filter(Boolean).map(normalize);
}

const statusAliases = {
  READY: ['READY', 'PREPARED', 'PLANNED'],
  GATED: ['GATED', 'BLOCKED', 'REJECTED', 'NOT_READY', 'ABORTED'],
  COMMITTED: ['COMMITTED', 'APPLIED'],
  ALREADY_COMMITTED: ['ALREADY_COMMITTED', 'IDEMPOTENT', 'NOOP', 'NO_OP', 'UNCHANGED'],
  ROLLBACK: ['ROLLBACK', 'ROLLED_BACK', 'BLOCKED', 'REJECTED', 'ABORTED'],
};

function assertStatus(value, kind, label) {
  const actual = statusValues(value);
  assert(actual.some((item) => statusAliases[kind].includes(item)),
    `${label}: expected ${kind}, got ${actual.join(', ') || '<missing>'}`);
}

function field(value, names) {
  const records = [value, value && value.transaction, value && value.result];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const name of names) {
      if (record[name] !== undefined && record[name] !== null) return record[name];
    }
  }
  return undefined;
}

function outputText(value) {
  return field(value, ['text', 'afterText', 'outputText', 'resultText', 'nextText', 'sourceText']);
}

function assertNoNewText(value, forbidden, label) {
  assert(value.changed !== true, `${label}: changed=true`);
  const text = outputText(value);
  assert(text === undefined || text === null || text !== forbidden,
    `${label}: exposed forbidden afterText`);
}

assert(transaction && typeof transaction === 'object', 'MRDSemanticTransaction export is missing');
assert(core && semanticDecision, 'semantic dependencies were not loaded');

const prepareName = ['prepare', 'plan'].find((name) => typeof transaction[name] === 'function');
assert(prepareName, 'expected MRDSemanticTransaction.prepare() or plan()');
assert(typeof transaction.commit === 'function', 'expected MRDSemanticTransaction.commit()');
assert(typeof transaction.rollback === 'function', 'expected MRDSemanticTransaction.rollback()');

const observed = [];
const prepare = (source, target = '', preparedDecision = null) => {
  const exactDecision = preparedDecision || semanticDecision.decide(source, target);
  const value = transaction[prepareName](source, exactDecision, target);
  observed.push(value);
  return value;
};
const commit = (tx, source, target) => {
  const value = target === undefined ? transaction.commit(tx, source) : transaction.commit(tx, source, target);
  observed.push(value);
  return value;
};
const rollback = (tx, source) => {
  const value = transaction.rollback(tx, source);
  observed.push(value);
  return value;
};


function unsafeDecision(base, source, candidate) {
  const fake = clone(base);
  const afterText = `${source}\n${candidate}`;
  fake.decision = 'apply';
  fake.status = 'apply';
  fake.reasonCodes = [];
  fake.candidate = candidate;
  fake.insertLine = candidate;
  fake.evidenceLevel = 'STRUCTURAL';
  fake.soundness = 'NOT_COMPUTED';
  fake.interpretation = semanticDecision.interpret(source);
  fake.verification = semanticDecision.verify(source, candidate, '', fake.interpretation);
  fake.verification.evidenceLevel = 'STRUCTURAL';
  fake.verification.soundness = 'NOT_COMPUTED';
  fake.verification.afterText = afterText;
  fake.verification.checks = (fake.verification.checks || []).map((check) => ({ ...check, ok: true }));
  fake.best = { ...(fake.best || {}), status: 'accept', line: candidate, text: afterText };
  fake.typedProgram = {
    ...(fake.typedProgram || {}), ok: true, status: 'composed', candidate,
    evidence: 'STRUCTURAL', evidenceLevel: 'STRUCTURAL', soundness: 'NOT_COMPUTED',
  };
  if (fake.typedProgram.composition) fake.typedProgram.composition.ok = true;
  return fake;
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ name, ok: true, detail: run() || '' });
  } catch (error) {
    checks.push({ name, ok: false, detail: error.message || String(error) });
  }
}

const decision = semanticDecision.decide(SOURCE, '');
const expectedAfterText = `${SOURCE}\n${decision.candidate}`;
let ready;

check('apply prepares READY transaction', () => {
  assert(decision.decision === 'apply', `decision=${decision.decision}`);
  ready = prepare(SOURCE);
  assertStatus(ready, 'READY', 'prepare');
  assert(field(ready, ['afterText', 'nextText']) === expectedAfterText, 'prepare.afterText is not exact');
  return `${prepareName}; ${statusValues(ready)[0]}`;
});

check('hashes and transaction id are deterministic', () => {
  const first = ready || prepare(SOURCE);
  const second = prepare(SOURCE);
  for (const names of [['sourceHash'], ['afterHash'], ['transactionId', 'txId']]) {
    const a = field(first, names);
    const b = field(second, names);
    assert(a !== undefined && String(a).length > 0, `${names[0]} is missing`);
    assert(a === b, `${names[0]} is not deterministic`);
  }
  assert(field(first, ['sourceHash']) !== field(first, ['afterHash']), 'sourceHash equals afterHash');
});

check('commit applies exact afterText', () => {
  const result = commit(ready, SOURCE);
  assertStatus(result, 'COMMITTED', 'commit');
  assert(result.changed === true, 'commit.changed is not true');
  assert(outputText(result) === expectedAfterText, 'commit text differs from expected afterText');
});

check('repeat commit is idempotent', () => {
  const result = commit(ready, expectedAfterText);
  assertStatus(result, 'ALREADY_COMMITTED', 'repeat commit');
  assert(result.changed === false, 'repeat commit.changed is not false');
  assert(outputText(result) === expectedAfterText, 'repeat commit did not preserve afterText');
});

check('stale source is rejected', () => {
  const tx = prepare(SOURCE);
  const staleSource = `${SOURCE}\n\u0412\u043d\u0435\u0448\u043d\u0435\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435.`;
  const result = commit(tx, staleSource);
  assert(statusValues(result).includes('TX_STALE_SOURCE'), 'missing TX_STALE_SOURCE');
  assert(result.changed === false, 'stale commit.changed is not false');
  assertNoNewText(result, expectedAfterText, 'stale commit');
});

check('stale target is rejected', () => {
  const target = 'удержать движение рассказа';
  const tx = prepare(SOURCE, target);
  assertStatus(tx, 'READY', 'target prepare');
  const result = commit(tx, SOURCE, 'другая цель');
  assert(statusValues(result).includes('TX_STALE_TARGET'), 'missing TX_STALE_TARGET');
  assert(result.changed === false, 'stale target commit.changed is not false');
  assertNoNewText(result, tx.afterText, 'stale target commit');
});

check('nonsense and negation stay gated', () => {
  for (const source of [NONSENSE, NEGATED]) {
    const gateDecision = semanticDecision.decide(source, '');
    assert(gateDecision.decision !== 'apply', `${source}: decision applied`);
    const tx = prepare(source);
    assertStatus(tx, 'GATED', 'gated prepare');
    const result = commit(tx, source);
    assert(!statusValues(result).some((item) => statusAliases.COMMITTED.includes(item)), 'gated tx committed');
    assertNoNewText(result, `${source}\n${gateDecision.candidate || ''}`, 'gated commit');
  }
});

check('forged candidate and composition are blocked', () => {
  const forgedCandidate = clone(decision);
  forgedCandidate.candidate = TAMPERED;
  forgedCandidate.insertLine = TAMPERED;
  const candidateTx = prepare(SOURCE, '', forgedCandidate);
  assertStatus(candidateTx, 'GATED', 'forged candidate');

  const forgedComposition = clone(decision);
  forgedComposition.typedProgram.ok = false;
  forgedComposition.typedProgram.status = 'blocked';
  if (forgedComposition.typedProgram.composition) forgedComposition.typedProgram.composition.ok = false;
  const compositionTx = prepare(SOURCE, '', forgedComposition);
  assertStatus(compositionTx, 'GATED', 'forged composition');
});

check('unsafe center/edge/conflict candidates rollback', () => {
  for (const item of unsafeCases) {
    const afterText = `${item.source}\n${item.candidate}`;
    assert(core.stabilityGuard(afterText).zone === item.zone, `${item.zone}: fixture missed zone`);
    const fake = unsafeDecision(decision, item.source, item.candidate);
    const tx = prepare(item.source, '', fake);
    assertStatus(tx, 'ROLLBACK', `${item.zone} prepare`);
    const result = commit(tx, item.source);
    assert(!statusValues(result).some((status) => statusAliases.COMMITTED.includes(status)),
      `${item.zone}: blocked transaction committed`);
    assertNoNewText(result, afterText, `${item.zone} commit`);
  }
});

check('rollback preserves source', () => {
  const result = rollback(ready, SOURCE);
  assertStatus(result, 'ROLLBACK', 'rollback');
  assert(result.changed !== true, 'rollback changed the source');
  assert(outputText(result) === SOURCE, 'rollback did not return the original source');
});

function collectNamed(root, names, found = [], seen = new Set()) {
  if (!root || typeof root !== 'object' || seen.has(root)) return found;
  seen.add(root);
  for (const [key, value] of Object.entries(root)) {
    if (names.includes(key) && typeof value === 'string') found.push(value);
    if (value && typeof value === 'object') collectNamed(value, names, found, seen);
  }
  return found;
}

check('evidence and soundness stay bounded', () => {
  for (const [index, value] of observed.entries()) {
    const evidence = collectNamed(value, ['evidence', 'evidenceLevel']);
    const soundness = collectNamed(value, ['soundness']);
    assert(evidence.length > 0, `result ${index}: evidence is missing`);
    assert(evidence.every((item) => item === 'STRUCTURAL' || item === 'UNVERIFIED'),
      `result ${index}: invalid evidence ${evidence.join(', ')}`);
    assert(soundness.length > 0 && soundness.every((item) => item === 'NOT_COMPUTED'),
      `result ${index}: soundness must be NOT_COMPUTED`);
  }
});

for (const result of checks) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
}
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
