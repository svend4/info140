'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts', 'p78-local-text-index',
  'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
  'p78-claim-structural-matcher', 'p78-evidence-contracts', 'p78-claim-evidence-corpus',
  'p78-linguistic-structure-index',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const SearchContracts = global.MRDP78SearchContracts;
const Parser = global.MRDP78LinguisticParserAdapter;
const Evidence = global.MRDP78EvidenceContracts;
const Corpus = global.MRDP78ClaimEvidenceCorpus;
const Linguistic = global.MRDP78LinguisticStructureIndex;
const index = Linguistic.create(Corpus.records);
const checks = [];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}
function run(text, options) { return Linguistic.findCandidates(index, Parser.parse(text), options); }
function sourceById(id) { return Corpus.records.find((source) => source.sourceId === id); }
function passageText(record) {
  const source = sourceById(record.sourceRef.sourceId);
  const ref = index.passages.find((passage) => passage.passageId === record.passageRef.passageId);
  return source.text.slice(ref.locator.start, ref.locator.end);
}
function candidateText(candidate) {
  const source = sourceById(candidate.sourceRef.sourceId);
  return source.text.slice(candidate.locator.start, candidate.locator.end);
}

check('linguistic index is ready, immutable and pinned to all thirty passages', () => {
  assert.equal(Linguistic.status, 'READY');
  assert.equal(Linguistic.validateIndex(index).status, 'VALID');
  assert.equal(index.sourceSetHash, Corpus.sourceSetHash);
  assert.equal(index.passageCount, 30);
  assert.equal(new Set(index.passages.map((passage) => passage.passageId)).size, 30);
  assert(Object.isFrozen(index) && Object.isFrozen(index.passages) && Object.isFrozen(index.lexicalIndex));
});

check('sentence segmentation preserves exact source coordinates and hashes', () => {
  index.passages.forEach((passage) => {
    const source = sourceById(passage.sourceRef.sourceId);
    assert(source, `source missing for ${passage.passageId}`);
    assert.equal(source.text.slice(passage.locator.start, passage.locator.end), passage.text);
    assert.equal(Canonical.hashText(passage.text), passage.textHash);
    assert.equal(Evidence.validateSourcePassage(passage).status, 'VALID');
  });
});
check('imported passages must replay exactly from their pinned SourceSnapshot', () => {
  const passage = index.passages[0];
  const source = sourceById(passage.sourceRef.sourceId);
  const forgedSource = SearchContracts.createSourceSnapshot({
    sourceId: source.sourceId,
    revision: source.revision,
    language: source.language,
    status: source.status,
    text: `${source.text} Подменённое продолжение.`,
  });
  const imported = JSON.parse(JSON.stringify(index));
  imported.passages[0] = Evidence.createSourcePassage(forgedSource, passage.locator);
  const base = {
    schema: imported.schema, version: imported.version, sourceSetHash: imported.sourceSetHash,
    lexicalIndexHash: imported.lexicalIndexHash, parserRef: imported.parserRef, lexiconHash: imported.lexiconHash,
    patternSetHash: imported.patternSetHash, segmenterRef: imported.segmenterRef,
    passageRefs: imported.passages.map((item) => ({ passageId: item.passageId, sourceSpanId: item.sourceSpanId, contentHash: item.contentHash })),
  };
  imported.linguisticIndexHash = Canonical.hashCanonical(base);
  const report = Linguistic.validateIndex(imported);
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'PASSAGE_SOURCE_MISMATCH');
});


check('broad discovery parses only located passages, not the whole corpus', () => {
  const result = run('Система сохраняет состояние.');
  assert.equal(result.status, 'READY');
  assert(result.metrics.locatedPassageCount > 2, 'discovery is not broad');
  assert(result.metrics.parsedPassageCount < index.passageCount, 'all passages were parsed eagerly');
  assert.equal(result.metrics.parsedPassageCount, result.passageClaims.length);
  assert(result.metrics.lexicalHitCount >= result.metrics.locatedPassageCount);
});

