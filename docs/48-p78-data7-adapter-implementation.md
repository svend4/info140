# Реализация безопасного Data7Adapter для P78

Статус: `DATA7_ADAPTER_IMPLEMENTED_NOT_WIRED`

Runtime-статус: `NOT_WIRED_TO_P78_SHELL`.

Дата реализации: 2026-07-21.

Связанные документы:

- [Data7 Knowledge System: форма, содержание и безопасная адаптация](47-data7-knowledge-system-form-content-and-p78-adaptation.md);
- [Девять семантических орбит и α-автомат](45-p78-nine-semantic-orbits-and-alpha-automaton.md);
- [Реализация контрактов девяти α-орбит](46-p78-alpha-orbit-contracts-implementation.md);
- [Научное слияние и расщепление](30-scientific-synthesis-fission-fusion-spec.md);
- [Осмысленное продолжение и информационный ресайклинг](42-p78-meaningful-continuation-and-information-recycling-spec.md).

Исполняемые файлы:

```text
prototype/lib/p78-data7-adapter.js
prototype/tests/semantic-p78-data7-adapter-regression.cjs
```

---

## 1. Что реализовано

Добавлен автономный статический IIFE-модуль `MRDP78Data7Adapter` версии `1.0.0`. Он переносит из `data7` только три ограниченные технические формы:

```text
SEGMENT
ORBIT
LINK_CANDIDATE
```

Модуль не импортирует Python-код и не повторяет неподтверждённые семантические эвристики `data7`. Он использует локальные контракты P78:

```text
MRDP78CanonicalJSON
MRDP78SearchContracts
MRDP78AlphaOrbitContracts
```

При отсутствии любой зависимости экспортируется:

```json
{
  "status": "BLOCKED",
  "code": "DATA7_ADAPTER_DEPENDENCY_UNAVAILABLE",
  "semanticTruth": false,
  "commitAllowed": false
}
```

Граница полномочий всего API:

```text
authority     = STRUCTURAL_ONLY
semanticTruth = false
soundness     = NOT_COMPUTED
commitAllowed = false
```

HTML, Canvas, action controller, ledger и текст пользователя не изменены.

---

## 2. Почему первоначальный проект был ужесточён

Первоначально рассматривалась возможность представить перестановку списка как α-операцию `ORBIT` через искусственные before/after artifacts и transition receipt. Независимый read-only аудит показал, что это смешивает разные сущности:

- α-`ORBIT` заменяет один артефакт другим артефактом того же `alpha/kind`;
- Data7-`ORBIT` переставляет ссылки на несколько неизменённых сегментов;
- порядок списка является свойством workflow/представления, а не новым утверждением или уровнем абстракции.

Поэтому реализовано правило:

```text
list ordering != alpha artifact transition
```

Результат Data7-`ORBIT` обязательно содержит:

```json
{
  "improvementStatus": "NOT_COMPUTED",
  "alphaTransitionReceipt": null
}
```

Аналогично, общий источник или соседство двух spans не доказывает семантическое отношение `ASSOCIATES`, `SUPPORTS`, `REFUTES` либо `QUALIFIES`. Первый безопасный `LINK_CANDIDATE` фиксирует только наблюдаемое расположение:

```text
relation      = CO_OCCURS_WITH
basis         = EXACT_CONTEXT_COOCCURRENCE
edge          = null
finalRelation = NOT_COMPUTED
reviewStatus  = REQUIRES_REVIEW
```

До полного evidence bundle никакой `AlphaEdge` и никакой LINK transition receipt не создаются.

---

## 3. `SEGMENT`: точное разбиение SourceSnapshot

### 3.1. Вход

```js
createSegmentBatch(sourceSnapshot, {
  alpha: 0,
  locators: [
    { start: 0, end: 18, label: 'Сегмент 1' }
  ]
})
```

`sourceSnapshot` должен пройти `MRDP78SearchContracts.validateSourceSnapshot()` и иметь статус `ADMITTED`.

