# 36 - P78: реализация source-backed каскада утверждений AG4

Статус: `HARDENED_RUNTIME_SLICE`  
Дата проверки: 2026-07-20  
Область: автономное 2D-кольцо P78, Controlled Russian Claim AST, локальные источники, кандидаты свидетельств и пассивный интерфейс проверки

Связанные документы:

- [33 - адаптация AST/grep](33-ast-grep-semantic-ring-adaptation.md);
- [35 - реализация Controlled Russian Claim AST](35-p78-controlled-russian-claim-ast-implementation.md);
- [37 - дальнейший план AG5-AG7](37-p78-ag5-ag7-parallel-development-review.md);
- [38 - многоагентный семантический поток](38-p78-multi-agent-semantic-flow-crosswalk.md).

---

## 1. Решение

AG4 реализован и подключён к P78 как ограниченный слой поиска и сопоставления источников. Он умеет:

1. принять только разобранный `Claim AST`;
2. выполнить широкий лексический поиск в замороженном локальном корпусе;
3. разбирать только найденные предложения;
4. отдельно сравнивать предикат, аргументы, полярность, модальность, квантор и ограничители;
5. предложить отношения `SUPPORTS`, `REFUTES`, `QUALIFIES` или `MENTIONS`;
6. показать точный фрагмент источника после повторной проверки координат и хеша;
7. остановиться на границе `EVIDENCE_CANDIDATE / REQUIRES_REVIEW / NOT_COMPUTED / ABSTAIN`.

AG4 не принимает свидетельство, не вычисляет истинность утверждения, не разрешает конфликт голосованием и не получает права изменять пользовательский текст. Поэтому корректное название текущего результата - **source-backed candidate cascade**, а не доказательная система.

---

## 2. Нормативная граница

```text
SearchHit
  != PassageClaim
  != EvidenceCandidate
  != AcceptedEvidence
  != FinalClaimStatus
  != разрешение изменить текст
```

Максимальные полномочия runtime AG4:

| Поле | Разрешённое значение |
|---|---|
| `evidenceStatus` | `EVIDENCE_CANDIDATE` или `NOT_COMPUTED` |
| `reviewStatus` | `REQUIRES_REVIEW` |
| `finalRelation` | `NOT_COMPUTED` |
| `semanticTruth` | `false` |
| `soundness` | `NOT_COMPUTED` |
| `finalStatus` | `ABSTAIN` |

Любой подключённый каскад, который пытается вернуть `ACCEPTED_EVIDENCE`, итоговое `SUPPORTS`, `semanticTruth=true` или иной более высокий статус, изолируется с `EVIDENCE_AUTHORITY_BOUNDARY_VIOLATION`. Разобранный Claim при этом не превращается ошибочно в `OOV`.

---

## 3. Реализованные слои

| Слой | Файл | Роль |
|---|---|---|
| строгие контракты | `prototype/lib/p78-evidence-contracts.js` | `SourcePassage`, `EvidenceCandidate`, валидаторы и закрытые перечисления |
| admitted corpus | `prototype/lib/p78-claim-evidence-corpus.js` | 10 замороженных `SourceSnapshot`, 30 предложений |
| linguistic index | `prototype/lib/p78-linguistic-structure-index.js` | сегментация, broad retrieval, selective parse, alignment |
| facade | `prototype/lib/p78-claim-evidence-cascade.js` | одна воспроизводимая фабрика AG4 |
| claim orchestrator | `prototype/lib/p78-controlled-claim-engine.js` | optional injection, проверка результата и fail-isolation |
| passive view | `prototype/lib/p78-evidence-candidate-view.js` | проверяемое отображение кандидатов без command path |
| view styles | `prototype/p78-evidence-candidate-view.css` | ограниченная адаптивная геометрия |
| runtime binding | `prototype/lib/p78-living-ring-runtime.js` | ленивый запуск в режиме анализа и exact-text resolver |
| shell | `prototype/p78-living-ring-interface.html` | versioned загрузка локальных модулей |

Основной HTML остаётся оболочкой. Корпус, алгоритмы, контракты, представление и runtime вынесены в отдельные небольшие файлы. Новые зависимости не добавлены; сеть, серверная модель и Python для работы AG4 не требуются.

---

## 4. Контракты источника

### 4.1. SourceSnapshot

Источник допускается только как неизменяемый снимок:

```text
SourceSnapshot {
  sourceId,
  revision,
  language,
  status = ADMITTED,
  text,
  sourceHash
}
```

`sourceHash` связывает идентификатор, ревизию и точный текст. Совпадения `sourceId` и `revision` недостаточно: подмена текста при тех же метаданных должна быть обнаружена.

### 4.2. SourcePassage

