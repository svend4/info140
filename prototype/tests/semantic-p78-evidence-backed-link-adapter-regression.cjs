'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts',
  'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
  'p78-evidence-contracts', 'p78-local-text-index', 'p78-claim-structural-matcher',
  'p78-linguistic-structure-index', 'p78-alpha-orbit-contracts', 'p78-data7-adapter',
  'p78-qualifier-direction-contracts',
  'p78-evidence-backed-link-adapter',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const Search = global.MRDP78SearchContracts;
const Parser = global.MRDP78LinguisticParserAdapter;
const Evidence = global.MRDP78EvidenceContracts;
const Linguistic = global.MRDP78LinguisticStructureIndex;
const Data7 = global.MRDP78Data7Adapter;
const Adapter = global.MRDP78EvidenceBackedLinkAdapter;
const checks = [];

const POSITIVE = '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435.';
const NEGATIVE = '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u043d\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435.';
const CHECK_PLAIN = '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u0442 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442.';
const CHECK_METHOD = '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u0442 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u0447\u0435\u0440\u0435\u0437 \u0444\u043e\u0440\u043c\u0443\u043b\u0443.';
const CHECK_HYPOTHESIS = '\u0412\u043e\u0437\u043c\u043e\u0436\u043d\u043e \u0441\u0438\u0441\u0442\u0435\u043c\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u0442 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442.';
const CONFIG = Object.freeze({ maxOperations: 100000, maxHits: 512, maxPassages: 128 });

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

function copy(value) { return Canonical.deepCopy(value); }
function hash(label) { return Canonical.hashText(label); }

function candidateDefinition(candidate) {
  return {
    targetClaimRef: copy(candidate.targetClaimRef),
    passageClaimRef: copy(candidate.passageClaimRef),
    hitIds: candidate.hitIds.slice(),
    sourceSpanIds: candidate.sourceSpanIds.slice(),
    sourceRef: copy(candidate.sourceRef),
    locator: copy(candidate.locator),
    passageTextHash: candidate.passageTextHash,
    proposedRelation: candidate.proposedRelation,
    alignment: copy(candidate.alignment),
    status: candidate.status,
    reasonCodes: candidate.reasonCodes.slice(),
    provenance: copy(candidate.provenance),
  };
}

function rehashProposal(value) {
  const result = copy(value);
  const identity = copy(result);
  delete identity.proposalId;
  delete identity.contentHash;
  result.proposalId = Canonical.hashCanonical(identity);
  const payload = copy(result);
  delete payload.contentHash;
  result.contentHash = Canonical.hashCanonical(payload);
  return result;
}

function makeFixture(options = {}) {
  const targetText = options.targetText || POSITIVE;
  const passageText = options.passageText || NEGATIVE;
  const sourceText = `${targetText} ${passageText}`;
  const source = Search.createSourceSnapshot({
    sourceId: options.sourceId || 'data7.evidence-link.primary',
    revision: options.revision || 'r1',
    language: 'ru',
    text: sourceText,
  });
  const passageStart = targetText.length + 1;
  const segments = Data7.createSegmentBatch(source, {
    alpha: 0,
    locators: [
      { start: 0, end: targetText.length, label: 'Target claim' },
      { start: passageStart, end: sourceText.length, label: 'Passage claim' },
    ],
  }).segments;
  const witness = Data7.createSegmentBatch(source, {
    alpha: 0,
    locators: [{ start: 0, end: sourceText.length, label: 'Exact context' }],
  }).segments[0];
  const linkCandidate = Data7.createLinkCandidate(
    segments[0], segments[1], witness, { relation: 'CO_OCCURS_WITH' },
  );
  const extraSources = options.extraSources || [];
  const linguisticIndex = Linguistic.create([source, ...extraSources], {
    indexId: options.indexId || `data7.evidence-link.${Canonical.hashText(sourceText).slice(7, 23)}`,
  });
  const targetParse = Parser.replay(segments[0].text, { expectedLexiconHash: linguisticIndex.lexiconHash });
  const replay = Linguistic.replay(linguisticIndex, targetParse, {
    ...CONFIG,
    expectedSourceSetHash: linguisticIndex.sourceSetHash,
    expectedLinguisticIndexHash: linguisticIndex.linguisticIndexHash,
  });
  const evidenceCandidate = replay.evidenceCandidates.find((candidate) => (
    candidate.sourceRef.sourceHash === source.sourceHash &&
    candidate.locator.start === segments[1].locator.start &&
    candidate.locator.end === segments[1].locator.end
  ));
  assert(evidenceCandidate, 'fixture evidence candidate missing');
  return {
    source,
    segments,
    witness,
    linkCandidate,
    linguisticIndex,
    replay,
    evidenceCandidate,
    definition: {
      linkCandidate,
      fromSegment: segments[0],
      toSegment: segments[1],
      witnessSegment: witness,
      sourceSnapshot: source,
      linguisticIndex,
      evidenceCandidate,
      replayConfig: CONFIG,
    },
  };
}

