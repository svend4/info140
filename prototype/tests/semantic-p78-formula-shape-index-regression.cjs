'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const canonicalPath = path.join(root, 'lib', 'p78-canonical-json.js');
const registryPath = path.join(root, 'lib', 'p78-formula-registry.js');
const enginePath = path.join(root, 'lib', 'p78-formula-engine.js');
const shapePath = path.join(root, 'lib', 'p78-formula-shape-index.js');
const matcherPath = path.join(root, 'lib', 'p78-formula-structural-matcher.js');
const sourcePaths = [canonicalPath, registryPath, enginePath, shapePath, matcherPath];
const newLibraryPaths = [shapePath, matcherPath];

sourcePaths.forEach((file) => require(file));

const Canonical = global.MRDP78CanonicalJSON;
const Registry = global.MRDP78FormulaRegistry;
const Engine = global.MRDP78FormulaEngine;
const Shape = global.MRDP78FormulaShapeIndex;
const Matcher = global.MRDP78FormulaStructuralMatcher;
const ZERO_HASH = `sha256:${'0'.repeat(64)}`;
const checks = [];

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

function sorted(values) {
  return values.slice().sort();
}

function hitIds(result) {
  return result.hits.map((hit) => hit.formulaRef.formulaId);
}

function matchIds(result) {
  return result.matches.map((match) => match.bindings.formulaId);
}

function pattern(patternId, constraints) {
  const compiled = Matcher.createPattern(patternId, constraints, '1.0.0');
  assert(compiled.status === 'READY', `${patternId}: ${compiled.status}/${compiled.code}`);
  return compiled.pattern;
}

function literalKind(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? 'NUMBER_INTEGER' : 'NUMBER_REAL';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'string') return 'STRING';
  throw new TypeError(`unsupported literal: ${typeof value}`);
}

function independentAstShape(expression) {
  const operationMultiset = {};
  const operationPaths = [];
  const literalKinds = [];

  function visit(node, nodePath) {
    if (node.node === 'Literal') {
      literalKinds.push(literalKind(node.value));
      return;
    }
    if (node.node === 'Input') return;
    if (node.node === 'Let') {
      visit(node.value, `${nodePath}.value`);
      visit(node.body, `${nodePath}.body`);
      return;
    }
    if (node.node === 'Call') {
      operationMultiset[node.operation] = (operationMultiset[node.operation] || 0) + 1;
      operationPaths.push(`${nodePath}:${node.operation}`);
      node.args.forEach((arg, index) => visit(arg, `${nodePath}.args[${index}]`));
      return;
    }
    if (node.node === 'Tuple') {
      node.items.forEach((item, index) => visit(item, `${nodePath}.items[${index}]`));
      return;
    }
    if (node.node === 'If') {
      visit(node.test, `${nodePath}.test`);
      visit(node.then, `${nodePath}.then`);
      visit(node.else, `${nodePath}.else`);
      return;
    }
    if (node.node === 'FormulaRef') {
      Object.keys(node.bindings).sort().forEach((key) => visit(node.bindings[key], `${nodePath}.bindings.${key}`));
      return;
    }
    throw new Error(`unknown AST node ${node.node}`);
  }

  visit(expression, '$.expression');
  return {
    operationMultiset,
    operationPaths: operationPaths.sort(),
    literalKinds: literalKinds.sort()
  };
}

function typeShape(port) {
  return {
    valueType: port.valueType,
    unit: port.unit,
    dimension: clone(port.dimension),
    measureKind: port.measureKind,
    interval: port.interval === null ? null : clone(port.interval)
  };
}

function expectedSignature(record) {
  const ast = independentAstShape(record.expression);
  const result = {
    schema: 'meridian.formula-shape/1',
    version: '1.0.0',
    formulaRef: { formulaId: record.formulaId, version: record.version, contentHash: record.contentHash },
    sourceHash: record.contentHash,
    rootNode: record.expression.node,
    operationMultiset: ast.operationMultiset,
    operationPaths: ast.operationPaths,
    inputTypes: record.inputs.map(typeShape),
    outputType: typeShape(record.output),
    dependencyRefs: record.dependencies.map((dependency) => clone(dependency.formula))
      .sort((left, right) => independentCanonical(left).localeCompare(independentCanonical(right))),
    literalKinds: ast.literalKinds,
    assumptions: (record.contract.pre || []).map(clone)
      .sort((left, right) => independentCanonical(left).localeCompare(independentCanonical(right)))
  };
  result.shapeHash = nodeHashCanonical(result);
  return result;
}

