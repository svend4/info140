'use strict';

const path = require('node:path');
const fixture = require('./p78-fixture.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);

global.window = global;
require(lib('semantic-language'));
require(lib('semantic-core'));
require(lib('semantic-data-evidence'));
require(lib('semantic-branch-evaluator'));

const core = global.MRDSemanticCore;
const evidence = global.MRDSemanticDataEvidence;
const branchEvaluator = global.MRDSemanticBranchEvaluator;

const CITY = '\u0433\u043e\u0440\u043e\u0434';
const CITY_FORM = '\u0433\u043e\u0440\u043e\u0434\u0430';
const BRIDGE = '\u043c\u043e\u0441\u0442';
const BRIDGE_FORM = '\u043c\u043e\u0441\u0442\u043e\u043c';
const RIVER = '\u0440\u0435\u043a\u0430';
const RIVER_FORM = '\u0440\u0435\u043a\u0443';
const MEANING = '\u0441\u043c\u044b\u0441\u043b';
const WORD = '\u0441\u043b\u043e\u0432\u043e';

const CALIBRATION = {
  calibrated: { tG: 0.42, tN: 0.58 },
};
const ADAPTIVE_K3 = {
  true_best: 'K=3',
  bandit_best: 'K=3',
  match: true,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function approx(actual, expected, label, epsilon = 1e-12) {
  assert(
    typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, got ${String(actual)}`,
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function vectorFixture(reverse = false) {
  const entries = [
    [CITY, { place: 1, motion: 0.1 }],
    [BRIDGE, { place: 0.8, motion: 0.7 }],
    [RIVER, { place: 0.2, motion: 0.9, nature: 1 }],
    [MEANING, { thought: 1, language: 0.5 }],
    [WORD, { thought: 0.85, language: 1 }],
  ];
  if (reverse) entries.reverse();
  return {
    provider: 'regression-local-fixture',
    generated: '2026-07-19T00:00:00Z',
    words: Object.fromEntries(entries),
  };
}

function installReady(reverse = false) {
  return evidence.install({
    vectors: vectorFixture(reverse),
    phiCalibration: clone(CALIBRATION),
    adaptiveK: clone(ADAPTIVE_K3),
  });
}

function jsonResponse(value) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(clone(value)),
  };
}

const checks = [];
async function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: (await run()) || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error && error.message ? error.message : String(error) });
  }
}

async function main() {
  await check('API_EXPORTS_AND_RESET', () => {
    assert(core && typeof core === 'object', 'MRDSemanticCore is missing');
    assert(evidence && typeof evidence === 'object', 'MRDSemanticDataEvidence is missing');
    ['install', 'reset', 'snapshot', 'assess', 'load'].forEach((name) => {
      assert(typeof evidence[name] === 'function', `MRDSemanticDataEvidence.${name} is missing`);
    });

    const reset = evidence.reset();
    assert(reset.status === 'UNAVAILABLE', `reset status=${reset.status}`);
    assert(reset.soundness === 'NOT_COMPUTED', `reset soundness=${reset.soundness}`);

    const copy = evidence.snapshot();
    copy.assets.vectors = true;
    assert(evidence.snapshot().assets.vectors === false, 'snapshot leaked mutable state');
    return `core ${core.version}; evidence ${evidence.version}`;
  });

  await check('VALID_INSTALL_READY', () => {
    const state = installReady();
    assert(state.kind === 'MRDSemanticDataEvidenceSnapshot', `kind=${state.kind}`);
    assert(state.status === 'READY', `status=${state.status}`);
    assert(state.vectorCount === 5, `vectorCount=${state.vectorCount}`);
    assert(Object.values(state.assets).every(Boolean), 'one or more assets are not ready');
    approx(state.thresholds.growth, CALIBRATION.calibrated.tG, 'thresholds.growth');
    approx(state.thresholds.novelty, CALIBRATION.calibrated.tN, 'thresholds.novelty');
    assert(state.errors.length === 0, `unexpected errors=${state.errors.length}`);
    return `READY; vectors=${state.vectorCount}`;
  });

  await check('VECTORS_ONLY_IS_PARTIAL', () => {
    const state = evidence.install({ vectors: vectorFixture() });
    assert(state.status === 'PARTIAL', `status=${state.status}`);
    assert(state.assets.vectors === true, 'vectors were not retained');
    assert(state.assets.phiCalibration === false, 'missing calibration was marked present');
    assert(state.assets.adaptiveK === false, 'missing adaptive K was marked present');
    assert(state.thresholds.growth === null && state.thresholds.novelty === null, 'missing thresholds were synthesized');
    assert(state.errors.some((item) => item.asset === 'phiCalibration'), 'calibration error is missing');
    assert(state.errors.some((item) => item.asset === 'adaptiveK'), 'adaptive K error is missing');
    return 'PARTIAL without optional calibration/adaptive assets';
  });

  await check('BAD_VECTORS_INVALID_OR_UNAVAILABLE', () => {
    const invalid = evidence.install({
      vectors: { provider: 'broken', words: { [CITY]: {}, [BRIDGE]: { place: 'not-a-number' } } },
      phiCalibration: clone(CALIBRATION),
      adaptiveK: clone(ADAPTIVE_K3),
    });
    assert(invalid.status === 'INVALID', `bad vectors status=${invalid.status}`);
    assert(invalid.assets.vectors === false && invalid.vectorCount === 0, 'invalid vectors became available');
    assert(invalid.errors.some((item) => item.asset === 'vectors'), 'invalid vectors error is missing');
    assert(evidence.assess(CITY, BRIDGE, RIVER).code === 'DATA_UNAVAILABLE', 'invalid vectors remained assessable');

    const unavailable = evidence.install({
      phiCalibration: clone(CALIBRATION),
      adaptiveK: clone(ADAPTIVE_K3),
    });
    assert(unavailable.status === 'UNAVAILABLE', `missing vectors status=${unavailable.status}`);
    assert(unavailable.assets.vectors === false, 'missing vectors became available');
    return 'malformed=INVALID; missing=UNAVAILABLE';
  });

  await check('CORE_LEMMATIZATION', () => {
    installReady();
    assert(core.lookup(CITY_FORM).lemma === CITY, 'semantic core city fixture no longer lemmatizes');
    assert(core.lookup(BRIDGE_FORM).lemma === BRIDGE, 'semantic core bridge fixture no longer lemmatizes');
    assert(core.lookup(RIVER_FORM).lemma === RIVER, 'semantic core river fixture no longer lemmatizes');

    const result = evidence.assess(`${CITY_FORM}!`, BRIDGE_FORM, RIVER_FORM);
    assert(result.status === 'READY', `assessment status=${result.status}`);
    assert(result.sourceAnchors.join(',') === CITY, `source anchors=${result.sourceAnchors.join(',')}`);
    assert(result.candidateAnchors.join(',') === BRIDGE, `candidate anchors=${result.candidateAnchors.join(',')}`);
    assert(result.targetAnchors.join(',') === RIVER, `target anchors=${result.targetAnchors.join(',')}`);
    approx(result.sourceCoverage, 1, 'sourceCoverage');
    approx(result.candidateCoverage, 1, 'candidateCoverage');
    approx(result.targetCoverage, 1, 'targetCoverage');
    return `${CITY_FORM}->${CITY}; ${BRIDGE_FORM}->${BRIDGE}; ${RIVER_FORM}->${RIVER}`;
  });

  await check('DETERMINISTIC_SCORE_AND_HASH', () => {
    installReady();
    const assess = () => evidence.assess(`${CITY_FORM} ${BRIDGE}`, `${BRIDGE_FORM} ${RIVER_FORM}`, `${RIVER} ${CITY}`);
    const first = assess();
    const second = assess();
    assert(first.status === 'READY' && second.status === 'READY', 'fixture assessment is not ready');
    assert(first.score === second.score, `score drifted: ${first.score} != ${second.score}`);
    assert(first.relationHash === second.relationHash, 'relation hash drifted between identical calls');
    assert(/^[0-9a-f]{8}$/.test(first.relationHash), `relationHash=${first.relationHash}`);

    const assetHash = evidence.snapshot().provenance.hash;
    installReady(true);
    const reordered = assess();
    assert(evidence.snapshot().provenance.hash === assetHash, 'asset hash depends on object insertion order');
    assert(reordered.score === first.score, 'score depends on vector insertion order');
    assert(reordered.relationHash === first.relationHash, 'relation hash depends on vector insertion order');
    return `score=${first.score.toFixed(6)}; hash=${first.relationHash}`;
  });

  await check('ABSTAIN_WITHOUT_COVERED_ANCHORS', () => {
    installReady();
    const result = evidence.assess('oov-source-token', 'oov-candidate-token', RIVER_FORM);
    assert(result.status === 'ABSTAIN', `status=${result.status}`);
    assert(result.code === 'DATA_COVERAGE', `code=${result.code}`);
    assert(result.sourceAnchors.length === 0 && result.candidateAnchors.length === 0, 'uncovered anchors were invented');
    assert(result.score === 0 && result.relationHash === null, 'abstention exposed a scored relation');
    assert(result.retrieval.length === 0, 'abstention exposed retrieval evidence');
    return result.code;
  });

  await check('AGREED_TOP_K_AND_BOUNDED_WEIGHT', () => {
    const state = installReady();
    const result = evidence.assess(CITY_FORM, BRIDGE_FORM, RIVER_FORM);
    assert(state.topK === 3 && result.topK === 3, `topK=${state.topK}/${result.topK}`);
    assert(result.retrieval.length === 3, `retrieval length=${result.retrieval.length}`);
    assert(new Set(result.retrieval.map((item) => item.word)).size === 3, 'topK contains duplicate words');
    approx(evidence.constants.boundedWeight, 0.05, 'constants.boundedWeight');
    approx(state.boundedWeight, 0.05, 'snapshot.boundedWeight');
    approx(result.boundedWeight, 0.05, 'assessment.boundedWeight');
    approx(result.rankingDelta, 0.05 * (result.score - 0.5), 'rankingDelta');
    assert(Math.abs(result.rankingDelta) <= 0.025 + 1e-12, `rankingDelta=${result.rankingDelta}`);
    return `K=${result.topK}; weight=${result.boundedWeight}`;
  });

  await check('BRANCH_RANKING_IS_BOUNDED_AND_OPTIONAL', () => {
    installReady();
    const source = [CITY, BRIDGE, RIVER, MEANING, WORD].join(' ');
    const ranked = branchEvaluator.build(source, '');
    const supported = ranked.branches.filter((item) => item.data && item.data.status === 'READY');
    assert(ranked.dataSnapshot && ranked.dataSnapshot.status === 'READY', 'branch pack lost the data snapshot');
    assert(supported.length > 0, 'no branch received local corpus evidence');
    supported.forEach((item) => {
      approx(item.score, 0.95 * item.structuralScore + 0.05 * item.dataScore, 'bounded score ' + item.id);
      approx(item.rankingDelta, item.score - item.structuralScore, 'ranking delta ' + item.id);
      assert(Math.abs(item.rankingDelta) <= 0.05 + 1e-12, 'unbounded delta ' + item.id + '=' + item.rankingDelta);
    });
    assert(supported.some((item) => Math.abs(item.rankingDelta) > 1e-12), 'corpus evidence did not affect ranking');

    evidence.reset();
    const fallback = branchEvaluator.build(source, '');
    fallback.branches.forEach((item) => {
      approx(item.score, item.structuralScore, 'fallback score ' + item.id);
      assert(!item.data || item.data.status === 'ABSTAIN', 'fallback data status ' + item.id);
    });
    return supported.length + ' supported branch(es); max weight 5%';
  });

  await check('P78_LOADS_LOCAL_ASSETS_WITH_VISIBLE_STATUS', () => {
    const { html, runtime } = fixture;
    const languageIndex = html.indexOf('lib/semantic-language.js?v=1.0.0');
    const coreIndex = html.indexOf('lib/semantic-core.js?v=1.10.0');
    const dataIndex = html.indexOf('lib/semantic-data-evidence.js?v=1.0.0');
    const branchIndex = html.indexOf('lib/semantic-branch-evaluator.js?v=1.1.0');
    assert(languageIndex >= 0 && languageIndex < coreIndex && coreIndex < dataIndex && dataIndex < branchIndex, 'data evidence dependency order is wrong');
    ['function initializeSemanticDataEvidence()', "vectors:'data/vectors.json'", "phiCalibration:'data/phi_calibration.json'", "adaptiveK:'data/adaptive_k.json'", 'canvas.dataset.dataStatus', 'initializeSemanticDataEvidence();'].forEach((needle) => {
      assert(runtime.includes(needle), 'p78 data integration missing: ' + needle);
    });
    return 'three local assets; canvas status; async refresh';
  });
  await check('LOAD_SUCCESS_WITH_FIXTURE_FETCH', async () => {
    const urls = {
      vectors: 'fixture://vectors',
      phiCalibration: 'fixture://phi-calibration',
      adaptiveK: 'fixture://adaptive-k',
    };
    const payloads = {
      [urls.vectors]: vectorFixture(),
      [urls.phiCalibration]: CALIBRATION,
      [urls.adaptiveK]: ADAPTIVE_K3,
    };
    const calls = [];
    const fetch = (url, options) => {
      calls.push({ url, options });
      assert(payloads[url], `unexpected URL ${url}`);
      return Promise.resolve(jsonResponse(payloads[url]));
    };

    const state = await evidence.load(urls, { fetch });
    assert(state.status === 'READY', `load status=${state.status}`);
    assert(calls.length === 3, `fetch calls=${calls.length}`);
    assert(new Set(calls.map((item) => item.url)).size === 3, 'load did not fetch each asset once');
    assert(calls.every((item) => item.options && item.options.cache === 'no-store'), 'load cache policy changed');
    assert(state.vectorCount === 5 && state.topK === 3, 'loaded fixtures were not installed');
    return `READY from ${calls.length} local fetch responses`;
  });

  await check('LOAD_PARTIAL_ERROR', async () => {
    const urls = {
      vectors: 'fixture://partial-vectors',
      phiCalibration: 'fixture://partial-phi-error',
      adaptiveK: 'fixture://partial-adaptive-k',
    };
    const fetch = (url) => {
      if (url === urls.vectors) return Promise.resolve(jsonResponse(vectorFixture()));
      if (url === urls.adaptiveK) return Promise.resolve(jsonResponse(ADAPTIVE_K3));
      return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
    };

    const state = await evidence.load(urls, { fetch });
    assert(state.status === 'PARTIAL', `partial load status=${state.status}`);
    assert(state.assets.vectors === true && state.assets.adaptiveK === true, 'successful assets were discarded');
    assert(state.assets.phiCalibration === false, 'failed calibration became available');
    assert(state.errors.some((item) => item.code === 'DATA_FETCH_HTTP' && item.asset === 'phiCalibration'), 'fetch error provenance is missing');
    assert(evidence.snapshot().status === 'PARTIAL', 'partial load was not committed to state');
    return 'HTTP failure isolated to phiCalibration';
  });

  await check('SOUNDNESS_AND_LOCAL_PROVENANCE', () => {
    const state = installReady();
    const result = evidence.assess(CITY_FORM, BRIDGE_FORM, RIVER_FORM);
    [state, result].forEach((value) => {
      assert(value.soundness === 'NOT_COMPUTED', `soundness=${value.soundness}`);
      assert(value.evidenceLevel === 'LOCAL_CORPUS', `evidenceLevel=${value.evidenceLevel}`);
      assert(value.provenance.scope === 'local-mini-corpus', `scope=${value.provenance.scope}`);
      assert(value.provenance.provider === 'regression-local-fixture', `provider=${value.provenance.provider}`);
      assert(value.provenance.generated === '2026-07-19T00:00:00Z', `generated=${value.provenance.generated}`);
      assert(/^[0-9a-f]{8}$/.test(value.provenance.hash), `provenance hash=${value.provenance.hash}`);
    });
    assert(result.provenance.hash === state.provenance.hash, 'assessment lost snapshot provenance');
    return `soundness=${result.soundness}; scope=${result.provenance.scope}`;
  });

  checks.forEach((result) => {
    console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
  });
  const failures = checks.filter((result) => !result.ok).length;
  console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
