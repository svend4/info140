# P78: доказательная связь в интерфейсе - projector, bound replay и пассивный View

## 1. Статус этапа

`EVIDENCE_BACKED_LINK_VIEW_WIRED_PASSIVE`

Текущий технический статус:

```text
ADAPTER_VERSION                    = 1.4.0
VALIDATION_REPORT                 = meridian.evidence-backed-link-validation-report/1
VIEW_MODEL                        = meridian.evidence-backed-link-view-model/1
PROJECTOR                         = 1.1.0 / READY / PURE
PASSIVE_VIEW                      = 1.1.0 / READY
ASYNC_RUNNER                      = 1.0.0 / READY
REPLAY_EXECUTION                  = DEDICATED_WEB_WORKER
P78_RUNTIME                       = 1.9.0
WIRED_TO_P78_SHELL                = true
MAX_AUTOMATIC_RELATION_STATUS     = PROPOSED
HUMAN_REVIEW                      = REQUIRES_REVIEW
FINAL_RELATION                    = NOT_COMPUTED
SOURCE_AUTHORITY                  = UNVERIFIED
SEMANTIC_TRUTH                    = false
COMMIT_ALLOWED                    = false
```

Реализованные файлы:

- [`../prototype/lib/p78-evidence-backed-link-adapter.js`](../prototype/lib/p78-evidence-backed-link-adapter.js);
- [`../prototype/lib/p78-evidence-backed-link-projector.js`](../prototype/lib/p78-evidence-backed-link-projector.js);
- [`../prototype/lib/p78-evidence-backed-link-view.js`](../prototype/lib/p78-evidence-backed-link-view.js);
- [`../prototype/lib/p78-evidence-backed-link-runner.js`](../prototype/lib/p78-evidence-backed-link-runner.js);
- [`../prototype/lib/p78-evidence-backed-link-worker.js`](../prototype/lib/p78-evidence-backed-link-worker.js);
- [`../prototype/p78-evidence-backed-link-view.css`](../prototype/p78-evidence-backed-link-view.css);
- [`../prototype/p78-living-ring-interface.html`](../prototype/p78-living-ring-interface.html);
- [`../prototype/lib/p78-living-ring-runtime.js`](../prototype/lib/p78-living-ring-runtime.js).

Проверки:

- [`../prototype/tests/semantic-p78-evidence-backed-link-adapter-regression.cjs`](../prototype/tests/semantic-p78-evidence-backed-link-adapter-regression.cjs);
- [`../prototype/tests/semantic-p78-evidence-backed-link-projector-regression.cjs`](../prototype/tests/semantic-p78-evidence-backed-link-projector-regression.cjs);
- [`../prototype/tests/semantic-p78-evidence-backed-link-view-regression.cjs`](../prototype/tests/semantic-p78-evidence-backed-link-view-regression.cjs);
- [`../prototype/tests/semantic-p78-evidence-backed-link-runner-regression.cjs`](../prototype/tests/semantic-p78-evidence-backed-link-runner-regression.cjs);
- [`../prototype/tests/browser-p78-evidence-backed-link.cjs`](../prototype/tests/browser-p78-evidence-backed-link.cjs).

Это первый этап, на котором результат `EvidenceBackedLinkAdapter` не только существует как автономный контракт, но и виден рядом с исходными `EvidenceCandidate` и `SemanticFlowFrame` в основном P78. Подключение остаётся только диагностическим. Оно не добавляет кнопок принятия, не выполняет запись в ledger, не меняет текст пользователя и не создаёт `REVIEWED` или финальное отношение.

## 2. Зачем понадобился отдельный projector

До этого runtime имел два соседних слоя:

1. `EvidenceCandidateView` показывал широкие кандидаты поиска и структурного сопоставления.
2. `SemanticFlowView` показывал post-hoc распределение работы по пяти состояниям двумерного кольца.

Между ними отсутствовал воспроизводимый переход от найденного passage к узкому Data7 proposal. Нельзя было просто передать `EvidenceCandidate` во View. `EvidenceBackedLinkAdapter` требует полный согласованный набор:

```text
Data7 LinkCandidate
target Segment
passage Segment
witness Segment
SourceSnapshot
LinguisticStructureIndex
EvidenceCandidate
replayConfig
```

Сборка такого набора внутри DOM-renderer была бы ошибкой владения. View начал бы искать источники, повторно запускать parser, создавать сегменты и одновременно строить HTML. Поэтому введён `p78-evidence-backed-link-projector.js`.