function rehashRecord(record) {
  record.contentHash = nodeHashCanonical(without(record, 'contentHash'));
  return record;
}

function registryEnvelope(records) {
  const envelope = { schema: 'meridian.formula-registry/1', version: '1.0.0', records };
  envelope.registryHash = nodeHashCanonical(envelope);
  return envelope;
}

function cycleRecord(id, target) {
  const record = clone(Registry.getFormula(Registry.registry, 'pressure.closure'));
  record.formulaId = id;
  record.title = id;
  record.expression = {
    node: 'FormulaRef',
    formulaId: target,
    version: '1.0.0',
    bindings: { x: { node: 'Input', port: 'x' }, y: { node: 'Input', port: 'y' } }
  };
  record.dependencies = [{
    kind: 'USES',
    formula: { formulaId: target, version: '1.0.0', contentHash: ZERO_HASH },
    bindings: { x: 'x', y: 'y' }
  }];
  record.implementation.maxOperations = 20;
  return rehashRecord(record);
}

check('versioned browser-global APIs are complete and deeply frozen', () => {
  assert(Canonical && Registry && Engine, 'P78 base APIs missing');
  assert(Shape && Shape.version === '1.0.0' && Shape.status === 'READY', 'shape API unavailable');
  assert(Matcher && Matcher.version === '1.0.0' && Matcher.status === 'READY', 'matcher API unavailable');
  equal(Shape.signatureSchema, 'meridian.formula-shape/1', 'signature schema changed');
  equal(Shape.schema, 'meridian.formula-shape-index/1', 'index schema changed');
  equal(Matcher.patternSchema, 'meridian.formula-pattern/1', 'pattern schema changed');
  equal(Matcher.schema, 'meridian.structural-match/1', 'match schema changed');
  ['createSignature', 'verifySignature', 'buildIndex', 'verifyIndex', 'compileQuery', 'search'].forEach((name) => {
    assert(typeof Shape[name] === 'function', `Shape.${name} missing`);
  });
  ['compilePattern', 'createPatternRegistry', 'verifyPatternRegistry', 'matchPattern', 'matchAll'].forEach((name) => {
    assert(typeof Matcher[name] === 'function', `Matcher.${name} missing`);
  });
  assert(deeplyFrozen(Shape) && deeplyFrozen(Matcher), 'public API is mutable');
  assert(deeplyFrozen(Shape.defaultIndex) && deeplyFrozen(Matcher.defaultPatternRegistry), 'default data is mutable');
});

check('all 11 formula signatures equal an independent AST-derived canonical shape', () => {
  const records = Registry.activeFormulas(Registry.registry);
  const expectedIds = [
    'pressure.closure', 'pressure.direction', 'pressure.edge', 'pressure.margin',
    'pressure.orbit-forward', 'pressure.orbit-reverse', 'pressure.orbit-total',
    'pressure.partition', 'ring.balance', 'vitality.snapshot-geomean', 'vitality.trajectory'
  ];
  equal(records.length, 11, 'active formula count changed');
  equal(Shape.signatures.length, 11, 'signature count changed');
  equal(Shape.defaultIndex.recordCount, 11, 'index record count changed');
  equal(Shape.signatures.map((item) => item.formulaRef.formulaId).join('|'), expectedIds.join('|'), 'signature order or inventory changed');

  records.forEach((record) => {
    const signature = Shape.signatures.find((item) => item.formulaRef.formulaId === record.formulaId);
    assert(signature, `${record.formulaId} signature missing`);
    same(signature, expectedSignature(record), `${record.formulaId} canonical shape differs`);
    equal(signature.shapeHash, nodeHashCanonical(without(signature, 'shapeHash')), `${record.formulaId} shapeHash differs from node:crypto`);
    assert(Shape.verifySignature(clone(signature)).status === 'READY', `${record.formulaId} signature replay failed`);
    assert(deeplyFrozen(signature), `${record.formulaId} signature is mutable`);
  });
});

