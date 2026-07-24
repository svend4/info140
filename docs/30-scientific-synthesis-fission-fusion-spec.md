# 30 - MERIDIAN Scientific Synthesis: спецификация слияния и разделения научных текстов

Статус: концептуальное и техническое задание до реализации  
Дата: 2026-07-20  
Ветвь: **MERIDIAN Scientific Synthesis**  
Краткое имя: **MERIDIAN Synthesis**  
Область: научный обзор, диплом, диссертация, энциклопедическая и аналитическая статья  

---

## 0. Решение в одном абзаце

MERIDIAN Scientific Synthesis должен быть самостоятельной продуктовой ветвью, в которой основным объектом является не слово и не готовый абзац, а проверяемая цепочка:

```text
SOURCE -> SOURCE_VERSION -> PASSAGE -> EVIDENCE -> CLAIM
       -> TRANSFORMATION -> DERIVED_CLAIM -> DRAFT_FRAGMENT
```

Система может разделять составные тезисы, объединять совместимые тезисы, сравнивать и показывать противоречия, строить обобщения и уточнения, предлагать новые сочетания тем и собирать черновик научного текста. При этом она не имеет права терять происхождение данных, скрывать несогласие источников, превращать гипотезу в установленный факт или создавать ссылку, которой не было во входных данных. Если достаточных оснований нет, правильный результат - `ABSTAIN`, `UNSUPPORTED` или `REQUIRES_REVIEW`, а не правдоподобное продолжение.

---

## 1. Зачем нужна отдельная ветвь

### 1.1. Задача

Обычный генератор текста оптимизирует плавность ответа. Научный помощник обязан одновременно сохранять:

1. точность утверждения;
2. область применимости;
3. отношение к возражениям;
4. источник и точный локатор;
5. путь происхождения каждого производного вывода;
6. различие между цитатой, пересказом, интерпретацией и новой гипотезой;
7. возможность отменить преобразование без потери исходных материалов.

Поэтому научный синтез нельзя реализовать только как ещё один жанр продолжения P78. Ему нужен собственный домен данных, собственные инварианты, отдельные критерии приёмки и более строгая модель доказательности.

### 1.2. Что в проекте уже можно использовать

Из существующей линии MERIDIAN полезны следующие идеи:

- из [06-pseudocode.md](./06-pseudocode.md) - чистые операции `split/merge`, инварианты и проверка после каждого шага;
- из [09-particle-model-and-semantic-conveyor.md](./09-particle-model-and-semantic-conveyor.md) - типизированные условия, эффекты и ограниченные каскады;
- из [11-word-transport.md](./11-word-transport.md) - поиск по графу, откат из тупика и штраф за повтор;
- из [12-humanitarian-formula-of-meaning.md](./12-humanitarian-formula-of-meaning.md) - различение движения процесса и качества отдельного результата;
- из [14-ladder-number-formula-theorem-word.md](./14-ladder-number-formula-theorem-word.md) - разделение целостности, структурной корректности и истинности;
- из [20-current-stage-audit.md](./20-current-stage-audit.md) - честная граница между эвристической семантикой и доказательством истинности;
- из [23-p78-primary-action-flow-plan.md](./23-p78-primary-action-flow-plan.md) - preview, явный commit, CAS-проверка, undo и replay;
- из [25-external-repositories-audit.md](./25-external-repositories-audit.md) - паспорт поставщика evidence, `ABSTAIN/UNAVAILABLE` и наблюдаемая маршрутизация оснований;
- из [26-three-neighbor-worlds-protocol.md](./26-three-neighbor-worlds-protocol.md) - запрет внешним диагностическим модулям изменять пользовательский текст;
- из [31-p78-semantic-program-roadmap.md](./31-p78-semantic-program-roadmap.md) - автономность 2D-кольца и разделение формульной, тезаурусной, энциклопедической и научно-синтетической ветвей.

### 1.3. Что нельзя наследовать без исправления

Научная ветвь не должна наследовать как достаточное основание:

- ручной словарь P78;
- мягкий fallback для неизвестных слов;
- TF-IDF-близость как доказательство совместимости;
- визуальное соседство узлов как доказательство причинной связи;
- значение `SemFit`, `Phi`, `lambda`, Q6-ячейку или положение на кольце как меру истинности;
- результат языковой модели без проверки по источникам;
- ссылку на документ без точного фрагмента, который поддерживает тезис.

---

## 2. Самостоятельность относительно P78, 1D и Q6

### 2.1. Обязательное ядро

MERIDIAN Synthesis считается работоспособным без P78, P79 и P80, если существуют:

```text
immutable source vault
claim/evidence/source model
provenance graph
typed operation engine
conflict register
citation validator
transaction ledger
human review gates
```

Это минимальное научное ядро. Оно может работать как локальная библиотека, командный инструмент или самостоятельный интерфейс.

### 2.2. Роль P78

P78 может стать двумерным рабочим столом научного синтеза:

- движение внутрь - осторожное обобщение;
- движение наружу - детализация и разложение;
- движение по кольцу - сравнение, связывание и развитие аргумента;
- центр и край - предупреждающие пределы, но не источники истины;
- preview/commit/undo - интерфейс преобразований.

Однако P78 не является обязательным вычислительным центром и не определяет истинность тезиса. Он только визуализирует и оркестрирует операции доменного ядра.

### 2.3. Роль 1D Pulse Tape

P79 может дополнительно проверять:

- точную сериализацию;
- порядок версий;
- хеши содержимого;
- неизменность цитаты при переносе;
- воспроизводимый экспорт.

Это контроль целостности, а не семантический анализ.

### 2.4. Роль Q6

P80 может показывать шесть бинарных диагностических условий, например:

```text
source_identified
locator_verified
claim_atomic
evidence_attached
conflict_checked
human_approved
```

Q6 полезен для однофакторного контрфакта: какое одно условие надо изменить, чтобы объект перешёл из `BLOCKED` в `REVIEWABLE`. Q6 не кодирует смысл тезиса и не заменяет граф литературы.

### 2.5. Архитектурное правило

```text
P79 report ----\
                > MERIDIAN Synthesis Core -> preview -> human commit
P80 report ----/

P78 = optional 2D workbench around the same core
```

Ни один визуальный или диагностический модуль не получает прямого права создавать подтверждённый научный тезис.

---

## 3. Цели и нецели

### 3.1. Цели

Система должна помогать пользователю:

1. импортировать и регистрировать научные источники;
2. выделять атомарные тезисы с точными локаторами;
3. связывать тезисы с подтверждающими и опровергающими свидетельствами;
4. разделять сложное утверждение без потери его источников;
5. объединять совместимые утверждения, не скрывая различия;
6. сравнивать определения, методы, выборки, результаты и ограничения;
7. обнаруживать явные и скрытые противоречия;
8. строить обобщение только в пределах поддержанной области;
9. строить уточнение с явно указанным сужением области;
10. находить исследовательские пробелы и возможные сочетания тем;
11. создавать план диплома, диссертации или обзора;
12. формировать проверяемый черновик с цитатами;
13. экспортировать карту происхождения каждого предложения;
14. проводить аудит плагиата, ссылок и неподтверждённых фраз.

### 3.2. Нецели первого выпуска

Первый выпуск не должен:

- автоматически объявлять научную новизну;
- заменять научного руководителя, рецензента или автора;
- гарантировать истинность внешнего источника;
- выдумывать библиографические записи;
- самостоятельно подавать работу в вуз или журнал;
- обходить paywall, DRM или лицензионные ограничения;
- генерировать фальшивые данные, эксперименты, опросы или результаты;
- писать окончательную диссертацию одним непрозрачным запросом;
- считать отсутствие найденного возражения доказательством отсутствия возражений;
- использовать стилистическую уверенность как epistemic confidence.

---

## 4. Термины

| Термин | Определение |
|---|---|
| `Source` | библиографическая сущность: статья, книга, стандарт, диссертация, набор данных, архивный документ |
| `SourceVersion` | конкретная проверяемая версия источника с хешем и датой доступа |
| `Passage` | адресуемый фрагмент конкретной версии источника |
| `Evidence` | фрагмент или наблюдение, которому назначено типизированное отношение к тезису |
| `Claim` | минимальное утверждение, которое можно подтвердить, опровергнуть или оставить неопределённым |
| `DerivedClaim` | тезис, полученный явной операцией из других тезисов |
| `Hypothesis` | допустимое предположение, ещё не имеющее достаточной поддержки |
| `Provenance` | полный ориентированный путь происхождения объекта и всех его преобразований |
| `Transformation` | журналируемая операция `merge/split/compare/contradict/generalize/specialize` |
| `LiteratureGraph` | типизированный граф источников, фрагментов, тезисов, методов, данных и отношений |
| `DraftFragment` | черновой текст, каждое фактическое предложение которого связано с тезисами |
| `Citation` | оформленная ссылка на источник; сама по себе не является доказательством поддержки |
| `Locator` | страница, раздел, абзац, формула, таблица, рисунок, временная метка или стабильный диапазон |
| `EpistemicStatus` | статус знания: подтверждено, спорно, не поддержано, гипотеза и т. п. |

