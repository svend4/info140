'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const lib = (name) => path.join(rootDir, 'lib', `${name}.js`);
global.window = global;
[
  'p78-canonical-json', 'semantic-core', 'semantic-language',
  'p78-controlled-russian-lexicon', 'p78-claim-ir', 'p78-linguistic-parser-adapter',
  'p78-search-contracts', 'p78-evidence-contracts', 'p78-qualifier-direction-contracts',
].forEach((name) => require(lib(name)));

const Canonical = global.MRDP78CanonicalJSON;
const ClaimIR = global.MRDP78ClaimIR;
const Parser = global.MRDP78LinguisticParserAdapter;
const Evidence = global.MRDP78EvidenceContracts;
const Direction = global.MRDP78QualifierDirectionContracts;
const checks = [];
const QUALIFIER_ROLES = new Set(['TIME', 'PLACE', 'POPULATION', 'METHOD', 'CONDITION', 'MEASURE']);

const PLAIN = 'Система проверяет документ.';
const METHOD = 'Система проверяет документ через формулу.';
const OTHER_METHOD = 'Система проверяет документ через алгоритм.';
const HYPOTHESIS = 'Возможно система проверяет документ.';
const UNIVERSAL = 'Все системы проверяют документ.';
const TIME = 'Система проверяет документ сейчас.';

function check(name, run) {
  try { run(); checks.push({ ok: true, name }); }
  catch (error) { checks.push({ ok: false, name, detail: error.stack || error.message }); }
}

function copy(value) { return Canonical.deepCopy(value); }

function parse(text, options) {
  const result = Parser.parse(text, options);
  assert.equal(result.status, 'READY', text);
  assert.equal(result.resolutionStatus, 'RESOLVED', text);
  return result;
}

function coreMap(claim) {
  return Object.fromEntries(claim.arguments
    .filter((argument) => !QUALIFIER_ROLES.has(argument.role))
    .map((argument) => [argument.role, argument.senseId]));
}

function alignment(target, passage) {
  const targetCore = coreMap(target);
  const passageCore = coreMap(passage);
  return {
    predicate: target.predicate.relationTypeId !== null && target.predicate.senseId !== null &&
      target.predicate.relationTypeId === passage.predicate.relationTypeId &&
      target.predicate.senseId === passage.predicate.senseId ? 'TRUE' : 'FALSE',
    arguments: Canonical.canonicalize(targetCore) === Canonical.canonicalize(passageCore) ? 'TRUE' : 'FALSE',
    polarity: target.polarity === passage.polarity ? 'TRUE' : 'FALSE',
    modality: target.modality === passage.modality ? 'TRUE' : 'FALSE',
    quantifier: target.quantifier === passage.quantifier ? 'TRUE' : 'FALSE',
    qualifiers: Canonical.canonicalize(target.qualifiers) === Canonical.canonicalize(passage.qualifiers) ? 'TRUE' : 'FALSE',
  };
}

function relationFor(a) {
  if (a.predicate !== 'TRUE' || a.arguments !== 'TRUE') return 'MENTIONS';
  if (a.polarity === 'FALSE' && a.modality === 'TRUE' && a.quantifier === 'TRUE' && a.qualifiers === 'TRUE') return 'REFUTES';
  if (a.polarity === 'TRUE' && a.modality === 'TRUE' && a.quantifier === 'TRUE' && a.qualifiers === 'TRUE') return 'SUPPORTS';
  if (a.polarity === 'TRUE') return 'QUALIFIES';
  return 'MENTIONS';
}

function reasonCodes(a) {
  return [
    'BROAD_LEXICAL_MATCH', 'SOURCE_PASSAGE_PINNED',
    a.predicate === 'TRUE' ? 'PREDICATE_ALIGNED' : 'PREDICATE_MISMATCH',
    a.arguments === 'TRUE' ? 'ARGUMENTS_ALIGNED' : 'ARGUMENTS_MISMATCH',
    a.polarity === 'TRUE' ? 'POLARITY_ALIGNED' : 'POLARITY_OPPOSITE',
    a.modality === 'TRUE' ? 'MODALITY_ALIGNED' : 'MODALITY_MISMATCH',
    a.quantifier === 'TRUE' ? 'QUANTIFIER_ALIGNED' : 'QUANTIFIER_MISMATCH',
    a.qualifiers === 'TRUE' ? 'QUALIFIERS_ALIGNED' : 'QUALIFIERS_MISMATCH',
    'HUMAN_REVIEW_REQUIRED',
  ];
}

