'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const canonicalPath = path.join(root, 'lib', 'p78-canonical-json.js');
const searchContractsPath = path.join(root, 'lib', 'p78-search-contracts.js');
const claimIrPath = path.join(root, 'lib', 'p78-claim-ir.js');
const sourcePaths = [canonicalPath, searchContractsPath, claimIrPath];

sourcePaths.forEach((file) => require(file));

const Canonical = global.MRDP78CanonicalJSON;
const SearchContracts = global.MRDP78SearchContracts;
const ClaimIR = global.MRDP78ClaimIR;
const checks = [];
const ZERO_HASH = `sha256:${'0'.repeat(64)}`;
const ZERO_CLAIM_ID = `claim-ast:${'0'.repeat(64)}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  assert(actual === expected, `${message}: ${actual} !== ${expected}`);
}

function same(actual, expected, message) {
  equal(independentCanonical(actual), independentCanonical(expected), message);
}

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true, detail: '' });
  } catch (error) {
    checks.push({ name, ok: false, detail: error && error.stack ? error.stack : String(error) });
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function independentCanonical(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(independentCanonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${independentCanonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError(`unsupported value: ${typeof value}`);
}

function nodeHashCanonical(value) {
  return `sha256:${crypto.createHash('sha256').update(independentCanonical(value), 'utf8').digest('hex')}`;
}

function without(value, ...keys) {
  const result = clone(value);
  keys.forEach((key) => delete result[key]);
  return result;
}

function deeplyFrozen(value, seen = new WeakSet()) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => deeplyFrozen(value[key], seen));
}

function expectCode(fn, code, message) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  assert(caught && caught.code === code, `${message}: ${caught && caught.code}`);
  assert(caught.name === 'P78ClaimIRContractError', `${message}: wrong error type`);
  return caught;
}

function expectInvalid(value, code, message) {
  const report = ClaimIR.validateClaimAst(value);
  assert(report.status === 'INVALID' && report.code === code, `${message}: ${report.status}/${report.code}`);
  assert(report.errors.length === 1 && report.errors[0].code === code, `${message}: error record mismatch`);
  assert(deeplyFrozen(report), `${message}: report is mutable`);
  return report;
}

function draftClaim() {
  return {
    sourceSpanIds: ['span:source-a:r1:12-48'],
    predicate: {
      lemma: '\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0442\u044c',
      senseId: 'sense:confirm:1',
      relationTypeId: 'relation:CONFIRMS'
    },
    arguments: [
      {
        role: 'AGENT',
        surfaceSpanId: 'span:source-a:r1:12-25',
        entityId: 'entity:study-a',
        senseId: 'sense:study:1',
        ontologyTypes: ['ontology:Study']
      },
      {
        role: 'PATIENT',
        surfaceSpanId: 'span:source-a:r1:26-48',
        entityId: 'entity:effect-b',
        senseId: 'sense:effect:1',
        ontologyTypes: ['ontology:Effect', 'ontology:ObservedOutcome']
      }
    ],
    quantifier: 'ONE',
    polarity: 'POSITIVE',
    modality: 'REPORTED',
    qualifiers: {
      population: '\u0432\u0437\u0440\u043e\u0441\u043b\u044b\u0435',
      method: 'randomized-controlled-trial',
      condition: 'registered-protocol'
    },
    parserRef: { id: 'p78.parser.ru-controlled', version: '1.2.3' },
    resolutionStatus: 'RESOLVED'
  };
}

check('classic-global API is versioned, ready, and deeply frozen', () => {
  assert(Canonical && Canonical.version === '1.0.0', 'canonical JSON unavailable');
  assert(SearchContracts && SearchContracts.status === 'READY', 'search contracts unavailable');
  assert(ClaimIR && ClaimIR.status === 'READY', 'Claim IR unavailable');
  equal(ClaimIR.version, '1.0.0', 'Claim IR version changed');
  equal(ClaimIR.schema, 'meridian.claim-ast/1', 'Claim AST schema changed');
  assert(typeof ClaimIR.createClaimAst === 'function', 'createClaimAst missing');
  assert(typeof ClaimIR.validateClaimAst === 'function', 'validateClaimAst missing');
  equal(ClaimIR.epistemicScope, 'STRUCTURE_ONLY', 'epistemic scope changed');
  equal(ClaimIR.evidenceStatus, 'NOT_COMPUTED', 'evidence status changed');
  equal(ClaimIR.soundness, 'NOT_COMPUTED', 'soundness changed');
  assert(ClaimIR.semanticTruth === false, 'Claim IR asserts semantic truth');
  assert(deeplyFrozen(ClaimIR), 'Claim IR API is mutable');
  assert(deeplyFrozen(ClaimIR.reasonCodes) && deeplyFrozen(ClaimIR.qualifierFields), 'Claim IR constants are mutable');
});

check('creation emits the exact ClaimAst schema with independent content addressing', () => {
  const claim = ClaimIR.createClaimAst(draftClaim());
  const expectedKeys = [
    'arguments', 'claimAstId', 'contentHash', 'modality', 'parserRef', 'polarity',
    'predicate', 'qualifiers', 'quantifier', 'resolutionStatus', 'schema', 'sourceSpanIds'
  ];
  equal(Object.keys(claim).sort().join('|'), expectedKeys.sort().join('|'), 'Claim AST fields are not exact');
  equal(claim.schema, 'meridian.claim-ast/1', 'Claim AST schema changed');
  assert(/^claim-ast:[0-9a-f]{64}$/.test(claim.claimAstId), 'claimAstId format invalid');
  assert(/^sha256:[0-9a-f]{64}$/.test(claim.contentHash), 'contentHash format invalid');

  const identityBase = without(claim, 'claimAstId', 'contentHash');
  equal(claim.claimAstId, `claim-ast:${nodeHashCanonical(identityBase).slice(7)}`, 'claimAstId differs from node:crypto');
  equal(claim.contentHash, nodeHashCanonical(without(claim, 'contentHash')), 'contentHash differs from node:crypto');
  const report = ClaimIR.validateClaimAst(clone(claim));
  assert(report.status === 'VALID' && report.code === null && report.errors.length === 0, 'valid Claim AST rejected');
  assert(deeplyFrozen(report), 'valid report is mutable');
});

check('RESOLVED, AMBIGUOUS, and OOV remain explicit structural states', () => {
  const resolved = ClaimIR.createClaimAst(draftClaim());
  const ambiguousDraft = draftClaim();
  ambiguousDraft.predicate.senseId = null;
  ambiguousDraft.arguments[1].senseId = null;
  ambiguousDraft.resolutionStatus = 'AMBIGUOUS';
  const ambiguous = ClaimIR.createClaimAst(ambiguousDraft);
  const oovDraft = draftClaim();
  oovDraft.predicate.senseId = null;
  oovDraft.predicate.relationTypeId = null;
  oovDraft.arguments.forEach((argument) => {
    argument.entityId = null;
    argument.senseId = null;
    argument.ontologyTypes = [];
  });
  oovDraft.resolutionStatus = 'OOV';
  const oov = ClaimIR.createClaimAst(oovDraft);

  equal(resolved.resolutionStatus, 'RESOLVED', 'RESOLVED changed');
  equal(ambiguous.resolutionStatus, 'AMBIGUOUS', 'AMBIGUOUS changed');
  equal(oov.resolutionStatus, 'OOV', 'OOV changed');
  assert(new Set([resolved.claimAstId, ambiguous.claimAstId, oov.claimAstId]).size === 3, 'resolution state missing from identity');
  [resolved, ambiguous, oov].forEach((claim) => {
    assert(ClaimIR.validateClaimAst(claim).status === 'VALID', `${claim.resolutionStatus} rejected`);
    assert(!Object.prototype.hasOwnProperty.call(claim, 'evidence'), 'Claim AST contains evidence');
    assert(!Object.prototype.hasOwnProperty.call(claim, 'semanticTruth'), 'Claim AST contains truth');
  });
});

check('creation returns an immutable detached graph', () => {
  const draft = draftClaim();
  const before = clone(draft);
  const claim = ClaimIR.createClaimAst(draft);
  draft.sourceSpanIds[0] = 'span:mutated';
  draft.predicate.lemma = 'mutated';
  draft.arguments[0].ontologyTypes[0] = 'ontology:Mutated';
  draft.qualifiers.population = 'mutated';
  draft.parserRef.version = '9.9.9';

  equal(claim.sourceSpanIds[0], before.sourceSpanIds[0], 'source span aliases draft');
  equal(claim.predicate.lemma, before.predicate.lemma, 'predicate aliases draft');
  equal(claim.arguments[0].ontologyTypes[0], before.arguments[0].ontologyTypes[0], 'argument aliases draft');
  equal(claim.qualifiers.population, before.qualifiers.population, 'qualifiers alias draft');
  equal(claim.parserRef.version, before.parserRef.version, 'parserRef aliases draft');
  assert(deeplyFrozen(claim), 'Claim AST is not deeply frozen');
});

check('top-level and nested fields are strictly closed', () => {
  const top = draftClaim();
  top.confidence = 0.9;
  expectCode(() => ClaimIR.createClaimAst(top), 'UNKNOWN_FIELD', 'unknown top-level field accepted');

  const predicate = draftClaim();
  predicate.predicate.confidence = 'high';
  expectCode(() => ClaimIR.createClaimAst(predicate), 'UNKNOWN_FIELD', 'unknown predicate field accepted');

  const argument = draftClaim();
  argument.arguments[0].confidence = 'high';
  expectCode(() => ClaimIR.createClaimAst(argument), 'UNKNOWN_FIELD', 'unknown argument field accepted');

  const qualifier = draftClaim();
  qualifier.qualifiers.confidence = 'high';
  expectCode(() => ClaimIR.createClaimAst(qualifier), 'UNKNOWN_FIELD', 'unknown qualifier field accepted');

  const parser = draftClaim();
  parser.parserRef.provider = 'external';
  expectCode(() => ClaimIR.createClaimAst(parser), 'UNKNOWN_FIELD', 'unknown parserRef field accepted');

  const computed = draftClaim();
  computed.claimAstId = ZERO_CLAIM_ID;
  expectCode(() => ClaimIR.createClaimAst(computed), 'UNKNOWN_FIELD', 'caller supplied claimAstId accepted');
});

check('evidence and semantic-truth fields are explicitly forbidden', () => {
  const evidence = draftClaim();
  evidence.evidence = ['span:evidence'];
  expectCode(() => ClaimIR.createClaimAst(evidence), 'EVIDENCE_FIELD_FORBIDDEN', 'evidence accepted');

  const truth = draftClaim();
  truth.semanticTruth = true;
  expectCode(() => ClaimIR.createClaimAst(truth), 'SEMANTIC_TRUTH_FIELD_FORBIDDEN', 'semantic truth accepted');

  const finalEvidence = clone(ClaimIR.createClaimAst(draftClaim()));
  finalEvidence.evidenceStatus = 'SUPPORTED';
  expectInvalid(finalEvidence, 'EVIDENCE_FIELD_FORBIDDEN', 'evidence-bearing final Claim AST accepted');

  const finalTruth = clone(ClaimIR.createClaimAst(draftClaim()));
  finalTruth.truth = true;
  expectInvalid(finalTruth, 'SEMANTIC_TRUTH_FIELD_FORBIDDEN', 'truth-bearing final Claim AST accepted');
});

check('invalid enum values and incomplete records fail with explicit reasons', () => {
  [
    ['quantifier', 'EACH'],
    ['polarity', 'UNKNOWN'],
    ['modality', 'CERTAIN'],
    ['resolutionStatus', 'PARTIAL']
  ].forEach(([field, value]) => {
    const draft = draftClaim();
    draft[field] = value;
    expectCode(() => ClaimIR.createClaimAst(draft), 'INVALID_ENUM', `${field} enum accepted`);
  });

  const missing = draftClaim();
  delete missing.predicate.senseId;
  expectCode(() => ClaimIR.createClaimAst(missing), 'REQUIRED_FIELD_MISSING', 'missing nullable field accepted');

  const parserVersion = draftClaim();
  parserVersion.parserRef.version = 'latest';
  expectCode(() => ClaimIR.createClaimAst(parserVersion), 'INVALID_SEMVER', 'invalid parser version accepted');

  const whitespace = draftClaim();
  whitespace.predicate.lemma = ' confirm ';
  expectCode(() => ClaimIR.createClaimAst(whitespace), 'INVALID_VALUE', 'untrimmed lemma accepted');

  const emptySpans = draftClaim();
  emptySpans.sourceSpanIds = [];
  expectCode(() => ClaimIR.createClaimAst(emptySpans), 'INVALID_VALUE', 'empty source spans accepted');

  const emptyArguments = draftClaim();
  emptyArguments.arguments = [];
  expectCode(() => ClaimIR.createClaimAst(emptyArguments), 'INVALID_VALUE', 'empty arguments accepted');
});

check('unsafe duplicate spans, roles, and ontology types are rejected separately', () => {
  const sourceSpans = draftClaim();
  sourceSpans.sourceSpanIds.push(sourceSpans.sourceSpanIds[0]);
  expectCode(() => ClaimIR.createClaimAst(sourceSpans), 'DUPLICATE_SOURCE_SPAN', 'duplicate source span accepted');

  const roles = draftClaim();
  roles.arguments[1].role = roles.arguments[0].role;
  expectCode(() => ClaimIR.createClaimAst(roles), 'DUPLICATE_ARGUMENT_ROLE', 'duplicate argument role accepted');

  const argumentSpans = draftClaim();
  argumentSpans.arguments[1].surfaceSpanId = argumentSpans.arguments[0].surfaceSpanId;
  expectCode(() => ClaimIR.createClaimAst(argumentSpans), 'DUPLICATE_ARGUMENT_SPAN', 'duplicate argument span accepted');

  const ontologyTypes = draftClaim();
  ontologyTypes.arguments[0].ontologyTypes.push(ontologyTypes.arguments[0].ontologyTypes[0]);
  expectCode(() => ClaimIR.createClaimAst(ontologyTypes), 'DUPLICATE_ONTOLOGY_TYPE', 'duplicate ontology type accepted');
});

check('corruption of identity, content, schema, or fields fails closed', () => {
  const claim = ClaimIR.createClaimAst(draftClaim());

  const body = clone(claim);
  body.polarity = 'NEGATIVE';
  expectInvalid(body, 'CLAIM_ID_MISMATCH', 'body corruption accepted');

  const identity = clone(claim);
  identity.claimAstId = ZERO_CLAIM_ID;
  expectInvalid(identity, 'CLAIM_ID_MISMATCH', 'identity corruption accepted');

  const hash = clone(claim);
  hash.contentHash = ZERO_HASH;
  expectInvalid(hash, 'CONTENT_HASH_MISMATCH', 'content hash corruption accepted');

  const malformedHash = clone(claim);
  malformedHash.contentHash = 'sha256:nope';
  expectInvalid(malformedHash, 'INVALID_HASH', 'malformed hash accepted');

  const schema = clone(claim);
  schema.schema = 'meridian.claim-ast/2';
  expectInvalid(schema, 'INVALID_SCHEMA', 'wrong schema accepted');

  const unknown = clone(claim);
  unknown.extra = true;
  expectInvalid(unknown, 'UNKNOWN_FIELD', 'unknown final field accepted');
});

check('cycles and non-JSON structures produce stable reason codes', () => {
  const cyclic = draftClaim();
  cyclic.qualifiers.self = cyclic;
  expectCode(() => ClaimIR.createClaimAst(cyclic), 'CYCLE_DETECTED', 'cycle accepted');

  const sparse = draftClaim();
  sparse.arguments.length = 3;
  expectCode(() => ClaimIR.createClaimAst(sparse), 'SPARSE_ARRAY', 'sparse array accepted');

  const nonFinite = draftClaim();
  nonFinite.qualifiers.measure = Infinity;
  expectCode(() => ClaimIR.createClaimAst(nonFinite), 'NON_FINITE_NUMBER', 'non-finite value accepted');

  const cyclicFinal = clone(ClaimIR.createClaimAst(draftClaim()));
  cyclicFinal.qualifiers.self = cyclicFinal;
  expectInvalid(cyclicFinal, 'CYCLE_DETECTED', 'cyclic final Claim AST accepted');
});

check('replay is exact and independent of object key insertion order', () => {
  const draft = draftClaim();
  const before = JSON.stringify(draft);
  const first = ClaimIR.createClaimAst(draft);
  const serialized = JSON.stringify(first);
  for (let index = 0; index < 10; index += 1) {
    equal(JSON.stringify(ClaimIR.createClaimAst(draft)), serialized, `replay ${index + 1} changed`);
  }
  equal(JSON.stringify(draft), before, 'creation mutated its input');

  const reordered = {
    resolutionStatus: draft.resolutionStatus,
    parserRef: { version: draft.parserRef.version, id: draft.parserRef.id },
    qualifiers: {
      condition: draft.qualifiers.condition,
      method: draft.qualifiers.method,
      population: draft.qualifiers.population
    },
    modality: draft.modality,
    polarity: draft.polarity,
    quantifier: draft.quantifier,
    arguments: draft.arguments.map((argument) => ({
      ontologyTypes: argument.ontologyTypes,
      senseId: argument.senseId,
      entityId: argument.entityId,
      surfaceSpanId: argument.surfaceSpanId,
      role: argument.role
    })),
    predicate: {
      relationTypeId: draft.predicate.relationTypeId,
      senseId: draft.predicate.senseId,
      lemma: draft.predicate.lemma
    },
    sourceSpanIds: draft.sourceSpanIds
  };
  const reorderedClaim = ClaimIR.createClaimAst(reordered);
  equal(reorderedClaim.claimAstId, first.claimAstId, 'key insertion order changed claimAstId');
  equal(reorderedClaim.contentHash, first.contentHash, 'key insertion order changed contentHash');
  same(reorderedClaim, first, 'key insertion order changed Claim AST data');
});

check('validation is non-mutating and reports precise paths', () => {
  const claim = clone(ClaimIR.createClaimAst(draftClaim()));
  claim.arguments[0].ontologyTypes.push(claim.arguments[0].ontologyTypes[0]);
  const before = JSON.stringify(claim);
  const report = ClaimIR.validateClaimAst(claim);
  equal(report.status, 'INVALID', 'invalid claim reported valid');
  equal(report.code, 'DUPLICATE_ONTOLOGY_TYPE', 'wrong validation reason');
  equal(report.errors[0].path, '$.arguments[0].ontologyTypes[1]', 'wrong validation path');
  equal(JSON.stringify(claim), before, 'validation mutated input');
});

check('source is host-free and behavior replays in fresh VM globals', () => {
  const source = fs.readFileSync(claimIrPath, 'utf8');
  const forbidden = [
    /\bdocument\b/, /\bwindow\b/, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b/,
    /https?:\/\//i, /\beval\s*\(/, /\bnew\s+Function\b/, /\bDate\b/, /\bperformance\b/,
    /Math\.random\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/,
    /\bmodule\.exports\b/, /\brequire\s*\(/, /\bimport\s*\(/, /\bexport\s+/
  ];
  forbidden.forEach((pattern) => assert(!pattern.test(source), `forbidden source pattern ${pattern}`));
  assert(source.startsWith('(function(global){'), 'classic IIFE wrapper missing');
  assert(/typeof globalThis/.test(source), 'globalThis fallback missing');

  const sandbox = {};
  vm.createContext(sandbox);
  sourcePaths.forEach((file) => vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: path.basename(file) }));
  const isolated = sandbox.MRDP78ClaimIR.createClaimAst(draftClaim());
  const local = ClaimIR.createClaimAst(draftClaim());
  equal(sandbox.MRDP78ClaimIR.status, 'READY', 'fresh VM API unavailable');
  equal(isolated.claimAstId, local.claimAstId, 'fresh VM claimAstId changed');
  equal(isolated.contentHash, local.contentHash, 'fresh VM contentHash changed');
  equal(JSON.stringify(isolated), JSON.stringify(local), 'fresh VM output changed');
  assert(sandbox.MRDP78ClaimIR.validateClaimAst(isolated).status === 'VALID', 'fresh VM validation failed');

  const blockedSandbox = {};
  vm.createContext(blockedSandbox);
  vm.runInContext(source, blockedSandbox, { filename: path.basename(claimIrPath) });
  assert(blockedSandbox.MRDP78ClaimIR.status === 'BLOCKED', 'missing canonical dependency did not block');
  equal(blockedSandbox.MRDP78ClaimIR.code, 'CANONICAL_JSON_UNAVAILABLE', 'wrong missing dependency reason');
  assert(blockedSandbox.MRDP78ClaimIR.semanticTruth === false, 'blocked API asserts truth');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? `\n${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
