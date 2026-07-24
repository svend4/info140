# P78: реализация Controlled Russian Claim AST

Статус: **AG3 реализован как автономный, детерминированный и fail-closed вертикальный срез**.

Дата фиксации: 2026-07-20.

Связанные документы:

- [27. Автономное 2D-кольцо](27-p78-autonomous-2d-development.md);
- [29. Энциклопедическое кольцо](29-encyclopedic-semantic-ring-spec.md);
- [30. Научное слияние и расщепление](30-scientific-synthesis-fission-fusion-spec.md);
- [31. Программа семантического развития](31-p78-semantic-program-roadmap.md);
- [33. Адаптация grep/AST](33-ast-grep-semantic-ring-adaptation.md);
- [34. Реализация двунаправленного Formula AST/span index](34-p78-bidirectional-index-implementation.md).

---

## 1. Решение этапа

P78 теперь умеет принять одно короткое утверждение на ограниченном русском языке и воспроизводимо провести его через три разные границы:

```text
короткая фраза
  -> PARSE_STRUCTURE
  -> ClaimAst(RESOLVED | AMBIGUOUS | OOV)
  -> MATCH_PATTERN
  -> STRUCTURAL_MATCH или явный отказ
  -> EVIDENCE_GATE
  -> NOT_COMPUTED + REQUIRES_REVIEW + ABSTAIN
```

Это первый работающий языковой слой P78, но не универсальный анализатор русского языка и не генератор истинных утверждений.

Реализовано:

1. закрытая и адресуемая схема Claim AST;
2. контролируемый словарь из 144 sense/concept records;
3. 24 предикатные рамки;
4. 30 структурных шаблонов;
5. детерминированный parser adapter;
6. отдельный Claim structural matcher;
7. трехшаговый trace;
8. golden corpus из 120 буквальных фраз;
9. диагностическая панель в P78;
10. явный запрет автоматически превращать совпадение структуры в доказательство.

---

## 2. Что изменилось концептуально

До AG3 частицы, формулы и найденные строки могли показывать движение, сходство формы и адрес фрагмента. Они не представляли языковое утверждение как проверяемый объект.

Теперь предложение

```text
Система не сохраняет состояние.
```

разделяется на независимые признаки:

```text
predicate  = сохранять
roles      = AGENT(система), THEME(состояние)
polarity   = NEGATIVE
modality   = FACT
quantifier = UNSPECIFIED
status     = RESOLVED
```

Отрицание не растворяется в общей похожести текста. Роль не вычисляется из положения частицы на рисунке. Омоним не заменяется первым удобным значением.

Это переводит P78 из уровня «облако слов реагирует на строку» на уровень «ограниченная грамматика создает проверяемую структуру». При этом доказательность остается отдельной задачей.

---

## 3. Архитектура

### 3.1. Независимость Formula AST и Claim AST

Formula AST и Claim AST имеют разные схемы, идентичности и matchers.

```text
Formula AST
  -> математическая форма
  -> operations, inputs, units, dependencies

Claim AST
  -> языковое утверждение
  -> predicate, roles, senses, polarity, modality, qualifiers
```

Равенство их hashes невозможно трактовать как семантическую эквивалентность. Переход между ними в будущем потребует отдельного versioned interpretation map.

### 3.2. Файлы вычислительного слоя

| Файл | Ответственность |
|---|---|
| `prototype/lib/p78-controlled-russian-lexicon.js` | senses, predicate frames, structural patterns, pinned hashes |
| `prototype/lib/p78-claim-ir.js` | создание и строгая проверка `meridian.claim-ast/1` |
| `prototype/lib/p78-linguistic-parser-adapter.js` | фраза -> tokens -> roles/senses -> Claim AST |
| `prototype/lib/p78-claim-structural-matcher.js` | Claim AST -> закрытые structural matches |
| `prototype/lib/p78-controlled-claim-engine.js` | orchestration и трехшаговый trace |
| `prototype/lib/p78-claim-golden-corpus.js` | 120 независимых эталонных аннотаций |
| `prototype/lib/p78-claim-view.js` | пассивное отображение результата |
| `prototype/lib/p78-claim-adapter.js` | связь локального input, engine и view |
| `prototype/p78-claim-view.css` | стабильная адаптивная геометрия панели |