check('source, registry, manifest, index, and pattern hashes are independently reproducible', () => {
  const registryPayload = without(Registry.registry, 'registryHash');
  equal(Registry.registryHash, nodeHashCanonical(registryPayload), 'registry hash differs from node:crypto');
  const sourceRefs = Shape.signatures.map((signature) => ({
    formulaRef: clone(signature.formulaRef),
    sourceHash: signature.sourceHash
  }));
  equal(Shape.sourceSetHash, nodeHashCanonical(sourceRefs), 'sourceSetHash differs from node:crypto');
  equal(Shape.defaultIndex.manifest.contentHash, nodeHashCanonical(without(Shape.defaultIndex.manifest, 'contentHash')), 'manifest hash differs');
  equal(Shape.indexHash, nodeHashCanonical(without(Shape.defaultIndex, 'indexHash')), 'index hash differs');
  equal(Shape.registryHash, Registry.registryHash, 'index is not pinned to registry');

  Matcher.patterns.forEach((item) => {
    equal(item.contentHash, nodeHashCanonical(without(item, 'contentHash')), `${item.patternId} hash differs`);
  });
  const patternRefs = Matcher.patterns.map((item) => ({
    patternId: item.patternId,
    version: item.version,
    contentHash: item.contentHash
  }));
  equal(Matcher.defaultPatternRegistry.sourceSetHash, nodeHashCanonical(patternRefs), 'pattern sourceSetHash differs');
  equal(Matcher.patternSetHash, nodeHashCanonical(without(Matcher.defaultPatternRegistry, 'patternSetHash')), 'patternSetHash differs');
  const verified = Matcher.verifyPatternRegistry(clone(Matcher.defaultPatternRegistry), Matcher.patternSetHash);
  assert(verified.status === 'READY' && verified.patternSetHash === Matcher.patternSetHash, 'pattern registry replay failed');
});

check('exact, operation, formulaId, type+unit, and dependency searches are deterministic', () => {
  const ring = Shape.signatures.find((item) => item.formulaRef.formulaId === 'ring.balance');
  const exact = Shape.findExact(ring.shapeHash);
  const operation = Shape.findByOperation('mul');
  const formulaId = Shape.findByFormulaId('mrd:formula:pressure.closure');
  const input = Shape.findByInputType('Real', '1', 'RingCoordinate');
  const output = Shape.findByOutputType('Real', '1', 'PolicyScore');
  const dependency = Shape.findByDependency('pressure.orbit-forward');
  const conjunction = Shape.search({ operation: 'add', outputType: { valueType: 'Real', unit: '1', measureKind: 'PureNumber' } });

  equal(exact.status, 'READY', 'exact search failed');
  same(hitIds(exact), ['ring.balance'], 'exact search result changed');
  same(hitIds(operation), sorted([
    'pressure.closure', 'pressure.edge', 'pressure.orbit-forward',
    'pressure.orbit-reverse', 'ring.balance', 'vitality.snapshot-geomean'
  ]), 'operation search result changed');
  same(hitIds(formulaId), ['pressure.closure'], 'formulaId normalization failed');
  same(hitIds(input), sorted([
    'pressure.closure', 'pressure.direction', 'pressure.edge', 'pressure.margin',
    'pressure.orbit-forward', 'pressure.orbit-reverse', 'pressure.orbit-total',
    'pressure.partition', 'ring.balance'
  ]), 'input type/unit search result changed');
  same(hitIds(output), ['vitality.snapshot-geomean', 'vitality.trajectory'], 'output type/unit search result changed');
  same(hitIds(dependency), ['pressure.direction', 'pressure.orbit-total', 'pressure.partition'], 'dependency search result changed');
  same(hitIds(conjunction), ['pressure.partition'], 'conjunctive search result changed');

  [exact, operation, formulaId, input, output, dependency, conjunction].forEach((result) => {
    assert(result.hits.every((hit) => hit.status === 'LOCATED'), 'search promoted a hit to a semantic match');
    result.hits.forEach((hit) => equal(hit.hitHash, nodeHashCanonical(without(hit, 'hitHash')), 'hit hash differs'));
    equal(result.trace.traceHash, nodeHashCanonical(without(result.trace, 'traceHash')), 'search trace hash differs');
    assert(result.semanticTruth === false && result.soundness === 'NOT_COMPUTED', 'search overstates evidence');
  });
});

