'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p78 = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const modules = ['semantic-language', 'semantic-core', 'semantic-reaction-rules', 'semantic-reaction-field', 'semantic-reaction-runtime', 'semantic-trace-continuation', 'continuation-protocol', 'semantic-branch-evaluator', 'semantic-command-dsl', 'semantic-transaction', 'semantic-decision', 'semantic-action-gate', 'text-result', 'output-menu'];
global.window = global;
modules.forEach((name) => require(lib(name)));

const core = global.MRDSemanticCore;
const field = global.MRDSemanticReactionField;
const composer = global.MRDSemanticTraceContinuation;
const gate = global.MRDSemanticActionGate;
const textResult = global.MRDTextResult;
const outputMenu = global.MRDOutputMenu;
const SOURCE = 'Город продолжает путь: мост связывает воду и свет, затем появляется факт.';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function event(id, parentEventId, sourceToken, targetToken, direction, extra = {}) {
  return {
    origin: 'observed', eventId: id, parentEventId, tick: extra.tick || 1, generation: extra.generation || 1,
    ruleId: extra.ruleId || (direction === 'detail' ? 'R_FRAGMENT' : direction === 'generalize' ? 'R_SYNTH' : direction === 'repair' ? 'R_MEDIATE' : 'R_CATALYZE'),
    direction, selectionReason: extra.selectionReason || 'fixture:typed', sourceId: extra.sourceId || sourceToken,
    targetId: extra.targetId || targetToken, sourceToken, targetToken, force: .64, threshold: .28,
    calibrationReason: extra.calibrationReason || null, handoffDirection: extra.handoffDirection || null,
    evidence: 'STRUCTURAL', evidenceLevel: 'STRUCTURAL', soundness: 'NOT_COMPUTED',
  };
}
function snapshot(events, extra = {}) {
  return Object.assign({
    version: 'fixture', kind: 'MRDSemanticReactionRuntimeSnapshot', origin: 'observed', status: 'FIRED',
    tick: events.length ? events[events.length - 1].tick : 0, nodes: [{ id: 'n0' }],
    metrics: { minU: .31, maxU: .69 }, history: events, lastEvents: events.length ? [events[events.length - 1]] : [],
    evidence: 'STRUCTURAL', evidenceLevel: 'STRUCTURAL', soundness: 'NOT_COMPUTED',
  }, extra);
}
function compose(text, observed, reaction) {
  const analysis = core.analyzeText(text);
  return composer.compose({ text, analysis, rails: core.semanticRails(text), observed, reaction });
}

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

assert(core && field && composer && gate && textResult && outputMenu, 'trace continuation stack is incomplete');
const observedEvents = [
  event('obs/e1', null, 'город', 'мост', 'orbit', { tick: 1, generation: 1, sourceId: 'city', targetId: 'bridge' }),
  event('obs/e2', 'obs/e1', 'мост', 'воду', 'detail', { tick: 2, generation: 2, sourceId: 'bridge', targetId: 'water' }),
];
const observed = snapshot(observedEvents);

check('observed parent chain is preferred and reconstructed in causal order', () => {
  const forecast = field.simulate(core.analyzeText(SOURCE), .5);
  const result = compose(SOURCE, observed, forecast);
  assert(result.status === 'READY' && result.origin === 'observed', `status=${result.status} origin=${result.origin}`);
  assert(result.trace.map((item) => item.eventId).join(',') === 'obs/e1,obs/e2', 'parent chain order changed');
  assert(result.witnesses.eventIds.includes('obs/e1') || result.witnesses.eventIds.includes('obs/e2'), 'observed witness ids missing');
  return result.sentence;
});