Projector остаётся чистым синхронным преобразователем как вычислительное ядро, но runtime 1.9 запускает его только внутри выделенного Web Worker:

```text
target text
  + source-backed cascade result
  + pinned linguistic index
    -> bounded candidate projection
    -> Data7 exact segments
    -> EvidenceBackedLinkProposal
    -> bound referential validation
    -> compact content-addressed ViewModel
```

Главный поток передаёт worker только data-запрос, получает versioned response и валидирует компактную модель. Runner отбрасывает устаревший ответ при более новом запросе и закрывает зависший запрос по timeout. DOM View получает только последний небольшой объект. Он не получает source resolver callback, полный corpus, parser API или произвольный validation report.

## 3. Что обнаружил аудит перед подключением

### 3.1. Отчёт validation был отсоединён от proposal

Старая форма полного отчёта содержала:

```text
status = VALID
validationScope = REFERENTIAL_REPLAY
referentialReplay = PERFORMED
```

Но она не содержала `proposalId` и `contentHash`. Поэтому отчёт от proposal A теоретически можно было ошибочно показать рядом с proposal B. Само слово `VALID` не доказывало, какой объект был проверен.

Adapter 1.4.0 исправляет это и дополнительно связывает все значения, которые показывает View. Успешный отчёт теперь содержит:

```text
subjectRef.schema
subjectRef.proposalId
subjectRef.contentHash

validatorRef.schema
validatorRef.version
validatorRef.validatorVersion
validatorRef.qualifierDirectionRulesetHash

evidenceBundleRef.sourceSetHash
evidenceBundleRef.primarySourceHash
evidenceBundleRef.sourceCount
evidenceBundleRef.sourceRef
evidenceBundleRef.queryHash
evidenceBundleRef.indexHash
evidenceBundleRef.linguisticIndexHash
evidenceBundleRef.lexicalIndexHash
evidenceBundleRef.lexiconHash
evidenceBundleRef.patternSetHash
evidenceBundleRef.parserRef
evidenceBundleRef.alignerVersion
evidenceBundleRef.evidenceCandidateHash
evidenceBundleRef.targetSegmentHash
evidenceBundleRef.passageSegmentHash
evidenceBundleRef.contextSegmentHash
evidenceBundleRef.targetLocator
evidenceBundleRef.passageLocator
evidenceBundleRef.contextLocator
evidenceBundleRef.targetTextHash
evidenceBundleRef.passageTextHash
evidenceBundleRef.proposedRelation
evidenceBundleRef.direction
evidenceBundleRef.basis
evidenceBundleRef.qualifierDirectionAssessmentHash
evidenceBundleRef.hitCount
evidenceBundleRef.contextCount
evidenceBundleRef.storedVerificationStatus
```

Таким образом, ViewModel нельзя перекрестно соединить с чужим отчётом без ошибки `REPLAY_BINDING_INVALID`. Независимая подмена query/index/parser/validator/ruleset pin, source label, locator, relation, count или endpoint text после пересчёта внешнего `contentHash` также блокируется.

### 3.2. Content hash не является подписью источника

Полный replay подтверждает внутреннюю согласованность локального `SourceSnapshot`. Он не подтверждает, кто выпустил источник, был ли он получен из доверенного реестра и не создал ли весь согласованный bundle сам вызывающий код.

Поэтому успешный локальный результат отображается как:

```text
REFERENTIAL_REPLAY = PERFORMED
SOURCE_AUTHORITY_UNVERIFIED
```

Запрещено объединять эти две строки в зелёный статус «источник проверен». Для перехода к доверенному источнику понадобится отдельный registry receipt, подпись или MAC, находящиеся вне текущего этапа.

### 3.3. Нельзя искусственно соединять пользовательский target с любым passage

Data7 требует общий точный источник. Оба endpoint и witness должны принадлежать одному `SourceSnapshot`. Если пользовательская фраза отсутствует в источнике passage, projector возвращает `TARGET_NOT_IN_COMMON_SOURCE`. Если точных вхождений больше одного, возвращается `TARGET_OCCURRENCE_AMBIGUOUS`.

Точное совпадение target с самим passage тоже не становится «поддержкой самого себя». Оно отклоняется как `SELF_LINK_FORBIDDEN`.

### 3.4. Replay нельзя выполнять в animation frame

Полный linguistic replay существенно тяжелее отрисовки частицы. `renderControlledClaim()` только отправляет versioned request; сам projector исполняется в выделенном Web Worker. Функция `frame()` не вызывает ни dispatch, ни replay.