```text
SourcePassage {
  passageId,
  sourceRef,
  locator: {
    unit = UTF16_CODE_UNIT,
    start,
    end,
    sentenceIndex
  },
  textHash,
  contentHash
}
```

Импортированный индекс повторно сегментирует каждый закреплённый `SourceSnapshot` и сверяет `passageId`, `sourceHash`, диапазон, `sentenceIndex`, `textHash` и текст. Ранее индекс мог принять passage, созданный из другого текста с тем же `sourceId/revision`; теперь это завершается `PASSAGE_SOURCE_MISMATCH`.

### 4.3. EvidenceCandidate

Кандидат содержит ссылку на target Claim, источник, passage, предложенное отношение, шестимерное выравнивание и причины. Поля принятого решения в объекте запрещены.

```text
alignment = {
  predicate,
  arguments,
  polarity,
  modality,
  quantifier,
  qualifiers
}
```

Каждая координата имеет значение `TRUE`, `FALSE` или `UNKNOWN`. Это позволяет отличить отрицание, изменение области действия и простое тематическое упоминание.

---

## 5. Каскад вычисления

```text
Claim text
  -> Controlled Russian parser
  -> validated Claim AST
  -> structural pattern gate
  -> broad lexical query
  -> located source passages
  -> selective passage parsing
  -> six-axis Claim alignment
  -> review-only EvidenceCandidate set
  -> passive exact-source view
  -> ABSTAIN
```

Нормативный псевдокод:

```text
run(targetText, budgets):
    target = parse(targetText)
    if target is AMBIGUOUS or OOV:
        return ABSTAIN(target.status)

    pattern = structuralMatch(target.claimAst)
    if pattern is absent:
        return ABSTAIN(STRUCTURAL_REJECT)

    assert sourceSetHash and linguisticIndexHash are current
    hits = lexicalLocate(project(target.claimAst), budgets)

    candidates = []
    for hit in stableSort(hits):
        passage = replayExactPassage(hit)
        passageClaim = parse(passage.text)
        if passageClaim is unresolved:
            retain as diagnostic only
            continue

        alignment = compare(target.claimAst, passageClaim.claimAst)
        relation = proposeRelation(alignment)
        candidate = validateCandidate(relation, alignment, passage)
        candidates.append(candidate)

    validateResultHashAndAuthority(candidates)
    return {
        evidenceStatus: candidates ? EVIDENCE_CANDIDATE : NOT_COMPUTED,
        reviewStatus: REQUIRES_REVIEW,
        finalRelation: NOT_COMPUTED,
        semanticTruth: false,
        finalStatus: ABSTAIN
    }
```

Порядок кандидатов детерминирован. Порядок ключей options и порядок завершения UI не должны менять `resultHash`.

---

## 6. Отношения

### SUPPORTS

Требуется совместимость ядра утверждения и всех проверяемых ограничителей. `SUPPORTS` остаётся только машинным предложением.

### REFUTES

Используется при совпадающем ядре и противоположной полярности. Наличие одновременно `SUPPORTS` и `REFUTES` создаёт видимый `CONFLICT`, но не автоматический итог.

### QUALIFIES

Используется, когда предикат и основные аргументы совпадают, а метод, время, место, популяция, условие или мера отличаются. Роли ограничителей исключены из core argument comparison, поэтому различие метода больше не маскируется как различие аргументов.

Пример:

```text
target:  Система проверяет документ через формулу.
source:  Система проверяет документ.
result:  arguments=TRUE, qualifiers=FALSE, proposedRelation=QUALIFIES
```

### MENTIONS

Лексически близкий passage без достаточного структурного совпадения. Он полезен для навигации и контрпоиска, но не должен визуально вытеснять `SUPPORTS`, `REFUTES` и `QUALIFIES`.

---

## 7. Исправления после независимого аудита

### 7.1. Точность provenance

- passage теперь обязан точно воспроизводиться из закреплённого снимка;
- resolver сравнивает `sourceId`, `revision`, `sourceHash`, `start`, `end`, `sentenceIndex` и `textHash`;
- изменённый фрагмент не показывается и получает `PASSAGE_TEXT_HASH_MISMATCH`.

### 7.2. Граница полномочий

- engine не доверяет статусам подключённого каскада;
- проверяется каждый candidate и общий `resultHash`;
- поддельный итог изолируется без уничтожения корректного Claim AST;
- AG4 остаётся optional: недоступность каскада не ломает исходное поведение AG3.

### 7.3. Кванторы и ограничители

- `NONE` распознаёт `ни один`, `ни одна`, `ни одно`;
- ключи qualifiers нормализуются перед сопоставлением;
- METHOD, TIME, PLACE, POPULATION, CONDITION и MEASURE не дублируются как core arguments;
- end-to-end `QUALIFIES` закреплён регрессией.