check('same structure yields one SUPPORTS and opposite polarity one REFUTES proposal', () => {
  const result = run('Система сохраняет состояние.');
  const byText = Object.fromEntries(result.evidenceCandidates.map((candidate) => [candidateText(candidate), candidate]));
  assert.equal(byText['Система сохраняет состояние.'].proposedRelation, 'SUPPORTS');
  assert.equal(byText['Система не сохраняет состояние.'].proposedRelation, 'REFUTES');
  assert.equal(result.metrics.relationCounts.SUPPORTS, 1);
  assert.equal(result.metrics.relationCounts.REFUTES, 1);
  assert.equal(result.finalStatus, 'ABSTAIN');
  assert.equal(result.finalRelation, 'NOT_COMPUTED');
  assert.equal(result.reviewStatus, 'REQUIRES_REVIEW');
});

check('near lexical matches remain MENTIONS and cannot become support', () => {
  const result = run('Система сохраняет состояние.');
  const changed = result.evidenceCandidates.find((candidate) => candidateText(candidate) === 'Система изменяет состояние.');
  assert(changed, 'near match was not retained for inspection');
  assert.equal(changed.proposedRelation, 'MENTIONS');
  assert.equal(changed.alignment.predicate, 'FALSE');
  assert.equal(changed.evidenceStatus, 'EVIDENCE_CANDIDATE');
  assert.equal(changed.finalRelation, 'NOT_COMPUTED');
});

check('ambiguous and OOV passages remain visible but never become evidence candidates', () => {
  const result = run('Система продолжает процесс.');
  const unresolved = result.passageClaims.filter((record) => record.resolutionStatus !== 'RESOLVED');
  assert(unresolved.length > 0, 'unresolved candidates disappeared');
  unresolved.forEach((record) => {
    assert(['AMBIGUOUS', 'OOV'].includes(record.resolutionStatus));
    assert(!result.evidenceCandidates.some((candidate) => candidate.passageClaimRef.claimAstId === record.claimAstRef?.claimAstId));
  });
});

check('every mapped surface span resolves back to exact source text', () => {
  const result = run('Частица движется по орбите.');
  result.passageClaims.forEach((record) => {
    const source = sourceById(record.sourceRef.sourceId);
    record.surfaceSpans.forEach((span) => {
      const exact = source.text.slice(span.sourceStart, span.sourceEnd);
      assert.equal(Canonical.hashText(exact), span.textHash, `${record.passageClaimId} ${span.kind}`);
      assert.equal(span.sourceStart, index.passages.find((item) => item.passageId === record.passageRef.passageId).locator.start + span.localStart);
    });
  });
});

check('every emitted evidence candidate satisfies the strict contract', () => {
  const result = run('Частица движется по орбите.');
  assert(result.evidenceCandidates.length > 0);
  result.evidenceCandidates.forEach((candidate) => {
    assert.equal(Evidence.validateEvidenceCandidate(candidate).status, 'VALID');
    assert.equal(candidate.reviewStatus, 'REQUIRES_REVIEW');
    assert.equal(candidate.semanticTruth, false);
  });
});

check('stale source and linguistic index pins fail closed', () => {
  const staleSource = run('Система сохраняет состояние.', { expectedSourceSetHash: Canonical.hashText('stale') });
  assert.equal(staleSource.status, 'ABSTAIN');
  assert.equal(staleSource.code, 'STALE_SOURCE_SET');
  assert.equal(staleSource.evidenceCandidates.length, 0);
  const staleIndex = run('Система сохраняет состояние.', { expectedLinguisticIndexHash: Canonical.hashText('stale') });
  assert.equal(staleIndex.status, 'ABSTAIN');
  assert.equal(staleIndex.code, 'STALE_LINGUISTIC_INDEX');
});

check('support and counter-candidates coexist without automatic conflict resolution', () => {
  const result = run('Частица движется по орбите.');
  const relations = new Set(result.evidenceCandidates.map((candidate) => candidate.proposedRelation));
  assert(relations.has('SUPPORTS') && relations.has('REFUTES') && relations.has('MENTIONS'));
  assert.equal(result.finalStatus, 'ABSTAIN');
  assert.equal(result.semanticTruth, false);
  assert(!JSON.stringify(result).includes('ACCEPTED_EVIDENCE'));
});