Это сохраняет разделение:

```text
requestAnimationFrame -> визуальная динамика кольца
claim command         -> bounded worker request
Web Worker            -> bounded semantic replay
```

### 3.5. Итоговый независимый аудит обнаружил четыре дополнительные границы

После первого подключения отдельный read-only аудит построил контрпримеры, которые проходили старый `inspectViewModel()`:

1. ViewModel сравнивал receipt только с частью отображаемых pins. Query, index, validator и source label можно было изменить отдельно и пересчитать внешний hash.
2. Вложенный receipt принимал `reviewStatus = REVIEWED`, `semanticTruth = true` и `commitAllowed = true`, хотя внешний summary оставался безопасным.
3. View сначала проверял mutable object, а затем рендерил тот же объект. Изменение между этими действиями создавало TOCTOU-границу.
4. Полный replay выполнялся в UI thread. Edge-измерение показало паузу кадров около `1450 ms`.

Исправления:

```text
Adapter 1.4       -> полный display-to-receipt bundle
Projector 1.1     -> строгая nested authority boundary
snapshotViewModel -> detached deeply frozen render snapshot
atomic create     -> один replay вместо create + повторного validate-against
Runner + Worker   -> replay вне UI thread, stale response suppression, timeout
```

Эти изменения не делают receipt цифровой подписью. Они гарантируют внутреннюю привязку внутри локального вычислительного контура; происхождение SourceSnapshot остаётся `UNVERIFIED`.

## 4. Bound validation report

Schema:

```text
meridian.evidence-backed-link-validation-report/1
report.version = 1.1.0
```

Validator pin:

```text
p78-evidence-backed-link-adapter@1.4.0
```

Успешный structure-only отчёт имеет:

```text
status             = STRUCTURALLY_VALID
validationScope    = STRUCTURE_ONLY
referentialReplay  = NOT_PERFORMED
sourceAuthority    = NOT_ASSESSED
evidenceBundleRef  = null
```

Успешный полный отчёт имеет:

```text
status             = VALID
validationScope    = REFERENTIAL_REPLAY
referentialReplay  = PERFORMED
sourceAuthority    = UNVERIFIED
subjectRef         = exact proposal identity
evidenceBundleRef  = exact replay identity
```

Оба отчёта сохраняют:

```text
reviewStatus  = REQUIRES_REVIEW
semanticTruth = false
commitAllowed = false
```

Ошибочный отчёт не сохраняет частично доверенный `subjectRef`: он возвращает `subjectRef = null`, `evidenceBundleRef = null`, `referentialReplay = NOT_CONFIRMED`.

## 5. Алгоритм projector

Входной контракт:

```text
project({
  targetText,
  cascadeResult,
  linguisticIndex
})
```

Projector сначала проверяет index через `LinguisticStructureIndex.validateIndex`. Затем он требует совпадение `sourceSetHash` и `linguisticIndexHash` с cascade result.

Единственное исключение предназначено для честного upstream abstention. Если parser остановился до corpus replay и вернул пустой `evidenceCandidates`, отсутствие corpus hashes разрешено только для создания пустого `ABSTAIN`. Непустой результат без pins или результат с явно несовпадающими pins блокируется.

Псевдокод:

```text
function project(targetText, cascadeResult, linguisticIndex):
    validate linguisticIndex
    validate cascade/index pins

    candidates = bounded_scan(cascadeResult.evidenceCandidates, 512)
    eligible = candidates where
        status == STRUCTURALLY_ALIGNED and
        relation in {REFUTES, QUALIFIES, SUPPORTS}

    sort eligible by fixed relation priority and candidateId
    attempts = first 8 eligible

    for each candidate in attempts:
        source = exact SourceSnapshot from index
        passage = exact located SourcePassage
        targets = exact sentence occurrences of targetText in same source

        if targets.count != 1:
            reject
            continue

        if target.locator == passage.locator:
            reject SELF_LINK_FORBIDDEN
            continue

        if target overlaps passage:
            reject SEGMENT_OVERLAP
            continue

        targetSegment, passageSegment = Data7 SEGMENT(alpha=0)
        witnessSegment = full exact source context
        linkCandidate = CO_OCCURS_WITH(target, passage, witness)
        proposal, receipt = createEvidenceBackedLinkWithValidation(fullDefinition)

        require receipt.subjectRef == proposal identity
        emit compact proposal view record

    return frozen content-addressed ViewModel
```

Ограничения projector:

```text
MAX_SCAN_CANDIDATES    = 512
MAX_ATTEMPTS           = 8
MAX_REJECTIONS_SHOWN   = 8
MAX_EXCERPT_CODE_UNITS = 1200
maxOperations          = 100000
maxHits                = 512
maxPassages            = 128
```

Эти значения меньше общих верхних границ adapter. UI не пытается отрисовать сто тысяч hit refs и не сортирует произвольный миллион объектов перед применением display limit.

## 6. Стандартный пример P78

Ввод:

```text
Система сохраняет состояние.
```

Общий локальный источник:

```text
Система сохраняет состояние.
Система не сохраняет состояние.
Система изменяет состояние.
```

Cascade создаёт семь кандидатов:

```text
SUPPORTS = 1
REFUTES  = 1
MENTIONS = 5
```

Projector обрабатывает результат так:

```text
REFUTES passage  -> один EvidenceBackedLinkProposal
SUPPORTS passage -> SELF_LINK_FORBIDDEN
MENTIONS         -> пять STRUCTURAL_ALIGNMENT_REQUIRED skips
```

Итоговый счётчик:

```text
candidateCount = 7
attemptedCount = 2
proposalCount  = 1
rejectionCount = 1
skippedCount   = 5
```

Направление отображается буквально:

```text
REFUTES
PASSAGE -> TARGET
```

Это важно для двумерной модели. Passage является новой внешней единицей, которая действует на текущий target, а не наоборот. Геометрическое положение карточки не меняет направление семантического ребра.

## 7. QUALIFIES и асимметрия

Для пары:

```text
TARGET:  Система проверяет документ.
PASSAGE: Система проверяет документ через формулу.
```

полный parser replay подтверждает один exact method delta. Passage уже target по синтаксической области, поэтому:

```text
directionDomain = SYNTACTIC_SPECIFICITY
scopeDirection  = NARROWER
qualifiedSide   = PASSAGE
relation        = QUALIFIES
orientation     = PASSAGE_TO_TARGET
```

View показывает `MethodWitness`: сторону, ключ qualifier, marker token и sense id. `BROADER` не превращается в обратное ребро. Он остаётся диагностикой adapter и даёт `QUALIFIES_ENDPOINT_DIRECTION_MISMATCH`.

Так реализована узкая информационная асимметрия: два соседних высказывания не считаются взаимозаменяемыми только из-за общих слов. Направление определяется воспроизводимой разницей структуры.

## 8. ViewModel как малая граница между расчётом и DOM

Schema:

```text
meridian.evidence-backed-link-view-model/1
```

Корневая запись содержит:

- status `REPLAYED` или `ABSTAIN`;
- target text hash;
- replay scope и source authority;
- количество входных кандидатов, попыток, proposal, rejection и skip;
- не более восьми proposal summaries;
- не более восьми rejection summaries;
- агрегированные reason counts;
- неизменяемую authority boundary;
- `contentHash` всей модели.

Каждый proposal summary содержит:

- bound `subjectRef`;
- relation, direction и basis;
- точные target и passage text с UTF-16 locator;
- segment id и segment content hash;
- общий source ref и context locator;
- query/index/parser/lexicon/pattern/evidence-candidate/ruleset/validator pins;
- hit/context/source counts;
- qualifier witness для `QUALIFIES`;
- полный малый validation receipt;
- раздельные stored, replay, source, review и final statuses.

`inspectViewModel()` применяет собственный малый data budget, запрещает cyclic, accessor, symbol, hidden и sparse shapes, перепроверяет outer content hash, полный receipt binding и обе границы полномочий. `snapshotViewModel()` сначала создаёт detached data copy, проверяет её и возвращает глубоко замороженный snapshot для рендера.

Даже если внешний код пересчитает `contentHash`, следующие изменения остаются недопустимыми:

```text
receipt от другого proposal
изменённый target text
изменённый passage text
изменённый segment hash
изменённый source/index pin
изменённый query/parser/validator/ruleset pin
изменённый sourceId/revision
повышенные review/truth/commit внутри receipt
semanticTruth = true
commitAllowed = true
finalRelation != NOT_COMPUTED
reviewStatus != REQUIRES_REVIEW
```

## 9. Пассивный DOM View

`p78-evidence-backed-link-view.js` выполняет только три операции:

```text
create and validate detached snapshot
clear stale DOM
render immutable snapshot as text nodes
```

