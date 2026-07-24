# 44 - P1-P80: ретроспектива и кластерный речной конвейер P78

**Статус:** P1_P80_RETROSPECTIVE_AND_CLUSTER_CONVEYOR_SPEC
**Дата:** 2026-07-21
**Область:** самостоятельная 2D-система P78
**Решение:** контейнеры-кластеры с накладной вместо одинаковых капель
**Граница:** геометрия и гидродинамика управляют работой и интерфейсом, но не определяют истинность текста
**Поправка аудита (2026-07-21):** ретроспектива не подняла уже существующее соответствие девяти уровней `info1` и радиальных орбит до статуса готовой архитектурной заготовки. Причины пропуска, конфликт полезных краёв `α` с патологическими пространственными полюсами и исправленная модель зафиксированы в [спецификации девяти семантических орбит](45-p78-nine-semantic-orbits-and-alpha-automaton.md).


Связанные документы:

- [философия исходной системы](01-philosophy.md);
- [дорожная карта раннего 2D-MVP](07-roadmap.md);
- [модель частиц и семантического конвейера](09-particle-model-and-semantic-conveyor.md);
- [текущий аудит](20-current-stage-audit.md);
- [параллели с числами Рамсея](24-p78-ramsey-parallels.md);
- [автономная 2D-ветка](27-p78-autonomous-2d-development.md);
- [source-backed synthesis/fission/fusion](30-scientific-synthesis-fission-fusion-spec.md);
- [реализация Claim AST](35-p78-controlled-russian-claim-ast-implementation.md);
- [реализация AG4](36-p78-source-backed-claim-cascade-implementation.md);
- [многоагентный поток](38-p78-multi-agent-semantic-flow-crosswalk.md);
- [проекция потока](40-p78-semantic-flow-projection-implementation.md);
- [внешний holdout](41-p78-ag4-external-holdout-baseline.md);
- [осмысленное продолжение и ресайклинг](42-p78-meaningful-continuation-and-information-recycling-spec.md);
- [девять семантических орбит и α-автомат](45-p78-nine-semantic-orbits-and-alpha-automaton.md).
- [критический аудит data2](43-p78-kryukov-motion-repository-adaptation.md).

---

## 1. Короткое решение

Проект не надо начинать заново и не надо продолжать наращивать число декоративных прототипов.

Нужно изменить главный объект системы:

~~~text
было:  одинаковая частица / капля / слово
стало: SemanticCluster + ProvenanceManifest + FlowReceipt
~~~

Река является моделью логистики работы:

- где находится кластер;
- через какой шлюз он прошёл;
- почему задержан;
- что в нём разделено или объединено;
- какие источники и условия сохранены;
- какой следующий проверяемый ход получен.

Река не является моделью истины. Скорость, цвет, радиус, давление, вихрь и положение на Canvas не могут сами разрешить смысловой commit.

Рекомендуемая последовательность архитектуры:

1. оболочка Human-in-the-Loop Cluster Conveyor;
2. внутри неё детерминированный Natural Definition Compiler;
3. затем source-backed graph/retrieval;
4. Canvas становится пассивной проекцией реальных кластеров, очередей и receipts.

---

## 2. Нормализованные вопросы пользователя

Голосовой ввод содержал ошибки распознавания. Содержательно запрос раскладывается на следующие вопросы.

1. Была ли исходная задача ясной?
2. Что фактически делали прототипы P1-P80?
3. На каком этапе физическая визуализация стала семантическим проектом?
4. Почему десятки файлов не дали свободного осмысленного продолжения?
5. Что разные архитекторы сделали бы иначе, получив задачу заново?
6. Можно ли определить самостоятельную 2D-середину без обязательных 1D/3D соседей?
7. Что действительно даёт теория Рамсея?
8. Можно ли исключить и полную клику, и полное независимое множество?
9. Почему рамсеевская крайность не создаёт третье состояние автоматически?
10. Какая формула измеряет направленную асимметрию?
11. Почему одинаковые капли недостаточны?
12. Может ли H2O служить алгоритмом семантики?
13. Как заменить каплю более крупным кластером или плотом?
14. Как устроить речную почту и сплав кластеров по каналу?
15. Какие формулы гидродинамики допустимо перенести?
16. Что означает поток, ёмкость, давление, вязкость и диффузия?
17. Как не превратить метафору жидкости в псевдонаучную теорию смысла?
18. Как учитывать голосовые ошибки, отрицание, числа, даты, имена и ссылки?
19. Как получить текстовый результат, а не только графическую анимацию?
20. Какой минимальный вертикальный срез надо реализовать следующим?

---

## 3. Что было исходной задачей

### 3.1. Первоначальная задача

Исходная MERIDIAN-задача была замкнутой 2D-симуляцией:

- параметр lambda находится между двумя полюсами;
- центр означает чрезмерное уплотнение;
- край означает распад;
- жизнь определяется непрерывным движением между полюсами;
- система должна показывать столкновения, очереди и локальные изменения.

Это зафиксировано в [исходной философии](01-philosophy.md) и [ранней дорожной карте](07-roadmap.md).

На этом этапе требования продолжать произвольную статью или строить source-backed Claim ещё не было. Поэтому P1-P21 нельзя считать неудачной реализацией языкового генератора: они решали другую задачу.

### 3.2. Поздняя задача

Позднее появилась более трудная цель:

> сохранять различимость частей и связность целого, принимать новую информацию и выдавать следующий осмысленный ход без коллапса и распада.

После этого центр продукта следовало формально переопределить. Вместо этого новая цель добавлялась новыми прототипами рядом со старой геометрией.

### 3.3. Итоговый диагноз

Исходная задача была достаточно ясной для физического 2D-MVP.

Семантическая задача тоже стала достаточно ясной позднее, но порядок реализации оказался обратным:

~~~text
визуальные метафоры
-> игровые механики
-> ручные словари
-> шаблонные генераторы
-> формулы
-> строгие типы
-> provenance
-> внешний корпус
~~~

Для смысловой системы требовался порядок:

~~~text
корпус и критерии
-> типы Claim/Source/Evidence
-> операции и инварианты
-> replay/rollback
-> полезный текстовый workflow
-> визуальная проекция
~~~

---

## 4. Археологическая граница

В каталоге найдено:

- 80 HTML-прототипов P1-P80;
- 66 библиотечных модулей;
- 53 запускаемых regression suites.

Текущая Git-структура не даёт надёжной истории коммитов для prototype и docs. Поэтому хронология ниже восстановлена по нумерации, содержимому файлов и перекрёстным ссылкам. Это реконструкция, а не доказанная дата каждого проектного решения.

---

## 5. Хронология P1-P80

### 5.1. P1-P21: геометрия, физика и игровые жанры

Факты:

- [P1](../prototype/p1-geometry-visualizer.html) хранит у частицы орбиту и угол;
- [P2](../prototype/p2-sandbox-lambda.html) добавляет массу и случайные split/merge;
- следующие прототипы проверяют игры, ритм, маршрутизацию и псевдо-3D.

Оценка:

- движение реализовано;
- реакции существуют;
- семантического Claim, источника и проверяемого текста ещё нет по конструкции.

### 5.2. P22-P29: семантические признаки и дискретный конвейер

Факты:

- [P22](../prototype/p22-semantic-station.html) добавляет class, mass, polarity, tag и affinity;
- [P24](../prototype/p24-conveyor-editor.html) реализует редактируемый граф source/reactor/filter/sink;
- конвейер обрабатывает числовой класс частицы, а не утверждение с источником.

Оценка:

- это первый настоящий вычислимый конвейер;
- он ещё не является информационно-смысловым;
- старый routing нельзя переносить напрямую: индекс ребра, выбор первого ответвления и отсутствие TTL делают его непригодным для нового ядра.

### 5.3. P30-P47: слова, формулы и приборы

Факты:

- [P30](../prototype/p30-word-transport.html) использует встроенный словарь и четыре шаблона;
- генератор и оценщик используют близкие ручные данные;
- [документ 12](12-humanitarian-formula-of-meaning.md) уже признаёт, что формула не обнаруживает грамматически правильный бессмысленный текст.

Оценка:

- получен управляемый генератор демонстрационных фраз;
- он не проверяет перенос на внешний язык;
- совпадение с собственным словарём ошибочно выглядит как понимание.

### 5.4. P48-P68: рои, эволюция и цикл знаний

Факты:

- [P56](../prototype/p56-knowledge-cycle.html) находит новые пары тем;
- шаблонно создаёт гипотезы;
- возвращает их в собственный рассказ.

Оценка:

- цикл обработки есть;
- независимого evidence нет;
- система частично подтверждает данные, которые сама создала.

### 5.5. P69-P77: строгие гейты и возврат к геометрии

Факты:

- P69-P71 вводят градуированные признаки и сохранение информации;
- [P73](../prototype/p73-reasonable-vortex.html) усиливает математическую орбиту и backtracking;
- P77 сознательно упрощает P73.

Оценка:

- математическая честность выросла;
- семантическое продолжение снова стало вторичным;
- возникло много хороших механизмов без одного главного пользовательского workflow.

### 5.6. P78-P80: конвергенция и разделение измерений

Факты:

- [P78](../prototype/p78-living-ring-interface.html) стал модульной лабораторией;
- [P79](../prototype/p79-pulse-tape-1d.html) и [P80](../prototype/p80-hypercube-center-3d.html) работают как отдельные read-only соседи;
- они не меняют основной текст.

