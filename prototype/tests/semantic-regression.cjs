'use strict';

const path = require('node:path');

const results = [];
let core;
let protocol;
let branchEvaluator;
let semanticCommandDsl;
let semanticTransaction;
let semanticDecision;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertRecord(value, label) {
  assert(isRecord(value), `${label}: expected object`);
}

function assertUnit(value, label) {
  const epsilon = 1e-12;
  assert(
    typeof value === 'number' && Number.isFinite(value) && value >= -epsilon && value <= 1 + epsilon,
    `${label}: expected finite number in [0, 1], got ${String(value)}`,
  );
}

function assertOpenGuard(guard, label) {
  assertRecord(guard, label);
  assert(['safe', 'thin'].includes(guard.zone), `${label}: closed zone ${String(guard.zone)}`);
  assertUnit(guard.u, `${label}.u`);
  assert(guard.u > 0.18 && guard.u < 0.82, `${label}: u=${guard.u} is outside the open ring`);
}

function check(name, run) {
  try {
    const detail = run();
    results.push({ ok: true, name, detail: detail || '' });
  } catch (error) {
    results.push({ ok: false, name, detail: error && error.message ? error.message : String(error) });
  }
}

check('module exports', () => {
  global.window = global;
  require(path.join(__dirname, '..', 'lib', 'semantic-language.js'));
  require(path.join(__dirname, '..', 'lib', 'semantic-core.js'));
  require(path.join(__dirname, '..', 'lib', 'continuation-protocol.js'));
  require(path.join(__dirname, '..', 'lib', 'semantic-branch-evaluator.js'));
  require(path.join(__dirname, '..', 'lib', 'semantic-command-dsl.js'));
  require(path.join(__dirname, '..', 'lib', 'semantic-transaction.js'));
  require(path.join(__dirname, '..', 'lib', 'semantic-decision.js'));
  core = global.MRDSemanticCore;
  protocol = global.MRDContinuationProtocol;
  branchEvaluator = global.MRDSemanticBranchEvaluator;
  semanticCommandDsl = global.MRDSemanticCommandDSL;
  semanticTransaction = global.MRDSemanticTransaction;
  semanticDecision = global.MRDSemanticDecision;

  assertRecord(core, 'MRDSemanticCore');
  assertRecord(protocol, 'MRDContinuationProtocol');
  assertRecord(branchEvaluator, 'MRDSemanticBranchEvaluator');
  assertRecord(semanticCommandDsl, 'MRDSemanticCommandDSL');
  assertRecord(semanticTransaction, 'MRDSemanticTransaction');
  assertRecord(semanticDecision, 'MRDSemanticDecision');
  ['analyzeText', 'stabilityGuard', 'balanceRepair', 'composeContinuation', 'semanticBacktrack'].forEach((name) => {
    assert(typeof core[name] === 'function', `MRDSemanticCore.${name} is missing`);
  });
  assert(typeof protocol.build === 'function', 'MRDContinuationProtocol.build is missing');
  assert(typeof branchEvaluator.build === 'function', 'MRDSemanticBranchEvaluator.build is missing');
  ['parse', 'validate', 'compile', 'compose'].forEach((name) => {
    assert(typeof semanticCommandDsl[name] === 'function', `MRDSemanticCommandDSL.${name} is missing`);
  });
  ['prepare', 'commit', 'rollback'].forEach((name) => {
    assert(typeof semanticTransaction[name] === 'function', `MRDSemanticTransaction.${name} is missing`);
  });
  assert(typeof semanticDecision.decide === 'function', 'MRDSemanticDecision.decide is missing');
  return 'core '+core.version+'; protocol '+protocol.version+'; branches '+branchEvaluator.version+'; DSL '+semanticCommandDsl.version+'; tx '+semanticTransaction.version+'; decision '+semanticDecision.version;
});