check('API is frozen and caps authority at a review-only proposed edge', () => {
  assert.equal(Adapter.status, 'READY');
  assert.equal(Adapter.version, '1.4.0');
  assert.equal(Adapter.validatorVersion, 'p78-evidence-backed-link-adapter@1.4.0');
  assert.equal(typeof Adapter.createEvidenceBackedLinkWithValidation, 'function');
  assert.equal(Adapter.validationReportSchema, 'meridian.evidence-backed-link-validation-report/1');
  assert.deepEqual(Adapter.operations, ['EVIDENCE_BACK_LINK']);
  assert.deepEqual(Adapter.promotableRelations, ['QUALIFIES', 'REFUTES', 'SUPPORTS']);
  assert.deepEqual(Adapter.qualifierDirections, ['BROADER', 'NARROWER']);
  assert(Canonical.isSha256(global.MRDP78QualifierDirectionContracts.rulesetHash));
  assert.equal(Adapter.maxEdgeStatus, 'PROPOSED');
  assert.equal(Adapter.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(Adapter.finalRelation, 'NOT_COMPUTED');
  assert.equal(Adapter.semanticTruth, false);
  assert.equal(Adapter.soundness, 'NOT_COMPUTED');
  assert.equal(Adapter.commitAllowed, false);
  assert.equal(Adapter.limits.maxSourceCount, 64);
  assert.equal(Adapter.limits.maxSourceCodeUnits, 8000000);
  assert.equal(Adapter.limits.maxGraphValues, 1000000);
  assert.equal(Adapter.limits.maxGraphCodeUnits, 64000000);
  assert(Object.isFrozen(Adapter) && Object.isFrozen(Adapter.limits));
});

check('deterministic replay promotes an exact negative passage only to REFUTES proposal', () => {
  const fixture = makeFixture();
  const proposal = Adapter.createEvidenceBackedLink(fixture.definition);
  assert.equal(proposal.schema, 'meridian.data7-evidence-backed-link-proposal/2');
  assert.equal(proposal.proposedRelation, 'REFUTES');
  assert.equal(proposal.qualifierDirectionAssessment, null);
  assert.equal(proposal.relationStatus, 'PROPOSED');
  assert.equal(proposal.verificationStatus, 'REPLAY_REQUIRED');
  assert.equal(proposal.validationRequirement, 'FULL_BUNDLE_REPLAY');
  assert.equal(proposal.evidenceStatus, 'EVIDENCE_BACKED_PROPOSAL');
  assert.equal(proposal.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(proposal.finalRelation, 'NOT_COMPUTED');
  assert.equal(proposal.semanticTruth, false);
  assert.equal(proposal.commitAllowed, false);
  const shape = Adapter.inspectEvidenceBackedLinkShape(proposal);
  assert.equal(shape.status, 'STRUCTURALLY_VALID');
  assert.equal(shape.validationScope, 'STRUCTURE_ONLY');
  assert.equal(shape.referentialReplay, 'NOT_PERFORMED');
  assert.equal(shape.subjectRef.proposalId, proposal.proposalId);
  assert.equal(shape.subjectRef.contentHash, proposal.contentHash);
  assert.equal(shape.sourceAuthority, 'NOT_ASSESSED');
  assert.equal(shape.commitAllowed, false);
  const against = Adapter.validateEvidenceBackedLinkAgainst(proposal, fixture.definition);
  assert.equal(against.status, 'VALID');
  assert.equal(against.validationScope, 'REFERENTIAL_REPLAY');
  assert.equal(against.version, '1.1.0');
  assert.equal(against.referentialReplay, 'PERFORMED');
  assert(Object.isFrozen(proposal) && Object.isFrozen(proposal.edgeProposal));
  assert.equal(against.subjectRef.proposalId, proposal.proposalId);
  assert.equal(against.subjectRef.contentHash, proposal.contentHash);
  assert.equal(against.evidenceBundleRef.targetTextHash, fixture.segments[0].textHash);
  assert.equal(against.evidenceBundleRef.passageTextHash, fixture.segments[1].textHash);
  assert.equal(against.evidenceBundleRef.targetSegmentHash, fixture.segments[0].contentHash);
  assert.equal(against.evidenceBundleRef.passageSegmentHash, fixture.segments[1].contentHash);
  assert.equal(against.evidenceBundleRef.queryHash, proposal.queryRef.contentHash);
  assert.equal(against.evidenceBundleRef.indexHash, proposal.indexRef.contentHash);
  assert.equal(against.evidenceBundleRef.evidenceCandidateHash, proposal.evidenceCandidateRef.contentHash);
  assert.equal(against.evidenceBundleRef.sourceRef.sourceId, fixture.source.sourceId);
  assert.equal(against.evidenceBundleRef.sourceRef.revision, fixture.source.revision);
  assert.equal(against.evidenceBundleRef.proposedRelation, proposal.proposedRelation);
  assert.equal(against.evidenceBundleRef.hitCount, proposal.hitRefs.length);
  assert.equal(against.evidenceBundleRef.contextCount, proposal.contextSpanRefs.length);
  assert.equal(against.sourceAuthority, 'UNVERIFIED');
  assert.equal(against.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(against.semanticTruth, false);
});

check('atomic creation returns one proposal-bound validation receipt without a second public validation step', () => {
  const fixture = makeFixture();
  const result = Adapter.createEvidenceBackedLinkWithValidation(fixture.definition);
  assert.equal(result.validation.status, 'VALID');
  assert.equal(result.validation.validationScope, 'REFERENTIAL_REPLAY');
  assert.equal(result.validation.subjectRef.proposalId, result.proposal.proposalId);
  assert.equal(result.validation.subjectRef.contentHash, result.proposal.contentHash);
  assert.equal(result.validation.evidenceBundleRef.queryHash, result.proposal.queryRef.contentHash);
  assert(Object.isFrozen(result) && Object.isFrozen(result.proposal) && Object.isFrozen(result.validation));
});

check('edge direction is passage to target and never creates an alpha transition receipt', () => {
  const fixture = makeFixture();
  const proposal = Adapter.createEvidenceBackedLink(fixture.definition);
  assert.equal(proposal.direction, 'PASSAGE_TO_TARGET');
  assert.equal(proposal.edgeProposal.fromRef.artifactId, fixture.segments[1].artifact.artifactId);
  assert.equal(proposal.edgeProposal.toRef.artifactId, fixture.segments[0].artifact.artifactId);
  assert.equal(proposal.edgeProposal.relation, 'REFUTES');
  assert.equal(proposal.edgeProposal.status, 'PROPOSED');
  assert.deepEqual(proposal.edgeProposal.sourceRefs, [fixture.source.sourceHash]);
  assert.equal(proposal.alphaTransitionReceipt, null);
});

check('all hit, context, passage, claim and alignment references resolve in the replay', () => {
  const fixture = makeFixture();
  const proposal = Adapter.createEvidenceBackedLink(fixture.definition);
  assert(proposal.hitRefs.length > 0);
  assert(proposal.contextSpanRefs.length > 0);
  assert.deepEqual(proposal.hitRefs.map((item) => item.hitId), fixture.evidenceCandidate.hitIds);
  assert.deepEqual(proposal.evidenceCandidateRef.sourceSpanIds, [proposal.sourcePassageRef.sourceSpanId]);
  assert.equal(proposal.sourcePassageRef.locator.start, fixture.segments[1].locator.start);
  assert.equal(proposal.sourcePassageRef.locator.end, fixture.segments[1].locator.end);
  assert.equal(proposal.passageClaimRecordRef.spanMapStatus, 'COMPLETE');
  assert.equal(proposal.passageClaimRecordRef.structuralStatus, 'STRUCTURAL_MATCH');
  assert.equal(proposal.alignmentRef.gateStatus, 'CLAIM_ALIGNED');
  for (const hit of proposal.hitRefs) {
    assert(proposal.contextSpanRefs.some((context) => context.spanHash === hit.contextSpanHash));
  }
});

check('repeated construction is byte-identical and history-free', () => {
  const fixture = makeFixture();
  const first = Adapter.createEvidenceBackedLink(fixture.definition);
  const second = Adapter.createEvidenceBackedLink(fixture.definition);
  assert.equal(first.proposalId, second.proposalId);
  assert.equal(first.contentHash, second.contentHash);
  assert.deepEqual(first, second);
});

check('an exact positive passage can produce only a reviewable SUPPORTS proposal', () => {
  const fixture = makeFixture({
    passageText: POSITIVE,
    sourceId: 'data7.evidence-link.supports',
    indexId: 'data7.evidence-link.supports-index',
  });
  assert.equal(fixture.evidenceCandidate.proposedRelation, 'SUPPORTS');
  const proposal = Adapter.createEvidenceBackedLink(fixture.definition);
  assert.equal(proposal.proposedRelation, 'SUPPORTS');
  assert.equal(proposal.qualifierDirectionAssessment, null);
  assert.equal(proposal.edgeProposal.status, 'PROPOSED');
  assert.equal(proposal.finalRelation, 'NOT_COMPUTED');
});

check('the complete source set is pinned even when the primary link uses one source', () => {
  const extra = Search.createSourceSnapshot({
    sourceId: 'data7.evidence-link.secondary', revision: 'r1', language: 'ru', text: POSITIVE,
  });
  const fixture = makeFixture({ extraSources: [extra], indexId: 'data7.evidence-link.multi-source' });
  const proposal = Adapter.createEvidenceBackedLink(fixture.definition);
  assert.equal(proposal.sourceSetRef.sourceCount, 2);
  assert.equal(proposal.sourceSetRef.sourceSetHash, Search.computeSourceSetHash([fixture.source, extra]));
  assert.equal(proposal.sourceSetRef.primarySourceHash, fixture.source.sourceHash);
});

check('a generic EvidenceCandidate may accept a fake hit id but this adapter rejects it', () => {
  const fixture = makeFixture();
  const raw = candidateDefinition(fixture.evidenceCandidate);
  raw.hitIds = [`hit:${'f'.repeat(64)}`];
  const generic = Evidence.createEvidenceCandidate(raw);
  assert.equal(Evidence.validateEvidenceCandidate(generic).status, 'VALID');
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, evidenceCandidate: generic }),
    /EVIDENCE_CANDIDATE_NOT_REPRODUCED/,
  );
});