Оценка:

- отделение 1D/3D от автономного 2D является правильным;
- строгая семантика пока пристроена рядом с главным вводом, а не управляет им.

---

## 6. Что действительно достигнуто

| Слой | Достижение | Граница |
|---|---|---|
| 2D runtime | частицы, локальные реакции, bounded ring, архипелаг | геометрия не определяет истинность |
| Formula | versioned AST, типы, hashes, DAG, ABSTAIN | следующая формула не является следующим текстом |
| Claim | fail-closed Controlled Russian Claim AST | не покрывает свободный русский |
| Evidence | source locator, provenance, review-only candidates | внешний перенос не прошёл |
| Action | stale protection, idempotent commit, ledger, exact undo | source-backed генерации ещё нет |
| Flow | пять типизированных стадий и пассивная проекция | нет реальной исполняемой очереди |
| Test | 53/53 suites и 629/629 checks | структурные тесты не заменяют semantic holdout |

Внешний holdout честно получил:

~~~text
candidateGoldPassageRecall = 0
relationMacroF1 = 0
gateStatus = BLOCKED_FOR_AG5
~~~

Это не разрушает весь проект. Оно точно показывает следующий блокер: morphology, Natural Definition Bridge и candidate retrieval.

---

## 7. Корневые причины расхождения

1. Единицей прогресса стал новый прототип, а не законченный вертикальный workflow.
2. Lambda, радиус, жизненность, сложность, смысл и положение долго смешивались.
3. Генератор и оценщик использовали один ручной словарь.
4. Визуальный слой создавался раньше доказательного субстрата.
5. Строгие AG0-AG4 появились рядом со старой эвристикой, а не заменили её.
6. Главное textarea и отдельный Controlled Claim остаются разными входами.
7. Текущий FlowFrame является POST_HOC_AG4_PROJECTION.
8. queueLength обозначает число evidence candidates, а не длину реальной очереди.
9. Готовая демонстрация периодически принималась за готовый продукт.
10. Смена требований не оформлялась как новая центральная спецификация.

---

## 8. Почему капля и H2O недостаточны

Формула воды описывает однородный химический состав. Смысловые грузы неоднородны:

- один содержит тезис;
- другой источник;
- третий конфликт;
- четвёртый вопрос;
- пятый черновой абзац;
- у каждого различаются права, стоимость проверки и риск.

Инвариант:

~~~text
H2O_IS_NOT_A_SEMANTIC_UNIT
~~~

H2O можно оставить как визуальный образ непрерывной среды. Использовать молекулу воды как схему Claim нельзя.

Более точный образ:

> канал несёт плоты, контейнеры или почтовые мешки; каждый груз имеет накладную.

---

## 9. Новый основной объект

~~~ts
type SemanticCluster = {
  schema: "meridian.semantic-cluster/1";
  clusterId: string;
  kind:
    | "SOURCE"
    | "CLAIM"
    | "EVIDENCE"
    | "CONFLICT"
    | "QUESTION"
    | "DRAFT";
  itemRefs: string[];
  claimRefs: string[];
  passageRefs: string[];
  sourceVersionRefs: string[];
  relationRefs: string[];
  qualifierRefs: string[];
  openQuestionRefs: string[];
  discourseRole: string;
  lane: string;
  state: string;
  hopBudget: number;
  size: {
    bytes: number;
    claimCount: number;
    reviewCost: number;
  };
  manifestHash: string;
  contentHash: string;
};
~~~

Кластер не обязан быть одним предложением. Это минимальная единица осмысленной логистики, для которой можно:

- перечислить состав;
- проверить источник;
- измерить сохранение qualifiers;
- построить split/merge;
- откатить преобразование;
- показать текстовый результат.

---

## 10. Накладная и квитанция движения

~~~ts
type ProvenanceManifest = {
  manifestId: string;
  sourceVersions: string[];
  passages: string[];
  claims: string[];
  transforms: string[];
  unresolvedLeaves: string[];
  rightsRefs: string[];
  contentHash: string;
};

type FlowReceipt = {
  schema: "meridian.flow-receipt/1";
  runId: string;
  clusterId: string;
  logicalSeq: number;
  from: string;
  to: string;
  operation: string;
  inputHash: string;
  outputHash: string;
  manifestBefore: string;
  manifestAfter: string;
  epoch: number;
  fencingToken: string;
  reasonCodes: string[];
  semanticTruth: false;
};
~~~

Движение на Canvas разрешено только после появления FlowReceipt.

Если имеется только post-hoc Frame, объект отображается статично или пунктиром. Это предотвращает ложное впечатление реально выполненной работы.

---

## 11. Три независимых графа

### 11.1. G_sem

Типизированный граф смысла:

~~~text
Claim
Evidence
SourceVersion
Passage
SUPPORTS
REFUTES
QUALIFIES
MENTIONS
UNKNOWN
~~~

### 11.2. G_work

DAG или гиперграф работы:

~~~text
WorkItem
dependsOn
SPLIT
MERGE
VERIFY
COUNTERSEARCH
REVIEW
EXPORT
~~~

### 11.3. G_view

Пассивная визуальная проекция.

Запрет:

~~~text
metric(G_view) must not authorize semantic commit
~~~

Runtime добавляет служебные sequence/bridge связи. Поэтому клики, conductance или modularity, посчитанные по Canvas-графу, не являются метриками исходного текста.

---

## 12. Строгая граница теории Рамсея

Для простого конечного графа:

~~~text
R(s,k) = min n:
         every graph on n vertices contains K_s
         or an independent set of size k
~~~

Актуальная работа Брадача формулирует off-diagonal Ramsey number именно через клику и независимое множество и улучшает асимптотическую нижнюю границу для фиксированного s и растущего k: [Bradač, Off-diagonal Ramsey numbers, v3](https://arxiv.org/abs/2605.28793).

Из теории не следует:

- существование устойчивой третьей середины;
- направленное движение;
- качество текста;
- корректное обобщение;
- семантическая истинность;
- возможность навсегда исключить все локальные крайности в растущем статическом графе.

Конструкция D* полезна как структурное вдохновение: дуга задаётся асимметричными перекрёстными связями. Но это специальная конструкция над графами конечной геометрии, а не общая теорема о языке.

Рамсеевские клики и certified independent sets допустимы только как диагностические предупреждения:

- риск чрезмерного сцепления;
- риск изоляции;
- необходимость уменьшить активное окно;
- необходимость разделить масштабы.

---

## 13. Исправление четырёхкомпонентной формулы

Текущий оператор корректно раскладывает единицу:

~~~text
C = x y
F = (1-x)(1-y)
forward = x(1-y)
reverse = (1-x)y
M = forward + reverse
~~~

Где:

- C — взаимное замыкание;
- F — взаимное отсутствие связи;
- M — общий объём несовпадения.

Направленная асимметрия:

~~~text
direction = x - y
asymmetry = abs(x - y)
~~~

Контрпример:

~~~text
x = 0.5
y = 0.5
M = 0.5
direction = 0
~~~

Следовательно, большой 2D-компонент не означает направленное движение.

Если gross imbalance велик, а net imbalance близок к нулю, существуют встречные потоки. Их надо показывать двумя ветвями, а не усреднять.

Модуль уже реализует forward, reverse, direction и asymmetry в [semantic-asymmetric-balance.js](../prototype/lib/semantic-asymmetric-balance.js), но сам модуль не загружен основным P78 HTML.

---

## 14. Операциональная 2D-середина

Середина не равна обязательному числу 0.5.

Введём:

~~~text
D = сохранение различий, qualifiers и отдельных фактов
C = доля подтверждённых связей между сохранёнными частями
~~~

Тогда:

~~~text
collapse:     D low, C artificially high
fragment:     D high, C low
live middle:  D >= Dmin and C >= Cmin
~~~

Полный критерий является областью допустимости:

~~~text
Middle_t =
  HardGates
  and ObservedCoverage >= gamma0
  and Mobility >= m0
  and GrossImbalance >= a0
  and CollapseRisk <= c0
  and FragmentRisk <= f0
  and QueueStable
  and ProvenanceComplete
  and TransformationLoss = 0
~~~

Порог имеет смысл только вместе с:

- названием метрики;
- версией;
- корпусом;
- baseline;
- calibration protocol;
- областью применения.

---

## 15. Аудит гидродинамических соответствий

### 15.1. Уравнение непрерывности

Допустимый перенос: учёт грузов.

~~~text
Admitted =
  queued
  + running
  + parked
  + quarantined
  + shipped
  + discardedWithTombstone
~~~

Для split/merge число Claim не сохраняется. Сохраняется provenance:

~~~text
Leaves(output) subsetOf Leaves(input) union NewEvidence
~~~

Риск: объявить claims физической массой.

Тест: ни один clusterId не исчезает, union происхождения восстанавливается.

### 15.2. Поток

~~~text
J[e,k] = completedReceipts[e,k] / deltaTime
~~~

Отдельно считаются:

- clusters/s;
- bytes/s;
- claims/s;
- reviewed claims/s.

Высокий поток не означает качество.

Тест: повторная квитанция не увеличивает J; при отсутствии receipts J равен нулю.

### 15.3. Ёмкость

~~~text
U = max(
  itemCount / itemCapacity,
  byteCount / byteCapacity,
  operationCost / operationBudget
)
~~~

Один большой кластер может быть дороже десяти малых.

Тест: oversized груз переходит в PARK, а не теряется.

### 15.4. Давление и backpressure

~~~text
P = max(
  queueLength / capacity,
  oldestAge / SLO,
  queuedBytes / byteBudget
)
~~~

При P >= 1 прекращается fan-out и upstream admission. Возобновление происходит ниже low watermark.

Давление измеряет перегрузку работы, а не конфликт, ложь или сложность смысла.

Backpressure применим к реальным очередям. Классическая работа Tassiulas и Ephremides связывает scheduling с областью стабильности очередей, а не с истинностью пакетов: [первичный технический отчёт](https://drum.lib.umd.edu/items/571fda52-aefb-4497-9a2d-69d8c7c907b9).

### 15.5. Вязкость

Вместо физической вязкости используется merge resistance:

~~~text
eta =
  wq * QualifierLoss
  + wt * TimeMismatch
  + ws * ScopeMismatch
  + wc * ConflictRisk
  + infinity * ProvenanceLoss
~~~

При большой eta система предлагает COMPARE или PARK, а не MERGE.

Тест: отрицание, время и scope не растворяются; порядок A/B не меняет eta.

### 15.6. Диффузия

Допустимый перенос: bounded retrieval exploration.

~~~text
p[t+1] = (1-D) p0 + D transpose(P) p[t]
result = deterministicTopK(p, beam, depth, sourceFamilyCap)
~~~

Популярность узла не является истинностью.

Тесты:

- deterministic replay;
- depth cap;
- beam cap;
- source-family cap;
- stale source rejection.

### 15.7. Вихрь

Вихрь означает бесплодный цикл:

~~~text
cycle =
  stateHash(t) == stateHash(t-j)
  and deltaProvenanceLeaves == 0
~~~

Повтор с новым источником не считается бесплодным.

Реакция:

~~~text
CHECKPOINT
-> ROLLBACK
-> NEXT_BRANCH
-> ABSTAIN when budget exhausted
~~~

### 15.8. Шлюз, плотина и замок

~~~text
lock  = lease + fencing token
dam   = metered release
gate  = typed predicate
~~~

~~~text
admit = schemaValid and rightsAllowed and Q < C
commit = currentFence and freshInputs and authorityAllowed
release = min(queueLength, waveCapacity)
~~~

Lock не создаёт semantic authority.

### 15.9. Осадок и карантин

QUARANTINE используется только для:

- повреждённого hash;
- неизвестных прав;
- рискованного ASR;
- недоверенного markup;
- нарушенного контракта.

Нельзя называть осадком неудобное мнение, тему или автора.

Raw input сохраняется; исправление создаёт новую версию.

### 15.10. Притоки

~~~text
VOICE
FILE
URL
NEWS
NOTE
-> normalized intake
~~~

Join разрешён только при наличии required refs.

Число перепечаток не равно числу независимых источников.

### 15.11. Маршрутизация пакетов

Допустимые маршруты:

~~~text
KEEP
LINK
SPLIT
MERGE
VERIFY
CONTRADICT
PARK
QUARANTINE
~~~

Оптимизация:

~~~text
minimize latency + reviewCost + pressurePenalty
subject to hard semantic and provenance gates
~~~

Самый короткий маршрут не обязательно корректен.

### 15.12. Закон Литтла

При стационарности и конечных средних:

~~~text
L = lambda W
~~~

где L — среднее число объектов в системе, lambda — средняя интенсивность поступления, W — среднее время в системе. Условия исходного результата важны: [Little, 1961](https://pubsonline.informs.org/doi/10.1287/opre.9.3.383).

Эта формула помогает оценить очередь review. Она не измеряет смысл.

### 15.13. Что не переносить

Не нужны:

- численное решение Navier-Stokes;
- физические молекулярные плагины;
- давление как степень истинности;
- скорость как качество;
- масса как важность;
- турбулентность как творческая ценность;
- цвет как epistemic status без легенды;
- непрерывная анимация без receipt.

---

## 16. Направленная полезность нового пакета

~~~text
gain(x | S) =
    verifiedNewAtoms
  + closedOpenGaps
  + preservedUsefulDifferences
  + newIndependentEvidence
  - lostQualifiers
  - unsupportedAtoms
  - hiddenConflicts
  - reviewCost
~~~

Это priority score после hard gates, не вероятность истины.

Старое состояние S не перезаписывается. Новый пакет создаёт revision и направленные связи:

- SUPPORTS;
- REFINES;
- CONTRADICTS;
- EXEMPLIFIES;
- QUALIFIES;
- OPENS_QUESTION.

---

## 17. Голосовой ввод

~~~ts
type TranscriptLattice = {
  rawAudioRef: string | null;
  rawText: string;
  segments: Array<{
    span: [number, number];
    selected: string;
    alternatives: string[];
    confidence: number | null;
    riskFlags: Array<
      "NEGATION" | "NUMBER" | "DATE" | "NAME" | "CITATION"
    >;
  }>;
  revision: number;
  contentHash: string;
};
~~~

Правила:

1. raw input не переписывается;
2. исправление создаёт новую версию;
3. неизвестная уверенность не превращается в 100 процентов;
4. рискованные spans блокируют автоматический factual output;
5. система может предложить CLARIFY;
6. голосовая ошибка не должна менять provenance исходного источника.

---

## 18. Три архитектурные ветви

### 18.1. Ветка A: Deterministic Rule/AST

Конвейер:

~~~text
RAW
-> MORPHOLOGY
-> CLAIMS
-> MOVES
-> RANKED
-> PREVIEW
-> COMMIT
~~~

Типы:

- TranscriptLattice;
- MorphAnalysis;
- ClaimAst;
- DefinitionClaim;
- DiscourseSlot;
- ContinuationMove;
- ReplayReceipt.

Преимущества:

- детерминированность;
- точный rollback;
- небольшая зависимость от внешних сервисов;
- быстрый corpus-driven прогресс.

Ограничение: не создаёт новый внешний факт.

### 18.2. Ветка B: Source-Backed Graph/Retrieval

~~~text
INGEST
-> SEAL
-> PASSAGES
-> CLAIMS
-> RETRIEVE
-> ALIGN
-> COUNTERSEARCH
-> PLAN
-> REALIZE
-> REPLAY
-> REVIEW
-> COMMIT
~~~

Типы:

- SourceVersion;
- Passage;
- Claim;
- EvidenceEdge;
- OpenGap;
- RetrievalAttempt;
- DraftSentence;
- ReplayReceipt.

Преимущество: пригодна для энциклопедий, новостей, дипломов и диссертаций.

Ограничение: самая дорогая ветвь; AG5 остаётся заблокированным до нового holdout.

### 18.3. Ветка C: Human-in-the-Loop Cluster Conveyor

~~~text
INBOX
-> TRANSCRIBE / IMPORT
-> NORMALIZE
-> CLUSTER
-> TRIAGE
-> PROPOSE
-> HUMAN_REVIEW
-> APPLY
-> DRAFT
-> EXPORT
~~~

Типы:

- InputBatch;
- TranscriptLattice;
- ClusterCard;
- OperationProposal;
- ReviewDecision;
- Checkpoint;
- ExportPacket.

Преимущество: самый быстрый путь к реально полезному редактору.

Ограничение: меньше автономности.

### 18.4. Рекомендуемая композиция

~~~text
C as product shell
contains A as deterministic core
later connects B as factual source layer
~~~

---

## 19. Если начинать с нуля

### Вариант 1. Natural Definition Compiler

Рекомендуемый.

~~~text
text
-> morphology
-> DefinitionClaim
-> AG4
-> ContinuationMove lattice
-> preview
-> commit
~~~

Сохранить:

- Formula AST;
- Claim IR;
- evidence contracts;
- action controller;
- ledger;
- ring projection.

Переписать:

- главный textarea;
- маршрутизацию свободного текста;
- FlowFrame на реальные WorkItem/Receipt.

### Вариант 2. Закрытое символическое кольцо

Поддерживать:

- формулы;
- фиксированный тезаурус;
- Controlled Russian;
- конечный каталог ходов.

Плюс: быстро становится завершённым.

Минус: нельзя заявлять произвольные статьи.

### Вариант 3. Source-first Research Conveyor

~~~text
SourceVersion
-> Passage
-> Claim
-> Evidence
-> reversible Split/Merge
-> DraftFragment
~~~

Плюс: максимальная польза для научной работы.

Минус: самый большой объём реализации и разметки.

---

## 20. UI: Cluster River Workbench

### 20.1. Основной экран

Первый экран является рабочим инструментом, а не landing page.

Три зоны:

1. слева исходный текст, голосовые альтернативы и источники;
2. в центре каналы и максимум 30 кластеров;
3. справа текстовый результат, refs, unresolved issues и preview/undo.

### 20.2. Визуальный словарь

- форма означает kind;
- размер равен sqrt(claimCount) с жёсткими min/max;
- обводка означает state;
- ширина канала означает capacity;
- очередь у шлюза означает Q/C;
- карантин находится вне основного русла;
- пунктир означает post-hoc projection;
- движение означает наличие FlowReceipt;
- анимация не повышает authority.

### 20.3. Кластеры вместо 180 капель

Ограничение визуального окна:

~~~text
maxVisibleClusters = 30
~~~

Остальные агрегируются по lane и kind, но исходные IDs остаются доступными в инспекторе.

### 20.4. Инспектор

Один inspector показывает:

- manifest;
- exact passages;
- claims;
- qualifiers;
- transforms;
- reason codes;
- before/after;
- unresolved leaves;
- review cost.

Карточки не вкладываются в карточки. Каналы остаются полноширинными полосами.

---

## 21. Конечный автомат

~~~text
RECEIVED
-> QUARANTINED
-> SEALED
-> TRANSCRIBED
-> NORMALIZED
-> CLAIM_CANDIDATES
-> CLUSTERED
-> ROUTED
-> QUEUED
-> LEASED
-> RUNNING
-> PREVIEWED
-> VALIDATED
-> REVIEW_PENDING
-> COMMITTED
-> EXPORTED
~~~

Боковые состояния:

~~~text
PARKED
STALE
INVALID
BUDGET_EXCEEDED
UNAVAILABLE
ROLLED_BACK
ABSTAIN
~~~

Semantic uncertainty ведёт в PARK или REVIEW_PENDING, а не в технический DEAD_LETTER.

---

## 22. Псевдокод главного прохода

~~~text
process(envelope, policy):
    raw = sealRawInput(envelope)
    transcript = buildTranscriptLattice(raw)

    if riskyVoiceSpan(transcript):
        return CLARIFY_WITH_VERSIONED_ALTERNATIVES

    claims = morphologyAndDefinitionBridge(transcript)
    if claims.status in {AMBIGUOUS, OOV}:
        return ABSTAIN_OR_CLARIFY

    clusters = buildSemanticClusters(claims)
    G_sem = buildTypedEvidenceGraph(clusters)

    if observedCoverage(G_sem) < policy.minCoverage:
        return PARK(INSUFFICIENT_OBSERVATION)

    diagnostics = computeRoutingOnlyDiagnostics(G_sem)
    G_work = buildWorkGraph(clusters, diagnostics)

    updateQueues(G_work)
    if not queuesStable():
        applyBackpressure()
        return PARK(BACKPRESSURE)

    proposals = routeTypedOperations(
        KEEP, LINK, SPLIT, MERGE,
        VERIFY, CONTRADICT, PARK, QUARANTINE
    )

    for proposal in stableRank(proposals):
        require hardSemanticGates(proposal)
        checkpoint = sealCheckpoint()
        preview = executeWithoutCommit(proposal)
        receipt = verifyCoverageProvenanceAndInverse(preview)

        if receipt.loss > 0:
            rollback(checkpoint)
            continue

        draft = controlledRealizer(preview)
        replay = sourceReplay(draft)

        if replay.allFactualAtomsTraceable:
            return REVIEW_QUEUE(
                draft,
                receipt,
                replay,
                semanticTruth=false
            )

        rollback(checkpoint)

    return ABSTAIN(NO_REVIEWABLE_CONTINUATION)
~~~

---

## 23. Текстовый результат

Каждый запуск обязан вернуть один из типизированных результатов:

~~~text
CONTINUATION
CLARIFY
QUESTION
EVIDENCE_REQUEST
COMPARE
PARK
ABSTAIN
~~~

CONTINUATION содержит:

~~~ts
type ContinuationOutput = {
  paragraph: string;
  sentenceClaimMap: Array<{
    sentenceSpan: [number, number];
    claimRefs: string[];
    passageRefs: string[];
  }>;
  unresolvedIssues: string[];
  operationReceipts: string[];
  semanticTruth: false;
  reviewStatus: "REVIEW_PENDING";
};
~~~

Графический результат без текстового результата считается неполным.

---

## 24. Проверки и опровержение

### 24.1. Рамсеевская граница

- UNKNOWN не принимается за отсутствие ребра;
- визуальное fallback-ребро не меняет G_sem;
- clique/independent diagnostics не разрешают commit;
- результат проверяется по сетке thresholds.

### 24.2. Асимметрия

- x=y=0.5 не считается направленным;
- forward/reverse сохраняются отдельно;
- gross и net imbalance не смешиваются.

### 24.3. Очередь

- duplicate receipt не увеличивает flux;
- capacity учитывает items, bytes и cost;
- high watermark блокирует fan-out;
- low watermark возобновляет admission;
- backlog не растёт без ограничения в stable test.

### 24.4. Split

- Coverage = 1;
- QualifierLoss = 0;
- ProvenanceLoss = 0;
- polarity, time, modality и quantifier сохранены.

### 24.5. Merge

- входные claims восстанавливаются;
- конфликт не скрыт;
- source leaves сохранены;
- порядок входов не меняет semantic result hash.

### 24.6. Голос

- raw hash неизменяем;
- correction создаёт revision;
- risky negation/number/date/name/citation блокирует автоматический факт;
- альтернативы доступны пользователю.

### 24.7. UI

- движение появляется только с receipt;
- 30 кластеров не меняют layout;
- длинный label не перекрывает соседние элементы;
- mobile/desktop inspector не заслоняет результат;
- post-hoc projection визуально отличима.

### 24.8. Authority

- semanticTruth всегда false в routing artifacts;
- score не меняет relation;
- hash не доказывает истинность;
- большинство агентов не повышает evidence;
- human commit использует exact before/after.

---

## 25. Этапы реализации

### R0. Контракты и корпус

- SemanticCluster;
- ProvenanceManifest;
- FlowReceipt;
- ChannelSegment;
- TranscriptLattice;
- noisy ASR corpus;
- Definition D1 corpus;
- transition table.

### R1. Natural Definition Bridge

- morphology;
- exact spans;
- DefinitionClaim;
- main textarea route;
- DETAIL/EVIDENCE/CONTRAST/QUESTION/ABSTAIN.

### R2. Cluster projection

- AG4 candidates -> SemanticClusters;
- статическая G_view;
- manifest inspector;
- без нового authority.

### R3. Реальная очередь

- discrete-event ledger;
- capacity;
- high/low watermarks;
- lease/fencing;
- stable routing;
- FlowReceipt.

### R4. Обратимые операции

- provenance-safe SPLIT;
- provenance-safe MERGE;
- conflict register;
- checkpoints;
- exact rollback.

### R5. Cluster River Workbench

- основной рабочий экран;
- максимум 30 кластеров;
- движение по receipts;
- постоянный текстовый output;
- preview/commit/undo.

### R6. Source-backed continuation

- retrieval;
- alignment;
- countersearch;
- controlled realizer;
- source replay;
- review queue.

### R7. Новый blind holdout

AG5 разрешается только после прохождения:

- candidate recall;
- candidate precision;
- relation macro-F1;
- contradiction recall;
- provenance completeness;
- rollback exactness;
- zero unsupported atoms;
- zero authority violations.

---

## 26. Что делать с существующими файлами

### Сохранить

- Formula AST и registry;
- Claim IR;
- evidence contracts;
- source cascade;
- action controller;
- semantic ledger;
- work contracts;
- passive Flow view;
- P79/P80 read-only boundaries;
- regression tests.

### Понизить до диагностического слоя

- stem-based main analysis;
- legacy radius scores;
- Canvas graph metrics;
- template continuation;
- decorative particle counts.

### Не переносить

- routing P24;
- first-branch selection;
- бессрочные пакеты без TTL;
- генератор и judge на одном ручном словаре;
- физические формулы как semantic decision rules.

### Переписать

- main textarea -> Natural Definition Bridge;
- candidate count -> real queue;
- particle -> SemanticCluster;
- animation tick -> FlowReceipt projection;
- isolated output -> sentence-to-claim-to-source result.

---

## 27. Приоритет следующего коммита

Следующий принципиальный этап остаётся:

~~~text
AG4.5 Natural Definition Bridge
~~~

Но его следует сразу проектировать в контракте SemanticCluster, чтобы не создавать ещё один изолированный анализатор.

Минимальный вертикальный срез:

~~~text
text / voice
-> TranscriptLattice
-> morphology
-> DefinitionClaim
-> SemanticCluster
-> one typed move
-> preview
-> paragraph or ABSTAIN
-> exact refs and receipt
~~~

Не требуется сразу:

- полноценный генеративный AG5;
- внешняя LLM;
- численная гидродинамика;
- 3D;
- теория Рамсея в decision core;
- новый большой HTML.

---

## 28. Критерий готовности

Новый 2D-конвейер считается реализованным, когда одновременно выполнено:

1. главный ввод проходит через morphology/DefinitionClaim;
2. базовой единицей является SemanticCluster;
3. каждый кластер имеет ProvenanceManifest;
4. реальное движение имеет FlowReceipt;
5. очередь измеряет WorkItems, а не candidates;
6. SPLIT/MERGE обратимы;
7. голосовые риски fail closed;
8. пользователь видит текстовый результат;
9. G_view не управляет authority;
10. внешний holdout проходит заявленные gates.

До этого состояния интерфейс остаётся сильной исследовательской лабораторией и структурно проверенным прототипом, но не завершённым генератором осмысленного продолжения свободного текста.

---

## 29. Итоговая формула проекта

~~~text
MeaningfulContinuation =
  PreservedDifferences
  and VerifiedConnections
  and DirectedNovelty
  and ProvenanceComplete
  and QueueStable
  and Reversible
  and HumanReviewable
~~~

Вода даёт образ непрерывного канала.

Рамсей даёт дисциплину определения крайних подструктур.

Графы дают типизированные связи.

Очереди дают реальную логистику.

Claim и Evidence дают проверяемое содержание.

Receipt и rollback дают честное продолжение процесса.

Ни один из этих слоёв по отдельности не является смыслом; смысловая система возникает только из их проверяемой композиции.
