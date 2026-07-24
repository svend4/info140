'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Fixture = require('./fixtures/p78-claim-cascade-benchmark-fixtures.cjs');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts', 'p78-local-text-index',
  'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
  'p78-claim-structural-matcher', 'p78-evidence-contracts', 'p78-claim-evidence-corpus',
  'p78-linguistic-structure-index',
].forEach((name) => require(lib(name)));

const Corpus = global.MRDP78ClaimEvidenceCorpus;
const Parser = global.MRDP78LinguisticParserAdapter;
const Linguistic = global.MRDP78LinguisticStructureIndex;
const index = Linguistic.create(Corpus.records);
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

function sorted(values) {
  return Array.from(values).sort((left, right) => left.localeCompare(right, 'en'));
}

function passageKey(passage) {
  return `${passage.sourceRef.sourceId}#${passage.locator.sentenceIndex}`;
}

const passageById = new Map(index.passages.map((passage) => [passage.passageId, passage]));
const passageByLocation = new Map(index.passages.map((passage) => [
  `${passage.sourceRef.sourceId}:${passage.locator.start}:${passage.locator.end}`,
  passage,
]));
const passageByKey = new Map(index.passages.map((passage) => [passageKey(passage), passage]));

function passageClaimKey(record) {
  const passage = passageById.get(record.passageRef.passageId);
  assert(passage, `missing passage for ${record.passageClaimId}`);
  return passageKey(passage);
}

function candidateKey(candidate) {
  const key = `${candidate.sourceRef.sourceId}:${candidate.locator.start}:${candidate.locator.end}`;
  const passage = passageByLocation.get(key);
  assert(passage, `missing candidate passage for ${candidate.candidateId}`);
  return passageKey(passage);
}

function difference(left, right) {
  return sorted(Array.from(left).filter((value) => !right.has(value)));
}

function score(retrieved, relevant) {
  const truePositives = new Set(Array.from(retrieved).filter((key) => relevant.has(key)));
  const falsePositives = difference(retrieved, relevant);
  const falseNegatives = difference(relevant, retrieved);
  return {
    retrieved: retrieved.size,
    relevant: relevant.size,
    truePositive: truePositives.size,
    falsePositive: falsePositives.length,
    falseNegative: falseNegatives.length,
    precision: retrieved.size ? truePositives.size / retrieved.size : 0,
    recall: relevant.size ? truePositives.size / relevant.size : 1,
    falsePositiveKeys: falsePositives,
    falseNegativeKeys: falseNegatives,
  };
}

function runTarget(target) {
  const parsed = Parser.parse(target.text);
  assert.equal(parsed.resolutionStatus, target.expectedResolution, `${target.id}: target resolution`);
  const result = Linguistic.findCandidates(index, parsed, {
    expectedSourceSetHash: Fixture.pins.sourceSetHash,
    expectedLinguisticIndexHash: index.linguisticIndexHash,
  });
  assert.equal(result.status, 'READY', `${target.id}: cascade status`);
  assert.equal(result.finalStatus, 'ABSTAIN', `${target.id}: final boundary`);
  assert.equal(result.finalRelation, 'NOT_COMPUTED', `${target.id}: final relation`);
  assert.equal(result.reviewStatus, 'REQUIRES_REVIEW', `${target.id}: review boundary`);
  assert.equal(result.semanticTruth, false, `${target.id}: semantic truth boundary`);

  const lexical = new Set(result.passageClaims.map(passageClaimKey));
  const structural = new Set(result.evidenceCandidates
    .filter((candidate) => candidate.proposedRelation !== 'MENTIONS')
    .map(candidateKey));
  const relevant = new Set(target.goldRelevantPassages);
  const relationByKey = new Map(result.evidenceCandidates.map((candidate) => [
    candidateKey(candidate),
    candidate.proposedRelation,
  ]));
  const resolutionByKey = new Map(result.passageClaims.map((record) => [
    passageClaimKey(record),
    record.resolutionStatus,
  ]));

  Object.entries(target.expectedRelations).forEach(([relation, keys]) => {
    keys.forEach((key) => assert.equal(relationByKey.get(key), relation, `${target.id}: ${key}`));
  });
  Object.entries(target.expectedUnresolvedCandidates).forEach(([resolution, keys]) => {
    keys.forEach((key) => {
      assert.equal(resolutionByKey.get(key), resolution, `${target.id}: unresolved ${key}`);
      assert(!relationByKey.has(key), `${target.id}: unresolved ${key} became EvidenceCandidate`);
    });
  });

  return {
    id: target.id,
    resultHash: result.resultHash,
    lexical: score(lexical, relevant),
    structural: score(structural, relevant),
  };
}

