# 38 - P78: многоагентный семантический поток и распределение по 1D/2D/3D

Статус: `REVIEWED_DESIGN`, реализация ещё не подключена  
Дата аудита: 2026-07-20  
Исследованный проект: `C:\Users\stefan\Documents\New project ai colab`  
Цель: определить, какие механизмы многоагентной работы полезны P78, как адаптировать их без ложной семантической власти и какие идеи уместны в соседних P79/P80

Связанные документы:

- [26 - протокол трёх соседних миров](26-three-neighbor-worlds-protocol.md);
- [30 - научное слияние и разделение](30-scientific-synthesis-fission-fusion-spec.md);
- [36 - реализация AG4](36-p78-source-backed-claim-cascade-implementation.md);
- [37 - план AG5-AG7](37-p78-ag5-ag7-parallel-development-review.md).

---

## 1. Итоговое решение

Внешний проект полезен не как готовый семантический движок, а как библиотека архитектурных идей для управления параллельной работой. В нём сильнее всего реализованы:

- файловые задачи и зависимости;
- атомарный claim задачи;
- lease, TTL и fencing token;
- изоляция вариантов;
- журналирование и provenance;
- типизированные текстовые ячейки;
- сохранение конфликтов;
- трёхстороннее слияние;
- backpressure и ограничение числа одновременно активных работ.

Слабо или только экспериментально реализованы:

- настоящий автономный запуск агентов;
- единый транзакционный pipeline;
- полные retry/dead-letter/budget механизмы;
- проверенная независимость агентов;
- смысловой консенсус;
- обнаружение логического противоречия;
- quorum как основание решения;
- доказательная привязка результата к источникам.

P78 имеет противоположный профиль: его Claim AST, exact source locators, EvidenceCandidate и `ABSTAIN` строже, но визуальное движение пока недостаточно связано с очередями реальных семантических операций. Поэтому правильная адаптация - соединить **координационные контракты** внешнего проекта с **семантическими контрактами** P78, не копируя эвристические выводы и не повышая их до истины.

---

## 2. Метод аудита

Четыре независимых агента получили разные read-only задания:

1. инвентаризация фактической архитектуры и исполняемого кода;
2. формальное соответствие «агент/задача/сообщение» семантическим объектам P78;
3. проектирование детерминированного orchestration protocol;
4. проверка зависимостей, лицензии, безопасности и переносимости.

Затем выводы были сопоставлены с текущими файлами P78 и ограничениями AG4. Агенты не изменяли ни внешний проект, ни P78 и не использовали сеть.

Проверенный масштаб внешней папки: около 1645 файлов, включая 148 production Python tools, 147 tests, большую документацию и сотни файловых задач. Это значительная экспериментальная база, но размер не равен зрелости.

---

## 3. Фактическая архитектура внешнего проекта

| Механизм | Репрезентативные файлы | Фактический статус |
|---|---|---|
| launch plan | `tools/flow.py` | формирует handoff, сам агентов не запускает |
| DAG readiness | `tools/dispatch.py` | вычисляет готовые задачи и приоритеты |
| pipeline queue | `tools/pipeline.py` | выдаёт задачи и выполняет claim, завершение не полностью транзакционно |
| atomic claim | `tools/_claims.py`, `tools/agent_queue.py` | `O_EXCL`, TTL, takeover, fencing; одна из сильнейших частей |
| batch/barrier | `tools/top.py` | создаёт команды и барьер, но readiness не доказывает корректность результата |
| conveyor | `tools/conveyor.py` | считает inflight/refill/idle и рекомендует действия |
| messages | `tools/thread.py` | файловые сообщения; возможны гонки имён и метаданных |
| typed cells | `tools/text_mux.py` | ячейки, lanes, frames, явный `conflict`; JSONL write не имеет строгого process lock |
| document grouping | `tools/doc_consensus.py` | provenance `file:line`, но сходство лексическое и order-sensitive |
| independence | `tools/independence_measure.py` | полезная метаидея, но происхождение частично самодекларируемое |
| semantic clustering | `tools/consensus_by_meaning.py` | стемминг, Jaccard, single-linkage; не Claim semantics |
| contradiction heuristic | `tools/semantic_engine.py` | SimHash и отрицательные маркеры; не логическое доказательство |
| quorum | `tools/oracle_quorum.py` | большинство допускается даже при однородных моделях |
| red-team gate | `tools/red_team_gate.py` | severity ошибочно может считаться независимым свидетелем |
| three-way merge | `tools/crdt_merge.py`, `tools/seq_merge.py` | полезная основа для структурного merge с явным конфликтом |
| worktree isolation | `tools/worktree.py`, `tools/commit_lock.py` | практичная инфраструктура независимых ветвей |

