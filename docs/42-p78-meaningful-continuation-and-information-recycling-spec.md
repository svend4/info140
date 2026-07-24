# 42 - P78: осмысленное продолжение, обратимый цикл и информационный ресайклинг

**Статус:** DESIGN_SPEC_FOR_NEXT_IMPLEMENTATION  
**Дата:** 2026-07-21  
**Область:** самостоятельное 2D-кольцо P78  
**Текущая граница:** AG4 остаётся review-only, AG5 остаётся отключённым  
**Главный следующий срез:** morphology + DefinitionClaim projector + typed continuation lattice  

Связанные документы:

- [29 - энциклопедическое семантическое кольцо](29-encyclopedic-semantic-ring-spec.md);
- [30 - научное слияние и расщепление](30-scientific-synthesis-fission-fusion-spec.md);
- [39 - каталог формальных, эвристических и фантастических идей](39-p78-linguistic-mathematics-experiment-catalog.md);
- [40 - реализованная 2D-проекция потока](40-p78-semantic-flow-projection-implementation.md);
- [41 - внешний holdout AG4](41-p78-ag4-external-holdout-baseline.md).

## 1. Короткий ответ

Осмысленное продолжение нельзя получить из одного вращения, частоты слова, близости точек или красивой метафоры. Его можно получить из сочетания шести обычных механизмов:

1. типизированного разбора высказываний;
2. графа утверждений и источников;
3. жанрового плана с незаполненными смысловыми ролями;
4. жёстких ограничений, которые кандидат не имеет права нарушить;
5. решётки нескольких следующих ходов вместо одного угадывания;
6. обратимого журнала с откатом к последней подтверждённой развилке.

Уникальность P78 может состоять не в изобретении ещё одной непроверяемой формулы, а в точной композиции:

> компилятор текста + исследовательская картотека + граф происхождения + обратимые преобразования + 2D-кольцо состояний + звуковая диагностика.

Ключевое уточнение: содержательная остановка иногда обязательна. Если фактов недостаточно, продолжать текст выдумкой нельзя. Однако процесс не обязан прекращаться: он может сформулировать вопрос, найти источник, открыть альтернативную ветвь, припарковать задачу или откатиться. Поэтому закон P78 формулируется не как «всегда писать дальше», а как «всегда выдавать следующий проверяемый ход или объяснимую причину, почему такого хода нет».

## 2. Нормализация продиктованного запроса

В исходной диктовке некоторые слова распознаны неоднозначно. В частности, последовательности вроде «барбос», «урок барбур» и «оброс ура» далее интерпретируются как возможные искажения слова «уроборос». Эта интерпретация не должна молча заменять оригинал в данных. В рабочем контракте сохраняются:

- исходная строка;
- предложенная нормализация;
- альтернативные варианты;
- причина замены;
- признак подтверждения пользователем.

Ниже вопросы переписаны грамматически и логически, но их исходный смысл сохранён.

## 3. Нумерованные вопросы и варианты ответов

### Вопрос 1. Что считать осмысленным продолжением?

**Вариант A - новое предложение.** Недостаточно: грамматически новое предложение может повторять старое или выдумывать факт.

**Вариант B - изменение графа смысла.** Продолжение произошло, если появился хотя бы один допустимый типизированный результат: новый подтверждённый факт, связь, уточнение, контрпример, закрытый пробел, открытый вопрос или явно разрешённый конфликт.

**Решение:** использовать вариант B. Текст является одной из визуализаций изменения графа, а не единственным доказательством движения.

### Вопрос 2. Должна ли система любой ценой избегать остановки?

**Вариант A - бесконечно генерировать.** Создаёт повтор и галлюцинации.

**Вариант B - разрешить содержательную остановку, но продолжить работу метаходом.** Возможные метаходы: CLARIFY, FIND_SOURCE, COMPARE, PARK, ROLLBACK и ABSTAIN.

**Решение:** вариант B. Корректный отказ лучше ложного движения.

### Вопрос 3. Как формализовать «жидкость»?

**Вариант A - физическая симуляция частиц.** Полезна для интерфейса, но сама не содержит семантики.

**Вариант B - поток типизированных рабочих элементов.** Давление означает длину очереди, плотина - жёсткое ограничение, вязкость - неоднозначность, водоворот - повтор состояния, русло - разрешённая цепочка зависимостей.

**Решение:** B является моделью данных, A остаётся пассивной визуализацией B.

### Вопрос 4. Что такое центральная дорога, ствол или автобан?

Это не самая частая и не самая центральная по графовой метрике фраза. Это **Backbone** - минимальный набор подтверждённых утверждений, которые прямо обслуживают цель документа. Ветка может быть интересной, но не попадает в Backbone без явной связи с целью.

### Вопрос 5. Как соединить дерево и кольцо?

Дерево моделирует варианты будущего. Кольцо моделирует повторяемый рабочий протокол. Их объединение называется **versioned exploration graph**:

~~~text
checkpoint
  -> propose branch
  -> retrieve evidence
  -> test constraints
  -> review
  -> commit new checkpoint
       or rollback to parent checkpoint
~~~

Цикл допустим в процессе работы, но запрещён в цепочке происхождения доказательства.

### Вопрос 6. Можно ли использовать Древо жизни, каббалистические пути или клиппот?

**Можно как необязательную культурную метафору интерфейса.** Узлы могут изображать типы преобразований, пути - допустимые переходы, а внешняя зона - карантин отклонённых кандидатов.

**Нельзя использовать как источник истинности, ранжирования или научной терминологии ядра.** В основном контракте применяются нейтральные имена GraphNode, Transition, ReviewQueue и Quarantine. Термин «клиппот» не должен становиться машинным reason code.

### Вопрос 7. Как применить уроборос?

Уроборос переводится в обратимый цикл:

~~~text
parentHash -> attempt -> receipt -> accepted childHash
                      -> rejected -> rollback(parentHash)
~~~

«Хвост» - хеш родительского checkpoint. Ветка может вернуться только к известному предку. Слияние двух ветвей требует общего предка и явной merge map.

### Вопрос 8. Что дают мантра, потешка и повтор?

Они полезны в трёх ограниченных ролях:

1. мнемоника стадий;
2. обнаружение повторов и почти-дубликатов;
3. звуковое кодирование изменения состояния.

Повтор не повышает истинность. Несколько копий одного источника схлопываются по provenance family.

### Вопрос 9. Можно ли переставлять слоги, как в «мара - рама»?

Да, но только как **token lattice** для фонетических альтернатив, обучения или художественного режима. Перестановка слогов может предложить варианты распознавания, но не имеет права создавать новый факт. Каждая форма хранит ссылку на исходный звуковой диапазон.

### Вопрос 10. Можно ли сделать звуковую семантику?

Полноценный смысл только из звука для P78 пока нереалистичен. Реализуемый вариант - sonification:

- короткий мотив для типа операции;
- изменение ритма для нагрузки очереди;
- отдельный сигнал для OOV, конфликта и rollback;
- тишина для отсутствия вычислительной работы;
- текстовый эквивалент для доступности.

Звук сообщает состояние, а не доказывает содержание.

### Вопрос 11. Как использовать дерево с «муравьями-словами»?

Муравей становится WorkAttempt, ветка - допустимой зависимостью, след - статистикой использования маршрута. «Феромон» может ранжировать удобный маршрут, но не истинный. След испаряется по времени и никогда не заменяет source evidence.

### Вопрос 12. Как использовать макромир, микромир, человеческий средний мир и ДНК?

Это три масштаба одной модели:

| Масштаб | Объект |
|---|---|
| микро | токен, морфема, роль, один claim atom |
| средний | предложение, абзац, аргумент, событие |
| макро | тема, глава, корпус, карта источников |

Аналог ДНК полезен как разделение **семантического генотипа** и **текстового фенотипа**: один Claim AST допускает несколько формулировок. Метафора не означает биологическую эволюцию и не входит в доказательство.

### Вопрос 13. Как скрестить таблицу умножения с деревом?

Нужно не перемножать слова, а построить **частичную таблицу композиции операторов**. Операция B разрешена после A, только если выходной тип A совместим со входным типом B.

Пример:

| A затем B | SPLIT | MERGE | VERIFY | REALIZE | ROLLBACK |
|---|---|---|---|---|---|
| PARSE | ClaimAtom[] | запрещено | ClaimAtom[] | запрещено | Input |
| SPLIT | ClaimAtom[] | MergeCandidate | EvidenceCheck | DraftCandidate | ParentClaim |
| MERGE | ClaimAtom[] | MergeCandidate | EvidenceCheck | DraftCandidate | InputClaims |
| VERIFY | EvidenceCheck | запрещено | ReplayCheck | VerifiedDraft | PreVerify |
| COMMIT | запрещено | BranchMerge | Audit | PublishedView | ParentCheckpoint |

