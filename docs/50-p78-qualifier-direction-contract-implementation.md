# P78: направленный QUALIFIES с полным parser replay

Статус: `QUALIFIER_DIRECTION_CONTRACT_IMPLEMENTED_NOT_WIRED`

Runtime: `NOT_WIRED_TO_P78_SHELL`

Дата фиксации: 2026-07-21

Связанные реализации:

- [`../prototype/lib/p78-qualifier-direction-contracts.js`](../prototype/lib/p78-qualifier-direction-contracts.js);
- [`../prototype/lib/p78-evidence-backed-link-adapter.js`](../prototype/lib/p78-evidence-backed-link-adapter.js);
- [`../prototype/lib/p78-linguistic-parser-adapter.js`](../prototype/lib/p78-linguistic-parser-adapter.js);
- [`../prototype/tests/semantic-p78-qualifier-direction-contracts-regression.cjs`](../prototype/tests/semantic-p78-qualifier-direction-contracts-regression.cjs);
- [`../prototype/tests/semantic-p78-evidence-backed-link-adapter-regression.cjs`](../prototype/tests/semantic-p78-evidence-backed-link-adapter-regression.cjs);
- [`../prototype/tests/semantic-p78-linguistic-parser-regression.cjs`](../prototype/tests/semantic-p78-linguistic-parser-regression.cjs).

Документ продолжает историческую реализацию [`49-p78-evidence-backed-link-adapter-implementation.md`](49-p78-evidence-backed-link-adapter-implementation.md). Версия 1 evidence-backed adapter разрешала только `SUPPORTS/REFUTES`, потому что общий EvidenceCandidate `QUALIFIES` не задавал направление. Текущий этап добавляет узкий направленный случай, но не вводит автоматическую истинность, логическое следование, human review или изменение пользовательского текста.

---

## 1. Почему простого NARROWER/BROADER было недостаточно

Первый черновой вариант сравнивал ключи `ClaimAst.qualifiers` как множества. Независимый аудит выявил две ошибки такого подхода.

Во-первых, Claim AST можно было передать отдельно от полного parser result. Искусственно созданный qualifier мог пройти структурную проверку без доказательства, что его действительно извлёк текущий parser.

Во-вторых, наличие ключа само по себе не доказывает грамматику ограничения. Например, старый parser сохранял для `до процесса` и `после процесса` одинаковое значение `time = процесса`, теряя оператор. Объявить любое добавление `time`, `place`, `condition` или `measure` сужением было бы ложной точностью.

Поэтому широкая модель заменена на более узкий контракт:

```text
meridian.qualifier-direction-contracts/2
meridian.qualifier-direction-assessment/2
```

Он поддерживает только один контролируемый синтаксический шаблон:

```text
через <один разрешённый METHOD-токен>
```

И называет результат не логической областью истинности, а:

```text
directionDomain = SYNTACTIC_SPECIFICITY
```

---

## 2. Что означает направление

Ориентация assessment всегда задана явно:

```text
orientation = PASSAGE_TO_TARGET
```

Направление относится к passage относительно target.

### 2.1. NARROWER

```text
target:  Система проверяет документ.
passage: Система проверяет документ через формулу.
```

После удаления двух токенов `через формулу` нормализованные токены passage должны точно совпасть с target. Parser обязан одновременно создать:

```text
qualifiers.method = формулу
argument.role = METHOD
argument.senseId = p78:sense:formula.expression
```

Тогда:

```text
status = DIRECTED
scopeDirection = NARROWER
witness.qualifiedSide = PASSAGE
```

Это единственное направление, которое EvidenceBackedLinkAdapter может преобразовать в ребро:

```text
passage --QUALIFIES/PROPOSED--> target
```

### 2.2. BROADER

```text
target:  Система проверяет документ через формулу.
passage: Система проверяет документ.
```

Standalone contract может диагностировать:

```text
status = DIRECTED
scopeDirection = BROADER
witness.qualifiedSide = TARGET
```

Но passage в этом случае не сужает target. Создать то же ребро passage -> target было бы ошибкой направления. Поэтому adapter возвращает:

```text
QUALIFIES_ENDPOINT_DIRECTION_MISMATCH
```

Adapter не переворачивает endpoint автоматически. Обратное ребро потребовало бы отдельного Data7 link identity и нового полного replay.

---

## 3. Решаемый поднабор