function evidenceCandidate(targetParse, passageParse, options = {}) {
  const a = options.alignment || alignment(targetParse.claimAst, passageParse.claimAst);
  const relation = options.relation || relationFor(a);
  return Evidence.createEvidenceCandidate({
    targetClaimRef: Evidence.claimRef(targetParse.claimAst),
    passageClaimRef: Evidence.claimRef(passageParse.claimAst),
    hitIds: ['hit:qualifier-direction'],
    sourceSpanIds: ['source-span:qualifier-direction'],
    sourceRef: {
      sourceId: 'p78.qualifier-direction.fixture', revision: 'r1',
      sourceHash: Canonical.hashText('qualifier direction source'),
    },
    locator: { start: 0, end: 42, sentenceIndex: 0 },
    passageTextHash: passageParse.inputHash,
    proposedRelation: relation,
    alignment: a,
    status: options.status || (a.predicate === 'TRUE' && a.arguments === 'TRUE' ? 'STRUCTURALLY_ALIGNED' : 'CANDIDATE'),
    reasonCodes: reasonCodes(a),
    provenance: {
      sourceSetHash: Canonical.hashText('source set'),
      queryHash: Canonical.hashText('query'),
      lexicalIndexHash: Canonical.hashText('lexical index'),
      linguisticIndexHash: Canonical.hashText('linguistic index'),
      lexiconHash: global.MRDP78ControlledRussianLexicon.lexiconHash,
      parserRef: Parser.parserRef,
      alignerVersion: '1.0.0',
    },
  });
}

function definition(targetText, passageText, options = {}) {
  const targetParseResult = parse(targetText);
  const passageParseResult = parse(passageText);
  return {
    targetParseResult,
    passageParseResult,
    evidenceCandidate: evidenceCandidate(targetParseResult, passageParseResult, options),
  };
}

function rehash(value) {
  const result = copy(value);
  const identity = copy(result);
  delete identity.assessmentId;
  delete identity.contentHash;
  result.assessmentId = `qualifier-direction:${Canonical.hashCanonical(identity).slice(7)}`;
  const payload = copy(result);
  delete payload.contentHash;
  result.contentHash = Canonical.hashCanonical(payload);
  return result;
}

check('API pins a versioned ruleset and has no semantic or commit authority', () => {
  assert.equal(Direction.status, 'READY');
  assert.equal(Direction.version, '2.1.0');
  assert.equal(Direction.schema, 'meridian.qualifier-direction-contracts/2');
  assert.equal(Direction.outputSchema, 'meridian.qualifier-direction-assessment/2');
  assert.equal(Direction.basis, 'SINGLE_CONTROLLED_METHOD_CLAUSE_DELTA');
  assert.equal(Direction.directionDomain, 'SYNTACTIC_SPECIFICITY');
  assert(Canonical.isSha256(Direction.rulesetHash));
  assert.equal(Direction.logicalImplication, 'NOT_COMPUTED');
  assert.equal(Direction.reviewStatus, 'REQUIRES_REVIEW');
  assert.equal(Direction.semanticTruth, false);
  assert.equal(Direction.commitAllowed, false);
  assert.equal(Direction.limits.maxGraphValues, 200000);
  assert.equal(Direction.limits.maxGraphCodeUnits, 2000000);
  assert.equal(Direction.limits.maxClaimCodeUnits, 8192);
  assert(Object.isFrozen(Direction) && Object.isFrozen(Direction.abstainCodes));
});

check('a passage with one controlled method clause is DIRECTED and NARROWER', () => {
  const input = definition(PLAIN, METHOD);
  const result = Direction.assessQualifierDirection(input);
  assert.equal(result.status, 'DIRECTED');
  assert.equal(result.scopeDirection, 'NARROWER');
  assert.equal(result.abstainCode, null);
  assert.equal(result.witness.qualifiedSide, 'PASSAGE');
  assert.equal(result.witness.qualifierKey, 'method');
  assert.equal(result.witness.markerToken, 'через');
  assert.equal(result.witness.valueTokenIndex, result.witness.markerTokenIndex + 1);
  assert.equal(result.directionDomain, 'SYNTACTIC_SPECIFICITY');
  assert.equal(result.logicalImplication, 'NOT_COMPUTED');
  assert(Object.isFrozen(result) && Object.isFrozen(result.witness));
});