Golden corpus не загружается главным HTML. Он остается проверочным артефактом и не увеличивает браузерный runtime.

### 3.3. Главный HTML остается оболочкой

В `p78-living-ring-interface.html` добавлены только:

- одно поле утверждения;
- одна команда разбора;
- один контейнер результата;
- versioned script/style references.

Словарь, parser, matcher, engine и view вынесены в отдельные файлы. Это продолжает декомпозицию из документа 21: размер возможности растет без возвращения вычислительного кода в главный HTML.

---

## 4. Контракт Claim AST

Схема:

```text
meridian.claim-ast/1
```

Минимальная форма:

```ts
type ClaimAst = {
  schema: "meridian.claim-ast/1";
  claimAstId: string;
  sourceSpanIds: string[];

  predicate: {
    lemma: string;
    senseId: string | null;
    relationTypeId: string | null;
  };

  arguments: Array<{
    role: string;
    surfaceSpanId: string;
    entityId: string | null;
    senseId: string | null;
    ontologyTypes: string[];
  }>;

  quantifier:
    | "UNSPECIFIED"
    | "ONE"
    | "SOME"
    | "MOST"
    | "ALL"
    | "NONE";

  polarity: "POSITIVE" | "NEGATIVE";

  modality:
    | "FACT"
    | "REPORTED"
    | "DERIVED"
    | "HYPOTHESIS"
    | "INTERPRETATION";

  qualifiers: {
    time?: string;
    place?: string;
    population?: string;
    method?: string;
    condition?: string;
    measure?: string;
  };

  parserRef: {
    id: string;
    version: string;
  };

  resolutionStatus: "RESOLVED" | "AMBIGUOUS" | "OOV";
  contentHash: string;
};
```

Каждый Claim AST имеет:

- собственный content hash;
- собственный `claimAstId`;
- pinned parser version;
- точные source spans;
- закрытый набор полей;
- глубокую неизменяемость;
- deterministic replay.

Поля `semanticTruth`, `supported`, `evidence` и подобные эпистемические утверждения запрещены внутри Claim AST. Структура не имеет права содержать вывод о собственной истинности.

---

## 5. Controlled Russian

### 5.1. Почему язык ограничен

Свободный русский текст требует полноценной морфологии, dependency parsing, coreference, word-sense disambiguation, обработки эллипсиса и длинной контекстной памяти. Текущий проект не имеет проверенного основания объявлять такие возможности готовыми.

Поэтому AG3 использует закрытый подъязык:

```text
одна фраза
один предикат
один structural template
точные словарные формы
явный порядок ролей
явные предлоги
bounded token budget
```

Ограничение является частью контракта, а не скрытым дефектом.

### 5.2. Инвентарь

Текущая версия содержит:

| Объект | Количество |
|---|---:|
| sense/concept records | 144 |
| predicate frames | 24 |
| structural patterns | 30 |
| golden fixtures | 120 |
| RESOLVED fixtures | 96 |
| AMBIGUOUS fixtures | 12 |
| OOV fixtures | 12 |

Предикатный домен включает:

```text
move, continue, generalize, detail, split, merge,
cause, preserve, verify, describe, rotate, enter,
exit, reach, avoid, balance, support, refute,
limit, depend, consist, include, follow, change
```

### 5.3. Шаблоны как грамматика ролей

Примеры:

```text
{THEME} движется по {PATH}.
{AGENT} сохраняет {THEME}.
{CAUSE} вызывает {EFFECT}.
{AGENT} разделяет {WHOLE} на {PART}.
{AGENT} объединяет {PART} в {RESULT}.
{THEME} вращается вокруг {AROUND}.
{DEPENDENT} зависит от {CONDITION}.
{NEXT} следует после {PREVIOUS}.
```

Роли определяются положением placeholder и литеральным предлогом. Онтологический балл больше не может переставить субъект и объект.

Это исправляет прежний класс ошибок:

```text
Параметр входит в систему.
Результат выходит из системы.
Параметр не вызывает коллапс.
Вывод следует после ввода.
```

В каждой из этих фраз роли теперь следуют грамматическому шаблону, а не жадному локальному максимуму.

---

## 6. Алгоритм разбора

Нормативный псевдокод:

```text
parse(text, options):
  reject unknown option fields
  reject stale lexicon hash
  reject empty input
  tokenize with stable offsets
  reject token budget overflow
  reject more than one sentence

  templateMatches = exactTemplateMatches(tokens)

  if templateMatches.count > 1:
    return AMBIGUOUS(MULTIPLE_TEMPLATES)

  if templateMatches.count == 1:
    frame = template.predicateFrame
    for each role placeholder:
      token = token bound by template
      resolution = lexicon.resolveExact(token)

      if one sense:
        bind sense
      else if admitted explicit context rule selects one sense:
        bind selected sense
      else if several senses:
        bind senseId = null
        record ROLE_AMBIGUOUS with all candidates
      else:
        bind senseId = null
        record OOV_TOKEN

    polarity = template.polarity
    modality = template.modality
    qualifiers = only source-backed qualifiers

  else:
    use bounded compatibility fallback
    never invent a predicate or sense

  create immutable ClaimAst
  validate ClaimAst
  hash complete parse result
  return RESOLVED, AMBIGUOUS or OOV
```

### 6.1. Почему placeholder сохраняется при ошибке

При AMBIGUOUS или OOV аргумент не исчезает. Он остается в Claim AST с:

```text
role = известная структурная роль
senseId = null
surfaceSpanId = точный адрес слова
```

Это важно для интерфейса и следующего шага: система знает, где именно возникла неопределенность, и не смешивает «роль не найдена» с «роль найдена, значение неизвестно».

### 6.2. Контекстное разрешение

Контекстное WSD допускается только как явное, тестируемое правило. Текущая нормативная пара:

```text
Кольцо вращается вокруг центра.
```

разбирается как:

```text
THEME  -> p78:sense:ring.semantic
AROUND -> p78:sense:center.geometry
```

Но:

```text
Кольцо движется по траектории.
Центр вращается вокруг орбиты.
Система описывает движение.
```

остаются `AMBIGUOUS`, потому что закрытого основания выбрать одно значение нет.

Система не использует случайный tie-break и не выбирает первый sense ID.

---

## 7. Structural matcher

Claim matcher проверяет отдельно:

1. `predicate.relationTypeId`;
2. наличие всех закрытых roles;
3. polarity;
4. modality;
5. допустимость qualifier keys;
6. identity Claim AST;
7. identity lexicon и pattern set;
8. operation budget.

Максимальный положительный статус:

```text
STRUCTURAL_MATCH
```

Он означает только:

> Claim AST удовлетворяет выбранной закрытой форме.

Он не означает:

- утверждение истинно;
- источник найден;
- источник поддерживает утверждение;
- два утверждения эквивалентны;
- текст можно публиковать;
- действие можно автоматически commit.

Matcher отказывается работать с Claim AST, у которого `resolutionStatus != RESOLVED`.

---

## 8. Trace и evidence boundary

Engine строит три шага:

```text
1. PARSE_STRUCTURE
2. MATCH_PATTERN
3. EVIDENCE_GATE
```

Для разрешенного и структурно совпавшего утверждения итог все равно содержит:

```text
evidenceCandidates = []
evidenceStatus     = NOT_COMPUTED
reviewStatus       = REQUIRES_REVIEW
semanticTruth      = false
soundness          = NOT_COMPUTED
finalStatus        = ABSTAIN
```

Эта граница обязательна. UI не имеет `actionController`, `commitSemanticAction` или другого пути изменения основной фразы на основании Claim diagnostics.

Отдельное поле Claim можно менять и разбирать сколько угодно. Основной input P78 от этого не изменяется.

---

## 9. Golden corpus

### 9.1. Назначение

Корпус содержит буквальные, вручную заданные fixture rows. Он не вызывает parser для создания собственных эталонов.