check('MENTIONS cannot be promoted or silently mapped to ASSOCIATES', () => {
  const fixture = makeFixture();
  const raw = candidateDefinition(fixture.evidenceCandidate);
  raw.proposedRelation = 'MENTIONS';
  raw.status = 'CANDIDATE';
  const mention = Evidence.createEvidenceCandidate(raw);
  assert.equal(Evidence.validateEvidenceCandidate(mention).status, 'VALID');
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, evidenceCandidate: mention }),
    /RELATION_NOT_PROMOTABLE/,
  );
});

check('a BROADER passage cannot be emitted as passage-to-target QUALIFIES', () => {
  const fixture = makeFixture({
    targetText: CHECK_METHOD,
    passageText: CHECK_PLAIN,
    sourceId: 'data7.evidence-link.qualifies-broader',
    indexId: 'data7.evidence-link.qualifies-broader-index',
  });
  assert.equal(fixture.evidenceCandidate.proposedRelation, 'QUALIFIES');
  assert.throws(
    () => Adapter.createEvidenceBackedLink(fixture.definition),
    /QUALIFIES_ENDPOINT_DIRECTION_MISMATCH/,
  );
});

check('QUALIFIES promotes a replayed passage that is NARROWER than its target', () => {
  const fixture = makeFixture({
    targetText: CHECK_PLAIN,
    passageText: CHECK_METHOD,
    sourceId: 'data7.evidence-link.qualifies-narrower',
    indexId: 'data7.evidence-link.qualifies-narrower-index',
  });
  assert.equal(fixture.evidenceCandidate.proposedRelation, 'QUALIFIES');
  const proposal = Adapter.createEvidenceBackedLink(fixture.definition);
  assert.equal(proposal.proposedRelation, 'QUALIFIES');
  assert.equal(proposal.qualifierDirectionAssessment.status, 'DIRECTED');
  assert.equal(proposal.qualifierDirectionAssessment.scopeDirection, 'NARROWER');
  assert.equal(proposal.qualifierDirectionAssessment.witness.qualifiedSide, 'PASSAGE');
  assert.equal(proposal.qualifierDirectionAssessment.witness.markerToken, 'через');
  assert.equal(proposal.qualifierDirectionAssessment.logicalImplication, 'NOT_COMPUTED');
  assert.equal(proposal.qualifierDirectionAssessment.passageParseRef.inputHash, fixture.segments[1].textHash);
  assert.equal(proposal.edgeProposal.fromRef.artifactId, fixture.segments[1].artifact.artifactId);
  assert.equal(proposal.edgeProposal.toRef.artifactId, fixture.segments[0].artifact.artifactId);
});

