'use strict';

const vm = require('node:vm');
const { runtime, reactionKernel } = require('./p78-fixture.cjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function block(start, end) {
  const from = runtime.indexOf(start);
  const to = runtime.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `block missing: ${start}`);
  return runtime.slice(from, to);
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

check('runtime cadence is based on display frames, not tempo steps', () => {
  const stepBlock = block('function step(scale){', 'function point(');
  const frameBlock = block('function frame(now){', 'for(var i=0;i<words.length');
  assert(!stepBlock.includes('reactionController.scheduleStep()'), 'runtime remains coupled to physical step');
  assert(frameBlock.includes('worldState.frame.serial%REACTION_RUNTIME_FRAME_INTERVAL===0') && frameBlock.includes('reactionController.scheduleStep()'), 'display-frame cadence missing');
  assert(runtime.includes('var REACTION_RUNTIME_FRAME_INTERVAL=24;'), 'bounded cadence constant missing');
});

check('reaction scheduling implementation exists only in the kernel', () => {
  ['function scheduleReactionRuntimeStep', 'function advanceReactionRuntime', 'function scheduleReactionRuntimeUi'].forEach((needle) => {
    assert(!runtime.includes(needle), `legacy scheduler remains in living runtime: ${needle}`);
  });
  assert(runtime.includes('reactionController=ReactionKernel.create({') && runtime.includes('scheduleIdle:scheduleIdle'), 'kernel wiring or idle adapter missing');
  assert(!reactionKernel.includes('requestAnimationFrame'), 'kernel must not own the display loop');
});
check('runtime frame does not rebuild heavy DOM synchronously', () => {
  const frameBlock = block('function frame(now){', 'for(var i=0;i<words.length');
  ['renderReactionField()', 'renderTextResult()', 'renderOutputMenu()', 'eventLine('].forEach((needle) => {
    assert(!frameBlock.includes(needle), `synchronous frame UI remains: ${needle}`);
  });
  assert(runtime.includes('flushUi:flushReactionRuntimeUi'), 'passive UI adapter is not wired');
});
check('text and menu projection are delegated to the reaction kernel', () => {
  assert(!runtime.includes('var REACTION_OUTPUT_INTERVAL='), 'output cadence still duplicated in living runtime');
  assert(runtime.includes('function flushReactionRuntimeUi(payload)') && runtime.includes('payload.textDirty') && runtime.includes('payload.menuDirty'), 'passive output projection adapter missing');
});
check('observed output refresh reuses scoped semantic packs', () => {
  const textProjection = block('function semanticOutputContext(observed){', 'function updateSemanticTraceOverlay(){');
  assert(textProjection.includes('precomputed:{') && textProjection.includes('analysis:semanticState.analysis') && textProjection.includes('phi:semanticState.phi') && textProjection.includes('goal:semanticState.goal'), 'scoped semantic context missing');
  const menuProjection = block('function outputMenuPack(){', 'function renderOutputMenu(){');
  assert(menuProjection.includes('context.textResult=semanticState.textResult'), 'menu does not reuse the current text projection');
});
check('ordinary panel writes are throttled independently', () => {
  const frameBlock = block('function frame(now){', 'for(var i=0;i<words.length');
  assert(runtime.includes('var PANEL_FRAME_INTERVAL=24;'), 'panel interval missing');
  assert(frameBlock.includes('worldState.frame.serial%PANEL_FRAME_INTERVAL===0') && frameBlock.includes('schedulePanelUpdate()') && !frameBlock.includes('updatePanel()'), 'panel still writes synchronously in the animation frame');
  const scheduler = block('function scheduleIdle(', 'function flushReactionRuntimeUi(payload){');
  assert(scheduler.includes('function schedulePanelUpdate()') && scheduler.includes('uiState.panelUpdateScheduled'), 'panel idle scheduler missing');
});

check('tempo uses bounded time-scaled substeps', () => {
  const stepBlock = block('function step(scale){', 'function point(');
  const frameBlock = block('function frame(now){', 'for(var i=0;i<words.length');
  assert(runtime.includes('var SIMULATION_SUBSTEP_CAP=2;'), 'substep budget missing');
  assert(frameBlock.includes('Math.min(SIMULATION_SUBSTEP_CAP') && frameBlock.includes('step(stepScale)'), 'tempo still expands into unbounded full particle passes');
  assert(stepBlock.includes('worldState.tick+=scale') && stepBlock.includes('*scale') && stepBlock.includes('Math.pow(.65,scale)'), 'scaled integration or stable boundary pull missing');
});

check('rolling frame health instrumentation is bounded', () => {
  assert(runtime.includes('var FRAME_HEALTH_WINDOW=180;'), 'health window missing');
  assert(runtime.includes('if(worldState.frame.healthSamples.length>FRAME_HEALTH_WINDOW) worldState.frame.healthSamples.shift()'), 'health samples are unbounded');
  ['frameMean', 'frameP95', 'frameMax', 'frameStalls', 'runtimeMs', 'frameWorkMs', 'simulationMs', 'drawMs', 'simulationSubsteps'].forEach((key) => assert(runtime.includes(`canvas.dataset.${key}`), `metric missing: ${key}`));
});

check('canvas and spatial workloads have explicit budgets', () => {
  assert(runtime.includes('var VISUAL_PARTICLE_COUNT=180;') && runtime.includes('var REACTION_RUNTIME_PARTICLE_LIMIT=96;'), 'particle budgets missing');
  assert(runtime.includes('out.length<REACTION_RUNTIME_PARTICLE_LIMIT'), 'runtime particle budget is not applied');
  assert(runtime.includes('var LIQUID_BAND_COUNT=6;') && runtime.includes('var LIQUID_BAND_SEGMENTS=72;') && runtime.includes('s<=LIQUID_BAND_SEGMENTS'), 'liquid path budget missing');
  const traceBlock = block('function drawTrace(){', 'function linkStroke(');
  assert(traceBlock.includes('ctx.stroke();') && !traceBlock.includes('ctx.strokeStyle=roleColor(trace[i].role'), 'trace is still stroked segment by segment');
});
check('external browser runtime remains syntactically valid', () => {
  new vm.Script(reactionKernel, { filename: 'p78-reaction-kernel.js' });
  new vm.Script(runtime, { filename: 'p78-living-ring-runtime.js' });
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
