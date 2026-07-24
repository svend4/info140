'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  html,
  css,
  runtime,
  duplicateDomIds,
  assertScriptOrder,
} = require('./p78-fixture.cjs');

const viewPath = path.join(__dirname, '..', 'lib', 'semantic-decision-view.js');
const view = fs.readFileSync(viewPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(source, pattern) {
  return (source.match(pattern) || []).length;
}

function index(label) {
  const value = html.indexOf(label);
  assert(value >= 0, `missing HTML anchor: ${label}`);
  return value;
}

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

check('flow-analysis segmented control is explicit and defaults to flow', () => {
  assert(count(html, /data-mode="flow"/g) === 1, 'flow mode button is missing or duplicated');
  assert(count(html, /data-mode="analysis"/g) === 1, 'analysis mode button is missing or duplicated');
  assert(/data-mode="flow"[^>]*aria-pressed="true"/.test(html), 'flow is not the declared default');
  assert(/class="dockMode"[^>]*role="group"/.test(html), 'mode control is not a grouped segmented control');
});

check('every dock section is classified and the primary flow has four shared surfaces', () => {
  const dock = html.slice(index('<aside class="dock">'), index('</aside>'));
  const sections = dock.match(/<section\b[^>]*class="[^"]*\bsection\b[^"]*"[^>]*>/g) || [];
  assert(sections.length >= 4, 'dock sections are missing');
  assert(sections.every((tag) => /data-surface="(?:shared|analysis)"/.test(tag)), 'unclassified dock section found');
  assert(sections.filter((tag) => /data-surface="shared"/.test(tag)).length === 4, 'primary flow must expose exactly four shared surfaces');
  assert(!/data-surface="flow"/.test(dock), 'flow-only surface would disappear from analysis');
});

check('goal is next to input and the exact result flow follows the guard', () => {
  assert(count(html, /id="goalTarget"/g) === 1 && count(html, /id="goalCheck"/g) === 1, 'goal controls are duplicated');
  assert(index('id="condition"') < index('id="goalTarget"') && index('id="goalTarget"') < index('<aside class="dock">'), 'goal is not in the primary input area');
  assert(index('id="guard"') < index('id="resultFlow"') && index('id="resultFlow"') < index('id="balance"'), 'result flow is not immediately after the guard');
  assert(count(html, /id="continuationProtocol"/g) === 1, 'protocol root is missing or duplicated');
  assert(duplicateDomIds.length === 0, `duplicate ids: ${duplicateDomIds.join(', ')}`);
});

check('controller and mode projection load before the last runtime', () => {
  assert(html.includes('lib/p78-semantic-action-controller.js?v=1.0.0'), 'action controller is not versioned in shell');
  assert(html.includes('lib/p78-interface-mode.js?v=1.0.0'), 'interface mode is not versioned in shell');
  assert(html.includes('lib/semantic-decision-view.js?v=1.6.0'), 'decision view shell version is stale');
  assert(html.includes('lib/p78-living-ring-runtime.js?v=1.10.0'), 'runtime shell version is stale');
  assertScriptOrder(
    'lib/semantic-action-gate.js',
    'lib/p78-semantic-action-controller.js',
    'lib/p78-interface-mode.js',
    'lib/p78-living-ring-runtime.js',
  );
});

check('CSS hides inactive projections and keeps fixed preview geometry responsive', () => {
  assert(/\[hidden\]\s*\{[^}]*display:none!important/.test(css), 'hidden projection rule is missing');
  ['.dockMode{', '.conditionStack{', '.goalInline{', '.transactionPreviewGrid{', '.transactionGuardDelta{'].forEach((token) => {
    assert(css.includes(token), `missing CSS token ${token}`);
  });
  assert(css.includes('.dock [data-surface="shared"]{grid-column:1/-1}'), 'tablet shared-surface span is missing');
});

check('flow projection keeps the decision compact without removing analysis detail', () => {
  ['.decisionMeta,', '.decisionBranches,', '.protocolRows,', '.transactionLedgerProof{display:none}', '#reactionField .reactionFieldMeta,', '#reactionField .reactionLive{display:none}'].forEach((token) => {
    assert(css.includes(token), `flow detail suppression is missing: ${token}`);
  });
  assert(css.includes('#continuationProtocol:not([data-flow-state="READY"]) .transactionPreview{display:none}'), 'non-actionable preview remains expanded in flow mode');
  assert(!view.includes("style.display='none'"), 'decision view owns presentation instead of passive data');
});

check('decision view exposes exact before-after and guard preview', () => {
  assert(view.includes("version:'1.6.0'"), 'decision view API version is stale');
  ['transactionPreview', 'transaction.insertLine', 'transaction.source', 'transaction.afterText', 'transaction.beforeGuard', 'transaction.afterGuard'].forEach((token) => {
    assert(view.includes(token), `preview token is missing: ${token}`);
  });
  ['flowState', 'revision', 'traceHash', 'traceOrigin', 'beforeU', 'afterU'].forEach((token) => {
    assert(view.includes(`setData(root,'${token}'`), `root dataset is missing: ${token}`);
  });
});

check('decision view applies only READY and provides local exact undo', () => {
  assert(view.includes("currentFlowState==='READY'"), 'apply is not gated by READY flow state');
  assert(view.includes("className='transactionUndo'"), 'local undo control is missing');
  assert(view.includes('undo.disabled=!options.canUndo'), 'undo availability is not projected');
  assert(view.includes('if(options.onUndo) options.onUndo()'), 'undo callback is not passive');
});

check('runtime delegates semantic action ownership to the controller', () => {
  assert(runtime.includes('MRDP78SemanticActionController'), 'runtime does not require the controller');
  assert(runtime.includes('actionController='), 'controller instance is missing');
  assert(!runtime.includes('MRDSemanticLedger.record(semanticState.ledger'), 'runtime still owns ledger record');
  assert(!runtime.includes('MRDSemanticLedger.markRolledBack(semanticState.ledger'), 'runtime still owns ledger rollback');
  assert(!/\bgate\.plan\s*\(/.test(runtime) && !/\bgate\.commit\s*\(/.test(runtime), 'runtime still owns action-gate planning/commit');
});

check('runtime initializes modes and renders protocol from the current observed state', () => {
  assert(runtime.includes('MRDP78InterfaceMode.create'), 'interface mode is not initialized');
  const applyStart = runtime.indexOf('function applyCondition()');
  const applyEnd = runtime.indexOf('\n}', applyStart);
  const body = runtime.slice(applyStart, applyEnd);
  assert(body.indexOf('resetWorld();') >= 0, 'applyCondition does not reset observed world');
  assert(body.indexOf('renderTextResult();') > body.indexOf('resetWorld();'), 'text result renders before observed reset');
  assert(body.indexOf('renderContinuationProtocol();') > body.indexOf('renderTextResult();'), 'protocol renders before current text/trace result');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