`independent_pipeline.py` ближе к мета-доске: фазы не обмениваются строгими типизированными результатами, последующие фазы могут продолжиться после ошибки, а process exit не всегда отражает частичный провал.

---

## 4. Ограничения переноса

### 4.1. Лицензия

В корне исследованной папки не найдены `LICENSE`, `COPYING` или `NOTICE`. Поэтому нельзя безопасно копировать Python-код в распространяемый P78. Разрешённая стратегия проекта:

```text
изучить идею
  -> сформулировать независимый контракт
  -> заново реализовать малый vanilla JS module
  -> написать собственные тесты
  -> сохранить ссылку на происхождение идеи в документации
```

### 4.2. Runtime compatibility

P78 является локальным browser application на versioned classic JavaScript. Встраивание Python/MCP runtime добавило бы серверную зависимость, IPC, отдельную модель прав, latency и новый failure surface. Это противоречит автономности текущего P78.

### 4.3. Безопасность

`doc_consensus.py` может выполнять команду из environment через `shell=True`. Такой путь запрещён и для P78, и для соседних интерфейсов. Настройка `.agents/permissions.json` с широкими шаблонами является организационным соглашением, а не sandbox guarantee.

### 4.4. Семантическая власть

Количество агентов, ролей или одинаковых ответов не подтверждает факт. Пять prompt-ролей одной модели принадлежат одному `lineageClass`, если не доказано обратное. Автор результата не может сам принять его как evidence.

---

## 5. Строгое соответствие объектов

| Внешний проект | P78 | Строгое значение |
|---|---|---|
| agent | Parser, Retriever, Aligner, Countersearch, MergePlanner | ограниченный исполнитель операции, не слово и не частица |
| task | SemanticWorkItem | замороженная операция над Claim AST или source passage |
| message | PassageClaim или EvidenceCandidate | типизированный результат с хешем и provenance |
| claim lease | operation lease | право вычислить одну операцию в одном epoch |
| fencing token | `epoch + revision + inputHash` | запрет устаревшему worker публиковать результат |
| queue | очередь переходов | ожидающие семантические операции, не очередь истин |
| worktree/zone | branch lane | изоляция альтернативного разбора или transformation proposal |
| blind variant | alternative Claim AST | кандидат, не видевший siblings до barrier |
| observer | evidence gate | валидатор контракта без права объявить истину |
| integrator | merge planner | создаёт предложение merge, но не commit |
| red team | countersearch | ищет `REFUTES`, `QUALIFIES` и пропущенные ограничения |
| OR-set | candidate graph | объединяет кандидаты без потери provenance |
| quorum | stability signal | диагностический признак, не доказательство |

Главная ошибка буквальной аналогии - считать «один агент = одно слово». Слово является данными, а агент является ограниченным преобразованием. Иначе невозможно определить ответственность, budget, provenance и воспроизводимость.

---

## 6. SemanticWorkItem

Минимальный самостоятельный контракт:

```text
SemanticWorkItem {
  schema: "meridian.semantic-work-item/1",
  workId,
  runId,
  inputHash,
  policyHash,
  sourceSetHash,
  operatorId,
  lane,
  dependsOn[],
  state,
  epoch,
  fencingToken,
  budget: {
    maxOperations,
    maxCandidates,
    maxMilliseconds
  },
  inputRefs[],
  outputHash,
  reasonCodes[],
  contentHash
}
```

Допустимые operators первого прототипа:

```text
PARSE
RETRIEVE
ALIGN
GENERALIZE_PROPOSAL
DETAIL_PROPOSAL
CONTINUE_PROPOSAL
COUNTERSEARCH
QUALIFY
SPLIT_PROPOSAL
MERGE_PROPOSAL
REVIEW
```

Слова `PROPOSAL` принципиальны: worker не получает commit authority.

---

## 7. SemanticCell и FlowFrame

```text
SemanticCell {
  cellId,
  runId,
  workId,
  role,
  authorRef,
  lineageClass,
  inputHash,
  policyHash,
  sourceSetHash,
  claimRef,
  state,
  evidenceCandidateIds[],
  conflictsWith[],
  operationCount,
  contentHash
}
```