Ключевое различие:

```text
source exists       != source supports claim
passage mentions X  != passage proves X
two texts are close != their conclusions agree
fluent sentence     != valid scientific statement
```

---

## 5. Неприкосновенные инварианты

### I1. Нельзя потерять provenance

У каждого производного тезиса должен существовать путь до исходных версий источников и точных фрагментов.

```math
ProvComplete(c) = 1
iff
for every leaf l in ancestors(c):
l is Passage and l.sourceVersionId is resolvable.
```

Если хотя бы один лист происхождения неразрешим, объект не может получить статус выше `PROVISIONAL`.

### I2. Операция не создаёт evidence

`merge`, `split`, `compare`, `generalize` и другие операции создают структуру или гипотезу, но не новое эмпирическое свидетельство.

```math
EvidenceAfter(T) subseteq EvidenceBefore(T) union NewUserEvidence
```

### I3. Конфликт нельзя растворить слиянием

Если два исходных тезиса противоречат друг другу, объединённый результат обязан сохранить обе стороны и отношение `CONTRADICTS`, пока пользователь или новое свидетельство не выполнит явное разрешение.

### I4. Область действия не расширяется молча

Нельзя заменить «в исследованной выборке» на «всегда», «может» на «вызывает», «связано» на «обусловлено» или «не обнаружено» на «не существует».

### I5. Цитата неизменяема

Дословная цитата хранится отдельно от перевода и парафраза. Нормализация пробелов допустима только с записью операции. Любое сокращение обозначается и не должно менять смысл.

### I6. Ссылка должна быть точной

Фактический тезис в экспортируемом научном тексте должен иметь хотя бы одну разрешимую ссылку с локатором либо явную метку `UNSUPPORTED`.

### I7. Неизвестность не равна средней уверенности

Отсутствие данных даёт `UNKNOWN`, `ABSTAIN` или `UNAVAILABLE`, но не условный балл 0.5/0.62.

### I8. Автоматический результат не коммитится автоматически

Каждое преобразование проходит:

```text
PREPARED -> PREVIEWED -> VALIDATED -> HUMAN_APPROVED -> COMMITTED
```

Смена исходника после preview переводит операцию в `STALE`.

### I9. История дополняется, а не переписывается

Исправление создаёт новую версию и связь `SUPERSEDES`; старая версия остаётся доступной для аудита.

### I10. Научный текст отделён от служебной графики

Положение узла, цвет, радиус, центральность и анимация не являются доказательством тезиса.

---

## 6. Доменная модель

### 6.1. Source

```ts
type Source = {
  id: SourceId;
  sourceType:
    | "journal-article" | "conference-paper" | "book" | "chapter"
    | "thesis" | "standard" | "report" | "dataset" | "web-page"
    | "archive" | "interview" | "software" | "other";
  title: string;
  authors: PersonRef[];
  issued: PartialDate | null;
  venue: string | null;
  publisher: string | null;
  identifiers: {
    doi?: string;
    isbn?: string;
    issn?: string;
    pmid?: string;
    arxiv?: string;
    repositoryId?: string;
    canonicalUrl?: string;
  };
  language: string;
  rights: RightsProfile;
  metadataProvenance: ProvenanceRef[];
  status: "ACTIVE" | "RETRACTED" | "CORRECTED" | "UNKNOWN";
};
```

Требование: DOI или URL не заменяют название, автора и конкретную версию. Один `Source` может иметь несколько `SourceVersion`.

### 6.2. SourceVersion

```ts
type SourceVersion = {
  id: SourceVersionId;
  sourceId: SourceId;
  versionLabel: string;
  acquiredAt: ISODateTime;
  acquisitionMethod: "upload" | "url" | "repository" | "manual";
  originalUri: string | null;
  mediaType: string;
  byteLength: number | null;
  contentHash: string;
  textHash: string | null;
  parser: { id: string; version: string; configHash: string } | null;
  immutable: true;
  availability: "LOCAL" | "REMOTE" | "METADATA_ONLY" | "UNAVAILABLE";
};
```

### 6.3. Locator и Passage

```ts
type Locator = {
  scheme: "page" | "section" | "paragraph" | "line" | "formula"
        | "table" | "figure" | "timestamp" | "text-offset" | "custom";
  start: string;
  end?: string;
  label?: string;
};

type Passage = {
  id: PassageId;
  sourceVersionId: SourceVersionId;
  locator: Locator;
  exactText: string;
  exactTextHash: string;
  language: string;
  extractionMethod: "parser" | "ocr" | "manual";
  extractionConfidence: number | null;
  verifiedByHuman: boolean;
};
```

При OCR ниже заданного порога ссылка считается найденной, но цитата требует ручной сверки.

### 6.4. Claim

```ts
type Claim = {
  id: ClaimId;
  revision: number;
  text: string;
  normalizedPredicate: Predicate | null;
  claimType:
    | "definition" | "descriptive" | "comparative" | "causal"
    | "mechanistic" | "quantitative" | "methodological"
    | "normative" | "interpretive" | "negative" | "hypothesis";
  subject: ConceptRef[];
  predicate: string;
  object: ConceptRef[];
  qualifiers: {
    population?: string;
    geography?: string;
    time?: string;
    conditions?: string[];
    modality?: "is" | "may" | "likely" | "must" | "unknown";
    quantifier?: "all" | "most" | "some" | "one" | "none" | "unspecified";
  };
  epistemicStatus:
    | "ASSERTED" | "SUPPORTED" | "PARTIALLY_SUPPORTED"
    | "CONTESTED" | "CONTRADICTED" | "UNSUPPORTED"
    | "HYPOTHESIS" | "UNKNOWN" | "RETRACTED";
  evidenceLinks: EvidenceLinkId[];
  provenance: ProvenanceRef[];
  createdBy: ActorRef;
  createdAt: ISODateTime;
  supersedes: ClaimId | null;
  contentHash: string;
};
```

Атомарность означает, что один тезис имеет одну главную проверяемую предикацию. Фраза с двумя независимыми утверждениями должна быть разделена.

### 6.5. Evidence и связь evidence-claim

```ts
type Evidence = {
  id: EvidenceId;
  evidenceType:
    | "direct-quotation" | "reported-result" | "dataset-observation"
    | "formula" | "proof" | "method-description" | "definition"
    | "expert-interpretation" | "secondary-summary";
  passageIds: PassageId[];
  dataArtifactIds: string[];
  notes: string;
  provenance: ProvenanceRef[];
};

type EvidenceLink = {
  id: EvidenceLinkId;
  evidenceId: EvidenceId;
  claimId: ClaimId;
  relation: "SUPPORTS" | "REFUTES" | "QUALIFIES" | "MENTIONS";
  directness: "DIRECT" | "INDIRECT" | "INTERPRETIVE";
  scopeMatch: "EXACT" | "NARROWER" | "BROADER" | "MISMATCH" | "UNKNOWN";
  independenceGroup: string;
  qualityProfile: QualityProfile;
  reviewerDecision: "ACCEPTED" | "REJECTED" | "PENDING";
  rationale: string;
};
```

`MENTIONS` не увеличивает поддержку тезиса. `MISMATCH` блокирует использование evidence как прямого подтверждения.

### 6.6. QualityProfile

```ts
type QualityProfile = {
  identity: "VERIFIED" | "PARTIAL" | "UNKNOWN";
  locator: "VERIFIED" | "PARTIAL" | "MISSING";
  methodTransparency: number | null;
  dataAvailability: number | null;
  relevance: number | null;
  sourceStatus: "ACTIVE" | "RETRACTED" | "CORRECTED" | "UNKNOWN";
  assessmentMethod: string;
  assessmentVersion: string;
};
```

Числовые поля здесь являются профилем проверки, а не универсальным рейтингом качества журнала или автора.

### 6.7. Transformation

```ts
type Transformation = {
  id: TransformationId;
  operator:
    | "MERGE" | "SPLIT" | "COMPARE" | "CONTRADICT"
    | "GENERALIZE" | "SPECIALIZE" | "PARAPHRASE"
    | "TRANSLATE" | "RETRACT";
  inputClaimIds: ClaimId[];
  inputSourceVersionHashes: string[];
  parameters: Record<string, unknown>;
  algorithm: { id: string; version: string; configHash: string };
  model: { provider: string; model: string; version: string } | null;
  proposedOutputs: ClaimId[];
  checks: CheckResult[];
  status:
    | "PREPARED" | "PREVIEWED" | "VALIDATED" | "BLOCKED"
    | "STALE" | "HUMAN_APPROVED" | "COMMITTED" | "ROLLED_BACK";
  actor: ActorRef;
  createdAt: ISODateTime;
  transactionHash: string;
};
```