const corpus = [
  {
    id: 'working-continuation',
    kind: 'continuation',
    text: 'Город продолжает путь через мост к реке, затем поезд замечает свет и оставляет следующий ход.',
  },
  {
    id: 'working-detail',
    kind: 'continuation',
    text: 'Мысль выражается словом, через пример получает смысл и затем продолжает путь.',
  },
  {
    id: 'semantic-conflict',
    kind: 'conflict',
    text: 'Смысл спорит с шумом без моста, а движение встречает коллапс.',
  },
  {
    id: 'explicit-3d-compression',
    kind: 'center-3d',
    text: 'Сжать все примеры и детали в одно главное слово, убрать факты и оставить только итог.',
  },
  {
    id: 'explicit-1d-decay',
    kind: 'edge-1d',
    text: 'Распад в 1D: разбить буквы, слоги, части, детали, факты, атомы, осколки, параметры, теги, условия и крохи.',
  },
  {
    id: 'story',
    kind: 'story',
    text: 'Сюжет ведет героя через город к мосту, затем поезд открывает следующий ход у реки.',
  },
  {
    id: 'article',
    kind: 'article',
    text: 'Статья объясняет тему через факт и пример, затем вывод связывает детали и продолжает мысль.',
  },
  {
    id: 'song',
    kind: 'song',
    text: 'Песня течет через тишину сада к свету, потом ритм открывает следующий ход.',
  },
  {
    id: 'goal',
    kind: 'goal',
    target: 'конкретный результат',
    text: 'Цель ведет команду через мост к конкретному результату, затем работа продолжается следующим шагом.',
  },
  {
    id: 'short-word',
    kind: 'short',
    text: 'Мост.',
  },
  {
    id: 'short-nonsense',
    kind: 'short',
    text: 'Абра кадабра.',
  },
  {
    id: 'longer-nonsense',
    kind: 'nonsense',
    text: 'Фыр абра кадабра шмяк буль.',
  },
  {
    id: 'quiet-scene',
    kind: 'continuation',
    text: 'Тишина сада ведет лист через свет к заре, после чего открывается следующий ход.',
  },
  {
    id: 'fact-chain',
    kind: 'continuation',
    text: 'Факт связывает пример с выводом, а мост сохраняет тему и ведет статью дальше.',
  },
];

let snapshots = [];