Обе фразы должны повторно разбираться одним parser и одним lexicon. Допустимый направленный случай требует:

```text
predicate(target) = predicate(passage)
coreArguments(target) = coreArguments(passage)
polarity(target) = polarity(passage)
modality(target) = modality(passage)
quantifier(target) = quantifier(passage)
```

Дополнительно:

1. одна сторона не имеет qualifiers;
2. другая сторона имеет ровно `method`;
3. qualified side имеет ровно один аргумент `METHOD`;
4. `METHOD.senseId` не равен `null`;
5. в tokens имеется ровно один маркер `через`;
6. следующий токен совпадает с `qualifiers.method`;
7. его surface совпадает с `surfaceBySpanId[METHOD.surfaceSpanId]`;
8. `METHOD.surfaceSpanId` заново вычисляется из точных `inputHash`, `offset` и длины value token;
9. после удаления буквального `через <METHOD>` остаток исходной строки полностью совпадает, включая регистр, пунктуацию и пробелы;
10. EvidenceCandidate alignment byte-consistent с обеими replayed Claim AST;
11. EvidenceCandidate имеет `QUALIFIES` и `STRUCTURALLY_ALIGNED`.

Basis имеет точное имя:

```text
SINGLE_CONTROLLED_METHOD_CLAUSE_DELTA
```

Это не общий алгоритм включения qualifier sets.

---

## 4. Полный входной bundle

Factory принимает:

```text
targetParseResult
passageParseResult
evidenceCandidate
```

Оба parse result содержат:

```text
inputHash
resultHash
parserRef
lexiconHash
claimAst
surfaceBySpanId
tokens
dependencies
issues
```

Контракт извлекает исходную строку из claim source span, проверяет её hash и самостоятельно вызывает:

```text
Parser.replay(source, { expectedLexiconHash, maxTokens: max(32, parseResult.tokens.length) })
```

Затем весь replayed parse result сравнивается канонически с входным. Поэтому подмена Claim AST с пересчитанным `resultHash` не помогает: parser снова получит AST из исходной строки, и контракт вернёт:

`maxTokens` здесь не доверяется вызывающей стороне и не меняет анализ: он восстанавливается как достаточная граница из уже заявленного числа токенов, после чего весь результат всё равно должен совпасть byte-for-byte.

```text
PARSE_REPLAY_MISMATCH
```

Наличие одного content-addressed `claimAstId` без parse bundle недостаточно.

---

## 5. DIRECTED и ABSTAIN

Неопределённость не представляется исключением или произвольным fallback. Валидный bundle всегда получает content-addressed assessment одного из двух типов.

### 5.1. DIRECTED

```text
status = DIRECTED
scopeDirection = NARROWER | BROADER
witness != null
abstainCode = null
```

### 5.2. ABSTAIN

```text
status = ABSTAIN
scopeDirection = null
witness = null
abstainCode != null
```

Например:

```text
Возможно система проверяет документ.
=> MODALITY_MISMATCH

Все системы проверяют документ.
=> QUANTIFIER_MISMATCH

Система проверяет документ сейчас.
=> QUALIFIER_KEY_UNSUPPORTED
```

Malformed hashes, unknown fields, подмена refs, accessor properties и parser replay mismatch не являются обычным semantic abstention. Они делают вход `INVALID` и выбрасывают contract error.

---

## 6. Почему модальность и квантор не упорядочиваются

Claim AST поддерживает modality:

```text
FACT
REPORTED
DERIVED
HYPOTHESIS
INTERPRETATION
```

и quantifier:

```text
ONE
SOME
ALL
MOST
NONE
UNSPECIFIED
```

Эти значения не образуют готовую линейную шкалу смысловой ширины. Для кванторов требуются domain assumptions, область отрицания и правила вывода. Для modality речь идёт об эпистемическом статусе, а не о множестве обстоятельств.

Поэтому контракт не содержит фиктивных таблиц:

```text
FACT > HYPOTHESIS
ALL > MOST > SOME > ONE
```

Вместо этого он создаёт воспроизводимый `ABSTAIN`.

---

## 7. MethodWitness

Положительный assessment содержит witness:

```text
qualifiedSide
qualifierKey
markerToken
markerTokenIndex
valueTokenIndex
valueSurfaceSpanId
valueSenseId
qualifierValueHash
```

Инварианты:

```text
qualifierKey = method
markerToken = через
valueTokenIndex = markerTokenIndex + 1
NARROWER => qualifiedSide = PASSAGE
BROADER  => qualifiedSide = TARGET
```

Witness связывает направление не только с ключом Claim AST, но и с конкретным токеном, surface span и sense.

---

## 8. Поля assessment

Output record содержит:

```text
schema
version
relation
orientation
directionDomain
basis
status
scopeDirection
targetClaimRef
passageClaimRef
targetParseRef
passageParseRef
evidenceCandidateRef
witness
abstainCode
evaluatorRef
verificationStatus
validationRequirement
authority
logicalImplication
reviewStatus
semanticTruth
soundness
commitAllowed
assessmentId
contentHash
```

Граница полномочий закреплена значениями:

```text
relation = QUALIFIES
verificationStatus = REPLAY_REQUIRED
validationRequirement = FULL_PARSE_REPLAY
authority = STRUCTURAL_SCOPE_ONLY
logicalImplication = NOT_COMPUTED
reviewStatus = REQUIRES_REVIEW
semanticTruth = false
soundness = NOT_COMPUTED
commitAllowed = false
```

---

## 9. Зафиксированный ruleset

Правила направления представлены отдельным каноническим descriptor и hash:

```text
rulesetHash = sha256:7321414f2ef9fbc5238deee20db4615f210bf05b72bc44d14c5e790b6f13ba34
```

EvidenceBackedLinkAdapter проверяет одновременно:

```text
version = 2.1.0
schema = meridian.qualifier-direction-contracts/2
outputSchema = meridian.qualifier-direction-assessment/2
basis = SINGLE_CONTROLLED_METHOD_CLAUSE_DELTA
rulesetHash = pinned value
```

Несовместимая dependency блокирует adapter:

```text
QUALIFIER_DIRECTION_DEPENDENCY_INCOMPATIBLE
```

Изменённый ruleset под прежней версией блокируется кодом:

```text
QUALIFIER_DIRECTION_POLICY_STALE
```

---

## 10. Две проверки и точные названия scope

### 10.1. Shape inspection

```text
inspectQualifierDirectionShape(record)
```

Успех означает только:

```text
status = STRUCTURALLY_VALID
validationScope = STRUCTURE_ONLY
parserReplay = NOT_PERFORMED
referentialReplay = NOT_CLAIMED
```

Rehashed record с обратным направлением может быть структурно самосогласованным. Ни один decision path не имеет права принимать shape inspection как доказательство bundle.

### 10.2. Parse bundle replay

```text
validateQualifierDirectionAgainst(record, definition)
```

Успех означает:

```text
status = VALID
validationScope = PARSE_BUNDLE_REPLAY
parserReplay = PERFORMED
referentialReplay = NOT_CLAIMED
```

Контракт не заявляет replay SourceSnapshot, SearchHit или corpus index. Такой полный referential replay выполняет только внешний EvidenceBackedLinkAdapter.

---

## 11. Интеграция с EvidenceBackedLinkAdapter

Адаптер использует:

```text
p78-evidence-backed-link-adapter@1.4.0
meridian.data7-evidence-backed-link-proposal/2
```

Proposal имеет поле:

```text
qualifierDirectionAssessment
```

Правило заполнения:

```text
SUPPORTS -> null
REFUTES  -> null
QUALIFIES + DIRECTED/NARROWER -> full assessment/2
QUALIFIES + DIRECTED/BROADER  -> rejected endpoint direction
QUALIFIES + ABSTAIN           -> rejected semantic promotion
```

Adapter сначала выполняет полный Data7/Search/Claim replay, а затем передаёт именно полученные parser results в direction contract. Внешний вызывающий код не может вложить собственный assessment в proposal factory.

Для ABSTAIN adapter возвращает:

```text
QUALIFIES_DIRECTION_ABSTAIN: <abstainCode>
```

Для BROADER:

```text
QUALIFIES_ENDPOINT_DIRECTION_MISMATCH
```

---

## 12. Почему это остаётся 2D

`QUALIFIES` является горизонтальным Alpha relation. Оба endpoint имеют один `alpha` и один `kind`:

```text
passage(alpha = a) --QUALIFIES--> target(alpha = a)
```

`NARROWER` здесь не преобразуется автоматически в `SPECIALIZES`, а `BROADER` не преобразуется в `GENERALIZES`. Синтаксическая специфичность и радиальное перемещение между девятью α-орбитами являются разными операциями.