### 7.4. Бюджеты

`maxOperations`, `maxHits` и `maxPassages` принимают только явные ограниченные целые значения. Неверный тип даёт `INVALID_BUDGET`; нулевой passage budget не заменяется скрытым default. Метрики содержат `operationCount`, а исчерпание бюджета завершается `ABSTAIN` без частичного авторитетного результата.

### 7.5. Browser integration

Engine загружается раньше optional evidence-contracts в текущем HTML. Он больше не фиксирует отсутствующую зависимость навсегда: при фабричном подключении каскада контракт разрешается повторно из browser global. Это закрывает обнаруженную Edge-ошибку `evidence contracts unavailable`.

---

## 8. Интерфейс

Evidence-панель вычисляется только при открытии режима `анализ` или явном запуске Claim. Скрытая панель не выполняет тяжёлый каскад при каждом основном вводе.

Порядок отображения:

1. `SUPPORTS`;
2. `REFUTES`;
3. `QUALIFIES`;
4. свёрнутая группа `MENTIONS`;
5. отдельно изолированные невалидные записи.

Корневой статус считается только по валидным кандидатам. Если вход содержит одну повреждённую запись, интерфейс показывает `NOT_COMPUTED`, `candidateCount=0` и диагностический код, а не ложный `EVIDENCE_CANDIDATE`.

Для доступности `aria-live` оставлен только у короткого статуса, а не у всей длинной панели. Служебный текст увеличен, длинные хеши переносятся, карточки имеют один столбец на мобильном viewport.

---

## 9. Проверка

Focused regression snapshot после hardening:

```text
linguistic parser                 14/14
linguistic structure index       15/15
claim evidence cascade           11/11
evidence candidate view          13/13
claim interface                   9/9
```

Финальный полный runner после browser-order исправления, hardening и синхронизации документации прошёл `49/49` suites и `579/579` checks.

Контрольный Microsoft Edge через localhost:

```text
HTTP status                 200
console errors              0
page errors                 0
request failures            0
canvas pixels changed       true
movement candidates         SUPPORTS, REFUTES, MENTIONS, MENTIONS
movement conflict           true
ambiguous input             AMBIGUOUS / NOT_COMPUTED / 0 candidates
desktop horizontal overflow 0
mobile horizontal overflow  0
mobile out-of-viewport cards 0
mobile candidate columns     1
```

Проверенная фраза движения:

```text
Частица движется по орбите.
```

Каскад нашёл положительный и отрицательный source passage, сохранил конфликт и не объявил итоговую истину.

---

## 10. Что результат не доказывает

Micro-benchmark содержит 8 измеряемых targets, 2 fail-closed guards и 30 специально подготовленных passages. На нём structural filtering сохраняет recall и удаляет лексические false positives, однако это закрытый синтетический набор.

Результат не доказывает:

- качество на произвольном русском языке;
- качество на новостях, Википедии или научных статьях;
- корректность фактов источника;
- логическое следование общего вида;
- независимость источников;
- возможность автоматически продолжать статью без human review.

Формулы кольца, жидкостная аналогия, радиус и визуальная динамика являются инженерной моделью интерфейса и исследовательскими гипотезами. Они не являются математическим доказательством семантической истинности.

---

## 11. Следующий обязательный этап

AG4 не нужно расширять свободной генерацией. Следующий шаг состоит из двух независимых работ:

1. **Внешняя оценка AG4:** размеченный holdout одного узкого домена, source-level split, precision/recall по отношениям, доля `ABSTAIN`, проверка qualifiers и stale-source cases.
2. **Semantic Work Flow:** типизированные операции, очереди, backpressure, fencing и provenance для визуального связывания движения частиц со стадиями анализа.

AG5 countersearch остаётся `DISCONNECTED_DRAFT`. Его нельзя загружать в HTML, пока attempts не связаны с точными AG4 passage/evidence refs, не устранены морфологические и negation-ошибки и не определены строгие бюджеты.

---

## 12. Критерий готовности AG4

AG4 считается завершённым как review-only vertical slice, когда одновременно выполняются условия:

- exact source replay и stale checks зелёные;
- authority escalation fail-closed;
- `SUPPORTS`, `REFUTES`, `QUALIFIES`, `MENTIONS` различимы;
- invalid candidate не повышает root status;
- optional cascade не ломает AG3;
- desktop/mobile UI не переполняется;
- browser имеет движение canvas и ноль runtime errors;
- полный regression runner зелёный;
- benchmark явно назван синтетическим;
- accepted evidence и semantic truth отсутствуют.

Текущее состояние этим условиям соответствует. Расширение домена и принятие evidence относятся уже к следующим стадиям, а не к скрытому изменению смысла AG4.