check('QUALIFIES with only a modal difference remains blocked', () => {
  const fixture = makeFixture({
    targetText: CHECK_PLAIN,
    passageText: CHECK_HYPOTHESIS,
    sourceId: 'data7.evidence-link.qualifies-modality',
    indexId: 'data7.evidence-link.qualifies-modality-index',
  });
  assert.equal(fixture.evidenceCandidate.proposedRelation, 'QUALIFIES');
  assert.throws(
    () => Adapter.createEvidenceBackedLink(fixture.definition),
    /QUALIFIES_DIRECTION_ABSTAIN.*MODALITY_MISMATCH/,
  );
});

check('promotable relations still require STRUCTURALLY_ALIGNED status', () => {
  const fixture = makeFixture({
    passageText: POSITIVE,
    sourceId: 'data7.evidence-link.candidate-status',
    indexId: 'data7.evidence-link.candidate-status-index',
  });
  const raw = candidateDefinition(fixture.evidenceCandidate);
  raw.status = 'CANDIDATE';
  const weak = Evidence.createEvidenceCandidate(raw);
  assert.equal(Evidence.validateEvidenceCandidate(weak).status, 'VALID');
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, evidenceCandidate: weak }),
    /STRUCTURAL_ALIGNMENT_REQUIRED/,
  );
});

