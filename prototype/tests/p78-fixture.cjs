'use strict';

const fs = require('node:fs');
const path = require('node:path');

const prototypePath = path.resolve(__dirname, '..');
const htmlPath = path.join(prototypePath, 'p78-living-ring-interface.html');
const cssPath = path.join(prototypePath, 'p78-living-ring-interface.css');
const reactionKernelPath = path.join(prototypePath, 'lib', 'p78-reaction-kernel.js');
const runtimePath = path.join(prototypePath, 'lib', 'p78-living-ring-runtime.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const reactionKernel = fs.readFileSync(reactionKernelPath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const combinedSource = [html, css, reactionKernel, runtime].join('\n\n');

function attributeValue(tag, name) {
  const expression = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>` + '`' + `]+))`,
    'i',
  );
  const match = expression.exec(tag);
  return match ? match[1] ?? match[2] ?? match[3] ?? '' : null;
}

function collectTags(source, name) {
  return source.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || [];
}

const scriptSources = collectTags(html, 'script')
  .map((tag) => attributeValue(tag, 'src'))
  .filter((source) => source !== null);

const styleSources = collectTags(html, 'link')
  .filter((tag) => {
    const rel = attributeValue(tag, 'rel');
    return rel && rel.toLowerCase().split(/\s+/).includes('stylesheet');
  })
  .map((tag) => attributeValue(tag, 'href'))
  .filter((source) => source !== null);

const domIds = [];
const openingTags = html.match(/<[a-z][^>]*>/gi) || [];
for (const tag of openingTags) {
  const id = attributeValue(tag, 'id');
  if (id !== null) domIds.push(id);
}

const domIdCounts = new Map();
for (const id of domIds) domIdCounts.set(id, (domIdCounts.get(id) || 0) + 1);
const duplicateDomIds = [...domIdCounts]
  .filter(([, count]) => count > 1)
  .map(([id]) => id);

function normalizeAssetSource(source) {
  return String(source || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/[?#].*$/, '')
    .replace(/^\.\//, '')
    .replace(/^\//, '');
}

function assetSourceMatches(actual, expected) {
  const actualPath = normalizeAssetSource(actual);
  const expectedPath = normalizeAssetSource(expected);
  return actualPath === expectedPath
    || actualPath.endsWith(`/${expectedPath}`)
    || expectedPath.endsWith(`/${actualPath}`);
}

function scriptSourceIndex(expected) {
  return scriptSources.findIndex((source) => assetSourceMatches(source, expected));
}

function checkScriptOrder(...expectedSources) {
  const expected = expectedSources.flat();
  const indices = expected.map((source) => scriptSourceIndex(source));
  const missing = expected.filter((source, index) => indices[index] < 0);
  const ordered = missing.length === 0
    && indices.every((index, position) => position === 0 || index > indices[position - 1]);

  return {
    ok: ordered,
    expected,
    indices,
    missing,
    message: missing.length
      ? `missing script source(s): ${missing.join(', ')}`
      : ordered
        ? ''
        : `script order mismatch: ${expected.map((source, index) => `${source}@${indices[index]}`).join(' < ')}`,
  };
}

function assertScriptOrder(...expectedSources) {
  const result = checkScriptOrder(...expectedSources);
  if (!result.ok) throw new Error(result.message);
  return result;
}

module.exports = {
  htmlPath,
  cssPath,
  reactionKernelPath,
  runtimePath,
  html,
  css,
  reactionKernel,
  runtime,
  combinedSource,
  scriptSources,
  styleSources,
  domIds,
  duplicateDomIds,
  normalizeAssetSource,
  assetSourceMatches,
  scriptSourceIndex,
  checkScriptOrder,
  assertScriptOrder,
};