Для каждого fixture зафиксированы:

- sentence;
- resolution status;
- pattern ref;
- predicate ref;
- polarity;
- modality;
- qualifiers как сценарная аннотация;
- roles;
- sense IDs или ambiguity candidates;
- OOV surfaces;
- content hash.

Parser source не импортирует corpus, не содержит fixture IDs и не знает corpus hash. Это защищает benchmark от прямого подглядывания.

### 9.2. Фактический результат

Текущий регрессионный результат:

```text
120/120 Claim AST созданы и валидны
120/120 resolution status совпадают
120/120 predicate/polarity/modality совпадают
120/120 role/sense assignments совпадают
120/120 structural pattern gates совпадают
96 RESOLVED
12 AMBIGUOUS
12 OOV
```

### 9.3. Qualifiers без выдумывания

В golden fixtures есть сценарные qualifier annotations, например ожидаемый метод будущей проверки. Многие из этих значений отсутствуют в буквальном тексте предложения.

Parser намеренно не копирует невидимую аннотацию:

```text
fixture annotation: METHOD = "по источнику"
sentence:            "Исследователь проверяет утверждение."
parser qualifier:    отсутствует
```

Иначе тест был бы формально зеленым ценой выдуманного факта.

Qualifier может появиться в Claim AST только из наблюдаемой фразы или из будущего явно admitted context artifact. Значение из benchmark metadata не является частью пользовательского предложения.

---

## 10. Интерфейс

В аналитической поверхности P78 добавлена панель `Controlled Russian Claim AST`.

Она показывает:

- общий статус разбора;
- resolution status;
- короткие hashes lexicon, patterns и trace;
- predicate;
- predicate sense;
- polarity и modality;
- quantifier;
- role bindings;
- qualifiers;
- число structural matches;
- evidence boundary;
- три этапа trace.

Нормативные реакции:

| Ввод | Результат |
|---|---|
| `Система сохраняет состояние.` | `READY / RESOLVED / preserve.positive` |
| `Система не сохраняет состояние.` | `READY / RESOLVED / preserve.negative` |
| `Кольцо вращается вокруг центра.` | `READY / RESOLVED / rotate.positive` |
| `Система описывает движение.` | `AMBIGUOUS / no structural match` |
| `Система сохраняет квантовыйпирог.` | `OOV / no structural match` |

Во всех строках evidence gate завершает работу как `ABSTAIN`.

Панель адаптивна. На узкой ширине roles и trace steps переходят в одну колонку; длинные идентификаторы переносятся и не создают горизонтальный overflow.

---

## 11. Проверки

Новые целевые suites:

```text
semantic-p78-claim-ir-regression.cjs                         13/13
semantic-p78-linguistic-parser-regression.cjs                15/15
semantic-p78-controlled-claim-engine-regression.cjs          12/12
semantic-p78-controlled-russian-lexicon-regression.cjs       20/20
semantic-p78-claim-golden-corpus-regression.cjs              10/10
semantic-p78-claim-interface-regression.cjs                    8/8
```

Проверяются:

- закрытые схемы и неизвестные поля;
- content hashes и stale pins;
- immutable replay;
- source spans;
- порядок ролей;
- polarity;
- modality;
- ambiguity candidates;
- OOV;
- token, operation и ранний raw-input code-unit budgets;
- one-sentence/one-predicate boundary;
- отсутствие corpus leakage;
- все 120 fixtures;
- запрет semantic truth;
- отсутствие сети, часов, случайности, `eval` и динамического кода;
- script dependency order;
- отсутствие commit authority;
- адаптивная геометрия.

Post-audit parser adapter имеет версию `1.1.0`: вход длиннее 8192 UTF-16 code units отклоняется до `trim` и `Language.analyze`; для такого отказа каждый символ связывается bounded-memory цепочкой SHA-256 по блокам 4096 code units.

Браузерная проверка через `localhost` дополнительно подтвердила:

```text
14/14 browser checks
HTTP 200
4 разные реакции Claim UI
main condition не изменяется
0 console/page/request errors
desktop overflow = 0
mobile overflow = 0
8/8 sampled canvas hashes различаются
```

