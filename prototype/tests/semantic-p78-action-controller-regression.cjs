'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = global;

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
  'p78-semantic-action-controller',
];
modules.forEach((name) => require(lib(name)));

const api = global.MRDP78SemanticActionController;
const decisionEngine = global.MRDSemanticDecision;
const actionGate = global.MRDSemanticActionGate;
const transactionEngine = global.MRDSemanticTransaction;
const ledgerEngine = global.MRDSemanticLedger;

const SOURCE = '\u0421\u043c\u044b\u0441\u043b \u0441\u043f\u043e\u0440\u0438\u0442 \u0441 \u0448\u0443\u043c\u043e\u043c, \u0430 \u043c\u043e\u0441\u0442 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435.';
const TARGET = '\u0443\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u0440\u0430\u0441\u0441\u043a\u0430\u0437\u0430';
const OOV = '\u0424\u044b\u0440 \u0430\u0431\u0440\u0430 \u043a\u0430\u0434\u0430\u0431\u0440\u0430 \u0448\u043c\u044f\u043a \u0431\u0443\u043b\u044c.';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeState() {
  return {
    semanticState: {
      decision: null,
      continuationProtocol: null,
      action: null,
      transaction: null,
      ledger: null,
    },
    uiState: { portalUndo: [], portalLog: [] },
  };
}

function makeController(engines) {
  const state = makeState();
  const options = { ...state };
  if (engines) options.engines = engines;
  return { ...state, controller: api.create(options) };
}

function latestEntry(semanticState) {
  const entries = semanticState.ledger && semanticState.ledger.entries;
  return entries && entries[entries.length - 1];
}