if (core && protocol) {
  snapshots = corpus.map((entry) => ({
    entry,
    analysis: core.analyzeText(entry.text),
    guard: core.stabilityGuard(entry.text),
    plan: core.composeContinuation(entry.text, 6),
    repair: core.balanceRepair(entry.text, 6),
    protocol: protocol.build(entry.text, entry.target || ''),
    branches: branchEvaluator.build(entry.text, entry.target || ''),
    decision: semanticDecision.decide(entry.text, entry.target || ''),
  }));

  check('corpus coverage', () => {
    const requiredKinds = [
      'continuation',
      'conflict',
      'center-3d',
      'edge-1d',
      'story',
      'article',
      'song',
      'goal',
      'short',
      'nonsense',
    ];
    const kinds = new Set(corpus.map((entry) => entry.kind));
    assert(corpus.length >= 12, `only ${corpus.length} phrases`);
    assert(corpus.every((entry) => /[А-Яа-яЁё]/.test(entry.text)), 'corpus contains a non-Russian/empty phrase');
    requiredKinds.forEach((kind) => assert(kinds.has(kind), `missing category ${kind}`));
    return `${corpus.length} Russian phrases; ${requiredKinds.length} categories`;
  });

  check('result structures', () => {
    snapshots.forEach(({ entry, analysis, guard, plan, repair, protocol: verdict }) => {
      const prefix = entry.id;
      assertRecord(analysis, `${prefix}.analysis`);
      assert(typeof analysis.text === 'string', `${prefix}.analysis.text is not a string`);
      assert(Array.isArray(analysis.tokens), `${prefix}.analysis.tokens is not an array`);
      assert(Array.isArray(analysis.items), `${prefix}.analysis.items is not an array`);
      assert(Array.isArray(analysis.roles), `${prefix}.analysis.roles is not an array`);
      assert(analysis.tokens.length === analysis.items.length, `${prefix}: token/item length mismatch`);
      assert(analysis.tokens.length === analysis.roles.length, `${prefix}: token/role length mismatch`);
      assertRecord(analysis.graph, `${prefix}.analysis.graph`);
      assert(Array.isArray(analysis.graph.links), `${prefix}.analysis.graph.links is not an array`);
      assert(Array.isArray(analysis.graph.gaps), `${prefix}.analysis.graph.gaps is not an array`);
      assert(Array.isArray(analysis.graph.conflicts), `${prefix}.analysis.graph.conflicts is not an array`);
      assertRecord(analysis.graph.metrics, `${prefix}.analysis.graph.metrics`);
      assertRecord(analysis.portal, `${prefix}.analysis.portal`);

      assertRecord(guard, `${prefix}.guard`);
      assert(typeof guard.zone === 'string', `${prefix}.guard.zone is missing`);
      assertRecord(guard.margins, `${prefix}.guard.margins`);
      assert(Array.isArray(guard.checks) && guard.checks.length >= 4, `${prefix}.guard.checks is incomplete`);

      [['plan', plan], ['repair', repair]].forEach(([label, value]) => {
        assertRecord(value, `${prefix}.${label}`);
        assert(Array.isArray(value.items), `${prefix}.${label}.items is not an array`);
        assert(value.items.length > 0, `${prefix}.${label}.items is empty`);
        assertRecord(value.best, `${prefix}.${label}.best`);
        assert(typeof value.best.line === 'string' && value.best.line.length > 0, `${prefix}.${label}.best.line is empty`);
        assert(typeof value.best.text === 'string' && value.best.text.length > entry.text.length, `${prefix}.${label}.best.text was not extended`);
      });

      assertRecord(verdict, `${prefix}.protocol`);
      assert(['accept', 'repair', 'rollback'].includes(verdict.status), `${prefix}: unexpected protocol status ${verdict.status}`);
      assert(Array.isArray(verdict.rows) && verdict.rows.length === 4, `${prefix}.protocol.rows is incomplete`);
      assertRecord(verdict.contract, `${prefix}.protocol.contract`);
      assertRecord(verdict.before, `${prefix}.protocol.before`);
      assertRecord(verdict.after, `${prefix}.protocol.after`);
      assert(typeof verdict.line === 'string', `${prefix}.protocol.line is not a string`);
      assert(typeof verdict.insertLine === 'string', `${prefix}.protocol.insertLine is not a string`);
      assert(typeof verdict.reportText === 'string' && verdict.reportText.length > 0, `${prefix}.protocol.reportText is empty`);
    });
    return `${snapshots.length} analysis/guard/plan/repair/protocol packs`;
  });

  check('normalized numbers', () => {
    snapshots.forEach(({ entry, analysis, guard, plan, repair, protocol: verdict }) => {
      const prefix = entry.id;
      [
        ['core', analysis.core],
        ['edge', analysis.edge],
        ['move', analysis.move],
        ['life', analysis.life],
        ['coherence', analysis.coherence],
        ['semFit', analysis.semFit],
        ['graph.gLink', analysis.graph.metrics.gLink],
        ['guard.score', guard.score],
        ['guard.u', guard.u],
        ['guard.middle', guard.middle],
      ].forEach(([label, value]) => assertUnit(value, `${prefix}.${label}`));
      Object.entries(guard.margins).forEach(([label, value]) => assertUnit(value, `${prefix}.guard.margins.${label}`));
      guard.checks.forEach((item, index) => assertUnit(item.value, `${prefix}.guard.checks[${index}].value`));

      plan.items.forEach((item, index) => {
        ['score', 'life', 'core', 'edge', 'move', 'semFit', 'u'].forEach((key) => {
          assertUnit(item[key], `${prefix}.plan.items[${index}].${key}`);
        });
      });
      repair.items.forEach((item, index) => {
        ['score', 'life', 'core', 'edge', 'move', 'u'].forEach((key) => {
          assertUnit(item[key], `${prefix}.repair.items[${index}].${key}`);
        });
        assertUnit(item.afterGuard.score, `${prefix}.repair.items[${index}].afterGuard.score`);
        assertUnit(item.afterGuard.u, `${prefix}.repair.items[${index}].afterGuard.u`);
      });

      ['guard', 'u', 'life'].forEach((key) => assertUnit(verdict.before[key], `${prefix}.protocol.before.${key}`));
      ['guard', 'u', 'life', 'move'].forEach((key) => assertUnit(verdict.after[key], `${prefix}.protocol.after.${key}`));
      verdict.rows.forEach((row, index) => assertUnit(row.score, `${prefix}.protocol.rows[${index}].score`));
    });
    return 'all public scores and ring coordinates are finite in [0, 1]';
  });

  check('source extremes', () => {
    const center = snapshots.find(({ entry }) => entry.kind === 'center-3d');
    const edge = snapshots.find(({ entry }) => entry.kind === 'edge-1d');
    assert(center.guard.zone === 'center', `3D compression classified as ${center.guard.zone}`);
    assert(edge.guard.zone === 'edge', `1D decay classified as ${edge.guard.zone}`);
    assert(center.guard.checks.some((item) => item.id === 'center' && !item.ok), '3D center check did not fail');
    assert(edge.guard.checks.some((item) => item.id === 'edge' && !item.ok), '1D edge check did not fail');
    return `3D=${center.guard.zone}; 1D=${edge.guard.zone}`;
  });

  check('semantic conflict', () => {
    const conflict = snapshots.find(({ entry }) => entry.kind === 'conflict');
    assert(conflict.analysis.conflicts.length > 0, 'conflict list is empty');
    assert(conflict.analysis.graph.metrics.conflictCount > 0, 'graph conflictCount is zero');
    assert(conflict.guard.zone === 'conflict', `conflict classified as ${conflict.guard.zone}`);
    return `${conflict.analysis.conflicts.length} conflict(s); guard=${conflict.guard.zone}`;
  });

  check('short input blocked', () => {
    const shortCases = snapshots.filter(({ entry }) => entry.kind === 'short');
    shortCases.forEach(({ entry, analysis, protocol: verdict }) => {
      assert(analysis.tokens.length < 3, `${entry.id} is not short enough for the precondition`);
      assert(verdict.status !== 'accept', `${entry.id} was accepted`);
      assert(verdict.contract.pre === false, `${entry.id} unexpectedly passed pre`);
      assert(verdict.insertLine === '', `${entry.id} exposed an insertable line`);
    });
    const empty = protocol.build('', '');
    assert(empty.status === 'empty', `empty input classified as ${empty.status}`);
    assert(empty.insertLine === '', 'empty input exposed an insertable line');
    return `${shortCases.length} short + empty rejected`;
  });

  check('accepted contracts', () => {
    const accepted = snapshots.filter(({ protocol: verdict }) => verdict.status === 'accept');
    assert(accepted.length > 0, 'corpus has no accepted continuation');
    accepted.forEach(({ entry, protocol: verdict }) => {
      assert(verdict.contract.pre && verdict.contract.inv && verdict.contract.post, `${entry.id}: accepted with a failed contract`);
      assert(verdict.insertLine.length > 0 && verdict.insertLine === verdict.line, `${entry.id}: accepted line is not insertable`);
      assert(verdict.after.u > 0.18 && verdict.after.u < 0.82, `${entry.id}: accepted u=${verdict.after.u} is closed`);
    });
    return `${accepted.length} accepted moves satisfy pre/inv/post and 0.18<u<0.82`;
  });

  check('accepted repair moves', () => {
    const riskyKinds = new Set(['center-3d', 'edge-1d', 'conflict']);
    const risky = snapshots.filter(({ entry }) => riskyKinds.has(entry.kind));
    const details = [];

    risky.forEach(({ entry, repair }) => {
      let accepted = null;
      for (const candidate of repair.items) {
        const verdict = protocol.build(candidate.text, entry.target || '');
        if (verdict.status !== 'accept') continue;
        const finalText = `${candidate.text}\n${verdict.insertLine}`;
        const finalGuard = core.stabilityGuard(finalText);
        if (!['safe', 'thin'].includes(finalGuard.zone)) continue;
        accepted = { candidate, verdict, finalGuard };
        break;
      }

      assert(accepted, `${entry.id}: repair produced no accepted protocol move`);
      assertOpenGuard(accepted.candidate.afterGuard, `${entry.id}.repairGuard`);
      assert(accepted.verdict.contract.inv === true, `${entry.id}: accepted repair failed inv`);
      assertOpenGuard(accepted.finalGuard, `${entry.id}.acceptedGuard`);
      details.push(`${entry.id}:${accepted.finalGuard.u.toFixed(2)}`);
    });
    return details.join('; ');
  });

  check('directed branch repair', () => {
    const expected = {
      conflict: 'orbit',
      'center-3d': 'detail',
      'edge-1d': 'generalize',
    };
    const details = [];
    snapshots.forEach(({ entry, branches }) => {
      assertRecord(branches, `${entry.id}.branches`);
      if (entry.kind === 'short') {
        assert(branches.best === null, `${entry.id}: short input exposed best branch`);
        assert(branches.branches.length === 0, `${entry.id}: short input built branches`);
        return;
      }
      assert(Array.isArray(branches.branches) && branches.branches.length === 3, `${entry.id}: expected three branches`);
      const ids = new Set(branches.branches.map((branch) => branch.id));
      ['generalize', 'orbit', 'detail'].forEach((id) => assert(ids.has(id), `${entry.id}: missing ${id}`));
      branches.branches.forEach((branch) => {
        assert(['accept', 'repair', 'reject'].includes(branch.status), `${entry.id}.${branch.id}: invalid status`);
        ['score', 'guard', 'u', 'life', 'move', 'theme', 'newness', 'target'].forEach((key) => {
          assertUnit(branch[key], `${entry.id}.${branch.id}.${key}`);
        });
      });
      if (expected[entry.kind]) {
        assertRecord(branches.best, `${entry.id}.best`);
        assert(branches.best.id === expected[entry.kind], `${entry.id}: expected ${expected[entry.kind]}, got ${branches.best.id}`);
        assert(branches.best.status === 'accept', `${entry.id}: directed repair is not accepted`);
        details.push(`${entry.kind}->${branches.best.id}`);
      }
    });
    return details.join('; ');
  });
  check('decision abstention and scope', () => {
    const nonsense = semanticDecision.decide('Фыр абра кадабра шмяк буль.', '');
    assert(nonsense.decision === 'clarify' && nonsense.reasonCodes.includes('low_coverage'), 'nonsense did not abstain');
    assert(nonsense.insertLine === '', 'nonsense exposed an insertable line');

    const negated = semanticDecision.decide('Не продолжать рассказ и остановить движение.', '');
    assert(negated.decision === 'reject' && negated.reasonCodes.includes('negated_operator'), 'negated continuation was not rejected');

    const mixedOrbit = semanticDecision.decide('Не сжимать тему, а продолжить рассказ через мост.', '');
    assert(mixedOrbit.decision === 'apply' && mixedOrbit.best.id === 'orbit', 'allowed orbit after negation was not selected');
    const mixedDetail = semanticDecision.decide('Не продолжать рассказ, а уточнить одну деталь.', '');
    assert(mixedDetail.decision === 'apply' && mixedDetail.best.id === 'detail', 'allowed detail after negation was not selected');

    const objectKey = semanticDecision.decide('Ключ открыл замок.', '');
    const springKey = semanticDecision.decide('Ключ журчит из земли.', '');
    const ambiguousKey = semanticDecision.decide('Ключ лежит рядом.', '');
    assert(objectKey.interpretation.ambiguities[0].senseId === 'key.object', 'object key sense was not resolved');
    assert(springKey.interpretation.ambiguities[0].senseId === 'key.spring', 'spring key sense was not resolved');
    assert(ambiguousKey.decision === 'clarify' && ambiguousKey.reasonCodes.includes('ambiguous_sense'), 'ambiguous key did not request clarification');
    const conflictDecision = semanticDecision.decide('Смысл спорит с шумом без моста, а движение встречает коллапс.', '');
    const centerDecision = semanticDecision.decide('Сжать все примеры и детали в одно главное слово, убрать факты и оставить только итог.', '');
    const edgeDecision = semanticDecision.decide('Распад в 1D: разбить буквы, слоги, части, детали, факты, атомы, осколки, параметры, теги, условия и крохи.', '');
    assert(conflictDecision.best && conflictDecision.best.id === 'orbit', 'decision did not bridge conflict through orbit');
    assert(centerDecision.best && centerDecision.best.id === 'detail', 'decision did not repair center through detail');
    assert(edgeDecision.best && edgeDecision.best.id === 'generalize', 'decision did not repair edge through generalize');

    [mixedOrbit, mixedDetail, objectKey, springKey].forEach((value) => {
      assert(value.evidenceLevel === 'STRUCTURAL', 'applied decision exceeded or missed STRUCTURAL evidence');
      assert(value.soundness === 'NOT_COMPUTED', 'runtime decision claimed soundness');
    });
    return 'OOV->clarify; negation scoped; WSD; conflict/center/edge directed repair';
  });
  check('typed command composition', () => {
    const applied = semanticDecision.decide('Смысл спорит с шумом, а мост продолжает движение.', '');
    assert(applied.decision === 'apply', 'working phrase was not applied');
    assertRecord(applied.typedProgram, 'typedProgram');
    assert(applied.typedProgram.ok && applied.typedProgram.status === 'composed', 'typed program was not composed');
    assert(applied.typedProgram.portPath === 'ID -> STATE -> EFFECT -> STATE', `unexpected port path ${applied.typedProgram.portPath}`);
    assert(Array.isArray(applied.typedProgram.stages) && applied.typedProgram.stages.length === 3, 'typed program does not expose three stages');
    assertRecord(applied.typedProgram.contract, 'typedProgram.contract');
    ['pre', 'inv', 'post', 'proof', 'evidence'].forEach((key) => {
      assert(applied.typedProgram.contract[key], `typedProgram.contract.${key} is missing`);
    });
    assert(applied.typedProgram.evidence === 'STRUCTURAL', 'typed program over- or under-claimed evidence');
    assert(applied.typedProgram.soundness === 'NOT_COMPUTED', 'typed program claimed mathematical soundness');
    assertRecord(applied.transaction, 'decision.transaction');
    assert(applied.transaction.status === 'READY', `transaction status ${applied.transaction.status}`);
    assert(applied.transaction.afterText === `${applied.source}
${applied.insertLine}`, 'transaction afterText differs from decision line');

    const gated = semanticDecision.decide('Фыр абра кадабра шмяк буль.', '');
    assert(gated.typedProgram.status === 'gated' && !gated.typedProgram.composition, 'abstained input exposed a composition');
    assert(gated.transaction.status === 'GATED', 'abstained input exposed a READY transaction');
    const invalid = semanticCommandDsl.validate('add(ID,QTY)');
    assert(!invalid.ok, 'typed DSL accepted add(ID,QTY)');
    return 'ID->STATE->EFFECT->STATE; TX READY/GATED; add(ID,QTY) blocked';
  });
  check('forbidden probes rollback', () => {
    const source = corpus.find((entry) => entry.id === 'working-continuation');
    const trace = core.semanticBacktrack(source.text, 1, 5);
    assertRecord(trace, 'semanticBacktrack');
    assert(Array.isArray(trace.attempts), 'semanticBacktrack.attempts is not an array');
    const center = trace.attempts.find((attempt) => attempt.probe && attempt.zone === 'center');
    const edge = trace.attempts.find((attempt) => attempt.probe && attempt.zone === 'edge');
    assert(center && center.status === 'rollback' && center.u <= 0.18, 'center probe was not rolled back');
    assert(edge && edge.status === 'rollback' && edge.u >= 0.82, 'edge probe was not rolled back');
    return `center u=${center.u.toFixed(2)}; edge u=${edge.u.toFixed(2)}`;
  });
}

