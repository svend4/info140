'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', 'lib', 'p78-q6-diagnostics.js');
const source = fs.readFileSync(sourcePath, 'utf8');
global.window = global;
require(sourcePath);
const q6 = global.MRDP78Q6Diagnostics;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

function predicate(value, measurement, threshold, provenance) {
  return {
    value,
    measurement,
    threshold,
    thresholdProfile: 'p78-center-safety-v0',
    evidenceLevel: 'STRUCTURAL',
    providerVersion: 'test-1.0.0',
    provenance: provenance || ['fixture:q6'],
  };
}

check('classic IIFE exposes one frozen, versioned structural API', () => {
  assert(q6 && q6.version === '1.0.0' && Object.isFrozen(q6), 'API export is missing or mutable');
  assert(q6.dimension === 6 && q6.vertexCount === 64 && q6.degree === 6 && q6.edgeCount === 192, 'Q6 constants changed');
  assert(q6.evidenceLevel === 'STRUCTURAL' && q6.soundness === 'NOT_COMPUTED', 'evidence boundary changed');
  ['diagnose', 'getVertex', 'hammingDistance', 'isAdjacent', 'neighbors', 'projectVertex', 'projectGraph', 'findCounterfactual', 'verifyTransition', 'verifyPath', 'verifyGraph'].forEach((name) => {
    assert(typeof q6[name] === 'function', `${name} is missing`);
  });
});

check('profile fixes six typed predicates in canonical bit order', () => {
  assert(q6.profile.id === 'p78-center-safety-v0' && Object.isFrozen(q6.profile), 'profile is missing or mutable');
  assert(q6.predicateNames.join(',') === 'sourceCovered,goalCovered,relationSupported,noveltyPreserved,guardSafe,reversible', 'predicate order changed');
  assert(q6.profile.predicates.every((item, index) => item.bit === index && item.name === q6.predicateNames[index]), 'predicate definitions are not typed by bit');
});

check('Q6 graph has exactly 64 vertices, degree 6 and 192 undirected edges', () => {
  const graph = q6.getGraph();
  assert(graph.vertexCount === 64 && graph.vertices.length === 64, 'vertex count mismatch');
  assert(graph.edgeCount === 192 && graph.edges.length === 192, 'edge count mismatch');
  assert(graph.adjacency.length === 64 && graph.adjacency.every((neighbors) => neighbors.length === 6), 'degree mismatch');
  assert(new Set(graph.edges.map((edge) => `${Math.min(edge.from, edge.to)}:${Math.max(edge.from, edge.to)}`)).size === 192, 'edges are not unique and undirected');
  assert(Object.isFrozen(graph) && Object.isFrozen(graph.vertices[0]) && Object.isFrozen(graph.edges[0]), 'graph is mutable');
  return '64/6/192';
});

check('every graph edge changes exactly one declared predicate bit', () => {
  q6.graph.edges.forEach((edge) => {
    assert(q6.hammingDistance(edge.from, edge.to) === 1, `edge ${edge.id} is not Hamming-one`);
    assert(q6.changedBit(edge.from, edge.to) === edge.changedBit, `edge ${edge.id} bit mismatch`);
    assert(q6.predicateNames[edge.changedBit] === edge.changedPredicate, `edge ${edge.id} predicate mismatch`);
  });
  assert(q6.hammingDistance('000000', '111111') === 6, 'opposite-corner distance changed');
  assert(!q6.isAdjacent('000000', '000011'), 'distance-two pair became adjacent');
});

check('deterministic verifier independently proves the Q6 invariants', () => {
  const first = q6.verifyGraph();
  const second = q6.verifyGraph();
  assert(first.status === 'READY' && first.valid && first.contract.inv.ok, `status=${first.status}`);
  assert(first.checks.every((item) => item.ok), 'a graph invariant failed');
  assert(first.checks.find((item) => item.name === 'local-q3-edges').actual === 96, 'local Q3 edge count changed');
  assert(first.checks.find((item) => item.name === 'macro-q3-edges').actual === 96, 'macro Q3 edge count changed');
  assert(JSON.stringify(first) === JSON.stringify(second), 'graph verification is nondeterministic');
});

