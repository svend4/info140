# P78: EvidenceBackedLinkAdapter — воспроизводимая связь между Data7 и AG4

Статус: `EVIDENCE_BACKED_LINK_ADAPTER_IMPLEMENTED_NOT_WIRED`

Runtime: `NOT_WIRED_TO_P78_SHELL`

Дата фиксации: 2026-07-21

Примечание: документ фиксирует безопасную границу v1. Реализованное продолжение с полным parser replay, `DIRECTED/ABSTAIN`, token-backed method witness и schema `proposal/2` описано в [`50-p78-qualifier-direction-contract-implementation.md`](50-p78-qualifier-direction-contract-implementation.md).

Исполняемый модуль:

- [`../prototype/lib/p78-evidence-backed-link-adapter.js`](../prototype/lib/p78-evidence-backed-link-adapter.js)

Регрессионный набор:

- [`../prototype/tests/semantic-p78-evidence-backed-link-adapter-regression.cjs`](../prototype/tests/semantic-p78-evidence-backed-link-adapter-regression.cjs)

Предыдущий безопасный срез:

- [`48-p78-data7-adapter-implementation.md`](48-p78-data7-adapter-implementation.md)

---

## 1. Что реализовано

Добавлен отдельный адаптер между двумя уже существующими частями P78:

1. `Data7Adapter` создаёт точные Segment records и осторожный `CO_OCCURS_WITH` candidate;
2. AG4 создаёт `SourcePassage`, `SearchHit`, Claim AST, claim alignment и `EvidenceCandidate`;
3. новый `EvidenceBackedLinkAdapter` проверяет, что все эти записи относятся к одному воспроизводимому поиску и к тем же точным фрагментам источника;
4. только после этого он создаёт `EvidenceBackedLinkProposal` и вложенный `AlphaEdge(status: PROPOSED)`.

Схема результата:

```text
meridian.data7-evidence-backed-link-proposal/1
```

Операция:

```text
EVIDENCE_BACK_LINK
```

Это не окончательная семантическая связь. Это проверяемое предложение связи, которое всё ещё требует решения человека.

---

## 2. Почему отдельный адаптер необходим

Существующий `EvidenceCandidate` корректно ограничивает полномочия:

```text
evidenceStatus = EVIDENCE_CANDIDATE
reviewStatus   = REQUIRES_REVIEW
finalRelation  = NOT_COMPUTED
semanticTruth  = false
soundness      = NOT_COMPUTED
```

Но его автономный validator проверяет прежде всего форму и content addressing. Он не обязан иметь рядом полные объекты, на которые указывают:

- `hitIds`;
- `sourceSpanIds`;
- `targetClaimRef`;
- `passageClaimRef`;
- `sourceRef`;
- `queryHash`;
- `lexicalIndexHash`;
- `linguisticIndexHash`.

Поэтому формально валидный `EvidenceCandidate` можно собрать с синтаксически корректным, но отсутствующим `hitId`. Это не ошибка базового контракта: базовый контракт является переносимым record type и не владеет хранилищем ссылок. Ошибкой было бы считать его автономную проверку доказательством существования всех referents.

Новый адаптер закрывает именно этот разрыв. В регрессионном наборе есть явная проверка:

```text
generic EvidenceCandidate: VALID
fake hitId replay: REJECTED
```

---

## 3. Граница результата

Результат имеет следующие обязательные поля:

```text
direction          = PASSAGE_TO_TARGET
relationStatus     = PROPOSED
verificationStatus = REPLAY_REQUIRED
validationRequirement = FULL_BUNDLE_REPLAY
evidenceStatus     = EVIDENCE_BACKED_PROPOSAL
reviewStatus       = REQUIRES_REVIEW
finalRelation      = NOT_COMPUTED
authority          = STRUCTURAL_ONLY
soundness          = NOT_COMPUTED
semanticTruth      = false
commitAllowed      = false
```

Factory выполняет referential replay перед созданием record, но detached content-addressed record не является цифровой подписью. Поэтому сам record всегда требует нового полного replay. Только `validateEvidenceBackedLinkAgainst(record, completeDefinition)` может подтвердить refs в текущем окружении.