function collectNamed(root, names, found = [], seen = new Set()) {
  if (!root || typeof root !== 'object' || seen.has(root)) return found;
  seen.add(root);
  for (const [key, value] of Object.entries(root)) {
    if (names.includes(key) && typeof value === 'string') found.push(value);
    if (value && typeof value === 'object') collectNamed(value, names, found, seen);
  }
  return found;
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

assert(api && api.version === '1.0.0', 'MRDP78SemanticActionController v1.0.0 is missing');
assert(decisionEngine && actionGate && transactionEngine && ledgerEngine, 'semantic dependencies are missing');

const fixtureDecision = decisionEngine.decide(SOURCE, TARGET);
assert(fixtureDecision.decision === 'apply', `fixture decision=${fixtureDecision.decision}`);
const LINE = fixtureDecision.insertLine;
const AFTER = `${SOURCE}\n${LINE}`;

check('static API is complete and injected engines are honored', () => {
  const names = [
    'evaluate', 'commitLine', 'commitText', 'commitPrepared', 'undo',
    'replay', 'invalidate', 'canUndo', 'snapshot',
  ];
  const calls = { decide: 0 };
  const injectedDecision = {
    decide(source, target) {
      calls.decide += 1;
      return decisionEngine.decide(source, target);
    },
  };
  const pack = makeController({
    semanticDecision: injectedDecision,
    semanticActionGate: actionGate,
    semanticTransaction: transactionEngine,
    semanticLedger: ledgerEngine,
  });
  names.forEach((name) => assert(typeof pack.controller[name] === 'function', `${name} is missing`));
  assert(pack.controller.version === '1.0.0', 'controller instance version changed');
  const preview = pack.controller.evaluate(SOURCE, TARGET);
  observed.push(preview);
  assert(calls.decide === 1 && preview.status === 'READY', 'injected decision engine was not used');
});

check('READY preview writes state but does not mutate text, ledger, receipts or logs', () => {
  const pack = makeController();
  const before = `${SOURCE}`;
  const preview = pack.controller.evaluate(SOURCE, TARGET);
  observed.push(preview);
  assert(preview.status === 'READY' && preview.changed === false, `preview status=${preview.status}`);
  assert(preview.text === SOURCE && SOURCE === before, 'preview changed source text');
  assert(preview.decision.decision === 'apply', 'READY preview is not apply');
  assert(preview.transaction.afterText === AFTER, 'preview afterText is not exact');
  assert(pack.semanticState.decision === preview.decision, 'decision state was not written');
  assert(pack.semanticState.continuationProtocol === preview.decision.protocol, 'protocol state was not written');
  assert(pack.semanticState.action === preview.plan, 'action state was not written');
  assert(pack.semanticState.ledger.entries.length === 0, 'preview wrote ledger');
  assert(pack.uiState.portalUndo.length === 0 && pack.uiState.portalLog.length === 0, 'preview wrote UI history');
});

check('exact prepared commit records one ledger entry, receipt and log', () => {
  const pack = makeController();
  const preview = pack.controller.evaluate(SOURCE, TARGET);
  const committed = pack.controller.commitPrepared(
    SOURCE, TARGET, preview.decision, preview.transaction,
    { id: 'semantic-decision', label: 'semantic decision', log: 'prepared commit' },
  );
  observed.push(committed);
  assert(committed.status === 'COMMITTED' && committed.changed === true, `commit status=${committed.status}`);
  assert(committed.text === AFTER, 'commit text differs from exact afterText');
  assert(pack.semanticState.ledger.entries.length === 1, 'commit did not record exactly one ledger entry');
  assert(pack.uiState.portalUndo.length === 1, 'commit did not record exactly one receipt');
  assert(pack.uiState.portalLog.length === 1 && pack.uiState.portalLog[0] === 'prepared commit', 'commit log is incorrect');
  assert(committed.receipt.ledgerSeq === latestEntry(pack.semanticState).seq, 'receipt does not point to ledger entry');

  const repeated = pack.controller.commitPrepared(
    committed.text, TARGET, preview.decision, preview.transaction,
    { id: 'semantic-decision', log: 'must not duplicate' },
  );
  const staleCallerRepeat = pack.controller.commitPrepared(
    SOURCE, TARGET, preview.decision, preview.transaction,
    { id: 'semantic-decision', log: 'must not duplicate either' },
  );
  observed.push(repeated, staleCallerRepeat);
  assert(repeated.status === 'ALREADY_COMMITTED' && repeated.changed === false, 'afterText repeat is not idempotent');
  assert(staleCallerRepeat.status === 'ALREADY_COMMITTED' && staleCallerRepeat.changed === false,
    'same-snapshot repeat is not idempotent');
  assert(pack.semanticState.ledger.entries.length === 1, 'repeat duplicated ledger entry');
  assert(pack.uiState.portalUndo.length === 1, 'repeat duplicated receipt');
  assert(pack.uiState.portalLog.length === 1, 'repeat duplicated log');
});

check('commitLine and commitText use exact action-gate transactions', () => {
  const linePack = makeController();
  const committedLine = linePack.controller.commitLine(
    SOURCE, TARGET, LINE,
    { id: 'line', label: 'line', log: 'line commit' },
    SOURCE, TARGET,
  );
  observed.push(committedLine);
  assert(committedLine.status === 'COMMITTED' && committedLine.text === AFTER, 'commitLine was not exact');
  const repeatedLine = linePack.controller.commitLine(
    SOURCE, TARGET, LINE,
    { id: 'line', label: 'line', log: 'duplicate' },
    SOURCE, TARGET,
  );
  observed.push(repeatedLine);
  assert(repeatedLine.status === 'ALREADY_COMMITTED', 'commitLine repeat is not idempotent');
  assert(linePack.semanticState.ledger.entries.length === 1 && linePack.uiState.portalUndo.length === 1,
    'commitLine repeat duplicated state');

  const textPack = makeController();
  const committedText = textPack.controller.commitText(
    SOURCE, TARGET, AFTER,
    { id: 'text', label: 'text', log: 'text commit' },
    SOURCE, TARGET,
  );
  observed.push(committedText);
  assert(committedText.status === 'COMMITTED' && committedText.text === AFTER, 'commitText was not exact');
  assert(textPack.semanticState.ledger.entries.length === 1 && textPack.uiState.portalUndo.length === 1,
    'commitText did not record one action');
});

check('stale source and target fail closed without ledger or receipt writes', () => {
  const sourcePack = makeController();
  const sourcePreview = sourcePack.controller.evaluate(SOURCE, TARGET);
  const staleSourceText = `${SOURCE}\nmanual edit`;
  const staleSource = sourcePack.controller.commitPrepared(
    staleSourceText, TARGET, sourcePreview.decision, sourcePreview.transaction, { id: 'stale-source' },
  );
  observed.push(staleSource);
  assert(staleSource.status === 'BLOCKED' && staleSource.code === 'TX_STALE_SOURCE', 'stale prepared source was not blocked');
  assert(staleSource.text === staleSourceText && staleSource.changed === false, 'stale source text was not preserved');
  assert(sourcePack.semanticState.ledger.entries.length === 0 && sourcePack.uiState.portalUndo.length === 0,
    'stale source wrote commit state');

  const targetPack = makeController();
  const targetPreview = targetPack.controller.evaluate(SOURCE, TARGET);
  const staleTarget = targetPack.controller.commitPrepared(
    SOURCE, 'other target', targetPreview.decision, targetPreview.transaction, { id: 'stale-target' },
  );
  observed.push(staleTarget);
  assert(staleTarget.status === 'BLOCKED' && staleTarget.code === 'TX_STALE_TARGET', 'stale prepared target was not blocked');
  assert(targetPack.semanticState.ledger.entries.length === 0 && targetPack.uiState.portalUndo.length === 0,
    'stale target wrote commit state');

  const expectedPack = makeController();
  const expectedSource = expectedPack.controller.commitLine(
    staleSourceText, TARGET, LINE, { id: 'expected-source' }, SOURCE, TARGET,
  );
  const expectedTarget = expectedPack.controller.commitLine(
    SOURCE, 'other target', LINE, { id: 'expected-target' }, SOURCE, TARGET,
  );
  observed.push(expectedSource, expectedTarget);
  assert(expectedSource.code === 'ACTION_STALE_SOURCE', 'expected source CAS code changed');
  assert(expectedTarget.code === 'ACTION_STALE_TARGET', 'expected target CAS code changed');
  assert(expectedPack.semanticState.ledger.entries.length === 0 && expectedPack.uiState.portalUndo.length === 0,
    'expected CAS failures wrote commit state');
});

check('exact undo restores beforeText and marks the exact ledger entry', () => {
  const pack = makeController();
  const preview = pack.controller.evaluate(SOURCE, TARGET);
  const committed = pack.controller.commitPrepared(SOURCE, TARGET, preview.decision, preview.transaction, {
    id: 'undo-source', log: 'commit before undo',
  });
  assert(pack.controller.canUndo(committed.text), 'exact receipt is not undoable');
  assert(!pack.controller.canUndo(`${committed.text}\nmanual`), 'non-exact text is undoable');
  const undone = pack.controller.undo(committed.text);
  observed.push(committed, undone);
  assert(undone.status === 'ROLLED_BACK' && undone.changed === true, `undo status=${undone.status}`);
  assert(undone.text === SOURCE, 'undo did not return exact beforeText');
  assert(pack.uiState.portalUndo.length === 0 && !pack.controller.canUndo(SOURCE), 'undo receipt was not consumed');
  const entry = latestEntry(pack.semanticState);
  assert(entry.seq === committed.receipt.ledgerSeq && entry.status === 'ROLLED_BACK', 'wrong ledger entry was rolled back');
  assert(pack.uiState.portalLog.length === 2, 'undo log was not recorded');
});

check('rollback conflict preserves user text and invalidates stale receipts', () => {
  const pack = makeController();
  const preview = pack.controller.evaluate(SOURCE, TARGET);
  const committed = pack.controller.commitPrepared(SOURCE, TARGET, preview.decision, preview.transaction, {
    id: 'conflict-source', log: 'commit before conflict',
  });
  const manual = `${committed.text}\nmanual user text`;
  const conflict = pack.controller.undo(manual);
  observed.push(committed, conflict);
  assert(conflict.status === 'BLOCKED' && conflict.code === 'ROLLBACK_CONFLICT', 'rollback conflict code changed');
  assert(conflict.changed === false && conflict.text === manual, 'rollback conflict lost user text');
  assert(pack.uiState.portalUndo.length === 0 && !pack.controller.canUndo(manual), 'stale receipt was not invalidated');
  assert(latestEntry(pack.semanticState).status === 'COMMITTED', 'rollback conflict modified ledger entry');
  assert(pack.uiState.portalLog.length === 1, 'rollback conflict added a false success log');
});

check('replay accepts only rolled-back evidence and retains provenance', () => {
  const pack = makeController();
  const preview = pack.controller.evaluate(SOURCE, TARGET);
  const committed = pack.controller.commitPrepared(SOURCE, TARGET, preview.decision, preview.transaction, {
    id: 'replay-source', label: 'replay source', log: 'initial commit',
  });
  const active = clone(latestEntry(pack.semanticState));
  const activeReplay = pack.controller.replay(active, committed.text, TARGET);
  observed.push(activeReplay);
  assert(activeReplay.status === 'BLOCKED' && activeReplay.code === 'LEDGER_NOT_ROLLED_BACK',
    'active entry replayed');

  const undone = pack.controller.undo(committed.text);
  const rolled = clone(pack.semanticState.ledger.entries.find((entry) => entry.seq === committed.receipt.ledgerSeq));
  assert(rolled && rolled.status === 'ROLLED_BACK', 'rolled-back replay fixture is missing');
  const replayed = pack.controller.replay(rolled, undone.text, TARGET);
  observed.push(undone, replayed);
  assert(replayed.status === 'COMMITTED' && replayed.changed === true && replayed.text === AFTER,
    'exact rolled-back entry did not replay');
  assert(replayed.replayOf === rolled.seq, 'replay outcome lost provenance');
  const replayEntry = latestEntry(pack.semanticState);
  assert(replayEntry.replayOf === rolled.seq && replayEntry.origin === 'ledger-replay',
    'replay ledger provenance is missing');
  const count = pack.semanticState.ledger.entries.length;
  const repeated = pack.controller.replay(rolled, replayed.text, TARGET);
  observed.push(repeated);
  assert(repeated.status === 'ALREADY_COMMITTED' && repeated.changed === false, 'replay repeat is not idempotent');
  assert(pack.semanticState.ledger.entries.length === count && pack.uiState.portalUndo.length === 1,
    'replay repeat duplicated ledger or receipt');
});

check('clarify and OOV previews never create an applicable action', () => {
  const pack = makeController();
  const preview = pack.controller.evaluate(OOV, TARGET);
  observed.push(preview);
  assert(preview.changed === false && preview.text === OOV, 'OOV preview changed text');
  assert(preview.decision.decision === 'clarify' || preview.decision.decision === 'reject',
    `OOV decision=${preview.decision.decision}`);
  assert(preview.status !== 'READY' && preview.plan.ok === false, 'OOV preview became applicable');
  assert(preview.code && preview.decision.reasonCodes.includes(preview.code), 'OOV reason code is not concrete');
  const committed = pack.controller.commitPrepared(OOV, TARGET, preview.decision, preview.transaction, { id: 'oov' });
  observed.push(committed);
  assert(committed.status === 'BLOCKED' && committed.changed === false && committed.text === OOV,
    'OOV prepared action committed');
  assert(pack.semanticState.ledger.entries.length === 0 && pack.uiState.portalUndo.length === 0,
    'OOV action wrote ledger or receipt');
});

check('invalidate clears previews and receipts but preserves ledger and bounded logs', () => {
  const pack = makeController();
  const preview = pack.controller.evaluate(SOURCE, TARGET);
  const committed = pack.controller.commitPrepared(SOURCE, TARGET, preview.decision, preview.transaction, {
    id: 'invalidate-source', log: 'kept log',
  });
  const snapshot = pack.controller.snapshot();
  snapshot.portalUndo.length = 0;
  snapshot.portalLog[0] = 'mutated snapshot';
  assert(pack.uiState.portalUndo.length === 1 && pack.uiState.portalLog[0] === 'kept log', 'snapshot leaked live state');
  const ledgerCount = pack.semanticState.ledger.entries.length;
  const invalidated = pack.controller.invalidate();
  observed.push(committed, invalidated);
  assert(invalidated.status === 'INVALIDATED' && invalidated.changed === false, 'invalidate outcome changed');
  assert(pack.semanticState.decision === null && pack.semanticState.continuationProtocol === null,
    'invalidate retained semantic preview');
  assert(pack.semanticState.action === null && pack.semanticState.transaction === null, 'invalidate retained action state');
  assert(pack.uiState.portalUndo.length === 0 && pack.uiState.portalLog[0] === 'kept log',
    'invalidate did not isolate receipt from log');
  assert(pack.semanticState.ledger.entries.length === ledgerCount, 'invalidate changed ledger');
});

check('evidence and soundness stay within declared bounds', () => {
  observed.forEach((value, index) => {
    assert(value.evidenceLevel === 'STRUCTURAL' || value.evidenceLevel === 'UNVERIFIED',
      `outcome ${index}: invalid evidence ${value.evidenceLevel}`);
    assert(value.soundness === 'NOT_COMPUTED', `outcome ${index}: soundness escaped NOT_COMPUTED`);
    for (const record of [value.plan, value.transaction]) {
      if (!record || typeof record !== 'object') continue;
      for (const key of ['evidence', 'evidenceLevel']) {
        if (record[key] === undefined) continue;
        assert(record[key] === 'STRUCTURAL' || record[key] === 'UNVERIFIED',
          `outcome ${index} ${record.kind || 'record'}: invalid ${key}`);
      }
      if (record.soundness !== undefined) {
        assert(record.soundness === 'NOT_COMPUTED',
          `outcome ${index} ${record.kind || 'record'}: soundness escaped NOT_COMPUTED`);
      }
    }
  });
});

check('classic IIFE is free of runtime and dynamic-evaluation hazards', () => {
  const filename = lib('p78-semantic-action-controller');
  const source = fs.readFileSync(filename, 'utf8');
  assert(source.includes("var VERSION='1.0.0'"), 'static version marker is missing');
  assert(source.includes('global.MRDP78SemanticActionController='), 'classic global export is missing');
  assert(!/\b(?:document|canvas|requestAnimationFrame|fetch|XMLHttpRequest|WebSocket|EventSource|navigator)\b/i.test(source),
    'host runtime dependency is forbidden');
  assert(!/\b(?:setTimeout|setInterval)\s*\(|\beval\s*\(|\bnew\s+Function\s*\(/.test(source),
    'scheduling or dynamic evaluation is forbidden');
  assert(!/\brequire\s*\(|\bmodule\.exports\b/.test(source), 'controller must remain a classic script');

  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  modules.forEach((name) => {
    const moduleFilename = lib(name);
    new vm.Script(fs.readFileSync(moduleFilename, 'utf8'), { filename: moduleFilename })
      .runInContext(context, { timeout: 2000 });
  });
  assert(sandbox.MRDP78SemanticActionController.version === '1.0.0', 'browser IIFE export failed');
});

checks.forEach((result) => {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
});
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
