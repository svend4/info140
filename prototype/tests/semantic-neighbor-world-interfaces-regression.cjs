'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const tapeHtml = read('p79-pulse-tape-1d.html');
const q6Html = read('p80-hypercube-center-3d.html');
const css = read('p79-p80-neighbor-worlds.css');
const tapeRuntime = read(path.join('lib', 'p79-pulse-tape-runtime.js'));
const q6Runtime = read(path.join('lib', 'p80-hypercube-center-runtime.js'));

function assert(condition, message) { if (!condition) throw new Error(message); }
const checks = [];
function check(name, run) {
  try { checks.push({ name, ok: true, detail: run() || '' }); }
  catch (error) { checks.push({ name, ok: false, detail: error.message || String(error) }); }
}

function scripts(html) {
  return [...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)].map((match) => match[1]);
}

check('P79 is a separate local 1D interface', () => {
  assert(/<title>п79 · 1D Pulse Tape<\/title>/.test(tapeHtml), 'P79 title missing');
  assert(/id="tapeWorld"/.test(tapeHtml) && /id="tapeBinary"/.test(tapeHtml) && /id="tapeMorse"/.test(tapeHtml), 'P79 surfaces incomplete');
  assert(/p78-living-ring-interface\.html/.test(tapeHtml), 'P79 cannot return to 2D');
  assert(!/p80-hypercube-center-3d\.html/.test(tapeHtml), 'P79 exposes forbidden direct 1D to 3D route');
});

check('P80 is a separate full-bleed Q6 interface', () => {
  assert(/<title>п80 · 3D Q6 Center<\/title>/.test(q6Html), 'P80 title missing');
  assert(/id="q6Viewport"/.test(q6Html) && /id="q6Bits"/.test(q6Html), 'P80 surfaces incomplete');
  assert(/p78-living-ring-interface\.html/.test(q6Html), 'P80 cannot return to 2D');
  assert(!/p79-pulse-tape-1d\.html/.test(q6Html), 'P80 exposes forbidden direct 3D to 1D route');
  assert(/\.q6Viewport\{position:absolute;inset:0\}/.test(css), '3D scene is not full bleed');
});

check('both interfaces load versioned local modules only', () => {
  for (const src of [...scripts(tapeHtml), ...scripts(q6Html)]) {
    assert(!/^https?:/i.test(src), `external runtime: ${src}`);
    assert(/\?v=/.test(src), `unversioned runtime: ${src}`);
  }
  assert(scripts(tapeHtml).slice(-2).join('|').includes('p78-timeline-codec.js'), 'P79 codec missing');
  assert(scripts(q6Html)[0].startsWith('vendor/three-r128.min.js'), 'local Three.js is not first');
});

check('vendored Three.js and license are present without bloating HTML', () => {
  const library = path.join(root, 'vendor', 'three-r128.min.js');
  const license = path.join(root, 'vendor', 'THREE-LICENSE.txt');
  assert(fs.statSync(library).size > 500000, 'Three.js vendor file is incomplete');
  assert(/MIT License/.test(fs.readFileSync(license, 'utf8')), 'Three.js license missing');
  assert(Buffer.byteLength(q6Html) < 10000 && Buffer.byteLength(tapeHtml) < 10000, 'interface HTML is unnecessarily heavy');
});

check('P79 runtime preserves exact codec and report boundaries', () => {
  assert(/codec\.encode\(source\.value/.test(tapeRuntime), 'codec is not used');
  assert(/operation:'SEQUENCE_REPORT'/.test(tapeRuntime), 'sequence report missing');
  assert(/roundtripOk:!!binary\.roundtripExact/.test(tapeRuntime), 'roundtrip proof missing');
  assert(!/MRDSemanticAction|condition\.value\s*=|commitLine|commitText/.test(tapeRuntime), 'P79 can mutate P78 text');
});

check('P80 runtime renders the verified Q6 graph and one-bit path', () => {
  assert(/q6\.projectGraph/.test(q6Runtime), 'verified graph projection missing');
  assert(/projection\.vertices\.length/.test(q6Runtime) && /projection\.edges\.length/.test(q6Runtime), '64/192 telemetry missing');
  assert(/q6\.findCounterfactual/.test(q6Runtime) && /allowedBits:\[selectedBit\]/.test(q6Runtime), 'one-bit counterfactual missing');
  assert(/operation:'HYPERCUBE_REPORT'/.test(q6Runtime), 'hypercube report missing');
  assert(!/MRDSemanticAction|condition\.value\s*=|commitLine|commitText/.test(q6Runtime), 'P80 can mutate P78 text');
});

check('both neighbors return through an origin-scoped opener fallback', () => {
  assert(/opener\.postMessage\(reply,global\.location\.origin\)/.test(tapeRuntime), 'P79 opener fallback missing');
  assert(/opener\.postMessage\(reply,global\.location\.origin\)/.test(q6Runtime), 'P80 opener fallback missing');
});

check('runtimes are syntactically valid classic JavaScript', () => {
  new vm.Script(tapeRuntime, { filename: 'p79-pulse-tape-runtime.js' });
  new vm.Script(q6Runtime, { filename: 'p80-hypercube-center-runtime.js' });
  assert(!/\beval\s*\(|new\s+Function\b/.test(tapeRuntime + q6Runtime), 'dynamic evaluation found');
});

check('responsive controls keep fixed-format elements bounded', () => {
  assert(/\.tapeScene\{[^}]*aspect-ratio:16\/5/.test(css), 'tape aspect ratio missing');
  assert(/\.triState\{display:grid;grid-template-columns:repeat\(3,1fr\)/.test(css), 'tri-state dimensions unstable');
  assert(/@media \(max-width:560px\)/.test(css) && /@media \(max-width:880px\)/.test(css), 'mobile layout missing');
  assert(!/font-size:\s*clamp\(/.test(css), 'viewport-scaled font found');
});

for (const item of checks) process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? ` | ${item.detail}` : ''}\n`);
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
process.exitCode = passed === checks.length ? 0 : 1;