check('closed queries fail or abstain explicitly', () => {
  const unknownField = Shape.compileQuery({ operation: 'mul', surprise: true });
  const nestedUnknown = Shape.compileQuery({ outputType: { valueType: 'Real', unit: '1', dimension: {} } });
  const unknownOperation = Shape.compileQuery({ operation: 'execute-arbitrary' });
  const unknownType = Shape.compileQuery({ outputType: { valueType: 'Complex', unit: '1' } });
  const badHash = Shape.compileQuery({ formulaId: 'ring.balance', queryHash: ZERO_HASH });
  const noFormula = Shape.findByFormulaId('not.present');
  const noUnit = Shape.findByOutputType('Real', 'kg');

  assert(unknownField.status === 'INVALID' && unknownField.code === 'UNKNOWN_QUERY_FIELD', `unknown query field: ${unknownField.code}`);
  assert(nestedUnknown.status === 'INVALID' && nestedUnknown.code === 'UNKNOWN_QUERY_FIELD', `nested query field: ${nestedUnknown.code}`);
  assert(unknownOperation.status === 'INVALID' && unknownOperation.code === 'UNKNOWN_OPERATION', `unknown operation: ${unknownOperation.code}`);
  assert(unknownType.status === 'INVALID' && unknownType.code === 'UNKNOWN_TYPE', `unknown type: ${unknownType.code}`);
  assert(badHash.status === 'INVALID' && badHash.code === 'QUERY_HASH_MISMATCH', `query hash: ${badHash.code}`);
  assert(noFormula.status === 'ABSTAIN' && noFormula.code === 'NO_MATCH' && noFormula.hits.length === 0, 'missing formula did not abstain');
  assert(noUnit.status === 'ABSTAIN' && noUnit.code === 'NO_MATCH' && noUnit.hits.length === 0, 'unit mismatch did not abstain');
});

check('structural matcher covers exact, operation, type+unit, dependency, and formulaId constraints', () => {
  const ring = Shape.signatures.find((item) => item.formulaRef.formulaId === 'ring.balance');
  const exactPattern = pattern('test.exact-ring', [{ kind: 'EXACT_SHAPE', shapeHash: ring.shapeHash }]);
  const operationPattern = pattern('test.operation-mul', [{ kind: 'OPERATION', operation: 'mul', minCount: 1 }]);
  const inputPattern = pattern('test.input-ring-coordinate', [{
    kind: 'INPUT_TYPE_UNIT', valueType: 'Real', unit: '1', measureKind: 'RingCoordinate', minCount: 2
  }]);
  const outputPattern = pattern('test.output-policy-score', [{
    kind: 'OUTPUT_TYPE_UNIT', valueType: 'Real', unit: '1', measureKind: 'PolicyScore'
  }]);
  const dependencyPattern = pattern('test.dep-forward', [{ kind: 'DEPENDENCY', formulaId: 'pressure.orbit-forward' }]);
  const formulaPattern = pattern('test.formula-closure', [{ kind: 'FORMULA_ID', formulaId: 'pressure.closure' }]);

  const exact = Matcher.matchPattern(exactPattern, 'ring.balance');
  const rejected = Matcher.matchPattern(exactPattern, 'pressure.edge');
  const operation = Matcher.matchAll(operationPattern);
  const input = Matcher.matchAll(inputPattern);
  const output = Matcher.matchAll(outputPattern);
  const dependency = Matcher.matchAll(dependencyPattern);
  const formula = Matcher.matchAll(formulaPattern);

  equal(exact.status, 'STRUCTURAL_MATCH', 'exact matcher failed');
  equal(rejected.status, 'STRUCTURAL_REJECT', 'exact matcher did not reject a different shape');
  same(matchIds(operation), sorted([
    'pressure.closure', 'pressure.edge', 'pressure.orbit-forward',
    'pressure.orbit-reverse', 'ring.balance', 'vitality.snapshot-geomean'
  ]), 'operation matcher result changed');
  same(matchIds(input), sorted([
    'pressure.closure', 'pressure.direction', 'pressure.edge', 'pressure.margin',
    'pressure.orbit-forward', 'pressure.orbit-reverse', 'pressure.orbit-total', 'pressure.partition'
  ]), 'input matcher result changed');
  same(matchIds(output), ['vitality.snapshot-geomean', 'vitality.trajectory'], 'output matcher result changed');
  same(matchIds(dependency), ['pressure.direction', 'pressure.orbit-total', 'pressure.partition'], 'dependency matcher result changed');
  same(matchIds(formula), ['pressure.closure'], 'formula matcher result changed');
});

