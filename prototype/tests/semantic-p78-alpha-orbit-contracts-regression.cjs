'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
require(lib('p78-canonical-json'));
require(lib('p78-alpha-orbit-contracts'));

const Canonical = global.MRDP78CanonicalJSON;
const Orbit = global.MRDP78AlphaOrbitContracts;
const checks = [];
const VALIDATORS = ['alpha-structure@1.0.0', 'provenance@1.0.0'];

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

function hash(label) { return Canonical.hashText(label); }
function sorted(values) { return values.slice().sort(); }

function rawArtifact(kind, options = {}) {
  const tag = options.tag || kind.toLowerCase();
  const value = {
    alpha: Orbit.alphaForKind(kind),
    kind,
    title: options.title || `${kind} ${tag}`,
    body: options.body || `Bounded ${kind.toLowerCase()} artifact ${tag}.`,
    language: options.language || 'ru',
    claimRefs: options.claimRefs || [hash('claim:shared')],
    sourceRefs: options.sourceRefs || [hash('source:shared')],
    parentRefs: options.parentRefs || [],
    childRefs: options.childRefs || [],
    horizontalRefs: options.horizontalRefs || [],
    qualifiers: options.qualifiers || ['scope:bounded'],
    authority: options.authority || 'SOURCE_BACKED',
  };
  if (Object.hasOwn(options, 'alpha')) value.alpha = options.alpha;
  return value;
}

function artifact(kind, options) { return Orbit.createArtifact(rawArtifact(kind, options)); }

function transitionInput(before, operation, overrides = {}) {
  const relation = {
    GENERALIZE: 'GENERALIZES', SPECIALIZE: 'SPECIALIZES', BRIDGE: null,
    LINK: 'ASSOCIATES', ORBIT: 'QUALIFIES', PARK: null, ROLLBACK: null, ABSTAIN: null,
  }[operation];
  const needsCoverage = ['GENERALIZE', 'SPECIALIZE', 'ORBIT', 'BRIDGE'].includes(operation);
  return {
    operation,
    relation,
    coverageRefs: needsCoverage ? before.claimRefs : [],
    witnesses: [],
    reasonCodes: [],
    validatorVersions: VALIDATORS,
    priorReceiptRef: null,
    ...overrides,
  };
}

function independentHash(value) {
  return `sha256:${crypto.createHash('sha256').update(Canonical.canonicalize(value), 'utf8').digest('hex')}`;
}

function rehashReceipt(value) {
  delete value.receiptId;
  delete value.contentHash;
  value.receiptId = Canonical.hashCanonical(value);
  value.contentHash = Canonical.hashCanonical(value);
  return value;
}

check('API exposes exactly nine immutable alpha levels and no semantic authority', () => {
  assert.equal(Orbit.status, 'READY');
  assert.equal(Orbit.version, '1.0.0');
  assert.equal(Orbit.levels.length, 9);
  assert.deepEqual(Orbit.levels.map((item) => item.alpha), [4, 3, 2, 1, 0, -1, -2, -3, -4]);
  assert.deepEqual(Orbit.levels.map((item) => item.kind), [
    'ONTOLOGY', 'PHILOSOPHY', 'LAW', 'PRINCIPLE', 'CONCEPT',
    'SPECIFICATION', 'TEMPLATE', 'EXAMPLE', 'CODE',
  ]);
  assert(Object.isFrozen(Orbit) && Object.isFrozen(Orbit.levels) && Object.isFrozen(Orbit.levels[0]));
  assert.equal(Orbit.semanticTruth, false);
  assert.equal(Orbit.soundness, 'NOT_COMPUTED');
  assert.equal(Orbit.commitAllowed, false);
});

check('kind and alpha mappings are bijective and reject values outside the nine lanes', () => {
  for (const level of Orbit.levels) {
    assert.equal(Orbit.kindForAlpha(level.alpha), level.kind);
    assert.equal(Orbit.alphaForKind(level.kind), level.alpha);
  }
  assert.throws(() => Orbit.kindForAlpha(5), /ALPHA_OUT_OF_RANGE/);
  assert.throws(() => Orbit.alphaForKind('CENTER_3D'), /ENUM_VALUE_INVALID/);
  assert(!Orbit.operations.includes('COMMIT'));
});