### 6.8. DraftFragment

```ts
type DraftFragment = {
  id: string;
  text: string;
  sentenceMap: Array<{
    sentenceId: string;
    textRange: [number, number];
    claimIds: ClaimId[];
    citationIds: string[];
    status: "SUPPORTED" | "MIXED" | "UNSUPPORTED" | "AUTHORIAL";
  }>;
  provenance: ProvenanceRef[];
  plagiarismAudit: AuditResult | null;
  humanApproved: boolean;
};
```

`AUTHORIAL` допускается для переходов, постановки задачи и описания структуры, но не для новых фактических утверждений.

---

## 7. Граф литературы

### 7.1. Типы узлов

Обязательные узлы:

```text
Source
SourceVersion
Passage
Evidence
Claim
Concept
Definition
Method
Dataset
Population
Variable
Formula
Author
Venue
ProjectSection
DraftSentence
Transformation
```

### 7.2. Типы рёбер

```text
HAS_VERSION
CONTAINS_PASSAGE
ASSERTS
SUPPORTS
REFUTES
QUALIFIES
MENTIONS
CITES
USES_METHOD
USES_DATASET
MEASURES
DEFINES
SAME_AS
DISTINCT_FROM
GENERALIZES
SPECIALIZES
CONTRADICTS
CORROBORATES
DUPLICATES
DERIVED_FROM
SUPERSEDES
APPEARS_IN_SECTION
EXPRESSED_BY_SENTENCE
```

Каждое ребро имеет `id`, тип, направление, автора решения, время, confidence или тернарный статус, rationale и provenance.

### 7.3. Почему это не обычный citation graph

Граф цитирования соединяет документы, но не сообщает:

- какое утверждение цитируется;
- поддерживает ли источник это утверждение;
- цитирует ли автор источник положительно или критически;
- совпадают ли популяции, периоды и определения;
- является ли источник независимым или повторяет тот же набор данных.

MERIDIAN строит claim-level graph поверх библиографического графа.

### 7.4. Независимость свидетельств

Два источника не считаются независимыми, если они:

- используют один и тот же набор данных;
- являются обзором и пересказом одной первичной работы;
- имеют общий эксперимент без независимого воспроизведения;
- являются разными версиями одной публикации;
- копируют один и тот же ошибочный факт.

Для этого вводится `independenceGroup`. Подсчёт количества ссылок без группировки запрещён.

### 7.5. Граф формул и «матрёшка формул»

Для формализуемых областей создаётся отдельный подграф:

```text
FormulaNode {
  expression,
  notation,
  units,
  assumptions,
  domain,
  sourcePassages,
  parserStatus,
  verifierStatus
}

FormulaEdge {
  type: DERIVES | SUBSTITUTES | APPROXIMATES | SPECIAL_CASE | EQUIVALENT,
  proofSteps,
  assumptionsAdded,
  assumptionsRemoved,
  verifierReport
}
```

Формула B может считаться вытекающей из формулы A только при наличии явной цепочки преобразований или ссылки на доказательство. Семантическая похожесть выражений недостаточна. Если символьного проверяющего модуля нет, статус остаётся `STRUCTURAL_OK / SOUNDNESS_NOT_COMPUTED`.

---

## 8. Операции

## 8.1. `split` - разделение тезиса

### Назначение

Разбить составной тезис на атомарные утверждения, сохранив область, модальность и все исходные ссылки.

### Пример

Исходное:

> Метод A повышает точность и снижает стоимость для малых выборок.

Результат:

```text
C1: Метод A повышает точность [при малых выборках].
C2: Метод A снижает стоимость [при малых выборках].
```

Оба тезиса наследуют ссылку только как `PENDING`. Затем каждый отдельно проверяется по passage: источник может поддерживать C1, но не C2.

### Предусловия

- исходный тезис существует и не `RETRACTED`;
- сохранён снимок исходной формулировки;
- определены границы координации, причинности или перечисления;
- операция не удаляет qualifiers.

### Постусловия

- каждый дочерний тезис содержит одну главную предикацию;
- `DERIVED_FROM(child, parent)` существует;
- объединение смысловых компонентов детей покрывает исходный тезис;
- evidence не получает автоматически статус `ACCEPTED`;
- исходный тезис остаётся в истории.

### Недопустимые случаи

- разрезать цитату так, что исчезает отрицание;
- переносить общий локатор на дочерний тезис, которого в нём нет;
- отделять результат от условия эксперимента;
- превращать оговорку автора в самостоятельный положительный вывод.

## 8.2. `merge` - слияние тезисов

### Назначение

Построить новый синтетический тезис из совместимых входов без сокрытия различий.

### Режимы merge

| Режим | Результат |
|---|---|
| `UNION` | перечисляет все неповторяющиеся утверждения |
| `INTERSECTION` | оставляет только общее ядро |
| `CONSENSUS` | формулирует согласованный вывод с картой несогласий |
| `COMPLEMENT` | соединяет разные аспекты одного объекта |
| `METHOD_RESULT` | связывает метод одной работы с результатом другой как гипотезу |
| `TEMPORAL` | объединяет стадии развития знания во времени |
| `MULTISCALE` | связывает микро-, мезо- и макроуровень |
| `TRIANGULATION` | сопоставляет независимые методы или данные |

### Предусловия

- все входные тезисы атомарны либо явно допускают compound merge;
- определены совпадающие и различающиеся qualifiers;
- проверены противоречия;
- установлена зависимость источников;
- выбран режим merge.

### Правила

1. `UNION` не должен звучать как подтверждённый causal claim.
2. `INTERSECTION` не должен отбрасывать условия, общие только формально.
3. `CONSENSUS` обязан показывать размер и независимость основания.
4. `COMPLEMENT` создаёт связное описание, но не причинность.
5. `METHOD_RESULT` по умолчанию создаёт `HYPOTHESIS`.
6. При конфликте результат содержит структуру `controversy`, а не усреднённую фразу.

### Постусловия

```text
ancestors(output) = union(ancestors(inputs))
conflicts(output) includes all unresolved input conflicts
scope(output) is not broader than justified scope(inputs)
```

## 8.3. `compare` - сравнение

Сравнение не обязано создавать единый тезис. Его основной результат - матрица различий.

Обязательные измерения:

```text
definition
research_question
population_or_object
time_and_place
method
dataset
variables
measurement
assumptions
result
effect_size_or_magnitude
uncertainty
limitations
source_status
```

Ячейка матрицы имеет статус `SAME`, `DIFFERENT`, `PARTIAL`, `NOT_REPORTED`, `NOT_COMPARABLE` или `UNKNOWN` и ссылки на passages.

## 8.4. `contradict` - выявление противоречия

Операция разделяется на два этапа:

```text
detect contradiction candidate
adjudicate contradiction with evidence
```

Типы противоречий:

| Тип | Пример причины |
|---|---|
| лексическое | разные значения одного термина |
| scope | разные популяции или условия |
| temporal | выводы относятся к разным периодам |
| measurement | разные инструменты или пороги |
| methodological | эксперимент против наблюдения |
| quantitative | несовместимые оценки одного эффекта |
| causal | один источник утверждает причинность, другой только корреляцию |
| logical | `P` и `not P` в одной области |
| evidential | одинаковый вывод при несовместимых основаниях |

Статусы:

```text
CANDIDATE
SCOPE_RESOLVED
TERMINOLOGY_RESOLVED
GENUINE_CONFLICT
INSUFFICIENT_INFORMATION
HUMAN_DECISION_REQUIRED
```

Система должна объяснить, какие qualifiers были выровнены перед признанием конфликта.

## 8.5. `generalize` - обобщение

### Безопасное обобщение

Обобщение допустимо, когда оно:

- поднимает несколько частных объектов к явно определённому классу;
- сохраняет общие условия;
- не расширяет квантор сверх evidence;
- показывает исключения;
- имеет независимое основание либо маркируется гипотезой.

### Результаты

```text
SUPPORTED_GENERALIZATION
PROVISIONAL_GENERALIZATION
HYPOTHESIS
BLOCKED_SCOPE_EXPANSION
```

### Запрещённые скачки

```text
some -> all
correlation -> cause
one dataset -> universal law
absence of evidence -> evidence of absence
model output -> observed fact
secondary citation -> primary evidence
```

## 8.6. `specialize` - уточнение

Уточнение добавляет условие, подтип, период, популяцию, механизм или пример.

Два разных случая:

1. **логическое ограничение**: из универсального тезиса строится более узкий тезис; provenance сохраняет исходный тезис и добавленное условие;
2. **эмпирическая детализация**: добавляется новый факт; требуется отдельное evidence.