check('all 11 formulas are matchable without any equivalence claim', () => {
  const universal = pattern('test.all-real-unit-one', [{ kind: 'OUTPUT_TYPE_UNIT', valueType: 'Real', unit: '1' }]);
  const batch = Matcher.matchAll(universal);
  equal(batch.status, 'STRUCTURAL_MATCH', 'universal structural match failed');
  equal(batch.matches.length, 11, 'not all formulas reached the matcher');
  equal(batch.rejects.length, 0, 'universal pattern unexpectedly rejected formulas');
  equal(Matcher.maximumStatus, 'STRUCTURAL_MATCH', 'matcher permits a stronger conclusion');
  equal(batch.contentHash, nodeHashCanonical(without(batch, 'contentHash')), 'batch hash differs from node:crypto');

  batch.matches.forEach((match) => {
    assert(match.status === 'STRUCTURAL_MATCH' && match.candidateKind === 'FORMULA_AST', 'invalid structural status');
    assert(match.evidence === 'STRUCTURAL' && match.evidenceLevel === 'STRUCTURAL', 'evidence level changed');
    assert(match.soundness === 'NOT_COMPUTED' && match.semanticTruth === false, 'match overstates semantic truth');
    equal(match.mathematicalEquivalence, 'NOT_COMPUTED', 'match declares mathematical equivalence');
    equal(match.sourceSetHash, Shape.sourceSetHash, 'match source set is not pinned');
    equal(match.registryHash, Registry.registryHash, 'match registry is not pinned');
    equal(match.indexHash, Shape.indexHash, 'match index is not pinned');
    equal(match.patternHash, universal.contentHash, 'match pattern is not pinned');
    equal(match.trace.traceHash, nodeHashCanonical(without(match.trace, 'traceHash')), 'match trace hash differs');
    equal(match.contentHash, nodeHashCanonical(without(match, 'contentHash', 'matchId')), 'match contentHash differs');
    equal(match.matchId, `match:${match.contentHash.slice(7)}`, 'matchId is not content addressed');
  });
});