check('a target with the method clause is only a BROADER diagnostic', () => {
  const result = Direction.assessQualifierDirection(definition(METHOD, PLAIN));
  assert.equal(result.status, 'DIRECTED');
  assert.equal(result.scopeDirection, 'BROADER');
  assert.equal(result.witness.qualifiedSide, 'TARGET');
});

check('assessment creation repeats both parses deterministically', () => {
  const input = definition(PLAIN, METHOD);
  const first = Direction.assessQualifierDirection(input);
  const second = Direction.assessQualifierDirection(copy(input));
  assert.equal(Canonical.canonicalize(first), Canonical.canonicalize(second));
  assert.equal(first.targetParseRef.resultHash, input.targetParseResult.resultHash);
  assert.equal(first.passageParseRef.resultHash, input.passageParseResult.resultHash);
});

check('replay derives a sufficient token budget from a valid parse result', () => {
  const prefix = `Система ${'и '.repeat(31)}`;
  const targetParseResult = parse(`${prefix}проверяет документ.`, { maxTokens: 64 });
  const passageParseResult = parse(`${prefix}проверяет документ через формулу.`, { maxTokens: 64 });
  const result = Direction.assessQualifierDirection({
    targetParseResult,
    passageParseResult,
    evidenceCandidate: evidenceCandidate(targetParseResult, passageParseResult),
  });
  assert.equal(targetParseResult.tokens.length, 34);
  assert.equal(passageParseResult.tokens.length, 36);
  assert.equal(result.status, 'DIRECTED');
  assert.equal(result.scopeDirection, 'NARROWER');
});

check('case, punctuation and spacing outside the method clause must remain exact', () => {
  const caseChanged = Direction.assessQualifierDirection(definition(
    PLAIN,
    'система проверяет документ через формулу.',
  ));
  const punctuationChanged = Direction.assessQualifierDirection(definition(
    PLAIN,
    'Система проверяет документ, через формулу.',
  ));
  assert.equal(caseChanged.status, 'ABSTAIN');
  assert.equal(caseChanged.abstainCode, 'TOKEN_REMAINDER_MISMATCH');
  assert.equal(punctuationChanged.status, 'ABSTAIN');
  assert.equal(punctuationChanged.abstainCode, 'TOKEN_REMAINDER_MISMATCH');
});

check('METHOD witness must bind the exact token after the marker, not an equal surface elsewhere', () => {
  const targetParseResult = parse('Система проверяет формулу.');
  const actualPassage = parse('Система проверяет формулу через формулу.');
  const swappedArguments = copy(actualPassage.claimAst.arguments);
  const claimIndex = swappedArguments.findIndex((item) => item.role === 'CLAIM');
  const methodIndex = swappedArguments.findIndex((item) => item.role === 'METHOD');
  const claimSpan = swappedArguments[claimIndex].surfaceSpanId;
  swappedArguments[claimIndex].surfaceSpanId = swappedArguments[methodIndex].surfaceSpanId;
  swappedArguments[methodIndex].surfaceSpanId = claimSpan;
  const badClaim = ClaimIR.createClaimAst({
    sourceSpanIds: actualPassage.claimAst.sourceSpanIds,
    predicate: actualPassage.claimAst.predicate,
    arguments: swappedArguments,
    quantifier: actualPassage.claimAst.quantifier,
    polarity: actualPassage.claimAst.polarity,
    modality: actualPassage.claimAst.modality,
    qualifiers: actualPassage.claimAst.qualifiers,
    parserRef: actualPassage.claimAst.parserRef,
    resolutionStatus: actualPassage.claimAst.resolutionStatus,
  });
  const passageParseResult = copy(actualPassage);
  passageParseResult.claimAst = badClaim;
  delete passageParseResult.resultHash;
  passageParseResult.resultHash = Canonical.hashCanonical(passageParseResult);
  const fakeParser = Object.freeze({
    version: Parser.version,
    status: 'READY',
    parserRef: Parser.parserRef,
    lexiconHash: Parser.lexiconHash,
    replay(source) {
      return source === 'Система проверяет формулу.' ? targetParseResult : passageParseResult;
    },
  });
  const source = fs.readFileSync(lib('p78-qualifier-direction-contracts'), 'utf8');
  const context = vm.createContext({
    MRDP78CanonicalJSON: Canonical,
    MRDP78ClaimIR: ClaimIR,
    MRDP78LinguisticParserAdapter: fakeParser,
    MRDP78EvidenceContracts: Evidence,
  });
  vm.runInContext(source, context);
  const result = context.MRDP78QualifierDirectionContracts.assessQualifierDirection({
    targetParseResult,
    passageParseResult,
    evidenceCandidate: evidenceCandidate(targetParseResult, passageParseResult),
  });
  assert.equal(result.status, 'ABSTAIN');
  assert.equal(result.abstainCode, 'METHOD_BINDING_UNPROVEN');
});