check('verifier rejects corrupted edge metadata and duplicated adjacency', () => {
  const badEdge = JSON.parse(JSON.stringify(q6.graph));
  badEdge.edges[0].changedPredicate = 'reversible';
  const edgeReport = q6.verifyGraph(badEdge);
  assert(edgeReport.status === 'INVALID' && !edgeReport.valid, 'corrupted edge metadata passed');
  assert(!edgeReport.checks.find((item) => item.name === 'typed-edge-bit').ok, 'typed edge check missed corruption');

  const badAdjacency = JSON.parse(JSON.stringify(q6.graph));
  badAdjacency.adjacency[0][0] = badAdjacency.adjacency[0][1];
  const adjacencyReport = q6.verifyGraph(badAdjacency);
  assert(adjacencyReport.status === 'INVALID' && !adjacencyReport.valid, 'duplicated neighbor passed');
  assert(!adjacencyReport.checks.find((item) => item.name === 'adjacency-index').ok, 'adjacency check missed duplicate');
});

check('cube-of-cubes projection preserves eight Q3 cubes with eight vertices each', () => {
  const report = q6.projectGraph({ macroScale: 4, localScale: 0.5 });
  assert(report.status === 'READY' && report.vertices.length === 64 && report.edges.length === 192, 'projection is incomplete');
  const groups = new Map();
  report.vertices.forEach((item) => groups.set(item.localCubeId, (groups.get(item.localCubeId) || 0) + 1));
  assert(groups.size === 8 && [...groups.values()].every((count) => count === 8), 'projection is not Q3 x Q3');
  const localEdge = report.edges.find((edge) => edge.changedBit === 0);
  const macroEdge = report.edges.find((edge) => edge.changedBit === 3);
  assert(localEdge.screenDistance === 1 && macroEdge.screenDistance === 8, 'projection scales are not separated');
  assert(report.topologyTruth === 'HAMMING_ONE' && report.screenDistanceSemantic === false, 'screen distance became topology truth');
});

check('complete typed predicates produce the exact Q6 cell without semantic scoring', () => {
  const input = {
    sourceCovered: predicate(false, 0.4, 0.8),
    goalCovered: predicate(true, 1, 1),
    relationSupported: predicate(false, 0.2, 0.7),
    noveltyPreserved: predicate(true, 0.9, 0.6),
    guardSafe: predicate(false, 0.45, 0.5),
    reversible: predicate(true, true, true),
  };
  const before = JSON.stringify(input);
  const report = q6.diagnose(input);
  assert(report.status === 'READY' && report.vertex.bitString === '010101' && report.vertex.id === 21, 'wrong Q6 cell');
  assert(report.knownCount === 6 && report.unknownCount === 0 && report.coverage === 1, 'coverage mismatch');
  assert(report.predicates.every((item) => item.evidenceLevel === 'STRUCTURAL' && Object.isFrozen(item)), 'typed evidence was lost');
  assert(report.semanticTruth === false && report.soundness === 'NOT_COMPUTED', 'diagnosis overstates meaning');
  assert(JSON.stringify(input) === before, 'diagnosis mutated its input');
});

check('UNKNOWN remains unknown and yields PARTIAL without a fictional vertex', () => {
  const report = q6.diagnose({
    sourceCovered: predicate(true, 1, 0.8),
    goalCovered: predicate('UNKNOWN', null, 1),
    relationSupported: predicate(false, 0.2, 0.7),
  });
  assert(report.status === 'PARTIAL' && report.code === 'Q6_PREDICATES_PARTIAL', `status=${report.status}`);
  assert(report.pattern === '1?0???' && report.knownCount === 2 && report.unknownCount === 4, `pattern=${report.pattern}`);
  assert(report.vertex === null && report.cell === null && report.compatibleVertexCount === 16, 'partial report invented a cell');
  assert(report.values.goalCovered === 'UNKNOWN' && report.values.guardSafe === 'UNKNOWN', 'unknown became false');
  assert(report.contract.inv.unknownPreserved && report.contract.post.fictionalCell === false, 'unknown invariant failed');
});

check('all missing predicates produce ABSTAIN rather than vertex 000000', () => {
  const report = q6.diagnose({});
  assert(report.status === 'ABSTAIN' && report.code === 'Q6_ALL_PREDICATES_UNKNOWN', `status=${report.status}`);
  assert(report.pattern === '??????' && report.vertex === null && report.compatibleVertexCount === 64, 'all-unknown report fabricated bits');
  assert(Object.values(report.values).every((value) => value === 'UNKNOWN'), 'a missing value became false');
});