check('closed pattern language rejects unknown fields, operations, types, and stale hashes', () => {
  const unknownTop = Matcher.compilePattern({
    patternId: 'test.unknown-top', version: '1.0.0', constraints: [{ kind: 'ROOT_NODE', rootNode: 'Call' }], conclusion: 'EQUIVALENT'
  });
  const unknownConstraint = Matcher.compilePattern({
    patternId: 'test.unknown-constraint', version: '1.0.0', constraints: [{ kind: 'EQUIVALENT' }]
  });
  const unknownNested = Matcher.compilePattern({
    patternId: 'test.unknown-nested', version: '1.0.0', constraints: [{ kind: 'ROOT_NODE', rootNode: 'Call', proof: true }]
  });
  const unknownOperation = Matcher.compilePattern({
    patternId: 'test.unknown-operation', version: '1.0.0', constraints: [{ kind: 'OPERATION', operation: 'execute-arbitrary' }]
  });
  const unknownType = Matcher.compilePattern({
    patternId: 'test.unknown-type', version: '1.0.0', constraints: [{ kind: 'OUTPUT_TYPE_UNIT', valueType: 'Complex', unit: '1' }]
  });
  const valid = pattern('test.stale-pattern', [{ kind: 'ROOT_NODE', rootNode: 'Call' }]);
  const staleBody = clone(valid);
  staleBody.constraints[0].rootNode = 'Literal';
  const staleBodyResult = Matcher.compilePattern(staleBody);
  const staleExpected = Matcher.matchPattern(valid, 'ring.balance', { expectedPatternHash: ZERO_HASH });
  const missing = Matcher.matchPattern(valid, 'not.present');

  assert(unknownTop.status === 'INVALID' && unknownTop.code === 'UNKNOWN_PATTERN_FIELD', `unknown top field: ${unknownTop.code}`);
  assert(unknownConstraint.status === 'INVALID' && unknownConstraint.code === 'UNKNOWN_CONSTRAINT', `unknown constraint: ${unknownConstraint.code}`);
  assert(unknownNested.status === 'INVALID' && unknownNested.code === 'UNKNOWN_PATTERN_FIELD', `unknown nested field: ${unknownNested.code}`);
  assert(unknownOperation.status === 'INVALID' && unknownOperation.code === 'UNKNOWN_OPERATION', `unknown matcher operation: ${unknownOperation.code}`);
  assert(unknownType.status === 'INVALID' && unknownType.code === 'UNKNOWN_TYPE', `unknown matcher type: ${unknownType.code}`);
  assert(staleBodyResult.status === 'INVALID' && staleBodyResult.code === 'PATTERN_HASH_MISMATCH', `stale pattern body: ${staleBodyResult.code}`);
  assert(staleExpected.status === 'INVALID' && staleExpected.code === 'STALE_PATTERN', `stale expected pattern: ${staleExpected.code}`);
  assert(missing.status === 'ABSTAIN' && missing.code === 'CANDIDATE_UNKNOWN', `missing candidate: ${missing.status}/${missing.code}`);
});

check('stale registries and indexes fail closed across search and matching', () => {
  const staleBuild = Shape.buildIndex(Registry.registry, { expectedRegistryHash: ZERO_HASH });
  const staleVerify = Shape.verifyIndex(Shape.defaultIndex, { expectedRegistryHash: ZERO_HASH });
  const staleSearchRegistry = Shape.search({ formulaId: 'ring.balance', expectedRegistryHash: ZERO_HASH });
  const staleSearchIndex = Shape.search({ formulaId: 'ring.balance', expectedIndexHash: ZERO_HASH });
  const rootPattern = pattern('test.root-call', [{ kind: 'ROOT_NODE', rootNode: 'Call' }]);
  const staleMatchRegistry = Matcher.matchPattern(rootPattern, 'ring.balance', { expectedRegistryHash: ZERO_HASH });
  const staleMatchIndex = Matcher.matchPattern(rootPattern, 'ring.balance', { expectedIndexHash: ZERO_HASH });

  assert(staleBuild.status === 'INVALID' && staleBuild.code === 'STALE_REGISTRY', `stale build: ${staleBuild.code}`);
  assert(staleVerify.status === 'INVALID' && staleVerify.code === 'STALE_REGISTRY', `stale verify: ${staleVerify.code}`);
  assert(staleSearchRegistry.status === 'INVALID' && staleSearchRegistry.code === 'STALE_REGISTRY', `stale search registry: ${staleSearchRegistry.code}`);
  assert(staleSearchIndex.status === 'INVALID' && staleSearchIndex.code === 'STALE_INDEX', `stale search index: ${staleSearchIndex.code}`);
  assert(staleMatchRegistry.status === 'INVALID' && staleMatchRegistry.code === 'STALE_REGISTRY', `stale match registry: ${staleMatchRegistry.code}`);
  assert(staleMatchIndex.status === 'INVALID' && staleMatchIndex.code === 'STALE_INDEX', `stale match index: ${staleMatchIndex.code}`);
});