Эта таблица похожа на умножение по форме, но является системой типов и предусловий.

### Вопрос 14. Как технически различить слияние и расщепление?

**SPLIT** создаёт несколько атомов и карту «какой диапазон и источник породил атом».  
**MERGE** создаёт сводный тезис и матрицу покрытия входных атомов.  
Обе операции допустимы только при round-trip проверке и сохранении polarity, modality, quantifier, time, scope и qualifiers.

### Вопрос 15. Как избежать двух крайностей: полного уплотнения и полного распада?

Нужны две независимые метрики, а не один мистический коэффициент:

- generalizationLoss - доля условий и различий, потерянных при слиянии;
- orphanFragmentRate - доля частей без связи с целью, источником или родителем.

Допустимое 2D-кольцо находится там, где обе метрики ниже своих порогов.

### Вопрос 16. Как строить осмысленное энциклопедическое продолжение?

Сначала определить незаполненную роль структуры: определение, состав, свойство, механизм, пример, ограничение, история или связь. Затем найти source-backed claim для этой роли. Только после replay построить предложение по контролируемому шаблону.

### Вопрос 17. Как строить продолжение новости?

Разделять:

- событие;
- сообщение об событии;
- источник сообщения;
- время события и время публикации;
- прямую цитату;
- интерпретацию;
- фон;
- реакцию другой стороны;
- неизвестное.

Следующий ход выбирается по отсутствующей роли, а не по ближайшим словам.

### Вопрос 18. Что значит цифровой «ресайклинг» информационного потока?

Это не удаление «мусора», а маршрутизация каждого объекта:

KEEP, LINK, MERGE, SPLIT, VERIFY, CONTRADICT, PARK, QUARANTINE или DISCARD_DUPLICATE.

Конфликтующий источник нельзя выбрасывать как спам только потому, что он мешает сводному тезису.

### Вопрос 19. Как применить систему к диплому и диссертации?

Строить матрицу:

~~~text
research question
  -> thesis
  -> subclaim
  -> exact passage
  -> source version
  -> method
  -> limitation
  -> review decision
~~~

P78 помогает найти пробелы и собрать обратимый черновик, но не объявляет научную новизну и не заменяет автора или научного руководителя.

### Вопрос 20. Как учитывать ошибки голосового распознавания?

Никогда не исправлять молча отрицания, числа, имена, единицы измерения и ссылки. Хранить N-best варианты, временные диапазоны, confidence и решение пользователя. Низкая уверенность порождает CLARIFY, а не случайный Claim AST.

### Вопрос 21. Как выбирать лучшую ветвь?

Сначала жёсткие ворота, затем мягкий rank. Балл не является истинностью. Лучший по баллу кандидат всё равно остаётся REQUIRES_REVIEW.

### Вопрос 22. Как работает откат?

Каждая попытка начинается от immutable checkpoint. При нарушении ограничения сохраняется rejection receipt, ветвь помечается как испробованная, состояние восстанавливается по parentHash и рассматривается следующий кандидат. Повтор того же stateHash обнаруживается как цикл.

### Вопрос 23. Как использовать нескольких агентов?

Разделить полномочия по операциям: transcription, parsing, retrieval, countersearch, merge proposal, realization и audit. Агенты возвращают receipts. Большинство голосов не определяет факт. Итог зависит от валидных receipts и правил, а не от порядка завершения.

### Вопрос 24. В каком виде хранить и обменивать данные?

Для первого этапа достаточно малых модулей и content-addressed JSON:

- immutable source snapshots;
- JSONL event journal;
- отдельные claim/evidence records;
- manifest с версиями схем и хешами;
- локальный индекс как производный кэш;
- экспорт review packet.

Большой HTML не должен содержать корпуса и правила. Он подключает маленькие JS/CSS-модули.

### Вопрос 25. Что является ближайшим реалистичным MVP?

Не универсальный автор. MVP:

1. отдельный development corpus русских определений;
2. детерминированная морфологическая нормализация;
3. DefinitionClaim projector;
4. шесть типов следующего хода;
5. source-bound шаблонный realizer;
6. replay через AG3/AG4;
7. review packet и rollback.

### Вопрос 26. Что оставить фантастическим режимом?

Не включать в decision core: религиозные названия узлов, «истину центра», феромоны как доказательство, частоту мантры как вес факта, семантику цвета, физическое давление как качество и звук как источник факта. Эти элементы допустимы только как переключаемая визуализация или генератор гипотез.

## 4. Нормативная модель содержательного движения

Пусть состояние системы в момент t задаётся:

~~~text
S_t = (ClaimGraph, EvidenceGraph, OpenGaps, Conflicts,
       Checkpoint, Policy, Budget)
~~~

Один шаг осмыслен, если:

~~~text
HardGates(candidate) = PASS
and
SemanticDelta(S_t, S_t+1) > 0
~~~

Диагностическая величина:

~~~text
SemanticDelta =
    a * newSupportedClaims
  + b * newTypedRelations
  + c * closedGaps
  + d * resolvedConflicts
  + e * explicitNewQuestions
  - f * unsupportedAtoms
  - g * lostConditions
  - h * orphanFragments
~~~

Коэффициенты задают порядок ранжирования и калибруются на development corpus. Они не создают истинность. Для factual continuation обязательно:

~~~text
unsupportedAtoms = 0
provenanceCompleteness = 1
hardConstraintViolations = 0
~~~

Новый вопрос считается движением только тогда, когда он выводится из конкретного пробела графа. Случайная общая фраза «что ещё можно сказать?» движением не считается.

## 5. Самостоятельная 2D-модель без обязательных P77 и P80

Для самостоятельного P78 достаточно двух координат:

1. **theta - тип следующей работы:** DEFINE, EVIDENCE, DETAIL, CONTRAST, CAUSE, CONSEQUENCE, QUESTION, REVIEW.
2. **rho - гранулярность:** от сводного тезиса к атомарной детали.

Внутренняя рабочая область является кольцом:

~~~text
rho_min < rho < rho_max
~~~

- пересечение rho_min означает риск чрезмерного обобщения;
- пересечение rho_max означает риск сиротской фрагментации;
- нахождение в кольце не означает истинность, только допустимый масштаб операции;
- theta задаёт направление работы, но не ценность направления.

P77 и P80 могут подключаться через адаптеры, но не нужны для базового ClaimGraph, ContinuationLattice и rollback.

## 6. Исторические и средневековые идеи

| Исторический образ | Проверяемый перевод | Польза | Риск | Проверка |
|---|---|---|---|---|
| схоластический вопрос | thesis -> objections -> response -> replies | сохраняет возражения | формальный ритуал без содержания | contradiction recall и review time |
| глосса на полях | PassageAnnotation с точным span | не теряет локальный контекст | комментарий примут за источник | authority-field tests |
| конкорданс | двусторонний индекс term <-> passage | поиск употреблений | частота станет важностью | blind retrieval precision |
| тематическая картотека | карточки Claim/Evidence/Question | модульное накопление | дубликаты и разрыв контекста | provenance completeness |
| комбинаторное колесо | typed operator wheel | генерирует полный набор допустимых ходов | комбинационный взрыв | bounded budget и acceptance |
| мнемонический стих | короткий протокол стадий | запоминаемость | повтор примут за доказательство | user comprehension test |
| символическое дерево | typed graph layout | навигация | центр или верх примут за истину | neutral table baseline |
| круг возвращения | checkpoint/rollback loop | исправление тупиков | бесконечный цикл | visited hashes и retry cap |

Рекомендуемая комбинация для P78: схоластическая структура вопроса, конкорданс, картотека, типизированное комбинаторное колесо и журнал отката. Символические названия остаются skin, а не схемой данных.

## 7. Современные идеи

### 7.1. Компиляторный конвейер

Текст проходит стадии tokenization, morphology, parsing, typed IR, optimization under constraints и realization. Ошибка на ранней стадии является данными, а не поводом продолжить со случайным значением.

### 7.2. Event sourcing

Каждый semantic change записывается как событие. Состояние восстанавливается воспроизведением журнала. Undo не удаляет историю, а создаёт компенсирующее событие.

### 7.3. Graph rewriting

