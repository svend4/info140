# 43 - P78: критический аудит svend4/data2 и адаптация архетипов движения

**Статус:** EXTERNAL_REPOSITORY_CRITICAL_AUDIT  
**Дата:** 2026-07-21  
**Репозиторий:** https://github.com/svend4/data2  
**Зафиксированный commit:** fe9b0996206a4e7d3323df4292b61828d7fc893e  
**Область применения:** только генерация и проверка гипотез для P78  
**Научный статус:** формулы и универсальные выводы репозитория не считаются подтверждёнными  
**Лицензия:** LICENSE в корне зафиксированного commit не найден; код и текст не копируются  

Связанные документы P78:

- [39 - каталог экспериментов](39-p78-linguistic-mathematics-experiment-catalog.md);
- [41 - внешний holdout естественных определений](41-p78-ag4-external-holdout-baseline.md);
- [42 - осмысленное продолжение, ресайклинг и асимметричная восьмёрка](42-p78-meaningful-continuation-and-information-recycling-spec.md).

## 1. Цель аудита

Пользователь предложил перенести «Единую теорию движения» и идеи В.В. Крюкова из физического движения в:

- движение слов и частей речи;
- построение предложений и абзацев;
- семантический поток;
- молитву, мантру и ритмическую речь;
- классификацию понятий;
- информационный конвейер;
- управляемый хаос между монолитом и пылью;
- операции над карточками, темами и порталами.

Задача аудита состоит не в подтверждении всей теории, а в разделении:

1. того, что репозиторий приписывает исходной книге о движении;
2. авторских расширений репозитория в другие области;
3. математических утверждений, требующих доказательства;
4. инженерных паттернов, которые можно независимо реализовать и проверить в P78;
5. образов, которые допустимы только как интерфейсная метафора.

## 2. Исследованные материалы

На зафиксированном commit просмотрены:

- [Series index](https://github.com/svend4/data2/blob/fe9b0996206a4e7d3323df4292b61828d7fc893e/SERIES_INDEX.md);
- [Volume 01: Movement Archetypes Analysis](https://github.com/svend4/data2/blob/fe9b0996206a4e7d3323df4292b61828d7fc893e/VOLUME_01_Movement_Archetypes_Analysis.md);
- [Volume 04: Algorithms and Programming](https://github.com/svend4/data2/blob/fe9b0996206a4e7d3323df4292b61828d7fc893e/VOLUME_04_Algorithms_and_Programming.md);
- [Volume 14: Language and Linguistics](https://github.com/svend4/data2/blob/fe9b0996206a4e7d3323df4292b61828d7fc893e/VOLUME_14_Language_and_Linguistics.md);
- [Volume 43: Proof of Theorem](https://github.com/svend4/data2/blob/fe9b0996206a4e7d3323df4292b61828d7fc893e/VOLUME_43_Proof_of_Theorem.md);
- [Volume 99: TSB Kryukov ETD](https://github.com/svend4/data2/blob/fe9b0996206a4e7d3323df4292b61828d7fc893e/VOLUME_99_TSB_Kryukov_ETD.md).

Репозиторий представляет большую серию производных документов. Внутри одного корпуса соседствуют пересказ физического источника, авторская интерпретация, математические заявления, псевдокод и переносы в лингвистику, программирование, медицину и другие области. Эти уровни не всегда отделены маркировкой evidence level.

## 3. Короткий вывод

Из data2 можно безопасно взять восемь инженерных паттернов:

1. замкнутый рабочий цикл;
2. двойной цикл с точкой переключения;
3. несколько вложенных масштабов;
4. общий шаблон операции;
5. систему окон как extension points;
6. конечные режимы;
7. бюджет действий;
8. зависимость сложности от дистанции связи.

Нельзя переносить как научные законы:

- универсальную оптимальность трёх сфер;
- обязательную нечётность оптимума;
- равенство частот как универсальную эффективность;
- LCI как меру смысла, здоровья или завершённости;
- фиксированные пороги LCI;
- утверждение, что любое предложение является замкнутой SVO-петлёй;
- числовые оценки жанров и речи без корпуса;
- скрытое намерение как автоматически распознаваемый факт.

Правильная адаптация:

> не «слова движутся по тем же законам, что руки», а «некоторые структуры управления физическим движением можно превратить в проверяемые структуры управления обработкой текста».

## 4. Уровни доверия

### Уровень A. Атрибутированный физический материал

Некоторые документы указывают главы и приводят фрагменты, приписанные книге о боевом движении: петли, вложенные сферы, основное базовое движение, окна, режимы и экономию действий.

Аудит не располагал независимым полным текстом книги и не подтверждает точность каждой цитаты или интерпретации.

### Уровень B. Расширение data2

Переходы «петля руки -> предложение», «три сферы -> три уровня языка», «нечётность -> оптимальная риторика» и «LCI -> качество текста» являются расширениями репозитория. Они не следуют автоматически из физического описания.

### Уровень C. Математические заявления

Формулы и «теоремы» требуют обычной математической проверки независимо от названия и объёма серии. Наличие Python-кода не заменяет доказательство.

### Уровень D. Адаптация P78

P78 использует только независимо определённые контракты, собственный код, corpus tests и falsification conditions. Названия Крюкова или ETD могут храниться в поле inspirationRef, но не в authority.

## 5. Математические проблемы

### 5.1. Формула восьмёрки с фазой

В Volume 01 приведена форма:

~~~text
x(t) = A sin(omega t)
y(t) = A sin(2 omega t + phi)
~~~

и указано, что при phi = pi/2 получается восьмёрка.

При phi = pi/2:

~~~text
y = A cos(2 omega t)
  = A - 2 x^2 / A
~~~

То есть в плоской проекции получается параболическая ветвь, проходящая повторно, а не стандартная самопересекающаяся восьмёрка.

Корректный простой вариант:

~~~text
x(t) = A sin(t)
y(t) = B sin(t) cos(t)
     = (B/2) sin(2t)
~~~

Это лемниската Жероно. Для неравных лепестков P78 использует деформацию, описанную в документе 42.

### 5.2. Контурный интеграл

В Volume 01 замкнутая траектория сопровождается записью вида:

~~~text
integral_over_closed_path dT != 0
~~~

Если dT означает полный дифференциал вектора положения, интеграл по замкнутому контуру равен нулю. Ненулевым может быть интеграл другого поля по контуру, но поле и смысл не определены.

P78 не использует эту запись. Замкнутость проверяется расстоянием концов и состоянием журнала.

### 5.3. LCI не измеряет замыкание

В серии LCI задаётся как отношение площади или объёма convex hull траектории к bounding box.

Эта величина измеряет заполнение ограничивающего прямоугольника выпуклой оболочкой. Она не проверяет:

- совпадают ли начало и конец;
- есть ли разрыв;
- сколько раз путь обошёл контур;
- является ли облако случайным;
- появилось ли новое смысловое состояние.

Открытая дуга и закрытая кривая могут иметь близкий hull fill ratio. Случайное облако может иметь высокий результат. Поэтому в P78 возможное нейтральное имя - HullFillRatio, только для геометрической диагностики.

### 5.4. Нечётность оптимума не доказана

Volume 43 утверждает, что добавление нечётной итерации не уменьшает LCI, и из этого выводит нечётность оптимального числа итераций.

Проблемы:

1. convex hull при добавлении точки не уменьшается, но bounding box также не обязан уменьшаться;
2. отношение двух неубывающих величин может как расти, так и падать;
3. «новое направление для большинства отображений» не является условием теоремы;
4. максимум не обязан достигаться на нечётном индексе;
5. численная доля успешных сравнений более 0.8 не является доказательством.

P78 не вводит odd-number gate. Число стадий определяется типами и тестами.

### 5.5. Компактность множества орбит не следует из компактности одной орбиты

В Volume 43 компактность образа каждой непрерывной траектории используется как основание компактности множества всех орбит в функциональном пространстве.

Для такого перехода нужны дополнительные условия, например равномерная ограниченность и equicontinuity для применения подходящих компактностных результатов. Они не заданы.

### 5.6. Три сферы не выводятся из максимума LCI

Разбиение координат на три равные группы в коде является выбранной процедурой. Оно не доказывает, что оптимальная система обязана иметь ровно три естественные сферы.

P78 может иметь три масштаба token/claim/document как удобную архитектуру, но не как следствие универсальной теоремы.

### 5.7. Теорема Пуанкаре-Бендиксона применена вне заявленной области

Volume 43 формулирует систему в общем пространстве, а устойчивость обосновывает ссылкой на результат для ограниченных плоских динамических систем. Переключение режимов также само по себе не гарантирует диссипацию или устойчивость.

P78 не использует этот вывод. Устойчивость workflow проверяется инвариантами, bounded retries и deterministic replay.

### 5.8. Численный поиск не является доказательством существования

Код, который выбирает лучший LCI среди конечного набора начальных условий и объявляет успех при best_lci > 0, подтверждает только результат конкретного finite sample. Он не доказывает существование глобального оптимума.

### 5.9. Равные частоты не доказывают резонанс и эффективность

Условие вида `omega1 = omega2 = omega3` само по себе не задаёт связанную динамическую систему. Чтобы говорить о резонансе, нужны как минимум уравнения связи, собственные частоты, фазы, затухание, внешнее воздействие и измеримая функция эффективности.

В P78 совпадение частот анимации может быть только визуальной синхронизацией. Оно не означает согласие агентов, качество текста или истинность claim.

### 5.10. Фиксированные пороги и число 7 не являются законами

Пороги `LCI < 0.7`, `LCI > 0.85`, ссылка на `7 +/- 2` и эквивалентность семи аксиом максимуму эффективности не выведены из общей модели и не снабжены preregistered experiment.

Для P78 любое число является конфигурацией с областью действия:

~~~text
Threshold(value, metric, corpus, version, rationale, calibratedAt)
~~~

Порог без названной метрики, корпуса, baseline и confidence interval не может блокировать или разрешать semantic commit.

### 5.11. Согласие проверок нельзя задавать константами

Если результаты Lean, SymPy, эксперимента или экспертной проверки внесены в программу готовыми числами, последующее усреднение не является независимой верификацией. Изменение порога после получения результата также не подтверждает исходную гипотезу.

Корректный P78 receipt хранит фактические артефакты каждой проверки:

~~~text
VerificationReceipt(method, inputHash, toolVersion, outputHash,
                    verdict, limitations, independentLineage)
~~~

Среднее значение нескольких verdict не заменяет проверку того, что методы измеряют одну и ту же величину и действительно независимы.

## 6. Проблемы лингвистического переноса

### 6.1. SVO не является универсальной петлёй

Volume 14 описывает предложение как S -> V -> O -> S. Это может быть учебной схемой для одного примера, но:

- языки имеют разные базовые порядки;
- русский допускает вариативный порядок;
- предложение может быть без явного объекта;
- назывное предложение может быть без глагола;
- вопрос, определение и безличная конструкция имеют другие структуры;
- понимание слушателя не является синтаксическим ребром назад к субъекту.

В P78 SVO является одним pattern, а не общим законом.

### 6.2. Числа LCI жанров не операционализированы

Оценки трагедии, комедии, незавершённой мысли или «резонанса» не сопровождаются corpus definition, annotation protocol и validation. Их нельзя использовать как labels или thresholds.

### 6.3. Нечётность не определяет качество риторики

Три аргумента иногда удобны, но два, четыре или другое число не становятся хуже из-за чётности. Количество зависит от задачи, evidence и cognitive load.

### 6.4. Упрощённый анализ ударения не является русской просодией

Псевдокод, который назначает ударение по позиции слога, не обеспечивает корректного русского ударения. Его output нельзя называть метром без словаря, морфологии и оценки на корпусе.

### 6.5. Скрытое значение не является наблюдаемым фактом

Модель «угроза/камуфляж» может породить кандидаты literal meaning и inferred intent. Но система не имеет права утверждать скрытое намерение говорящего.

Правильный контракт:

~~~text
ObservedText
LiteralClaim
PragmaticHypothesis[]
EvidenceForHypothesis[]
resolutionStatus = UNKNOWN | USER_CONFIRMED
~~~

## 7. Полезные паттерны и безопасный перевод

| Идея data2 | Нейтральный паттерн P78 | Реализация | Запрет |
|---|---|---|---|
| петля | finite work cycle | transition -> receipt -> checkpoint | бесконечность как прогресс |
| двойная петля | alternating two-pass workflow | split/verify и merge/review | восьмёрка как истина |
| вложенные сферы | explicit scales | token -> claim -> passage -> document | ровно три как закон |
| ОБД | typed master operation | WorkSpec and operator registry | один шаблон для всех жанров |
| камуфляж/угроза | observed vs hypothesized | literal claim + pragmatic candidates | чтение мыслей |
| окна | typed extension points and gaps | hook registry, gap detector | манипулирование пользователем |
| чёрный ящик | bounded search | max operations/time/candidates | минимум действий без quality gate |
| режимы | finite state machine | enums and transition table | художественные labels в core |
| звериные стратегии | strategy registry | optional candidate generators | cyclic dominance as truth |
| пять уровней | maturity profile | tested capability levels | статус человека |
| память | explicit budget | measured token/claim limits | магическое 7 +/- 2 |
| дистанция-сложность | adaptive effort | dependency distance and ambiguity | экранное расстояние |

## 8. Части речи как типы, а не движущиеся тела

Для P78 полезнее говорить не «существительное физически движется», а «токен получает роль в типизированной трансформации».

| Языковой класс | Базовый объект | Возможные операции |
|---|---|---|
| существительное | EntityCandidate | resolve, type, corefer |
| глагол | PredicateCandidate | frame, tense, aspect, polarity |
| прилагательное | PropertyQualifier | attach, scope, compare |
| наречие | MannerOrDegreeQualifier | attach, bound, normalize |
| местоимение | UnresolvedEntityRef | coreference, clarify |
| числительное | Quantity | normalize unit, preserve value |
| предлог | RelationMarker | propose typed relation |
| союз | LogicOrDiscourseMarker | coordinate, subordinate, contrast |
| частица | PolarityOrModalityMarker | negate, limit, question |
| пунктуация | StructuralBoundary | segment, appose, quote, open gap |

Часть речи не определяет смысл самостоятельно. Нужны контекст, morphology, dependency, entity resolution и source spans.

## 9. Канон и базовые понятия

Пользователь предлагает строить речь из канонизированных истин и фундаментальных понятий. Технически это возможно как versioned domain ontology:

~~~js
{
  schema: 'meridian.domain-canon/1',
  domainId,
  version,
  conceptRefs,
  relationTypeRefs,
  allowedInferenceRules,
  prohibitedTransformations,
  authoritySourceRefs,
  reviewPolicyRef,
  contentHash
}
~~~

Термин canon означает только принятый для конкретной задачи набор определений и правил. Он не означает абсолютную истину. Изменение версии создаёт новый policy hash.

Примеры:

- энциклопедический canon: нейтральный стиль и source-backed facts;
- научный canon: method/result/limitation и точные locators;
- художественный canon: персонажи, события и правила мира;
- молитвенный или литургический canon: только пользовательский корпус и правила традиции, без автоматического богословского вывода.

## 10. Семейство, род, вид и подсемейство

Таксономическая схема полезна для классификации понятий:

~~~text
ConceptFamily
  -> Genus
      -> Species
          -> Variant
~~~

Но реальная семантика часто является не деревом, а DAG:

- один объект может иметь несколько классификаций;
- отношения part-of и is-a различаются;
- историческая классификация может конфликтовать с современной;
- source versions могут использовать разные термины.

Поэтому:

~~~text
IS_A       - таксономия
PART_OF    - состав
INSTANCE_OF - экземпляр
DERIVED_FROM - происхождение
RELATED_TO - нетаксономическая связь
~~~

нельзя сливать в одно ребро.

## 11. Окна, крюки, порталы и темы

Volume 04 переводит «систему окон» в hooks/callbacks. Для P78 это одна из наиболее полезных идей при нейтральном переопределении.

### 11.1. SemanticHook

~~~js
{
  schema: 'meridian.semantic-hook/1',
  hookId,
  stage,
  acceptedInputSchema,
  emittedOutputSchema,
  requiredAuthority,
  budget,
  handlerRef,
  deterministic,
  contentHash
}
~~~

### 11.2. Portal

Portal не является мистическим переходом. Это typed boundary:

~~~text
current schema
  -> validator
  -> adapter
  -> target schema
~~~

Если типы несовместимы, portal возвращает BLOCKED. Он не преобразует данные «по похожести».

### 11.3. Topic routing

Тема является destination candidate. Маршрутизатор может вернуть несколько тем с причинами. Выбор темы не меняет claim и provenance.

## 12. Управляемый хаос

Пользователь описывает середину между монолитом и пылью. Техническая форма:

~~~text
монолит:
  one summary
  high condition loss
  hidden conflicts

пыль:
  many atoms
  high orphan rate
  no discourse backbone

управляемая середина:
  typed clusters
  explicit inter-cluster bridges
  reversible merge/split
  bounded branching
  checkpoint/rollback
~~~

Алгоритм:

~~~text
function controlledSemanticSearch(graph, policy, budget):
    gaps = deriveGaps(graph)
    lattice = generateTypedMoves(gaps)
    eligible = hardGate(lattice)
    frontier = stableRank(eligible)
    visited = set()

    while frontier not empty and budget remains:
        move = frontier.pop()
        stateHash = hash(graph, move, policy)

        if stateHash in visited:
            reject(move, REPEATED_STATE)
            continue

        visited.add(stateHash)
        result = executeWithReceipt(move)

        if result.passesPostconditions:
            return REVIEW_QUEUE(result)

        rollback(result.parentCheckpoint)

    return ABSTAIN(NO_REVIEWABLE_MOVE)
~~~

Хаос здесь означает разнообразие кандидатов. Управление обеспечивают types, budgets, deterministic rank, receipts и rollback.

## 13. Корректные замены спорных метрик

### 13.1. Геометрическое замыкание

~~~text
closureGap =
    distance(point_end, point_start)
  / max(epsilon, pathLength)
~~~

Показывает замкнутость нарисованного пути, но не завершённость мысли.

### 13.2. Содержательный цикл

~~~text
if currentStateHash in visitedStateHashes
   and verifiedSemanticDelta = 0:
    status = STALLED
~~~

### 13.3. Полезность прохода

~~~text
typedOutputRate =
    attemptsWithValidReceipt
  / max(1, attempts)
~~~

### 13.4. Связность масштабов

~~~text
crossScaleCoverage =
    childObjectsWithParentAndSource
  / max(1, childObjectCount)
~~~

### 13.5. Потеря при слиянии

~~~text
generalizationLoss =
    lostHardConditions
  / max(1, inputHardConditions)
~~~

### 13.6. Фрагментация

~~~text
orphanFragmentRate =
    outputAtomsWithoutParentTopicOrSource
  / max(1, outputAtomCount)
~~~

Ни одна из величин не называется смыслом или истинностью.

## 14. Два прохода над речью

Двойную петлю можно применить как чередование:

### Лепесток A: аналитический

~~~text
raw speech
 -> preserve alternatives
 -> morphology
 -> split into claim atoms
 -> resolve roles
 -> verify sources
~~~

### Лепесток B: синтетический

~~~text
verified atoms
 -> group by topic and discourse role
 -> preserve conflicts
 -> merge under coverage map
 -> realize candidate text
 -> countersearch
~~~

Пересечение лепестков:

~~~text
CHECKPOINT
REVIEW
COMMIT or ROLLBACK
~~~

Это действительно полезный перенос двойной петли. Он не требует принимать универсальные аксиомы ETD.

## 15. Ритмическая и молитвенная речь

Для молитвы, мантры или канонического текста P78 может выполнять технические операции:

- сегментировать повторяющиеся формулы;
- сохранять канонический порядок;
- находить варианты и пропуски;
- связывать строку с источником и традицией;
- показывать ритм, ударения и дыхательные фразы;
- сравнивать редакции;
- воспроизводить звук по подтверждённому тексту.

P78 не должен:

- определять духовную истинность;
- смешивать традиции по лексической близости;
- объявлять частый повтор более правильным;
- исправлять канонический текст без review;
- выводить скрытый смысл как факт.

Статус результата:

~~~text
TEXTUAL_VARIANT
RHYTHMIC_PATTERN
SOURCE_ALIGNMENT
MISSING_SEGMENT
REQUIRES_TRADITION_REVIEW
~~~

## 16. Информационный конвейер

Независимо адаптированные паттерны data2 включаются так:

~~~text
LOOP:
  каждый проход заканчивается receipt

NESTED SCALES:
  token -> claim -> passage -> paragraph -> document -> topic

MASTER TEMPLATE:
  operator registry and exact schemas

WINDOWS:
  genre gaps and typed extension points

MODES:
  finite state machine

ECONOMY:
  bounded operations, candidates, time and review load

DISTANCE:
  дальняя dependency получает больший ambiguity/review budget
~~~

Результат маршрутизируется в:

- статью;
- раздел;
- комментарий;
- тему форума;
- карточку источника;
- conflict packet;
- question queue;
- parked queue.

## 17. Псевдокод адаптера архетипов

~~~text
function applyMovementPattern(patternId, semanticInput, policy):
    pattern = IndependentPatternRegistry.get(patternId)

    assert pattern.evidenceLevel in {
        ENGINEERING_PATTERN,
        VISUAL_METAPHOR,
        EXPERIMENTAL_HEURISTIC
    }

    if pattern.evidenceLevel == VISUAL_METAPHOR:
        return buildPassiveProjection(semanticInput, pattern)

    spec = pattern.createWorkSpec(semanticInput, policy)
    assertSchemaCompatibility(spec)
    receipt = executeBounded(spec)
    verifyPostconditions(receipt)

    return {
        authority: 'ROUTING_OR_DIAGNOSTIC_ONLY',
        receipt,
        sourceAttribution: pattern.inspirationRef,
        semanticTruth: false
    }
~~~

## 18. Что реализовать в P78

### Разрешить в ближайших этапах

1. two-pass split/merge workflow;
2. token/claim/passage/document scales;
3. typed gap/window registry;
4. FSM modes;
5. operation and memory budgets;
6. dependency-distance diagnostics;
7. observed/literal/hypothesized separation;
8. asymmetric lemniscate as passive display;
9. genre-specific domain canon;
10. topic routing with provenance.

### Оставить экспериментом

1. acoustic resonance between language scales;
2. loop rhythm for mantras;
3. strategy skins;
4. figure-eight sonification;
5. visual nested spheres.

### Отклонить как decision rule

1. odd number is always optimal;
2. exactly three spheres are universal;
3. LCI above a fixed threshold means quality;
4. equal frequencies imply maximum efficiency;
5. SVO closes semantic meaning;
6. hidden intent is inferable from form alone;
7. more cyclic motion means more progress.

## 19. Лицензирование

На зафиксированном commit запрос файла LICENSE в корне вернул 404, а repository search не обнаружил LICENSE. Публичная доступность GitHub-репозитория не означает разрешение копировать код или большие фрагменты текста; это соответствует [руководству GitHub о репозиториях без лицензии](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

Правила P78:

1. не копировать Python classes и prose из data2;
2. не переносить namespaced implementation;
3. использовать только независимо сформулированные общие идеи;
4. сохранять inspiration URL и commit pin;
5. весь новый JS писать независимо;
6. при появлении лицензии повторно проверить её область и commit;
7. цитировать коротко и только при необходимости.

## 20. Проверки адаптации

### Математика

- correct lemniscate samples;
- closureGap против open/closed paths;
- lobe asymmetry and continuity;
- no semantic use of HullFillRatio;
- no odd-count invariant.

### Язык

- SVO, SOV, free-order and verbless fixtures;
- zero copula definitions;
- pronoun ambiguity;
- negation and modality;
- literal versus pragmatic hypothesis;
- genre-specific gaps.

### Конвейер

- every attempt emits receipt;
- retry and branch budgets;
- repeated state detection;
- exact rollback;
- source provenance;
- no authority escalation.

### Метафоры

- switching visual skin does not change semantic hashes;
- changing sound mode does not change candidates;
- nested scale count is configuration, not theorem;
- LCI labels do not appear in semantic verdict;
- disabled data2 adapter leaves P78 functional.

## 21. Критерий принятия идеи из data2

Каждая идея проходит карточку:

~~~text
source claim
independent neutral restatement
P78 data contract
measurable benefit
risk
falsification condition
baseline
authority boundary
license decision
~~~

Идея принимается только если:

1. нейтральная реализация не зависит от истинности всей ETD;
2. есть локальная измеримая гипотеза;
3. существует baseline;
4. провал теста позволяет удалить механизм;
5. semantic authority не повышается;
6. код написан независимо.

## 22. Итог

data2 полезен как обширный каталог аналогий и проектных гипотез. Особенно продуктивны двойная петля, вложенные масштабы, окна/hooks, режимы и экономика действий. Они хорошо совпадают с уже существующими P78 contracts, continuation lattice, queues и rollback.

Однако математическая форма репозитория не даёт готовой универсальной теории смысла. В ключевых местах формула восьмёрки указана с неподходящей фазой, LCI не измеряет замыкание, нечётность не доказана, трёхсферный оптимум предполагается, а лингвистические числовые выводы не имеют corpus validation.

Поэтому P78 берёт не «теорему Крюкова для слов», а инженерный шаблон:

> анализируем в одном лепестке, синтезируем в другом, проверяем в пересечении, сохраняем несколько масштабов, ограничиваем бюджет и возвращаемся к checkpoint при нарушении условий.

Это превращает образ движения в тестируемый алгоритм и сохраняет границу между свободной речью и жёсткой арифметикой: не монолит, не пыль, а типизированные, обратимо связанные кластеры.