Система обязана различать эти случаи. Добавление имени, числа, причины или механизма почти всегда требует нового источника.

## 8.7. Вспомогательные операции

Допускаются также:

- `deduplicate` - связать дубликаты без удаления версий;
- `paraphrase` - изменить форму без добавления смысла;
- `translate` - создать перевод, сохранив оригинал и переводчика/модель;
- `retract` - отозвать тезис с причиной;
- `supersede` - заменить версию, сохранив старую;
- `attachEvidence` - связать passage и claim после проверки;
- `detachEvidence` - снять ошибочную связь с журналом причины;
- `resolveConflict` - записать человеческое решение, не удаляя конфликт.

---

## 9. Формальная модель качества

### 9.1. Принцип

Числа используются для сортировки и диагностики, но не изображают абсолютную истину. Каждый показатель имеет версию, входные компоненты и статус вычислимости.

### 9.2. Полнота provenance

Пусть `L(c)` - множество листьев графа происхождения тезиса `c`.

```math
P_prov(c) =
  |{l in L(c): resolvable(l) and hash_verified(l)}| / |L(c)|.
```

Дополнительный жёсткий гейт:

```math
Acceptable(c) implies P_prov(c) = 1.
```

Средний балл 0.99 не компенсирует один потерянный источник.

### 9.3. Точность локаторов

```math
P_loc(c) = verified_locators(c) / required_locators(c).
```

Для прямой цитаты `P_loc=1` обязательно. Для библиографической справки без содержательного тезиса локатор может быть необязателен.

### 9.4. Качество отдельной связи evidence

Для принятой связи `e -> c`:

```math
q(e,c) = I_id * I_loc * R * D * S * Q
```

где:

- `I_id` - подтверждена идентичность источника, 0 или 1;
- `I_loc` - подтверждён локатор, 0 или 1 для прямого evidence;
- `R` - релевантность passage тезису;
- `D` - прямота (`DIRECT > INDIRECT > INTERPRETIVE`);
- `S` - совпадение области;
- `Q` - профиль методической пригодности для конкретного вопроса.

Если компонент неизвестен, итог не подменяется средним числом: возвращается интервал или `NOT_COMPUTED`.

### 9.5. Независимость и защита от двойного счёта

Пусть evidence разбито на группы происхождения `G`.

```math
SupportPlus(c) = sum over g in G of max(q(e,c) for e in g and relation=SUPPORTS)
SupportMinus(c) = sum over g in G of max(q(e,c) for e in g and relation=REFUTES)
```

Повтор одного результата десятью обзорами не даёт десятикратный вес.

### 9.6. Баланс поддержки и опровержения

```math
B(c) = (SupportPlus(c) - SupportMinus(c)) /
       (SupportPlus(c) + SupportMinus(c) + epsilon).
```

`B` показывает направление evidence, но не является вероятностью истинности. При слабой общей массе поддержки должен отображаться статус `LOW_EVIDENCE`, даже если `B` близок к 1.

### 9.7. Полнота сравнения

```math
C_compare(A,B) = comparable_dimensions / required_dimensions.
```

Если ключевые области или методы `NOT_COMPARABLE`, система не строит рейтинг «кто лучше».

### 9.8. Потери при merge

```math
L_merge = w_s * SemanticOmission
        + w_q * QualifierLoss
        + w_c * HiddenConflict
        + infinity * ProvenanceLoss.
```

Любая потеря provenance делает merge недопустимым независимо от остальных баллов.

### 9.9. Сохранение при split

```math
Coverage_split(parent, children) =
  covered_semantic_units(parent, children) / semantic_units(parent).
```

Требования:

```text
Coverage_split = 1
QualifierLoss = 0
ProvenanceClosure = 1
```

### 9.10. Штраф за расширение области

```math
ScopeRisk(generalization) =
  DeltaPopulation + DeltaTime + DeltaGeography + DeltaConditions
  + DeltaModality + DeltaQuantifier.
```

Если любая дельта не поддержана evidence, результат не выше `HYPOTHESIS`.

### 9.11. Кандидаты новых сочетаний тем

Для тем `a` и `b`:

```math
Bridge(a,b) =
  w1 * ConceptOverlap
  + w2 * MethodComplementarity
  + w3 * DataCompatibility
  + w4 * ScaleBridge
  + w5 * IndependentEvidence
  + w6 * ResearchGap
  - w7 * ContradictionRisk
  - w8 * ProvenanceDeficit
  - w9 * Duplication.
```

Высокий `Bridge` означает перспективность проверки, а не доказанную научную новизну.

### 9.12. Аудит фрагмента

```math
DraftCoverage(d) =
  supported_factual_sentences(d) / factual_sentences(d).
```

Для экспорта как «проверенный черновик» требуется `DraftCoverage=1`. Иначе неподтверждённые предложения остаются визуально помеченными и не могут быть скрыты экспортом.

---

## 10. Новые сочетания тем

### 10.1. Зачем они нужны

Научный синтез не должен ограничиваться механическим конспектом. Он может находить места, где существующие материалы допускают новый исследовательский вопрос. Но результатом является **карточка гипотезы**, а не новый факт.

### 10.2. Типы сочетаний

1. **Общий объект, разные методы.** Один объект изучен статистически и качественно; предложить triangulation.
2. **Общий метод, разные области.** Проверить перенос метода при явном сравнении предпосылок.
3. **Механизм-мост.** Один источник описывает механизм, другой - наблюдаемый эффект.
4. **Микро-макро.** Связать локальный процесс с системным результатом через недостающий мезоуровень.
5. **Временная связка.** Сопоставить историческое состояние с современным измерением.
6. **Пространственная связка.** Сравнить регионы при совместимых определениях.
7. **Метод-данные.** Применить существующий метод к открытому набору данных.
8. **Противоречие как тема.** Сделать предметом исследования устойчивое расхождение результатов.
9. **Отрицательный результат.** Объединить неудачные воспроизведения и ограничения.
10. **Смена масштаба.** Проверить, сохраняется ли вывод при другой гранулярности.
11. **Смена единицы анализа.** Индивид -> группа -> организация -> отрасль.
12. **Согласование понятий.** Построить crosswalk между конкурирующими определениями.
13. **Согласование переменных.** Связать разные операционализации одного конструкта.
14. **Формула-случай.** Найти эмпирические работы, проверяющие следствие формулы.
15. **Методологическая инверсия.** Проверить вывод альтернативным дизайном.

### 10.3. Карточка сочетания

```ts
type TopicCombination = {
  id: string;
  topicA: ConceptRef;
  topicB: ConceptRef;
  combinationType: string;
  bridgeClaims: ClaimId[];
  supportingPassages: PassageId[];
  missingLinks: string[];
  incompatibilities: string[];
  proposedQuestion: string;
  proposedMethod: string | null;
  expectedContribution: string;
  noveltyStatus: "NOT_CHECKED" | "SEARCHED" | "POSSIBLY_NOVEL" | "NOT_NOVEL";
  epistemicStatus: "HYPOTHESIS";
  provenance: ProvenanceRef[];
};
```

### 10.4. Проверка новизны

Система не пишет «это впервые». Она формирует поисковый протокол:

```text
query variants
databases searched
date searched
inclusion/exclusion rules
nearest prior works
remaining uncertainty
```

До независимой проверки статус остаётся `NOT_CHECKED` или `POSSIBLY_NOVEL`.

---

## 11. Режимы помощника

### 11.1. Библиограф

Задачи:

- регистрация источников;
- нормализация метаданных;
- поиск дубликатов;
- фиксация версий и исправлений;
- подготовка библиографии.

Не делает: оценку истинности тезиса по названию или аннотации.

### 11.2. Картограф тезисов

Задачи:

- предложение атомарных claims;
- привязка к passages;
- построение claim graph;
- маркировка неизвестных связей.

Все автоматически извлечённые claims имеют статус `PENDING_REVIEW`.

### 11.3. Детализатор

Использует `split` и `specialize`:

- разбивает сложные положения;
- выделяет определения, предпосылки, метод, результат и ограничение;
- строит список фактов для раздела работы;
- показывает, где детализация требует нового источника.

### 11.4. Синтезатор

Использует `merge`:

- строит общее ядро;
- собирает взаимодополняющие аспекты;
- сохраняет несовпадения;
- формирует черновой синтез с картой предложений.

### 11.5. Компаратор

Создаёт матрицу сравнения работ, теорий, методов или результатов. Не ранжирует несопоставимые объекты.

### 11.6. Аудитор противоречий

Ищет кандидаты конфликтов, выравнивает scope и передаёт настоящие конфликты человеку.

### 11.7. Архитектор обзора

Строит структуру:

```text
вопрос -> определения -> школы/подходы -> методы -> результаты
-> противоречия -> пробелы -> выводы -> будущая работа
```

### 11.8. Помощник диплома/диссертации

Поддерживает:

- паспорт темы;
- исследовательский вопрос;
- объект и предмет;
- карту литературы;
- таблицу понятий;
- матрицу методов;
- план глав;
- реестр claims;
- журнал решений;
- список пробелов evidence;
- подготовку черновых разделов;
- аудит ссылок перед сдачей.

Он не утверждает, что работа соответствует локальным правилам вуза, пока эти правила не загружены как отдельный проверяемый источник требований.

### 11.9. Редактор научного обзора

Формирует narrative synthesis, systematic-style matrix или scoping map в зависимости от заданного протокола. Не называет обзор систематическим без документированных критериев поиска и отбора.

### 11.10. Citation auditor

Для каждого фактического предложения проверяет:

- существует ли ссылка;
- разрешается ли источник;
- совпадает ли версия;
- существует ли passage;
- действительно ли passage поддерживает claim;
- не изменён ли квантор;
- не является ли ссылка вторичной там, где заявлена первичная.

### 11.11. Red-team reviewer

Ищет:

- контрпримеры;
- альтернативные объяснения;
- скрытые предпосылки;
- citation drift;
- cherry-picking;
- чрезмерные обобщения;
- дублирующие источники;
- неподтверждённые числа;
- фальшивую причинность.

### 11.12. Режим автора

Человек принимает или отклоняет преобразования, пишет собственные связующие рассуждения и несёт финальную ответственность. Интерфейс не должен маскировать машинный черновик под завершённое авторство.

---

## 12. Техническая архитектура

### 12.1. Компоненты

```text
source-adapters/
  metadata
  document-import
  parser
  ocr-adapter

core/
  source-vault
  passage-store
  claim-store
  evidence-store
  provenance-dag
  literature-graph
  operation-engine
  contradiction-engine
  formula-graph
  citation-validator
  transaction-ledger

services/
  retrieval
  claim-suggestion
  similarity
  draft-planner
  draft-renderer
  plagiarism-audit
  export

ui/
  project-inbox
  source-reader
  claim-workbench
  operation-lab
  graph-view
  outline-board
  draft-editor
  audit-console
```

### 12.2. Слои доверия

| Слой | Может предлагать | Может коммитить |
|---|---|---|
| parser/OCR | passages | только после integrity checks |
| rule engine | atomic split, scope alignment | нет |
| embeddings/retrieval | кандидаты сходства | нет |
| LLM | claims, paraphrases, outlines | нет |
| citation validator | checks/status | нет |
| человек | решение | да |
| transaction ledger | применить одобренное | только при свежем snapshot |

### 12.3. Локальный-first контур

Первый выпуск должен уметь хранить проект локально. Внешний AI-провайдер является подключаемым и не получает документы без явного согласия. Для каждого вызова сохраняются:

```text
provider
model/version
prompt template hash
input object IDs
redaction profile
response hash
timestamp
cost metadata if available
```

Секреты и ключи не записываются в provenance.

### 12.4. Хранилище

Рекомендуемый первый вариант:

- SQLite для метаданных, claims, evidence, графа и ledger;
- content-addressed files для исходников и извлечённого текста;
- FTS для точного поиска;
- подключаемый векторный индекс только как вспомогательный retrieval;
- JSON export для воспроизводимости;
- CSL-JSON/BibTeX export для библиографии.

Векторный индекс можно полностью удалить и перестроить; source vault и ledger удалять или перестраивать нельзя.

### 12.5. Версионирование схем

Каждый экспорт содержит:

```text
schemaVersion
projectId
projectRevision
createdAt
sourceManifestHash
graphHash
ledgerHeadHash
formulaProfileVersion
```

Миграция не должна менять `contentHash` исходных объектов.

---

## 13. Псевдокод

### 13.1. Импорт источника

```text
function ingestSource(fileOrUrl, metadata, actor): IngestResult
    raw = acquire(fileOrUrl)
    if raw unavailable:
        return UNAVAILABLE(reason)

    bytesHash = hash(raw.bytes)
    existing = sourceVersionByHash(bytesHash)
    if existing:
        return DUPLICATE(existing.id)

    parsed = parser.parse(raw)
    source = normalizeMetadata(metadata, parsed.metadata)
    version = immutableVersion(source, bytesHash, parsed.textHash)
    passages = segmentWithStableLocators(version, parsed)

    checks = [
        identityCheck(source),
        hashCheck(version),
        locatorCheck(passages),
        rightsCheck(source)
    ]

    commit source, version, passages as one transaction
    return READY(ids, checks, provenance)
```

### 13.2. Предложение claims

```text
function suggestClaims(passageIds, mode): SuggestionSet
    passages = resolveExactPassages(passageIds)
    if any passage unresolved:
        return BLOCKED(PROVENANCE_GAP)

    candidates = extractor(passages, mode)
    output = []

    for candidate in candidates:
        candidate.status = PENDING_REVIEW
        candidate.provenance = passageIds + extractorVersion
        candidate.qualifiers = extractQualifiers(candidate, passages)
        candidate.atomicity = checkAtomicity(candidate)
        candidate.support = NOT_ADJUDICATED
        output.append(candidate)

    return PREVIEW(output)
```

### 13.3. Split

```text
function prepareSplit(parentId, proposedChildren, snapshotHash): Transaction
    parent = loadClaim(parentId)
    require fresh(parent, snapshotHash)
    require parent.status != RETRACTED

    children = normalizeClaims(proposedChildren)
    checks = []
    checks += atomicity(children)
    checks += semanticCoverage(parent, children)
    checks += qualifierConservation(parent, children)
    checks += provenanceClosure(parent, children)

    for child in children:
        child.provenance += [parent.id, parent.provenance]
        child.evidenceLinks = cloneAsPending(parent.evidenceLinks)
        child.epistemicStatus = UNKNOWN

    if any required check fails:
        return BLOCKED(checks)
    return PREVIEWED(children, checks)
```

### 13.4. Merge

```text
function prepareMerge(claimIds, mode, snapshotHashes): Transaction
    claims = loadFreshClaims(claimIds, snapshotHashes)
    require count(claims) >= 2

    alignment = alignScopesDefinitionsAndMethods(claims)
    conflicts = detectContradictions(claims, alignment)
    dependencies = groupDependentEvidence(claims)

    if mode != CONSENSUS_WITH_CONFLICTS and conflicts.hasGenuineConflict:
        return BLOCKED(UNRESOLVED_CONFLICT, conflicts)

    draft = composeByMode(claims, mode, alignment)
    draft.provenance = unionAll(claims.provenance, claims.ids)
    draft.evidenceLinks = unionWithoutInflation(claims.evidenceLinks, dependencies)
    draft.conflicts = conflicts
    draft.epistemicStatus = inferConservativeStatus(claims, conflicts)

    checks = [
        noProvenanceLoss(draft, claims),
        noQualifierLoss(draft, claims),
        noHiddenConflict(draft, conflicts),
        noUnsupportedScopeExpansion(draft, claims),
        citationCoverage(draft)
    ]

    return allRequired(checks) ? PREVIEWED(draft, checks) : BLOCKED(checks)
```

### 13.5. Compare

```text
function compareClaims(leftIds, rightIds, protocol): Comparison
    dimensions = protocol.requiredDimensions
    rows = []

    for dimension in dimensions:
        left = extractDimension(leftIds, dimension)
        right = extractDimension(rightIds, dimension)
        status = compareOnlyIfCompatible(left, right, protocol)
        rows.append({dimension, left, right, status, passageIds})

    coverage = count(comparable rows) / count(required rows)
    return {rows, coverage, provenance: union(row.passageIds)}
```

### 13.6. Contradiction

```text
function adjudicateContradiction(aId, bId): ContradictionResult
    a = loadClaim(aId)
    b = loadClaim(bId)

    terminology = alignDefinitions(a, b)
    scope = alignQualifiers(a, b)
    predicate = normalizePredicate(a, b)

    if terminology incompatible:
        return TERMINOLOGY_RESOLVED(explanation)
    if scope disjoint:
        return SCOPE_RESOLVED(explanation)
    if insufficient passages:
        return INSUFFICIENT_INFORMATION(missing)
    if logicallyOpposed(predicate) or quantitativelyIncompatible(a, b):
        return GENUINE_CONFLICT(provenance, dimensions)
    return NO_CONFIRMED_CONTRADICTION(explanation)
```

### 13.7. Generalize

```text
function prepareGeneralization(claimIds, targetScope): Transaction
    claims = loadClaims(claimIds)
    common = strictIntersectionOfQualifiers(claims)
    expansion = diff(targetScope, common)
    support = findEvidenceForExpansion(expansion, claims)

    if expansion.nonEmpty and support.insufficient:
        output.status = HYPOTHESIS
        output.flags += BLOCKED_SCOPE_EXPANSION
    else:
        output.status = conservativeStatus(claims)

    output.provenance = unionAll(claims.provenance)
    return PREVIEW(output, expansion, support)
```