check('malformed predicate records fail closed', () => {
  const badValue = q6.diagnose({ sourceCovered: predicate(0, 0, 1) });
  const badEvidence = q6.diagnose({ sourceCovered: { ...predicate(true, 1, 1), evidenceLevel: 'SEMANTIC' } });
  const badProvenance = q6.diagnose({ sourceCovered: { ...predicate(true, 1, 1), provenance: 'fixture' } });
  assert(badValue.status === 'INVALID' && badValue.code === 'Q6_PREDICATES_INVALID', 'numeric truth value was accepted');
  assert(badEvidence.status === 'INVALID', 'semantic evidence was accepted');
  assert(badProvenance.status === 'INVALID', 'untyped provenance was accepted');
});

check('counterfactual is the deterministic shortest one-bit path', () => {
  const first = q6.findCounterfactual('010101', '111010');
  const second = q6.findCounterfactual('010101', '111010');
  assert(first.status === 'READY' && first.shortest && first.distance === q6.hammingDistance('010101', '111010'), 'path is not shortest');
  assert(first.path.length === first.distance + 1 && first.steps.length === first.distance, 'path length mismatch');
  assert(first.steps.every((step, index) => step.changedBit === [0, 2, 3, 4, 5][index]), 'canonical flip order changed');
  assert(first.path.every((vertex, index) => index === 0 || q6.isAdjacent(first.path[index - 1], vertex)), 'path contains a non-edge');
  assert(first.verification.status === 'READY' && first.verification.shortest, 'generated path did not verify');
  assert(JSON.stringify(first) === JSON.stringify(second), 'counterfactual path is nondeterministic');
});

check('allowed bit changes constrain reachability by name and index', () => {
  const reachable = q6.findCounterfactual('000000', '010010', { allowedChanges: ['goalCovered', 4] });
  const blocked = q6.findCounterfactual('000000', '010011', { allowedBits: ['goalCovered', 'guardSafe'] });
  assert(reachable.status === 'READY' && reachable.steps.map((step) => step.changedBit).join(',') === '1,4', 'allowed path changed');
  assert(blocked.status === 'ABSTAIN' && blocked.code === 'Q6_COUNTERFACTUAL_UNREACHABLE', 'disallowed target remained reachable');
  assert(blocked.path.length === 0 && blocked.blockedBits.length === 1 && blocked.blockedBits[0].name === 'reversible', 'blocked bit is not explicit');
});

check('transition and path verifiers reject non-edges, blocked bits and detours', () => {
  assert(q6.verifyTransition('000000', '000001').status === 'READY', 'one-bit edge failed verification');
  assert(q6.verifyTransition('000000', '000011').code === 'Q6_TRANSITION_NOT_EDGE', 'two-bit jump was accepted');
  assert(q6.verifyTransition('000000', '000001', { allowedBits: [] }).code === 'Q6_TRANSITION_BIT_BLOCKED', 'blocked bit was accepted');
  const detour = q6.verifyPath(['000000', '000001', '000000', '000010']);
  assert(detour.status === 'INVALID' && detour.code === 'Q6_PATH_NOT_SHORTEST', 'detour was accepted as shortest');
});

check('partial diagnoses cannot masquerade as counterfactual endpoints', () => {
  const partial = q6.diagnose({ sourceCovered: true });
  const path = q6.findCounterfactual(partial, '111111');
  assert(partial.status === 'PARTIAL' && path.status === 'PARTIAL', 'partial endpoint became a Q6 cell');
  assert(path.path.length === 0 && path.start === null, 'partial endpoint emitted a path');
});

check('browser IIFE has no DOM, network, dynamic evaluation or mutation hooks', () => {
  const hazards = [
    [/\b(?:eval)\s*\(|\bnew\s+Function\b/, 'dynamic evaluation'],
    [/\b(?:document|localStorage|sessionStorage|indexedDB)\b/, 'DOM or storage'],
    [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/, 'network'],
    [/\b(?:transaction\.commit|ledger\.record|innerHTML|createElement)\b/i, 'mutation hook'],
    [/\b(?:Math\.random|Date\.now|new\s+Date)\b/, 'nondeterministic source'],
  ];
  hazards.forEach(([pattern, label]) => assert(!pattern.test(source), `${label} is forbidden`));
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: sourcePath }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  assert(sandbox.MRDP78Q6Diagnostics.version === '1.0.0' && Object.isFrozen(sandbox.MRDP78Q6Diagnostics), 'browser export failed');
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