check('forecast is a deterministic fallback when observed events are absent', () => {
  const analysis = core.analyzeText(SOURCE), forecast = field.simulate(analysis, .5);
  const first = composer.compose({ text: SOURCE, analysis, rails: core.semanticRails(SOURCE), reaction: forecast });
  const second = composer.compose({ text: SOURCE, analysis, rails: core.semanticRails(SOURCE), reaction: forecast });
  assert(first.status === 'READY' && first.origin === 'forecast', `status=${first.status}`);
  assert(first.sentence === second.sentence && first.hashes.trace === second.hashes.trace && first.hashes.output === second.hashes.output, 'fallback is nondeterministic');
  assert(first.trace.every((item, index) => item.parentEventId === (index ? first.trace[index - 1].eventId : null)), 'forecast parent links are not explicit');
});

check('story, article and song templates remain genre-specific', () => {
  const storyText = 'Рассказ ведет героя через мост к карте, затем путь открывает новый сюжет.';
  const story = compose(storyText, snapshot([
    event('story/e1', null, 'героя', 'мост', 'orbit', { sourceId: 1, targetId: 2 }),
    event('story/e2', 'story/e1', 'мост', 'карте', 'detail', { tick: 2, generation: 2, sourceId: 2, targetId: 3 }),
  ]));
  const article = compose(SOURCE, observed);
  const songText = 'Песня держит ритм: строка проходит через мост к свету и дальше.';
  const song = compose(songText, snapshot([
    event('song/e1', null, 'песня', 'мост', 'orbit', { sourceId: 1, targetId: 2 }),
    event('song/e2', 'song/e1', 'мост', 'свету', 'detail', { tick: 2, generation: 2, sourceId: 2, targetId: 3 }),
  ]));
  assert(story.status === 'READY' && story.genre === 'story' && /истори|продолжение/.test(story.sentence), 'story template missing');
  assert(article.status === 'READY' && article.genre === 'article' && /тем|факт|вывод/.test(article.sentence), 'article template missing');
  assert(song.status === 'READY' && song.genre === 'song' && /строк|повтор|ритм/.test(song.sentence), 'song template missing');
});

check('direction and generation-aware handoff select the next template deterministically', () => {
  const text = 'Мысль через мост соединяет слово и букву, затем движение продолжается дальше.';
  const handoff = snapshot([
    event('hand/e1', null, 'мысль', 'мост', 'orbit', { sourceId: 1, targetId: 2 }),
    event('hand/e2', 'hand/e1', 'мост', 'букву', 'orbit', { tick: 2, generation: 2, sourceId: 2, targetId: 3, calibrationReason: 'handoff:underrepresented', handoffDirection: 'generalize' }),
  ]);
  const result = compose(text, handoff);
  assert(result.status === 'READY' && result.direction === 'generalize' && result.directionSource === 'handoff', `direction=${result.direction}`);
  assert(/общ/.test(result.sentence), 'generalize template is not visible');
});

check('ready output has distinct trace-bound witnesses and bounded structural contract', () => {
  const result = compose(SOURCE, observed);
  const words = [result.witnesses.topic.word, result.witnesses.bridge.word, result.witnesses.detail.word];
  assert(new Set(words).size === 3 && result.witnesses.traceWitnesses >= 1, 'witnesses are duplicate or detached from trace');
  assert(result.sentence.startsWith('Дальше ') && result.sentence.length <= 240 && /[.!?]$/.test(result.sentence), 'postcondition failed');
  assert(result.contract.pre.ok && result.contract.inv.ok && result.contract.post.ok, 'ready contract is incomplete');
  assert(result.evidenceLevel === 'STRUCTURAL' && result.soundness === 'NOT_COMPUTED' && result.claims.semanticTruth === false, 'semantic evidence boundary changed');
});

check('short source abstains without an actionable line', () => {
  const result = compose('Круг.', null, { events: [event('f/e1', null, 'круг', 'круг', 'orbit')] });
  assert(result.status === 'ABSTAIN' && result.code === 'TRACE_SOURCE_THIN' && !result.insertLine, `code=${result.code}`);
});

check('missing causal event abstains explicitly', () => {
  const result = compose(SOURCE, snapshot([]), { events: [] });
  assert(result.status === 'ABSTAIN' && result.code === 'TRACE_NO_CAUSAL_EVENT' && !result.insertLine, `code=${result.code}`);
});

