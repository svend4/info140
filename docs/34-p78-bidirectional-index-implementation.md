# P78: реализация двунаправленного индекса Formula AST / span

Статус: **AG0, AG1, AG2 и точная часть AG5 реализованы как автономный браузерный вертикальный срез**.

Дата фиксации: 2026-07-20.

> Обновление: AG3 после этой фиксации реализован. Утверждения разделов 6–7 описывают историческую границу AG0–AG2; актуальный Claim AST, golden corpus и следующий AG4 зафиксированы в [документе 35](35-p78-controlled-russian-claim-ast-implementation.md).

Связанные спецификации:

- [32. Реализация формульного кольца](32-p78-formula-ring-implementation.md);
- [33. Адаптация grep/AST](33-ast-grep-semantic-ring-adaptation.md);
- [29. Энциклопедическое кольцо](29-encyclopedic-semantic-ring-spec.md);
- [30. Научное слияние и расщепление](30-scientific-synthesis-fission-fusion-spec.md).

---

## 1. Что теперь действительно работает

P78 выполняет один воспроизводимый двунаправленный шаг:

```text
точная пользовательская фраза
  -> локальный Unicode token/span index
  -> SearchHit(status=LOCATED)

выбранный formulaId
  -> FormulaShapeSignature
  -> закрытый structural pattern
  -> StructuralMatch(status=STRUCTURAL_MATCH)
  -> точные AST-to-query проекции
  -> повторный поиск по локальному корпусу

LOCATED + STRUCTURAL_MATCH
  -> evidence gate
  -> ABSTAIN / NOT_COMPUTED
```

Последний переход намеренно не выдаёт `SUPPORTED`. На дату этого Formula/span среза ещё не было Claim AST, predicate alignment, polarity alignment, проверки qualifiers и принятого evidence artifact.

Главный результат этапа состоит не в генерации текста, а в появлении исполняемой границы между тремя разными фактами:

1. строка найдена по точному адресу;
2. Formula AST удовлетворяет закрытому структурному правилу;
3. доказательность языкового утверждения ещё не вычислена.

---

## 2. Реализованные модули

### 2.1. Контракты и лестница статусов

Файл: `prototype/lib/p78-search-contracts.js`.

Реализованы закрытые и версионированные структуры:

- `SemanticQuery`;
- `SourceSnapshot`;
- `SearchHit`;
- `IndexManifest`;
- `BidirectionalSearchTrace`.

Контракт запрещает неизвестные поля и проверяет собственные SHA-256. Для Query AST введены ограничения глубины, числа узлов и циклов.

Исполняемая лестница не допускает скачок:

```text
LOCATED -/> SUPPORTED
```

`SearchHit` конструктивно может иметь только `status="LOCATED"`. Попытка передать `SUPPORTED` отклоняется reason code `LEXICAL_STATUS_FORBIDDEN`.

### 2.2. Локальный token/span index

Файл: `prototype/lib/p78-local-text-index.js`.

Индекс принимает только admitted `SourceSnapshot` и строит:

- Unicode-токены русского и латинского текста;
- UTF-16 позиции начала и конца;
- нормализованные NFC/lower значения;
- exact token search;
- exact phrase search;
- bounded context spans;
- source, matched text, context span, manifest и index hashes.

Индекс не зависит от DOM, сети, часов, случайности или внешнего сервера. Один и тот же набор snapshots в любом порядке создаёт один и тот же `sourceSetHash` и `indexHash`.

Явные отказы:

- `EMPTY_QUERY`;
- `OOV_TERM`;
- `QUERY_MODE_UNSUPPORTED`;
- `QUERY_NODE_UNSUPPORTED`;
- `STALE_INDEX`;
- `BUDGET_EXCEEDED`;
- `CYCLE_DETECTED`;
- `DUPLICATE_SOURCE`;
- `SOURCE_REVISION_CONFLICT`.

При budget failure индекс не возвращает частичный набор как будто полный.

### 2.3. Formula AST shape index

Файл: `prototype/lib/p78-formula-shape-index.js`.

Для всех 11 активных формул строится `FormulaShapeSignature`:

```text
formulaRef
rootNode
operationMultiset
operationPaths
inputTypes
outputType
dependencyRefs
literalKinds
assumptions
sourceHash
shapeHash
```

Поддерживается поиск по:

- `formulaId`;
- operation;
- input type и unit;
- output type и unit;
- dependency;
- exact `shapeHash`.

Совпадение `shapeHash` означает равенство выбранной канонической сигнатуры. Оно не означает доказанную математическую эквивалентность формул.