check('source, signature, index, and candidate corruption is rejected', () => {
  const source = clone(Registry.getFormula(Registry.registry, 'ring.balance'));
  source.expression.operation = 'add';
  const sourceResult = Shape.createSignature(source);

  const signature = clone(Shape.signatures.find((item) => item.formulaRef.formulaId === 'ring.balance'));
  signature.operationMultiset.mul = 99;
  const signatureResult = Shape.verifySignature(signature);

  const index = clone(Shape.defaultIndex);
  index.indexes.byFormulaId['ring.balance'] = [];
  const indexResult = Shape.verifyIndex(index);

  const rootPattern = pattern('test.corrupt-candidate', [{ kind: 'ROOT_NODE', rootNode: 'Call' }]);
  const candidateResult = Matcher.matchPattern(rootPattern, signature);

  assert(sourceResult.status === 'INVALID' && sourceResult.code === 'SOURCE_HASH_MISMATCH', `source corruption: ${sourceResult.code}`);
  assert(signatureResult.status === 'INVALID' && signatureResult.code === 'SHAPE_HASH_MISMATCH', `signature corruption: ${signatureResult.code}`);
  assert(indexResult.status === 'INVALID' && indexResult.code === 'INDEX_HASH_MISMATCH', `index corruption: ${indexResult.code}`);
  assert(candidateResult.status === 'INVALID' && candidateResult.code === 'CANDIDATE_INVALID', `candidate corruption: ${candidateResult.code}`);
});

check('cycles and operation budgets produce explicit INVALID or ABSTAIN outcomes', () => {
  const cyclicFormula = clone(Registry.getFormula(Registry.registry, 'ring.balance'));
  cyclicFormula.expression.args = [cyclicFormula.expression];
  const formulaCycle = Shape.createSignature(cyclicFormula);

  const registryCycle = Shape.buildIndex(registryEnvelope([
    cycleRecord('test.cycle-a', 'test.cycle-b'),
    cycleRecord('test.cycle-b', 'test.cycle-a')
  ]));

  const cyclicPattern = { patternId: 'test.cyclic-pattern', version: '1.0.0', constraints: [] };
  cyclicPattern.constraints.push(cyclicPattern);
  const patternCycle = Matcher.compilePattern(cyclicPattern);

  const ringRecord = Registry.getFormula(Registry.registry, 'ring.balance');
  const shapeBudget = Shape.createSignature(ringRecord, { maxOperations: 0 });
  const searchBudget = Shape.findByOperation('mul', { maxOperations: 0 });
  const operationPattern = pattern('test.budget-operation', [{ kind: 'OPERATION', operation: 'mul' }]);
  const matchBudget = Matcher.matchPattern(operationPattern, 'ring.balance', { maxOperations: 0 });
  const batchBudget = Matcher.matchAll(operationPattern, { maxOperations: 0 });

  assert(formulaCycle.status === 'INVALID' && formulaCycle.code === 'CYCLE_DETECTED', `formula cycle: ${formulaCycle.status}/${formulaCycle.code}`);
  assert(registryCycle.status === 'INVALID' && registryCycle.code === 'DEPENDENCY_CYCLE', `dependency cycle: ${registryCycle.status}/${registryCycle.code}`);
  assert(patternCycle.status === 'INVALID' && patternCycle.code === 'CYCLE_DETECTED', `pattern cycle: ${patternCycle.status}/${patternCycle.code}`);
  assert(shapeBudget.status === 'ABSTAIN' && shapeBudget.code === 'BUDGET_EXCEEDED', `shape budget: ${shapeBudget.status}/${shapeBudget.code}`);
  assert(searchBudget.status === 'ABSTAIN' && searchBudget.code === 'BUDGET_EXCEEDED', `search budget: ${searchBudget.status}/${searchBudget.code}`);
  assert(matchBudget.status === 'ABSTAIN' && matchBudget.code === 'BUDGET_EXCEEDED', `match budget: ${matchBudget.status}/${matchBudget.code}`);
  assert(batchBudget.status === 'ABSTAIN' && batchBudget.code === 'BUDGET_EXCEEDED', `batch budget: ${batchBudget.status}/${batchBudget.code}`);
});