function aggregate(cases, stage) {
  const totals = cases.reduce((sum, item) => {
    const value = item[stage];
    sum.retrieved += value.retrieved;
    sum.relevant += value.relevant;
    sum.truePositive += value.truePositive;
    sum.falsePositive += value.falsePositive;
    sum.falseNegative += value.falseNegative;
    return sum;
  }, { retrieved: 0, relevant: 0, truePositive: 0, falsePositive: 0, falseNegative: 0 });
  totals.precision = totals.retrieved ? totals.truePositive / totals.retrieved : 0;
  totals.recall = totals.relevant ? totals.truePositive / totals.relevant : 1;
  return totals;
}

function evaluateBenchmark() {
  const cases = Fixture.retrievalTargets.map(runTarget);
  return {
    cases,
    lexical: aggregate(cases, 'lexical'),
    structural: aggregate(cases, 'structural'),
  };
}

check('fixture is test-only, immutable and contains eight measured plus two guard targets', () => {
  assert.equal(Fixture.schema, 'meridian.claim-cascade-benchmark-fixtures/1');
  assert(Object.isFrozen(Fixture) && Object.isFrozen(Fixture.retrievalTargets));
  assert(Fixture.retrievalTargets.length >= 8);
  assert.equal(Fixture.retrievalTargets.length, Fixture.expectedAggregate.evaluatedTargetCount);
  assert.equal(Fixture.guardTargets.length, Fixture.expectedAggregate.guardTargetCount);
});

check('fixture covers support, refute, mention, OOV and ambiguity', () => {
  const relations = new Set();
  const unresolved = new Set(Fixture.guardTargets.map((target) => target.expectedResolution));
  let contrastPairs = 0;
  Fixture.retrievalTargets.forEach((target) => {
    Object.entries(target.expectedRelations).forEach(([relation, keys]) => {
      if (keys.length) relations.add(relation);
    });
    Object.entries(target.expectedUnresolvedCandidates).forEach(([status, keys]) => {
      if (keys.length) unresolved.add(status);
    });
    if (target.expectedRelations.SUPPORTS.length && target.expectedRelations.REFUTES.length) contrastPairs += 1;
  });
  assert.deepEqual(sorted(relations), ['MENTIONS', 'REFUTES', 'SUPPORTS']);
  assert.deepEqual(sorted(unresolved), ['AMBIGUOUS', 'OOV']);
  assert(contrastPairs >= 4, `only ${contrastPairs} support/refute contrast targets`);
});

check('production corpus and index exactly match the frozen benchmark pins', () => {
  assert.equal(Corpus.corpusHash, Fixture.pins.corpusHash);
  assert.equal(Corpus.sourceSetHash, Fixture.pins.sourceSetHash);
  assert.equal(index.sourceSetHash, Fixture.pins.sourceSetHash);
  assert.equal(Corpus.records.length, Fixture.pins.sourceCount);
  assert.equal(index.passages.length, Fixture.pins.passageCount);
  Fixture.retrievalTargets.forEach((target) => target.goldRelevantPassages.forEach((key) => {
    assert(passageByKey.has(key), `gold passage is absent: ${key}`);
  }));
});

check('gold annotations are absent from production corpus and browser entrypoint', () => {
  const corpusSource = fs.readFileSync(lib('p78-claim-evidence-corpus'), 'utf8');
  const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'p78-living-ring-interface.html'), 'utf8');
  assert(!corpusSource.includes('goldRelevantPassages'));
  assert(!corpusSource.includes('p78-claim-cascade-benchmark-fixtures'));
  assert(!htmlSource.includes('p78-claim-cascade-benchmark-fixtures'));
  assert(!htmlSource.includes('semantic-p78-claim-cascade-benchmark-regression'));
});

let benchmark;
check('all measured targets satisfy their independent relation and resolution annotations', () => {
  benchmark = evaluateBenchmark();
  assert.equal(benchmark.cases.length, Fixture.expectedAggregate.evaluatedTargetCount);
});