SPLIT, MERGE, GENERALIZE, SPECIALIZE, QUALIFY и CONTRADICT являются типизированными правилами переписывания графа с предусловиями и postconditions.

### 7.4. Constraint satisfaction

Polarity, modality, time, entity identity, quantities, units, canon и source scope становятся жёсткими ограничениями. Стиль, длина, разнообразие и ритм остаются мягкими.

### 7.5. Continuation lattice

Система строит не одну строку, а решётку типизированных ходов. Пользователь видит, почему предлагается определение, пример, контраргумент или поиск источника.

### 7.6. Hybrid retrieval

Поиск объединяет:

- точные формы;
- детерминированные леммы;
- n-граммы;
- структуру predicate/roles;
- локальные embeddings только как источник кандидатов;
- source and time filters.

Ни одна близость не классифицирует SUPPORTS без структурной проверки.

### 7.7. Countersearch

Для сильного кандидата система обязана искать отрицание, несовместимый qualifier, другой временной диапазон и независимый источник. Отсутствие найденного опровержения не доказывает истинность.

### 7.8. Reversible merge

Каждый сводный абзац хранит coverage matrix и способен показать, какой fragment поддерживает каждую его часть.

## 8. Фантастические идеи, которые можно безопасно испытать

### 8.1. Лес уроборосов

Каждая ветвь является отдельным циклом «предложил - проверил - принял или откатил». Полезность измеряется числом найденных тупиков до commit и долей восстановимых состояний.

### 8.2. Муравьиная диспетчеризация

WorkAttempts перемещаются по доступным edges. След хранит latency, failure rate и queue load. Он помогает планировать работу, но не оценивает содержание.

### 8.3. Семантическая ДНК

Claim AST хранит устойчивую структуру, SurfaceForm - конкретное предложение. «Мутация» разрешена только как paraphrase с сохранением всех инвариантов.

### 8.4. Архипелаг тем

Остров - локально связанный cluster claims, мост - typed cross-topic relation, море - отсутствие доказанной связи. Экранное расстояние не создаёт мост.

### 8.5. Звуковое кольцо

Каждому operatorId назначается короткий мотив. Повтор stateHash слышен как повтор, конфликт - как отдельный предупреждающий сигнал. Оценивать нужно скорость обнаружения состояния и доступность, а не художественную красоту.

### 8.6. Семантический водораздел

Кандидаты текут к разным жанровым ролям. Плотина означает failing hard gate, шлюз - human approval, резервуар - PARKED queue. Это полезная операционная карта, если рядом всегда есть точная таблица.

## 9. Типы следующего хода

Первый MVP поддерживает шесть типов:

| Move | Назначение | Обязательные предусловия |
|---|---|---|
| DEFINE | определить термин | term unresolved, source definition found |
| DETAIL | раскрыть подтверждённый тезис | parent claim supported, child evidence present |
| EVIDENCE | добавить опору | exact passage and source version |
| QUALIFY | указать границу или условие | qualifier source-bound |
| CONTRAST | показать различие или конфликт | two separately sourced claims |
| QUESTION | сформулировать пробел | gap derived from schema or conflict |

Следующий этап добавляет EXAMPLE, CAUSE, CONSEQUENCE, CHRONOLOGY, MERGE и SPLIT.

QUESTION не требует выдуманного ответа, но требует machine-readable gapRef. CONTRAST не означает REFUTES: две позиции могут различаться областью действия или временем.

## 10. Контракты данных

### 10.1. InputEnvelope

~~~js
{
  schema: 'meridian.input-envelope/1',
  inputId,
  rawText,
  language: 'ru',
  origin: 'VOICE' | 'TEXT' | 'SOURCE_IMPORT',
  sourceAudioHash: null | sha256,
  createdAt,
  policyRef,
  contentHash
}
~~~

Raw input неизменяем. Нормализованный текст хранится отдельно.

### 10.2. TranscriptLattice

~~~js
{
  schema: 'meridian.transcript-lattice/1',
  inputRef,
  segments: [{
    startMs,
    endMs,
    alternatives: [{
      text,
      confidence,
      origin: 'ASR' | 'RULE' | 'USER'
    }],
    selectedIndex,
    confirmation: 'AUTO_SAFE' | 'USER_CONFIRMED' | 'UNRESOLVED'
  }],
  protectedTokens: ['NEGATION', 'NUMBER', 'NAME', 'UNIT', 'CITATION'],
  contentHash
}
~~~

### 10.3. DefinitionClaim

~~~js
{
  schema: 'meridian.definition-claim/1',
  definitionId,
  term: EntityRef,
  genus: EntityRef,
  differentiae: ClaimRef[],
  polarity,
  modality,
  temporalScope,
  sourceSpanIds,
  projectorRef,
  projectionConfidence,
  contentHash
}
~~~

Projection confidence отражает качество разбора, а не истинность определения.

### 10.4. ContinuationMove

~~~js
{
  schema: 'meridian.continuation-move/1',
  moveId,
  moveType,
  targetRefs,
  gapRef,
  prerequisites,
  sourceCandidateRefs,
  hardCheckResults,
  softFeatures,
  state: 'PROPOSED' | 'REJECTED' | 'PARKED' | 'REVIEW_QUEUE',
  reasonCodes,
  contentHash
}
~~~

### 10.5. SemanticCheckpoint

~~~js
{
  schema: 'meridian.semantic-checkpoint/1',
  checkpointId,
  parentHash,
  graphHash,
  sourceSetHash,
  policyHash,
  budgetSnapshot,
  acceptedReceiptHashes,
  rejectedReceiptHashes,
  contentHash
}
~~~

### 10.6. MergeMap и SplitMap

~~~js
{
  schema: 'meridian.claim-transform-map/1',
  operation: 'MERGE' | 'SPLIT',
  inputClaimRefs,
  outputClaimRefs,
  spanCoverage: [{
    outputRef,
    inputRef,
    sourceSpanIds,
    preservedFields
  }],
  lostFields,
  roundTripStatus,
  contentHash
}
~~~

Если lostFields не пуст для hard field, операция отклоняется.

### 10.7. RecyclingDecision

~~~js
{
  schema: 'meridian.recycling-decision/1',
  itemRef,
  operation: 'KEEP' | 'LINK' | 'MERGE' | 'SPLIT' |
             'VERIFY' | 'CONTRADICT' | 'PARK' |
             'QUARANTINE' | 'DISCARD_DUPLICATE',
  targetRefs,
  provenanceMapRef,
  reasonCodes,
  authority: 'ROUTING_ONLY',
  contentHash
}
~~~

## 11. Конечный автомат

~~~text
RECEIVED
  -> PRESERVED
  -> TRANSCRIPT_REVIEW
  -> NORMALIZED
  -> MORPH_ANALYZED
  -> CLAIM_PROJECTED
  -> SOURCE_DISCOVERED
  -> STRUCTURE_ALIGNED
  -> LATTICE_BUILT
  -> HARD_GATED
  -> COUNTERSEARCHED
  -> REALIZED
  -> REPLAYED
  -> REVIEW_QUEUE
  -> COMMITTED
~~~

Боковые выходы:

~~~text
TRANSCRIPT_REVIEW -> CLARIFY
MORPH_ANALYZED    -> OOV
CLAIM_PROJECTED   -> AMBIGUOUS
SOURCE_DISCOVERED -> PARKED
HARD_GATED        -> REJECTED -> ROLLBACK
COUNTERSEARCHED   -> CONFLICT -> REVIEW_QUEUE
REPLAYED          -> UNSUPPORTED -> ROLLBACK
any bounded stage -> BUDGET_EXHAUSTED -> ABSTAIN
~~~

Каждый переход имеет input hash, output hash, reason code, policy version и receipt.

## 12. Морфология и DefinitionClaim projector

Провал внешнего holdout показал две разные проблемы:

1. поверхностные формы не дают достаточный lexical recall;
2. найденное естественное определение не преобразуется в текущий контролируемый predicate frame.

Поэтому нельзя лечить всё расширением одного словаря. Нужны два модуля:

### 12.1. DeterministicMorphologyAdapter

Контракт возвращает для токена упорядоченный набор:

~~~text
surface, lemma, POS, grammatical features, providerRef, ruleRef
~~~

Требования:

- одинаковый вход и provider version дают одинаковый результат;
- неоднозначность сохраняется;
- неизвестная форма не получает выдуманную лемму;
- имена, числа, отрицания и единицы защищены;
- provider можно заменить без изменения Claim IR;
- development corpus отделён от frozen holdout v1.

### 12.2. DefinitionClaimProjector

