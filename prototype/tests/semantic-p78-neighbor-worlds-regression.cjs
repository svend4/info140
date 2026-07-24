'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'p78-living-ring-interface.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'p78-living-ring-interface.css'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'lib', 'p78-neighbor-worlds.js'), 'utf8');

function assert(condition, message) { if (!condition) throw new Error(message); }
const checks = [];
function check(name, run) {
  try { checks.push({ name, ok: true, detail: run() || '' }); }
  catch (error) { checks.push({ name, ok: false, detail: error.message || String(error) }); }
}

check('P78 exposes separate 1D and 3D read-only routes', () => {
  assert(/id="neighborWorlds"/.test(html), 'neighbor panel missing');
  assert(/data-open-world="1d"/.test(html) && /data-open-world="3d"/.test(html), 'world commands missing');
  assert(/2D остаётся единственным арбитром текста/.test(html), 'arbiter boundary is not visible');
});

check('exchange and bridge load before the last P78 runtime', () => {
  const contract = html.indexOf('lib/p78-exchange-contract.js');
  const bridge = html.indexOf('lib/p78-neighbor-worlds.js');
  const main = html.indexOf('lib/p78-living-ring-runtime.js');
  assert(contract >= 0 && bridge > contract && main > bridge, 'dependency order is wrong');
  const loaded = [...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)].map((match) => match[1]);
  assert(loaded[loaded.length - 1].startsWith('lib/p78-living-ring-runtime.js'), 'main runtime is no longer last');
});

check('bridge creates only declared 2D requests', () => {
  assert(/from:'2d',to:world/.test(runtime), '2D origin missing');
  assert(/operation:'ENCODE'/.test(runtime) && /operation:'DIAGNOSE_Q6'/.test(runtime), 'declared operations missing');
  assert(!/from:'1d',to:'3d'|from:'3d',to:'1d'/.test(runtime), 'direct neighbor bypass found');
});

check('bridge has no text mutation or action-controller bypass', () => {
  assert(!/sourceEl\.value\s*=|condition\.value\s*=/.test(runtime), 'source mutation found');
  assert(!/commitSemantic|actionController|commitLine|commitText/.test(runtime), 'action-controller bypass found');
  assert(/текст не изменён/.test(runtime), 'read-only result boundary missing');
});

check('stale results are rejected by epoch and revision', () => {
  assert(/contract\.isStale\(value,request\.epoch,request\.revision\)/.test(runtime), 'stale validation missing');
  assert(/STALE · ответ не применён/.test(runtime), 'stale outcome not exposed');
});

check('same-origin popup replies have a validated fallback', () => {
  assert(/addEventListener\('message',acceptWindowMessage\)/.test(runtime), 'window message fallback missing');
  assert(/event\.origin!==global\.location\.origin/.test(runtime), 'message origin is not checked');
  assert(/return acceptResult\(event\.data\)/.test(runtime), 'fallback bypasses contract validation');
});

check('neighbor panel is responsive and analysis-only', () => {
  assert(/<section class="section" data-surface="analysis">[\s\S]*?id="neighborWorlds"/.test(html), 'panel leaked into primary flow');
  assert(/\.neighborWorlds\{display:grid/.test(css), 'panel layout missing');
  assert(/@media \(max-width:680px\)[\s\S]*\.neighborWorlds\{grid-template-columns:1fr\}/.test(css), 'mobile projection missing');
});

check('bridge source is static and versioned', () => {
  assert(/var VERSION='1\.0\.1'/.test(runtime), 'version missing');
  assert(!/\beval\s*\(|new\s+Function\b/.test(runtime), 'dynamic evaluation found');
  assert(!/fetch\s*\(|XMLHttpRequest|WebSocket/.test(runtime), 'network request found');
});

for (const item of checks) process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? ` | ${item.detail}` : ''}\n`);
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
process.exitCode = passed === checks.length ? 0 : 1;