check('OOV and ambiguous target guards fail closed before passage retrieval', () => {
  Fixture.guardTargets.forEach((target) => {
    const parsed = Parser.parse(target.text);
    assert.equal(parsed.resolutionStatus, target.expectedResolution, target.id);
    const result = Linguistic.findCandidates(index, parsed, {
      expectedSourceSetHash: Fixture.pins.sourceSetHash,
      expectedLinguisticIndexHash: index.linguisticIndexHash,
    });
    assert.equal(result.status, 'ABSTAIN', target.id);
    assert.equal(result.code, target.expectedCascadeCode, target.id);
    assert.equal(result.passageClaims.length, 0, target.id);
    assert.equal(result.evidenceCandidates.length, 0, target.id);
    assert.equal(result.finalRelation, 'NOT_COMPUTED', target.id);
  });
});

check('micro aggregates are content-addressed regression values', () => {
  assert(benchmark, 'benchmark did not run');
  const expected = Fixture.expectedAggregate;
  assert.equal(benchmark.lexical.relevant, expected.goldRelevantCount);
  assert.deepEqual({
    retrieved: benchmark.lexical.retrieved,
    truePositive: benchmark.lexical.truePositive,
    falsePositive: benchmark.lexical.falsePositive,
    falseNegative: benchmark.lexical.falseNegative,
  }, expected.lexical);
  assert.deepEqual({
    retrieved: benchmark.structural.retrieved,
    truePositive: benchmark.structural.truePositive,
    falsePositive: benchmark.structural.falsePositive,
    falseNegative: benchmark.structural.falseNegative,
  }, expected.structural);
});

check('structural non-MENTIONS strictly improves precision without reducing recall', () => {
  assert(benchmark.structural.precision > benchmark.lexical.precision,
    `${benchmark.structural.precision} <= ${benchmark.lexical.precision}`);
  assert(benchmark.structural.recall >= benchmark.lexical.recall,
    `${benchmark.structural.recall} < ${benchmark.lexical.recall}`);
});

check('fresh replay reproduces every case, aggregate and result hash', () => {
  const replay = evaluateBenchmark();
  assert.deepEqual(replay, benchmark);
});

function decimal(value) {
  return value.toFixed(6);
}

if (benchmark) {
  console.log(`BENCHMARK | corpus=${Fixture.pins.corpusHash} | sources=${Fixture.pins.sourceSetHash}`);
  benchmark.cases.forEach((item) => {
    console.log([
      `CASE | ${item.id}`,
      `lexical TP=${item.lexical.truePositive} FP=${item.lexical.falsePositive} FN=${item.lexical.falseNegative}`,
      `P=${decimal(item.lexical.precision)} R=${decimal(item.lexical.recall)}`,
      `lexFP=[${item.lexical.falsePositiveKeys.join(',')}] lexFN=[${item.lexical.falseNegativeKeys.join(',')}]`,
      `structural TP=${item.structural.truePositive} FP=${item.structural.falsePositive} FN=${item.structural.falseNegative}`,
      `P=${decimal(item.structural.precision)} R=${decimal(item.structural.recall)}`,
      `structFP=[${item.structural.falsePositiveKeys.join(',')}] structFN=[${item.structural.falseNegativeKeys.join(',')}]`,
    ].join(' | '));
  });
  console.log([
    `AGGREGATE | measured=${Fixture.retrievalTargets.length} guards=${Fixture.guardTargets.length}`,
    `gold=${benchmark.lexical.relevant}`,
    `lexical retrieved=${benchmark.lexical.retrieved} TP=${benchmark.lexical.truePositive}`,
    `FP=${benchmark.lexical.falsePositive} FN=${benchmark.lexical.falseNegative}`,
    `P=${decimal(benchmark.lexical.precision)} R=${decimal(benchmark.lexical.recall)}`,
    `structural retrieved=${benchmark.structural.retrieved} TP=${benchmark.structural.truePositive}`,
    `FP=${benchmark.structural.falsePositive} FN=${benchmark.structural.falseNegative}`,
    `P=${decimal(benchmark.structural.precision)} R=${decimal(benchmark.structural.recall)}`,
  ].join(' | '));
}

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