Первый набор конструкций:

~~~text
X - это Y
X является Y
X называется Y
под X понимается Y
X представляет собой Y
X - Y, который Z
~~~

Проектор извлекает term, genus, differentiae и qualifiers. Если несколько разборов равноправны, возвращается AMBIGUOUS.

## 13. Алгоритм осмысленного продолжения

~~~text
function continueMeaningfully(task, sourceSnapshot, policy, budget):
    input = preserveRawInput(task.input)
    transcript = buildTranscriptLattice(input)

    if transcript.hasUnconfirmedProtectedToken:
        return CLARIFY(transcript)

    morph = analyzeMorphology(transcript.selectedText)
    claims = projectTypedClaims(morph)

    if claims.status in {OOV, AMBIGUOUS}:
        return typedStop(claims.status, claims.issues)

    graph = buildClaimEvidenceGraph(claims, sourceSnapshot)
    gaps = deriveGenreGaps(task.genre, graph)
    moves = buildContinuationLattice(graph, gaps, policy)
    ranked = rankForReview(moves)

    checkpoint = createCheckpoint(graph, policy, budget)

    for move in ranked within budget:
        if violatesHardConstraints(move, graph):
            recordRejected(move, HARD_CONSTRAINT)
            continue

        evidence = discoverEvidence(move, sourceSnapshot)
        if move.isFactual and evidence.isInsufficient:
            recordParked(move, MISSING_EVIDENCE)
            continue

        draft = realizeFromTypedMove(move, evidence)
        replay = parseAndReplayThroughAG4(draft, evidence)
        counter = boundedCountersearch(draft, sourceSnapshot)

        if replay.hasUnsupportedAtom:
            rollback(checkpoint, move, UNSUPPORTED_ATOM)
            continue

        if counter.hasUnresolvedHardConflict:
            return REVIEW_QUEUE(draft, replay, counter, checkpoint)

        return REVIEW_QUEUE(draft, replay, counter, checkpoint)

    return ABSTAIN(
        reasons = collectedReasons(),
        nextQuestions = questionsDerivedFromGaps(gaps)
    )
~~~

## 14. Жёсткие и мягкие ограничения

### 14.1. Жёсткие

- каждый фактический атом имеет source span;
- polarity не меняется;
- modality не усиливается;
- MAY не превращается в MUST;
- SOME не превращается в ALL;
- время и единицы не меняются;
- разные сущности не сливаются без entity resolution;
- цитата не перефразируется как прямая;
- branch не превышает budget;
- provenance graph остаётся ацикличным;
- review-only authority сохраняется.

### 14.2. Мягкие

- тематическая близость;
- связность с предыдущим абзацем;
- новизна;
- длина;
- жанровый стиль;
- разнообразие типа хода;
- число переходов до закрытия пробела;
- удобство чтения.

Пример ранжирования:

~~~text
rank =
    0.25 * relevance
  + 0.20 * coherence
  + 0.20 * gapClosure
  + 0.15 * novelty
  + 0.10 * moveDiversity
  + 0.10 * reviewEconomy
  - lossPenalty
  - ambiguityPenalty
~~~

Весовые значения являются начальными настройками эксперимента. Evidence completeness не включается как компенсируемый балл: для factual move это hard gate.

## 15. Откат, центральная ветвь и защита от циклов

~~~text
function explore(checkpoint, candidates, visited):
    for candidate in candidates:
        attemptHash = hash(checkpoint, candidate)

        if attemptHash in visited:
            reject(candidate, REPEATED_STATE)
            continue

        visited.add(attemptHash)
        receipt = execute(candidate)

        if receipt.status == ACCEPTABLE:
            return childCheckpoint(checkpoint, receipt)

        appendRejectionReceipt(receipt)
        restore(checkpoint)

    if checkpoint.parentHash exists:
        return rollbackToParent(checkpoint)

    return ABSTAIN(NO_ADMISSIBLE_BRANCH)
~~~

Backbone обновляется только после review. Отклонённая ветвь не удаляется: она помогает не повторять тупик и объясняет решение.

## 16. Ветка информационного ресайклинга

### 16.1. Входной конвейер

~~~text
source item
 -> immutable snapshot
 -> segmentation
 -> claim extraction
 -> duplicate candidate search
 -> relation analysis
 -> routing decision
 -> review queue
~~~

### 16.2. Операции

| Операция | Когда применять | Что сохранить |
|---|---|---|
| KEEP | уникальный релевантный claim | source span и role |
| LINK | новый контекст к существующему claim | typed edge |
| MERGE | совместимые атомы дают сводный тезис | coverage matrix |
| SPLIT | сложный claim содержит независимые части | parent map |
| VERIFY | доказательств недостаточно | open requirement |
| CONTRADICT | найден несовместимый claim | обе версии и scopes |
| PARK | сейчас нет бюджета или данных | reason and resume token |
| QUARANTINE | повреждённый или недоверенный input | raw snapshot |
| DISCARD_DUPLICATE | точный дубль той же версии | canonical target |

DISCARD не применяется к неудобному мнению, неизвестному факту или меньшинству источников.

### 16.3. Backpressure

Очереди разделяются:

- transcription review;
- OOV/ambiguity;
- source verification;
- contradiction review;
- merge/split review;
- ready-to-realize;
- publication review.

Новая работа ограничивается capacity каждой очереди. Нагрузка влияет на scheduling, но не на semantic verdict.

## 17. Новостной профиль

NewsClaim расширяется полями:

~~~text
eventTime
reportTime
sourceTime
actor
action
object
location
attribution
quoteStatus
temporalStatus = NEW | UPDATE | CORRECTION | RETRACTION
~~~

Правила:

1. новая публикация не обязательно является новым событием;
2. перепечатки одного сообщения образуют одно provenance family;
3. исправление и опровержение не удаляют старую версию;
4. отсутствие реакции стороны формулируется как open gap, а не как отказ стороны;
5. последний источник не автоматически самый надёжный;
6. summary сохраняет различие между фактом, заявлением и интерпретацией.

## 18. Научный профиль

ResearchClaim хранит:

~~~text
claimType = BACKGROUND | METHOD | RESULT | LIMITATION |
            INTERPRETATION | HYPOTHESIS
population
interventionOrMethod
comparison
outcome
scope
sourceLocator
~~~

Для диссертации P78 строит:

- карту вопроса и подтезисов;
- evidence matrix;
- карту методов и выборок;
- список несовместимых результатов;
- missing-premise queue;
- reversible outline;
- citation packet с точным locator;
- журнал того, какие источники были слиты в каждый абзац.

Автоматически запрещено заявлять достаточность обзора, новизну, корректность статистики или отсутствие плагиата без отдельного специализированного процесса и решения человека.

## 19. Голосовая диктовка

### 19.1. Защищённые категории

Обязательное подтверждение требуется при низкой уверенности для:

- «не», «ни», «без»;
- чисел, дат и процентов;
- фамилий и названий;
- единиц измерения;
- идентификаторов источников;
- терминов вне словаря;
- границ цитаты.

### 19.2. Псевдокод

~~~text
function normalizeDictation(raw, asrAlternatives):
    lattice = preserveAlternatives(raw, asrAlternatives)
    protected = detectProtectedTokens(lattice)

    for token in protected:
        if token.confidence < policy.threshold:
            token.confirmation = UNRESOLVED

    suggestions = applyReversibleRules(lattice)
    return {
        raw,
        lattice,
        suggestions,
        status: hasUnresolvedProtected(lattice) ? CLARIFY : READY
    }
~~~

Исправление «урок барбур» в «уроборос» допустимо как suggestion, но не как silent rewrite.

## 20. Многоагентная работа

Рекомендуемые независимые роли:

| Роль | Выход | Не имеет права |
|---|---|---|
| transcription worker | TranscriptLattice | принимать факт |
| morphology worker | analyses | скрывать ambiguity |
| claim projector | typed claims | искать удобный источник |
| retrieval worker | passages | ставить SUPPORTS |
| structural matcher | relation candidates | публиковать |
| countersearch worker | conflicts and qualifiers | отклонять по голосованию |
| realizer | draft | добавлять factual atoms |
| audit worker | invariant report | менять результат |

Схема исполнения:

~~~text
WorkSpec -> WorkAttempt(epoch, lease) -> WorkReceipt
          -> deterministic reducer -> ReviewPacket
~~~

Нужны idempotency, fencing, retry cap, stale receipt rejection и permutation tests. Большинство агентов не равно истине.

## 21. Интерфейс P78