check('radius mapping keeps all alpha lanes inside one explicit safe annulus', () => {
  assert.equal(Orbit.radiusForAlpha(4, 20, 100), 20);
  assert.equal(Orbit.radiusForAlpha(0, 20, 100), 60);
  assert.equal(Orbit.radiusForAlpha(-4, 20, 100), 100);
  const radii = Orbit.levels.map((level) => Orbit.radiusForAlpha(level.alpha, 20, 100));
  assert(radii.every((value, index) => index === 0 || value > radii[index - 1]));
  assert.equal(Orbit.alphaForRadius(20, 20, 100), 4);
  assert.equal(Orbit.alphaForRadius(60, 20, 100), 0);
  assert.equal(Orbit.alphaForRadius(100, 20, 100), -4);
  assert.throws(() => Orbit.alphaForRadius(101, 20, 100), /RADIUS_OUTSIDE_SAFE_ANNULUS/);
  assert.throws(() => Orbit.radiusForAlpha(0, 20, 20), /SAFE_ANNULUS_INVALID/);
});

check('artifacts are deterministic, content-addressed and deeply frozen', () => {
  const input = rawArtifact('CONCEPT', { tag: 'ring' });
  const first = Orbit.createArtifact(input);
  const second = Orbit.createArtifact({
    authority: input.authority,
    qualifiers: input.qualifiers,
    horizontalRefs: input.horizontalRefs,
    childRefs: input.childRefs,
    parentRefs: input.parentRefs,
    sourceRefs: input.sourceRefs,
    claimRefs: input.claimRefs,
    language: input.language,
    body: input.body,
    title: input.title,
    kind: input.kind,
    alpha: input.alpha,
  });
  assert.equal(first.artifactId, second.artifactId);
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(Orbit.validateArtifact(first).status, 'VALID');
  assert(Object.isFrozen(first) && Object.isFrozen(first.claimRefs));
  const payload = Canonical.deepCopy(first);
  delete payload.contentHash;
  assert.equal(first.contentHash, independentHash(payload));
});

check('artifact contracts reject alpha mismatch, unsourced authority and unordered references', () => {
  assert.throws(() => Orbit.createArtifact(rawArtifact('CONCEPT', { alpha: 1 })), /ALPHA_KIND_MISMATCH/);
  assert.throws(() => Orbit.createArtifact(rawArtifact('LAW', {
    sourceRefs: [], authority: 'SOURCE_BACKED',
  })), /SOURCE_BACKED_REFS_REQUIRED/);
  assert.throws(() => Orbit.createArtifact(rawArtifact('LAW', {
    sourceRefs: sorted([hash('source:b'), hash('source:a')]).reverse(),
  })), /ARRAY_NOT_SORTED_UNIQUE/);
  assert.throws(() => Orbit.createArtifact({ ...rawArtifact('LAW'), truth: true }), /AUTHORITY_FIELD_FORBIDDEN/);
});

check('hidden, symbolic and accessor data cannot disappear during artifact hashing', () => {
  const hidden = rawArtifact('PRINCIPLE');
  Object.defineProperty(hidden, 'accepted', { value: true, enumerable: false });
  assert.throws(() => Orbit.createArtifact(hidden), /NON_ENUMERABLE_FIELD_FORBIDDEN/);
  const symbolic = rawArtifact('PRINCIPLE');
  symbolic[Symbol('truth')] = true;
  assert.throws(() => Orbit.createArtifact(symbolic), /SYMBOL_FIELD_FORBIDDEN/);
  const accessor = rawArtifact('PRINCIPLE');
  Object.defineProperty(accessor, 'title', { enumerable: true, get() { return 'hidden'; } });
  assert.throws(() => Orbit.createArtifact(accessor), /ACCESSOR_FORBIDDEN/);
  const arrayField = rawArtifact('PRINCIPLE');
  Object.defineProperty(arrayField.sourceRefs, 'accepted', { value: true, enumerable: false });
  assert.throws(() => Orbit.createArtifact(arrayField), /ARRAY_PROPERTY_FORBIDDEN/);
});

check('golden chain specializes through all nine lanes without touching either spatial pole', () => {
  const artifacts = Orbit.levels.map((level) => artifact(level.kind, { tag: `golden-${level.alpha}` }));
  const receipts = [];
  for (let index = 0; index < artifacts.length - 1; index += 1) {
    const before = artifacts[index];
    const after = artifacts[index + 1];
    receipts.push(Orbit.createTransitionReceipt(
      before,
      after,
      transitionInput(before, 'SPECIALIZE'),
    ));
  }
  assert.equal(receipts.length, 8);
  assert(receipts.every((receipt) => receipt.status === 'READY' && receipt.semanticTruth === false));
  assert.deepEqual(receipts.map((receipt) => receipt.afterRef.alpha), [3, 2, 1, 0, -1, -2, -3, -4]);
  assert(receipts.every((receipt) => Orbit.validateTransitionReceipt(receipt).status === 'VALID'));
});