View никогда не продолжает читать исходный mutable input после validation. Отдельная regression изменяет вход в момент первой записи `dataset` и подтверждает, что DOM получает только ранее принятый snapshot.

Он использует `createElement` и `textContent`. В нём нет:

- `innerHTML`;
- callback resolver;
- `fetch`, XHR или WebSocket;
- local/session storage;
- timer или animation frame;
- event listener;
- кнопки, ссылки или формы;
- accept, reject, commit, undo или portal action.

На экране раздельно показаны:

```text
stored proposal       = REPLAY_REQUIRED
local replay          = PERFORMED
source authority      = UNVERIFIED
relation              = PROPOSED
human review          = REQUIRES_REVIEW
final relation        = NOT_COMPUTED
semantic truth        = false
commit                = false
```

Текст source excerpt имеет `unicode-bidi: plaintext`, перенос длинных слов и ограниченный размер. Статус находится вне excerpt, поэтому управляющие Unicode-символы источника не должны визуально переставлять fixed badges.

CSS использует container queries для 760 и 480 px, устойчивые grid tracks, `overflow-wrap:anywhere`, радиусы не больше 6 px и не содержит animation или gradient decoration.

## 10. Fail-closed состояния

| Ситуация | Результат |
|---|---|
| model shape некорректен | `INVALID`, старый proposal очищается |
| parser остановился до evidence cascade | `ABSTAIN`, ноль proposal |
| target отсутствует в общем source | `TARGET_NOT_IN_COMMON_SOURCE` |
| target встречается неоднозначно | `TARGET_OCCURRENCE_AMBIGUOUS` |
| target совпадает с passage | `SELF_LINK_FORBIDDEN` |
| endpoint перекрываются | `SEGMENT_OVERLAP` |
| source отсутствует в index | `SOURCE_SNAPSHOT_NOT_FOUND` |
| receipt относится к другому proposal | `REPLAY_BINDING_INVALID` |
| receipt не связывает endpoint hashes | `REPLAY_BUNDLE_BINDING_INVALID` |
| попытка повысить полномочия | `MODEL_AUTHORITY_BOUNDARY_VIOLATION` |
| optional stack не загрузился | UI `BLOCKED`, CandidateView и FlowView продолжают работу |

Важное различие:

```text
ABSTAIN = вход обработан, направленная связь не построена
BLOCKED = необходимый компонент или контракт недоступен
INVALID = переданная модель нарушает собственный контракт
```

## 11. Интеграция в shell

Новый DOM root расположен в analysis section строго между:

```text
#controlledClaimEvidence
#evidenceBackedLinkView
#semanticFlowView
```

Порядок загрузки семантического стека:

```text
Canonical + Search + Parser + Evidence + LinguisticIndex
AlphaOrbitContracts
Data7Adapter
QualifierDirectionContracts
EvidenceBackedLinkAdapter 1.4.0
EvidenceBackedLinkProjector 1.1.0
EvidenceBackedLinkView 1.1.0
EvidenceBackedLinkRunner 1.0.0
EvidenceBackedLinkWorker 1.0.0
P78 runtime 1.9.0
```

Runtime делает stack optional. Сразу устанавливается fail-closed `PENDING`, а versioned worker result принимается только для последнего request id. Ошибка worker или projector очищает только новую панель и не останавливает `renderSemanticFlow()`.

## 12. Связь с самостоятельным 2D-кольцом

Новый слой не требует P79/Q6 как центра и не требует P80/1D как внешнего расщепления. Он работает внутри P78 на двух отношениях:

```text
ось 1: passage -> target
ось 2: relation class + specificity direction
```

Здесь двумерное «движение» получает технически наблюдаемую форму:

```text
широкий поиск
  -> структурное выравнивание
  -> точное общее source context
  -> направленный proposal
  -> human review boundary
```

Система избегает двух крайностей:

- не схлопывает все совпадения в одну истинную связь;
- не рассыпает найденные элементы в несвязанный список строк.

Она сохраняет средний режим: один точный passage может предложить действие на target, но действие остаётся открытым и проверяемым. Это ближе к исходной цели живого 2D-конвейера, чем одинаковые точки без различимых причинных ролей.

## 13. Производительность и движение canvas

Первый усиленный browser-test обнаружил, что синхронное подключение было недостаточным:

```text
projection elapsed = 1978 ms
maximum frame gap  = 1450.4 ms
```

После переноса replay в Web Worker контрольный Edge-прогон дал:

```text
background projection elapsed = 2762 ms
maximum main-thread frame gap  = 633.5 ms
observed animation frames      = 113
```

