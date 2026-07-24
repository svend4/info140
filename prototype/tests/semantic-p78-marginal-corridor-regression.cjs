'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p78 = require('./p78-fixture.cjs');

const engineFile = path.join(__dirname, '..', 'lib', 'p78-marginal-corridor.js');
const viewFile = path.join(__dirname, '..', 'lib', 'p78-marginal-corridor-view.js');
const languageFile = path.join(__dirname, '..', 'lib', 'semantic-language.js');
const semanticFile = path.join(__dirname, '..', 'lib', 'semantic-core.js');
const engineSource = fs.readFileSync(engineFile, 'utf8');
const viewSource = fs.readFileSync(viewFile, 'utf8');
const languageSource = fs.readFileSync(languageFile, 'utf8');
const semanticSource = fs.readFileSync(semanticFile, 'utf8');
const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox);
new vm.Script(languageSource, { filename: languageFile }).runInContext(context, { timeout: 2000 });
new vm.Script(semanticSource, { filename: semanticFile }).runInContext(context, { timeout: 2000 });
new vm.Script(engineSource, { filename: engineFile }).runInContext(context, { timeout: 2000 });
const api = sandbox.MRDP78MarginalCorridor;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function close(actual, expected, tolerance = 1e-9) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}
function occurrences(count, separateSentences = false) {
  return Array.from({ length: count }, (_, index) => ({
    token: `t${index}`,
    lemma: `t${index}`,
    index,
    sentence: separateSentences ? index : 0,
  }));
}
function relations(edges, type = 'sequence') {
  return edges.map(([i, j]) => ({ i, j, type, score: 0.72 }));
}
function language(count, deps, separateSentences = false) {
  return {
    coverage: 1,
    occurrences: occurrences(count, separateSentences),
    grammar: {
      status: deps.length ? 'PASS' : 'UNKNOWN',
      evidenceLevel: 'HEURISTIC',
      dependencies: deps.map(([headIndex, dependentIndex]) => ({
        headIndex,
        dependentIndex,
        status: 'PASS',
      })),
      checks: [],
      failures: [],
    },
  };
}
function field(values) {
  return { particles: values.map((u, index) => ({ id: `p${index}`, u, mass: 1 })) };
}
function realModel(text) {
  return api.evaluate({
    text,
    language: sandbox.MRDSemanticLanguage.analyze(text),
    analysis: sandbox.MRDSemanticCore.analyzeText(text),
    field: field([0.28, 0.52, 0.74, 0.48]),
  });
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

check('API is versioned, frozen and exposes pure diagnostics', () => {
  assert(api && api.version === '1.1.0', 'versioned API missing');
  assert(Object.isFrozen(api), 'API is mutable');
  ['graphStats', 'evaluate', 'decorateTextResult'].forEach((name) => {
    assert(typeof api[name] === 'function', `${name} missing`);
  });
});

check('component and cycle statistics distinguish the two graph boundaries', () => {
  const isolated = api.graphStats(4, []);
  const pathGraph = api.graphStats(4, [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }]);
  const clique = api.graphStats(4, [
    { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 },
    { a: 1, b: 2 }, { a: 1, b: 3 }, { a: 2, b: 3 },
  ]);
  assert(isolated.fragmentation > 0.9 && isolated.rigidity === 0, 'isolated graph is not fragmentation-heavy');
  close(pathGraph.fragmentation, 0);
  close(pathGraph.rigidity, 0);
  close(pathGraph.circulation, 1);
  close(clique.rigidity, 1);
  assert(clique.cycleRank === clique.cycleCapacity, 'clique cycle normalization changed');
});

check('balanced form, grammar and semantics remain in autonomous 2D', () => {
  const chain = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
  const model = api.evaluate({
    text: 'Тема движется через факт и оставляет следующий мост.',
    language: language(6, chain),
    analysis: {
      tokens: occurrences(6).map((item) => item.token),
      relations: relations(chain).concat(relations([[1, 4]], 'bridge')),
      core: 0.17,
      edge: 0.17,
      move: 0.66,
      semFit: 0.8,
    },
    field: field([0.28, 0.52, 0.74, 0.48]),
  });
  assert(model.status === 'READY', `status=${model.status}`);
  assert(model.overall.regime === '2D', `regime=${model.overall.regime}`);
  assert(model.layers.map((item) => item.id).join(',') === 'form,grammar,semantics', 'layers were merged');
  assert(model.semanticTruth === false && model.soundness === 'NOT_COMPUTED', 'epistemic boundary missing');
});

check('lost bridges expose the 1.5D or 1D fragmentation side', () => {
  const model = api.evaluate({
    text: 'Один. Два. Три. Четыре.',
    language: language(4, [], true),
    analysis: {
      tokens: ['один', 'два', 'три', 'четыре'],
      relations: [],
      core: 0,
      edge: 1,
      move: 0,
      semFit: 0.62,
    },
    field: field([0.78, 0.79, 0.77, 0.8]),
  });
  assert(['1.5D', '1D_LIMIT'].includes(model.overall.regime), `regime=${model.overall.regime}`);
  assert(model.overall.fragmentation > model.overall.rigidity, 'fragmentation pressure lost');
  assert(/Связать/.test(model.overall.recommendation), 'bridge repair is not recommended');
});