check('ordinary generalization moves exactly one lane inward with preserved provenance', () => {
  const before = artifact('CONCEPT', { tag: 'generalize-before' });
  const after = artifact('PRINCIPLE', { tag: 'generalize-after' });
  const receipt = Orbit.createTransitionReceipt(before, after, transitionInput(before, 'GENERALIZE'));
  assert.equal(receipt.operation, 'GENERALIZE');
  assert.equal(receipt.beforeRef.alpha, 0);
  assert.equal(receipt.afterRef.alpha, 1);
  assert.equal(receipt.relation, 'GENERALIZES');
  assert.equal(receipt.authority, 'STRUCTURAL_ONLY');
  assert.equal(receipt.commitAllowed, false);
  assert.equal(Orbit.validateTransitionReceiptAgainst(receipt, before, after).status, 'VALID');
});

check('ordinary specialization moves exactly one lane outward with preserved provenance', () => {
  const before = artifact('CONCEPT', { tag: 'specialize-before' });
  const after = artifact('SPECIFICATION', { tag: 'specialize-after' });
  const receipt = Orbit.createTransitionReceipt(before, after, transitionInput(before, 'SPECIALIZE'));
  assert.equal(receipt.operation, 'SPECIALIZE');
  assert.equal(receipt.beforeRef.alpha, 0);
  assert.equal(receipt.afterRef.alpha, -1);
  assert.equal(receipt.relation, 'SPECIALIZES');
  assert.equal(Orbit.validateTransitionReceiptAgainst(receipt, before, after).status, 'VALID');
});

check('inner and outer guards block radial travel beyond useful ontology and code', () => {
  const ontology = artifact('ONTOLOGY', { tag: 'inner-edge' });
  const changedOntology = artifact('ONTOLOGY', { tag: 'inner-edge-changed' });
  const code = artifact('CODE', { tag: 'outer-edge' });
  const changedCode = artifact('CODE', { tag: 'outer-edge-changed' });
  assert.throws(() => Orbit.createTransitionReceipt(
    ontology, changedOntology, transitionInput(ontology, 'GENERALIZE'),
  ), /INNER_GUARD_REACHED/);
  assert.throws(() => Orbit.createTransitionReceipt(
    code, changedCode, transitionInput(code, 'SPECIALIZE'),
  ), /OUTER_GUARD_REACHED/);
});

check('radial operations fail closed on coverage, source, qualifier or authority loss', () => {
  const sources = sorted([hash('source:shared'), hash('source:extra')]);
  const qualifiers = ['condition:n<100', 'scope:bounded'];
  const before = artifact('CONCEPT', { tag: 'preservation', sourceRefs: sources, qualifiers });
  const safe = artifact('PRINCIPLE', { tag: 'preservation-safe', sourceRefs: sources, qualifiers });
  assert.throws(() => Orbit.createTransitionReceipt(
    before, safe, transitionInput(before, 'GENERALIZE', { coverageRefs: [] }),
  ), /CLAIM_COVERAGE_INCOMPLETE/);
  const claimLoss = artifact('PRINCIPLE', {
    tag: 'claim-loss', claimRefs: [], sourceRefs: sources, qualifiers, authority: 'DRAFT',
  });
  assert.throws(() => Orbit.createTransitionReceipt(
    before, claimLoss, transitionInput(before, 'GENERALIZE'),
  ), /CLAIM_REFERENCE_LOSS/);
  const sourceLoss = artifact('PRINCIPLE', { tag: 'source-loss', qualifiers });
  assert.throws(() => Orbit.createTransitionReceipt(
    before, sourceLoss, transitionInput(before, 'GENERALIZE'),
  ), /SOURCE_PROVENANCE_LOSS/);
  const qualifierLoss = artifact('PRINCIPLE', { tag: 'qualifier-loss', sourceRefs: sources });
  assert.throws(() => Orbit.createTransitionReceipt(
    before, qualifierLoss, transitionInput(before, 'GENERALIZE'),
  ), /QUALIFIER_LOSS/);
  const draft = artifact('CONCEPT', { tag: 'draft', authority: 'DRAFT', sourceRefs: [] });
  const elevated = artifact('PRINCIPLE', { tag: 'elevated' });
  assert.throws(() => Orbit.createTransitionReceipt(
    draft, elevated, transitionInput(draft, 'GENERALIZE'),
  ), /AUTHORITY_ESCALATION_FORBIDDEN/);
});