check('a different valid replay candidate cannot be attached to the selected endpoint', () => {
  const fixture = makeFixture();
  const other = fixture.replay.evidenceCandidates.find((candidate) => candidate.candidateId !== fixture.evidenceCandidate.candidateId);
  assert(other && Evidence.validateEvidenceCandidate(other).status === 'VALID');
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, evidenceCandidate: other }),
    /EXACT_SOURCE_PASSAGE_NOT_FOUND|SOURCE_PASSAGE_ENDPOINT_MISMATCH|EVIDENCE_PASSAGE_REFERENCE_MISMATCH/,
  );
});

check('endpoint reversal is blocked by the original Data7 link identity', () => {
  const fixture = makeFixture();
  assert.throws(
    () => Adapter.createEvidenceBackedLink({
      ...fixture.definition,
      fromSegment: fixture.segments[1],
      toSegment: fixture.segments[0],
    }),
    /DATA7_LINK_CANDIDATE_INVALID/,
  );
});

check('stale source snapshots and indexes fail before semantic promotion', () => {
  const fixture = makeFixture();
  const staleSource = Search.createSourceSnapshot({
    sourceId: fixture.source.sourceId,
    revision: 'r2',
    language: fixture.source.language,
    text: `${fixture.source.text} Extra.`,
  });
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, sourceSnapshot: staleSource }),
    /SEGMENT_SOURCE_MISMATCH/,
  );
  const staleIndex = copy(fixture.linguisticIndex);
  staleIndex.lexiconHash = hash('stale lexicon');
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, linguisticIndex: staleIndex }),
    /LINGUISTIC_INDEX_INVALID/,
  );
  const tooManySources = copy(fixture.linguisticIndex);
  tooManySources.lexicalIndex.sources = Array.from({ length: 65 }, () => copy(fixture.source));
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, linguisticIndex: tooManySources }),
    /SOURCE_SET_TOO_LARGE/,
  );
  const oversizedText = copy(fixture.source);
  oversizedText.sourceId = 'data7.evidence-link.oversized-secondary';
  oversizedText.text = 'x'.repeat(2000000);
  const oversizedIndex = copy(fixture.linguisticIndex);
  oversizedIndex.lexicalIndex.sources = [fixture.source, ...Array(4).fill(oversizedText)];
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, linguisticIndex: oversizedIndex }),
    /SOURCE_TEXT_BUDGET_EXCEEDED/,
  );
});