### 21.1. Семантическое кольцо

- угол показывает move type или stage;
- радиус показывает гранулярность;
- цвет показывает только enum state;
- толщина линии может показывать queue load;
- стрелка назад показывает rollback;
- пунктир показывает proposed, но не accepted relation;
- источник открывается из каждого factual atom;
- таблица остаётся доступной альтернативой графике.

### 21.2. Звуковой слой

- выключен по умолчанию;
- не влияет на вычисление;
- имеет общий регулятор громкости и mute;
- не использует непрерывный звук в состоянии idle;
- дублируется текстом и визуальным state;
- проверяется на раздражение, различимость и доступность.

### 21.3. Принцип честного движения

Анимация ускоряется только при реальных событиях очереди. В idle она либо останавливается, либо явно помечается как декоративная. Один полный оборот не означает один новый факт.

## 22. Безопасность, приватность и этика

1. Аудио не сохраняется без явной политики retention.
2. Raw transcript не отправляется внешнему provider без согласия.
3. Личные данные получают отдельный redaction layer до индексации.
4. Source text считается недоверенным вводом и не может давать инструкции runtime.
5. HTML и визуальные labels не имеют semantic authority.
6. Религиозные и культурные метафоры не маркируют людей, идеи или источники как «чистые» и «нечистые».
7. QUARANTINE означает техническое состояние ввода, а не оценку автора.
8. Удаление выполняется по retention policy, а не скрытым DISCARD.
9. Научные и юридические выводы всегда требуют профильного human review.
10. Все автоматические преобразования экспортируются как diff и provenance map.

## 23. Метрики и проверки

### 23.1. Язык

- lemma accuracy на development set;
- protected-token preservation;
- DefinitionClaim exact field accuracy;
- OOV recall;
- ambiguity calibration;
- parse coverage.

### 23.2. Retrieval и relations

- lexical gold passage recall;
- candidate gold passage recall;
- candidate passage precision;
- relation macro-F1;
- contradiction recall;
- provenance completeness.

### 23.3. Продолжение

- Unsupported Assertion Rate;
- hard constraint violations;
- Continuation Acceptance в слепом сравнении;
- relevance и coherence;
- gap closure;
- diversity by move type;
- abstention precision;
- среднее число rollback до reviewable candidate.

### 23.4. Merge/Split

- round-trip recovery;
- condition preservation;
- orphan fragment rate;
- generalization loss;
- source locator recovery;
- число скрытых конфликтов.

### 23.5. Runtime

- deterministic replay;
- hash equality при permutation источников;
- stale receipt rejection;
- queue latency;
- budget compliance;
- frame time отдельно от semantic latency.

## 24. Критерии допуска AG5

AG5 нельзя подключать только потому, что интерфейс умеет показать lattice. Минимальный gate:

1. новый blind holdout v2 не использовался для настройки;
2. candidate gold passage recall достигает заранее зафиксированного порога;
3. candidate passage precision вычисляется и проходит порог;
4. relation macro-F1 проходит порог;
5. provenance completeness равна 1;
6. unsupported factual atoms равны 0 на критическом наборе;
7. protected negation/number/entity cases проходят полностью;
8. authority violations равны 0;
9. каждый generated atom проходит source replay;
10. интерфейс оставляет решение в REQUIRES_REVIEW.

Пороги должны быть заморожены до blind run. Holdout v1 после изучения ошибок остаётся regression set, но больше не является независимым доказательством.

## 25. Поэтапная реализация

### Этап D1. Development corpus

- собрать отдельный набор коротких русских определений;
- разметить token morphology, DefinitionClaim fields и exact passages;
- отделить source families от holdout v1;
- добавить отрицания, числа, имена и неоднозначные определения;
- зафиксировать лицензии и хеши.

**Выход:** development fixture и evaluator без изменения frozen v1.

### Этап D2. Deterministic morphology

- создать provider-neutral adapter;
- реализовать минимальный встроенный слой для форм корпуса;
- сохранять все допустимые анализы;
- добавить protected-token policy;
- тестировать stale provider version.

**Выход:** MorphAnalysisResult, а не автоматически принятый claim.

### Этап D3. DefinitionClaim projector

- реализовать шесть конструкций определения;
- построить typed DefinitionClaim;
- сопоставить его с существующим Claim AST;
- вернуть OOV/AMBIGUOUS fail-closed;
- проверить development set.

**Выход:** естественное определение может попасть в структурный matcher.

### Этап D4. Continuation lattice

- определить шесть Move types;
- вывести gap из жанровой схемы;
- реализовать hard gates;
- ранжировать только прошедшие варианты;
- отдавать explainable ReviewPacket.

**Выход:** несколько содержательных следующих ходов, пока без свободной генерации.

### Этап D5. Controlled realizer

- строить предложения из typed move и source claims;
- сохранять polarity, modality, quantifier и qualifiers;
- повторно парсить собственный результат;
- прогонять AG4 replay и countersearch;
- откатывать unsupported draft.

**Выход:** source-bound предложение в REVIEW_QUEUE.

### Этап D6. Reversible merge/split

- ClaimTransformMap;
- coverage matrix;
- round-trip test;
- UI diff;
- научный mini-corpus.

### Этап D7. Recycling stream

- ingestion queues;
- KEEP/LINK/MERGE/SPLIT/VERIFY/CONTRADICT/PARK;
- backpressure;
- news temporal profile;
- research evidence matrix.

### Этап D8. Blind holdout v2

- заморозить до финальной настройки;
- запустить один основной evaluation;
- опубликовать все failures;
- только после gate решить вопрос о disconnected AG5 evaluator.

### Этап D9. Визуальные и звуковые эксперименты

- дерево, архипелаг, уроборос и муравьи как skins;
- sonification;
- accessibility baseline;
- user study против нейтральной таблицы;
- никакой обратной связи из skin в semantic classifier.

## 26. Рекомендуемые новые модули

~~~text
prototype/lib/p78-input-envelope.js
prototype/lib/p78-transcript-lattice.js
prototype/lib/p78-morphology-adapter.js
prototype/lib/p78-definition-claim.js
prototype/lib/p78-definition-projector.js
prototype/lib/p78-genre-gap-detector.js
prototype/lib/p78-continuation-lattice.js
prototype/lib/p78-continuation-gates.js
prototype/lib/p78-controlled-realizer.js
prototype/lib/p78-semantic-checkpoint.js
prototype/lib/p78-claim-transform-map.js
prototype/lib/p78-recycling-router.js
prototype/lib/p78-review-packet.js
~~~

Правило зависимостей:

~~~text
input/transcript
  -> morphology
  -> definition projector
  -> existing Claim IR
  -> existing AG4 evidence cascade
  -> gap detector
  -> continuation lattice
  -> gates
  -> controlled realizer
  -> AG3/AG4 replay
  -> review packet
~~~

Новый модуль не импортирует DOM. View импортирует только immutable frame.

## 27. Минимальные мнемоники

Для детского или учебного режима:

~~~text
Взяли - разобрали - нашли - связали - проверяем.
Не нашли - не выдумываем.
Слил - сохрани различия.
Разбил - сохрани родителей.
Застрял - вернись к развилке.
Факт - источник - условие - вывод.
~~~

Эти строки являются интерфейсной памяткой. Они не входят в scoring.

## 28. Итоговое решение

P78 уже имеет технически строгий review-only контур, но естественное русское продолжение действительно остаётся ранней экспериментальной частью. Перепрыгивать сразу к свободному генератору нельзя: внешний holdout показал нулевой candidate recall на естественных определениях.

Следующий принципиальный этап должен быть узким и проверяемым:

> raw text -> deterministic morphology -> DefinitionClaim -> source-backed graph -> typed continuation lattice -> controlled realization -> AG4 replay -> human review.

Исторические, религиозные и фантастические образы полезны, когда они порождают конкретный алгоритм:

- дерево даёт branching;
- уроборос даёт checkpoint/rollback;
- схоластический вопрос даёт thesis/objection/reply;
- картотека даёт claim-level provenance;
- мантра даёт мнемонику и duplicate detection;
- муравьи дают scheduling diagnostics;
- ДНК даёт разделение Claim AST и формулировки;
- таблица умножения даёт typed operator composition;
- жидкость даёт queues, backpressure и barriers.

Главный инвариант остаётся простым: форма помогает увидеть работу, но содержание допускают только типы, источники, ограничения, replay и человек.

## 29. Дополнительное уточнение: двойное вращение и асимметричная восьмёрка

В дополнительной диктовке поставлены новые вопросы:

27. Должна ли частица одновременно двигаться по общей орбите и вращаться вокруг собственной оси?
28. Возникает ли из такого двойного движения восьмёрка автоматически?
29. Как построить непрерывную восьмёрку с двумя сильно неравными лепестками?
30. Может ли один лепесток стремиться к центру обобщения, а второй - к краю детализации?
31. Является ли восьмёрка технически легче или содержательнее окружности?
32. Должен ли двухлепестковый цикл стать базовой константой P78?
33. Нужны ли трилистники, четырёхлистники и более высокие гармоники?
34. Как связать ритм траектории с ударными, духовыми, струнными и металлическими инструментами?
35. Какие элементы грамматики и пунктуации соответствуют этим четырём музыкальным слоям?
36. Как представить тезис и антитезис, действие и противодействие без ухода в крайности?
37. Что можно перенести из сопротивления материалов и строительной механики?
38. Что можно перенести из логистики и конвейерного производства?
39. Как построить промежуточный язык между естественным языком и языком программирования?
40. Как хранить смысл в карточках разного масштаба?
41. Какие библиотечные и библиографические метаданные нужны карточкам?
42. Как превратить «воронку продаж» в проверяемую информационную воронку?
43. Может ли «семантический торнадо» принимать большой поток, сортировать его и направлять в темы?
44. Что именно считать хорошим выходом такого конвейера?
45. Как сохранить исходную диктовку и не принять ошибку распознавания за термин?

В диктовке выражение «биографии из библиотечного отдела» вероятнее всего означает «библиографические данные», а «очипятки» - «опечатки». Обе нормализации должны храниться как предположения, пока пользователь их не подтвердил. Упоминание будущей ссылки на репозиторий о «крюках» фиксируется как pending reference; без самой ссылки нельзя приписывать ему конкретный алгоритм.

## 30. Ответы на вопросы о геометрии

### Вопрос 27. Орбита и вращение вокруг собственной оси

Да, это две разные переменные:

~~~text
orbitPhase - положение центра частицы на общей траектории;
bodyPhase  - ориентация самой частицы;
~~~

В текущем runtime P78 свойство spin прибавляется к изменению p.th и поэтому является поправкой к орбитальной скорости. Оно не передаётся в Canvas rotate при рисовании обычной частицы. Следовательно, визуального вращения вокруг собственной оси сейчас нет.

Для нового режима нужны отдельные поля:

~~~js
{
  orbitPhase,
  orbitVelocity,
  localPhase,
  localVelocity,
  bodyPhase,
  bodyVelocity
}
~~~

Круглая точка не показывает body spin. Нужен направленный glyph: короткая риска, сектор, треугольник, стрелка или асимметричная частица. Форма при этом кодирует роль, а угол - только ориентацию.

### Вопрос 28. Следует ли восьмёрка из аналогии с планетой?

Нет, не автоматически. Планета вращается вокруг оси и движется по орбите, но траектория точки на её поверхности в инерциальной системе обычно является сложной волнистой или трохоидальной кривой, а не обязательной восьмёркой.

Восьмёрка должна быть явным выбранным display contract. Это делает модель честнее: она показывает чередование двух операций, а не выдаёт художественный образ за закон небесной механики.

### Вопрос 29. Формула неравной восьмёрки

Для базового эксперимента подходит деформированная лемниската Жероно:

~~~text
s(phi) = 1 + kappa * sin(phi)

x(phi) = A * s(phi) * sin(phi)
y(phi) = B * s(phi) * sin(phi) * cos(phi)

-1 < kappa < 1
~~~

При kappa = 0 лепестки равны. При положительном kappa лепесток с sin(phi) > 0 увеличивается, противоположный уменьшается. При kappa, стремящемся к 1, малый лепесток стремится к точке, но ровно kappa = 1 использовать нельзя: геометрия вырождается и визуальный объект может исчезнуть.

Практический предел:

~~~text
abs(kappa) <= 0.88
s(phi) >= epsilon
epsilon = 0.12
~~~

Оценка отношения площадей или визуального масштаба растёт приблизительно как:

~~~text
lobeRatio ~ ((1 + abs(kappa)) / (1 - abs(kappa)))^2
~~~

Это диагностическая оценка, а не точная семантическая мера.

### Вопрос 30. Как направить лепестки к двум границам

Локальная восьмёрка строится в касательно-нормальной системе общей орбиты:

~~~text
anchor(theta) =
    center + orbitRadius * [cos(theta), sin(theta)]

tangent(theta) = [-sin(theta), cos(theta)]
normal(theta)  = [ cos(theta), sin(theta)]

position =
    anchor(theta)
  + tangent(theta) * x(phi)
  + normal(theta)  * y(phi)
~~~

Normal component может быть ориентирован так, чтобы один лепесток показывал движение к меньшей гранулярности, другой - к большей. Однако фактические координаты ограничиваются guard annulus и не пересекают 1D/3D границы.

### Вопрос 31. Легче ли восьмёрка окружности?

Математически обе кривые непрерывны и вычисляются дёшево. Восьмёрка не «легче» окружности:

- у неё есть самопересечение;
- меняется кривизна;
- при сильной асимметрии малый лепесток требует аккуратного численного ограничения;
- длинная трасса общей орбиты плюс локальная восьмёрка образует более сложную розетку.

Её преимущество не вычислительное, а выразительное: один цикл явно содержит две противоположные, но связанные фазы.

### Вопрос 32. Два лепестка как базовая константа

Рекомендуется сделать двухлепестковый цикл базовым **семантическим ритмом**, но не единственной экранной траекторией:

~~~text
лепесток A: EXPAND / SPLIT / FIND DETAIL
перешеек: VERIFY / REVIEW / CHECKPOINT
лепесток B: MERGE / SUMMARIZE / CONNECT
перешеек: COUNTERSEARCH / COMMIT OR ROLLBACK
~~~

Это не бинарная истина. Оба лепестка являются необходимыми видами работы.

### Вопрос 33. Высшие лепестки

Три-, четырёх- и пятичастные траектории можно получить гармониками или кривыми Лиссажу, но для MVP они не нужны. Дополнительный лепесток разрешён только тогда, когда он имеет отдельный типизированный смысл, например:

- evidence;
- counterevidence;
- synthesis;

Без такого контракта многолепестковая фигура остаётся декоративной и увеличивает когнитивную и Canvas-нагрузку.

## 31. Три режима траектории

### Режим A. ORBIT_SPIN

Частица движется по кольцу и поворачивается вокруг себя.

**Плюсы:** простота, хорошо читается кольцевая граница.  
**Минусы:** не показывает чередование split/merge.  
**Назначение:** основной стабильный режим.

### Режим B. ROLLING_LEMNISCATE

Центр локальной восьмёрки движется по кольцу, а частица проходит два лепестка вокруг этого центра.

**Плюсы:** сохраняет кольцо и показывает двойной цикл.  
**Минусы:** длинный trace визуально сложен; нужен короткий хвост и ограничение амплитуды.  
**Назначение:** рекомендуемый эксперимент.

### Режим C. SEMANTIC_LEMNISCATE

Всё рабочее поле становится одной асимметричной восьмёркой.

**Плюсы:** максимально ясны два полюса и checkpoint в пересечении.  
**Минусы:** теряется исходный образ кольцевой жидкости и возникают вопросы о прохождении через центр.  
**Назначение:** отдельный сравнительный prototype, не замена P78 по умолчанию.

## 32. Откуда берётся асимметрия

Размер лепестка нельзя вычислять из истины или ценности идеи. Он отражает объём ещё не выполненной работы.

~~~text
generalizationPressure =
    mergeCandidates
  + repeatedClaims
  + disconnectedTopicClusters

detailPressure =
    undefinedTerms
  + unsupportedClaims
  + missingExamples
  + unresolvedQualifiers

rawAsymmetry =
    (generalizationPressure - detailPressure)
  / max(1, generalizationPressure + detailPressure)

kappa = clamp(rawAsymmetry, -0.88, 0.88)
~~~

Если большой лепесток соответствует обобщению, это означает «очередь операций обобщения велика», а не «обобщение правильнее». При смене очередей знак kappa меняется.

Hard guards:

~~~text
smallLobeScale >= 0.12
generalizationLoss <= thresholdGeneralization
orphanFragmentRate <= thresholdFragmentation
provenanceCompleteness = 1 for factual output
~~~

При нарушении guard траектория не выходит в 1D или 3D. Она показывает ASYMMETRY_LIMIT, выполняет rollback и уменьшает шаг.

