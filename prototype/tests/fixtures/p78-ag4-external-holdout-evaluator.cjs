'use strict';

const VERSION = '1.0.0';
const RELATIONS = ['SUPPORTS', 'REFUTES', 'QUALIFIES'];
const PREDICTIONS = ['SUPPORTS', 'REFUTES', 'QUALIFIES', 'MENTIONS', 'MISSING'];

function dependencies() {
  const required = {
    Canonical: global.MRDP78CanonicalJSON,
    Contracts: global.MRDP78SearchContracts,
    Parser: global.MRDP78LinguisticParserAdapter,
    Linguistic: global.MRDP78LinguisticStructureIndex,
  };
  Object.entries(required).forEach(([name, value]) => {
    if (!value) throw new Error(`holdout evaluator dependency missing: ${name}`);
  });
  return required;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return Object.freeze(value);
}

function sorted(values) {
  return Array.from(values).sort((left, right) => left.localeCompare(right, 'en'));
}

function ratio(numerator, denominator, emptyValue = null) {
  return { numerator, denominator, value: denominator ? numerator / denominator : emptyValue };
}

function passageKey(value) {
  return `${value.sourceRef.sourceId}#${value.locator.sentenceIndex}`;
}

function goldPassageKey(value) {
  return `${value.sourceId}#${value.sentenceIndex}`;
}

function buildSnapshots(inputs) {
  const { Contracts } = dependencies();
  return inputs.sources.map((source) => Contracts.createSourceSnapshot({
    sourceId: source.sourceId,
    revision: source.revision,
    language: source.language,
    text: source.text,
  }));
}

function annotationPayload(gold) {
  return {
    schema: gold.schema,
    datasetId: gold.datasetId,
    version: gold.version,
    status: gold.status,
    annotationPolicy: gold.annotationPolicy,
    thresholds: gold.thresholds,
    cases: gold.cases,
  };
}

function computeFixtureHashes(inputs, gold) {
  const { Canonical, Contracts } = dependencies();
  const snapshots = buildSnapshots(inputs);
  const inputHash = Canonical.hashCanonical(inputs);
  const annotationsHash = Canonical.hashCanonical(annotationPayload(gold));
  const sourceSetHash = Contracts.computeSourceSetHash(snapshots);
  const holdoutHash = Canonical.hashCanonical({
    schema: 'meridian.ag4-external-holdout-seal/1',
    datasetId: inputs.datasetId,
    inputHash,
    annotationsHash,
    sourceSetHash,
    developmentCorpusHash: gold.pins.developmentCorpusHash,
    developmentSourceSetHash: gold.pins.developmentSourceSetHash,
  });
  return deepFreeze({ inputHash, annotationsHash, sourceSetHash, holdoutHash });
}

function candidateProvenanceComplete(candidate, index) {
  const provenance = candidate && candidate.provenance;
  const sourceRef = candidate && candidate.sourceRef;
  const locator = candidate && candidate.locator;
  return Boolean(
    candidate && candidate.candidateId && candidate.contentHash && candidate.passageTextHash
    && Array.isArray(candidate.sourceSpanIds) && candidate.sourceSpanIds.length
    && sourceRef && sourceRef.sourceId && sourceRef.revision && sourceRef.sourceHash
    && locator && Number.isInteger(locator.start) && Number.isInteger(locator.end)
    && Number.isInteger(locator.sentenceIndex) && locator.end > locator.start
    && provenance && provenance.sourceSetHash === index.sourceSetHash
    && provenance.lexicalIndexHash === index.lexicalIndexHash
    && provenance.linguisticIndexHash === index.linguisticIndexHash
    && provenance.lexiconHash === index.lexiconHash
    && provenance.parserRef && provenance.parserRef.id && provenance.parserRef.version
    && provenance.alignerVersion
  );
}

function makeConfusion() {
  const matrix = {};
  [...RELATIONS, 'NONE'].forEach((expected) => {
    matrix[expected] = {};
    PREDICTIONS.forEach((predicted) => { matrix[expected][predicted] = 0; });
  });
  return matrix;
}

