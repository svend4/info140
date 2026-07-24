# 41 - P78: внешний holdout-пилот AG4 и baseline переносимости

**Статус:** `IMPLEMENTED_EXTERNAL_HOLDOUT_PILOT`  
**Результат gate:** `BLOCKED_FOR_AG5`  
**Набор:** `p78.ag4.ru.wikipedia-definitions.pilot.v1`  
**Дата фиксации:** 2026-07-21  
**Область:** русскоязычные энциклопедические определения  
**Полномочия:** только измерение; правила AG4, runtime и HTML не изменены

Связанные документы:

- [35 - Controlled Russian Claim AST](35-p78-controlled-russian-claim-ast-implementation.md);
- [36 - source-backed каскад AG4](36-p78-source-backed-claim-cascade-implementation.md);
- [37 - план AG5-AG7](37-p78-ag5-ag7-parallel-development-review.md);
- [40 - post-hoc проекция семантического потока](40-p78-semantic-flow-projection-implementation.md).

## 1. Короткий вывод

До этой работы P78 имел хороший синтетический regression benchmark, но не имел независимой проверки переносимости. Его идеальные structural precision/recall показывали, что правила согласованы с примерами, под которые они построены. Они не показывали, что AG4 умеет переходить от короткого естественного энциклопедического определения к контролируемому утверждению.

Теперь создан отдельный внешний пилот:

- 10 external source snapshots;
- 12 задач, из них 9 с эталонным фрагментом, 2 без достаточного свидетельства и 1 OOV guard;
- input и gold физически разнесены по разным файлам;
- каждый источник имеет URL, дату получения, семейство происхождения, лицензию, атрибуцию и описание нормализации;
- входы, аннотации, source set, полный holdout и отчёт content-addressed;
- evaluator не загружается браузером и не меняет правила AG4;
- stale-source, provenance, authority boundary, replay и permutation проверяются автоматически.

Первый замороженный прогон дал:

| Метрика | Результат | Порог | Gate |
|---|---:|---:|---|
| target resolution coverage | `10/11 = 0.9091` | `>= 0.80` | pass |
| lexical gold passage recall | `6/9 = 0.6667` | `>= 0.80` | **fail** |
| candidate gold passage recall | `0/9 = 0` | `>= 0.70` | **fail** |
| candidate passage precision | `NOT_COMPUTED` | `>= 0.80` | **fail** |
| relation macro-F1 | `0` | `>= 0.75` | **fail** |
| false-positive rate на NONE | `0/2 = 0` | `<= 0` | pass |
| OOV guard recall | `1/1 = 1` | `>= 1` | pass |
| provenance completeness | `1` | `>= 1` | pass |
| authority violations | `0` | `<= 0` | pass |
| stale-source rejection | `1` | `>= 1` | pass |

Это не поломка защитного контура. Напротив, AG4 не выдал ложного принятого факта и сохранил `ABSTAIN`. Провал находится в содержательной переносимости: внешний текст частично не находится по поверхностным формам, а найденные естественные определения не проходят текущий контролируемый passage parser и structural matcher. Поэтому AG5 нельзя подключать к этим результатам как к достаточному evidence.

## 2. Почему прежний benchmark не являлся holdout

Существующий файл `p78-claim-cascade-benchmark-fixtures.cjs` следует сохранить. Он полезен как быстрый детерминированный regression test для:

- `SUPPORTS`, `REFUTES`, `QUALIFIES` и `MENTIONS`;
- polarity;
- OOV и ambiguity;
- stale source/index;
- точных content hashes;
- неизменности authority boundary.

Но он не является внешней валидацией по следующим причинам.

1. Целевые фразы benchmark построены тем же контролируемым языком, что и production corpus.
2. Измеряемые фразы дословно или почти дословно присутствуют в source corpus.
3. Значительная часть source passages совпадает с golden corpus AG3.
4. Gold relations повторяют структуру текущей функции `relationFor()`.
5. Настройка словаря, patterns и fixtures происходила в одном проектном цикле.
6. Идеальные значения являются proof-by-construction, пока нет source/provenance-family split.

Правильное разделение теперь такое:

| Набор | Назначение | Можно менять правила после просмотра ошибок |
|---|---|---|
| AG3 golden corpus | parser regression и controlled-language coverage | да, с обновлением version/hash |
| AG4 synthetic benchmark | точное поведение каскада на известных конструкциях | да, с явным обновлением baseline |
| external holdout v1 | первая проверка переноса на внешний энциклопедический текст | **нет для заявления о слепом качестве** |
| будущий development set | разработка morphology/retrieval/definition parser | да |
| будущий blind holdout v2 | независимое подтверждение после разработки | нет до финального прогона |