## 33. Действие и противодействие

Физические слова «центростремительная» и «центробежная сила» допустимы только как display analogy. В semantic core используются:

~~~text
inwardPressure  = demand for merge/generalization
outwardPressure = demand for split/detail
restoringTerm   = return toward safe annulus
damping         = suppression of repeated oscillation
~~~

Если нужен действительно физический визуальный слой, можно использовать управляемый осциллятор:

~~~text
u'' + c*u' + k*(u - u_safe)
    = outwardPressure - inwardPressure
~~~

Здесь u - экранная гранулярность. Уравнение не определяет смысл и не принимает решение. semantic state вычисляется до визуальной динамики.

## 34. Четыре музыкальных слоя

Пользователь предложил ритм ударных как основу, поверх которой работают духовые, струнные и металлические или колокольные инструменты. Для P78 это можно перевести так:

| Музыкальный слой | Языковой слой | Семантическая функция | Примеры |
|---|---|---|---|
| ударные | пунктуация и конечный автомат | границы, такты, commit points | точка, запятая, двоеточие, вопрос |
| духовые | дыхание, просодия и discourse flow | модальность, переход, продолжение голоса | возможно, однако, поэтому |
| струнные | синтаксические и дальние связи | dependency, coreference, согласование | субъект-предикат, анафора |
| металл/колокола | точные якоря и предупреждения | citation, definition, number, conflict | ссылка, имя, дата, OOV |
| тишина | отсутствие допустимого содержания | PARKED, ABSTAIN или idle | явная пауза |

### 34.1. Ударные и пунктуация

| Знак | Ритмическая роль | Машинная интерпретация |
|---|---|---|
| точка | конец такта | sentence checkpoint |
| запятая | слабая доля | локальная зависимость, не commit |
| точка с запятой | раздел внутри крупного такта | related independent claims |
| двоеточие | открытие следующего слоя | definition, explanation или list |
| тире | резкий мост | apposition или definition candidate |
| вопросительный знак | незавершённая каденция | explicit gap |
| скобки | тихая вставка | qualifier or aside |
| кавычки | смена тембра | exact quote boundary |

Знак препинания создаёт parse candidate, а не автоматически утверждает отношение.

### 34.2. Духовые

Духовой слой хранит discourse markers, modality и длину смыслового дыхания. Он помогает отличить продолжение причины от контраста и вероятности:

~~~text
потому что -> CAUSE candidate
поэтому    -> CONSEQUENCE candidate
однако     -> CONTRAST candidate
возможно   -> modality MAY
~~~

### 34.3. Струнные

Струна соединяет удалённые узлы. Её длина показывает distance in text, а натяжение - число непроверенных промежуточных зависимостей. Длинная связь требует явного entity resolution и не должна незаметно перескакивать между одноимёнными сущностями.

### 34.4. Колокольный слой

Колокол звучит редко и дискретно:

- найден exact source span;
- подтверждён термин;
- изменилось число или дата;
- найден конфликт;
- выполнен rollback;
- нужен human review.

Частый звон теряет диагностическую ценность, поэтому события дедуплицируются.

## 35. Сопротивление материалов как ограниченная аналогия

Из строительной механики полезны не физические формулы напрямую, а проверяемые принципы:

| Строительный принцип | Семантический перевод |
|---|---|
| load path | каждый вывод имеет путь до premises и sources |
| опора | evidence span поддерживает конкретный claim |
| узел соединения | typed relation с проверенными ролями |
| совместимость материалов | output type оператора подходит input type следующего |
| концентрация напряжений | один passage поддерживает слишком много разных выводов |
| потеря устойчивости | длинная цепь предположений без промежуточной проверки |
| усталость | многократные paraphrase/merge накопили semantic loss |
| запас | альтернативный независимый source или reversible checkpoint |

Диагностические метрики:

~~~text
sourceConcentration =
    maxClaimsSupportedByOneSourceFamily
  / max(1, supportedClaimCount)

inferenceSlenderness =
    longestUnreviewedDependencyChain

transformFatigue =
    1 - product(conditionPreservation_i)
~~~

Это не расчёт прочности текста. Если метрика высока, система открывает review task.

## 36. Логистическая модель

Каждая смысловая единица получает «накладную»:

~~~text
origin
destination topic
content hash
source version
operation permissions
current queue
dependencies
review status
retention policy
~~~

Соответствия:

| Логистика | P78 |
|---|---|
| посылка | InputPacket или Claim |
| накладная | manifest and provenance |
| склад | PARKED queue |
| сортировочный центр | RecyclingRouter |
| консолидация | reversible MERGE |
| разукомплектование | source-bound SPLIT |
| контроль веса | budget and size limits |
| таможня | source trust and policy gate |
| возврат отправителю | CLARIFY или ROLLBACK |
| маршрут | typed dependency chain |

Маршрут оптимизирует latency и review cost, но не истинность.

## 37. Промежуточный язык: Semantic Card DSL

Нужен язык, который человек может читать, а машина - однозначно проверять:

~~~text
CARD claim:orbit-motion
TYPE FACT
SUBJECT particle
PREDICATE moves
OBJECT orbit
WHEN scope=mechanics
SOURCE wikipedia-orbit#sentence-0
MODALITY ASSERTED
POLARITY POSITIVE
NEXT {QUALIFY, EXAMPLE, COUNTERSEARCH}
~~~

Короткая запись:

~~~text
particle -[moves]-> orbit
  @source(wikipedia-orbit#sentence-0)
  ?next(QUALIFY | EXAMPLE | COUNTERSEARCH)
~~~

DSL не заменяет русский текст. Он является проверяемым промежуточным слоем между raw input, Claim AST и surface realization.

## 38. Карточки разных размеров

Размер карточки означает уровень представления, а не важность:

| Формат | Содержание | Аналог |
|---|---|---|
| TokenCard | слово, морфология, ASR alternatives | маленькая метка |
| ClaimCard | одно проверяемое утверждение | каталожная карточка |
| PassageCard | точный контекст источника | страница |
| ParagraphCard | несколько claims и coverage map | лист |
| TopicBoard | backbone, ветви и gaps | плакат |
| CorpusMap | clusters, sources, conflicts | большая карта |

Карточка большего размера агрегирует ссылки на малые, но не копирует и не скрывает их provenance.

### 38.1. Библиотечные и библиографические метаданные

SourceCard должна хранить:

~~~text
title
creator or organization
publication date
retrieval date
edition or revision
identifier
URL or local locator
language
document type
subjects
abstract supplied by source or clearly marked derived summary
rights and license
publisher
source family
exact passage locators
content hash
supersedes / correctedBy / retractedBy
~~~

Тематическая рубрика помогает маршрутизации, но не подтверждает содержание. Derived summary всегда отделён от исходного abstract.

## 39. Информационный торнадо и воронка

### 39.1. Почему нельзя «затягивать всё»

Неограниченный intake нарушает бюджеты, приватность и качество. Правильная система принимает всё только внутри объявленного source policy и capacity. При перегрузке применяется backpressure, а не скрытое удаление.

### 39.2. Перевод воронки продаж

Воронка продаж отбрасывает людей по вероятности покупки. Информационная воронка должна иметь другую цель: сохранить происхождение и выбрать следующий тип работы.

~~~text
CAPTURE
 -> PRESERVE
 -> NORMALIZE
 -> DEDUPLICATE
 -> EXTRACT CLAIMS
 -> ROUTE BY TOPIC AND ROLE
 -> VERIFY
 -> CONTRADICT / MERGE / SPLIT / PARK
 -> REALIZE CANDIDATE
 -> HUMAN REVIEW
 -> COMMIT OR ROLLBACK
~~~

Она не сужает поток до одного «победителя». На каждом уровне сохраняются parked, conflict и rejected-with-reason branches.

### 39.3. Tornado как scheduling skin

Визуальный торнадо может показывать:

- внешний широкий край - необработанный intake;
- спиральные дорожки - queues;
- сужение - повышение структурированности;
- боковые конверты - topic routing;
- перешеек - hard gates;
- выход - ReviewPacket;
- обратный поток - rollback or clarification.

Скорость вращения показывает throughput. Она не показывает важность новости.

## 40. Что является качественным выходом

Система не возвращает просто «хорошо». Выход типизирован:

| Статус | Результат |
|---|---|
| CONTINUATION_REVIEW | source-bound продолжение с refs и risks |
| TOPIC_PACKET | материал направлен в тему/ветку |
| MERGE_PROPOSAL | сводный тезис и coverage matrix |
| SPLIT_PROPOSAL | атомы и parent map |
| CONFLICT_PACKET | несовместимые claims, scopes и sources |
| NEEDS_SOURCE | конкретный gap и поисковый запрос |
| NEEDS_CLARIFICATION | неразрешённая диктовка или entity |
| PARKED | resume token и причина |
| DUPLICATE | canonical target |
| ABSTAIN | исчерпаны допустимые ходы |

Для CONTINUATION_REVIEW показываются:

~~~text
text
claim atoms
exact evidence spans
unsupported atom count
condition preservation
genre role filled
countersearch result
open conflicts
review decision
~~~

## 41. Полный восьмёричный конвейер

Два лепестка можно разложить на восемь тактов:

~~~text
Лепесток детализации
  1 CAPTURE
  2 SPLIT
  3 LABEL
  4 VERIFY

Перешеек A
  CHECKPOINT

Лепесток обобщения
  5 LINK
  6 MERGE
  7 REALIZE
  8 COUNTERSEARCH

Перешеек B
  REVIEW -> COMMIT or ROLLBACK
~~~

Это «восьмёричный» цикл по числу тактов, но не восьмеричная система счисления.

## 42. Псевдокод intake и маршрутизации

~~~text
function processInformationPacket(packet, policy, queues):
    raw = preserve(packet)
    transcript = normalizeWithAlternatives(raw)

    if transcript.hasProtectedAmbiguity:
        return route(CLARIFICATION_QUEUE, transcript)

    atoms = parseAndSplit(transcript)
    if atoms.status in {OOV, AMBIGUOUS}:
        return route(LANGUAGE_REVIEW_QUEUE, atoms)

    decisions = []

    for atom in atoms:
        duplicate = findExactOrVersionDuplicate(atom)
        if duplicate.exact:
            decisions.add(DISCARD_DUPLICATE(atom, duplicate.target))
            continue

        topics = classifyRoutingCandidates(atom)
        evidence = retrieveEvidence(atom, policy.sources)
        relation = alignStructure(atom, evidence)

        if evidence.missing:
            decisions.add(PARK(atom, NEEDS_SOURCE, topics))
        else if relation.conflicts:
            decisions.add(CONTRADICT(atom, relation, topics))
        else if relation.mergeCompatible:
            decisions.add(MERGE_PROPOSAL(atom, relation, topics))
        else:
            decisions.add(KEEP_AND_LINK(atom, evidence, topics))

    return immutableRoutingFrame(decisions, queues, policy)
~~~

## 43. План реализации графической восьмёрки

### Этап L1. Чистая математика

Создать отдельный модуль без DOM:

~~~text
p78-asymmetric-lemniscate.js
~~~

Функции:

~~~text
normalizeParameters
sampleLocalPoint
projectOnOrbitFrame
lobeMetrics
assertSafeAnnulus
~~~

Тесты:

- одинаковые параметры дают одинаковые samples;
- kappa = 0 даёт равные лепестки;
- изменение знака kappa меняет лепестки местами;
- путь замкнут;
- нет NaN и Infinity;
- smallLobeScale не ниже epsilon;
- sample count и budget ограничены.

### Этап L2. Независимый body spin

Добавить bodyPhase/bodyVelocity. Не переиспользовать существующее p.spin, пока оно влияет на p.th. Передавать orientation в paintParticle. Проверить направленные glyphs.

### Этап L3. Переключаемый trajectory mode

Добавить segmented control:

~~~text
ORBIT | ORBIT+SPIN | ASYMMETRIC-8
~~~

Режим не меняет semantic result, hashes Claim/Evidence и authority.

### Этап L4. Semantic adapter

Вычислять kappa только из диагностических очередей generalization/detail. Хранить numerator, denominator и reason codes. При отсутствии данных использовать kappa = 0 и NOT_COMPUTED, а не случайное значение.

### Этап L5. Browser/performance

Проверить Microsoft Edge через localhost:

- desktop и mobile;
- nonblank Canvas;
- непрерывность trace;
- видимость body spin;
- отсутствие пересечений UI;
- p95 frame time;
- Canvas call count;
- reduced-motion;
- screenshot and pixel variance;
- semantic hashes одинаковы во всех trajectory modes.

## 44. Решение о приоритете

Асимметричная восьмёрка является сильным следующим визуальным экспериментом, потому что она выражает чередование детализации и обобщения лучше простой окружности. Но она не устраняет главный semantic blocker - morphology и DefinitionClaim projection.

Поэтому ветви выполняются параллельно:

~~~text
Semantic critical path:
D1 corpus -> morphology -> DefinitionClaim -> continuation lattice -> replay

Visual side path:
L1 lemniscate math -> L2 body spin -> L3 optional mode -> browser perf
~~~

В main UI восьмёрка включается только после чистого математического модуля, visual tests и подтверждения, что режим не меняет semantic result. Основным содержательным ритмом можно уже считать два лепестка: «разобрать и проверить» плюс «связать и сформулировать», соединённые двумя checkpoints.

## 45. Уточнение границы: AG4.5 Natural Definition Bridge

Следующий semantic этап следует обозначить как AG4.5, а не AG5. Он строит мост между естественным русским определением и существующим review-only AG4, но ничего не генерирует.

Аудит текущего кода показывает:

1. Controlled Russian lexicon распознаёт перечисленные surface forms и не является общей морфологией.
2. Текущий linguistic parser ищет exact templates или один явный глагольный predicate.
3. Именные определения, тире, нулевая связка и номинализации не имеют отдельного projection path.
4. ClaimAst/1 хорошо защищает существующий predicate/roles contract, поэтому добавлять в него необязательные genus/differentia поля нельзя.
5. DefinitionClaim должен быть отдельной схемой с адаптером в совместимые Claim AST atoms.
6. Qualifier следующего IR должен иметь собственные span refs, а не только строковое значение.
7. Нынешний cascade replay эквивалентен повторному run и ещё не является отдельной квитанцией source replay.
8. Exact-parser сохраняется без ослабления, а natural-definition path подключается через router.

### 45.1. ReplayReceipt

~~~js
{
  schema: 'meridian.source-replay-receipt/1',
  replayId,
  moveRef,
  realizationRef,
  sourceSetHash,
  morphologyHash,
  projectorHash,
  policyHash,
  atomResults: [{
    atomRef,
    sourceSpanIds,
    parseStatus,
    relationCandidateRefs,
    hardCheckResults
  }],
  terminationReason,
  semanticTruth: false,
  finalStatus: 'ABSTAIN',
  reviewStatus: 'REQUIRES_REVIEW',
  contentHash
}
~~~

ReplayReceipt создаётся отдельным модулем. Простое повторение той же функции под другим именем не считается replay protocol.

### 45.2. Дополнительные Move types

К шести первым ходам добавляются операционные выходы:

- FIND_SOURCE;
- CLARIFY;
- OPEN_QUESTION;
- COMPARE_CONDITIONS;
- COUNTERSEARCH;
- ABSTAIN.

UNKNOWN запрещает factual continuation, но разрешает FIND_SOURCE, CLARIFY, OPEN_QUESTION и ABSTAIN.

### 45.3. Предлагаемые границы файлов AG4.5

~~~text
p78-russian-morphology-contracts.js
p78-russian-morphology-table.js
p78-russian-morphology.js
p78-definition-claim-ir.js
p78-definition-pattern-registry.js
p78-definition-claim-projector.js
p78-natural-russian-claim-adapter.js
p78-passage-claim-router.js
p78-source-replay.js
~~~

Continuation остаётся следующим слоем:

~~~text
p78-claim-graph-ir.js
p78-continuation-contracts.js
p78-continuation-lattice.js
p78-continuation-constraints.js
p78-continuation-ranker.js
p78-controlled-russian-realizer.js
p78-continuation-ledger.js
p78-continuation-engine.js
~~~

### 45.4. Размеры корпусов как варианты, а не доказательство

Для D1 разумный рабочий вариант - 180 предложений с source-level split, например 120 train и 60 development. Это оценка стоимости, а не магическое число. Сначала фиксируются типы конструкций и power analysis метрик, затем окончательный размер.

Blind holdout v2 должен быть существенно больше пилота v1. Вариант 300 задач подходит для более устойчивой оценки нескольких срезов, но его размер и confidence intervals нужно зафиксировать до запуска. Ни нечётность 300, ни любое другое количество не улучшает качество само по себе.

Главное правило AG4.5: рост coverage не оплачивается ослаблением OOV, ABSTAIN, provenance или authority gates.