function evaluateCase(inputCase, goldCase, snapshotsById, options) {
  const { Parser, Linguistic } = dependencies();
  let selected = inputCase.sourceIds.map((sourceId) => {
    const source = snapshotsById.get(sourceId);
    if (!source) throw new Error(`${inputCase.caseId}: unknown source ${sourceId}`);
    return source;
  });
  if (options.reverseSourceOrder) selected = selected.slice().reverse();
  const index = Linguistic.create(selected, { indexId: `p78.holdout.${inputCase.caseId}` });
  const parsed = Parser.parse(inputCase.targetText);
  const result = Linguistic.findCandidates(index, parsed, {
    expectedSourceSetHash: index.sourceSetHash,
    expectedLinguisticIndexHash: index.linguisticIndexHash,
  });
  const locatedPassageKeys = sorted(result.locatedPassages.map(passageKey));
  const passageById = new Map(index.passages.map((passage) => [passage.passageId, passage]));
  const passageClaims = result.passageClaims.map((record) => {
    const passage = passageById.get(record.passageRef.passageId);
    return {
      passageKey: passage ? passageKey(passage) : record.passageRef.passageId,
      resolutionStatus: record.resolutionStatus,
      spanMapStatus: record.spanMapStatus,
      structuralStatus: record.structural.status,
      reasonCodes: record.reasonCodes,
    };
  });
  const candidates = result.evidenceCandidates.map((candidate) => ({
    passageKey: `${candidate.sourceRef.sourceId}#${candidate.locator.sentenceIndex}`,
    relation: candidate.proposedRelation,
    provenanceComplete: candidateProvenanceComplete(candidate, index),
  })).sort((left, right) => {
    const keyOrder = left.passageKey.localeCompare(right.passageKey, 'en');
    return keyOrder || left.relation.localeCompare(right.relation, 'en');
  });
  const expectedPassages = goldCase.passages.map((passage) => ({
    passageKey: goldPassageKey(passage),
    relation: passage.relation,
  })).sort((left, right) => left.passageKey.localeCompare(right.passageKey, 'en'));
  return {
    caseId: inputCase.caseId,
    critical: inputCase.critical,
    targetResolutionExpected: goldCase.targetResolution,
    targetResolutionActual: parsed.resolutionStatus,
    answerability: goldCase.answerability,
    resultStatus: result.status,
    resultCode: result.code,
    finalStatus: result.finalStatus,
    finalRelation: result.finalRelation,
    reviewStatus: result.reviewStatus,
    semanticTruth: result.semanticTruth,
    resultHash: result.resultHash,
    locatedPassageKeys,
    passageClaims,
    expectedPassages,
    candidates,
    expectedGuardCode: goldCase.expectedGuardCode || null,
  };
}