---

## 12. Что AG3 не решает

1. Это не полный dependency parser русского языка.
2. Поддерживаются 30, а не бесконечное число структур.
3. Слоты текущего строгого шаблона рассчитаны прежде всего на короткие именные аргументы.
4. Нет coreference между предложениями.
5. Нет paragraph-level discourse model.
6. Нет надежного анализа пассивного залога.
7. Нет свободной синонимии.
8. Нет embeddings или LLM normalization.
9. Нет принятого корпуса статей.
10. Нет `EvidenceCandidate` из внешнего источника.
11. Нет source-version/passage provenance для Claim.
12. Нет polarity/modality/qualifier alignment с найденным фрагментом.
13. Нет контрпоиска `REFUTES`.
14. Нет автоматического `SUPPORTED`.
15. Нет генерации нового энциклопедического абзаца.

Поэтому корректная оценка текущей стадии:

```text
структурная языковая семантика: работает в закрытом домене
корпусная доказательность:     не вычисляется
осмысленная генерация статьи:  еще не реализована
```

---

## 13. Следующий этап: AG4

Следующий принципиальный этап должен соединить Claim AST не с рисунком и не с golden fixtures, а с admitted source corpus.

Минимальная цепочка:

```text
SourceSnapshot
  -> SourceVersion
  -> Passage(span)
  -> passage ClaimAst
  -> claim structural alignment
  -> polarity alignment
  -> modality alignment
  -> qualifier alignment
  -> EvidenceCandidate
  -> countersearch
  -> REQUIRES_REVIEW
```

### 13.1. Linguistic structure index

Нужен отдельный `p78-linguistic-structure-index.js`, который индексирует:

- predicate ID;
- role signature;
- sense IDs;
- polarity;
- modality;
- qualifier keys;
- source/version/passage refs;
- parser and lexicon hashes.

Он не должен смешиваться с FormulaShape index.

### 13.2. Benchmark cascade

Нужны разные тестовые наборы:

1. morphology fixtures;
2. dependency/role fixtures;
3. WSD fixtures;
4. Claim AST fixtures;
5. retrieval fixtures;
6. support/refute alignment fixtures;
7. countersearch fixtures;
8. end-to-end source-to-claim fixtures.

Один итоговый процент скрывает место ошибки, поэтому каждый слой должен иметь отдельную метрику.

### 13.3. Первый полезный режим для статьи

Практический первый режим не должен «писать статью сам». Он должен:

1. принять короткий тезис;
2. построить Claim AST;
3. найти passage candidates в локальном admitted corpus;
4. показать supporting и conflicting candidates отдельно;
5. сохранить точные source spans;
6. предложить только помеченный draft;
7. потребовать review перед переносом в основной текст.

Так P78 получает реальное смысловое продолжение без подмены источника правдоподобной фразой.

---

## 14. Связь с автономным 2D-кольцом

AG3 не требует P79 или P80.

```text
P79 / 1D
  может кодировать строку,
  но не определяет Claim semantics.

P80 / Q6
  может диагностировать шесть внешних predicates,
  но не назначает sense ID и не доказывает claim.

P78 / 2D
  самостоятельно хранит движение между
  различением ролей и связыванием их в утверждение.
```

Это соответствует исходной цели 2D: не свести все к одному центру и не рассыпать строку до независимых символов, а удерживать воспроизводимую связь частей.

---

## 15. Итог

AG3 завершает первый честный переход от математического кольца к лингвистической структуре.

P78 теперь способен:

- различить утверждение и произвольную строку;
- сохранить predicate и roles;
- не потерять отрицание;
- различить FACT, REPORTED и HYPOTHESIS в admitted patterns;
- показать омонимию;
- показать неизвестное слово;
- воспроизвести 120/120 golden fixtures;
- выбрать один закрытый structural pattern;
- остановиться перед доказательностью.

Главный оставшийся разрыв теперь сформулирован точно:

> система знает форму утверждения, но еще не знает, каким источником и каким passage это утверждение поддерживается или опровергается.

Именно этот разрыв является предметом AG4.