### 13.8. Specialize

```text
function prepareSpecialization(parentId, restriction, addedFacts): Transaction
    parent = loadClaim(parentId)
    child = applyRestriction(parent, restriction)
    child.provenance = parent.provenance + parent.id

    if addedFacts.nonEmpty:
        evidence = resolveEvidence(addedFacts)
        if evidence.missing:
            child.status = UNSUPPORTED
            return BLOCKED(MISSING_EVIDENCE, child)
        child.provenance += evidence.provenance

    return PREVIEWED(child, checks)
```

### 13.9. Сборка абзаца

```text
function renderParagraph(claimIds, rhetoricalPlan): DraftFragment
    claims = requireReviewedClaims(claimIds)
    sentences = realizeClaimsWithoutScopeExpansion(claims, rhetoricalPlan)

    for sentence in sentences:
        mapped = mapSentenceToClaims(sentence, claims)
        citations = citationsFor(mapped.claims)
        if sentence.isFactual and citations.empty:
            sentence.status = UNSUPPORTED
        else:
            sentence.status = auditEntailment(sentence, mapped.claims, citations)

    return DraftFragment(sentences, sentenceMap, provenance)
```

### 13.10. Commit

```text
function commitTransformation(txId, currentProjectRevision, actor): CommitResult
    tx = loadTransaction(txId)
    require tx.status == HUMAN_APPROVED
    require tx.baseRevision == currentProjectRevision
    require hashesStillMatch(tx.inputSourceVersionHashes)
    require allRequiredChecksPass(tx.checks)

    append outputs
    append typed graph edges
    append ledger receipt
    never overwrite inputs

    return COMMITTED(newRevision, receiptHash)
```

### 13.11. Полный аудит перед экспортом

```text
function auditExport(project, document): AuditReport
    checks = []
    checks += resolveEveryCitation(document)
    checks += verifyEveryQuotedPassage(document)
    checks += mapEveryFactualSentence(document)
    checks += detectUnsupportedScopeExpansion(document)
    checks += detectHiddenContradictions(document)
    checks += detectRetractedOrSupersededSources(document)
    checks += detectCitationDependencyInflation(document)
    checks += plagiarismAndAttributionAudit(document)
    checks += verifyBibliographyRoundtrip(document)

    if any critical check fails:
        return BLOCKED(checks)
    if any review check unresolved:
        return REQUIRES_REVIEW(checks)
    return READY_FOR_HUMAN_EXPORT(checks)
```

---

## 14. Интерфейсный поток

### 14.1. Экран 1. Проект

Пользователь задаёт:

- тип работы;
- тему;
- исследовательский вопрос;
- язык;
- правила цитирования;
- временные и дисциплинарные границы;
- допустимые типы источников;
- локальные требования вуза или журнала.

Результат - версионированный `ProjectProtocol`.

### 14.2. Экран 2. Источники

Основная область - таблица источников, не карточки декора:

```text
status | author/year | title | type | version | identity | text | claims | warnings
```

Команды: импорт, проверить метаданные, открыть версию, отметить исключение. Источник нельзя удалить из истории после использования; можно исключить из активного корпуса.

### 14.3. Экран 3. Читатель источника

Слева - неизменяемый текст. Справа - passages, предложенные claims и qualifiers. Пользователь выделяет точный фрагмент, выбирает тип связи и подтверждает claim.

Кнопка «Подтвердить тезис» недоступна без passage и локатора.

### 14.4. Экран 4. Claim Workbench

Таблица:

```text
claim | scope | status | support | refute | conflicts | provenance | used in
```

Действия представлены привычными командами с иконками и подсказками:

- split;
- merge;
- compare;
- contradiction audit;
- generalize;
- specialize;
- attach evidence;
- retract.

Каждое действие сначала открывает preview различий `before/after`.

### 14.5. Экран 5. Operation Lab

Показывает:

1. входные claims;
2. выбранную операцию;
3. изменения текста и qualifiers;
4. источники до и после;
5. конфликты;
6. обязательные checks;
7. результат `READY/BLOCKED/ABSTAIN`;
8. кнопки approve, reject, edit, rollback.

### 14.6. Экран 6. Literature Graph

По умолчанию граф фильтруется по текущему вопросу. Пользователь переключает слои:

- sources;
- claims;
- evidence;
- methods;
- datasets;
- contradictions;
- topic combinations.

Визуальная близость всегда сопровождается числовым stress/quality-индикатором или пометкой, что раскладка декоративна.

### 14.7. Экран 7. План работы

Разделы диплома/обзора отображаются как полноширинная структура. Для каждого раздела показаны:

- цель;
- claims;
- источники;
- неподтверждённые места;
- конфликты;
- готовность;
- ответственный авторский вывод.

### 14.8. Экран 8. Draft Editor

Основной текст остаётся читаемым. Служебная панель показывает для выбранного предложения:

- связанные claims;
- passages;
- citation intent;
- статус поддержки;
- риск перефразирования;
- историю изменений.

Автогенерация создаёт отдельный preview. Она не заменяет выделенный текст без подтверждения.

### 14.9. Экран 9. Audit Console

Фильтры:

```text
missing citation
weak locator
unsupported claim
scope expansion
unresolved contradiction
retracted source
dependent evidence
close paraphrase
unverified quote
stale transformation
```

Экспорт заблокирован только критическими нарушениями. Некритические замечания остаются в отчёте.

---

## 15. Функциональные требования

### 15.1. Источники

- **FR-SRC-001:** система создаёт стабильный `SourceId` и отдельный `SourceVersionId`.
- **FR-SRC-002:** байты каждой локальной версии имеют криптографический hash.
- **FR-SRC-003:** повторный импорт идентичного файла обнаруживается как дубликат.
- **FR-SRC-004:** исправленная или новая версия не перезаписывает старую.
- **FR-SRC-005:** поддерживаются точные locators минимум для страниц, разделов и text offsets.
- **FR-SRC-006:** OCR confidence хранится отдельно от epistemic confidence.
- **FR-SRC-007:** отозванный источник немедленно получает предупреждение во всех зависимых claims.
- **FR-SRC-008:** метаданные имеют собственный provenance.

### 15.2. Claims и evidence

- **FR-CLM-001:** claim может существовать без принятого evidence, но только со статусом `UNSUPPORTED/UNKNOWN/HYPOTHESIS`.
- **FR-CLM-002:** evidence связывается с claim через типизированное ребро.
- **FR-CLM-003:** `MENTIONS` не считается поддержкой.
- **FR-CLM-004:** qualifiers сохраняются как структурные поля.
- **FR-CLM-005:** изменение формулировки создаёт новую revision.
- **FR-CLM-006:** каждый claim имеет content hash.
- **FR-CLM-007:** автоматическое извлечение всегда требует review.
- **FR-CLM-008:** одна связь evidence-claim может быть отклонена без удаления passage.

### 15.3. Операции

- **FR-OPS-001:** реализуются `merge/split/compare/contradict/generalize/specialize`.
- **FR-OPS-002:** каждая операция создаёт `Transformation`.
- **FR-OPS-003:** входные snapshots проверяются перед commit.
- **FR-OPS-004:** все операции имеют preview и rollback.
- **FR-OPS-005:** provenance output является надмножеством требуемого provenance input.
- **FR-OPS-006:** конфликт не исчезает без `resolveConflict`.
- **FR-OPS-007:** generalize проверяет изменение scope и quantifier.
- **FR-OPS-008:** specialize отличает логическое ограничение от нового эмпирического факта.
- **FR-OPS-009:** compare возвращает `NOT_COMPARABLE`, а не искусственный рейтинг.
- **FR-OPS-010:** повтор операции на тех же snapshots и версии алгоритма детерминирован по структуре результата.

### 15.4. Черновик и цитирование

- **FR-DRF-001:** каждое фактическое предложение связано минимум с одним claim.
- **FR-DRF-002:** каждая цитата разрешается в SourceVersion и Passage.
- **FR-DRF-003:** quote, paraphrase, translation и authorial text визуально и структурно различаются.
- **FR-DRF-004:** bibliography roundtrip не меняет идентификаторы источника.
- **FR-DRF-005:** экспорт не скрывает unresolved markers.
- **FR-DRF-006:** citation style влияет на оформление, но не на внутреннюю модель.
- **FR-DRF-007:** система показывает citation intent: background, support, contrast, method, data или critique.

### 15.5. Новые сочетания

- **FR-CMB-001:** комбинация тем всегда создаётся как `HYPOTHESIS`.
- **FR-CMB-002:** карточка содержит мостовые claims и missing links.
- **FR-CMB-003:** novelty не объявляется без поискового протокола.
- **FR-CMB-004:** несовместимость определений и данных отображается до предложения метода.

---

