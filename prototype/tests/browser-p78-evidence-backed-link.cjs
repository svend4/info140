'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadPlaywright() {
  try { return require('playwright'); }
  catch (_) {
    const root = path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'runtimes', 'cua_node');
    if (!fs.existsSync(root)) throw new Error('Playwright is unavailable.');
    for (const version of fs.readdirSync(root).sort().reverse()) {
      const candidate = path.join(root, version, 'bin', 'node_modules', 'playwright');
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw new Error('Playwright was not found in the Codex runtime.');
  }
}

const { chromium } = loadPlaywright();
const URL = process.env.P78_BROWSER_URL || 'http://localhost/01/games/02/prototype/p78-living-ring-interface.html';
const OUTPUT = process.env.P78_BROWSER_OUTPUT || path.join(process.env.TEMP || 'C:/tmp', 'p78-evidence-backed-link.png');
const errors = [];
let passed = 0;
let total = 0;

function check(name, ok, detail) {
  total += 1;
  if (ok) passed += 1;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${JSON.stringify(detail == null ? '' : detail)}\n`);
}
function watch(page) {
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`page: ${String(error)}`));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    errors.push(`request: ${request.url()} :: ${failure ? failure.errorText : 'unknown'}`);
  });
}
async function canvasHash(page) {
  return page.locator('#world').evaluate((canvas) => {
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
async function panelSnapshot(page) {
  return page.locator('#evidenceBackedLinkView').evaluate((node) => ({
    status: node.dataset.status,
    validationScope: node.dataset.validationScope,
    replay: node.dataset.referentialReplay,
    sourceAuthority: node.dataset.sourceAuthority,
    relationStatus: node.dataset.relationStatus,
    reviewStatus: node.dataset.reviewStatus,
    finalRelation: node.dataset.finalRelation,
    commitAllowed: node.dataset.commitAllowed,
    proposals: node.dataset.proposalCount,
    rejections: node.dataset.rejectionCount,
    skipped: node.dataset.skippedCount,
    text: node.textContent,
    buttons: node.querySelectorAll('button,a,input,select,textarea').length,
    rect: (() => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width, height: rect.height }; })(),
  }));
}
async function overflow(page) {
  return page.evaluate(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('#evidenceBackedLinkView, #evidenceBackedLinkView *')]
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > innerWidth + 1 || rect.left < -1 || rect.width > innerWidth + 1)
      .slice(0, 12)
      .map(({ node, rect }) => ({ tag: node.tagName, className: node.className, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) })),
  }));
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  watch(page);
  try {
    const response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    check('localhost responds with HTTP 200', response && response.status() === 200, response && response.status());
    await page.waitForSelector('#continuationProtocol[data-flow-state]', { timeout: 30000 });
    const originalInput = await page.locator('#controlledClaimInput').inputValue();
    const before = await canvasHash(page);
    await page.evaluate(() => {
      const probe = { active: true, frames: 0, last: performance.now(), maxGap: 0 };
      globalThis.__p78EvidenceFrameProbe = probe;
      requestAnimationFrame(function tick(now) {
        probe.maxGap = Math.max(probe.maxGap, now - probe.last);
        probe.last = now;
        probe.frames += 1;
        if (probe.active) requestAnimationFrame(tick);
      });
    });
    const projectionStarted = Date.now();
    await page.locator('.dockMode [data-mode="analysis"]').click();
    await page.waitForFunction(() => document.querySelector('#evidenceBackedLinkView')?.dataset.proposalCount === '1', null, { timeout: 30000 });
    const projectionMs = Date.now() - projectionStarted;
    await page.waitForTimeout(120);
    const frameProbe = await page.evaluate(() => { globalThis.__p78EvidenceFrameProbe.active = false; return { ...globalThis.__p78EvidenceFrameProbe }; });
    const standard = await panelSnapshot(page);
    check('standard claim creates one replayed proposal', standard.status === 'REPLAYED' && standard.proposals === '1', standard);
    check('projection keeps the UI-frame pause bounded', projectionMs < 15000 && frameProbe.maxGap < 1200 && frameProbe.maxGap < projectionMs * 0.4 && frameProbe.frames > 10, { projectionMs, frameProbe });
    check('desktop evidence panel stays density-bounded', standard.rect.height < 1500, standard.rect);
    check('proposal is exact REFUTES passage-to-target', standard.text.includes('REFUTES') && standard.text.includes('PASSAGE -> TARGET') && standard.text.includes('Система не сохраняет состояние.'), standard.text.slice(0, 500));
    check('self-link rejection and five skipped candidates remain visible', standard.rejections === '1' && standard.skipped === '5' && standard.text.includes('SELF_LINK_FORBIDDEN'), standard);
    check('replay and authority boundaries are separate', standard.replay === 'PERFORMED' && standard.sourceAuthority === 'UNVERIFIED' && standard.relationStatus === 'PROPOSED' && standard.reviewStatus === 'REQUIRES_REVIEW' && standard.finalRelation === 'NOT_COMPUTED' && standard.commitAllowed === 'false', standard);
    check('passive panel exposes no controls', standard.buttons === 0, standard.buttons);
    check('claim input is unchanged by projection', await page.locator('#controlledClaimInput').inputValue() === originalInput, await page.locator('#controlledClaimInput').inputValue());
    await page.waitForTimeout(350);
    const after = await canvasHash(page);
    check('canvas remains nonblank and moving after replay', before && after && before.visible > 100 && after.visible > 100 && before.hash !== after.hash, { before, after });
    await page.screenshot({ path: OUTPUT, fullPage: true });
    check('desktop screenshot is nonblank-sized', fs.existsSync(OUTPUT) && fs.statSync(OUTPUT).size > 50000, fs.existsSync(OUTPUT) ? fs.statSync(OUTPUT).size : 0);

    await page.locator('#controlledClaimInput').fill('Система вычисляет неизвестное состояние.');
    await page.locator('#controlledClaimRun').click();
    await page.waitForFunction(() => document.querySelector('#evidenceBackedLinkView')?.dataset.status === 'ABSTAIN', null, { timeout: 30000 });
    const abstain = await panelSnapshot(page);
    check('unknown target clears the old proposal and abstains', abstain.status === 'ABSTAIN' && abstain.proposals === '0' && !abstain.text.includes('PASSAGE -> TARGET') && !abstain.text.includes('Система не сохраняет состояние.'), abstain);

    await page.locator('#controlledClaimInput').fill(originalInput);
    await page.locator('#controlledClaimRun').click();
    await page.waitForFunction(() => document.querySelector('#evidenceBackedLinkView')?.dataset.proposalCount === '1', null, { timeout: 30000 });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await overflow(page);
    check('mobile evidence panel has no horizontal overflow', mobile.documentWidth <= mobile.viewport && mobile.offenders.length === 0, mobile);
    check('no console, page or local request errors', errors.length === 0, errors);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await Promise.race([browser.close().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 5000))]);
  }
  process.stdout.write(`\nEVIDENCE LINK BROWSER ${passed === total ? 'PASS' : 'FAIL'} | ${passed}/${total} checks | ${OUTPUT}\n`);
  process.exit(passed === total ? 0 : 1);
})().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