check('blocked observed runtime cannot fall back to forecast', () => {
  const forecast = field.simulate(core.analyzeText(SOURCE), .5);
  const result = compose(SOURCE, snapshot([], { status: 'BLOCKED', code: 'fixture' }), forecast);
  assert(result.status === 'ABSTAIN' && result.code === 'TRACE_OBSERVED_BLOCKED' && result.origin === 'observed', `code=${result.code}`);
});

check('open-ring violation abstains before text generation', () => {
  const result = compose(SOURCE, snapshot(observedEvents, { metrics: { minU: .17, maxU: .69 } }));
  assert(result.status === 'ABSTAIN' && result.code === 'TRACE_RING_INVALID' && !result.sentence, `code=${result.code}`);
});

check('operator-only causal chain cannot fabricate witnesses', () => {
  const text = 'Идея продолжение затем движение факт событие открывает тему.';
  const result = compose(text, snapshot([event('op/e1', null, 'продолжение', 'затем', 'orbit')]));
  assert(result.status === 'ABSTAIN' && result.code === 'TRACE_WITNESS_INCOMPLETE' && result.contract.post.ok === false, `code=${result.code}`);
});

check('text result uses ready causal sentence and disables safe-status insertion on abstain', () => {
  const mixed = 'Идея продолжение конкретный факт затем событие.';
  const analysis = core.analyzeText(mixed), reaction = field.simulate(analysis, .5);
  const ready = textResult.summarize(mixed, '', { lambda: .5, reaction });
  assert(ready.traceContinuation && ready.traceContinuation.status === 'READY', 'ready trace projection missing');
  assert(ready.outputLine === `Вывод: ${ready.traceContinuation.sentence}` && ready.insertLine === ready.traceContinuation.insertLine, 'generic result replaced causal output incorrectly');
  const noTrace = textResult.summarize(mixed, '', { lambda: .5, reaction: { events: [], metrics: {} } });
  assert(noTrace.traceContinuation.status === 'ABSTAIN' && !noTrace.insertLine && noTrace.summary.includes('ABSTAIN'), 'abstain remained actionable');
  const unknown = textResult.summarize('Фыр абра кадабра шмяк буль.', '', { lambda: .5, reaction: { events: [], metrics: {} } });
  assert(unknown.status === 'abstain' && unknown.traceContinuation.code === 'LANGUAGE_COVERAGE', 'OOV text result did not abstain');
  assert(!unknown.insertLine && unknown.outputLine.includes('недостаточно распознанного смысла'), 'OOV text result remained actionable or fabricated a continuation');
});

