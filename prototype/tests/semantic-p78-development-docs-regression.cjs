'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');
const docsRoot = path.join(projectRoot, 'docs');
const filenames = [
  '27-p78-autonomous-2d-development.md',
  '28-formula-nesting-and-linguistic-mathematics.md',
  '29-encyclopedic-semantic-ring-spec.md',
  '30-scientific-synthesis-fission-fusion-spec.md',
  '31-p78-semantic-program-roadmap.md',
  '35-p78-controlled-russian-claim-ast-implementation.md',
  '36-p78-source-backed-claim-cascade-implementation.md',
  '37-p78-ag5-ag7-parallel-development-review.md',
  '38-p78-multi-agent-semantic-flow-crosswalk.md',
  '39-p78-linguistic-mathematics-experiment-catalog.md',
  '40-p78-semantic-flow-projection-implementation.md',
  '41-p78-ag4-external-holdout-baseline.md',
  '42-p78-meaningful-continuation-and-information-recycling-spec.md',
  '43-p78-kryukov-motion-repository-adaptation.md',
  '44-p1-p80-retrospective-and-cluster-river-conveyor.md',
  '45-p78-nine-semantic-orbits-and-alpha-automaton.md',
  '46-p78-alpha-orbit-contracts-implementation.md',
  '47-data7-knowledge-system-form-content-and-p78-adaptation.md',
  '48-p78-data7-adapter-implementation.md',
  '49-p78-evidence-backed-link-adapter-implementation.md',
  '50-p78-qualifier-direction-contract-implementation.md',
  '51-p78-evidence-backed-link-view-implementation.md'
];

function assert(condition, message) { if (!condition) throw new Error(message); }
const checks = [];
function check(name, run) {
  try { checks.push({ name, ok: true, detail: run() || '' }); }
  catch (error) { checks.push({ name, ok: false, detail: error.message || String(error) }); }
}

function read(name) {
  return fs.readFileSync(path.join(docsRoot, name), 'utf8');
}

check('development specification bundle exists and is substantial', () => {
  for (const name of filenames) {
    const filename = path.join(docsRoot, name);
    assert(fs.existsSync(filename), `${name} is missing`);
    assert(fs.statSync(filename).size > 10000, `${name} is unexpectedly small`);
  }
});

check('autonomy audit distinguishes runtime autonomy from semantic maturity', () => {
  const source = read(filenames[0]);
  assert(/P78 может быть самодостаточным без P79 и P80/.test(source), 'autonomy decision missing');
  assert(/эвристической семантикой/.test(source), 'semantic limitation missing');
  assert(/Вариант A: Autonomous 2D/.test(source), 'autonomous configuration missing');
  assert(/Вариант D: Full/.test(source), 'full configuration missing');
});