check('insufficient replay budgets abstain instead of reusing an old candidate', () => {
  const fixture = makeFixture();
  assert.throws(
    () => Adapter.createEvidenceBackedLink({
      ...fixture.definition,
      replayConfig: { maxOperations: 100000, maxHits: 512, maxPassages: 1 },
    }),
    /EVIDENCE_REPLAY_NOT_READY/,
  );
});

check('candidate provenance must match the full current source and index set', () => {
  const fixture = makeFixture();
  const raw = candidateDefinition(fixture.evidenceCandidate);
  raw.provenance.sourceSetHash = hash('foreign source set');
  const foreign = Evidence.createEvidenceCandidate(raw);
  assert.equal(Evidence.validateEvidenceCandidate(foreign).status, 'VALID');
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, evidenceCandidate: foreign }),
    /EVIDENCE_PROVENANCE_MISMATCH/,
  );
});

check('proposal validation rejects reviewed edges and authority escalation', () => {
  const proposal = Adapter.createEvidenceBackedLink(makeFixture().definition);
  const reviewed = copy(proposal);
  reviewed.edgeProposal.status = 'REVIEWED';
  assert.notEqual(Adapter.inspectEvidenceBackedLinkShape(reviewed).status, 'STRUCTURALLY_VALID');
  const final = copy(proposal);
  final.finalRelation = 'REFUTES';
  assert.equal(Adapter.inspectEvidenceBackedLinkShape(final).code, 'FINAL_RELATION_FORBIDDEN');
  const truth = copy(proposal);
  truth.semanticTruth = true;
  assert.equal(Adapter.inspectEvidenceBackedLinkShape(truth).code, 'SEMANTIC_TRUTH_FORBIDDEN');
  const receipt = copy(proposal);
  receipt.alphaTransitionReceipt = {};
  assert.equal(Adapter.inspectEvidenceBackedLinkShape(receipt).code, 'ALPHA_TRANSITION_RECEIPT_FORBIDDEN');
});