check('typed edges distinguish adjacent radial, implementation and same-alpha relations', () => {
  const example = artifact('EXAMPLE', { tag: 'edge-example' });
  const template = artifact('TEMPLATE', { tag: 'edge-template' });
  const code = artifact('CODE', { tag: 'edge-code' });
  const specification = artifact('SPECIFICATION', { tag: 'edge-spec' });
  const conceptA = artifact('CONCEPT', { tag: 'edge-concept-a' });
  const conceptB = artifact('CONCEPT', { tag: 'edge-concept-b' });
  const generalizes = Orbit.createEdge(example, template, {
    relation: 'GENERALIZES', sourceRefs: [], status: 'PROPOSED',
  });
  const implementsEdge = Orbit.createEdge(code, specification, {
    relation: 'IMPLEMENTS', sourceRefs: [], status: 'PROPOSED',
  });
  const horizontal = Orbit.createEdge(conceptA, conceptB, {
    relation: 'SUPPORTS', sourceRefs: [hash('source:shared')], status: 'REVIEWED',
  });
  assert.equal(Orbit.validateEdgeAgainst(generalizes, example, template).status, 'VALID');
  assert.equal(Orbit.validateEdgeAgainst(implementsEdge, code, specification).status, 'VALID');
  assert.equal(Orbit.validateEdgeAgainst(horizontal, conceptA, conceptB).status, 'VALID');
  assert.throws(() => Orbit.createEdge(example, template, {
    relation: 'SUPPORTS', sourceRefs: [], status: 'PROPOSED',
  }), /HORIZONTAL_ALPHA_MISMATCH/);
  assert.throws(() => Orbit.createEdge(conceptA, conceptB, {
    relation: 'SUPPORTS', sourceRefs: [], status: 'REVIEWED',
  }), /REVIEWED_EDGE_SOURCE_REQUIRED/);
});

check('LINK creates same-alpha progress only with a typed relation and witness', () => {
  const left = artifact('CONCEPT', { tag: 'link-left' });
  const right = artifact('CONCEPT', { tag: 'link-right' });
  const input = transitionInput(left, 'LINK', {
    relation: 'ASSOCIATES',
    witnesses: [{ alpha: 0, artifactRef: hash('witness:link') }],
  });
  const receipt = Orbit.createTransitionReceipt(left, right, input);
  assert.equal(receipt.beforeRef.alpha, receipt.afterRef.alpha);
  assert.equal(receipt.status, 'READY');
  assert.equal(Orbit.validateTransitionReceipt(receipt).status, 'VALID');
  assert.throws(() => Orbit.createTransitionReceipt(
    left, right, transitionInput(left, 'LINK'),
  ), /LINK_WITNESS_REQUIRED/);
  assert.throws(() => Orbit.createTransitionReceipt(
    left, right, transitionInput(left, 'LINK', {
      relation: 'ASSOCIATES', witnesses: [{ alpha: 4, artifactRef: hash('witness:wrong-alpha') }],
    }),
  ), /LINK_WITNESS_ALPHA_MISMATCH/);
  assert.throws(() => Orbit.createTransitionReceipt(
    left, artifact('PRINCIPLE', { tag: 'link-cross-level' }), input,
  ), /HORIZONTAL_ALPHA_MISMATCH/);
});

check('ORBIT requires a changed artifact while preserving its lane and provenance', () => {
  const before = artifact('CONCEPT', { tag: 'orbit-before' });
  const after = artifact('CONCEPT', { tag: 'orbit-after' });
  const receipt = Orbit.createTransitionReceipt(before, after, transitionInput(before, 'ORBIT'));
  assert.equal(receipt.beforeRef.alpha, 0);
  assert.equal(receipt.afterRef.alpha, 0);
  assert.notEqual(receipt.beforeRef.artifactId, receipt.afterRef.artifactId);
  assert.throws(() => Orbit.createTransitionReceipt(
    before, before, transitionInput(before, 'ORBIT'),
  ), /ORBIT_PROGRESS_REQUIRED/);
});

check('BRIDGE requires one witness for every skipped alpha lane in either direction', () => {
  const concept = artifact('CONCEPT', { tag: 'bridge-concept' });
  const philosophy = artifact('PHILOSOPHY', { tag: 'bridge-philosophy' });
  const witnesses = [
    { alpha: 1, artifactRef: hash('witness:principle') },
    { alpha: 2, artifactRef: hash('witness:law') },
  ];
  const inward = Orbit.createTransitionReceipt(concept, philosophy, transitionInput(concept, 'BRIDGE', {
    relation: 'GENERALIZES', witnesses,
  }));
  const outward = Orbit.createTransitionReceipt(philosophy, concept, transitionInput(philosophy, 'BRIDGE', {
    relation: 'SPECIALIZES', witnesses,
  }));
  assert.deepEqual(inward.witnesses.map((item) => item.alpha), [1, 2]);
  assert.deepEqual(outward.witnesses.map((item) => item.alpha), [1, 2]);
  assert.throws(() => Orbit.createTransitionReceipt(concept, philosophy, transitionInput(concept, 'BRIDGE', {
    relation: 'GENERALIZES', witnesses: witnesses.slice(0, 1),
  })), /BRIDGE_WITNESS_CHAIN_INCOMPLETE/);
  assert.throws(() => Orbit.createTransitionReceipt(concept, philosophy, transitionInput(concept, 'BRIDGE', {
    relation: 'SPECIALIZES', witnesses,
  })), /TRANSITION_RELATION_INVALID/);
});