function aggregateCases(cases, gold) {
  const confusion = makeConfusion();
  let expectedResolved = 0;
  let actualResolved = 0;
  let expectedPassageCount = 0;
  let lexicalPassageHits = 0;
  let candidatePassageHits = 0;
  let predictedPassageCount = 0;
  let unexpectedPassageCount = 0;
  let noneCaseCount = 0;
  let noneFalsePositiveCount = 0;
  let guardCount = 0;
  let guardPassCount = 0;
  let candidateCount = 0;
  let completeCandidateCount = 0;
  let authorityViolations = 0;

  cases.forEach((item) => {
    if (item.targetResolutionExpected === 'RESOLVED') {
      expectedResolved += 1;
      if (item.targetResolutionActual === 'RESOLVED') actualResolved += 1;
    }
    const located = new Set(item.locatedPassageKeys);
    const expectedByKey = new Map(item.expectedPassages.map((passage) => [passage.passageKey, passage.relation]));
    const semanticCandidates = item.candidates.filter((candidate) => candidate.relation !== 'MENTIONS');
    const predictedByKey = new Map(item.candidates.map((candidate) => [candidate.passageKey, candidate.relation]));
    expectedPassageCount += item.expectedPassages.length;
    item.expectedPassages.forEach((passage) => {
      if (located.has(passage.passageKey)) lexicalPassageHits += 1;
      if (semanticCandidates.some((candidate) => candidate.passageKey === passage.passageKey)) candidatePassageHits += 1;
      const predicted = predictedByKey.get(passage.passageKey) || 'MISSING';
      confusion[passage.relation][predicted] += 1;
    });
    semanticCandidates.forEach((candidate) => {
      predictedPassageCount += 1;
      if (!expectedByKey.has(candidate.passageKey)) {
        unexpectedPassageCount += 1;
        confusion.NONE[candidate.relation] += 1;
      }
    });
    item.candidates.filter((candidate) => candidate.relation === 'MENTIONS' && !expectedByKey.has(candidate.passageKey))
      .forEach(() => { confusion.NONE.MENTIONS += 1; });
    if (item.answerability === 'NONE') {
      noneCaseCount += 1;
      if (semanticCandidates.length) noneFalsePositiveCount += 1;
    }
    if (item.answerability === 'GUARD') {
      guardCount += 1;
      if (
        item.targetResolutionActual === item.targetResolutionExpected
        && item.resultStatus === 'ABSTAIN'
        && item.resultCode === item.expectedGuardCode
        && item.candidates.length === 0
      ) guardPassCount += 1;
    }
    candidateCount += item.candidates.length;
    completeCandidateCount += item.candidates.filter((candidate) => candidate.provenanceComplete).length;
    if (
      item.finalStatus !== 'ABSTAIN'
      || item.finalRelation !== 'NOT_COMPUTED'
      || item.reviewStatus !== 'REQUIRES_REVIEW'
      || item.semanticTruth !== false
    ) authorityViolations += 1;
  });

  const perRelation = {};
  RELATIONS.forEach((relation) => {
    const truePositive = confusion[relation][relation];
    const predicted = [...RELATIONS, 'NONE'].reduce((sum, expected) => sum + confusion[expected][relation], 0);
    const relevant = PREDICTIONS.reduce((sum, prediction) => sum + confusion[relation][prediction], 0);
    const precision = predicted ? truePositive / predicted : 0;
    const recall = relevant ? truePositive / relevant : 0;
    perRelation[relation] = {
      truePositive,
      predicted,
      relevant,
      precision,
      recall,
      f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    };
  });
  const relationMacroF1 = RELATIONS.reduce((sum, relation) => sum + perRelation[relation].f1, 0) / RELATIONS.length;
  const metrics = {
    evaluatedCaseCount: cases.length,
    answerableCaseCount: gold.cases.filter((item) => item.answerability === 'ANSWERABLE').length,
    noneCaseCount,
    guardCaseCount: guardCount,
    targetResolutionCoverage: ratio(actualResolved, expectedResolved, null),
    lexicalGoldPassageRecall: ratio(lexicalPassageHits, expectedPassageCount, null),
    candidateGoldPassageRecall: ratio(candidatePassageHits, expectedPassageCount, null),
    candidatePassagePrecision: ratio(predictedPassageCount - unexpectedPassageCount, predictedPassageCount, null),
    relationAccuracy: ratio(
      RELATIONS.reduce((sum, relation) => sum + confusion[relation][relation], 0),
      expectedPassageCount,
      null,
    ),
    relationMacroF1,
    relationByClass: perRelation,
    noneFalsePositiveRate: ratio(noneFalsePositiveCount, noneCaseCount, null),
    guardRecall: ratio(guardPassCount, guardCount, null),
    provenanceCompleteness: ratio(completeCandidateCount, candidateCount, 1),
    authorityViolations,
    candidateCount,
    expectedPassageCount,
    unexpectedPassageCount,
  };
  return { metrics, confusion };
}

function staleSourceProbe(inputs, gold, snapshotsById) {
  const { Parser, Linguistic } = dependencies();
  const firstGold = gold.cases.find((item) => item.targetResolution === 'RESOLVED');
  const firstInput = inputs.cases.find((item) => item.caseId === firstGold.caseId);
  const selected = firstInput.sourceIds.map((sourceId) => snapshotsById.get(sourceId));
  const index = Linguistic.create(selected, { indexId: 'p78.holdout.stale-source-probe' });
  const parsed = Parser.parse(firstInput.targetText);
  const result = Linguistic.findCandidates(index, parsed, {
    expectedSourceSetHash: `sha256:${'f'.repeat(64)}`,
    expectedLinguisticIndexHash: index.linguisticIndexHash,
  });
  const passed = result.status === 'ABSTAIN'
    && result.code === 'STALE_SOURCE_SET'
    && result.evidenceCandidates.length === 0
    && result.finalStatus === 'ABSTAIN'
    && result.finalRelation === 'NOT_COMPUTED';
  return { value: passed ? 1 : 0, status: result.status, code: result.code, candidateCount: result.evidenceCandidates.length };
}

function gate(metric, comparator, threshold, actual) {
  const passed = typeof actual === 'number'
    && (comparator === 'GTE' ? actual >= threshold : actual <= threshold);
  return { metric, comparator, threshold, actual, passed };
}