check('shape inspection never claims referential replay and full against-validation catches rehashed forgery', () => {
  const fixture = makeFixture();
  const proposal = Adapter.createEvidenceBackedLink(fixture.definition);
  const forged = copy(proposal);
  const foreignQueryHash = hash('foreign but internally consistent query ref');
  forged.queryRef.contentHash = foreignQueryHash;
  for (const hitRef of forged.hitRefs) hitRef.queryRef.contentHash = foreignQueryHash;
  const rehashed = rehashProposal(forged);
  const shape = Adapter.inspectEvidenceBackedLinkShape(rehashed);
  assert.equal(shape.status, 'STRUCTURALLY_VALID');
  assert.equal(shape.validationScope, 'STRUCTURE_ONLY');
  assert.equal(shape.referentialReplay, 'NOT_PERFORMED');
  const against = Adapter.validateEvidenceBackedLinkAgainst(rehashed, fixture.definition);
  assert.equal(against.status, 'INVALID');
  assert.equal(against.validationScope, 'REFERENTIAL_REPLAY');
  assert.equal(against.code, 'EVIDENCE_BUNDLE_REFERENCE_MISMATCH');
});

check('proposal validation rejects detached hit, context and claim references', () => {
  const proposal = Adapter.createEvidenceBackedLink(makeFixture().definition);
  const hit = copy(proposal);
  hit.hitRefs[0].matchedTextHash = hash('different slice');
  assert.notEqual(Adapter.inspectEvidenceBackedLinkShape(hit).status, 'STRUCTURALLY_VALID');
  const context = copy(proposal);
  context.contextSpanRefs[0].spanHash = hash('different context');
  assert.notEqual(Adapter.inspectEvidenceBackedLinkShape(context).status, 'STRUCTURALLY_VALID');
  const claim = copy(proposal);
  claim.passageClaimRef.contentHash = hash('different claim');
  assert.equal(Adapter.inspectEvidenceBackedLinkShape(claim).code, 'PASSAGE_CLAIM_REFERENCE_MISMATCH');
});

check('against-validation detects a changed external evidence bundle', () => {
  const fixture = makeFixture();
  const proposal = Adapter.createEvidenceBackedLink(fixture.definition);
  const otherFixture = makeFixture({
    passageText: POSITIVE,
    sourceId: 'data7.evidence-link.other-bundle',
    indexId: 'data7.evidence-link.other-bundle-index',
  });
  assert.notEqual(
    Adapter.validateEvidenceBackedLinkAgainst(proposal, otherFixture.definition).status,
    'VALID',
  );
});