Поэтому proposal сохраняет:

```text
alphaTransitionReceipt = null
```

Для direction contract не нужны 1D-код или 3D-центр. Он является самостоятельным механизмом внутри 2D evidence graph.

---

## 13. Ранний ресурсный guard parser

Data7 segment может быть значительно больше одной контролируемой фразы. Раньше parser выполнял `trim`, whole-string hash allocation и `Language.analyze` до проверки token budget. Для длинного входа это создавало ненужные затраты памяти и дорогой анализ.

Parser adapter `1.1.0` экспортирует:

```text
limits.maxClaimCodeUnits = 8192
```

До `trim`, whole-string hash allocation и `Language.analyze` выполняется:

```text
if rawSource.length > 8192:
    return CLAIM_TEXT_BUDGET_EXCEEDED
```

Для oversized rejection поле `inputHash` содержит доменно разделённую цепочку SHA-256 по блокам 4096 code units. Цепочка учитывает каждый code unit, сохраняет точную content binding при стандартном допущении стойкости SHA-256 и избегает whole-input byte array; CPU остаётся `O(n)`, transient memory для hashing остаётся `O(4096)`. Claim AST при этом не создаётся.

Token budget остаётся второй независимой границей после дешёвого length guard.

До schema validation оба новых semantic scanner также считают не только объекты, но все посещённые значения и суммарный объём строк:

```text
QualifierDirection.maxGraphValues = 200000
QualifierDirection.maxGraphCodeUnits = 2000000
EvidenceBackedLinkAdapter.maxGraphValues = 1000000
EvidenceBackedLinkAdapter.maxGraphCodeUnits = 64000000
```

Для массивов primitive values длина проверяется до `Object.getOwnPropertyNames`, поэтому очень широкий массив не заставляет scanner сначала полностью перечислить себя.

---

## 14. Коды ABSTAIN

| Код | Значение |
|---|---|
| `RELATION_NOT_QUALIFIES` | candidate относится к другому relation |
| `STRUCTURAL_ALIGNMENT_REQUIRED` | отсутствует structural alignment |
| `PREDICATE_MISMATCH` | разные предикаты |
| `CORE_ARGUMENT_MISMATCH` | разные основные аргументы |
| `POLARITY_MISMATCH` | разная полярность |
| `MODALITY_MISMATCH` | различается modality |
| `QUANTIFIER_MISMATCH` | различается quantifier |
| `NO_QUALIFIER_DELTA` | направленного qualifier delta нет |
| `QUALIFIER_KEY_UNSUPPORTED` | встретился qualifier кроме method |
| `QUALIFIER_VALUE_CONFLICT` | обе стороны имеют разные method values |
| `QUALIFIER_SETS_INCOMPARABLE` | наборы нельзя ориентировать |
| `MULTIPLE_QUALIFIER_DELTA_UNSUPPORTED` | delta содержит больше одной оси |
| `METHOD_BINDING_UNPROVEN` | method не связан с одним METHOD argument |
| `METHOD_SURFACE_PATTERN_UNPROVEN` | нет точного `через <token>` |
| `TOKEN_REMAINDER_MISMATCH` | после удаления method clause фразы различаются |

---

## 15. Коды INVALID и BLOCKED

| Код | Значение |
|---|---|
| `PARSE_REPLAY_MISMATCH` | входной parser result не воспроизводится |
| `TARGET_CLAIM_REFERENCE_MISMATCH` | candidate не относится к target |
| `PASSAGE_CLAIM_REFERENCE_MISMATCH` | candidate не относится к passage |
| `CANDIDATE_ALIGNMENT_MISMATCH` | alignment не соответствует replayed claims |
| `QUALIFIER_DIRECTION_BUNDLE_MISMATCH` | assessment не воспроизводится против parse bundle |
| `QUALIFIES_DIRECTION_REFERENCE_MISMATCH` | proposal и assessment имеют разные refs |
| `QUALIFIES_DIRECTION_PARSE_REFERENCE_MISMATCH` | passage parse не совпадает с SourcePassage |
| `QUALIFIER_DIRECTION_POLICY_STALE` | ruleset hash изменён |
| `CLAIM_TEXT_BUDGET_EXCEEDED` | claim превышает ранний character budget |
| `INPUT_GRAPH_BUDGET_EXCEEDED` | превышено число data nodes |
| `INPUT_GRAPH_DEPTH_EXCEEDED` | превышена глубина data graph |
| `AUTHORITY_BOUNDARY_VIOLATION` | попытка объявить truth, implication или commit |