### 2.4. Закрытый Formula AST matcher

Файл: `prototype/lib/p78-formula-structural-matcher.js`.

Поддерживаются versioned constraints:

- `EXACT_SHAPE`;
- `FORMULA_ID`;
- `ROOT_NODE`;
- `OPERATION`;
- `INPUT_TYPE_UNIT`;
- `OUTPUT_TYPE_UNIT`;
- `DEPENDENCY`;
- `LITERAL_KIND`;
- `ASSUMPTION`.

Максимальный положительный статус matcher:

```text
STRUCTURAL_MATCH
```

Поля результата прямо фиксируют:

```text
semanticTruth = false
mathematicalEquivalence = NOT_COMPUTED
soundness = NOT_COMPUTED
```

### 2.5. Точный AST-to-query projector

Файл: `prototype/lib/p78-query-projector.js`.

Из одной проверенной `FormulaShapeSignature` строятся только точные запросы по:

- formula ID;
- root node;
- операциям;
- value type;
- measure kind;
- units;
- dependency formula IDs.

Каждый запрос проходит фабрику `SearchContracts.createSemanticQuery()` и получает собственный hash. Проекция имеет:

```text
expansionClass = EXACT
completenessClaim = BOUNDED_VOCABULARY_ONLY
purpose = DUPLICATE_CHECK
```

Свободные синонимы, LLM expansion и embeddings отсутствуют.

### 2.6. Фиксированный локальный корпус

Файл: `prototype/lib/p78-search-corpus.js`.

Корпус состоит из девяти admitted snapshots по темам:

- баланс кольца;
- давления центра, края и орбиты;
- запас 2D;
- траектория жизненности;
- status ladder;
- два направления поиска;
- evidence boundary;
- научный split/merge;
- автономная 2D-геометрия.

Строгий snapshot содержит только контрактные поля. UI-метаданные `title` и `section` хранятся отдельно и не меняют адресуемый source hash.

### 2.7. Двунаправленный orchestrator

Файл: `prototype/lib/p78-bidirectional-retrieval.js`.

Orchestrator:

1. строит локальный span index;
2. принимает точную пользовательскую фразу;
3. выполняет grep-подобный поиск;
4. выбирает FormulaShapeSignature по formula ID;
5. создаёт закрытый `FORMULA_ID` pattern;
6. выполняет Formula AST structural match;
7. проектирует AST обратно в точные запросы;
8. повторно ищет проекции в корпусе;
9. дедуплицирует source spans;
10. создаёт трёхшаговый `BidirectionalSearchTrace`;
11. завершает evidence gate статусом `ABSTAIN`.

Три шага trace:

```text
0 GREP_TO_AST
1 AST_TO_GREP
2 EVIDENCE_GATE
```

Trace содержит:

- `sourceSetHash`;
- `queryRegistryHash`;
- `formulaRegistryHash`;
- два `IndexManifest`;
- input/output hashes каждого шага;
- operation counts;
- reason codes;
- `finalStatus="ABSTAIN"`;
- `traceId` и `contentHash`.

### 2.8. Пассивный UI

Файлы:

- `prototype/lib/p78-search-view.js`;
- `prototype/lib/p78-search-adapter.js`;
- `prototype/p78-search-view.css`.

В режиме `анализ` добавлены:

- поле точной фразы;
- выбор одной из 11 формул;
- команда `проверить`;
- три визуально раздельных слоя.

```text
НАЙДЕНО          СТРУКТУРНО          ДОКАЗАТЕЛЬНОСТЬ
LOCATED          STRUCTURAL_MATCH     NOT_COMPUTED / ABSTAIN
```

View показывает короткие source/index/trace hashes и последовательность направлений. Длинные списки не расширяют страницу: результаты ограничены, а trace использует внутреннюю горизонтальную прокрутку.

View и adapter не имеют доступа к action controller, `commit`, portal execution или изменению исходного текста.

---

## 3. Нормативный воспроизводимый пример

Вход:

```text
query = "движение"
formulaId = "pressure.margin"
```

Текущий результат реализации:

```text
result.status = READY
located spans = 4
structural matches = 1
exact projected queries = 10
evidence candidates = 0
evidenceStatus = NOT_COMPUTED
trace.finalStatus = ABSTAIN
semanticTruth = false
```

Повторный запуск с теми же snapshots, registry, pattern, query и budgets возвращает байтово одинаковый JSON и тот же trace hash.

Контрастный пример:

```text
query = "движение по окружности"
formulaId = "ring.balance"
```