function buildGates(metrics, thresholds, staleSourceRejection) {
  return [
    gate('targetResolutionCoverage', 'GTE', thresholds.targetResolutionCoverageMin, metrics.targetResolutionCoverage.value),
    gate('lexicalGoldPassageRecall', 'GTE', thresholds.lexicalGoldPassageRecallMin, metrics.lexicalGoldPassageRecall.value),
    gate('candidateGoldPassageRecall', 'GTE', thresholds.candidateGoldPassageRecallMin, metrics.candidateGoldPassageRecall.value),
    gate('candidatePassagePrecision', 'GTE', thresholds.candidatePassagePrecisionMin, metrics.candidatePassagePrecision.value),
    gate('relationMacroF1', 'GTE', thresholds.relationMacroF1Min, metrics.relationMacroF1),
    gate('noneFalsePositiveRate', 'LTE', thresholds.noneFalsePositiveRateMax, metrics.noneFalsePositiveRate.value),
    gate('guardRecall', 'GTE', thresholds.guardRecallMin, metrics.guardRecall.value),
    gate('provenanceCompleteness', 'GTE', thresholds.provenanceCompletenessMin, metrics.provenanceCompleteness.value),
    gate('authorityViolations', 'LTE', thresholds.authorityViolationsMax, metrics.authorityViolations),
    gate('staleSourceRejection', 'GTE', thresholds.staleSourceRejectionMin, staleSourceRejection.value),
  ];
}

function evaluate(inputs, gold, rawOptions = {}) {
  const { Canonical, Contracts, Parser, Linguistic } = dependencies();
  const options = { reverseSourceOrder: Boolean(rawOptions.reverseSourceOrder) };
  const snapshots = buildSnapshots(inputs);
  const snapshotsById = new Map(snapshots.map((source) => [source.sourceId, source]));
  const inputCasesById = new Map(inputs.cases.map((item) => [item.caseId, item]));
  const cases = gold.cases.map((goldCase) => {
    const inputCase = inputCasesById.get(goldCase.caseId);
    if (!inputCase) throw new Error(`gold case has no input: ${goldCase.caseId}`);
    return evaluateCase(inputCase, goldCase, snapshotsById, options);
  });
  const aggregate = aggregateCases(cases, gold);
  const staleSourceRejection = staleSourceProbe(inputs, gold, snapshotsById);
  const gates = buildGates(aggregate.metrics, gold.thresholds, staleSourceRejection);
  const fixtureHashes = computeFixtureHashes(inputs, gold);
  const report = {
    schema: 'meridian.ag4-external-holdout-report/1',
    version: VERSION,
    datasetId: inputs.datasetId,
    holdoutHash: fixtureHashes.holdoutHash,
    sourceSetHash: Contracts.computeSourceSetHash(snapshots),
    evaluatorRef: { id: 'p78:test:ag4-external-holdout-evaluator', version: VERSION },
    engineRefs: {
      parser: Parser.parserRef,
      linguisticIndexVersion: Linguistic.version,
    },
    gateStatus: gates.every((item) => item.passed) ? 'PILOT_GATE_PASS' : 'BLOCKED_FOR_AG5',
    gates,
    staleSourceRejection,
    metrics: aggregate.metrics,
    relationConfusion: aggregate.confusion,
    cases,
  };
  report.reportHash = Canonical.hashCanonical(report);
  return deepFreeze(report);
}