После публикации ошибок внешний v1 превращается из blind holdout в замороженный validation/regression set. Его нельзя повторно назвать независимым доказательством после подстройки правил.

## 3. Источники и лицензирование

Узкая область выбрана намеренно: короткие русские энциклопедические определения. Это уменьшает число одновременно меняющихся факторов и позволяет отделить проблему morphology/retrieval от задач длинного контекста, coreference, новостной временной линии и научной аргументации.

Использованы короткие, вручную ограниченные фрагменты не более 25 слов со страниц:

1. [Система](https://ru.wikipedia.org/wiki/Система);
2. [Документ](https://ru.wikipedia.org/wiki/Документ);
3. [Алгоритм](https://ru.wikipedia.org/wiki/Алгоритм);
4. [Орбита](https://ru.wikipedia.org/wiki/Орбита);
5. [Предложение (лингвистика)](https://ru.wikipedia.org/wiki/Предложение_(лингвистика));
6. [Гипотеза](https://ru.wikipedia.org/wiki/Гипотеза);
7. [Моделирование](https://ru.wikipedia.org/wiki/Моделирование);
8. [Информация](https://ru.wikipedia.org/wiki/Информация);
9. [Текст](https://ru.wikipedia.org/wiki/Текст);
10. [Математическая формула](https://ru.wikipedia.org/wiki/Математическая_формула).

Для каждого фрагмента записаны:

```text
provenanceFamilyId = ru.wikipedia.org
retrievedAt        = 2026-07-21
licenseSpdx        = CC-BY-SA-4.0
attribution        = Участники Русской Википедии
pageUrl            = точная страница
transformation     = удалённые этимология/сноски/ударения/скобки
```

Текст Википедии доступен на условиях CC BY-SA с указанием авторства и сохранением условий; в fixture сохранены ссылка, атрибуция и описание изменений. Нормализованный excerpt является frozen snapshot: последующее изменение страницы не меняет тест молча, потому что `textHash`, `sourceHash` и `sourceSetHash` закреплены.

Это тестовый корпус, а не механизм онлайн-загрузки Википедии. В runtime не добавлены сеть, scraper или внешний API.

## 4. Физическое разделение входов и ответов

### 4.1. Input fixture

Файл:

`prototype/tests/fixtures/p78-ag4-external-holdout-inputs-v1.cjs`

Он содержит только:

- метаданные набора;
- source excerpts и provenance;
- target text;
- разрешённый для задачи source pool;
- нейтральные slice tags;
- critical flag.

В нём нет `targetResolution`, эталонных passages, relations и thresholds.

### 4.2. Gold fixture

Файл:

`prototype/tests/fixtures/p78-ag4-external-holdout-gold-v1.cjs`

Он содержит:

- ожидаемый resolution target;
- `ANSWERABLE`, `NONE` или `GUARD`;
- точный `sourceId#sentenceIndex`;
- `SUPPORTS`, `REFUTES` или `QUALIFIES`;
- guard code;
- thresholds;
- fixture pins и baseline report hash.

### 4.3. Почему одного файла недостаточно

Логическое разделение полей внутри одного объекта не защищает от случайного использования gold в retrieval или ranking. Физическое разделение позволяет тестом доказать, что:

- input module не содержит relation labels;
- production corpus не импортирует holdout;
- HTML не импортирует input, gold или evaluator;
- evaluator получает gold только после построения результата AG4;
- source pools определены входом, а не ответом;
- полный набор emitted candidates сравнивается с gold отдельно.

Для настоящего закрытого benchmark следующего уровня gold должен храниться вне рабочей ветки до финального запуска. Текущая реализация является воспроизводимым локальным пилотом, а не защищённым серверным leaderboard.

## 5. Content-addressed seal

Заморожены четыре независимых уровня:

```text
inputHash       = sha256:85544bc901d997a559ca6f18138c19cd9b4b72a64dafef7fbd55846db163f692
annotationsHash = sha256:58521adef05815007bbb44eade8a277ee38889c366f3cf31657b848d5d29507e
sourceSetHash   = sha256:86c5a577ed63a063a75192dfdcb0bdafcda40ea8d89a93cecbf4e1d1d213dbcf
holdoutHash     = sha256:61bee4ff1404dc510d14954e08b3ed11b593176c1ee7332bf66551b04e695466
reportHash      = sha256:83fb9a8db320455181d39bbd6750d0f24ea62d57a7e756064ad2f843e512ed22
```

Post-audit rebaseline от 2026-07-21 изменил только `reportHash`: provenance внутри отчёта теперь содержит `parserRef 1.1.0` с ранним raw-input guard. Input, annotations, source set, holdout seal, evaluator version, метрики и статус `BLOCKED_FOR_AG5` не изменились.

Seal также привязан к development corpus, относительно которого заявляется отсутствие exact leakage:

```text
developmentCorpusHash    = sha256:2c86c05ddead778a58c995a05206f2de4416c38aae6b1b0f903c71d7297126b3
developmentSourceSetHash = sha256:e1773dad0c379923f6d0b30ef5a04089db163c1f4bbebaaad8b10eee3e4d99b4
```

Validator блокирует прогон как недействительный, если:

- изменился source text без новой revision/hash;
- input или gold изменены без обновления seal;
- source ID или exact text hash пересекается с development corpus;
- отсутствуют license, attribution, retrieval date или transformation;
- URL не относится к объявленному внешнему семейству;
- case ссылается на неизвестный source;
- gold содержит неизвестную relation;
- input case и gold case не образуют точное взаимно-однозначное множество.

## 6. Состав задач

| Case | Target | Gold | Назначение |
|---|---|---|---|
| `system-composition` | система состоит из частей | SUPPORTS | композиционное перефразирование |
| `system-negation` | система не состоит из частей | REFUTES | polarity и отрицание |
| `document-information` | документ включает информацию | SUPPORTS | containment |
| `algorithm-sequence` | алгоритм сохраняет последовательность | QUALIFIES | порядок шире строгой последовательности |
| `orbit-motion` | частица движется по орбите | SUPPORTS | движение и роль траектории |
| `sentence-words` | предложение состоит из слов | SUPPORTS | морфология и лингвистическая композиция |
| `hypothesis-check` | исследователь проверяет гипотезу утверждения | NONE | источник не доказывает событие проверки |
| `model-process` | модель описывает процесс | QUALIFIES | representation, не буквальное тождество |
| `information-motion` | информация движется по пути | NONE | защита от физической метафоры |
| `text-composition` | текст состоит из частей | SUPPORTS | обобщение от последовательности символов |
| `formula-statement` | формула описывает утверждение | QUALIFIES | запись и описание не тождественны |
| `unknown-metaflow` | модель продолжает метапоток | OOV guard | ранний fail-closed |

Каждый source pool содержит два внешних source snapshots. Это проверяет, что порядок sources не влияет на hashes и результат, а присутствие тематически соседнего фрагмента не должно автоматически создавать поддержку.

## 7. Алгоритм evaluator

Evaluator расположен в:

`prototype/tests/fixtures/p78-ag4-external-holdout-evaluator.cjs`

Упрощённый псевдокод:

```text
validate and hash external inputs
validate and hash physically separate gold
assert no exact source-id/text-hash overlap with development corpus

for each case:
    sources = only inputCase.sourceIds
    snapshots = createSourceSnapshot(sources)
    index = LinguisticStructureIndex.create(snapshots)
    target = Parser.parse(inputCase.targetText)
    result = AG4.findCandidates(index, target, pinned index hashes)

    record target resolution
    record full located passage set
    record passage parse/structural reason codes
    record every candidate, relation and provenance completeness
    compare after execution with gold passages and relations
    assert finalStatus remains ABSTAIN

run stale-source probe with an intentionally wrong sourceSetHash
aggregate retrieval, relation, guard, provenance and authority metrics
apply every hard gate independently
hash the complete report
replay with fresh objects and reversed source order
```

`MENTIONS` не скрывается как успешный semantic candidate. Для passage precision/recall считаются только `SUPPORTS`, `REFUTES` и `QUALIFIES`; отсутствие predictions при ненулевом gold denominator даёт `NOT_COMPUTED` для precision и нулевой recall, а не ложную единицу.

## 8. Что именно не прошло

### 8.1. Target parser

Из 11 содержательных targets десять получили `RESOLVED`. Не разрешилось:

```text
Предложение состоит из слов.
```

Это указывает не на сложность длинного текста, а на узкое покрытие morphology/concept inventory. Target сам по себе короткий и грамматически простой.

### 8.2. Lexical discovery

Gold passage найден в 6 из 9 answerable cases:

- system composition;
- system negation;
- document information;
- algorithm sequence;
- text composition;
- formula statement.

Не найдены gold passages для orbit, sentence и modeling. В этих случаях lexical layer возвращает `OOV_TERM` или target останавливается раньше. Поверхностный token OR без лемматизации не связывает достаточно надёжно формы `орбите/орбита`, `модель/моделирование/модели` и связанные номинализации.

### 8.3. Passage parsing и structural alignment

Ни один найденный natural-language passage не стал evidence candidate. Определения содержат конструкции, которые текущий Controlled Russian parser сознательно не покрывает:

- именные определения через тире;
- copular/zero-copula конструкции;
- причастные и относительные обороты;
- перечисления и альтернативы;
- вложенные определения;
- более двух аргументов;
- свободный порядок слов;
- номинализации вместо одного из 24 predicate frames.

Отсюда:

```text
candidateGoldPassageRecall = 0/9
relationMacroF1            = 0
candidatePassagePrecision  = NOT_COMPUTED
```

Это более точный диагноз, чем «семантика не работает». Система умеет воспроизводимо искать часть поверхностно близких passages, но её passage-to-Claim projector пока не переводит естественные определения в тот же Claim IR, что и controlled targets.

### 8.4. Что прошло

Защитные свойства не деградировали:

- два `NONE` case не породили ложных non-MENTIONS candidates;
- OOV target дал typed `TARGET_CLAIM_UNRESOLVED`;
- неправильный source hash дал `STALE_SOURCE_SET`;
- candidates, если появятся, обязаны нести полный source/index/parser provenance;
- все результаты остались `ABSTAIN`, `NOT_COMPUTED`, `REQUIRES_REVIEW`, `semanticTruth=false`;
- свежий replay и перестановка source order дали тот же report hash.

## 9. Почему нельзя просто расширить словарь по этим 12 примерам

Если добавить в production lexicon слова и patterns непосредственно по ошибкам v1, затем снова измерить качество на v1 и объявить успех, получится новая версия proof-by-construction. Так можно делать regression development, но нельзя называть результат независимой оценкой.

Правильный цикл:

1. Сохранить v1 неизменным как diagnostic regression.
2. Создать отдельный development corpus из других страниц и предложений.
3. Разрабатывать morphology, retrieval и definition parser только на development corpus.
4. Проверять отсутствие регрессий на AG3 golden и AG4 synthetic benchmark.
5. После заморозки правил создать blind holdout v2 из непересекающихся page/provenance families.
6. Только один раз открыть gold v2 и вычислить итоговые метрики.

Нельзя ослаблять текущие thresholds потому, что baseline низкий. Порог является требованием к следующей стадии, а baseline показывает расстояние до него.

## 10. Следующий технический этап

### 10.1. Development corpus D1

Нужен отдельный набор не менее 100 предложений, не совпадающих с v1:

- 25 коротких именных определений;
- 20 copular/zero-copula конструкций;
- 20 morphological paraphrases;
- 15 negation/quantifier contrasts;
- 10 modality/attribution contrasts;
- 10 OOV/ambiguity guards.

Он должен иметь train/development labels, но не претендовать на holdout.

### 10.2. Morphology до embeddings

Первое улучшение должно быть детерминированным и объяснимым:

- нормализация падежных форм для существительных;
- согласованный lemma ID в query и source index;
- словарь безопасных номинализаций;
- запрет свободного expansion без provenance;
- отдельные reason codes `LEMMA_MATCH`, `DERIVATIONAL_MATCH`, `SYNONYM_MATCH`;
- budgets для числа expansion terms.

Embeddings не нужны для исправления `орбите -> орбита`. Подключение модели до исправления базовой morphology затруднит диагностику и добавит недетерминированный ranking.

### 10.3. Definition Claim IR

Нужен отдельный typed projector для формы:

```text
TERM — GENUS + DIFFERENTIA
```

Пример:

```text
Орбита — траектория движения материальной точки ...
```

может проецироваться не в искусственный глагол, а в структуру:

```text
DefinitionClaim {
    term: ORBIT,
    genus: TRAJECTORY,
    constraints: [MOTION, MATERIAL_POINT, COORDINATE_SYSTEM, FORCE_FIELD]
}
```

Затем отдельное, проверяемое правило может вывести candidate relation к утверждению «частица движется по орбите». Такой вывод должен иметь `derivationRef`, premises, rule version и оставаться review-only. Нельзя молча подменять исходное определение простым SVO-предложением.

### 10.4. Relation evaluator

После появления candidates нужны:

- полная confusion matrix, включая `MENTIONS`, `MISSING` и `NONE`;
- macro-F1 и per-class F1;
- contradiction recall как hard gate;
- qualifier/modality/quantifier axes;
- точные unexpected candidates;
- Wilson interval при достаточном числе cases;
- критические slices, которые блокируют общий PASS независимо от среднего.

### 10.5. Масштаб следующего blind holdout

Текущие 12 cases являются pilot/smoke. Для заявления о готовности требуется минимум 300 задач одного узкого домена, как уже предусмотрено спецификацией 29:

- source-level split;
- provenance-family split;
- отсутствие exact и near-duplicate overlap;
- отдельный temporal cutoff;
- не менее 30 примеров каждого ключевого relation/guard slice;
- доверительные интервалы;
- ручная двойная разметка спорных `QUALIFIES/NONE` случаев;
- adjudication protocol;
- неизменяемый evaluation manifest.

## 11. Взаимодействие с AG5 и семантическим потоком

Текущий результат не запрещает разрабатывать AG5 как `DISCONNECTED_DRAFT`. Он запрещает подключать generated attempts к пользовательскому выводу как будто AG4 уже доказал source support.

Перед runtime linkage должны одновременно выполняться:

1. AG4 проходит новый blind holdout, а не только synthetic regression.
2. Каждый AG5 attempt ссылается на точный target Claim, query, source set, passage claims и candidate IDs.
3. Attempt не повышает `EVIDENCE_CANDIDATE` до `SUPPORTED`.
4. Countersearch имеет отдельные purpose и budgets.
5. `WorkReceipt` закрепляет epoch, inputs, outputs, parser/index versions и termination reason.
6. Semantic flow остаётся post-hoc проекцией, пока scheduler действительно не управляет WorkItems.

P78 при этом остаётся самостоятельной 2D-системой. Для исправления внешней семантики ему не нужны обязательные P79/1D или P80/3D. Соседние измерения могут быть дополнительными представлениями, но не заменяют morphology, Claim IR, provenance и corpus evaluation.

## 12. Критерий завершения следующей стадии

Следующая стадия считается завершённой только если:

- v1 остаётся byte-for-byte sealed;
- создан отдельный D1 development corpus;
- morphology и definition projector имеют typed contracts и budgets;
- AG3/AG4 synthetic regressions не ухудшены;
- создан новый blind v2 без source/provenance overlap;
- passage recall, precision и relation macro-F1 проходят заранее объявленные thresholds;
- critical negation/OOV/stale/provenance/authority gates проходят без исключений;
- полный project runner зелёный;
- браузерный runtime не загружает evaluation fixtures;
- в UI по-прежнему нет утверждения о semantic truth.

## 13. Техническая проверка

Новая suite:

```text
semantic-p78-ag4-external-holdout-regression.cjs
```

проверяет девять групп инвариантов:

1. immutable и физически раздельные fixtures;
2. provenance, лицензии, размеры excerpts, pins и development split;
3. отсутствие gold в runtime/HTML/input;
4. неизменность review-only authority;
5. OOV и stale-source fail-closed;
6. полноту provenance candidates;
7. честную блокировку AG5 при провале semantic transfer;
8. точный baseline report hash и метрики;
9. replay и source-order permutation.

Первый зафиксированный результат:

```text
PASS: 9/9 checks
GATE: BLOCKED_FOR_AG5
passed gates: 6/10
```

Этот PASS означает, что evaluator правильно и воспроизводимо обнаружил недостаточную переносимость. Он не означает, что семантическое качество прошло gate.

## 14. Итог

AG4 остаётся качественно реализованным review-only вертикальным срезом для контролируемого языка: source snapshots, hashes, passage locators, budgets, structural alignment, typed relations и authority boundary работают. Внешний пилот впервые отделил эту инженерную надёжность от языковой применимости.

Текущая стадия теперь формулируется точно:

> AG4 технически воспроизводим и безопасно воздерживается, но ещё не переносит естественные русские энциклопедические определения в Claim IR с достаточным retrieval recall и relation quality. Поэтому AG5 остаётся отключённым, а следующий этап — morphology + typed definition projector на отдельном development corpus и новый blind holdout.