```text
FlowFrame {
  frameId,
  runId,
  revision,
  lanes[],
  cells[],
  changedCellIds[],
  queueLength,
  throughput,
  stallDuration,
  rollbackCount,
  authority: {
    semanticTruth: false,
    finalRelation: NOT_COMPUTED,
    reviewRequired: true
  },
  contentHash
}
```

`FlowFrame` является пассивной проекцией состояния. Визуальный слой не изменяет queue, Claim или evidence.

---

## 8. Конечные автоматы

### 8.1. Run

```text
NEW
  -> FROZEN
  -> FANOUT
  -> COLLECTED
  -> NORMALIZED
  -> DISAGREEMENT_MAPPED
  -> EVIDENCE_GATED
  -> REDUCED
```

Терминальные или парковочные состояния:

```text
INVALID
STALE
BUDGET_EXCEEDED
CYCLE
CONTESTED
PARTIAL
STAGNANT
ABSTAIN
```

### 8.2. Claim

```text
PROPOSED
  -> PARSED
  -> RESOLVED
  -> LOCATED
  -> ALIGNED
  -> EVIDENCE_CANDIDATE
  -> REVIEWED
  -> ACCEPTED | REJECTED | CONTESTED
```

Текущий AG4 честно заканчивается на `EVIDENCE_CANDIDATE`. Стадии правее являются будущей AG6 и не должны имитироваться UI.

---

## 9. Детерминированный orchestration protocol

```text
freeze exact input, policy, admitted sources and budgets
runId = H(inputHash, policyHash, sourceSetHash, budgetHash)

derive canonically sorted jobs
seal each job before fan-out
execute jobs without access to sibling outputs

for every result:
    verify runId, workId, epoch and fencingToken
    verify input/policy/source hashes
    validate closed schema and authority boundary
    discard stale or escalating output

normalize valid outputs into Claim AST or typed diagnostics
deduplicate only by exact contentHash
never increase confidence for repeated same-lineage output

build pairwise disagreement map
if pair budget exhausted:
    ABSTAIN(BUDGET_EXCEEDED)

for every resolved Claim:
    run AG4 source-backed cascade
    partition SUPPORTS / REFUTES / QUALIFIES / MENTIONS
    SUPPORTS + REFUTES -> CONTESTED
    QUALIFIES -> branch by scope
    no reviewed evidence -> OPEN + ABSTAIN

stable-sort nodes by contentHash
emit MERGED_DRAFT only for structurally compatible reviewed nodes
retain provenance of every original node
```

Порядок завершения workers не должен менять `FlowFrame.contentHash`.

---

## 10. Формальная модель 2D-потока

Состояние:

```text
X_t = (S, C_t, E_t, Q_t, theta_t, rho_t, A_t, H_t)
```

где:

- `S` - замороженные источники;
- `C_t` - множество Claim AST;
- `E_t` - граф evidence candidates и conflicts;
- `Q_t` - очереди operations;
- `theta_t` - фаза движения по кольцу;
- `rho_t` - диагностический уровень детализации;
- `A_t` - активации lanes;
- `H_t` - журнал переходов.

Однородное движение:

```text
theta_i(t+1) = (theta_i(t) + omega * dt) mod 2pi
rho_i(t+1)   = rho_i(t)
```

Очередь у препятствия:

```text
q_e(t+1) = max(0, q_e(t) + arrivals_e - capacity_e * gate_e)
pressure_e = q_e / max(1, capacity_e)
```

Интерпретация:

- препятствие - невыполненное prerequisite;
- порог - structural gate;
- плотина - занятой review channel;
- разветвление - несовпадающий qualifier или альтернативный parse;
- слияние - proposal для совместимых проверенных узлов;
- сохраняемая величина - provenance, а не «масса истины».

Диагностические меры:

```text
fragmentation = connectedComponents / max(1, claims)
collapse      = 1 - uniqueClaimHashes / max(1, proposals)
throughput    = completedValidTransitions / interval
stall         = queueLength > 0 and throughput == 0 for K ticks
```

Они управляют fan-out, backpressure и интерфейсом. Они не измеряют истинность текста.

---

## 11. Распределение по измерениям

### 11.1. P78: самостоятельное 2D

Перенести или заново реализовать:

- SemanticWorkItem и SemanticCell;
- lanes `PARSE / RETRIEVE / ALIGN / COUNTER / REVIEW`;
- очередь, capacity и backpressure;
- epoch/revision fencing;
- видимые `CONTESTED`, `PARKED`, `ABSTAIN`;
- bounded rollback к последнему валидному checkpoint;
- three-way merge как proposal;
- flow metrics, связанные с реальными operations.

Это основной адрес для многоагентной идеи, потому что 2D описывает продолжение процесса и встречу разных условий.

### 11.2. P79: 1D, двоичный код и Морзе

Уместны механизмы, где важен точный порядок, а не семантическая агрегация:

- append-only event log;
- binary serialization;
- International Morse timeline;
- sequence diff/merge;
- exact replay;
- контроль пропусков, дублей и повреждения;
- однозначная передача WorkItem/receipt hashes.

P79 может кодировать и восстанавливать сообщения P78, но не выбирать `SUPPORTS` или `REFUTES`. Плохой semantic quorum не становится корректным только потому, что представлен битами.

### 11.3. P80: 3D/Q6

Уместны механизмы типизированного пространства состояний:

- frozen aggregate snapshots;
- Q6-cell для шести явно объявленных predicates;
- one-bit counterfactual path;
- карта совместимости branches;
- группировка lineage и provenance;
- визуальная диагностика того, какие constraints совместимы;
- отображение quorum как свойства состава группы.

P80 не должен обобщать произвольный текст одним геометрическим движением. Q6 описывает только заранее типизированные predicates; UNKNOWN остаётся `PARTIAL` или `ABSTAIN`.

---

## 12. Матрица «перенести / переписать / эксперимент / отклонить»

| Решение | Механизм | Назначение |
|---|---|---|
| ПЕРЕНЕСТИ КАК ПРИНЦИП | proposal-only authority | любой worker создаёт предложение, не факт |
| ПЕРЕНЕСТИ КАК ПРИНЦИП | lease/fencing/idempotency | защита от повторов и stale results |
| ПЕРЕНЕСТИ КАК ПРИНЦИП | provenance and visible conflict | ни split, ни merge не теряют происхождение |
| ПЕРЕПИСАТЬ В JS | typed cells and frame diff | компактная визуальная проекция P78 |
| ПЕРЕПИСАТЬ В JS | three-way AST/text merge | только proposal с явным conflict |
| ПЕРЕПИСАТЬ В JS | work admission/backpressure | ограничение DOM и semantic workloads |
| ЭКСПЕРИМЕНТ 2D | TextRank, PMI, tag islands | навигация и архипелаг тегов |
| ЭКСПЕРИМЕНТ 2D | Jaccard/SimHash | broad candidate generation, никогда не evidence |
| ЭКСПЕРИМЕНТ 2D | близкая пара + далёкий катализатор | генерация исследовательского вопроса |
| ЭКСПЕРИМЕНТ 2D/3D | reduction 3:1 | начальный fan-in, проверяемый benchmark |
| ЭКСПЕРИМЕНТ 3D | quorum composition | диагностика разнообразия lineage |
| ОТКЛОНИТЬ | majority establishes truth | число голосов не заменяет источник |
| ОТКЛОНИТЬ | same-model roles are independent | общая lineage сохраняется |
| ОТКЛОНИТЬ | severity levels are witnesses | severity не является автором |
| ОТКЛОНИТЬ | lexical cluster is consensus | сходство слов не равно совпадению Claim AST |
| ОТКЛОНИТЬ | genetic router quality | случайная мутация и число папок не являются качеством |
| ОТКЛОНИТЬ | `shell=True` execution | недопустимый security boundary |
| ОТКЛОНИТЬ | Python/MCP inside browser P78 | нарушает автономность и увеличивает failure surface |

---

## 13. Инварианты

1. Вход, policy, sources и budgets замораживаются до fan-out.
2. Один semantic operation имеет не более одного действующего lease.
3. Stale fencing token не может опубликовать output.
4. Повтор одинакового результата не повышает уверенность.
5. Разные роли одной модели остаются одним `lineageClass`.
6. Автор proposal не принимает собственный proposal.
7. Количество agents не заменяет evidence.
8. Split и merge сохраняют provenance исходных узлов.
9. `SUPPORTS + REFUTES` остаётся `CONTESTED`.
10. `QUALIFIES` создаёт scope branch, а не forced merge.
11. Budget exhaustion, stale source и cycle завершаются `ABSTAIN`.
12. Порядок завершения agents не меняет canonical output hash.
13. Ни worker, ни renderer не могут выставить `ACCEPTED`.
14. P79/P80 отвечают только по объявленным протоколам и не изменяют P78 text.