function validateFixtures(inputs, gold, productionCorpus) {
  const { Canonical, Contracts } = dependencies();
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });
  if (inputs.schema !== 'meridian.ag4-external-holdout-inputs/1') fail('INPUT_SCHEMA', inputs.schema);
  if (gold.schema !== 'meridian.ag4-external-holdout-gold/1') fail('GOLD_SCHEMA', gold.schema);
  if (inputs.datasetId !== gold.datasetId) fail('DATASET_ID_MISMATCH', `${inputs.datasetId} != ${gold.datasetId}`);
  if (inputs.status !== 'SEALED' || gold.status !== 'SEALED') fail('NOT_SEALED', 'both fixtures must be SEALED');
  if (inputs.sources.length < 8 || inputs.cases.length < 10) fail('PILOT_TOO_SMALL', 'requires at least 8 sources and 10 cases');

  const sourceIds = new Set();
  const pageUrls = new Set();
  const snapshots = [];
  inputs.sources.forEach((source) => {
    if (sourceIds.has(source.sourceId)) fail('DUPLICATE_SOURCE_ID', source.sourceId);
    sourceIds.add(source.sourceId);
    if (pageUrls.has(source.provenance.pageUrl)) fail('DUPLICATE_PAGE_URL', source.provenance.pageUrl);
    pageUrls.add(source.provenance.pageUrl);
    if (!/^https:\/\/ru\.wikipedia\.org\/wiki\//.test(source.provenance.pageUrl)) fail('NON_EXTERNAL_SOURCE', source.sourceId);
    if (source.provenance.provenanceFamilyId !== 'ru.wikipedia.org') fail('PROVENANCE_FAMILY', source.sourceId);
    if (source.provenance.licenseSpdx !== 'CC-BY-SA-4.0') fail('LICENSE', source.sourceId);
    if (source.provenance.retrievedAt !== '2026-07-21') fail('RETRIEVAL_DATE', source.sourceId);
    if (!source.provenance.attribution || !source.provenance.transformation) fail('PROVENANCE_INCOMPLETE', source.sourceId);
    const wordCount = source.text.trim().split(/\s+/u).length;
    if (wordCount > 25) fail('EXCERPT_TOO_LONG', `${source.sourceId}: ${wordCount}`);
    try {
      const snapshot = Contracts.createSourceSnapshot({
        sourceId: source.sourceId,
        revision: source.revision,
        language: source.language,
        text: source.text,
      });
      snapshots.push(snapshot);
    } catch (error) {
      fail('SOURCE_SNAPSHOT_INVALID', `${source.sourceId}: ${error.message}`);
    }
  });

  const inputCaseIds = new Set();
  inputs.cases.forEach((item) => {
    if (inputCaseIds.has(item.caseId)) fail('DUPLICATE_CASE_ID', item.caseId);
    inputCaseIds.add(item.caseId);
    if (!item.sourceIds.length) fail('EMPTY_SOURCE_POOL', item.caseId);
    item.sourceIds.forEach((sourceId) => {
      if (!sourceIds.has(sourceId)) fail('UNKNOWN_CASE_SOURCE', `${item.caseId}: ${sourceId}`);
    });
  });
  const goldCaseIds = new Set();
  gold.cases.forEach((item) => {
    if (goldCaseIds.has(item.caseId)) fail('DUPLICATE_GOLD_CASE_ID', item.caseId);
    goldCaseIds.add(item.caseId);
    if (!inputCaseIds.has(item.caseId)) fail('GOLD_WITHOUT_INPUT', item.caseId);
    item.passages.forEach((passage) => {
      if (!sourceIds.has(passage.sourceId)) fail('UNKNOWN_GOLD_SOURCE', `${item.caseId}: ${passage.sourceId}`);
      if (!RELATIONS.includes(passage.relation)) fail('UNKNOWN_GOLD_RELATION', `${item.caseId}: ${passage.relation}`);
    });
  });
  inputCaseIds.forEach((caseId) => {
    if (!goldCaseIds.has(caseId)) fail('INPUT_WITHOUT_GOLD', caseId);
  });

  const hashes = computeFixtureHashes(inputs, gold);
  Object.keys(hashes).forEach((key) => {
    if (hashes[key] !== gold.pins[key]) fail('PIN_MISMATCH', `${key}: ${hashes[key]} != ${gold.pins[key]}`);
  });
  if (productionCorpus) {
    if (productionCorpus.corpusHash !== gold.pins.developmentCorpusHash) fail('DEVELOPMENT_CORPUS_STALE', productionCorpus.corpusHash);
    if (productionCorpus.sourceSetHash !== gold.pins.developmentSourceSetHash) fail('DEVELOPMENT_SOURCE_SET_STALE', productionCorpus.sourceSetHash);
    const productionIds = new Set(productionCorpus.records.map((source) => source.sourceId));
    const productionTextHashes = new Set(productionCorpus.records.map((source) => source.textHash));
    snapshots.forEach((snapshot) => {
      if (productionIds.has(snapshot.sourceId)) fail('SOURCE_ID_LEAKAGE', snapshot.sourceId);
      if (productionTextHashes.has(snapshot.textHash)) fail('EXACT_TEXT_LEAKAGE', snapshot.sourceId);
    });
  }
  const validationHash = Canonical.hashCanonical({ status: errors.length ? 'INVALID' : 'VALID', errors, hashes });
  return deepFreeze({ status: errors.length ? 'INVALID' : 'VALID', errors, hashes, validationHash });
}

module.exports = deepFreeze({
  schema: 'meridian.ag4-external-holdout-evaluator/1',
  version: VERSION,
  relations: RELATIONS,
  buildSnapshots,
  computeFixtureHashes,
  validateFixtures,
  evaluate,
});