check('hidden, symbolic and accessor fields are rejected before replay', () => {
  const fixture = makeFixture();
  const hidden = { ...fixture.definition };
  Object.defineProperty(hidden, 'accepted', { value: true, enumerable: false });
  assert.throws(() => Adapter.createEvidenceBackedLink(hidden), /NON_ENUMERABLE_FIELD_FORBIDDEN/);
  const symbolic = { ...fixture.definition, [Symbol('truth')]: true };
  assert.throws(() => Adapter.createEvidenceBackedLink(symbolic), /SYMBOL_FIELD_FORBIDDEN/);
  const accessor = { ...fixture.definition };
  Object.defineProperty(accessor, 'evidenceCandidate', {
    enumerable: true,
    get() { return fixture.evidenceCandidate; },
  });
  assert.throws(() => Adapter.createEvidenceBackedLink(accessor), /ACCESSOR_FORBIDDEN/);
  const deep = {};
  let cursor = deep;
  for (let index = 0; index < 80; index += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.throws(
    () => Adapter.createEvidenceBackedLink({ ...fixture.definition, deep }),
    /INPUT_GRAPH_DEPTH_EXCEEDED/,
  );
  const wide = { ...fixture.definition, wide: new Array(Adapter.limits.maxGraphValues + 1).fill(0) };
  assert.throws(
    () => Adapter.createEvidenceBackedLink(wide),
    /INPUT_GRAPH_VALUE_BUDGET_EXCEEDED/,
  );
});

check('fresh VM dependency gating is explicit and the complete stack becomes READY', () => {
  const names = [
    'p78-canonical-json', 'semantic-core', 'semantic-language', 'p78-search-contracts',
    'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
    'p78-evidence-contracts', 'p78-local-text-index', 'p78-claim-structural-matcher',
    'p78-linguistic-structure-index', 'p78-alpha-orbit-contracts', 'p78-data7-adapter',
    'p78-qualifier-direction-contracts',
  ];
  const adapterSource = fs.readFileSync(lib('p78-evidence-backed-link-adapter'), 'utf8');
  const blocked = vm.createContext({});
  vm.runInContext(fs.readFileSync(lib('p78-canonical-json'), 'utf8'), blocked);
  vm.runInContext(adapterSource, blocked);
  assert.equal(blocked.MRDP78EvidenceBackedLinkAdapter.status, 'BLOCKED');
  assert.equal(blocked.MRDP78EvidenceBackedLinkAdapter.code, 'EVIDENCE_BACKED_LINK_DEPENDENCY_UNAVAILABLE');

  const ready = vm.createContext({});
  for (const name of names) vm.runInContext(fs.readFileSync(lib(name), 'utf8'), ready);
  vm.runInContext(adapterSource, ready);
  assert.equal(ready.MRDP78EvidenceBackedLinkAdapter.status, 'READY');
  assert.equal(ready.MRDP78EvidenceBackedLinkAdapter.maxEdgeStatus, 'PROPOSED');
  assert.equal(typeof ready.MRDP78EvidenceBackedLinkAdapter.inspectEvidenceBackedLinkShape, 'function');

  const stale = vm.createContext({});
  for (const name of names) vm.runInContext(fs.readFileSync(lib(name), 'utf8'), stale);
  stale.MRDP78QualifierDirectionContracts = Object.assign(
    {}, stale.MRDP78QualifierDirectionContracts, { rulesetHash: hash('stale qualifier rules') },
  );
  vm.runInContext(adapterSource, stale);
  assert.equal(stale.MRDP78EvidenceBackedLinkAdapter.status, 'BLOCKED');
  assert.equal(stale.MRDP78EvidenceBackedLinkAdapter.code, 'QUALIFIER_DIRECTION_POLICY_STALE');
});

check('adapter source has no UI, network, clock, randomness, evaluator or commit authority', () => {
  const sourceText = fs.readFileSync(lib('p78-evidence-backed-link-adapter'), 'utf8');
  assert(!/\bdocument\b|querySelector|getElementById|innerHTML/.test(sourceText));
  assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//.test(sourceText));
  assert(!/Math\.random|Date\.now|new Date|performance\.now/.test(sourceText));
  assert(!/\beval\s*\(|new Function/.test(sourceText));
  assert(!/commitAllowed\s*:\s*true|semanticTruth\s*:\s*true/.test(sourceText));
  assert(!/status\s*:\s*['\"]REVIEWED['\"]/.test(sourceText));
  assert(!/finalRelation\s*:\s*['\"](?:SUPPORTS|REFUTES|QUALIFIES)['\"]/.test(sourceText));
});

for (const item of checks) {
  process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? `\n${item.detail}` : ''}\n`);
}
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
process.exitCode = passed === checks.length ? 0 : 1;