Локальный индекс возвращает точный адрес фразы в snapshot `p78.geometry.2d`, а structural matcher возвращает только `ring.balance`. Эти два результата отображаются рядом, но не объединяются в утверждение о том, что найденный текст доказывает формулу.

---

## 4. Предсказуемые отказы

| Условие | Результат |
|---|---|
| пустая фраза | `ABSTAIN / EMPTY_QUERY` |
| неизвестный formula ID | `ABSTAIN / NO_MATCHES` |
| повторный query hash в visited set | `ABSTAIN / CYCLE_DETECTED` |
| изменился source set | `ABSTAIN / STALE_INDEX` |
| изменился text index | `ABSTAIN / STALE_INDEX` |
| изменился Formula Registry | `ABSTAIN / STALE_INDEX` |
| превышено число projected queries | `ABSTAIN / BUDGET_EXCEEDED` |
| неизвестное option field | `INVALID / UNKNOWN_FIELD` |
| неизвестное AST operation или pattern constraint | явный `INVALID` |
| evidence alignment отсутствует | `ABSTAIN / NOT_COMPUTED` |

Ни один отказ не заменяется числом similarity, случайным выбором или предположением языковой модели.

---

## 5. Проверки

Новые целевые наборы:

```text
semantic-p78-local-search-regression.cjs                 22/22
semantic-p78-formula-shape-index-regression.cjs          13/13
semantic-p78-search-presentation-regression.cjs            6/6
semantic-p78-bidirectional-retrieval-regression.cjs         9/9
semantic-p78-search-interface-regression.cjs                6/6
```

Проверяются:

- независимое вычисление SHA-256;
- русские Unicode tokens и UTF-16 offsets;
- exact phrase spans;
- bounded context;
- порядок snapshots;
- duplicate и conflicting revisions;
- stale source, index и registry;
- OOV;
- cycles;
- operation/query/hit budgets;
- closed Query AST;
- closed Formula patterns;
- все 11 FormulaShapeSignature;
- точные, operation, type/unit и dependency searches;
- deterministic replay в fresh VM global;
- отсутствие `eval`, сети, часов и случайности;
- отсутствие commit authority у UI;
- script dependency order;
- responsive geometry.

---

## 6. Что Formula/span этап не решал до AG3

1. Нет Controlled Russian Claim AST.
2. Нет морфологического и dependency parser adapter.
3. Нет sense IDs и predicate/argument roles.
4. Нет polarity, modality и qualifier alignment.
5. Нет `EvidenceCandidate` и принятого provenance artifact.
6. Нет `SUPPORTS`, `REFUTES`, `QUALIFIES` или `MENTIONS`.
7. Exact retrieval не находит неизвестные словоформы и синонимы.
8. Девять snapshots являются инженерным контрольным корпусом, а не репрезентативным корпусом статей.
9. Формульная структурная близость не доказывает эквивалентность.
10. Система пока не генерирует новый проверяемый энциклопедический абзац.

---

## 7. Следующий для этого среза этап: AG3 (выполнен)

Этот следующий этап был определён не как расширение Formula AST, а как узкий языковой эксперимент. Его реализация описана в [документе 35](35-p78-controlled-russian-claim-ast-implementation.md).

Рекомендуемый первый домен:

```text
жанр: короткие определения P78
словарь: 100-200 понятий
предикаты: 20-30
структурные patterns: 20-50
golden corpus: минимум 100 предложений
```

Минимальный Claim AST:

```text
predicate.lemma
predicate.senseId
arguments[].role
arguments[].senseId
polarity
modality
quantifier
qualifiers
resolutionStatus = RESOLVED | AMBIGUOUS | OOV
```

Первый допустимый языковой переход:

```text
LOCATED
  -> PARSED
  -> STRUCTURAL_MATCH
  -> EVIDENCE_CANDIDATE
  -> REQUIRES_REVIEW
```

Даже после AG3 автоматический `SUPPORTED` не должен включаться. Для него нужны AG4 и AG6: benchmark каскада, claim-level alignment, admitted sources, polarity/modality/qualifier gates и контрпоиск.

---

## 8. Итог

Первый спринт из документа 33 больше не является только техническим заданием. P78 получил реальный автономный цикл, в котором:

- grep-подобный слой находит точный фрагмент;
- Formula AST слой проверяет закрытую структуру;
- AST-to-grep слой возвращает точные запросы в корпус;
- trace связывает все переходы hashes;
- evidence gate не позволяет назвать совпадение истиной.

Эта техническая основа теперь расширена работающим AG3. Она всё ещё не доказывает языковые утверждения: source-backed evidence alignment остаётся задачей AG4.