function compact(value, maxLength) {
  const oneLine = String(value || '').replace(/\s+/g, ' ').trim();
  return oneLine.length <= maxLength ? oneLine : `${oneLine.slice(0, maxLength - 1)}…`;
}

function printTable(rows) {
  const normalized = rows.map((row) => ({
    result: row.ok ? 'PASS' : 'FAIL',
    check: compact(row.name, 30),
    detail: compact(row.detail, 92),
  }));
  const headers = { result: 'RESULT', check: 'CHECK', detail: 'DETAIL' };
  const widths = {
    result: Math.max(headers.result.length, ...normalized.map((row) => row.result.length)),
    check: Math.max(headers.check.length, ...normalized.map((row) => row.check.length)),
    detail: Math.max(headers.detail.length, ...normalized.map((row) => row.detail.length)),
  };
  const format = (row) => `${row.result.padEnd(widths.result)} | ${row.check.padEnd(widths.check)} | ${row.detail}`;

  console.log(format(headers));
  console.log(`${'-'.repeat(widths.result)}-+-${'-'.repeat(widths.check)}-+-${'-'.repeat(widths.detail)}`);
  normalized.forEach((row) => console.log(format(row)));
}

printTable(results);
const failures = results.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${results.length - failures}/${results.length} checks; corpus ${corpus.length} phrases.`);
process.exitCode = failures ? 1 : 0;