check('scoped semantic packs are reused without changing text or menu output', () => {
  const mixed = 'Идея продолжения конкретный факт затем событие.';
  const analysis = core.analyzeText(mixed);
  const reaction = field.simulate(analysis, .5);
  const precomputed = {
    source: mixed,
    target: '',
    analysis,
    guard: core.stabilityGuard(mixed),
    rails: core.semanticRails(mixed),
    phi: core.semanticPhi(mixed),
    goal: core.semanticGoal(mixed, ''),
  };
  const baselineResult = textResult.summarize(mixed, '', { lambda: .5, reaction });
  const baselineMenu = outputMenu.build(mixed, '', { lambda: .5, reaction });
  const names = ['analyzeText', 'stabilityGuard', 'semanticRails', 'semanticPhi', 'semanticGoal'];
  const originals = {};
  const calls = {};
  names.forEach((name) => {
    originals[name] = core[name];
    calls[name] = 0;
    core[name] = function() {
      calls[name] += 1;
      return originals[name].apply(core, arguments);
    };
  });
  let cachedResult;
  let cachedMenu;
  try {
    cachedResult = textResult.summarize(mixed, '', { lambda: .5, reaction, precomputed });
    cachedMenu = outputMenu.build(mixed, '', { lambda: .5, reaction, precomputed, textResult: cachedResult });
  } finally {
    names.forEach((name) => { core[name] = originals[name]; });
  }
  assert(names.every((name) => calls[name] === 0), 'scoped projection repeated semantic analysis: ' + JSON.stringify(calls));
  assert(cachedResult.status === baselineResult.status && cachedResult.outputLine === baselineResult.outputLine && cachedResult.insertLine === baselineResult.insertLine, 'cached text result changed');
  const project = (menu) => menu.items.map((item) => [item.id, item.kind, item.text, item.insertLine, item.score]);
  assert(JSON.stringify(project(cachedMenu)) === JSON.stringify(project(baselineMenu)), 'cached output menu changed');
  assert(textResult.version === '1.13.0' && outputMenu.version === '1.3.0', 'projection API versions are stale');
});
check('output menu exposes one gated trace item with exact payload', () => {
  const mixed = 'Идея продолжение конкретный факт затем событие.';
  const reaction = field.simulate(core.analyzeText(mixed), .5);
  const result = textResult.summarize(mixed, '', { lambda: .5, reaction });
  const menu = outputMenu.build(mixed, '', { lambda: .5, reaction });
  const items = menu.items.filter((item) => item.id === 'trace');
  assert(items.length === 1 && items[0].kind === 'trace', 'ready trace menu item missing');
  assert(items[0].insertLine === result.traceContinuation.insertLine && items[0].contract.soundness === 'NOT_COMPUTED', 'trace menu payload changed');
  const noTrace = outputMenu.build(mixed, '', { lambda: .5, reaction: { events: [], metrics: {} } }).items.find((item) => item.id === 'trace');
  assert(noTrace && noTrace.kind === 'trace-abstain' && !noTrace.insertLine, 'abstain menu item is actionable');
});

check('ready trace line passes the typed action gate and commits exactly once', () => {
  const text = 'Продолжить статью: город учится беречь воду, но жители спорят о цене. Нужны общий смысл, факты и следующий проверяемый шаг.';
  const analysis = core.analyzeText(text), reaction = field.simulate(analysis, .5);
  const trace = composer.compose({ text, analysis, rails: core.semanticRails(text), reaction });
  const plan = gate.plan(text, { id: 'output.trace', label: 'причинное продолжение', line: trace.insertLine, origin: 'trace', contract: trace.contract }, '');
  assert(trace.status === 'READY' && plan.status === 'READY' && plan.transaction && plan.transaction.status === 'READY', 'trace action did not reach a ready typed transaction');
  const committed = gate.commit(plan, text, '');
  assert(committed.status === 'COMMITTED' && committed.changed === true, `commit=${committed.status}`);
  assert(committed.text === `${text}\n${trace.insertLine}`, 'trace commit changed or normalized the payload');
});

check('p78 load order and action path preserve the trace contract', () => {
  const { html, runtime } = p78;
  const traceIndex = html.indexOf('lib/semantic-trace-continuation.js?v=1.2.0');
  const traceViewIndex = html.indexOf('lib/semantic-trace-view.js?v=1.0.0');
  const textIndex = html.indexOf('lib/text-result.js?v=1.13.0');
  const menuIndex = html.indexOf('lib/output-menu.js?v=1.3.0');
  assert(traceIndex >= 0 && traceIndex < traceViewIndex && traceViewIndex < textIndex && textIndex < menuIndex, 'trace module dependency order is wrong');
  const applyStart = runtime.indexOf('function applyOutputItem('), applyEnd = runtime.indexOf('\n}', applyStart) + 2;
  assert(/commitSemanticAction\(/.test(runtime.slice(applyStart, applyEnd)) && !/condition\.value\s*=/.test(runtime.slice(applyStart, applyEnd)), 'trace menu bypasses action gate');
});

check('browser IIFE is static, deterministic and versioned', () => {
  const source = fs.readFileSync(lib('semantic-trace-continuation'), 'utf8'), sandbox = { console };
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'dynamic evaluation is forbidden');
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: lib('semantic-trace-continuation') }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  assert(sandbox.MRDSemanticTraceContinuation.version === '1.2.0', 'browser export version missing');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
