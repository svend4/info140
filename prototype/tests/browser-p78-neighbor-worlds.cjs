'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (_) {
    const root = path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'runtimes', 'cua_node');
    if (!fs.existsSync(root)) throw new Error('Playwright is unavailable. Set NODE_PATH or install Playwright.');
    const versions = fs.readdirSync(root).sort().reverse();
    for (const version of versions) {
      const candidate = path.join(root, version, 'bin', 'node_modules', 'playwright');
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw new Error('Playwright was not found in the Codex runtime.');
  }
}

const { chromium } = loadPlaywright();
const BASE = process.env.P78_BROWSER_BASE || 'http://localhost/01/games/02/prototype/';
const SCREENSHOTS = process.env.TEMP || 'C:/tmp';
const SCOPE = process.argv[2] || 'all';
const errors = [];
let passed = 0;
let total = 0;

function check(name, ok, detail) {
  total += 1;
  if (ok) passed += 1;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${JSON.stringify(detail == null ? '' : detail)}\n`);
}

function watch(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${label} page: ${String(error)}`));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    errors.push(`${label} request: ${request.url()} :: ${failure ? failure.errorText : 'unknown'}`);
  });
}

async function goto(page, file) {
  const response = await page.goto(`${BASE}${file}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return response && response.status();
}

async function canvasHash(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const context = canvas.getContext('2d');
    if (!context) return null;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261 >>> 0;
    let visible = 0;
    for (let index = 0; index < data.length; index += 128) {
      const value = data[index] | (data[index + 1] << 8) | (data[index + 2] << 16) | (data[index + 3] << 24);
      hash = Math.imul((hash ^ value) >>> 0, 16777619) >>> 0;
      if (data[index] + data[index + 1] + data[index + 2] > 45) visible += 1;
    }
    return { hash, visible, width: canvas.width, height: canvas.height };
  });
}

async function overflow(page) {
  return page.evaluate(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    nodes: [...document.querySelectorAll('*')]
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > innerWidth + 1 || rect.left < -1 || rect.width > innerWidth + 1)
      .slice(0, 12)
      .map(({ node, rect }) => ({
        tag: node.tagName,
        id: node.id,
        className: typeof node.className === 'string' ? node.className : '',
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      })),
    controls: [...document.querySelectorAll('button,a,textarea,select,pre')]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.right > innerWidth + 1 || rect.left < -1;
      })
      .map((node) => node.id || node.textContent.trim().slice(0, 30)),
  }));
}

async function openPopup(context, ring, selector) {
  const popupPromise = context.waitForEvent('page', { timeout: 10000 });
  await ring.locator(selector).evaluate((element) => element.click());
  const popup = await popupPromise;
  watch(popup, selector);
  await popup.waitForLoadState('domcontentloaded');
  return popup;
}

async function auditTape(context) {
  const page = await context.newPage();
  watch(page, 'p79');
  const status = await goto(page, 'p79-pulse-tape-1d.html?audit=1');
  await page.waitForFunction(() => document.querySelector('#tapeWorld')?.dataset.drawn === '1');
  check('P79 localhost HTTP 200', status === 200, status);
  check('P79 default codec is READY', await page.locator('#tapeStatus').getAttribute('data-status') === 'READY', await page.locator('#tapeStatus').textContent());
  check('P79 exact binary roundtrip', await page.locator('#tapeRoundtrip').textContent() === 'OK', await page.locator('#tapeRoundtrip').textContent());

  const first = await canvasHash(page, '#tapeWorld');
  await page.waitForTimeout(500);
  const second = await canvasHash(page, '#tapeWorld');
  check('P79 canvas is painted', first && first.visible > 300, first);
  check('P79 tape keeps moving', first && second && first.hash !== second.hash, { first: first && first.hash, second: second && second.hash });

  await page.fill('#tapeSource', '\u0421\u041e\u0421');
  await page.selectOption('#tapeProfile', 'cyrillic-ru-v1');
  await page.locator('#tapeEncode').evaluate((element) => element.click());
  check('P79 explicit Cyrillic profile is READY', await page.locator('#tapeStatus').getAttribute('data-status') === 'READY', await page.locator('#tapeStatus').textContent());

  await page.fill('#tapeSource', 'SOS \u041f\u0440\u0438\u0432\u0435\u0442');
  await page.selectOption('#tapeProfile', 'international-itu-r-m1677-1');
  await page.locator('#tapeEncode').evaluate((element) => element.click());
  check('P79 unsupported mixed alphabet is PARTIAL', await page.locator('#tapeStatus').getAttribute('data-status') === 'PARTIAL', await page.locator('#tapeStatus').textContent());
  check('P79 names unsupported symbols', (await page.locator('#tapeMorse').textContent()).includes('unsupported:'), await page.locator('#tapeMorse').textContent());

  await page.screenshot({ path: path.join(SCREENSHOTS, 'p79-pulse-tape.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await overflow(page);
  check('P79 mobile has no horizontal overflow', mobile.documentWidth <= mobile.viewport && mobile.controls.length === 0, mobile);
  await page.close();
}

async function auditCenter(context) {
  const page = await context.newPage();
  watch(page, 'p80');
  const status = await goto(page, 'p80-hypercube-center-3d.html?audit=1');
  await page.waitForSelector('#q6Viewport canvas', { timeout: 15000 });
  await page.waitForFunction(() => Number(document.querySelector('#q6Viewport')?.dataset.frames || 0) > 20, null, { timeout: 15000 });
  check('P80 localhost HTTP 200', status === 200, status);

  const graph = await page.locator('#q6Viewport').evaluate((node) => ({
    vertices: node.dataset.vertices,
    edges: node.dataset.edges,
    frames: node.dataset.frames,
    status: node.dataset.q6Status,
  }));
  check('P80 renders verified Q6 64/192', graph.vertices === '64' && graph.edges === '192', graph);
  check('P80 starts honestly unknown', graph.status === 'ABSTAIN', graph.status);

  await page.locator('.bitRow .triState button[data-value="1"]').evaluateAll((buttons) => buttons.forEach((button) => button.click()));
  await page.waitForFunction(() => document.querySelector('#q6Viewport')?.dataset.q6Status === 'READY');
  await page.locator('#q6Diagnose').evaluate((element) => element.click());
  check('P80 six explicit predicates produce READY', await page.locator('#q6Status').getAttribute('data-status') === 'READY', await page.locator('#q6StateLabel').textContent());
  check('P80 selects exact state 111111', (await page.locator('#q6StateLabel').textContent()).startsWith('111111'), await page.locator('#q6StateLabel').textContent());
  await page.locator('#q6Counterfactual').evaluate((element) => element.click());
  check('P80 counterfactual changes one bit', await page.locator('#q6Path').textContent() === '1', await page.locator('#q6Status').textContent());

  const screenshot = path.join(SCREENSHOTS, 'p80-q6-center.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  check('P80 screenshot is nonblank-sized', fs.statSync(screenshot).size > 30000, fs.statSync(screenshot).size);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await overflow(page);
  check('P80 mobile controls stay inside viewport', mobile.controls.length === 0, mobile);
  await page.close();
}

async function auditExchange(context) {
  const ring = await context.newPage();
  watch(ring, 'p78');
  let status = await goto(ring, 'p78-living-ring-interface.html?neighbors=1');
  await ring.evaluate(() => localStorage.clear());
  status = await ring.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).then((response) => response && response.status());
  await ring.waitForSelector('#continuationProtocol[data-flow-state]');
  check('P78 localhost HTTP 200', status === 200, status);

  const original = await ring.locator('#condition').inputValue();
  await ring.locator('.dockMode [data-mode="analysis"]').evaluate((element) => element.click());
  check('P78 exposes neighbors in analysis mode', await ring.locator('#neighborWorlds').isVisible(), await ring.locator('#neighborReport').textContent());

  let popup = await openPopup(context, ring, '[data-open-world="1d"]');
  await ring.waitForFunction(() => document.querySelector('#neighborReport')?.textContent.includes('1D:'), null, { timeout: 15000 });
  check('P78 receives validated 1D report', (await ring.locator('#neighborReport').textContent()).includes('\u0442\u0435\u043a\u0441\u0442 \u043d\u0435 \u0438\u0437\u043c\u0435\u043d\u0451\u043d'), await ring.locator('#neighborReport').textContent());
  check('1D cannot change P78 source', await ring.locator('#condition').inputValue() === original, await ring.locator('#condition').inputValue());
  await popup.close();

  popup = await openPopup(context, ring, '[data-open-world="3d"]');
  await ring.waitForFunction(() => document.querySelector('#neighborReport')?.textContent.includes('3D:'), null, { timeout: 15000 });
  check('P78 receives validated Q6 report', (await ring.locator('#neighborReport').textContent()).includes('\u0442\u0435\u043a\u0441\u0442 \u043d\u0435 \u0438\u0437\u043c\u0435\u043d\u0451\u043d'), await ring.locator('#neighborReport').textContent());
  check('Q6 cannot change P78 source', await ring.locator('#condition').inputValue() === original, await ring.locator('#condition').inputValue());
  await popup.close();

  await ring.screenshot({ path: path.join(SCREENSHOTS, 'p78-neighbor-panel.png'), fullPage: true });
  await ring.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  try {
    if (SCOPE === 'all' || SCOPE === 'tape') await auditTape(context);
    if (SCOPE === 'all' || SCOPE === 'center') await auditCenter(context);
    if (SCOPE === 'all' || SCOPE === 'exchange') await auditExchange(context);
    check('No browser, page or local request errors', errors.length === 0, errors);
  } finally {
    await context.close().catch(() => {});
    await Promise.race([browser.close().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 5000))]);
  }

  process.stdout.write(`\nNEIGHBOR BROWSER ${passed === total ? 'PASS' : 'FAIL'} | ${passed}/${total} checks\n`);
  process.exit(passed === total ? 0 : 1);
})().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