---

## 14. План реализации

### Этап MF0. Контракты

Создать disconnected modules:

```text
prototype/lib/p78-semantic-work-contracts.js
prototype/lib/p78-semantic-flow-reducer.js
prototype/lib/p78-semantic-flow-view.js
prototype/p78-semantic-flow-view.css
```

Никакой загрузки в HTML до прохождения contract tests.

### Этап MF1. Projection-only прототип

Проецировать существующий AG4 trace в lanes:

```text
INPUT -> PARSED -> DISCOVERED -> ALIGNED -> REVIEW_QUEUE
```

Не запускать дополнительных агентов из browser. Один текущий trace уже достаточен для проверки геометрического соответствия движения реальным стадиям.

### Этап MF2. Backpressure

Добавить `capacity`, `queueLength`, `throughput`, `stallDuration`, `operationCount`. UI обновлять одним bounded batch. При перегрузке сохранять данные, но показывать не более 30 cells одновременно.

### Этап MF3. Alternative lanes

Разрешить несколько независимых Claim AST или transformation proposals с sealed input. Вычислять disagreement map по полям AST, а не по строковому сходству.

### Этап MF4. Countersearch bridge

Подключать AG5 только после его hardening. Каждый attempt обязан ссылаться на target Claim, source set, query projection и полученные AG4 passage/evidence objects.

### Этап MF5. Human review

Отдельная будущая AG6 может принимать или отклонять candidates. Это новая command authority с audit receipt, а не расширение пассивного view.

### Этап MF6. P79/P80 exchange

- P79 получает только serializable event/receipt snapshots;
- P80 получает только typed predicate snapshots;
- ответы проверяются по origin, revision и epoch;
- direct 1D -> 3D semantic bypass остаётся запрещённым.

---

## 15. Тестовая программа

Обязательные regressions:

1. перестановка порядка результатов;
2. дубликат одного worker;
3. одна модель с пятью prompt-ролями;
4. stale epoch и stale source;
5. expired lease и takeover;
6. неверный fencing token;
7. `SUPPORTS + REFUTES`;
8. различие qualifier при совпадающем core;
9. pair budget exhaustion;
10. повтор state hash и cycle;
11. split с полной provenance;
12. merge conflict без LWW;
13. очередь выше capacity;
14. порядок completion не меняет frame hash;
15. renderer не имеет commit path;
16. P79 binary/Morse roundtrip;
17. P80 UNKNOWN не превращается в vertex;
18. browser frame cadence не ухудшается.

Метрики качества:

```text
semantic relation precision / recall
ABSTAIN rate by reason
stale result rejection rate
duplicate suppression rate
queue latency
throughput
stall recovery time
rollback count
frame time p95
deterministic replay rate
provenance completeness
```

---

## 16. Граница научности

Инженерно проверяемые механизмы:

- очередь;
- backpressure;
- DAG dependencies;
- lease и fencing;
- immutable snapshots;
- provenance;
- alternative branches;
- countersearch;
- rollback/replay;
- content-addressed determinism.

Гипотезы, требующие эксперимента:

- оптимальный fan-in `3:1`;
- пороги branch/merge;
- формулы fragmentation/collapse как полезные feedback signals;
- связь визуальной фазы кольца с cognitive workload;
- эффективность tag archipelago;
- выбор следующей semantic obligation.

Метафоры, не являющиеся доказательством:

- агент равен слову;
- давление жидкости равно противоречию;
- вращение создаёт смысл;
- центр геометрически доказывает обобщение;
- масса смысла сохраняется;
- большинство агентов устанавливает истину.

Эти метафоры допустимы как язык визуализации и источник исследовательских вопросов. Они запрещены как основание semantic commit.

---

## 17. Критерий допуска к P78

Новый многоагентный слой можно загрузить в основной HTML только когда:

- каждый объект имеет closed schema и content hash;
- входы и outputs отделены;
- AG4 authority boundary сохранена;
- все очереди и budgets ограничены;
- deterministic replay подтверждён;
- stale/fencing tests зелёные;
- no-network и no-dynamic-code checks зелёные;
- UI остаётся пассивным;
- frame scheduling не блокируется;
- исходный AG3/AG4 работает без нового модуля;
- лицензия не требует копирования внешнего кода;
- полный regression runner зелёный.

До этого состояние проекта: **полезный reviewed design, но не подключённая production-функция**.