Shape inspection сообщает только `STRUCTURALLY_VALID`, `validationScope: STRUCTURE_ONLY` и `referentialReplay: NOT_PERFORMED`.

Вложенное ребро имеет:

```text
AlphaEdge.status = PROPOSED
```

Запрещено автоматически получать:

```text
REVIEWED
SUPPORTED
REFUTED
ACCEPTED_EVIDENCE
semanticTruth = true
soundness != NOT_COMPUTED
commitAllowed = true
```

`alphaTransitionReceipt` всегда равен `null`. Предложение горизонтального ребра не является переходом между α-уровнями и не должно само двигать артефакт.

---

## 4. Допустимые отношения

Адаптер допускает только отношения с однозначным направлением в текущем Claim alignment:

```text
SUPPORTS
REFUTES
```

Они остаются предложениями, а не окончательными решениями.

`QUALIFIES` намеренно блокируется кодом:

```text
QUALIFIES_DIRECTION_UNPROVEN
```

Текущий alignment сообщает только совпадение или несовпадение modality, quantifier и qualifiers. Он не кодирует `NARROWER` против `BROADER`, поэтому направленное ребро passage -> target могло бы оказаться перевёрнутым.

Явно запрещены преобразования:

```text
CO_OCCURS_WITH -> ASSOCIATES
MENTIONS       -> ASSOCIATES
MENTIONS       -> SUPPORTS
lexical match  -> semantic truth
```

`CO_OCCURS_WITH` сообщает только, что два Data7-сегмента находятся в одном точном контексте. `MENTIONS` сообщает только о слабом обнаружении темы. Ни один из этих фактов не достаточен для создания семантического AlphaEdge.

---

## 5. Направление связи

Направление фиксировано явно:

```text
passage/source claim -> target claim
```

В терминах Data7:

```text
toSegment.artifact -> fromSegment.artifact
```

Например, если первая фраза является проверяемым утверждением, а вторая фраза содержит источник, который ему противоречит, то вторая фраза `REFUTES` первую.

Это важно, потому что неориентированное соседство и ориентированное доказательное отношение являются разными объектами. Перестановка endpoint не считается косметической: она должна либо породить другое воспроизводимое доказательство, либо быть заблокирована.

---

## 6. Входной контракт

Factory принимает один объект с восемью обязательными полями:

```js
{
  linkCandidate,
  fromSegment,
  toSegment,
  witnessSegment,
  sourceSnapshot,
  linguisticIndex,
  evidenceCandidate,
  replayConfig: {
    maxOperations,
    maxHits,
    maxPassages
  }
}
```

Почему передаются полные объекты, а не только hashes:

- `linkCandidate` повторно проверяется против трёх полных Segment records;
- Segment повторно сверяется с точным UTF-16 slice исходного SourceSnapshot;
- SourceSnapshot должен реально присутствовать в LinguisticStructureIndex;
- индекс повторно валидируется и запускается;
- EvidenceCandidate должен появиться в новом replay byte-identically;
- Claim AST заново строятся из текстов endpoint;
- SearchHit и context span извлекаются из нового результата поиска, а не принимаются на доверии.

---

## 7. Последовательность fail-closed gate

### 7.1. Безопасная форма данных

До semantic replay рекурсивно запрещаются:

- символические свойства;
- неперечисляемые свойства;
- getters и setters;
- sparse arrays;
- свойства массивов вне индексов;
- циклы;
- `NaN` и бесконечности;
- functions, bigint и другие непрозрачные значения;
- граф данных больше `250000` узлов.
- глубина графа больше `64` объектов;
- source set больше `64` snapshots;
- суммарный текст source set больше `8000000` UTF-16 code units.

Это не даёт скрытому полю исчезнуть при canonical hashing.

### 7.2. Data7 gate

Проверяются:

```text
validateSegment(from)
validateSegment(to)
validateSegment(witness)
validateLinkCandidateAgainst(link, from, to, witness)
```

Дополнительно каждый Segment сверяется с тем же SourceSnapshot:

```text
segment.sourceRef == exact source ref
segment.text == source.text.slice(start, end)
```

### 7.3. Индекс и source set

Проверяются:

```text
LinguisticStructureIndex.validateIndex(index)
SearchContracts.computeSourceSetHash(index.sources)
primary SourceSnapshot exists exactly once
primary snapshot bytes and hashes are identical
```

В результате сохраняются:

```text
sourceSetHash
primarySourceHash
sourceCount
lexicalIndexHash
linguisticIndexHash
lexiconHash
patternSetHash
parserRef
alignerVersion
```

### 7.4. Claim replay

Текст `fromSegment` заново разбирается текущим parser:

```text
Parser.replay(fromSegment.text)
```

Результат обязан быть `RESOLVED`, а полный Claim AST ref обязан совпасть с `EvidenceCandidate.targetClaimRef`.

Затем текст `toSegment` разбирается независимо. Его Claim AST ref обязан совпасть с `EvidenceCandidate.passageClaimRef`.

Валидный Claim AST из другого текста блокируется. Одного совпадения parser version недостаточно.

### 7.5. Детерминированный evidence replay

Адаптер запускает:

```text
LinguisticStructureIndex.replay(
  index,
  parsedTarget,
  explicitBudgets + expected hashes
)
```

Replay обязан вернуть `READY`. Старый EvidenceCandidate должен появиться в `evidenceCandidates` с теми же:

```text
candidateId
contentHash
полным canonical payload
```

Если budget стал слишком мал, источник устарел, индекс изменён или алгоритм больше не получает такой кандидат, адаптер воздерживается через отказ. Старый результат не переиспользуется как будто он актуален.

### 7.6. Exact SourcePassage

Из replay выбирается ровно один passage, координаты которого совпадают с `toSegment`:

```text
sourceHash equal
passage.start == toSegment.start
passage.end   == toSegment.end
```

Затем passage повторно создаётся через `Evidence.createSourcePassage(source, locator)` и сравнивается по content hash, text и textHash.

`EvidenceCandidate.sourceSpanIds` должен быть точно равен:

```text
[sourcePassage.sourceSpanId]
```

### 7.7. SearchHit и context span

Каждый `hitId` кандидата должен разрешиться ровно в один SearchHit нового replay.

Для каждого SearchHit проверяются:

- source id, revision и source hash;
- query ref;
- index ref;
- нахождение locator внутри passage;
- `matchedTextHash == hash(source.slice(hit.start, hit.end))`;
- существование context span с тем же `contextSpanHash`;
- покрытие hit координатами context span;
- нахождение context span внутри Data7 witness.

Context span независимо пересчитывает:

```text
text
textHash
spanHash
spanId
```

### 7.8. PassageClaim и alignment

PassageClaim record должен иметь:

```text
resolutionStatus = RESOLVED
spanMapStatus     = COMPLETE
structural.status = STRUCTURAL_MATCH
```

Его `passageClaimId` и `contentHash` пересчитываются.

Claim alignment должен:

```text
разрешаться ровно в одну запись
иметь корректные alignmentId и contentHash
иметь gateStatus = CLAIM_ALIGNED
```

### 7.9. AlphaEdge

Только после всех предыдущих шагов создаётся:

```js
Alpha.createEdge(passageArtifact, targetArtifact, {
  relation: evidenceCandidate.proposedRelation,
  sourceRefs: [sourceSnapshot.sourceHash],
  status: 'PROPOSED'
})
```

После создания выполняется `validateEdgeAgainst`.

---

## 8. Выходной record

Результат хранит компактные content-addressed refs, а не копию всего индекса:

```text
data7LinkRef
targetSegmentRef
passageSegmentRef
contextSegmentRef
sourceSetRef
queryRef
indexRef
linguisticIndexRef
sourcePassageRef
targetClaimRef
passageClaimRef
passageClaimRecordRef
alignmentRef
hitRefs[]
contextSpanRefs[]
evidenceCandidateRef
edgeProposal
replayConfig
```

Идентичность результата:

```text
proposalId = hash(canonical(identity))
contentHash = hash(canonical(record without contentHash))
```

Доступны две намеренно неравноправные проверки:

```text
inspectEvidenceBackedLinkShape(record)
validateEvidenceBackedLinkAgainst(record, completeDefinition)
```

Первая проверяет только форму, внутренние ссылки и content addressing. Её успешный результат:

```text
STRUCTURALLY_VALID / STRUCTURE_ONLY / NOT_PERFORMED
```

Она никогда не возвращает referential `VALID`. Вторая повторяет полный внешний replay и только при успехе возвращает `VALID / REFERENTIAL_REPLAY / PERFORMED`. Она обязательна на любой границе принятия решения.

---

## 9. Псевдокод

```text
function EVIDENCE_BACK_LINK(input):
    rejectHiddenOrOpaqueData(input)

    source := validateSourceSnapshot(input.sourceSnapshot)
    validateSegmentsAgainstSource(input.endpoints, source)
    validateLinkCandidateAgainst(input.linkCandidate, input.endpoints)

    index := validateLinguisticIndex(input.linguisticIndex)
    requireExactSourceInIndex(source, index)

    candidate := validateEvidenceCandidate(input.evidenceCandidate)
    require candidate.relation in {SUPPORTS, REFUTES}
    reject QUALIFIES until direction in {NARROWER, BROADER}
    require candidate.status == STRUCTURALLY_ALIGNED

    targetParse := Parser.replay(input.fromSegment.text)
    require targetParse.claimRef == candidate.targetClaimRef

    replay := LinguisticIndex.replay(index, targetParse, explicitBudgets)
    require replay.status == READY
    require replay contains candidate byte-identically

    passage := resolveExactPassage(replay, input.toSegment)
    passageParse := Parser.replay(input.toSegment.text)
    require passageParse.claimRef == candidate.passageClaimRef

    resolveAndVerifyEveryHit(candidate.hitIds, replay, source, passage)
    resolveAndVerifyEveryContext(replay, source, input.witnessSegment)
    resolvePassageClaimAndAlignment(replay, passage, candidate)

    edge := AlphaEdge(
        from = input.toSegment.artifact,
        to = input.fromSegment.artifact,
        relation = candidate.proposedRelation,
        status = PROPOSED
    )

    return EvidenceBackedLinkProposal(
        edge,
        reviewStatus = REQUIRES_REVIEW,
        finalRelation = NOT_COMPUTED,
        semanticTruth = false,
        commitAllowed = false
    )
```

---

## 10. Проверенный пример

Target:

```text
Система сохраняет состояние.
```

Passage:

```text
Система не сохраняет состояние.
```

Pipeline повторно получает:

```text
target Claim AST: RESOLVED
passage Claim AST: RESOLVED
predicate alignment: TRUE
argument alignment: TRUE
polarity alignment: FALSE
proposed relation: REFUTES
edge status: PROPOSED
final relation: NOT_COMPUTED
```

Положительный контроль с двумя одинаковыми утверждениями повторно получает `SUPPORTS`, но также только в статусе `PROPOSED`.

---

## 11. Регрессионные проверки

Новый набор содержит 23 проверки:

```text
PASS: 23/23 checks
```

Покрыты:

1. замороженный API и authority ceiling;
2. воспроизводимый `REFUTES`;
3. направление passage -> target;
4. разыменование hit/context/passage/claim/alignment;
5. byte-identical replay;
6. положительный `SUPPORTS` control;
7. полный multi-source source set;
8. фиктивный `hitId`, который пропускает общий record validator;
9. запрет `MENTIONS -> ASSOCIATES`;
10. `QUALIFIES_DIRECTION_UNPROVEN`;
11. обязательный `STRUCTURALLY_ALIGNED`;
12. чужой валидный EvidenceCandidate;
13. переставленные endpoint;
14. stale source/index и source-set size budgets;
15. недостаточный replay budget;
16. подменённый provenance;
17. попытка получить `REVIEWED`, final relation, truth или receipt;
18. rehashed query-ref forgery проходит только shape inspection, но блокируется Against;
19. detached hit/context/claim refs;
20. изменённый внешний evidence bundle;
21. hidden/symbol/accessor/depth fields;
22. dependency gate в свежем VM;
23. отсутствие DOM/network/clock/random/eval/commit authority.

---

## 12. Размер и декомпозиция

Модуль намеренно вынесен из `p78-living-ring-interface.html` и из `p78.js`.

Это сохраняет главное приложение лёгким:

- shell не содержит новый код;
- Canvas loop не получает replay-нагрузку;
- индекс не пересчитывается внутри animation frame;
- модуль загружается только в специальном evidence workflow;
- большие source/index records не копируются в итоговый proposal;
- итог хранит compact refs и hashes;
- `maxGraphNodes`, replay budgets и source counts ограничены.
- до полного `validateIndex` проверяются `maxSourceCount` и `maxSourceCodeUnits`;
- слишком большой корпус блокируется до дорогой перестройки passages и indexes.

Тяжёлый semantic replay должен выполняться по явной команде вне кадрового цикла. Его нельзя подключать к каждой частице или каждому `requestAnimationFrame`.

---

## 13. Что не подключено

На этом шаге не изменены:

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

Новый модуль не загружен в browser shell. Поэтому текущая анимация P78 и существующий интерфейс работают точно по прежнему runtime path.

---

## 14. Что результат не доказывает

Даже полный referential replay не доказывает:

- фактическую истинность target или passage;
- независимость источников;
- качество самого источника;
- отсутствие скрытого противоречия в другом документе;
- причинность;
- полноту корпуса;
- окончательность SUPPORTS или REFUTES и даже направление QUALIFIES;
- возможность AG5;
- готовность к автоматическому изменению пользовательского текста.

Replay доказывает более узкое утверждение:

> При зафиксированных source bytes, parser, lexicon, query, index, aligner и budgets текущий детерминированный pipeline снова получает тот же review-only EvidenceCandidate для тех же endpoint.

---

## 15. Следующий безопасный этап

Есть две независимые ветви.

### 15.1. Пассивное представление

`EvidenceBackedLinkView` может показывать:

- target и passage;
- relation proposal;
- точные source coordinates;
- query/index/parser pins;
- hit и context counts;
- `PROPOSED` и `REQUIRES_REVIEW`;
- причины отказа.

Панель не должна иметь commit action и не должна запускаться в animation frame.

### 15.2. Решение проверяющего

Для реального перехода к `REVIEWED` нужен отдельный `HumanReviewDecisionContract`:

```text
reviewer identity or role
review timestamp supplied as external data
proposal ref
decision = ACCEPT | REJECT | REQUEST_CHANGES
reason codes
conflict set
source-quality assessment
prior decision ref
review receipt
```

Нельзя повышать `PROPOSED` до `REVIEWED` только потому, что `sourceRefs` не пуст. Существующий Alpha contract технически разрешает такой record, но P78 должен требовать отдельное доказательство человеческого решения.

Отдельно до включения `QUALIFIES` требуется directional alignment contract с `NARROWER/BROADER`, qualifier scope и положительными/обратными тестами направления.

До появления этого контракта `EvidenceBackedLinkProposal` остаётся верхней автоматической ступенью.

---

## 16. Реализованное продолжение

Указанный directional alignment contract реализован следующим независимым срезом:

- [`50-p78-qualifier-direction-contract-implementation.md`](50-p78-qualifier-direction-contract-implementation.md);
- `p78-qualifier-direction-contracts.js`;
- `p78-evidence-backed-link-adapter@1.4.0`;
- `meridian.data7-evidence-backed-link-proposal/2`.

Исторические ограничения этой спецификации v1 сохранены для аудита. В v2 `QUALIFIES` разрешён только для passage-relative `NARROWER`, доказанного повторным разбором точного `через <METHOD>`, позиционным METHOD span и буквальным совпадением остатка source; `BROADER` и `ABSTAIN` не создают edge. `PROPOSED`, `REQUIRES_REVIEW`, `semanticTruth:false`, `commitAllowed:false` и `alphaTransitionReceipt:null` не изменены.

## 17. Подключённое пассивное представление

Следующий этап реализован в [`51-p78-evidence-backed-link-view-implementation.md`](51-p78-evidence-backed-link-view-implementation.md). Adapter 1.4 связывает validation report с `proposalId/contentHash`, полным набором отображаемых source/index/parser/validator pins, endpoint text/segment hashes, locators и authority boundary. Bounded projector, Web Worker runner и пассивный View подключены к P78 без human review, final relation или commit authority.

Статус этого документа остаётся исторической границей v1; актуальная shell-интеграция описана документом 51.