check('query, index, pattern, and match replay is deterministic and immutable', () => {
  const queryDraft = {
    operation: 'mul',
    inputType: { valueType: 'Real', unit: '1' },
    expectedRegistryHash: Registry.registryHash,
    expectedIndexHash: Shape.indexHash
  };
  const patternDraft = {
    patternId: 'test.replay',
    version: '1.0.0',
    constraints: [
      { kind: 'OUTPUT_TYPE_UNIT', valueType: 'Real', unit: '1' },
      { kind: 'ROOT_NODE', rootNode: 'Call' }
    ]
  };
  const queryBefore = JSON.stringify(queryDraft);
  const patternBefore = JSON.stringify(patternDraft);
  const firstIndex = Shape.buildIndex(clone(Registry.registry), { expectedRegistryHash: Registry.registryHash });
  const firstSearch = Shape.search(queryDraft);
  const compiledPattern = Matcher.compilePattern(patternDraft);
  const firstBatch = Matcher.matchAll(compiledPattern);
  const firstMatch = Matcher.matchPattern(compiledPattern, 'ring.balance');

  equal(firstIndex.indexHash, Shape.indexHash, 'index replay hash changed');
  assert(firstSearch.status === 'READY' && compiledPattern.status === 'READY', 'replay setup failed');
  for (let index = 0; index < 8; index += 1) {
    equal(JSON.stringify(Shape.buildIndex(clone(Registry.registry), { expectedRegistryHash: Registry.registryHash })), JSON.stringify(firstIndex), `index replay ${index + 1} changed`);
    equal(JSON.stringify(Shape.search(queryDraft)), JSON.stringify(firstSearch), `search replay ${index + 1} changed`);
    equal(JSON.stringify(Matcher.compilePattern(patternDraft)), JSON.stringify(compiledPattern), `pattern replay ${index + 1} changed`);
    equal(JSON.stringify(Matcher.matchAll(compiledPattern)), JSON.stringify(firstBatch), `batch replay ${index + 1} changed`);
    equal(JSON.stringify(Matcher.matchPattern(compiledPattern, 'ring.balance')), JSON.stringify(firstMatch), `match replay ${index + 1} changed`);
  }
  equal(JSON.stringify(queryDraft), queryBefore, 'query input mutated');
  equal(JSON.stringify(patternDraft), patternBefore, 'pattern input mutated');
  assert(deeplyFrozen(firstIndex) && deeplyFrozen(firstSearch) && deeplyFrozen(compiledPattern), 'replay artifacts are mutable');
  assert(deeplyFrozen(firstBatch) && deeplyFrozen(firstMatch), 'match artifacts are mutable');
});

check('classic IIFE sources are host-free and replay identically in a fresh VM global', () => {
  const source = newLibraryPaths.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const forbidden = [
    /\bdocument\b/, /\bwindow\b/, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b/,
    /https?:\/\//i, /\beval\s*\(/, /\bnew\s+Function\b/, /\bDate\b/, /\bperformance\b/,
    /Math\.random\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/,
    /\bmodule\.exports\b/, /\brequire\s*\(/, /\bimport\s*\(/, /\bexport\s+/
  ];
  forbidden.forEach((candidate) => assert(!candidate.test(source), `forbidden source pattern ${candidate}`));
  assert(newLibraryPaths.every((file) => fs.readFileSync(file, 'utf8').startsWith('(function(global){')), 'classic IIFE wrapper missing');
  assert(newLibraryPaths.every((file) => /typeof globalThis/.test(fs.readFileSync(file, 'utf8'))), 'globalThis fallback missing');

  const sandbox = {};
  vm.createContext(sandbox);
  sourcePaths.forEach((file) => vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: path.basename(file) }));
  const isolatedShape = sandbox.MRDP78FormulaShapeIndex;
  const isolatedMatcher = sandbox.MRDP78FormulaStructuralMatcher;
  equal(isolatedShape.status, 'READY', 'VM shape API unavailable');
  equal(isolatedMatcher.status, 'READY', 'VM matcher API unavailable');
  equal(isolatedShape.indexHash, Shape.indexHash, 'VM index hash changed');
  equal(isolatedMatcher.patternSetHash, Matcher.patternSetHash, 'VM pattern hash changed');
  equal(JSON.stringify(isolatedShape.findByDependency('pressure.orbit-forward')), JSON.stringify(Shape.findByDependency('pressure.orbit-forward')), 'VM search replay changed');
  const isolatedPattern = isolatedMatcher.getPattern(isolatedMatcher.defaultPatternRegistry, 'p78.pattern.operation-mul');
  equal(JSON.stringify(isolatedMatcher.matchAll(isolatedPattern)), JSON.stringify(Matcher.matchAll(Matcher.getPattern(Matcher.defaultPatternRegistry, 'p78.pattern.operation-mul'))), 'VM match replay changed');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? `\n${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