check('formula branch uses typed executable structures', () => {
  const source = read(filenames[1]);
  assert(/FormulaRecord/.test(source), 'formula registry contract missing');
  assert(/MeasureKind/.test(source), 'measure kinds missing');
  assert(/### 6\.3\. AST/.test(source), 'formula AST missing');
  assert(/Lexeme[\s\S]*Sense[\s\S]*Proposition/.test(source), 'linguistic type ladder missing');
  assert(/P78 остаётся самодостаточным/.test(source), 'P78 autonomy boundary missing');
});

check('encyclopedic branch is claim-level and fail-closed', () => {
  const source = read(filenames[2]);
  assert(/SourceSnapshot/.test(source) && /EvidenceLink/.test(source), 'source/evidence model missing');
  assert(/Жёсткий запрет выдуманных фактов/.test(source), 'fabricated-fact prohibition missing');
  assert(/SUPPORTED/.test(source), 'supported status missing');
  assert(/ABSTAIN/.test(source), 'abstention contract missing');
  assert(/claim-level provenance/.test(source), 'claim-level provenance priority missing');
});

check('scientific branch preserves source-to-claim provenance', () => {
  const source = read(filenames[3]);
  assert(/SOURCE -> SOURCE_VERSION -> PASSAGE -> EVIDENCE -> CLAIM/.test(source), 'provenance chain missing');
  for (const operation of ['split', 'merge', 'compare', 'contradict', 'generalize', 'specialize']) {
    assert(new RegExp('## 8\\.[0-9]+\\. `' + operation + '`').test(source), `${operation} operation missing`);
  }
  assert(/Ни один визуальный или диагностический модуль не получает прямого права/.test(source), 'commit boundary missing');
  assert(/человеческого решения|human review/.test(source), 'human review boundary missing');
});

check('program roadmap orders formula work before broad text generation', () => {
  const source = read(filenames[4]);
  assert(/P78 должен оставаться самостоятельно работающим 2D-инструментом/.test(source), 'primary decision missing');
  assert(/Этап 1\. Формульное автономное кольцо/.test(source), 'formula-first stage missing');
  assert(/Этап 3\. Энциклопедический режим/.test(source), 'encyclopedic stage missing');
  assert(/Этап 4\. Научное слияние и расщепление/.test(source), 'scientific stage missing');
  assert(/Q6 не кодирует смысл|Q6.*не отвечает/.test(source), 'Q6 semantic boundary missing');
});

check('Controlled Russian AG3 is implemented, benchmarked and evidence-bounded', () => {
  const source = read('35-p78-controlled-russian-claim-ast-implementation.md');
  assert(/meridian\.claim-ast\/1/.test(source), 'Claim AST schema missing');
  assert(/sense\/concept records \| 144/.test(source), 'sense inventory missing');
  assert(/predicate frames \| 24/.test(source), 'predicate inventory missing');
  assert(/structural patterns \| 30/.test(source), 'pattern inventory missing');
  assert(/golden fixtures \| 120/.test(source), 'golden corpus inventory missing');
  assert(/120\/120 resolution status совпадают/.test(source), 'golden replay result missing');
  assert(/RESOLVED \| AMBIGUOUS \| OOV/.test(source), 'resolution ladder missing');
  assert(/NOT_COMPUTED[\s\S]*REQUIRES_REVIEW[\s\S]*ABSTAIN/.test(source), 'evidence boundary missing');
  assert(/не копирует невидимую аннотацию/.test(source), 'non-fabrication boundary missing');
  assert(/Следующий этап: AG4/.test(source), 'AG4 handoff missing');
});


check('AG4 implementation report records the hardened review-only boundary', () => {
  const source = read('36-p78-source-backed-claim-cascade-implementation.md');
  [
    'HARDENED_RUNTIME_SLICE', 'PASSAGE_SOURCE_MISMATCH',
    'EVIDENCE_AUTHORITY_BOUNDARY_VIOLATION', 'QUALIFIES',
    '49/49', 'Microsoft Edge', 'DISCONNECTED_DRAFT',
  ].forEach((needle) => assert(source.includes(needle), `AG4 report missing ${needle}`));
  assert(/semanticTruth[\s\S]*false/.test(source), 'AG4 authority boundary missing');
});

check('multi-agent crosswalk separates dimensions, adaptations and authority', () => {
  const source = read('38-p78-multi-agent-semantic-flow-crosswalk.md');
  [
    'REVIEWED_DESIGN', 'SemanticWorkItem', 'SemanticCell', 'FlowFrame',
    'fencingToken', 'backpressure', 'P79', 'P80', 'shell=True',
    'ПЕРЕНЕСТИ КАК ПРИНЦИП', 'ПЕРЕПИСАТЬ В JS', 'ЭКСПЕРИМЕНТ', 'ОТКЛОНИТЬ',
  ].forEach((needle) => assert(source.includes(needle), `crosswalk missing ${needle}`));
  assert(/LICENSE[\s\S]*нельзя безопасно копировать/.test(source), 'license boundary missing');
  assert(/не подтверждает факт/.test(source), 'agent-count authority boundary missing');
});

check('AG5-AG7 roadmap exposes one current status block', () => {
  const source = read('37-p78-ag5-ag7-parallel-development-review.md');
  assert(source.includes('REVIEWED_ROADMAP'), 'roadmap status missing');
  assert(source.includes('DISCONNECTED_DRAFT'), 'AG5 disconnected status missing');
  assert(source.includes('Актуализация после hardening'), 'current status block missing');
  assert(source.includes('36-p78-source-backed-claim-cascade-implementation.md'), 'AG4 report link missing');
  assert(source.includes('38-p78-multi-agent-semantic-flow-crosswalk.md'), 'flow crosswalk link missing');
});


check('experiment catalog separates evidence levels and falsification', () => {
  const source = read('39-p78-linguistic-mathematics-experiment-catalog.md');
  [
    '## 5. Формальные и проверяемые идеи', '## 6. Эвристические идеи',
    '## 7. Экспериментальные и инновационные идеи', '## 8. Фантастические и художественные идеи',
  ].forEach((needle) => assert(source.includes(needle), `experiment catalog missing ${needle}`));
  assert(source.includes('ABSTAIN'), 'catalog abstention boundary missing');
  assert(/human review/.test(source), 'catalog human review boundary missing');
  assert(/условие опровержения/i.test(source), 'catalog falsification condition missing');
});

check('flow implementation report matches the executable boundary', () => {
  const source = read('40-p78-semantic-flow-projection-implementation.md');
  [
    'IMPLEMENTED_POST_HOC_PROJECTION', 'POST_HOC_AG4_PROJECTION',
    'SemanticRun', 'SemanticWorkItem', 'FlowFrame', 'FlowDelta',
    'stageCompletion', 'reviewLoad', 'upstreamBlock',
    'relationDispersion', 'relationConcentration', 'ABSTAIN', '36/36',
  ].forEach((needle) => assert(source.includes(needle), `flow report missing ${needle}`));
  assert(source.includes('не запускает параллельных агентов'), 'post-hoc agent boundary missing');
  assert(source.includes('а не многоагентный scheduler'), 'scheduler boundary missing');
  assert(/history-free `FlowFrame`/.test(source), 'pure snapshot boundary missing');
});
check('external AG4 holdout report separates a safe evaluator pass from semantic gate failure', () => {
  const source = read('41-p78-ag4-external-holdout-baseline.md');
  [
    'IMPLEMENTED_EXTERNAL_HOLDOUT_PILOT', 'BLOCKED_FOR_AG5',
    'p78.ag4.ru.wikipedia-definitions.pilot.v1',
    '10 external source snapshots', '12 задач',
    'candidateGoldPassageRecall', 'source-level split',
    'development corpus', 'blind holdout v2',
    'semanticTruth=false', '0/9', '6/10',
  ].forEach((needle) => assert(source.includes(needle), `holdout report missing ${needle}`));
  assert(/input и gold физически разнесены/.test(source), 'physical gold separation missing');
  assert(/не означает, что семантическое качество прошло gate/.test(source), 'evaluator/quality distinction missing');
  assert(/P78 при этом остаётся самостоятельной 2D-системой/.test(source), '2D autonomy boundary missing');
});

check('meaningful continuation spec grounds reversible semantic work and the asymmetric figure-eight', () => {
  const source = read('42-p78-meaningful-continuation-and-information-recycling-spec.md');
  [
    'DESIGN_SPEC_FOR_NEXT_IMPLEMENTATION',
    'TranscriptLattice', 'DefinitionClaim', 'ContinuationMove',
    'SemanticCheckpoint', 'RecyclingDecision',
    'AG4.5 Natural Definition Bridge', 'ReplayReceipt',
    'ROLLING_LEMNISCATE', 's(phi) = 1 + kappa * sin(phi)',
  ].forEach((needle) => assert(source.includes(needle), `continuation spec missing ${needle}`));
  assert(source.includes('содержательная остановка иногда обязательна.'), 'safe abstention boundary missing');
  assert(source.includes('Большинство агентов не равно истине.'), 'agent authority boundary missing');
});

check('data2 audit separates reusable workflow patterns from unvalidated universal claims', () => {
  const source = read('43-p78-kryukov-motion-repository-adaptation.md');
  [
    'EXTERNAL_REPOSITORY_CRITICAL_AUDIT',
    'fe9b0996206a4e7d3323df4292b61828d7fc893e',
    'HullFillRatio', 'odd-number gate',
    'bounded retries', 'deterministic replay',
    'SVO не является универсальной петлёй',
    'VISUAL_METAPHOR', 'semanticTruth: false',
    'VerificationReceipt',
  ].forEach((needle) => assert(source.includes(needle), `data2 audit missing ${needle}`));
  assert(source.includes('код и текст не копируются'), 'license boundary missing');
  assert(source.includes('не «слова движутся по тем же законам, что руки»'), 'clean semantic translation boundary missing');
});

check('P1-P80 retrospective converges the visual lineage into a receipt-driven cluster conveyor', () => {
  const source = read('44-p1-p80-retrospective-and-cluster-river-conveyor.md');
  [
    'P1_P80_RETROSPECTIVE_AND_CLUSTER_CONVEYOR_SPEC',
    'SemanticCluster', 'ProvenanceManifest', 'FlowReceipt',
    'H2O_IS_NOT_A_SEMANTIC_UNIT',
    'G_sem', 'G_work', 'G_view',
    'direction = x - y',
    'Cluster River Workbench',
    'POST_HOC_AG4_PROJECTION',
    'AG4.5 Natural Definition Bridge',
    'BLOCKED_FOR_AG5',
    'semanticTruth: false',
    '53/53 suites', '629/629 checks',
  ].forEach((needle) => assert(source.includes(needle), `cluster conveyor spec missing ${needle}`));
  assert(source.includes('Река не является моделью истины.'), 'hydrodynamic authority boundary missing');
  assert(source.includes('Графический результат без текстового результата считается неполным.'), 'text output requirement missing');
  assert(source.includes('metric(G_view) must not authorize semantic commit'), 'view graph authority boundary missing');
});

check('nine alpha orbits resolve the useful-level versus pathological-pole conflict', () => {
  const source = read('45-p78-nine-semantic-orbits-and-alpha-automaton.md');
  [
    'AUDIT_CORRECTION_AND_NINE_ORBIT_AUTOMATON_SPEC',
    '7428deec5036c3a3e080482654a4e28ce15d09c1',
    'USEFUL_ALPHA_EXTREMES_VS_PATHOLOGICAL_SPATIAL_POLES',
    'alpha=+4  ONTOLOGY',
    'alpha= 0  CONCEPT',
    'alpha=-4  CODE',
    'GENERALIZE', 'SPECIALIZE', 'LINK', 'ORBIT', 'BRIDGE',
    'TRACEABILITY_GAP',
    'G_sem', 'G_work', 'G_view',
    'metric(G_view) must not authorize semantic commit',
    'BLOCKED_FOR_AG5',
  ].forEach((needle) => assert(source.includes(needle), `alpha orbit spec missing ${needle}`));
  assert(source.includes('Это **реальный пропуск аудита**'), 'audit omission is not acknowledged');
  assert(source.includes('Онтология не является 3D-коллапсом; код не является 1D-шумом.'), 'useful alpha edges are conflated with spatial pathologies');
  assert(source.includes('Числа `-4..+4` являются порядковыми метками'), 'ordinal alpha boundary missing');
  assert(source.includes('Цвет не должен быть единственным носителем информации.'), 'accessible visual encoding boundary missing');
  assert(source.includes('Сначала фиксируется семантическая операция, затем UI получает проекцию.'), 'semantic-before-view commit order missing');
  assert(source.includes('AG5 остаётся заблокированным'), 'AG5 holdout boundary missing');
});

check('alpha orbit implementation report matches the isolated executable contract boundary', () => {
  const source = read('46-p78-alpha-orbit-contracts-implementation.md');
  [
    'ALPHA_ORBIT_CONTRACTS_IMPLEMENTED_NOT_WIRED',
    'NOT_WIRED_TO_P78_SHELL',
    'p78-alpha-orbit-contracts.js',
    'semantic-p78-alpha-orbit-contracts-regression.cjs',
    'meridian.alpha-artifact/1',
    'meridian.alpha-edge/1',
    'meridian.alpha-transition-receipt/1',
    'INNER_GUARD_REACHED', 'OUTER_GUARD_REACHED',
    'GENERALIZE', 'SPECIALIZE', 'LINK', 'ORBIT', 'BRIDGE',
    'PARK', 'ROLLBACK', 'ABSTAIN',
    'STRUCTURAL_ONLY', 'semanticTruth: false', 'commitAllowed: false',
    'G_sem', 'G_work', 'G_view',
    'PASS: 19/19 checks',
  ].forEach((needle) => assert(source.includes(needle), `alpha implementation report missing ${needle}`));
  assert(source.includes('пока не подключён к shell'), 'shell integration boundary missing');
  assert(source.includes('без него `α=0`'), 'alpha zero truthiness regression is undocumented');
  assert(source.includes('Canvas не создаёт и не изменяет artifacts'), 'passive view boundary missing');
  assert(source.includes('metric(G_view) must not authorize semantic commit'), 'view authority boundary missing');
});

check('data7 report-pair audit separates executable form from unvalidated semantic claims', () => {
  const source = read('47-data7-knowledge-system-form-content-and-p78-adaptation.md');
  [
    'EXTERNAL_REPORT_PAIR_CRITICAL_AUDIT_AND_ADAPTATION_SPEC',
    'fb665e7e40ef99e3bfcfa836ebb7a01735654627',
    'PARTIALLY_ADAPTED_CONFLICTING_MATURITY_CLAIMS',
    'REAL_EXECUTABLE_PROTOTYPE',
    'KnowledgeRationalizer', 'DissertationDecomposer',
    'WikiAggregator', 'WikiDecomposer', 'DissertationSynthesizer',
    'hash(para[:50]) % 5', 'improvement = 45.0',
    'DATA7_KNOWLEDGE_SYSTEM_REPORT_PAIR',
    'Data7Adapter', 'LINK_CANDIDATE',
    'PAIR_SWAP_NOT_2_OPT',
    'NONDETERMINISTIC_TEMPLATE_DEMO',
    'MODELLED_FACT_COVERAGE_GATE',
    'NOT_WIRED_TO_P78_SHELL',
    'semanticTruth', 'commitAllowed',
    'BLOCKED_FOR_AG5',
  ].forEach((needle) => assert(source.includes(needle), `data7 audit missing ${needle}`));
  assert(source.includes('жанр документа не равен α-уровню'), 'genre/alpha boundary missing');
  assert(source.includes('TSP решает **задачу порядка**'), 'TSP authority boundary missing');
  assert(source.includes('структурная оптимизация не выдаётся за понимание'), 'form/content boundary missing');
  assert(source.includes('Это **реальный пропуск аудита источников**'), 'audit omission is not acknowledged');
  assert(/p55[\s\S]*p56[\s\S]*p70/.test(source), 'prior local adaptations are missing');
  assert(/exact-source provenance/.test(source), 'source-backed adapter boundary missing');
  assert(source.includes('предоставляет три метода'), 'executable optimizer/report distinction missing');
});

check('Data7Adapter implementation report preserves structural and semantic authority boundaries', () => {
  const source = read('48-p78-data7-adapter-implementation.md');
  [
    'DATA7_ADAPTER_IMPLEMENTED_NOT_WIRED',
    'NOT_WIRED_TO_P78_SHELL',
    'p78-data7-adapter.js',
    'semantic-p78-data7-adapter-regression.cjs',
    'SEGMENT', 'ORBIT', 'LINK_CANDIDATE',
    'meridian.data7-segment/1',
    'UTF-16 code units',
    'DIRECTED_GREEDY',
    'improvementStatus',
    'alphaTransitionReceipt',
    'EXACT_CONTEXT_COOCCURRENCE',
    'CO_OCCURS_WITH',
    'REQUIRES_REVIEW',
    'finalRelation',
    'CLAIM_REFERENCE_LOSS',
    'LINK_WITNESS_ALPHA_MISMATCH',
    'PASS: 20/20 checks',
    'PASS: 19/19 checks',
    'EvidenceBackedLinkAdapter',
  ].forEach((needle) => assert(source.includes(needle), `Data7Adapter report missing ${needle}`));
  assert(/edge[^\n]*null/.test(source), 'edge-null authority boundary missing');
  assert(/list ordering != alpha artifact transition/.test(source), 'list/alpha distinction missing');
  assert(source.includes('HTML, Canvas, action controller, ledger и текст пользователя не изменены.'), 'not-wired boundary missing');
  assert(/SYNTHESIZE[\s\S]*RATIONALIZE/.test(source), 'forbidden operation inventory missing');
});

check('EvidenceBackedLinkAdapter report records full replay without final semantic authority', () => {
  const source = read('49-p78-evidence-backed-link-adapter-implementation.md');
  [
    'EVIDENCE_BACKED_LINK_ADAPTER_IMPLEMENTED_NOT_WIRED',
    'NOT_WIRED_TO_P78_SHELL',
    'p78-evidence-backed-link-adapter.js',
    'semantic-p78-evidence-backed-link-adapter-regression.cjs',
    'meridian.data7-evidence-backed-link-proposal/1',
    'EVIDENCE_BACK_LINK',
    'PASSAGE_TO_TARGET',
    'REPLAY_REQUIRED',
    'FULL_BUNDLE_REPLAY',
    'EVIDENCE_BACKED_PROPOSAL',
    'SUPPORTS', 'REFUTES', 'QUALIFIES',
    'QUALIFIES_DIRECTION_UNPROVEN',
    'CO_OCCURS_WITH -> ASSOCIATES',
    'MENTIONS       -> ASSOCIATES',
    'AlphaEdge.status = PROPOSED',
    'STRUCTURALLY_VALID', 'STRUCTURE_ONLY', 'NOT_PERFORMED',
    'REFERENTIAL_REPLAY', 'PERFORMED',
    'REQUIRES_REVIEW',
    'finalRelation      = NOT_COMPUTED',
    'semanticTruth      = false',
    'commitAllowed      = false',
    'LinguisticStructureIndex.replay',
    'Evidence.createSourcePassage',
    'PASS: 23/23 checks',
    'HumanReviewDecisionContract',
    'EvidenceBackedLinkView',
  ].forEach((needle) => assert(source.includes(needle), `EvidenceBackedLinkAdapter report missing ${needle}`));
  assert(/generic EvidenceCandidate: VALID[\s\S]*fake hitId replay: REJECTED/.test(source), 'fake-hit dereference gap missing');
  assert(/REVIEWED[\s\S]*SUPPORTED[\s\S]*REFUTED[\s\S]*ACCEPTED_EVIDENCE/.test(source), 'forbidden authority inventory missing');
  assert(source.includes('alphaTransitionReceipt` всегда равен `null`'), 'alpha receipt boundary missing');
  assert(source.includes('Она никогда не возвращает referential `VALID`.'), 'shape/replay validation boundary missing');
  assert(/NARROWER[\s\S]*BROADER/.test(source), 'QUALIFIES direction boundary missing');
  assert(source.includes('p78-living-ring-interface.html'), 'shell non-integration boundary missing');
});

check('QualifierDirectionContract report defines the bounded directional subset and v2 integration', () => {
  const source = read('50-p78-qualifier-direction-contract-implementation.md');
  [
    'QUALIFIER_DIRECTION_CONTRACT_IMPLEMENTED_NOT_WIRED',
    'NOT_WIRED_TO_P78_SHELL',
    'p78-qualifier-direction-contracts.js',
    'semantic-p78-qualifier-direction-contracts-regression.cjs',
    'meridian.qualifier-direction-contracts/2',
    'meridian.qualifier-direction-assessment/2',
    'meridian.data7-evidence-backed-link-proposal/2',
    'p78-evidence-backed-link-adapter@1.4.0',
    'SINGLE_CONTROLLED_METHOD_CLAUSE_DELTA',
    'SYNTACTIC_SPECIFICITY',
    'PASSAGE_TO_TARGET',
    'DIRECTED', 'ABSTAIN',
    'NARROWER', 'BROADER',
    'MethodWitness',
    'MODALITY_MISMATCH', 'QUANTIFIER_MISMATCH',
    'QUALIFIER_VALUE_CONFLICT',
    'QUALIFIER_KEY_UNSUPPORTED',
    'PARSE_REPLAY_MISMATCH',
    'QUALIFIES_ENDPOINT_DIRECTION_MISMATCH',
    'QUALIFIER_DIRECTION_POLICY_STALE',
    'CLAIM_TEXT_BUDGET_EXCEEDED',
    'STRUCTURALLY_VALID', 'STRUCTURE_ONLY', 'NOT_PERFORMED',
    'PARSE_BUNDLE_REPLAY', 'PERFORMED', 'NOT_CLAIMED',
    'AlphaEdge(status:PROPOSED)',
    'alphaTransitionReceipt = null',
    'REQUIRES_REVIEW',
    'semanticTruth = false',
    'commitAllowed = false',
    'PASS: 15/15 checks',
    'PASS: 23/23 checks',
    'PASS: 26/26 checks',
    'EvidenceBackedLinkView',
    'HumanReviewDecisionContract',
  ].forEach((needle) => assert(source.includes(needle), `QualifierDirection report missing ${needle}`));
  assert(/scopeDirection = NARROWER[\s\S]*qualifiedSide = PASSAGE/.test(source), 'NARROWER witness rule missing');
  assert(/scopeDirection = BROADER[\s\S]*qualifiedSide = TARGET/.test(source), 'BROADER diagnostic rule missing');
  assert(/BROADER[\s\S]*QUALIFIES_ENDPOINT_DIRECTION_MISMATCH/.test(source), 'BROADER endpoint guard missing');
  assert(/SUPPORTS[\s\S]*null[\s\S]*REFUTES[\s\S]*null[\s\S]*QUALIFIES/.test(source), 'proposal assessment population rule missing');
});
check('EvidenceBackedLinkView report records bound replay, passive wiring and source authority boundary', () => {
  const source = read('51-p78-evidence-backed-link-view-implementation.md');
  [
    'EVIDENCE_BACKED_LINK_VIEW_WIRED_PASSIVE',
    'meridian.evidence-backed-link-validation-report/1',
    'meridian.evidence-backed-link-view-model/1',
    'p78-evidence-backed-link-adapter@1.4.0',
    'p78-evidence-backed-link-projector.js',
    'p78-evidence-backed-link-view.js',
    'p78-evidence-backed-link-runner.js',
    'p78-evidence-backed-link-worker.js',
    'p78-evidence-backed-link-view.css',
    'semantic-p78-evidence-backed-link-projector-regression.cjs',
    'semantic-p78-evidence-backed-link-view-regression.cjs',
    'semantic-p78-evidence-backed-link-runner-regression.cjs',
    'browser-p78-evidence-backed-link.cjs',
    'REPLAY_BINDING_INVALID',
    'REPLAY_BUNDLE_BINDING_INVALID',
    'SOURCE_AUTHORITY_UNVERIFIED',
    'PASSAGE -> TARGET',
    'SELF_LINK_FORBIDDEN',
    'TARGET_NOT_IN_COMMON_SOURCE',
    'MAX_SCAN_CANDIDATES',
    'REFERENTIAL_REPLAY = PERFORMED',
    'REQUIRES_REVIEW',
    'semanticTruth = false',
    'commitAllowed = false',
    'PASS: 26/26 checks',
    'PASS: 18/18 checks',
    'PASS: 60/60 suites, 765/765 checks',
    'PASS: 15/15 checks',
    'PASS: 6/6 checks',
    'PASS: 14/14 checks',
    'HumanReviewDecisionContract',
  ].forEach((needle) => assert(source.includes(needle), `EvidenceBackedLinkView report missing ${needle}`));
  assert(/REPLAY_REQUIRED[\s\S]*PERFORMED[\s\S]*UNVERIFIED[\s\S]*REQUIRES_REVIEW[\s\S]*NOT_COMPUTED/.test(source), 'replay/authority boundary ordering missing');
});


check('all local Markdown links in the bundle resolve', () => {
  const missing = [];
  for (const name of filenames) {
    const filename = path.join(docsRoot, name);
    const source = fs.readFileSync(filename, 'utf8');
    const links = [...source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
    for (let target of links) {
      if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
      target = target.split('#')[0].replace(/^<|>$/g, '');
      if (!target) continue;
      const resolved = path.resolve(path.dirname(filename), target);
      if (!fs.existsSync(resolved)) missing.push(`${name} -> ${target}`);
    }
  }
  assert(missing.length === 0, `unresolved links: ${missing.join(', ')}`);
});

check('project documentation index links the complete bundle', () => {
  const index = read('00-README.md');
  for (const name of filenames) assert(index.includes(`](${name})`), `${name} is absent from docs index`);
  assert(index.includes('](32-p78-formula-ring-implementation.md)'), 'formula implementation status is absent from docs index');
  assert(index.includes('](33-ast-grep-semantic-ring-adaptation.md)'), 'AST/grep branch is absent from docs index');
  assert(index.includes('](34-p78-bidirectional-index-implementation.md)'), 'bidirectional implementation status is absent from docs index');
  assert(/source-backed AG4/.test(index), 'completed AG4 status missing from index');
  assert(/post-hoc FlowFrame/.test(index), 'completed flow projection status missing from index');
  assert(/внешний holdout-пилот[^\n]*готовы/.test(index) && /BLOCKED_FOR_AG5/.test(index), 'holdout status missing from index');
  assert(/35-p78-controlled-russian-claim-ast-implementation\.md/.test(index), 'Claim AST implementation status is absent from docs index');
  assert(/scheduler[^\n]*AG5 не подключены/.test(index), 'scheduler and AG5 boundary missing from index');
  assert(/51-p78-evidence-backed-link-view-implementation\.md/.test(index) && /пассивный evidence-backed view готовы/.test(index), 'passive evidence view status missing from index');
  assert(!/следующий этап: source-backed AG4/.test(index), 'stale AG4 next-step status remains in index');
});

for (const item of checks) {
  process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? ` | ${item.detail}` : ''}\n`);
}
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
process.exitCode = passed === checks.length ? 0 : 1;