check('shape inspection explicitly performs no parser or referential replay', () => {
  const result = Direction.assessQualifierDirection(definition(PLAIN, METHOD));
  const shape = Direction.inspectQualifierDirectionShape(result);
  assert.equal(shape.status, 'STRUCTURALLY_VALID');
  assert.equal(shape.validationScope, 'STRUCTURE_ONLY');
  assert.equal(shape.parserReplay, 'NOT_PERFORMED');
  assert.equal(shape.referentialReplay, 'NOT_CLAIMED');
});

check('against-validation performs only its declared full parse-bundle replay', () => {
  const input = definition(PLAIN, METHOD);
  const result = Direction.assessQualifierDirection(input);
  const report = Direction.validateQualifierDirectionAgainst(result, input);
  assert.equal(report.status, 'VALID');
  assert.equal(report.validationScope, 'PARSE_BUNDLE_REPLAY');
  assert.equal(report.parserReplay, 'PERFORMED');
  assert.equal(report.referentialReplay, 'NOT_CLAIMED');
});

check('modal differences produce a content-addressed ABSTAIN', () => {
  const result = Direction.assessQualifierDirection(definition(PLAIN, HYPOTHESIS));
  assert.equal(result.status, 'ABSTAIN');
  assert.equal(result.scopeDirection, null);
  assert.equal(result.witness, null);
  assert.equal(result.abstainCode, 'MODALITY_MISMATCH');
  assert(Canonical.isSha256(result.contentHash));
});

check('quantifiers are not assigned a fabricated total order', () => {
  const result = Direction.assessQualifierDirection(definition(PLAIN, UNIVERSAL));
  assert.equal(result.status, 'ABSTAIN');
  assert.equal(result.abstainCode, 'QUANTIFIER_MISMATCH');
});

check('different method values remain incomparable', () => {
  const result = Direction.assessQualifierDirection(definition(METHOD, OTHER_METHOD));
  assert.equal(result.status, 'ABSTAIN');
  assert.equal(result.abstainCode, 'QUALIFIER_VALUE_CONFLICT');
});

check('time and other unproved qualifier grammars are unsupported', () => {
  const result = Direction.assessQualifierDirection(definition(PLAIN, TIME));
  assert.equal(result.status, 'ABSTAIN');
  assert.equal(result.abstainCode, 'QUALIFIER_KEY_UNSUPPORTED');
});

check('a non-QUALIFIES evidence candidate produces an explicit ABSTAIN', () => {
  const result = Direction.assessQualifierDirection(definition(PLAIN, PLAIN));
  assert.equal(result.status, 'ABSTAIN');
  assert.equal(result.abstainCode, 'RELATION_NOT_QUALIFIES');
});

check('candidate claim references cannot be swapped or detached', () => {
  const input = definition(PLAIN, METHOD);
  assert.throws(
    () => Direction.assessQualifierDirection({
      ...input,
      targetParseResult: input.passageParseResult,
      passageParseResult: input.targetParseResult,
    }),
    (error) => error.code === 'TARGET_CLAIM_REFERENCE_MISMATCH',
  );
});

check('a fabricated qualifier AST without parser evidence is rejected by replay', () => {
  const targetParseResult = parse(PLAIN);
  const realPassage = parse(PLAIN);
  const fabricatedClaim = ClaimIR.createClaimAst({
    sourceSpanIds: realPassage.claimAst.sourceSpanIds,
    predicate: realPassage.claimAst.predicate,
    arguments: realPassage.claimAst.arguments,
    quantifier: realPassage.claimAst.quantifier,
    polarity: realPassage.claimAst.polarity,
    modality: realPassage.claimAst.modality,
    qualifiers: { method: 'формулу' },
    parserRef: realPassage.claimAst.parserRef,
    resolutionStatus: 'RESOLVED',
  });
  const passageParseResult = copy(realPassage);
  passageParseResult.claimAst = fabricatedClaim;
  delete passageParseResult.resultHash;
  passageParseResult.resultHash = Canonical.hashCanonical(passageParseResult);
  const input = {
    targetParseResult,
    passageParseResult,
    evidenceCandidate: evidenceCandidate(targetParseResult, passageParseResult),
  };
  assert.throws(
    () => Direction.assessQualifierDirection(input),
    (error) => error.code === 'PARSE_REPLAY_MISMATCH',
  );
});