## 16. Нефункциональные требования

- **NFR-001, воспроизводимость:** одинаковый проектный snapshot и версии модулей дают одинаковый граф и checks.
- **NFR-002, аудит:** любое изменение восстанавливается до actor, времени, входов и алгоритма.
- **NFR-003, fail-closed:** повреждённый hash, пропавший passage или неизвестная версия блокируют подтверждённый экспорт.
- **NFR-004, локальная работа:** базовые операции доступны без сети после импорта источников.
- **NFR-005, масштаб:** MVP поддерживает не менее 1 000 источников, 100 000 passages и 50 000 claims в одном проекте.
- **NFR-006, производительность:** фильтрация claim table до 200 мс на целевом объёме; открытие source reader до 500 мс без OCR.
- **NFR-007, доступность:** все статусы различимы не только цветом; клавиатурная навигация обязательна.
- **NFR-008, переносимость:** полный проект экспортируется без закрытого векторного индекса.
- **NFR-009, приватность:** внешняя передача текста требует явного provider profile и consent.
- **NFR-010, безопасность:** HTML и metadata источников рассматриваются как недоверенные данные.
- **NFR-011, наблюдаемость:** ошибки parser/retrieval/model не скрываются под пустым успешным результатом.
- **NFR-012, обратимость:** commit любой операции можно отменить новой ledger-записью без удаления истории.

---

## 17. Плагиат, галлюцинации и научная добросовестность

### 17.1. Риски плагиата

1. дословное копирование без кавычек;
2. близкий парафраз без ссылки;
3. мозаичное соединение фраз нескольких авторов;
4. перевод как способ скрыть копирование;
5. повторное использование собственного текста без раскрытия;
6. присвоение структуры аргумента без ссылки;
7. ссылка на вторичный источник при фактическом использовании первичного пересказа.

### 17.2. Контроль плагиата

Система должна:

- сравнивать draft с локальным source vault;
- показывать совпавший passage и тип сходства;
- отдельно проверять exact quote и paraphrase;
- требовать кавычки и locator для прямой цитаты;
- хранить translation provenance;
- позволять дисциплинарные пороги;
- не выносить окончательный юридический или академический вердикт автоматически.

Similarity score является сигналом проверки, а не доказательством нарушения.

### 17.3. Риски галлюцинаций

- выдуманный DOI, автор, название или страница;
- реальная ссылка, не поддерживающая claim;
- смешение результатов двух источников;
- выдуманное число или размер эффекта;
- скрытая смена популяции;
- причинная формулировка из корреляции;
- фиктивное согласие литературы;
- несуществующая цитата;
- «исследования показывают» без перечисления исследований;
- уверенное заполнение отсутствующей информации.

### 17.4. Fail-closed политика

```text
reference not resolved      -> UNAVAILABLE
passage not found           -> BLOCKED_LOCATOR
support not adjudicated     -> PENDING_REVIEW
scope mismatch              -> BLOCKED_SCOPE
conflicting evidence        -> CONTESTED
model-only factual claim    -> UNSUPPORTED
novelty not searched        -> NOT_CHECKED
formula not verified        -> SOUNDNESS_NOT_COMPUTED
```

### 17.5. Prompt injection в источниках

Текст импортированного документа является данными. Фразы внутри него не могут менять правила агента, отключать checks, раскрывать секреты или запускать инструменты. Parser и model adapter обязаны отделять system policy от source content.

### 17.6. Авторство

Система хранит вклад:

```text
human-authored
machine-suggested-human-edited
machine-suggested-human-approved
quoted
translated
```

Правила раскрытия использования AI определяются вузом, журналом или организацией и загружаются как `ProjectProtocol`.

---

## 18. Границы автоматизации

### 18.1. Можно автоматизировать полностью

- hashing и проверку неизменности;
- поиск точных дубликатов;
- разрешение локальных ссылок;
- форматирование библиографии;
- структурную валидацию схем;
- распространение предупреждения об отозванном источнике;
- проверку, что claim имеет passage;
- построение provenance DAG;
- проверку freshness перед commit;
- воспроизводимый export manifest.

### 18.2. Можно автоматизировать как предложение

- выделение claims;
- split составного тезиса;
- merge совместимых тезисов;
- определение qualifiers;
- поиск кандидатов противоречий;
- тематическую кластеризацию;
- план обзора;
- парафраз;
- перевод;
- новые сочетания тем;
- черновой абзац.

Все такие результаты требуют review.

### 18.3. Требует человеческого решения

- соответствует ли passage claim;
- является ли расхождение настоящим научным противоречием;
- достаточно ли методов для обобщения;
- оправдана ли причинная интерпретация;
- является ли идея научно новой;
- корректна ли методология будущего исследования;
- допустимо ли использование текста по правилам организации;
- готова ли работа к публикации или защите.

### 18.4. Запрещено автоматизировать как готовый факт

- выдумывание источника;
- выдумывание результатов эксперимента;
- автоматическая подмена неподдержанного утверждения «правдоподобным»;
- удаление неудобного противоречия;
- автоматическое присвоение статуса `PROVEN` по числу ссылок;
- утверждение об отсутствии плагиата только по локальной базе;
- утверждение об исчерпывающем обзоре без протокола поиска.

---

## 19. Тестовая стратегия

### 19.1. Unit tests

Обязательные группы:

- Source/SourceVersion identity;
- locator parsing;
- passage hashing;
- claim revision;
- evidence link types;
- provenance traversal;
- operation pre/postconditions;
- citation resolution;
- independence grouping;
- epistemic status transitions;
- ledger freshness and rollback.

### 19.2. Property tests

1. `split` не уменьшает provenance closure.
2. `merge` не удаляет unresolved conflicts.
3. `rollback(commit(x))` восстанавливает прежний активный snapshot.
4. повторный import одинаковых bytes не создаёт новую версию.
5. изменение одного байта создаёт новый content hash.
6. `compare(A,B)` и `compare(B,A)` сохраняют те же dimensions с переставленными сторонами.
7. `generalize` с расширенным scope без evidence никогда не даёт `SUPPORTED`.
8. `specialize` с новым фактом без evidence блокируется.
9. удаление индекса не меняет source vault и ledger.
10. экспорт и повторный импорт сохраняют IDs и hashes.

### 19.3. Metamorphic tests

- перестановка входных claims не меняет provenance set merge;
- добавление дублирующего обзора в ту же independence group не удваивает поддержку;
- замена активного источника на retracted переводит зависимые claims в предупреждающий статус;
- изменение qualifiers превращает кажущееся противоречие в scope-resolved;
- удаление точного locator блокирует quote, но не удаляет Source;
- замена `may` на `causes` обнаруживается как modality expansion.

### 19.4. Adversarial corpus

Минимальный корпус должен содержать:

1. две согласующиеся независимые первичные работы;
2. обзор, повторяющий одну из них;
3. настоящую репликацию;
4. статью с исправлением;
5. отозванную публикацию;
6. два текста с разными определениями одного термина;
7. ложный конфликт из-за разных популяций;
8. настоящий количественный конфликт;
9. correlation/causation trap;
10. абстракт без подтверждения в полном тексте;
11. документ с ошибочным OCR отрицанием;
12. passage, где источник упомянут критически;
13. цитату через вторичный источник;
14. грамматически идеальный, но неподдержанный model claim;
15. близкий парафраз для plagiarism audit;
16. formula chain с пропущенным предположением;
17. formula chain с корректным special case;
18. русскую и переводную версии одного текста.

### 19.5. Golden set

Эксперты вручную размечают:

- границы claims;
- qualifiers;
- support/refute/mention;
- genuine/scope/terminology contradiction;
- источники и locators;
- допустимые merge/split;
- риски обобщения;
- sentence-to-claim map.

Train/dev/test разделяются по источникам, а не по отдельным предложениям, чтобы фрагменты одной статьи не попадали одновременно в обучение и проверку.

### 19.6. Метрики оценки

```text
claim boundary precision/recall
qualifier preservation rate
evidence relation macro-F1
locator resolution accuracy
provenance completeness
conflict recall at fixed precision
unsupported sentence rate
citation entailment accuracy
scope expansion error rate
duplicate-evidence inflation rate
human correction time
human rejection rate
```

Главные guardrail-метрики:

```text
fabricated reference rate = 0
lost provenance rate = 0
hidden known conflict rate = 0
silent unsupported factual export rate = 0
```

### 19.7. E2E-сценарии

#### Сценарий A. Детализация факта

1. импортировать источник;
2. выделить compound claim;
3. выполнить split;
4. отклонить evidence для одного child;
5. убедиться, что второй child не наследует ложную поддержку;
6. экспортировать audit report.

#### Сценарий B. Слияние обзора

1. импортировать три независимых исследования и один обзор;
2. сгруппировать зависимое evidence;
3. выполнить consensus merge;
4. проверить отсутствие четырёхкратного счёта;
5. получить абзац с тремя первичными источниками и отдельной ссылкой на обзор.