check('structural cascade improves precision without reducing recall on the fixed benchmark', () => {
  const cases = [
    {
      target: 'Система сохраняет состояние.',
      relevant: new Set(['Система сохраняет состояние.', 'Система не сохраняет состояние.']),
    },
    {
      target: 'Частица движется по орбите.',
      relevant: new Set(['Частица движется по орбите.', 'Частица не движется по орбите.']),
    },
    {
      target: 'Давление вызывает распад.',
      relevant: new Set(['Давление вызывает распад.']),
    },
  ];
  let lexicalRetrieved = 0;
  let lexicalRelevant = 0;
  let structuralRetrieved = 0;
  let structuralRelevant = 0;
  let relevantTotal = 0;
  cases.forEach(({ target, relevant }) => {
    const result = run(target);
    const lexical = new Set(result.passageClaims.map(passageText));
    const structural = new Set(result.evidenceCandidates
      .filter((candidate) => candidate.proposedRelation !== 'MENTIONS')
      .map(candidateText));
    relevantTotal += relevant.size;
    lexicalRetrieved += lexical.size;
    structuralRetrieved += structural.size;
    relevant.forEach((text) => {
      if (lexical.has(text)) lexicalRelevant += 1;
      if (structural.has(text)) structuralRelevant += 1;
    });
  });
  const lexicalPrecision = lexicalRelevant / lexicalRetrieved;
  const structuralPrecision = structuralRelevant / structuralRetrieved;
  const lexicalRecall = lexicalRelevant / relevantTotal;
  const structuralRecall = structuralRelevant / relevantTotal;
  assert(structuralPrecision > lexicalPrecision, `${structuralPrecision} <= ${lexicalPrecision}`);
  assert(structuralRecall >= lexicalRecall, `${structuralRecall} < ${lexicalRecall}`);
  assert.equal(structuralRecall, 1);
});

check('fresh replay is content-address identical', () => {
check('qualifier differences become QUALIFIES after core arguments align', () => {
  const source = SearchContracts.createSourceSnapshot({
    sourceId: 'p78.test.qualifier',
    revision: '1.0.0',
    language: 'ru',
    status: 'ADMITTED',
    text: 'Система проверяет документ через формулу. Система проверяет документ.',
  });
  const localIndex = Linguistic.create([source]);
  const target = Parser.parse('Система проверяет документ через формулу.');
  const result = Linguistic.findCandidates(localIndex, target);
  const byText = Object.fromEntries(result.evidenceCandidates.map((candidate) => [source.text.slice(candidate.locator.start, candidate.locator.end), candidate]));
  assert.equal(byText['Система проверяет документ через формулу.'].proposedRelation, 'SUPPORTS');
  assert.equal(byText['Система проверяет документ.'].proposedRelation, 'QUALIFIES');
  assert.equal(byText['Система проверяет документ.'].alignment.arguments, 'TRUE');
  assert.equal(byText['Система проверяет документ.'].alignment.qualifiers, 'FALSE');
});

check('cascade budgets are strict, explicit and reported', () => {
  assert.throws(() => run('Система сохраняет состояние.', { maxPassages: 'oops' }), (error) => error.code === 'INVALID_BUDGET');
  const none = run('Система сохраняет состояние.', { maxPassages: 0 });
  assert.equal(none.status, 'ABSTAIN');
  assert.equal(none.code, 'PASSAGE_BUDGET_EXCEEDED');
  assert(Number.isInteger(none.metrics.operationCount) && none.metrics.operationCount > 0);
});

  const first = run('Система сохраняет состояние.');
  const second = run('Система сохраняет состояние.');
  assert.equal(first.resultHash, second.resultHash);
  assert.deepEqual(first.evidenceCandidates.map((item) => item.candidateId), second.evidenceCandidates.map((item) => item.candidateId));
  assert.deepEqual(first.passageClaims.map((item) => item.contentHash), second.passageClaims.map((item) => item.contentHash));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
