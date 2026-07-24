'use strict';

const vm = require('node:vm');
const {
  html,
  runtime,
  scriptSources,
  styleSources,
  duplicateDomIds,
  normalizeAssetSource,
  assetSourceMatches,
  scriptSourceIndex,
  assertScriptOrder,
} = require('./p78-fixture.cjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasVersion(source) {
  return /(?:\?|&)v=[^&#]+(?:[&#]|$)/i.test(source);
}

function isLocalAsset(source) {
  return !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(String(source).trim());
}

function attributeValue(tag, name) {
  const expression = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>` + '`' + `]+))`,
    'i',
  );
  const match = expression.exec(tag);
  return match ? match[1] ?? match[2] ?? match[3] ?? '' : null;
}

function inlineExecutableScripts(source) {
  const scripts = [];
  const expression = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = expression.exec(source))) {
    const openingTag = `<script${match[1]}>`;
    if (attributeValue(openingTag, 'src') !== null) continue;
    const type = (attributeValue(openingTag, 'type') || '').trim().toLowerCase();
    if (!type || type === 'module' || /(?:java|ecma)script/.test(type)) {
      scripts.push({ type: type || 'classic', body: match[2] });
    }
  }
  return scripts;
}

function inlineEventAttributes(source) {
  const withoutScriptBodies = source.replace(
    /(<script\b[^>]*>)[\s\S]*?(<\/script\s*>)/gi,
    '$1$2',
  );
  const tags = withoutScriptBodies.match(/<[a-z][^>]*>/gi) || [];
  const handlers = [];
  for (const tag of tags) {
    const matches = tag.matchAll(/\s(on[a-z][\w:-]*)\s*=/gi);
    for (const match of matches) handlers.push(match[1].toLowerCase());
  }
  return handlers;
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

check('shell loads exactly one versioned p78 stylesheet', () => {
  const matches = styleSources.filter((source) => (
    assetSourceMatches(source, 'p78-living-ring-interface.css')
  ));
  assert(matches.length === 1, `expected 1 p78 stylesheet, found ${matches.length}`);
  assert(hasVersion(matches[0]), `p78 stylesheet is not versioned: ${matches[0]}`);
});

check('shell loads exactly one versioned p78 runtime and loads it last', () => {
  const matches = scriptSources.filter((source) => (
    assetSourceMatches(source, 'lib/p78-living-ring-runtime.js')
  ));
  assert(matches.length === 1, `expected 1 p78 runtime, found ${matches.length}`);
  assert(hasVersion(matches[0]), `p78 runtime is not versioned: ${matches[0]}`);
  assert(
    scriptSourceIndex('lib/p78-living-ring-runtime.js') === scriptSources.length - 1,
    `p78 runtime must be last; last source is ${scriptSources.at(-1) || '(none)'}`,
  );
});

check('shell loads one versioned state owner and reaction kernel before the p78 runtime', () => {
  const stateMatches = scriptSources.filter((source) => (
    assetSourceMatches(source, 'lib/p78-runtime-state.js')
  ));
  const kernelMatches = scriptSources.filter((source) => (
    assetSourceMatches(source, 'lib/p78-reaction-kernel.js')
  ));
  assert(stateMatches.length === 1, `expected 1 p78 state owner, found ${stateMatches.length}`);
  assert(kernelMatches.length === 1, `expected 1 p78 reaction kernel, found ${kernelMatches.length}`);
  assert(hasVersion(stateMatches[0]), `p78 state owner is not versioned: ${stateMatches[0]}`);
  assert(hasVersion(kernelMatches[0]), `p78 reaction kernel is not versioned: ${kernelMatches[0]}`);
  assertScriptOrder('lib/p78-runtime-state.js', 'lib/p78-reaction-kernel.js', 'lib/p78-living-ring-runtime.js');
});
check('shell contains no style block or executable inline script', () => {
  const styleBlocks = html.match(/<style\b/gi) || [];
  const inlineScripts = inlineExecutableScripts(html);
  const violations = [];
  if (styleBlocks.length) violations.push(`found ${styleBlocks.length} <style> block(s)`);
  if (inlineScripts.length) {
    violations.push(
      `found ${inlineScripts.length} executable inline script(s): ${inlineScripts.map((item) => item.type).join(', ')}`,
    );
  }
  assert(violations.length === 0, violations.join('; '));
});

check('shell contains no inline event-handler attributes', () => {
  const handlers = inlineEventAttributes(html);
  assert(
    handlers.length === 0,
    `found inline event attribute(s): ${[...new Set(handlers)].join(', ')}`,
  );
});

check('shell DOM ids are unique', () => {
  assert(
    duplicateDomIds.length === 0,
    `duplicate DOM id(s): ${duplicateDomIds.join(', ')}`,
  );
});

check('all local script sources are versioned', () => {
  const unversioned = scriptSources.filter((source) => isLocalAsset(source) && !hasVersion(source));
  assert(
    unversioned.length === 0,
    `unversioned local script source(s): ${unversioned.join(', ')}`,
  );
});

check('semantic-language precedes its semantic consumers', () => {
  const language = 'lib/semantic-language.js';
  const consumers = [
    'lib/semantic-core.js',
    'lib/semantic-decision.js',
    'lib/text-result.js',
  ];
  for (const consumer of consumers) assertScriptOrder(language, consumer);
});

check('p78 runtime follows every declared dependency', () => {
  const runtimeIndex = scriptSourceIndex('lib/p78-living-ring-runtime.js');
  assert(runtimeIndex >= 0, 'p78 runtime source is missing');
  const sourcesAfterRuntime = scriptSources.slice(runtimeIndex + 1);
  assert(
    sourcesAfterRuntime.length === 0,
    `script source(s) loaded after runtime: ${sourcesAfterRuntime.join(', ')}`,
  );
});

check('p78 runtime uses no dynamic evaluation or external HTTP endpoint', () => {
  const hazards = [];
  if (/\beval\s*\(/.test(runtime)) hazards.push('eval(...)');
  if (/\bnew\s+Function\b/.test(runtime)) hazards.push('new Function');
  const endpoints = runtime.match(/https?:\/\/[^\s"'`<>]+/gi) || [];
  if (endpoints.length) hazards.push(`HTTP endpoint(s): ${[...new Set(endpoints)].join(', ')}`);
  assert(hazards.length === 0, hazards.join('; '));
});

check('p78 runtime is valid classic JavaScript', () => {
  new vm.Script(runtime, { filename: normalizeAssetSource('lib/p78-living-ring-runtime.js') });
});

check('p78 runtime has exactly one requestAnimationFrame(frame) continuation', () => {
  const starts = runtime.match(/\brequestAnimationFrame\s*\(\s*frame\s*\)/g) || [];
  assert(starts.length === 1, `expected 1 requestAnimationFrame(frame), found ${starts.length}`);
});

checks.forEach((result) => {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
});
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