#### Сценарий C. Противоречие

1. загрузить два противоположных вывода;
2. выровнять определения и scope;
3. подтвердить genuine conflict;
4. создать controversy paragraph;
5. проверить наличие обеих сторон и locators.

#### Сценарий D. Диссертация

1. задать вопрос и протокол;
2. построить literature graph;
3. сформировать план глав;
4. связать claims с разделами;
5. создать черновой обзор;
6. увидеть неподтверждённые предложения;
7. исправить их;
8. пройти citation audit;
9. экспортировать текст, библиографию и provenance manifest.

#### Сценарий E. Stale и rollback

1. подготовить merge;
2. изменить один исходный claim;
3. попытка commit получает `STALE`;
4. пересчитать preview;
5. commit;
6. rollback создаёт новую ledger-запись и восстанавливает активную версию.

---

## 20. Критерии приёмки

### 20.1. MVP считается принятым, если

1. импортируются PDF/TXT/HTML или их заранее извлечённые локальные версии;
2. каждый source version имеет hash;
3. passage имеет стабильный locator;
4. пользователь может создать и проверить claim;
5. evidence связывается как support/refute/qualify/mention;
6. реализованы все шесть обязательных операций;
7. merge и split проходят инварианты provenance;
8. genuine conflict нельзя скрыть merge;
9. generalize блокирует неподдержанное расширение scope;
10. draft sentence связан с claim и citation;
11. выдуманная ссылка не может пройти validation;
12. retracted source распространяет предупреждение;
13. все операции имеют preview, commit, stale и rollback;
14. проект экспортируется вместе с provenance manifest;
15. guardrail tests дают ноль потери provenance и ноль выдуманных ссылок.

### 20.2. Научный vertical slice

Вертикальный срез должен обработать один реальный небольшой обзор:

```text
20-40 источников
100-300 passages
50-150 reviewed claims
не менее 5 сравнений
не менее 2 настоящих или разрешённых конфликтов
не менее 3 merge
не менее 3 split
один план обзора
3-5 проверенных абзацев
полный provenance export
```

### 20.3. Нельзя объявлять готовность, если

- система лишь генерирует текст со списком ссылок;
- passages не имеют точных locators;
- evidence и citation являются одним объектом;
- конфликты определяются только cosine similarity;
- удаление исходного файла разрушает происхождение без предупреждения;
- пользователь не видит, что было создано моделью;
- неподтверждённые factual sentences экспортируются без маркировки;
- тесты проверяют только формат JSON, но не научные инварианты.

---

## 21. Этапы реализации

### Этап 0. Зафиксировать протокол

Результаты:

- словарь терминов;
- JSON Schema доменных объектов;
- transition table статусов;
- список критических checks;
- fixture из 5-10 открытых источников;
- правила хранения прав и приватности.

### Этап 1. Source Vault

Реализовать Source, SourceVersion, Passage, Locator, hashes, import/export и source reader.

**Gate:** точная цитата всегда восстанавливается до версии и локатора.

### Этап 2. Claim/Evidence Ledger

Реализовать claims, qualifiers, evidence links, revisions и ручную проверку.

**Gate:** ссылка и доказательная связь структурно разделены.

### Этап 3. Fission

Реализовать `split` и `specialize`, preview, qualifier conservation, provenance closure.

**Gate:** ни один child не получает подтверждение автоматически.

### Этап 4. Comparison and Contradiction

Реализовать матрицу сравнения, scope alignment и conflict register.

**Gate:** тестовый ложный конфликт разрешается по scope, настоящий сохраняется.

### Этап 5. Fusion

Реализовать режимы merge и independence grouping.

**Gate:** обзор-дубликат не увеличивает число независимых подтверждений.

### Этап 6. Generalization

Реализовать `generalize`, scope diff и hypothesis fallback.

**Gate:** `some -> all` без evidence всегда блокируется.

### Этап 7. Literature Graph and Topic Combinations

Реализовать граф и карточки гипотез.

**Gate:** перспективное сочетание не отображается как установленная новизна.

### Этап 8. Drafting

Реализовать outline, sentence-to-claim map, citation intents и paragraph renderer.

**Gate:** `DraftCoverage=1` для статуса verified draft.

### Этап 9. Integrity and Plagiarism Audit

Реализовать close-paraphrase signals, quote verification, retraction propagation и export audit.

**Gate:** известные нарушения adversarial corpus обнаруживаются и блокируют готовый экспорт.

### Этап 10. Опциональная интеграция P78/P79/P80

- P78 визуализирует операции на кольце;
- P79 проверяет последовательность и roundtrip экспорта;
- P80 отображает одно-битные диагностические состояния.

**Gate:** отключение всех трёх интерфейсов не меняет научный результат ядра.

---

## 22. Приоритет: чего не хватает больше всего

Самый большой дефицит проекта - не генератор красивого текста и не ещё одна формула. Не хватает **доказательного субстрата**, на котором любая семантическая операция может быть перепроверена:

```text
immutable source version
+ exact passage
+ atomic claim
+ typed evidence relation
+ provenance DAG
+ human review decision
```

Без этого:

- merge превращается в свободное суммирование;
- split может незаметно исказить исходник;
- contradiction зависит от поверхностной похожести;
- generalize становится галлюцинацией масштаба;
- библиография выглядит точной, но не доказывает текст;
- LLM ускоряет написание, но одновременно ускоряет citation drift.

Поэтому первая реализация должна начинаться с Source Vault и Claim/Evidence Ledger. Embeddings, LLM, P78-графика, Q6 и генерация новых тем подключаются после того, как инварианты происхождения проверяются автоматически.

---

## 23. Основные риски проекта

| Риск | Последствие | Мера |
|---|---|---|
| слишком ранняя генерация текста | красивый неподтверждённый результат | сначала claim graph, потом drafting |
| смешение citation и evidence | ссылка выглядит как подтверждение | отдельные сущности и adjudication |
| потеря qualifiers | ложное обобщение | структурные scope fields и diff |
| двойной счёт обзоров | фиктивный консенсус | independence groups |
| слабый OCR | изменённая цитата | confidence + human verification |
| version drift | ссылка ведёт не на тот текст | immutable SourceVersion + hash |
| ложные конфликты | лишняя полемика | terminology/scope alignment |
| скрытые конфликты | односторонний обзор | conflict register как инвариант |
| чрезмерное доверие similarity | семантическая переуверенность | retrieval only, no truth status |
| prompt injection | обход правил | source content как недоверенные данные |
| лицензионные ограничения | неправомерное хранение/экспорт | RightsProfile и export policy |
| privacy leak | утечка рукописи или данных | local-first и explicit consent |
| автоматическое авторство | нарушение правил вуза | contribution ledger и disclosure |
| scope explosion | продукт никогда не стабилизируется | вертикальный срез 20-40 источников |

---

## 24. Открытые решения до кода

1. Какой набор форматов входит в первый импорт: PDF/TXT/HTML/DOCX?
2. Как хранить page locators после разных PDF parsers?
3. Какие citation styles обязательны для первого vertical slice?
4. Нужна ли совместная работа нескольких пользователей в MVP?
5. Какой минимальный русский морфологический анализатор допустим локально?
6. Какие дисциплины используются в golden set: гуманитарная, социальная, техническая или смешанная?
7. Кто выполняет human adjudication и как измеряется согласие экспертов?
8. Какие права хранения полных текстов разрешены для каждого проекта?
9. Нужно ли интегрировать DOI/Crossref/ORCID позже или сначала работать с ручными метаданными?
10. Какой формальный язык использовать для FormulaGraph?
11. Как отличать author's own inference от source-backed claim в UI и экспорте?
12. Какой уровень close-paraphrase требует предупреждения в конкретной организации?

Эти вопросы не блокируют проектирование ядра, но должны быть решены в `ProjectProtocol` или до соответствующего этапа.

---

## 25. Итоговая формулировка продукта

> **MERIDIAN Scientific Synthesis - это provenance-first помощник научного письма, который превращает источники в проверяемый граф тезисов, позволяет безопасно разделять и объединять знания и создаёт черновой текст только вместе с видимым путём доказательств, конфликтов и человеческих решений.**

Его инновация не в обещании автоматически «понять всю науку», а в сочетании шести свойств:

1. научная единица работы - claim, а не абзац;
2. citation отделена от evidence;
3. merge и split подчинены законам сохранения provenance;
4. противоречие является сохраняемым объектом;
5. новые сочетания тем оформляются как проверяемые гипотезы;
6. генерация текста находится в конце доказательного конвейера, а не в его начале.

Так ветвь остаётся совместимой с философией MERIDIAN - движение между обобщением и детализацией - но получает самостоятельное техническое и научно-гуманитарное основание.