---

## 16. Регрессионные проверки

Parser:

```text
PASS: 15/15 checks
```

Включена trap-проверка, что при `CLAIM_TEXT_BUDGET_EXCEEDED` `Language.analyze` не вызывается.

QualifierDirectionContract:

```text
PASS: 23/23 checks
```

Проверены:

1. versioned ruleset hash;
2. token-backed `NARROWER`;
3. диагностический `BROADER`;
4. deterministic parser replay;
5. replay parse result с явно заданным `maxTokens > 32`;
6. буквальный source remainder с учётом регистра, пунктуации и пробелов;
7. positional METHOD span при повторяющейся лексеме;
8. честная shape boundary;
9. `PARSE_BUNDLE_REPLAY`;
10. modal ABSTAIN;
11. quantifier ABSTAIN;
12. method value conflict;
13. unsupported time qualifier;
14. non-QUALIFIES ABSTAIN;
15. endpoint/ref reversal;
16. fabricated AST rejection;
17. rehashed direction forgery;
18. authority escalation;
19. hidden/symbol/accessor input;
20. graph depth budget;
21. wide-value и aggregate-text budgets;
22. parser dependency gate;
23. отсутствие DOM/network/clock/random/eval/commit.

EvidenceBackedLinkAdapter:

```text
PASS: 26/26 checks
```

В его наборе `NARROWER` создаёт только `AlphaEdge(status:PROPOSED)`, `BROADER` блокируется, modal-only candidate остаётся ABSTAIN, а stale ruleset блокирует весь adapter до обработки данных.

---

## 17. Что результат не доказывает

Даже `DIRECTED/NARROWER` не доказывает:

- истинность target или passage;
- логическое следование passage из target;
- фактическую надёжность источника;
- независимость источников;
- полноту корпуса;
- причинность;
- эквивалентность синонимов;
- правильную интерпретацию произвольной русской фразы;
- готовность связи к `REVIEWED`;
- право изменить пользовательский текст.

Максимальная authority proposal:

```text
relationStatus = PROPOSED
reviewStatus = REQUIRES_REVIEW
finalRelation = NOT_COMPUTED
semanticTruth = false
soundness = NOT_COMPUTED
commitAllowed = false
```

---

## 18. Что не подключено

Не изменены:

```text
p78-living-ring-interface.html
p78.js
p78.css
Canvas painter
reaction kernel
frame scheduler
action controller
ledger
user text
```

Parser replay выполняется только по явной evidence-команде, а не внутри `requestAnimationFrame` и не для каждой вращающейся частицы.

---

## 19. Реализованное пассивное продолжение

Пассивный `EvidenceBackedLinkView` и отдельный bounded projector реализованы в [`51-p78-evidence-backed-link-view-implementation.md`](51-p78-evidence-backed-link-view-implementation.md). Интерфейс теперь честно показывает:

```text
SUPPORTS
REFUTES
QUALIFIES / DIRECTED / NARROWER
PASSAGE -> TARGET
ABSTAIN / rejection / skipped reason
SOURCE_AUTHORITY_UNVERIFIED
```

Аудит изменил первоначальный план: View не принимает свободную пару `proposal + validation report`. Adapter 1.4 формирует bound report с `subjectRef` и полным `evidenceBundleRef`, projector выполняет replay в Web Worker и выпускает малый content-addressed ViewModel. DOM View принимает только immutable snapshot этой модели, не принимает relation, не создаёт Alpha receipt и не имеет commit action.

Минимальная проекция:

- target и passage text;
- source ID, revision и UTF-16 coordinates;
- `PASSAGE_TO_TARGET`;
- relation, status и directionDomain;
- MethodWitness;
- parser/query/index/lexicon/ruleset pins;
- hit/context counts;
- `STRUCTURALLY_VALID` против полного adapter `VALID`;
- `PROPOSED`, `REQUIRES_REVIEW`, `semanticTruth:false`;
- явный abstain или endpoint mismatch.

Следующим отдельным этапом остаётся `HumanReviewDecisionContract`. Он должен ссылаться на точный `proposalId`, bound replay report, policy version и reviewer receipt. Наличие `sourceRefs` или успешного локального replay не даёт права повысить edge до `REVIEWED`.