check('a rehashed opposite direction is only shape-plausible and fails parse-bundle validation', () => {
  const input = definition(PLAIN, METHOD);
  const original = Direction.assessQualifierDirection(input);
  const forged = copy(original);
  forged.scopeDirection = 'BROADER';
  forged.witness.qualifiedSide = 'TARGET';
  const rehashed = rehash(forged);
  assert.equal(Direction.inspectQualifierDirectionShape(rehashed).status, 'STRUCTURALLY_VALID');
  const report = Direction.validateQualifierDirectionAgainst(rehashed, input);
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'QUALIFIER_DIRECTION_BUNDLE_MISMATCH');
});

check('authority escalation is rejected even after rehashing', () => {
  const forged = copy(Direction.assessQualifierDirection(definition(PLAIN, METHOD)));
  forged.commitAllowed = true;
  const report = Direction.inspectQualifierDirectionShape(rehash(forged));
  assert.equal(report.status, 'INVALID');
  assert.equal(report.code, 'AUTHORITY_BOUNDARY_VIOLATION');
});

check('hidden, symbolic and accessor fields fail before parser replay', () => {
  const base = definition(PLAIN, METHOD);
  const hidden = copy(base);
  Object.defineProperty(hidden, 'hidden', { value: true, enumerable: false });
  assert.throws(() => Direction.assessQualifierDirection(hidden), /NON_ENUMERABLE_FIELD_FORBIDDEN/);
  const symbolic = copy(base);
  symbolic[Symbol('x')] = true;
  assert.throws(() => Direction.assessQualifierDirection(symbolic), /SYMBOL_FIELD_FORBIDDEN/);
  const accessor = copy(base);
  Object.defineProperty(accessor, 'trap', { enumerable: true, get() { throw new Error('getter ran'); } });
  assert.throws(() => Direction.assessQualifierDirection(accessor), /ACCESSOR_FORBIDDEN/);
});

check('input graph depth is bounded before parser replay', () => {
  const base = definition(PLAIN, METHOD);
  let cursor = base;
  for (let i = 0; i < 80; i += 1) { cursor.extra = {}; cursor = cursor.extra; }
  assert.throws(() => Direction.assessQualifierDirection(base), /INPUT_GRAPH_DEPTH_EXCEEDED/);
});

check('wide primitive arrays and aggregate text are bounded before schema work', () => {
  const wide = definition(PLAIN, METHOD);
  wide.extra = new Array(Direction.limits.maxGraphValues + 1).fill(0);
  assert.throws(
    () => Direction.assessQualifierDirection(wide),
    /INPUT_GRAPH_VALUE_BUDGET_EXCEEDED/,
  );
  const textual = definition(PLAIN, METHOD);
  textual.extra = 'x'.repeat(Direction.limits.maxGraphCodeUnits + 1);
  assert.throws(
    () => Direction.assessQualifierDirection(textual),
    /INPUT_GRAPH_TEXT_BUDGET_EXCEEDED/,
  );
});

check('fresh VM dependency gate includes the parser', () => {
  const source = fs.readFileSync(lib('p78-qualifier-direction-contracts'), 'utf8');
  const blockedContext = vm.createContext({ globalThis: {} });
  vm.runInContext(source, blockedContext);
  assert.equal(blockedContext.globalThis.MRDP78QualifierDirectionContracts.status, 'BLOCKED');
  assert.equal(blockedContext.globalThis.MRDP78QualifierDirectionContracts.code, 'QUALIFIER_DIRECTION_DEPENDENCY_UNAVAILABLE');
});

check('module has no UI, network, clock, randomness, evaluator or commit authority', () => {
  const source = fs.readFileSync(lib('p78-qualifier-direction-contracts'), 'utf8');
  assert(!/\bdocument\b|querySelector|createElement|innerHTML|requestAnimationFrame/.test(source));
  assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(source));
  assert(!/Math\.random|Date\.now|new Date|performance\.now/.test(source));
  assert(!/\beval\s*\(|new Function/.test(source));
  assert(!/commitAllowed\s*:\s*true|semanticTruth\s*:\s*true/.test(source));
  assert(!/logicalImplication\s*:\s*['\"](?:TRUE|PROVED|COMPUTED)['\"]/.test(source));
});

for (const item of checks) {
  process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? `\n${item.detail}` : ''}\n`);
}
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
if (passed !== checks.length) process.exitCode = 1;