Позиции `start/end` считаются в UTF-16 code units, то есть в тех же индексах, которые использует JavaScript `String.prototype.slice()` и текущие source/evidence contracts P78. Это важно при обмене с Python: Python по умолчанию считает Unicode code points, а не UTF-16 code units.

### 3.2. Ограничения

1. В одном batch допускается от 1 до 32 spans.
2. Входные locators могут поступать в любом порядке, но результат канонически сортируется по `start/end/label`.
3. Перекрывающиеся spans запрещены.
4. `end` не может выходить за длину source text.
5. Пустой span запрещён.
6. Адаптер не выполняет скрытый `trim()`.
7. Если точный span начинается или заканчивается пробелом, операция отклоняется с `SEGMENT_BOUNDARY_WHITESPACE`.
8. Неизвестные, скрытые, symbol и accessor fields запрещены.

### 3.3. Выходной Segment

Схема:

```text
meridian.data7-segment/1
```

Каждый Segment содержит:

```text
sourceRef.sourceId
sourceRef.revision
sourceRef.language
sourceRef.textHash
sourceRef.sourceHash
locator.start/end
label
exact text
textHash
AlphaArtifact
segmentId
contentHash
```

Тело α-артефакта байтово соответствует точному `source.text.slice(start,end)`. Артефакт создаётся только со статусом `DRAFT`:

```json
{
  "claimRefs": [],
  "sourceRefs": ["<SourceSnapshot.sourceHash>"],
  "qualifiers": ["EXACT_SOURCE_SPAN", "SEGMENT_ONLY"],
  "authority": "DRAFT",
  "semanticTruth": false,
  "soundness": "NOT_COMPUTED"
}
```

Важно: `SourceSnapshot.sourceHash`, а не `sourceId`, `sourceSpanId` или `sourceSetHash`, входит в `AlphaArtifact.sourceRefs`.

### 3.4. Coverage

Batch сообщает только структурное покрытие:

```json
{
  "coveredCodeUnits": 54,
  "totalCodeUnits": 61,
  "complete": false
}
```

`complete=true` устанавливается только тогда, когда spans без разрывов покрывают весь SourceSnapshot от позиции `0` до `text.length`. Это не мера полноты смысла и не показатель качества декомпозиции.

---

## 4. `ORBIT`: направленное упорядочение

### 4.1. Область операции

`ORBIT` принимает только валидные Segment records. Все сегменты одного маршрута обязаны иметь:

- одинаковый α;
- одинаковый `kind`;
- одинаковый язык;
- уникальные `segmentId`;
- точные content-addressed ссылки на source и AlphaArtifact.

Сегменты могут происходить из разных SourceSnapshot одного языка. Их текст и α-артефакты не изменяются.

### 4.2. Матрица стоимости

Для `n` сегментов требуется ровно `n*(n-1)` направленных записей:

```js
{
  fromSegmentId,
  toSegmentId,
  cost
}
```

Свойства:

```text
d(A,B) may differ from d(B,A)
0 <= cost <= 1,000,000
self cost is forbidden
duplicate pair is forbidden
missing pair is forbidden
foreign segment id is forbidden
```

Входные строки матрицы сортируются канонически. Поэтому перестановка строк costs не меняет `proposalId` и `contentHash`.

### 4.3. Алгоритм

В версии `1.0.0` реализован только:

```text
DIRECTED_GREEDY
```

Стартовый сегмент задаётся явно. На каждом шаге выбирается ещё не посещённый сегмент с минимальной направленной стоимостью из текущего. При равной стоимости используется лексикографический порядок content-addressed `segmentId`.

Это обеспечивает детерминированность, но не гарантирует глобальный оптимум TSP.

### 4.4. Запрет формального движения

Если рассчитанный `afterOrder` совпадает с `beforeOrder`, операция отклоняется:

```text
ORBIT_PROGRESS_REQUIRED
```