check('PARK, ABSTAIN and ROLLBACK carry explicit non-ready reasons', () => {
  const current = artifact('CONCEPT', { tag: 'disposition-current' });
  const prior = artifact('SPECIFICATION', { tag: 'disposition-prior' });
  const park = Orbit.createTransitionReceipt(current, null, transitionInput(current, 'PARK', {
    reasonCodes: ['HUMAN_REVIEW_REQUIRED'],
  }));
  const abstain = Orbit.createTransitionReceipt(current, null, transitionInput(current, 'ABSTAIN', {
    reasonCodes: ['SOURCE_EVIDENCE_MISSING'],
  }));
  const rollback = Orbit.createTransitionReceipt(current, prior, transitionInput(current, 'ROLLBACK', {
    reasonCodes: ['RESTORED_PRIOR_STATE'],
    priorReceiptRef: hash('receipt:prior'),
  }));
  assert.deepEqual([park.status, abstain.status, rollback.status], ['PARKED', 'ABSTAIN', 'ROLLED_BACK']);
  assert.throws(() => Orbit.createTransitionReceipt(
    current, null, transitionInput(current, 'PARK'),
  ), /REASON_CODE_REQUIRED/);
  assert.throws(() => Orbit.createTransitionReceipt(current, prior, transitionInput(current, 'ROLLBACK', {
    reasonCodes: ['RESTORED_PRIOR_STATE'],
  })), /PRIOR_RECEIPT_REQUIRED/);
});

check('content corruption and rehashed structural forgery are both rejected', () => {
  const before = artifact('CONCEPT', { tag: 'tamper-before' });
  const after = artifact('PRINCIPLE', { tag: 'tamper-after' });
  const receipt = Orbit.createTransitionReceipt(before, after, transitionInput(before, 'GENERALIZE'));
  const corruptArtifact = Canonical.deepCopy(before);
  corruptArtifact.body = 'Changed without identity update.';
  assert.notEqual(Orbit.validateArtifact(corruptArtifact).status, 'VALID');
  const corruptReceipt = Canonical.deepCopy(receipt);
  corruptReceipt.status = 'ABSTAIN';
  assert.equal(Orbit.validateTransitionReceipt(corruptReceipt).status, 'INVALID');
  const forged = Canonical.deepCopy(receipt);
  forged.relation = 'SPECIALIZES';
  rehashReceipt(forged);
  assert.equal(Orbit.validateTransitionReceipt(forged).code, 'TRANSITION_RELATION_INVALID');
  assert.equal(Orbit.validateTransitionReceiptAgainst(receipt, before, artifact('PRINCIPLE', { tag: 'other' })).status, 'INVALID');
});

check('fresh VM replay is deterministic and dependency failure is explicit', () => {
  const source = fs.readFileSync(lib('p78-alpha-orbit-contracts'), 'utf8');
  const blocked = { console };
  blocked.globalThis = blocked;
  vm.createContext(blocked);
  vm.runInContext(source, blocked);
  assert.equal(blocked.MRDP78AlphaOrbitContracts.status, 'BLOCKED');
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(lib('p78-canonical-json'), 'utf8'), sandbox);
  vm.runInContext(source, sandbox);
  const api = sandbox.MRDP78AlphaOrbitContracts;
  assert.equal(api.status, 'READY');
  assert.equal(api.kindForAlpha(0), 'CONCEPT');
  assert.equal(api.radiusForAlpha(0, 20, 100), 60);
});

check('core module has no DOM, network, clock, randomness, evaluator or commit path', () => {
  const source = fs.readFileSync(lib('p78-alpha-orbit-contracts'), 'utf8');
  [
    'document', 'Date.now', 'Math.random', 'fetch(', 'XMLHttpRequest',
    'eval(', 'new Function', 'requestAnimationFrame', 'commitAllowed:true',
  ].forEach((term) => assert(!source.includes(term), `${term} must be absent`));
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
