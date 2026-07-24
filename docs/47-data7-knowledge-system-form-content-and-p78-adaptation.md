# Data7 Knowledge System: форма, содержание и безопасная адаптация к P78

Статус: `EXTERNAL_REPORT_PAIR_CRITICAL_AUDIT_AND_ADAPTATION_SPEC`

Актуализация реализации: безопасный первый срез выполнен и описан в [docs/48](48-p78-data7-adapter-implementation.md). Реализация оказалась строже первоначального проекта: list-`ORBIT` не создаёт α-receipt, а `LINK_CANDIDATE` не создаёт AlphaEdge до полного evidence bundle.

Дата проверки: 2026-07-21.

Краткий вывод: `data7` содержит реальный исполняемый прототип графовой обработки знаний и полезный набор алгоритмических форм, но два итоговых отчёта противоречат друг другу по стадии готовности, а заявления о доказанной семантической корректности, промышленной готовности и проверенной научной новизне не подтверждаются рассмотренным кодом. Для P78 допустим перенос структур данных, маршрутизации, оптимизации порядка и обратимых черновых операций. Нельзя переносить численные самооценки, шаблонную «новизну», автоматическое удаление знаний или статус `100% complete` как доказательство качества.

Связанные локальные документы:

- [Один рычаг — пять систем](16-one-lever-five-systems.md);
- [Научное слияние и расщепление](30-scientific-synthesis-fission-fusion-spec.md);
- [Осмысленное продолжение и информационный ресайклинг](42-p78-meaningful-continuation-and-information-recycling-spec.md);
- [Ретроспектива P1-P80 и кластерный речной конвейер](44-p1-p80-retrospective-and-cluster-river-conveyor.md);
- [Девять семантических орбит и α-автомат](45-p78-nine-semantic-orbits-and-alpha-automaton.md);
- [Реализация контрактов девяти α-орбит](46-p78-alpha-orbit-contracts-implementation.md).

---

## 1. Что именно проверено

Проверка привязана к опубликованному состоянию репозитория `svend4/data7`:

```text
repository: svend4/data7
commit: fb665e7e40ef99e3bfcfa836ebb7a01735654627
```

Первичные источники:

1. [`KNOWLEDGE_SYSTEM_SUMMARY.md`](https://github.com/svend4/data7/blob/fb665e7e40ef99e3bfcfa836ebb7a01735654627/KNOWLEDGE_SYSTEM_SUMMARY.md), blob `957cfbf4094e1fe550e2170d6e6ec0cbd10fba98`, 680 строк.
2. [`KNOWLEDGE_SYSTEM_100_PERCENT_COMPLETE.md`](https://github.com/svend4/data7/blob/fb665e7e40ef99e3bfcfa836ebb7a01735654627/KNOWLEDGE_SYSTEM_100_PERCENT_COMPLETE.md), blob `95aa9e7bc35f0c5691dc6d35d9b33fa146a407ea`, 682 строки.
3. [`knowledge_transformer.py`](https://github.com/svend4/data7/blob/fb665e7e40ef99e3bfcfa836ebb7a01735654627/knowledge_transformer.py), blob `dc4af879844e1b7254c1bb409d1f4ad3095315d3`, 1288 строк.
4. [`knowledge_system_complete_demo.py`](https://github.com/svend4/data7/blob/fb665e7e40ef99e3bfcfa836ebb7a01735654627/knowledge_system_complete_demo.py), blob `544ed07c4d5af261cdaf5bb9a2f151c01e4c0813`, 265 строк.
5. [`knowledge_transformation_theory.md`](https://github.com/svend4/data7/blob/fb665e7e40ef99e3bfcfa836ebb7a01735654627/knowledge_transformation_theory.md), blob `0be151eb324c99ab6a22b455e7eb23946e560b41`, 991 строка.
6. [`dissertation_optimizer.py`](https://github.com/svend4/data7/blob/fb665e7e40ef99e3bfcfa836ebb7a01735654627/dissertation_optimizer.py), blob `5b1c3fe1114a19b87534511e78bc8cb2fa66ce3c`, 716 строк.

Аудит различает четыре типа свидетельств:

```text
DOCUMENT_CLAIM     — утверждение отчёта;
EXECUTABLE_FORM    — реально существующая структура или алгоритм;
DEMO_OBSERVATION   — поведение демонстрации без независимой проверки;
VALIDATED_RESULT   — воспроизводимый результат с тестом, корпусом и критерием.
```

Наличие `DOCUMENT_CLAIM` или `DEMO_OBSERVATION` не повышается автоматически до `VALIDATED_RESULT`.

---

## 2. Ответ на вопрос «форма или содержание»

### 2.1. `info1`: преимущественно метаформа

Методология `info1` отвечает на вопросы:

- на каком уровне абстракции находится артефакт;
- куда движется работа: обобщение, детализация или связывание;
- почему разрешён переход между уровнями;
- как соотносятся онтология, философия, закон, принцип, концепция, спецификация, шаблон, пример и код.

Это общая организационная форма. Она доменно нейтральна: тем же α-автоматом можно размечать программный проект, энциклопедию или диссертацию. Девять уровней не являются девятью жанрами текста и не определяют истинность содержания.

### 2.2. `data7`: техническая форма, направленная на гуманитарное содержание

`data7` совмещает два слоя:

| Слой | Классификация | Примеры |
|---|---|---|
| Граф, узлы, рёбра, сегменты, обход, PageRank, TSP, 2-opt, отжиг | техническая форма | `KnowledgeGraph`, `Concept`, `Relation`, оптимизаторы порядка |
| Диссертация, энциклопедическая статья, факт, определение, гипотеза, источник | гуманитарное/научное содержание | `DissertationDecomposer`, `WikiAggregator`, `WikiDecomposer`, `DissertationSynthesizer` |
| Метрики покрытия, связности, новизны, потери информации | смешанный оценочный слой | часть вычисляется, часть задана константами или прокси |
| Отчёты о готовности и научной значимости | метадокументация | два рассматриваемых Markdown-отчёта |

Поэтому неверны обе крайние классификации:

- «это только гуманитарная теория» — неверно, потому что существует исполняемый графовый и оптимизационный код;
- «это готовая семантическая машина» — неверно, потому что смысловые решения в важных местах основаны на простых шаблонах, константах и структурных прокси.

Точная формулировка: **`data7` — технический прототип преобразования документов, ориентированный на гуманитарные и научные жанры, но ещё не доказавший содержательную надёжность этих преобразований**.

### 2.3. Общее и частное

| Вопрос | `info1` | `data7` |
|---|---|---|
| Область применимости | общая методология артефактов | частный набор конвейеров для знаний и документов |
| Главная ось | уровень абстракции α | преобразование, порядок и компактность материала |
| Единица | артефакт любой природы | концепт, отношение, сегмент, факт, глава |
| Сильная сторона | явная навигация между уровнями | исполняемые структуры и оптимизаторы |
| Слабая сторона | сама не понимает содержание | структурные метрики часто выдаются за семантические |
| Роль в P78 | карта девяти орбит | поставщик черновых операторов внутри орбит |

---

## 3. Противоречие двух отчётов

Документы опубликованы с разницей примерно в один день, но описывают резко разные состояния.

| Проверяемый пункт | `KNOWLEDGE_SYSTEM_SUMMARY.md` | `KNOWLEDGE_SYSTEM_100_PERCENT_COMPLETE.md` | Вердикт аудита |
|---|---|---|---|
| Стадия реализации | реализация «в прогрессе» | система «100% complete» | конфликт статусов |
| Тесты отдельных частей | встречаются 50% и 0% | все тесты проходят | второй статус не вытекает из первого без журнала изменений |
| Реальные API | интеграция отмечена как незавершённая | всё операционно готово | требуется воспроизводимый интеграционный тест |
| Реальные данные | тестирование ещё нужно | заявлены реальные PhD/Wikipedia данные | корпус и протокол оценки не приложены к утверждению |
| Покрытие | незавершённая работа | заявлено 80–90% | нужен отчёт покрытия, а не декларация |
| Экспертная проверка | план/задача | заявлены domain experts | нет доступного протокола разметки и согласия экспертов |
| Production readiness | не следует из состояния | заявлена | не подтверждено кодовым аудитом |
| Финальный commit | работа продолжается | в конце ещё указан commit «to be created» | внутренняя несогласованность «100%» |

Это не доказывает, что второй документ ложен целиком. Это означает, что **его уровень доказательности недостаточен для переноса статуса в P78**. P78 должен импортировать только проверяемые конструкции, а не самооценку зрелости.

Запись зрелости для реестра:

```text
artifactId: DATA7_KNOWLEDGE_SYSTEM_REPORT_PAIR
status: PARTIALLY_ADAPTED_CONFLICTING_MATURITY_CLAIMS
implementation: REAL_EXECUTABLE_PROTOTYPE
semanticValidation: NOT_DEMONSTRATED
productionReadiness: NOT_DEMONSTRATED
authority: EXTERNAL_SELF_REPORT_ONLY
```

---

## 4. Что реально существует в коде

### 4.1. Полезное и исполняемое

В `knowledge_transformer.py` присутствуют реальные классы данных и операции:

- `Concept`, `Relation`, `Segment`, `Fact`;
- `KnowledgeGraph` с индексами, соседями, путями и центральностью;
- `DissertationDecomposer`;
- `WikiAggregator`;
- `WikiDecomposer`;
- `DissertationSynthesizer`;
- `KnowledgeRationalizer`.

В оптимизационной ветке действительно реализованы известные алгоритмы порядка. Проверенный публичный dispatcher `optimize()` предоставляет три метода: жадный маршрут, 2-opt и имитацию отжига. Генетический алгоритм и динамическое программирование перечислены в отчёте, но не подтверждены этим исполняемым маршрутом. Реальные три метода пригодны как `EXECUTABLE_FORM` для перестановки уже проверенных блоков.

Сильные стороны этой реализации:

1. Единицы материала представлены объектами, а не только строками.
2. Направленные расстояния допускают асимметричный переход между разделами.
3. Декомпозиция, агрегация, синтез и рационализация отделены как разные операции.
4. Граф позволяет хранить связи независимо от линейного порядка документа.
5. Оптимизаторы можно сравнивать на одной функции стоимости.

### 4.2. Где форма подменяет семантику

Кодовая проверка выявила следующие ограничения.

#### Идентичность и воспроизводимость

- В простом режиме кластер назначается как `hash(para[:50]) % 5`.
- Встроенный `hash()` Python меняется между процессами из-за hash randomization.
- Идентификаторы концептов, основанные на таком хеше, не обеспечивают content-addressed replay и теоретически допускают коллизии.

Для P78 это неприемлемо: одинаковый вход должен давать одинаковый artifact ID во всех процессах и запусках.

#### Извлечение концептов

- Кандидатами становятся главным образом слова с заглавной буквы.
- Определение создаётся шаблоном вида `Concept extracted from text: ...`.
- Новизна получает фиксированное значение `0.5`.
- Ссылки на источники могут оставаться пустыми.

Это `LEXICAL_HEURISTIC`, а не доказанное извлечение научного понятия.

#### Извлечение отношений

Совместное появление концептов в одном предложении превращается в `related_to` с заранее заданной силой. Совместная встречаемость полезна для кандидата связи, но не определяет тип, направление или истинность отношения.

#### Агрегация статьи

- Заголовок создаётся как `Generated Encyclopedia Article`.
- Параметр темы не управляет содержанием в достаточной мере.
- `target_length` не является реально enforced ограничением.
- Вывод может пересказывать заглушки-определения вместо источников.
- Получение ссылки ожидает `metadata['source_id']`, тогда как демонстрация передаёт `metadata={'title': ...}`; результатом становится `unknown`.

Следовательно, эта ветка не удовлетворяет P78-цепочке `SOURCE -> SOURCE_VERSION -> PASSAGE -> EVIDENCE -> CLAIM`.

#### Декомпозиция Wikipedia

- Используется небольшой набор английских регулярных выражений (`X is Y`, `X has Y`, `X causes Y`, `X used for Y`).
- Fallback назначает первый капитализированный фрагмент субъектом, а следующий длинный фрагмент объектом.
- Русская морфология, отрицание, модальность, область действия и атрибуция источника не разобраны.

Для русскоязычного P78 это может быть только генератор кандидатов с обязательным `ABSTAIN`, но не Claim AST projector.

#### Синтез диссертации

- «Пробелы исследования» выводятся из низкой центральности и отсутствующих рёбер.
- Оценки novelty/impact/feasibility строятся на константах и простых формулах.
- Заголовки предложений создаются шаблонами вроде `Advanced Study of X` и `Bridging X and Y`.
- Нет проверки новизны по внешнему корпусу и нет evidence gate.

Это хороший `IDEA_PROPOSAL_GENERATOR`, но не средство подтверждения научной новизны.

#### Рационализация

- `compression_target` сохраняется, но не управляет алгоритмом как жёсткое ограничение.
- Теоретическая граница epsilon или information loss не enforced.
- `coverage_preserved` считается после преобразования, а не используется как запрет операции.
- Число «удалённых избыточностей» может отражать найденные кандидаты, даже если режим покрытия сохранил отношения.
- Удаление дубликата концепта не гарантирует переноса его рёбер и может оставлять dangling references.
- Повторное использование объектов `Concept` с последующей мутацией `sources` может менять исходный граф.
- Для пустого или нулевого графа возможны деления на ноль.

Поэтому `KnowledgeRationalizer` должен быть источником предложений, а не автором необратимого commit.

### 4.3. Демонстрация не является тестом

`knowledge_system_complete_demo.py` использует короткие синтетические фрагменты об AI/ML. В шаге, описывающем оптимизацию, TSP-оптимизатор не вызывается, а результат задаётся константой `improvement = 45.0`. В демонстрации нет assertions и независимого gold corpus.

Правильная классификация:

```text
demo executable: YES
integration evidence: LIMITED
semantic benchmark: NO
production test: NO
```

---

## 5. Проверка теоретических утверждений

`knowledge_transformation_theory.md` полезен как исследовательская программа, но не как завершённое математическое доказательство.

1. Теорема о минимальной рационализации опирается на неформализованные `Essential_Content` и `Accessibility`; существование и единственность решения не установлены.
2. NP-трудность заявляется через редукцию от maximum independent set или Set Cover, но полного построения редукции нет.
3. Граница потери информации предполагает «правильную декомпозицию» и локальную потерю δ, не задавая проверяемых условий правильности.
4. Ожидаемая новизна сформулирована без вероятностной модели.
5. Колмогоровская сложность в общем случае невычислима; код использует структурные прокси графа, а не саму сложность.

Особенно важно ограничить тезис «эквивалентность TSP»:

- если уже известны все разделы и задана парная направленная стоимость соседства, поиск их порядка действительно TSP/Hamiltonian-path-like;
- полный синтез статьи или диссертации дополнительно включает иерархию, prerequisites, цитирование, допустимые пропуски, конфликт источников и сохранение смысла;
- следовательно, TSP решает **задачу порядка**, но не задачу истинности, полноты или научной ценности.

В терминах P78: TSP может исполнять `ORBIT` внутри одной α-орбиты. Сам по себе он не разрешает `GENERALIZE`, `SPECIALIZE` или semantic commit.

---

## 6. Что уже было адаптировано в MERIDIAN

Ответ на вопрос «применялось ли это раньше»: **да, применялось частично и преимущественно на уровне технической формы**.

| Идея `data7` | Локальная адаптация | Что изменено |
|---|---|---|
| TSP-подобный порядок | `prototype/p55-text-evolution.html` | `PAIR_SWAP_NOT_2_OPT`: отжиг реализован, но названный 2-opt меняет местами две фразы вместо разворота сегмента; случайность не записана для replay |
| Двунаправленный цикл knowledge transform | `prototype/p56-knowledge-cycle.html` | `NONDETERMINISTIC_TEMPLATE_DEMO`: ветви сведены в 2D-цикл, но гипотезы собираются из шаблонов через `Math.random()` |
| Rationalizer | `prototype/p70-rationalizer-gate.html` | `MODELLED_FACT_COVERAGE_GATE`: запрет действительно срабатывает до применения, но `I` равно числу заранее размеченных fact-chips, а merge модельно сохраняет 70% объединения |
| Сопоставление систем | [docs/16](16-one-lever-five-systems.md) | отмечены directed cognitive distance, self-reported результаты и отсутствие enforcement формулы |
| План обратного переноса | [docs/18](18-master-plan.md) | идеи разложены по независимым направлениям |
| Диссертация/энциклопедия | [docs/29](29-encyclopedic-semantic-ring-spec.md), [docs/30](30-scientific-synthesis-fission-fusion-spec.md) | добавлены claim-level provenance, source snapshots, evidence и human review |
| Осмысленное продолжение | [docs/42](42-p78-meaningful-continuation-and-information-recycling-spec.md) | добавлены morphology, DefinitionClaim, reversible moves и rollback |
| Кластерный конвейер | [docs/44](44-p1-p80-retrospective-and-cluster-river-conveyor.md) | введены `SemanticCluster`, `ProvenanceManifest`, `FlowReceipt` и bounded queue |

В runtime P78 нет прямого импорта TSP или `KnowledgeRationalizer` из `data7`. Его `semantic-core` косвенно развивает поиск пробелов, защитные гейты и несколько вариантов продолжения; source-backed документы 29, 30, 42 и 44 добавляют недостающие provenance, evidence и rollback. Реализованные α-контракты находятся рядом с этой веткой, но пока имеют статус `NOT_WIRED_TO_P78_SHELL`.

То есть P78 уже взял наиболее сильную часть `data7`: явные операции и оптимизацию формы. Он не перенёс слабую часть: константную новизну, заглушки определений, недетерминированные ID и необоснованный статус семантической полноты.

---

## 7. Почему точные документы не всплыли в предыдущем аудите

Это **реальный пропуск аудита источников**, хотя часть идей была найдена через код и старый docs/16.

Причины:

1. Последний аудит был ориентирован на линию P1-P80, Рамсея, речной конвейер и текущий блокер AG4/AG5, а не на полный filename-level inventory `data7`.
2. `docs/16` уже сжал `data7` до TSP, Rationalizer и двунаправленного конвейера. Последующий поиск ошибочно счёл внешний источник «уже обработанным».
3. Поиск по понятиям приводил к P55/P56/P70 и локальным спецификациям, а не к двум статусным отчётам с близкими названиями.
4. Приоритет отдавался исполняемому коду, поэтому противоречие двух self-report документов отдельно не было зарегистрировано.
5. Репозиторий `data7` содержит много последующих и тематически иных подсистем; отсутствовал явный `SourceLedger`, связывающий внешний файл, commit, локальную адаптацию и незакрытое утверждение.

Исправление процесса аудита:

```text
for each external repository:
    pin commit
    enumerate relevant filenames
    classify each file as theory | status-report | code | demo | test | data
    connect every report claim to code/test/data evidence
    record local adapters
    record unresolved and contradictory claims
```

Обязательная запись в будущем `SourceLedger`:

```json
{
  "sourceId": "DATA7_KNOWLEDGE_SYSTEM_REPORT_PAIR",
  "repository": "svend4/data7",
  "commit": "fb665e7e40ef99e3bfcfa836ebb7a01735654627",
  "status": "PARTIALLY_ADAPTED_CONFLICTING_MATURITY_CLAIMS",
  "sourceFiles": [
    "KNOWLEDGE_SYSTEM_SUMMARY.md",
    "KNOWLEDGE_SYSTEM_100_PERCENT_COMPLETE.md"
  ],
  "classification": {
    "form": "TECHNICAL_OPERATIONAL",
    "content": "SCIENTIFIC_HUMANITARIAN_TARGET",
    "alphaScope": "MULTI_LEVEL"
  },
  "directAdapters": ["p55", "p56", "p70", "docs/16"],
  "indirectAdapters": ["semantic-core", "docs/29", "docs/30", "docs/42", "docs/44"],
  "adjacentNotWired": ["p78-alpha-orbit-contracts"],
  "conflicts": [
    "GRANULARITY_IS_NOT_ALPHA",
    "TSP_ORDERING_IS_NOT_SEMANTIC_VALIDATION",
    "RATIONALIZER_BOUND_NOT_ENFORCED_UPSTREAM",
    "MATURITY_REPORTS_CONTRADICT"
  ],
  "unresolved": ["semanticValidation", "coverageEvidence", "expertProtocol", "productionReadiness"]
}
```

---

## 8. Сопоставление операций `data7` с девятью α-орбитами

Ключевое правило: **жанр документа не равен α-уровню**. Одна диссертация и одна статья Wikipedia одновременно содержат определения, принципы, спецификации, примеры и иногда код.

Нельзя фиксировать «диссертация = философия» или «Wikipedia = концепция». α назначается каждому артефакту/утверждению по его роли.

| Операция `data7` | Операция P78 по умолчанию | Когда меняется α | Когда α не меняется |
|---|---|---|---|
| разбиение документа на сегменты | `SEGMENT` | только если результат действительно конкретнее по роли | техническое деление абзацев остаётся на той же орбите |
| извлечение факта | `PROJECT_CLAIM` | если из общего утверждения создано проверяемое частное | индексирование того же span не меняет α |
| агрегация | `MERGE` | `GENERALIZE`, если введён более общий тезис с сохранённым покрытием | склейка соседних фрагментов остаётся same-alpha |
| оптимизация порядка | `ORBIT` | никогда сама по себе | всегда касательное движение |
| предложение отсутствующей связи | `LINK` candidate | обычно не меняет α | связь создаётся по касательной |
| рационализация | `PROPOSE_MERGE`/`PARK` | иногда `GENERALIZE`, если есть проверяемое обобщение | удаление повтора или перестановка остаётся same-alpha |
| генерация research proposal | `PROPOSE`/`PARK`/`ABSTAIN` | α определяется ролью полученного артефакта | предложение не становится фактом из-за положения |
| откат | `ROLLBACK` | возвращает предыдущее состояние | authority не повышается |

Допустимый маршрут для каждого кандидата:

```text
source span
  -> deterministic candidate extraction
  -> Claim AST / artifact role classification
  -> alpha proposal
  -> provenance + qualifier + authority gates
  -> human review or ABSTAIN
  -> transition receipt
  -> passive Canvas projection
```

Цвет, радиус, центральность, TSP-cost и PageRank не могут разрешать semantic commit.

---

## 9. Предлагаемый `Data7Adapter` для P78

Адаптер не должен импортировать Python-классы напрямую в браузерный shell. Он должен переводить результаты внешнего или локального анализатора в существующие контракты P78 и обеспечивать `exact-source provenance` для каждого содержательного кандидата.

### 9.1. Вход

```text
SourceSnapshot
PassageSpan[]
operation request: SEGMENT | MERGE | ORDER | LINK_CANDIDATE | RATIONALIZE | PROPOSE
parameters with explicit version
```

### 9.2. Выход

```text
AlphaArtifact candidate[]
AlphaEdge candidate[]
TransitionProposal[]
EvidenceLink[]
Data7AdapterReceipt
```

Каждый результат по умолчанию публикует:

```json
{
  "semanticTruth": false,
  "soundness": "NOT_COMPUTED",
  "commitAllowed": false,
  "requiresReview": true
}
```

### 9.3. Нормативный псевдокод

```text
function adaptData7Operation(request, snapshot):
    assert snapshot.contentHash == sha256(snapshot.bytes)
    assert request.algorithmVersion is explicit

    spans = extractCandidatesDeterministically(snapshot, request)
    proposals = []

    for span in spans:
        artifact = buildArtifactFromExactSpan(span)
        artifact.id = sha256(canonicalJson(artifact.identityFields))
        artifact.authority = min(span.authority, request.maxAuthority)

        if sourceReferenceMissing(artifact):
            proposals.push(ABSTAIN("SOURCE_REFERENCE_MISSING"))
            continue

        if qualifierCoverageLost(artifact):
            proposals.push(ABSTAIN("QUALIFIER_LOSS"))
            continue

        operation = classifyActualOperation(request, artifact)

        if operation == ORDER:
            proposals.push(ORBIT(artifact, commitAllowed=false))
        else if operation changes alpha:
            proposals.push(alphaTransitionProposal(artifact, commitAllowed=false))
        else:
            proposals.push(sameAlphaProposal(artifact, commitAllowed=false))

    return receipt(
        inputHash=snapshot.contentHash,
        outputHash=sha256(canonicalJson(proposals)),
        semanticTruth=false,
        commitAllowed=false
    )
```

### 9.4. Обязательные замены

| Внешний приём | Замена в P78 |
|---|---|
| Python `hash()` | SHA-256 от canonical JSON |
| novelty `0.5` | `NOT_COMPUTED` до корпусного сравнения |
| `related_to` по одному предложению | `CO_OCCURS_WITH` candidate, без истинностного статуса |
| шаблонное definition | `DefinitionClaim` только из точного source span |
| автоматическое удаление дубля | reversible merge proposal + edge-rewire preview |
| hard-coded improvement | измерение до/после на фиксированной функции |
| TSP как полное решение | только same-alpha ordering |
| PageRank как научная важность | structuralCentrality, не semantic importance |

---

## 10. Проверки до подключения

### 10.1. Детерминизм

1. Одинаковый snapshot в разных процессах даёт одинаковые IDs.
2. Перестановка ключей JSON не меняет content hash.
3. Часы, случайность и сетевой ответ не входят в replay identity.
4. Версия алгоритма и параметры записаны в receipt.

### 10.2. Источники и смысл

1. Каждый claim ссылается на точный span.
2. Отрицание, модальность, число, область действия и источник атрибуции сохраняются.
3. Синтез не повышает authority выше минимальной authority входов.
4. Неподтверждённая новизна получает `ABSTAIN` или `NOT_COMPUTED`.
5. Внешняя статья не считается доказательством собственного утверждения системы.

### 10.3. Split/merge

1. `split` сохраняет union покрытия исходного span.
2. `merge` содержит карту claim-to-source для каждого нового утверждения.
3. Удаление узла невозможно до безопасного переноса всех рёбер.
4. Undo возвращает byte-identical состояние.
5. Пустой граф и граф без рёбер обрабатываются без деления на ноль.

### 10.4. Корпусная оценка

```text
development corpus
  -> правила, словарь, морфология, отладка
frozen blind holdout
  -> recall/precision по claims и relations
adversarial set
  -> negation, modality, contradiction, citation mismatch
human review sample
  -> inter-annotator agreement and error taxonomy
```

AG5 остаётся `BLOCKED_FOR_AG5`, пока новый blind holdout не покажет приемлемое извлечение кандидатов и сохранение qualifiers. Успех структурного адаптера не является успехом семантики.

---

## 11. Плюсы, минусы и итоговое мнение

### Плюсы

- Архитектура мыслит преобразованиями, а не одним генератором текста.
- Графовая модель подходит для нелинейного знания и многократного использования источников.
- Направленная стоимость хорошо соответствует информационной асимметрии P78.
- TSP-портфель даёт реальный экспериментальный стенд для порядка блоков.
- Пара decomposer/aggregator естественно переводится в обратимые split/merge proposals.
- Rationalizer формулирует правильную инженерную цель: компактность без потери покрытия.

### Минусы

- Отчёты смешивают реализованность, демонстрацию и научную валидацию.
- Важные семантические оценки являются константами или структурными прокси.
- Русский язык и сложные научные утверждения не поддержаны на требуемом уровне.
- Источники и exact spans не являются обязательным основанием каждого утверждения.
- Идентификаторы недетерминированы между процессами.
- Рационализация недостаточно защищает граф от потери рёбер и побочных мутаций.
- Теоретические «теоремы» чаще являются набросками исследовательских гипотез.
- Демонстрация содержит hard-coded результат и не заменяет тест.

### Итоговая классификация

```text
REAL_EXECUTABLE_PROTOTYPE:              YES
USEFUL_ALGORITHMIC_FORM:                YES
READY_AS_P78_DRAFT_OPERATOR_SOURCE:     YES, SAFE_SLICE_IMPLEMENTED
VALIDATED_RUSSIAN_SEMANTIC_ENGINE:      NO
PROVEN_INFORMATION_LOSS_GUARANTEE:      NO
PROVEN_NOVELTY/SCIENTIFIC_VALUE:        NO
SUPPORTED_PRODUCTION_READINESS:         NO
SAFE_TO_GRANT_SEMANTIC_AUTHORITY:       NO
```

Моё техническое мнение: `data7` полезнее всего не как готовый «мозг содержания», а как **каталог операций над материалом**. `info1` задаёт этаж и направление, `data7` предлагает работу, которую можно выполнить на этаже, а P78 должен обеспечивать происхождение, обратимость, гейты и честный отказ. Такое сочетание сильнее каждой системы отдельно, но только если структурная оптимизация не выдаётся за понимание.

---

## 12. Реализованный срез и следующий рубеж

Рекомендованный модуль реализован:

```text
prototype/lib/p78-data7-adapter.js
prototype/tests/semantic-p78-data7-adapter-regression.cjs
```

Он содержит три безопасные операции:

1. `SEGMENT` точных passage spans;
2. `ORBIT` для детерминированной перестановки Segment refs без α-transition;
3. `LINK_CANDIDATE` как exact-context `CO_OCCURS_WITH` без AlphaEdge.

Исполняемый аудит выявил важную поправку: перестановка списка не является α-`ORBIT` одного артефакта, а совместный контекст не доказывает `ASSOCIATES`. Поэтому результаты публикуют `alphaTransitionReceipt:null`, `edge:null` и `finalRelation:NOT_COMPUTED`.

`RATIONALIZE`, `SYNTHESIZE` и автоматическое изменение α не следует включать в первый срез. Их можно добавить только после edge-rewire preview, qualifier tests, blind holdout и review receipts.

Первый самостоятельный рубеж реализован в [`49-p78-evidence-backed-link-adapter-implementation.md`](49-p78-evidence-backed-link-adapter-implementation.md): адаптер не доверяет одним строковым refs, заново запускает parser и `LinguisticStructureIndex.replay`, разыменовывает passage/hits/contexts/claims/alignment и создаёт только `AlphaEdge(status:PROPOSED)`. Следующий срез [`50-p78-qualifier-direction-contract-implementation.md`](50-p78-qualifier-direction-contract-implementation.md) добавляет `QUALIFIES` только для replayed шаблона `через <METHOD>`: contract различает `DIRECTED/ABSTAIN`, а adapter принимает только passage-relative `NARROWER`.

Пассивный `EvidenceBackedLinkView` реализован отдельным bounded projector/view с bound replay в [`51-p78-evidence-backed-link-view-implementation.md`](51-p78-evidence-backed-link-view-implementation.md). Следующая граница - отдельный `HumanReviewDecisionContract`; успешный replay по-прежнему не повышает результат до `REVIEWED` и не выполняет commit.

UI P78 пока не изменён. Будущая пассивная проекция должна раздельно показывать exact spans, стоимость маршрута и неподтверждённое co-occurrence, не объявляя результат истинным и не выполняя commit.