Адаптер не создаёт новую запись только ради того, чтобы показать активность.

### 4.5. Что измерено и что не измерено

`pathCost` является честной суммой предоставленных направленных costs вдоль рассчитанного маршрута. Но смысл самих costs задаётся вызывающей стороной и не проверяется адаптером.

Поэтому:

```text
pathCost computed
semantic coherence not computed
reader load not computed
information preservation not computed
scientific quality not computed
```

Ни положение на Canvas, ни уменьшение `pathCost` не получают semantic authority.

---

## 5. `LINK_CANDIDATE`: только exact-context co-occurrence

### 5.1. Три Segment records

Операция принимает:

```text
fromSegment
toSegment
witnessSegment
```

Условия:

1. `fromSegment` и `toSegment` различны.
2. Они находятся на одном `alpha/kind`.
3. Все три сегмента ссылаются на один точный `SourceSnapshot.sourceHash`.
4. Witness находится на том же α.
5. Locator witness полностью покрывает locators обоих связываемых сегментов.

Обычный третий абзац того же источника не является witness. Для положительного результата нужен точный context span, включающий оба участка.

### 5.2. Почему нет AlphaEdge

Из факта расположения двух spans в одном контексте следует только структурное наблюдение `CO_OCCURS_WITH`. Оно не доказывает:

```text
ASSOCIATES
USES
INCLUDES
DEPENDS_ON
SUPPORTS
REFUTES
QUALIFIES
```

Поэтому результат содержит:

```json
{
  "relation": "CO_OCCURS_WITH",
  "edge": null,
  "alphaTransitionReceipt": null,
  "reviewStatus": "REQUIRES_REVIEW",
  "finalRelation": "NOT_COMPUTED"
}
```

Это кандидат для следующего evidence-backed среза, а не семантическая связь в `G_sem`.

### 5.3. Что потребуется для реального ребра

Будущий модуль должен получать и взаимно разыменовывать полный bundle:

```text
target Claim AST
passage Claim AST
EvidenceCandidate
SourceSnapshot[]
SearchHit[]
sourceSetHash
queryHash
lexicalIndexHash
linguisticIndexHash
lexiconHash
parserRef
alignerVersion
```

Только после проверки всех объектов, stale pins, exact spans, направления и relation допускается `Alpha.createEdge(... status:'PROPOSED')`. Даже тогда `REVIEWED` и semantic commit остаются отдельными действиями.

---

## 6. Дополнительное усиление α-контрактов

Во время реализации независимый аудит обнаружил две дыры в общем `p78-alpha-orbit-contracts.js`.

### 6.1. Потеря claim refs

Ранее `requirePreservation()` проверял:

```text
coverageRefs == before.claimRefs
```

но не требовал, чтобы `after.claimRefs` действительно содержал claims исходного артефакта. Формально правильный receipt мог сопровождать потерю ссылок.

Добавлен инвариант:

```text
after.claimRefs must contain every before.claimRef
```

Код отказа:

```text
CLAIM_REFERENCE_LOSS
```

Положительные golden fixtures исправлены: теперь соседние α-артефакты действительно несут общий claim ref, а не разные декоративные hashes.

### 6.2. α witness для LINK

Ранее LINK требовал непустой witness, но не проверял его α. Witness уровня `+4` мог быть приложен к связи уровня `0`.

Добавлена проверка:

```text
every LINK witness.alpha == before.alpha
```

Код отказа:

```text
LINK_WITNESS_ALPHA_MISMATCH
```

Проверка применяется и при создании receipt, и при автономной валидации его формы.

---

## 7. API