Общее фоновое вычисление не обязано стать короче и на загруженном прогоне занимало до `4566 ms`: принципиально то, что оно больше не занимает UI thread на всё время replay. Регрессия требует завершения раньше worker timeout (`projection < 15000 ms`), `maximum frame gap < 1200 ms`, долю gap меньше `40%` общей длительности и больше десяти animation frames во время ожидания. Такой критерий отличает медленный фон от многосекундной блокировки UI.

Дополнительно до semantic replay и спустя 350 ms после него берётся FNV-подобный hash sampled canvas pixels.

Условия успеха:

```text
canvas.visible_before > 100
canvas.visible_after  > 100
canvas.hash_before    != canvas.hash_after
```

Это подтверждает, что canvas остаётся непустым и продолжает меняться во время асинхронного replay. Проверка не доказывает идеальную плавность на любом устройстве, но теперь обнаруживает и многосекундную паузу main thread, и полную остановку, и blank canvas.

## 14. Проверенные сценарии

Projector regression проверяет:

- стандартный `REFUTES`;
- self-link `SUPPORTS` rejection;
- `QUALIFIES/NARROWER` с MethodWitness;
- отсутствие общего target;
- upstream OOV abstention;
- byte-determinism и deep freeze;
- cross-wired validation receipt;
- forged endpoint text;
- detached query/validator/source pins;
- authority escalation внутри summary и receipt;
- immutable snapshot против TOCTOU;
- accessor, cycle и sparse shapes;
- 600 кандидатов при bounded scan/attempt;
- отсутствие DOM, network, storage, clock и command authority.

View и Runner regression проверяют:

- точные endpoint text;
- `PASSAGE -> TARGET`;
- раздельные stored/replay/source/review/final states;
- provenance pins;
- отсутствие executable и command elements;
- stale clearing при invalid model;
- `ABSTAIN` без выдуманного ребра;
- идемпотентный render;
- render только из detached immutable snapshot;
- единственный малый `aria-live` status;
- responsive CSS и load order;
- versioned worker protocol;
- generation-bound worker events and physical stale-worker cancellation;
- отмену устаревшего ответа;
- invalid model и worker error;
- отсутствие синхронного replay в runner;

Browser regression проверяет:

- localhost HTTP 200;
- реальный стандартный replay;
- точный `REFUTES`;
- один rejection и пять skips;
- отсутствие controls;
- неизменность claim input;
- движение canvas после replay;
- bounded maximum frame gap;
- ограниченную высоту desktop sidebar;
- непустой screenshot;
- OOV очищает старый proposal;
- отсутствие horizontal overflow при 390 px;
- отсутствие console, page и request errors.

Зафиксированные результаты этапа:

```text
EvidenceBackedLinkAdapter regression = PASS: 26/26 checks
Projector regression                 = PASS: 18/18 checks
View regression                      = PASS: 15/15 checks
Runner regression                    = PASS: 6/6 checks
Microsoft Edge localhost regression  = PASS: 14/14 checks
Full semantic regression             = PASS: 60/60 suites, 765/765 checks
```

## 15. Что это ещё не решает

Реализованный слой не является:

- универсальным пониманием русского языка;
- автоматическим фактчекером;
- доверенным registry источников;
- human review workflow;
- редактором научной статьи;
- системой автоматического продолжения произвольного текста;
- доказательством математической или гуманитарной истинности.

Он решает более узкую и необходимую задачу: показывает, что конкретная направленная связь воспроизводится из конкретного локального source bundle при зафиксированных parser/index/ruleset версиях.

## 16. Следующий принципиальный этап

Следующим отдельным контрактом остаётся `HumanReviewDecisionContract`.

Он не должен быть встроен в текущий View. Требуются новые сущности:

```text
ReviewSubjectRef
ReviewerIdentity
ReviewDecision = ACCEPT | REJECT | REQUEST_CHANGES
ReviewReasonCodes
SourceAuthorityReceipt
DecisionTimestamp or logical revision
DecisionSignature or trusted host binding
```

Только после такого шага можно обсуждать переход:

```text
PROPOSED -> REVIEWED
```

Даже `REVIEWED` не обязан автоматически означать `semanticTruth = true`. Для научных и энциклопедических задач отдельно нужны правила достаточности источников, конфликтов, цитирования и отзыва решения.

До этого текущий честный максимум остаётся:

```text
точный локальный replay
+ направленный evidence-backed proposal
+ пассивная визуализация
+ явная необходимость human review
```