check('redundant constraints expose 2.5D before the 3D pole', () => {
  const clique = [
    [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
  ];
  const model = api.evaluate({
    text: 'Общий итог связывает каждую часть с каждой.',
    language: language(4, clique),
    analysis: {
      tokens: ['общий', 'итог', 'каждая', 'часть'],
      relations: relations(clique, 'bridge'),
      core: 1,
      edge: 0,
      move: 0,
      semFit: 0.9,
    },
    field: field([0.2, 0.24, 0.22, 0.26]),
  });
  assert(['2.5D', '3D_LIMIT'].includes(model.overall.regime), `regime=${model.overall.regime}`);
  assert(model.overall.rigidity > model.overall.fragmentation, 'rigidity pressure lost');
  assert(/Ослабить/.test(model.overall.recommendation), 'constraint release is not recommended');
});

check('real language pipeline separates fragmentation, circulation and explicit consolidation', () => {
  const fragmented = realModel('Один. Два. Три. Четыре.');
  const balanced = realModel('Тема движется через факт и оставляет следующий смысловой мост открытым.');
  const rigid = realModel('Общий итог связывает каждую часть с каждой и сводит все детали в один окончательный тезис.');
  assert(['1.5D', '1D_LIMIT'].includes(fragmented.overall.regime), `fragmented=${fragmented.overall.regime}`);
  assert(balanced.overall.regime === '2D', `balanced=${balanced.overall.regime}`);
  assert(['2.5D', '3D_LIMIT'].includes(rigid.overall.regime), `rigid=${rigid.overall.regime}`);
  assert(balanced.overall.circulation >= 0.9 * Math.max(balanced.overall.fragmentation, balanced.overall.rigidity), '2D circulation gate changed');
  assert(rigid.layers.find((layer) => layer.id === 'semantics').note.includes('одному тезису'), 'explicit consolidation witness missing');
});

check('jamming trace computes K, N and D but never supplies a semantic target', () => {
  const model = api.evaluate({
    text: 'Тема идет дальше.',
    language: language(3, [[0, 1], [1, 2]]),
    analysis: {
      tokens: ['тема', 'идет', 'дальше'],
      relations: relations([[0, 1], [1, 2]]),
      core: 0.2,
      edge: 0.2,
      move: 0.6,
      semFit: 0.75,
    },
    field: field([0.2, 0.5, 0.8]),
  });
  assert(model.jamming.status === 'READY', 'jamming trace abstained');
  ['K', 'N', 'D', 'gap'].forEach((key) => assert(Number.isFinite(model.jamming[key]), `${key} is not finite`));
  assert(model.jamming.diagnosticOnly === true && model.jamming.target === null, 'physical identity became a runtime target');
  assert(/не является законом языка/.test(model.jamming.warning), 'scope warning missing');
});

check('text result receives one explicit corridor row and recommendation', () => {
  const model = api.evaluate({
    text: 'Тема идет дальше.',
    language: language(3, [[0, 1], [1, 2]]),
    analysis: {
      tokens: ['тема', 'идет', 'дальше'],
      relations: relations([[0, 1], [1, 2]]),
      core: 0.2,
      edge: 0.2,
      move: 0.6,
      semFit: 0.75,
    },
    field: field([0.3, 0.5, 0.7]),
  });
  const original = { summary: 'Исходный вывод.', rows: [], formula: 'result = text' };
  const decorated = api.decorateTextResult(original, model);
  assert(original.rows.length === 0, 'input pack was mutated');
  assert(decorated.rows.length === 1 && decorated.rows[0].label === 'коридор', 'corridor row missing');
  assert(decorated.summary.includes(model.overall.recommendation), 'recommendation missing from text result');
});

check('shell loads the engine and view before the final runtime', () => {
  p78.assertScriptOrder(
    'lib/p78-marginal-corridor.js',
    'lib/p78-marginal-corridor-view.js',
    'lib/p78-living-ring-runtime.js',
  );
  assert(p78.html.includes('id="marginalCorridor"'), 'corridor DOM root missing');
  assert(p78.runtime.includes('renderMarginalCorridor();'), 'runtime integration missing');
});

check('engine is DOM-free and both files are static classic JavaScript', () => {
  assert(!/\bdocument\b|getElementById|querySelector/.test(engineSource), 'engine accesses DOM');
  assert(!/\binnerHTML\b/.test(viewSource), 'view uses unsafe HTML insertion');
  assert(!/https?:\/\//i.test(engineSource + viewSource), 'network endpoint found');
  assert(!/\beval\s*\(|\bnew\s+Function\b/.test(engineSource + viewSource), 'dynamic evaluation found');
  assert(viewSource.includes("layerStatus+' · '+fixed(layer.confidence)"), 'layer status is not visible');
  new vm.Script(engineSource, { filename: engineFile });
  new vm.Script(viewSource, { filename: viewFile });
});

checks.forEach((result) => {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
});
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