```js
MRDP78Data7Adapter = {
  version: '1.0.0',
  status: 'READY',
  operations: ['SEGMENT', 'ORBIT', 'LINK_CANDIDATE'],
  algorithms: ['DIRECTED_GREEDY'],
  limits: {
    maxSegments: 32,
    maxCost: 1000000
  },
  semanticTruth: false,
  soundness: 'NOT_COMPUTED',
  commitAllowed: false,

  createSegmentBatch,
  validateSegment,
  validateSegmentBatch,
  validateSegmentBatchAgainst,

  createOrbitProposal,
  validateOrbitProposal,
  validateOrbitProposalAgainst,

  createLinkCandidate,
  validateLinkCandidate,
  validateLinkCandidateAgainst
}
```

Валидаторы `Against` обязательны на границе, где доступен исходный SourceSnapshot или полные Segment records. Автономный validator проверяет content addressing и форму, но не может разыменовать отсутствующий внешний объект.

---

## 8. Тестирование

Новый regression-файл содержит 20 проверок:

```text
PASS: 20/20 checks
```

Покрыты:

1. замороженный API и отсутствие authority;
2. exact Segment и DRAFT AlphaArtifact;
3. независимость от порядка locators;
4. UTF-16 spans с surrogate pair;
5. полное и частичное структурное покрытие;
6. overlap, bounds и boundary whitespace;
7. stale SourceSnapshot и tampering;
8. hidden/symbol/accessor поля;
9. directed greedy golden route;
10. независимость от порядка cost rows;
11. deterministic tie-break;
12. отказ от no-op route;
13. полная directed cost matrix;
14. duplicate/mixed-alpha/mixed-language;
15. tampered route/cost/authority boundary;
16. exact-context LINK_CANDIDATE;
17. self-link, semantic relation и неполный witness;
18. cross-alpha и tampered candidate;
19. fresh VM replay и dependency failure;
20. отсутствие DOM/network/clock/random/eval/commit path.

Усиленный regression α-контрактов остаётся зелёным:

```text
PASS: 19/19 checks
```

---

## 9. Что намеренно не реализовано

```text
SYNTHESIZE
RATIONALIZE
GENERALIZE
SPECIALIZE
automatic AlphaEdge
semantic relation classification
Claim AST extraction
EvidenceCandidate admission
TSP optimum proof
genetic optimizer
dynamic programming optimizer
Canvas rendering
text commit
```

`SEGMENT` не понимает смысл текста. `ORBIT` не доказывает, что новый порядок лучше для читателя. `LINK_CANDIDATE` не создаёт семантического ребра. Это намеренные границы первого исполняемого среза.

---

## 10. Следующий срез реализован

`EvidenceBackedLinkAdapter` реализован отдельным модулем и описан в [`49-p78-evidence-backed-link-adapter-implementation.md`](49-p78-evidence-backed-link-adapter-implementation.md). Он:

1. повторно проверяет Data7 link против полных endpoint и witness;
2. запускает parser replay для обоих endpoint;
3. запускает детерминированный evidence replay с явными budgets и pins;
4. разыменовывает SourcePassage, SearchHit, context span, Claim AST и alignment;
5. блокирует фиктивные `hitId`, `MENTIONS -> ASSOCIATES` и stale provenance;
6. создаёт только `AlphaEdge(status:PROPOSED)` для `SUPPORTS/REFUTES`, а после [`QualifierDirectionContract`](50-p78-qualifier-direction-contract-implementation.md) также для token-backed `QUALIFIES`, только когда passage имеет один replayed `через <METHOD>` delta и является `NARROWER` относительно target;
7. сохраняет `semanticTruth:false`, `finalRelation:NOT_COMPUTED` и `commitAllowed:false`.

Detached record хранит `REPLAY_REQUIRED`, а только `validateEvidenceBackedLinkAgainst` может вернуть referential `VALID`. Модальные, кванторные и неподдерживаемые qualifier differences дают `ABSTAIN`; `BROADER` блокируется как неверное направление endpoint. Пассивный `EvidenceBackedLinkView` теперь реализован в [`51-p78-evidence-backed-link-view-implementation.md`](51-p78-evidence-backed-link-view-implementation.md); следующим отдельным этапом остаётся `HumanReviewDecisionContract`.
