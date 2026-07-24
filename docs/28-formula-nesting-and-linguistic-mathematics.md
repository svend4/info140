# 28 - Матрёшка формул -> лингвистическая математика

> Проектная спецификация отдельной ветки MERIDIAN Semantic Lab.
>
> **Статус:** `DESIGN / NOT IMPLEMENTED`.
>
> **Назначение:** сначала построить проверяемую систему вложенных формул, а затем перенести тот же принцип типизированной композиции на цепочку `слово -> смысл -> отношение -> фраза`.
>
> **Граница честности:** математическая корректность формулы, эмпирическая пригодность метрики и гуманитарная осмысленность текста являются тремя разными свойствами. Ни одно из них не выводится автоматически из двух других.

---

## 1. Краткое решение

Ветка должна состоять из двух последовательно подключаемых, но логически независимых контуров.

1. **Formula Nesting Core** строит реестр формул, проверяет типы и размерности, разворачивает граф зависимостей, исполняет композиции, хранит доказательства и воспроизводимые контрпримеры, после чего выбирает следующую допустимую формулу.
2. **Linguistic Mathematics Bridge** переносит тот же механизм на тезаурус: различает словоформу и значение, типизирует отношения между значениями, строит утверждения, выбирает следующий информационный ход и реализует его как проверяемую фразу.

Рекомендуемый порядок:

```text
значения
  -> атомарные формулы
  -> типизированные композиции
  -> доказательные обязательства
  -> следующая формула
  -> значения слов
  -> типизированные отношения
  -> утверждения
  -> дискурсивный план
  -> фраза с картой происхождения
```

Это **самостоятельная 2D-ветка**. Для её работы не требуются ни P79/1D, ни P80/Q6/3D:

- P79 может позднее проверять точность сериализации и replay;
- P80 может позднее давать структурные контрфакты;
- решение о выборе, preview, commit и rollback остаётся внутри P78 и его action controller;
- отсутствие обоих соседей не должно переводить Formula Nesting Core в неполный режим.

---

## 2. Что уже есть и что отсутствует

### 2.1. Повторно используемая основа

Проект уже содержит части будущей системы:

| Источник | Что можно переиспользовать | Чего источник не доказывает |
|---|---|---|
| [`12-humanitarian-formula-of-meaning.md`](12-humanitarian-formula-of-meaning.md) | оси роста, новизны, открытости и баланса; траекторный характер `Phi` | что эти оси измеряют человеческий смысл |
| [`14-ladder-number-formula-theorem-word.md`](14-ladder-number-formula-theorem-word.md) | различение `FRM`, `THM`, `MERO`, контракт `pre/inv/post/proof` | истинность формул и доказательств |
| [`19-mathematics-of-reasonable-circulation.md`](19-mathematics-of-reasonable-circulation.md) | проверяемые формулы движения, инварианты и ограничения аналогии | тождество динамики и семантики |
| [`24-p78-ramsey-parallels.md`](24-p78-ramsey-parallels.md) | пороговый граф, четыре давления, запрет прямого переноса теоремы в гуманитарный вывод | что клика является «обобщением», а независимое множество - «распадом» |
| [`26-three-neighbor-worlds-protocol.md`](26-three-neighbor-worlds-protocol.md) | fail-closed обмен и право P78 быть единственным арбитром текста | необходимость 1D или 3D для семантики P78 |
| `semantic-command-dsl.js` | AST без `eval`, типы `QTY/ORD/ID/OP/STATE/EFFECT`, точная стыковка портов | размерностную корректность и математическую истинность |
| `semantic-core.js` | локальный словарь, LCA/path, SemFit, граф, guard, backtrack, `semanticPhi` | универсальное понимание языка |
| `semantic-language.js` | словоформы, ограниченная морфология, полисемия, agreement и valency | полный русский parser или разрешение неизвестного смысла |
| `semantic-data-evidence.js` | локальный корпус, provenance, честный `ABSTAIN` | внешнюю валидность корпуса |
| `semantic-decision.js` и `semantic-transaction.js` | fail-closed решение, структурная проверка, CAS commit/rollback | истинность вставляемой фразы |

### 2.2. Главные разрывы

Сейчас отсутствуют:

1. канонический версионированный реестр формул;
2. адресуемые подформулы вместо крупных монолитных функций;
3. типы величин более точные, чем общий `QTY`;
4. размерности и единицы измерения;
5. явный вычислительный DAG зависимостей;
6. доказательные артефакты, которые можно проверить независимо;
7. реестр минимальных воспроизводимых контрпримеров;
8. вычислитель следующей формулы с явными основаниями выбора;
9. разделение математического, эмпирического и гуманитарного статусов;
10. тезаурус, в котором слово не смешано со значением;
11. типизированная алгебра семантических отношений;
12. генератор фразы, где каждое утверждение связано с источником или выводом.

### 2.3. Конкретная проблема текущей `Phi`

В [`12-humanitarian-formula-of-meaning.md`](12-humanitarian-formula-of-meaning.md) задана траекторная формула:

```math
Phi(T) = <M(lambda)> * avg(g_t * N_t * kappa_t) * kappa_end.
```

Текущий `semantic-core.js` вычисляет другую эвристику:

```math
Phi_local = sqrt(growth * novelty * openness * balance).
```

Обе записи могут быть полезны, но это **две разные формулы**. Новая ветка запрещает называть их одним неверсированным именем. Они должны получить разные идентификаторы, например:

```text
mrd:formula:vitality.trajectory@1.0.0
mrd:formula:vitality.snapshot-geomean@1.0.0
```

Реестр обязан показывать, какая именно версия участвовала в результате.

---

## 3. Цели и нецели

### 3.1. Цели

- Любой числовой результат раскладывается до атомарных формул и исходных значений.
- Любая формула имеет типизированные входы и выходы.
- Незаконное сложение величин, несовместимые единицы и повреждённая композиция блокируются до исполнения.
- Граф вычисления детерминирован и воспроизводим.
- Доказательство, тест и калибровка хранятся как разные виды свидетельства.
- Контрпример является полноправным артефактом и может быть повторно исполнен.
- Следующая формула выбирается только из математически допустимых кандидатов.
- Тезаурус хранит словоформы, значения, отношения и фразы как разные типы данных.
- Каждое предложение энциклопедического режима имеет карту поддерживающих утверждений.
- Неизвестность приводит к `ABSTAIN` или запросу уточнения, а не к выдуманному факту.

### 3.2. Нецели первого этапа

- Полное понимание произвольного русского текста.
- Автоматическое доказательство всех математических утверждений.
- Замена формальной математикой гуманитарной интерпретации.
- Генерация литературно богатого текста без ограниченного плана утверждений.
- Подключение внешней языковой модели как источника истины.
- Прямое изменение текста из Formula Core или тезауруса в обход P78 action controller.
- Обязательное участие P79 или P80.

---

## 4. Архитектура ветки

```text
┌──────────────────────────────────────────────────────────────┐
│                    P78 action controller                     │
│        preview -> exact transaction -> commit/rollback       │
└──────────────────────────────▲───────────────────────────────┘
                               │ typed report
┌──────────────────────────────┴───────────────────────────────┐
│                 Linguistic Mathematics Bridge                │
│ occurrence -> sense -> relation -> proposition -> sentence   │
└──────────────────────────────▲───────────────────────────────┘
                               │ InterpretationMap
┌──────────────────────────────┴───────────────────────────────┐
│                    Formula Nesting Core                       │
│ registry -> type/dim check -> DAG -> proof -> next formula   │
└──────────────────────────────▲───────────────────────────────┘
                               │ immutable values
┌──────────────────────────────┴───────────────────────────────┐
│                local data / corpus / provenance               │
└──────────────────────────────────────────────────────────────┘
```

Правило зависимости строго одностороннее:

```text
математика может существовать без словесной интерпретации;
интерпретация не может объявить математический результат истинным;
фраза не может создать новый факт только потому, что она грамматична.
```

---

## 5. Система типов

### 5.1. Почему `QTY` недостаточно

`QTY` не различает секунды, метры, вероятность, баланс кольца и показатель новизны. Все они могут быть числами `[0,1]`, но их прямое сложение не становится осмысленным автоматически.

Новая система использует три независимых признака:

```text
ValueType   - форма значения: Real, Int, Bool, Vector, Graph, Text...
Dimension   - физическая/счётная размерность.
MeasureKind - смысл измерительной шкалы: Probability, Novelty, Balance...
```

### 5.2. Базовые типы

```ts
type Primitive =
  | "Real"
  | "Int"
  | "Bool"
  | "Symbol"
  | "Text"
  | "Timestamp";

type Container =
  | { kind: "Vector"; item: TypeRef; length: number | "dynamic" }
  | { kind: "Matrix"; item: TypeRef; rows: number; cols: number }
  | { kind: "Set"; item: TypeRef }
  | { kind: "Tuple"; items: TypeRef[] }
  | { kind: "Graph"; vertex: TypeRef; edge: TypeRef }
  | { kind: "Result"; ok: TypeRef; error: "FormulaError" };

type SemanticType =
  | "LexemeId"
  | "OccurrenceId"
  | "SenseId"
  | "RelationTypeId"
  | "RelationAssertionId"
  | "PropositionId"
  | "FrameId"
  | "Sentence"
  | "Passage";
```

Общие ссылочные типы всех контрактов:

```ts
type FormulaRef = {
  formulaId: string;
  version: string;
  contentHash: string;
};

type TypeRef =
  | Primitive
  | Container
  | SemanticType
  | QuantityType;

type TypedValue = {
  type: TypeRef;
  value: unknown;
  valueHash: string;
  provenance: ProvenanceRecord;
};

type PredicateRef = {
  predicateId: string;
  version: string;
  bindings: Record<string, string>;
};

type PropositionRef = {
  propositionId: string;
  revision: string;
};

type ClaimRef = {
  claimId: string;
  revision: string;
};

type FormulaDependency = {
  kind: DependencyKind;
  formula: FormulaRef;
  bindings: Record<string, string>;
};

type ProvenanceRecord = {
  sourceType: "PROJECT" | "CORPUS" | "PUBLICATION" | "USER" | "DERIVATION";
  sourceId: string;
  sourceRevision: string | null;
  retrievedAt: string | null;
  license: string | null;
  parentHashes: string[];
};
```

Поля `unknown` выше означают сериализуемое JSON-значение, которое дополнительно проверяется по `TypeRef`. DOM-узлы, функции, class instances и циклические объекты недопустимы.

### 5.3. Размерность и единица

```ts
type DimensionVector = {
  length: number;
  mass: number;
  time: number;
  current: number;
  temperature: number;
  amount: number;
  luminosity: number;
};

type UnitSpec = {
  id: string;                 // "1", "s", "m", "rad", "token", "step"
  dimension: DimensionVector;
  scaleToCanonical: number;
  offsetToCanonical: number;  // для аффинных шкал
};
```

Для большинства метрик MERIDIAN `DimensionVector = 0`, но нулевая физическая размерность не отменяет `MeasureKind`.

### 5.4. Вид меры как phantom type

```ts
type MeasureKind =
  | "PureNumber"
  | "Probability"
  | "UnitInterval"
  | "Angle"
  | "RingCoordinate"
  | "RingBalance"
  | "Growth"
  | "Novelty"
  | "Openness"
  | "GrammarScore"
  | "SemanticFit"
  | "EvidenceCoverage"
  | "PolicyScore";

type QuantityType = {
  valueType: "Real" | "Int";
  dimension: DimensionVector;
  unit: string;
  measureKind: MeasureKind;
  interval?: { min: number; max: number; closedMin: boolean; closedMax: boolean };
};
```

`RingBalance` и `Novelty` оба лежат в `[0,1]`, но оператор `add` не должен принимать их напрямую. Их соединяет только явно зарегистрированная политика:

```text
weightedBlend(
  balance: UnitInterval<RingBalance>,
  novelty: UnitInterval<Novelty>,
  weights: Simplex<2>
) -> UnitInterval<PolicyScore>
```

Так коэффициенты перестают быть скрытой «математической истиной» и становятся видимой политикой.

### 5.5. Правила размерностной проверки

```math
dim(a + b) is defined iff dim(a) = dim(b) and kind(a) = kind(b)
dim(a * b) = dim(a) + dim(b)
dim(a / b) = dim(a) - dim(b)
dim(a^p) = p * dim(a), if p is dimensionless
log(a), exp(a), sin(a) require a dimensionless canonical argument
compare(a,b) requires compatible dimensions and units
```

Дополнительные правила:

- угол хранится как физически безразмерный, но имеет `MeasureKind=Angle`;
- `degree -> radian` требует явного преобразования;
- счётчики `token` и `step` не складываются;
- нормализация в `[0,1]` является отдельной формулой с записанными границами;
- clamp не исправляет недопустимый вход молча: сначала возвращается ошибка контракта;
- `NaN`, `Infinity` и нечисловые значения запрещены на границе реестра.

---

## 6. Реестр типизированных формул

### 6.1. Контракт `FormulaRecord`

```ts
type FormulaRecord = {
  schema: "meridian.formula/1";
  formulaId: string;          // mrd:formula:ring.balance
  version: string;            // SemVer
  contentHash: string;        // sha256 canonical JSON
  title: string;

  layer: "MATHEMATICAL" | "EMPIRICAL_POLICY" | "INTERPRETATION";
  kind: "ATOM" | "COMPOSITE" | "PREDICATE" | "AGGREGATOR" | "FIXPOINT";
  lifecycle: "DRAFT" | "ACTIVE" | "DEPRECATED" | "RETRACTED";

  inputs: PortSpec[];
  output: PortSpec;
  expression: FormulaAst;

  contract: {
    pre: PredicateRef[];
    invariants: PredicateRef[];
    post: PredicateRef[];
    totality: "TOTAL" | "PARTIAL";
    deterministic: boolean;
    numericPolicy: NumericPolicy;
  };

  dependencies: FormulaDependency[];
  claims: ClaimRef[];
  evidence: EvidenceVector;
  provenance: ProvenanceRecord;

  implementation: {
    evaluator: string;        // имя закрытого обработчика, не код
    complexity: string;       // например O(1), O(V+E)
    maxOperations: number;
  };
};
```

### 6.2. Порты

```ts
type PortSpec = {
  name: string;
  type: TypeRef;
  required: boolean;
  description: string;
};
```

Совместимость портов:

```text
ValueType совпадает;
Dimension совпадает;
единицы равны или существует явный конвертер;
MeasureKind совпадает либо подключена явная формула-переход;
интервал выхода не шире допустимого интервала входа;
post предыдущей формулы удовлетворяет pre следующей.
```

### 6.3. AST

Разрешён закрытый data-only AST:

```ts
type FormulaAst =
  | { node: "Literal"; value: number | boolean | string; type: TypeRef }
  | { node: "Input"; port: string }
  | { node: "Let"; name: string; value: FormulaAst; body: FormulaAst }
  | { node: "Call"; operation: string; args: FormulaAst[] }
  | { node: "Tuple"; items: FormulaAst[] }
  | { node: "If"; test: FormulaAst; then: FormulaAst; else: FormulaAst }
  | { node: "FormulaRef"; formulaId: string; version: string; bindings: Record<string, FormulaAst> };
```

Запрещены:

- `eval`;
- `new Function`;
- доступ к DOM, сети, времени и случайности;
- неограниченная рекурсия;
- незафиксированная версия зависимости;
- исполняемый JavaScript внутри JSON;
- скрытое чтение глобального состояния.

### 6.4. Идентичность и версии

Правила:

1. `formulaId` обозначает математическое назначение, а не UI-ярлык.
2. Любое изменение выражения, домена, единиц, коэффициентов или контракта требует новой версии.
3. Изменение только описания без изменения вычисления допускает patch-version.
4. Композит закрепляет точные версии всех зависимостей.
5. `contentHash` считается по canonical JSON без самого поля `contentHash`.
6. 32-битный FNV допустим как быстрая диагностическая метка P78, но не заменяет SHA-256 реестра.
7. `DEPRECATED` можно исполнять для replay; `RETRACTED` блокируется, кроме режима аудита.

### 6.5. Ошибки

```ts
type FormulaErrorCode =
  | "FORMULA_UNKNOWN"
  | "FORMULA_VERSION_MISSING"
  | "FORMULA_HASH_MISMATCH"
  | "AST_INVALID"
  | "TYPE_MISMATCH"
  | "DIMENSION_MISMATCH"
  | "MEASURE_KIND_MISMATCH"
  | "UNIT_CONVERSION_MISSING"
  | "DOMAIN_VIOLATION"
  | "PRECONDITION_FALSE"
  | "PRECONDITION_UNKNOWN"
  | "POSTCONDITION_FAILED"
  | "DEPENDENCY_CYCLE"
  | "DEPENDENCY_NOT_PROVED"
  | "NUMERIC_UNSTABLE"
  | "BUDGET_EXCEEDED"
  | "COUNTEREXAMPLE_ACTIVE"
  | "SOUNDNESS_REQUIRED"
  | "ABSTAIN";

type FormulaError = {
  code: FormulaErrorCode;
  formulaRef: string;
  port?: string;
  expected?: unknown;
  actual?: unknown;
  dependencyPath: string[];
  message: string;
};
```

---

## 7. Граф зависимостей

### 7.1. Два разных графа

Нельзя смешивать:

1. **Evaluation DAG** - направленный граф вычисления формул.
2. **Knowledge Graph** - тезаурусный граф смыслов и отношений.

Evaluation DAG обязан быть ациклическим. Knowledge Graph естественно может содержать циклы: `A relatedTo B`, `B relatedTo A`, взаимные ссылки, обратные отношения.

### 7.2. Типы рёбер формульного графа

```ts
type DependencyKind =
  | "USES"          // значение нужно для вычисления
  | "GUARDS"        // предикат разрешает вычисление
  | "PROVES"        // артефакт доказывает claim
  | "REFUTES"       // контрпример опровергает claim
  | "CALIBRATES"    // данные задают коэффициент/порог
  | "INTERPRETS"    // гуманитарная карта объясняет результат
  | "REALIZES";     // proposition превращается во фразу
```

Только `USES` и `GUARDS` входят в порядок вычисления. `PROVES/REFUTES` образуют отдельный proof graph. `INTERPRETS/REALIZES` не имеют права менять математическое значение.

### 7.3. Инварианты DAG

- точная версия каждого узла известна;
- все порты соединены по имени и типу;
- топологическая сортировка единственна после стабильного tie-break по `formulaId`;
- одна и та же пара `formulaId@version + canonical inputs` даёт один результат;
- ни один узел не читает результат потомка;
- ошибки не превращаются в нули;
- частичная формула возвращает `Result`, а не неявное исключение;
- каждый итог хранит полный `dependencyPath`.

### 7.4. Циклы и фиксированные точки

Обычный цикл запрещён:

```text
F -> G -> H -> F  => DEPENDENCY_CYCLE
```

Цикл допускается только как один зарегистрированный `FIXPOINT`-узел:

```ts
type FixedPointContract = {
  metric: string;
  tolerance: number;
  maxIterations: number;
  convergenceClaim: ClaimRef;
  onNoConvergence: "ABSTAIN" | "RETURN_INTERVAL";
};
```

Без доказательства сжатия, монотонности на полной решётке или другого явно названного основания fixed-point остаётся `MATHEMATICAL=NOT_COMPUTED` и не может использоваться там, где требуется доказанный результат.

---

## 8. Композиция и «матрёшка»

### 8.1. Последовательная композиция

Пусть:

```math
F: A -> B
G: B -> C
H = G o F: A -> C.
```

Композиция допустима, если:

```math
Type(out_F) = Type(in_G)
Dim(out_F) = Dim(in_G)
Kind(out_F) = Kind(in_G)
Post_F(x,y) => Pre_G(y)
Inv_F and Inv_G are jointly satisfiable.
```

Контракт композита:

```math
Pre_H(x) =
  Pre_F(x)
  and obligation(Post_F(x,y) => Pre_G(y)).

Post_H(x,z) =
  exists y: Post_F(x,y) and Post_G(y,z).
```

`obligation(...)` не считается доказанным только потому, что типы совпали.

### 8.2. Параллельная композиция

```math
(F tensor G)(a,b) = (F(a), G(b)).
```

Она используется, когда две независимые ветви рассчитывают, например, `Growth` и `Novelty`. Затем отдельная формула-политика может агрегировать их.

### 8.3. Ветвление

```math
H(x) = if P(x) then F(x) else G(x).
```

Требования:

- `P` возвращает `TRUE | FALSE | UNKNOWN`;
- при `UNKNOWN` выбирается только явно объявленная политика, по умолчанию `ABSTAIN`;
- выходы `F` и `G` имеют совместимый общий тип;
- обе ветви входят в dependency trace;
- неисполненная ветвь помечается `NOT_TAKEN`, а не исчезает.

### 8.4. Агрегация

Для разнородных осей запрещено обычное среднее без записи политики.

```math
PolicyScore =
  sum_i w_i * normalize_i(x_i),
  w_i >= 0,
  sum_i w_i = 1.
```

Каждая `normalize_i` и каждый `w_i` имеют provenance. Такая формула:

- математически корректна как взвешенная сумма;
- эмпирически невалидна до калибровки;
- гуманитарно не означает «разумность», пока это не подтверждено отдельным исследованием.

### 8.5. Уровни матрёшки

```text
L0 Value       - проверенное входное значение.
L1 Atom        - одна формула без FormulaRef.
L2 Composite   - композиция атомов.
L3 Contract    - pre/inv/post + proof obligations.
L4 Planner     - выбор следующего допустимого композита.
L5 Bridge      - интерпретация результата как proposition.
L6 Realization - proposition -> фраза.
```

Каждый внешний уровень хранит ссылки на внутренние, но не переписывает их.

---

## 9. Доказательства и контрпримеры

### 9.1. Вектор свидетельств

Один общий `confidence=0.83` запрещён. Используется ортогональный вектор:

```ts
type EvidenceVector = {
  integrity: "UNVERIFIED" | "HASH_VERIFIED";
  structural: "INVALID" | "VALID";
  mathematical:
    | "NOT_COMPUTED"
    | "CONDITIONAL"
    | "TESTED"
    | "PROVED"
    | "REFUTED";
  empirical:
    | "NOT_APPLICABLE"
    | "UNCALIBRATED"
    | "LOCAL_CALIBRATION"
    | "EXTERNAL_VALIDATION";
  interpretive:
    | "NOT_APPLICABLE"
    | "UNREVIEWED"
    | "ANNOTATED"
    | "HUMAN_REVIEWED"
    | "DISPUTED";
};
```

`TESTED` не повышается автоматически до `PROVED`. `PROVED` не повышается автоматически до `EXTERNAL_VALIDATION`. `HUMAN_REVIEWED` не делает формулу истинной.

### 9.2. Контракт доказательства

```ts
type ProofArtifact = {
  schema: "meridian.proof/1";
  proofId: string;
  claimId: string;
  formulaRefs: string[];
  logic: "ALGEBRAIC" | "INDUCTIVE" | "INTERVAL" | "SMT" | "LEAN" | "MANUAL";
  assumptions: PropositionRef[];
  certificate: unknown;
  checker: string;
  checkerVersion: string;
  result: "PROVED" | "FAILED" | "NOT_CHECKED";
  checkedAt: string | null;
  contentHash: string;
  provenance: ProvenanceRecord;
};
```

Для `MANUAL` требуется автор, дата, текст доказательства и независимый review-status. Для `SMT/LEAN` хранится проверяемый сертификат или исходник доказательства и версия проверяющего.

### 9.3. Контракт контрпримера

```ts
type CounterexampleRecord = {
  schema: "meridian.counterexample/1";
  counterexampleId: string;
  claimId: string;
  formulaRef: string;
  inputBindings: Record<string, TypedValue>;
  expectedProperty: PredicateRef;
  actualResult: TypedValue | FormulaError;
  minimized: boolean;
  replayHash: string;
  status: "ACTIVE" | "RESOLVED" | "INVALID";
  resolutionFormulaVersion?: string;
  provenance: ProvenanceRecord;
};
```

Активный контрпример к универсальному claim переводит claim в `REFUTED`. Он не обязательно запрещает саму формулу: формула может оставаться корректной на суженном домене после изменения precondition и версии.

### 9.4. Численная корректность

Для чисел с плавающей точкой каждая формула объявляет:

```ts
type NumericPolicy = {
  mode: "EXACT_INT" | "RATIONAL" | "FLOAT64" | "INTERVAL";
  absoluteTolerance: number;
  relativeTolerance: number;
  rounding: "NONE" | "HALF_EVEN" | "DOWN" | "UP";
  overflow: "ERROR";
};
```

Сравнение `a === b` для Float64 не является универсальным доказательством. Для тождеств предпочтительны рациональная арифметика, символьное упрощение или интервальная проверка.

---

## 10. Вычисление следующей формулы

### 10.1. Состояние планировщика

```ts
type FormulaPlanningState = {
  schema: "meridian.formula-state/1";
  revision: string;
  values: Record<string, TypedValue>;
  knownClaims: PropositionRef[];
  openGoals: GoalPort[];
  lineage: string[];
  blocked: FormulaError[];
  budget: {
    maxNodes: number;
    maxDepth: number;
    maxOperations: number;
  };
  evidenceRequirement: Partial<EvidenceVector>;
};
```

Вспомогательные контракты планировщика:

```ts
type GoalPort = {
  goalId: string;
  name: string;
  expectedType: TypeRef;
  required: boolean;
  requiredEvidence: Partial<EvidenceVector>;
  reason: string;
};

type ProofObligation = {
  obligationId: string;
  proposition: PredicateRef;
  assumptions: PropositionRef[];
  status: "OPEN" | "DISCHARGED" | "FAILED";
  proofId: string | null;
};

type FormulaTraceNode = {
  nodeId: string;
  formula: FormulaRef;
  inputHashes: Record<string, string>;
  outputHash: string | null;
  status: "READY" | "ERROR" | "NOT_TAKEN";
  evidence: EvidenceVector;
  parentNodeIds: string[];
  errors: FormulaError[];
};

type FormulaTrace = {
  schema: "meridian.formula-trace/1";
  traceId: string;
  registryHash: string;
  rootFormula: FormulaRef | null;
  nodes: FormulaTraceNode[];
  topologicalOrder: string[];
  resultHash: string | null;
  deterministic: boolean;
};

type RankedFormula = {
  formula: FormulaRef;
  bindingHashes: Record<string, string>;
  rankTuple: Array<number | string>;
  experimentalScore: number | null;
  reasons: ReasonCode[];
};

type ReasonCode =
  | "GOAL_PORT_MATCH"
  | "OBLIGATION_REDUCTION"
  | "PROOF_LEVEL"
  | "INFORMATION_GAIN"
  | "CONTINUITY"
  | "NOVELTY"
  | "LOW_COST"
  | "NUMERIC_STABILITY"
  | "STABLE_TIE_BREAK";
```

### 10.2. Допустимость

```math
Admissible(f | s) =
  registered(f)
  and versionsPinned(f)
  and inputsAvailable(f,s)
  and typesCompatible(f,s)
  and dimensionsCompatible(f,s)
  and dependenciesReady(f,s)
  and pre_f(s) = TRUE
  and noCycle(f,s)
  and withinBudget(f,s)
  and evidenceMeetsPolicy(f,s).
```

Если `pre_f(s)=UNKNOWN`, формула не считается допустимой. Планировщик возвращает, какое значение или утверждение нужно получить.

### 10.3. Рекомендуемый выбор: лексикографический, а не одна сумма

Сначала применяются жёсткие ворота `Admissible`. Затем кандидаты сравниваются по кортежу:

```text
1. закрывает ли формула обязательный goal-port;
2. уменьшает ли число открытых proof obligations;
3. уровень математического свидетельства;
4. ожидаемый прирост определённых значений;
5. минимальная вычислительная стоимость;
6. минимальная численная нестабильность;
7. отсутствие недавнего повторения;
8. formulaId как стабильный tie-break.
```

Так высокая «семантическая привлекательность» не может обойти ошибку типов.

Для исследовательского режима разрешён отдельный эвристический score:

```math
S_math(f) =
  0.30 * goalCoverage
  + 0.22 * obligationReduction
  + 0.18 * proofLevel
  + 0.15 * informationGain
  + 0.10 * continuity
  + 0.05 * novelty
  - 0.12 * cost
  - 0.18 * numericRisk.
```

Коэффициенты являются **политикой-кандидатом**, а не теоремой. Они должны храниться в отдельной формуле `EMPIRICAL_POLICY` и калиброваться.

### 10.4. Результат

```ts
type NextFormulaResult =
  | {
      status: "READY";
      selected: FormulaRef;
      bindings: Record<string, TypedValue>;
      alternatives: RankedFormula[];
      reasons: ReasonCode[];
      proofObligations: ProofObligation[];
      trace: FormulaTrace;
    }
  | {
      status: "AMBIGUOUS";
      alternatives: RankedFormula[];
      missingDiscriminator: GoalPort;
      trace: FormulaTrace;
    }
  | {
      status: "ABSTAIN" | "BLOCKED";
      code: FormulaErrorCode;
      missing: GoalPort[];
      errors: FormulaError[];
      trace: FormulaTrace;
    };
```

### 10.5. Псевдокод

```text
function nextFormula(registry, state):
    candidates = []

    for formula in registry.activeFormulas():
        structural = validateStructure(formula)
        if not structural.ok:
            recordBlocked(formula, structural.error)
            continue

        binding = bindAvailableInputs(formula.inputs, state.values)
        if binding.missing:
            continue

        compatibility = checkTypesDimensionsKinds(binding, formula.inputs)
        if not compatibility.ok:
            recordBlocked(formula, compatibility.error)
            continue

        deps = resolvePinnedDependencies(formula, registry)
        if not deps.ok or createsCycle(state.lineage, deps):
            recordBlocked(formula, deps.error)
            continue

        pre = evaluatePredicates(formula.contract.pre, binding)
        if pre is UNKNOWN:
            rememberMissingPredicateInputs(formula, pre.missing)
            continue
        if pre is FALSE:
            recordBlocked(formula, PRECONDITION_FALSE)
            continue

        if not evidenceMeets(formula.evidence, state.evidenceRequirement):
            recordBlocked(formula, SOUNDNESS_REQUIRED)
            continue

        candidates.push(rankTuple(formula, state, binding))

    if candidates is empty:
        return ABSTAIN with minimal missing goals and blocked reasons

    stableSort(candidates)
    if semanticallyDifferent(candidates[0], candidates[1])
       and sameDecisionRank(candidates[0], candidates[1]):
        return AMBIGUOUS with discriminator

    return READY with selected candidate and complete dependency trace
```

---

## 11. Сквозной математический пример

### 11.1. Атом `M(u)`

```math
M(u) = 4u(1-u),  u in [0,1].
```

Тип:

```text
input  u: Real<dimensionless, RingCoordinate, [0,1]>
output M: Real<dimensionless, RingBalance, [0,1]>
```

Проверяемые утверждения:

```math
M(0)=0
M(1)=0
M(1/2)=1
M(u)=M(1-u)
0 <= M(u) <= 1 for u in [0,1].
```

Алгебраическое доказательство диапазона:

```math
M(u) = 1 - (2u-1)^2.
```

Так как квадрат неотрицателен, `M(u)<=1`; на `[0,1]` произведение `4u(1-u)>=0`.

Контрпример к неправильному универсальному claim `M(u)>=0 для всех Real`:

```text
u=2 -> M(2)=-8.
```

Правильное исправление - не clamp, а явный домен `[0,1]`.

### 11.2. Четыре давления

Для `x,y in [0,1]`:

```math
C   = xy
E   = (1-x)(1-y)
O_f = x(1-y)
O_r = (1-x)y
O   = O_f + O_r.
```

Инвариант:

```math
C + E + O_f + O_r = 1.
```

Доказательство:

```math
xy + (1-x)(1-y) + x(1-y) + (1-x)y
= xy + 1 - x - y + xy + x - xy + y - xy
= 1.
```

Следующие формулы:

```math
Direction = O_f - O_r = x-y
Margin = O - max(C,E).
```

### 11.3. Матрёшка вычисления

Вход:

```text
x=0.85, y=0.20
```

Трасса:

```text
F0 validateUnitInterval(x,y) -> PASS
F1 closurePressure(x,y)      -> C=0.17
F2 edgePressure(x,y)         -> E=0.12
F3 forwardOrbit(x,y)         -> O_f=0.68
F4 reverseOrbit(x,y)         -> O_r=0.03
F5 partition(F1,F2,F3,F4)    -> sum=1.00, invariant PASS
F6 orbitMass(F3,F4)           -> O=0.71
F7 direction(F3,F4)           -> 0.65
F8 margin(F6,F1,F2)           -> 0.54
F9 nextFormula(...)           -> orbital continuation candidate
```

Математически доказано только разложение и вычисленные значения. Фраза «это живое смысловое продолжение» является гуманитарной интерпретацией и требует отдельной карты `INTERPRETS`.

---

## 12. Переход к лингвистической математике

### 12.1. Базовый принцип

```text
слово != смысл
смысл != отношение
отношение != утверждение
утверждение != фраза
грамматичная фраза != истинная фраза
```

Лингвистическая математика здесь означает не «посчитать смысл одним числом», а:

- задать типы языковых сущностей;
- определить допустимые операции над ними;
- хранить происхождение отношений;
- композиционно строить утверждения;
- блокировать незаконные выводы;
- реализовывать поддержанные утверждения как фразы.

### 12.2. Четыре уровня

| Уровень | Тип | Вопрос |
|---|---|---|
| Слово | `Lexeme/Occurrence` | что написано и где |
| Смысл | `Sense` | какое значение выбрано |
| Отношение | `RelationAssertion` | как два значения связаны |
| Фраза | `Sentence/Passage` | как поддержанное утверждение выражено |

---

## 13. Строгие контракты тезауруса

### 13.1. Лексема и вхождение

```ts
type LexemeRecord = {
  schema: "meridian.lexeme/1";
  lexemeId: string;
  lemma: string;
  language: "ru";
  partOfSpeech: string;
  forms: MorphForm[];
  senseIds: string[];
  provenance: ProvenanceRecord;
};

type OccurrenceRecord = {
  schema: "meridian.occurrence/1";
  occurrenceId: string;
  documentId: string;
  surface: string;
  start: number;
  end: number;
  sentenceIndex: number;
  lexemeCandidates: CandidateRef[];
  selectedSenseId: string | null;
  resolution: "RESOLVED" | "AMBIGUOUS" | "OOV";
};
```

### 13.2. Значение

```ts
type SenseRecord = {
  schema: "meridian.sense/1";
  senseId: string;            // mrd:sense:key.object
  lexemeId: string;
  definition: string;
  ontologyTypes: string[];
  aliases: string[];
  relationAssertionIds: string[];
  definitionClaimIds: string[];
  status: "ACTIVE" | "DEPRECATED" | "DISPUTED";
  provenance: ProvenanceRecord;
};
```

Определение является текстовым пояснением. Истинностное содержание находится в `definitionClaimIds`, а не извлекается из красивой строки автоматически.

### 13.3. Тип отношения

```ts
type RelationTypeRecord = {
  schema: "meridian.relation-type/1";
  relationTypeId: string;
  label: string;
  domainTypes: string[];
  rangeTypes: string[];
  inverseOf: string | null;
  symmetric: boolean;
  transitivity: "DECLARED" | "FORBIDDEN" | "CONTEXTUAL";
  reflexive: boolean;
  inferenceRules: RuleRef[];
  forbiddenCompositions: string[];
  provenance: ProvenanceRecord;
};
```

Минимальный реестр:

```text
IS_A
INSTANCE_OF
PART_OF
HAS_PART
HAS_PROPERTY
DEFINED_BY
MEASURED_BY
CAUSES
ENABLES
PRECEDES
CONTRASTS_WITH
ANALOGOUS_TO
EVIDENCE_FOR
COUNTEREXAMPLE_TO
```

### 13.4. Утверждение отношения

```ts
type RelationAssertion = {
  schema: "meridian.relation/1";
  assertionId: string;
  subjectSenseId: string;
  relationTypeId: string;
  objectSenseId: string;
  polarity: "POSITIVE" | "NEGATIVE";
  modality: "ASSERTED" | "DEFEASIBLE" | "HYPOTHETICAL";
  contextId: string | null;
  validTime: TimeInterval | null;
  evidenceIds: string[];
  confidenceForRanking: number | null;
  status: "SUPPORTED" | "CONTESTED" | "RETRACTED";
  provenance: ProvenanceRecord;
};
```

`confidenceForRanking` не является вероятностью истины, если метод её получения отдельно не доказан и не калиброван.

### 13.5. Proposition

```ts
type PropositionRecord = {
  schema: "meridian.proposition/1";
  propositionId: string;
  predicate: string;
  arguments: TypedArgument[];
  quantifier: "ONE" | "SOME" | "ALL" | "MOST" | "NONE" | "UNSPECIFIED";
  polarity: "POSITIVE" | "NEGATIVE";
  modality: "FACT" | "DERIVED" | "HYPOTHESIS" | "INTERPRETATION";
  support: SupportRef[];
  derivation: FormulaTrace | null;
  counterevidence: SupportRef[];
  status: "SUPPORTED" | "AMBIGUOUS" | "CONTESTED" | "UNSUPPORTED";
};
```

### 13.6. Фрейм фразы

```ts
type PhraseFrameRecord = {
  schema: "meridian.phrase-frame/1";
  frameId: string;
  genre: "ENCYCLOPEDIA" | "NEWS" | "EXPLANATION" | "STORY";
  communicativeRole:
    | "DEFINITION"
    | "MECHANISM"
    | "CONDITION"
    | "RESULT"
    | "EXAMPLE"
    | "LIMITATION"
    | "TRANSITION";
  slots: FrameSlot[];
  grammarConstraints: GrammarConstraint[];
  templates: string[];
  outputClaimPolicy: "EXACTLY_SUPPORTED";
};
```

### 13.7. Карта математической интерпретации

Это единственный разрешённый мост от formula claim к гуманитарной proposition:

```ts
type InterpretationMapRecord = {
  schema: "meridian.interpretation-map/1";
  interpretationMapId: string;
  sourceClaimId: string;
  sourceFormulaRefs: FormulaRef[];
  targetPredicate: string;
  argumentBindings: Record<string, string>;
  requiredConditions: PredicateRef[];
  forbiddenConclusions: string[];
  label: "DEFINITIONAL" | "MODEL" | "ANALOGY" | "METAPHOR";
  status: "ACTIVE" | "DISPUTED" | "RETRACTED";
  evidence: EvidenceVector;
  provenance: ProvenanceRecord;
};
```

Правила:

- `DEFINITIONAL` может создавать `FACT` только в пределах явно принятого определения;
- `MODEL` создаёт proposition с `modality=INTERPRETATION`;
- `ANALOGY` и `METAPHOR` никогда не повышаются до `FACT` автоматически;
- `forbiddenConclusions` проверяются до реализации фразы;
- изменение source formula version требует новой версии карты;
- отсутствие карты означает отсутствие допустимого гуманитарного вывода.

### 13.8. Вспомогательные языковые типы

```ts
type MorphForm = {
  surface: string;
  features: Record<string, string>;
};

type CandidateRef = {
  id: string;
  scoreForRanking: number;
  evidenceIds: string[];
};

type TimeInterval = {
  start: string | null;
  end: string | null;
  precision: "INSTANT" | "DAY" | "MONTH" | "YEAR" | "UNKNOWN";
};

type TypedArgument = {
  role: string;
  type: TypeRef;
  valueRef: string;
};

type SupportRef = {
  kind: "ASSERTION" | "FORMULA_TRACE" | "PUBLICATION" | "CORPUS";
  id: string;
  revision: string | null;
  contentHash: string;
};

type RuleRef = {
  ruleId: string;
  version: string;
  contentHash: string;
};

type FrameSlot = {
  name: string;
  semanticRole: string;
  expectedTypes: string[];
  required: boolean;
};

type GrammarConstraint = {
  constraintId: string;
  kind: "AGREEMENT" | "VALENCY" | "ORDER" | "PUNCTUATION";
  arguments: string[];
  required: boolean;
};

type AmbiguityRecord = {
  occurrenceId: string;
  candidateSenseIds: string[];
  discriminator: string;
  blocking: boolean;
};
```

---

## 14. Алгебра семантических отношений

### 14.1. Отношение как типизированная стрелка

```math
R: Sense<A> -> Set<Sense<B>>.
```

Композиция:

```math
(S o R)(a,c) iff exists b: R(a,b) and S(b,c).
```

Она разрешена только если `range(R)` совместим с `domain(S)` и для пары отношений существует явное правило вывода.

Пример допустимого правила:

```text
INSTANCE_OF(x, A) and IS_A(A, B)
  -> INSTANCE_OF(x, B)
```

Пример запрещённого автоматического правила:

```text
PART_OF(x, A) and USED_IN(A, B)
  -/> USED_IN(x, B)
```

Колесо является частью велосипеда, велосипед используется в городе, но из этого не следует самостоятельное утверждение «колесо используется в городе» без контекста.

### 14.2. Наследование свойств

```text
IS_A(A,B) and HAS_PROPERTY(B,p)
  -> HAS_PROPERTY(A,p)
```

допустимо только если `p.inheritance = STRICT`.

Для `DEFEASIBLE` требуется проверка исключений:

```text
IS_A(penguin,bird)
bird CAN fly       [DEFEASIBLE]
penguin CANNOT fly [EXCEPTION]
=> нельзя вывести CAN_FLY(penguin)
```

### 14.3. Отрицание и открытый мир

Отсутствие ребра не означает отрицание:

```text
not known(R(a,b)) != known(not R(a,b)).
```

По умолчанию тезаурус работает в режиме open-world. Закрытый мир допускается только для явно ограниченного реестра, например «перечислены все четыре компонента разложения».

### 14.4. Три значения предиката

```text
TRUE    - есть поддержанное утверждение;
FALSE   - есть поддержанное отрицание или контрпример;
UNKNOWN - данных недостаточно или конфликт не разрешён.
```

`UNKNOWN` нельзя преобразовывать в `FALSE`, ноль или нейтральную совместимость.

---

## 15. Конвейер `слово -> смысл -> отношение -> фраза`

### 15.1. Этапы

```text
1. tokenize        Text -> Occurrence[]
2. lemmatize       Occurrence -> LexemeCandidate[]
3. resolveSense    Occurrence + Context -> Sense | AMBIGUOUS | OOV
4. retrieve        Sense[] -> supported RelationAssertion[]
5. infer           assertions + rules -> Proposition[]
6. selectContent   propositions + genre + goal -> DiscoursePlan
7. realize         DiscoursePlan + PhraseFrame[] -> Sentence[]
8. verifyLanguage  Sentence[] -> grammar/valency checks
9. verifyClaims    Sentence[] -> exact claim coverage
10. package        -> GeneratedPassage | ABSTAIN
```

### 15.2. Главный инвариант

Для каждого декларативного предложения `s`:

```math
Claims(s) is not empty
and for every c in Claims(s): status(c) in {SUPPORTED, DERIVED}
and every derived c has a complete FormulaTrace.
```

Исключения:

- вопрос может не утверждать факт;
- явно маркированная гипотеза использует `modality=HYPOTHESIS`;
- гуманитарная аналогия использует `modality=INTERPRETATION`;
- ни одна из них не отображается как факт.

### 15.3. Псевдокод

```text
function buildPassage(text, genre, goal):
    occurrences = language.tokenize(text)
    senses = []

    for occurrence in occurrences:
        resolution = thesaurus.resolve(occurrence, occurrences)
        if resolution is OOV:
            return ABSTAIN("LEXEME_OOV", occurrence)
        if resolution is AMBIGUOUS:
            return CLARIFY(resolution.candidates)
        senses.push(resolution.sense)

    assertions = graph.supportedNeighborhood(senses, genre.relationBudget)
    propositions = inference.derive(assertions)

    for proposition in propositions:
        if proposition.isDerived:
            trace = formulaCore.verifyDerivation(proposition.derivation)
            if not trace.ready:
                proposition.status = UNSUPPORTED

    plan = discourse.select(
        onlySupported(propositions),
        genre,
        goal
    )

    if not plan.hasDefinition or not plan.hasContinuation:
        return ABSTAIN("DISCOURSE_EVIDENCE_THIN")

    sentences = []
    for move in plan.moves:
        frame = frames.select(move)
        sentence = realizer.fill(frame, move.proposition)
        grammar = language.analyze(sentence.text)
        coverage = claimChecker.check(sentence, move.proposition)
        if grammar.status == CONFLICT or not coverage.exact:
            return ABSTAIN("REALIZATION_CONTRACT_FAILED")
        sentences.push(sentence)

    return GeneratedPassage(
        sentences,
        claimMap=collectClaims(sentences),
        evidenceBoundary=computeBoundary(sentences)
    )
```

---

## 16. Выбор следующего смыслового хода

### 16.1. Жёсткие ворота

Кандидат proposition допускается только если:

- значение всех ключевых слов разрешено;
- типы отношения корректны;
- assertion поддержан;
- вывод имеет разрешённое правило;
- нет активного более сильного контрпримера;
- proposition не противоречит уже принятому контексту без явного `CONTRAST`;
- жанровые обязательные поля заполнены;
- реализация не добавляет новый claim.

### 16.2. Гуманитарное ранжирование

После жёстких ворот можно использовать:

```math
S_hum(p | D,G) =
  0.24 * relevance(p,G)
  + 0.18 * evidenceCoverage(p)
  + 0.17 * continuity(p,D)
  + 0.14 * nonRedundancy(p,D)
  + 0.11 * specificity(p)
  + 0.09 * bridgeValue(p,D)
  + 0.07 * openNext(p,D)
  - 0.20 * contradictionRisk(p,D)
  - 0.12 * ambiguityRisk(p).
```

Это эвристика дискурсивного планирования, не математическая формула смысла. Веса должны:

- находиться в versioned policy-record;
- сравниваться с простыми baseline;
- калиброваться на независимом корпусе;
- показываться в trace;
- не участвовать в proof-status proposition.

### 16.3. Ритм энциклопедической статьи

Рекомендуемый цикл:

```text
DEFINITION -> STRUCTURE -> MECHANISM -> CONDITION
-> CONSEQUENCE -> EXAMPLE -> LIMITATION -> OPEN_NEXT
```

Следующий ход выбирается не для бесконечного добавления слов, а для закрытия следующей незаполненной роли без повтора уже раскрытой proposition.

### 16.4. Ритм новости

Новостной режим требует:

```text
EVENT + ACTOR + TIME + PLACE/SCOPE + SOURCE
```

Если нет `TIME` или `SOURCE`, система обязана вернуть `ABSTAIN_NEWS_EVIDENCE`, а не превращать энциклопедическое знание в новость. Формула не может сделать данные актуальными.

---

## 17. Контракт итогового текста

```ts
type GeneratedPassage = {
  schema: "meridian.passage/1";
  passageId: string;
  revision: string;
  genre: "ENCYCLOPEDIA" | "NEWS" | "EXPLANATION" | "STORY";
  status: "READY" | "PARTIAL" | "CLARIFY" | "ABSTAIN";
  text: string;
  sentences: {
    sentenceId: string;
    text: string;
    frameId: string;
    communicativeRole: string;
    propositionIds: string[];
    assertionIds: string[];
    formulaTraceIds: string[];
    grammarStatus: "PASS" | "CONFLICT" | "UNKNOWN";
    claimCoverage: number;
  }[];
  evidence: EvidenceVector;
  unsupportedClaims: string[];
  ambiguities: AmbiguityRecord[];
  provenance: ProvenanceRecord;
  hashes: {
    input: string;
    plan: string;
    output: string;
  };
};
```

`READY` требует:

```text
unsupportedClaims.length == 0
every sentence.claimCoverage == 1
no grammarStatus == CONFLICT
no unresolved critical ambiguity
all mathematical derivations structurally valid
```

`READY` всё ещё не означает, что гуманитарная интерпретация общепринята. Это отражается отдельным `interpretive`-статусом.

---

## 18. Сквозной лингвистический пример

### 18.1. Входной концепт

```text
«иррациональный поворот»
```

Тезаурус содержит:

```text
Sense irrational_rotation
  IS_A dynamical_system
  ACTS_ON circle
  HAS_PARAMETER alpha
  DEFINED_BY formula:circle.rotation@1.0.0

Claim rotation.step:
  theta_(n+1) = (theta_n + 2*pi*alpha) mod 2*pi

Claim rotation.equidistribution:
  if alpha is irrational, the orbit is equidistributed on the circle
  mathematical=PROVED

Interpretation meridian.non_short_cycle:
  this behavior is used as a model of continuation without a short finite loop
  interpretive=ANNOTATED
```

### 18.2. Формульная матрёшка

```text
F0 validateAngle(theta_0)
F1 validateIrrationalAssumption(alpha)
F2 rotationStep(theta_n, alpha)
F3 iterate(F2, N)
F4 discrepancy(F3.output)
F5 theoremLink(rotation.equidistribution)
```

`F5` не доказывает теорему повторным численным прогоном. Оно только связывает расчёт с отдельным proof artifact.

### 18.3. План статьи

```text
1. DEFINITION: тип объекта и пространство.
2. MECHANISM: формула шага.
3. CONDITION: иррациональность alpha.
4. RESULT: отсутствие конечного периода и равнораспределение.
5. INTERPRETATION: роль в MERIDIAN, явно помеченная как модель.
6. LIMITATION: поворот не равен хаосу и не доказывает смысл.
```

### 18.4. Возможный проверяемый вывод

> Иррациональный поворот - это динамическая система на окружности, в которой к текущей фазе на каждом шаге прибавляется один и тот же угол. Состояние вычисляется по формуле `theta_(n+1) = (theta_n + 2*pi*alpha) mod 2*pi`. Если `alpha` иррационально, орбита не замыкается в конечный цикл и равномерно распределяется по окружности. В MERIDIAN это поведение используется как модель продолжения без короткого повтора. Такая интерпретация не превращает поворот в теорию человеческого смысла и не делает его хаотической системой.

Карта:

| Предложение | Статус |
|---|---|
| определение | тезаурусное утверждение с provenance |
| формула | математический `FormulaRecord` |
| условие и результат | theorem claim + proof artifact |
| применение в MERIDIAN | `INTERPRETATION/ANNOTATED` |
| ограничение | контрграница из документации |

### 18.5. Пример честного отказа

Вход:

```text
«лук продолжает систему»
```

Если контекст не различает `лук.растение` и `лук.оружие`, результат:

```json
{
  "status": "CLARIFY",
  "code": "SENSE_AMBIGUOUS",
  "candidates": ["mrd:sense:onion.plant", "mrd:sense:bow.weapon"],
  "insertLine": null
}
```

Ни одна формула выбора фразы не запускается до разрешения значения.

---

## 19. Интеграция с P78

### 19.1. P78 остаётся самодостаточным

Минимальная самостоятельная конфигурация:

```text
P78
+ Formula Registry
+ Formula Planner
+ local Thesaurus
+ Linguistic Bridge
+ existing action controller / transaction / ledger
```

Она умеет:

- разобрать поддержанный вход;
- вычислить формульную матрёшку;
- построить proposition;
- сформировать один проверяемый следующий абзац;
- показать preview;
- применить или откатить exact text.

### 19.2. Роль соседних миров

| Сосед | Необязательная польза | Чего сосед не решает |
|---|---|---|
| P79/1D | точная сериализация, binary/Morse audit, byte-level replay | выбор смысла и истинность proposition |
| P80/Q6 | структурный снимок шести условий, одно-битный контрфакт | доказательство формулы и генерацию фразы |

Оба возвращают read-only report. Их результат может стать входным evidence только после проверки версии, hash, provenance и совместимости контракта.

### 19.3. Адаптер

```ts
type FormulaBranchReport = {
  schema: "meridian.formula-report/1";
  status: "READY" | "AMBIGUOUS" | "ABSTAIN" | "BLOCKED";
  sourceRevision: string;
  selectedFormula: FormulaRef | null;
  formulaTrace: FormulaTrace;
  propositions: PropositionRecord[];
  passage: GeneratedPassage | null;
  evidence: EvidenceVector;
  actionable: false;
};
```

`actionable:false` обязателен. Только P78 action controller может превратить `passage` в подготовленную транзакцию.

---

## 20. Предлагаемые будущие модули

Документ не создаёт эти файлы; это карта реализации.

```text
prototype/lib/
  formula-type-system.js
  formula-registry.js
  formula-ast.js
  formula-dimensions.js
  formula-graph.js
  formula-proof.js
  formula-planner.js
  linguistic-thesaurus.js
  linguistic-relation-algebra.js
  linguistic-discourse-planner.js
  linguistic-realizer-ru.js
  p78-formula-branch-adapter.js

prototype/data/
  formula-registry.json
  formula-proofs/
  formula-counterexamples.json
  thesaurus-senses.json
  thesaurus-relations.json
  phrase-frames-ru.json
```

Правила модульности:

- модули formula-core не знают о DOM;
- realizer не изменяет тезаурус;
- planner не исполняет текстовый commit;
- registry immutable после загрузки;
- все API versioned и frozen;
- никакой dynamic evaluation;
- ошибка зависимости fail closed;
- визуализация является пассивной проекцией trace.

---

## 21. Псевдокод основных компонентов

### 21.1. Загрузка реестра

```text
function loadRegistry(records):
    assert unique(formulaId, version)

    canonical = canonicalJson(records without contentHash)
    verify sha256 for every record

    for record in records:
        validate FormulaRecord schema
        validate AST closed operation registry
        validate input/output TypeRef
        validate dimension equations
        validate pinned dependency versions

    graph = buildEvaluationGraph(USES + GUARDS)
    if graph.hasCycle:
        reject registry

    return FrozenRegistry(records, topologicalOrder(graph))
```

### 21.2. Исполнение

```text
function evaluate(formulaRef, bindings, registry):
    formula = registry.exact(formulaRef)
    typed = validateBindings(bindings, formula.inputs)
    if not typed.ok:
        return Error(typed.code)

    pre = evaluateAll(formula.contract.pre, typed.values)
    if pre contains UNKNOWN:
        return Error(PRECONDITION_UNKNOWN)
    if pre contains FALSE:
        return Error(PRECONDITION_FALSE)

    memo = Map()
    value = evaluateAst(formula.expression, typed.values, memo)
    if value is Error:
        return value

    post = evaluateAll(formula.contract.post, bindings + value)
    if post is not all TRUE:
        return Error(POSTCONDITION_FAILED)

    return {
        status: READY,
        value,
        trace: exactDependencyTrace(memo),
        evidence: formula.evidence
    }
```

### 21.3. Проверка proposition

```text
function supportProposition(proposition, graph, formulaCore):
    direct = graph.assertions(proposition.support)
    if direct contains retracted or missing:
        return UNSUPPORTED

    if proposition.modality == DERIVED:
        result = formulaCore.verifyTrace(proposition.derivation)
        if result.structural != VALID:
            return UNSUPPORTED
        if proposition.requiresProof
           and result.mathematical != PROVED:
            return UNSUPPORTED

    conflict = graph.strongerCounterevidence(proposition)
    if conflict:
        return CONTESTED

    return SUPPORTED
```

### 21.4. Реализация фразы

```text
function realize(proposition, frame, morphology):
    assert frame.outputClaimPolicy == EXACTLY_SUPPORTED
    assert proposition matches frame slots

    slotValues = bindSemanticRoles(proposition.arguments, frame.slots)
    inflected = morphology.inflect(slotValues, frame.grammarConstraints)
    if inflected has UNKNOWN:
        return ABSTAIN(MORPHOLOGY_UNKNOWN)

    text = fillDeterministicTemplate(frame.template, inflected)
    reverseClaims = parseControlledSentence(text)

    if reverseClaims != { proposition.id }:
        return ABSTAIN(CLAIM_ROUNDTRIP_FAILED)

    return Sentence(text, proposition.id, frame.id)
```

---

## 22. Тестовая стратегия

### 22.1. Уровни проверки

| Уровень | Что доказывает | Чего не доказывает |
|---|---|---|
| Unit | отдельный контракт функции | корректность всей модели |
| Property-based | инварианты на большом пространстве входов | человеческий смысл |
| Proof checker | формальный claim при заданных аксиомах | пригодность аксиом к миру |
| Counterexample replay | воспроизводимость опровержения | отсутствие других ошибок |
| Corpus evaluation | качество на выбранных данных | универсальность |
| Human review | понятность и полезность | математическую истинность |
| Browser E2E | целостность пользовательского маршрута | научную валидность |

### 22.2. Обязательные unit-тесты Formula Core

1. Реестр отклоняет duplicate `formulaId@version`.
2. Повреждённый SHA-256 блокирует загрузку.
3. Неизвестная операция AST блокируется.
4. `eval` и executable payload отсутствуют.
5. `QTY<second> + QTY<meter>` даёт `DIMENSION_MISMATCH`.
6. `Novelty + RingBalance` без policy даёт `MEASURE_KIND_MISMATCH`.
7. Явный unit-converter допускает `degree -> radian`.
8. Неприкреплённая версия зависимости блокируется.
9. Цикл `F->G->F` блокируется.
10. Fixed-point без convergence claim не получает `PROVED`.
11. `Post_F => Pre_G` создаётся как proof obligation.
12. Ошибка подформулы не превращается в ноль.
13. Одинаковый input и registry hash дают одинаковый trace.
14. Перестановка записей реестра не меняет результат.
15. Budget останавливает глубокую матрёшку с `BUDGET_EXCEEDED`.

### 22.3. Property-based тесты формул

Для `M(u)`:

```text
for all u in [0,1]:
  0 <= M(u) <= 1
  M(u) == M(1-u)

M(0)=0
M(1)=0
M(0.5)=1
```

Для четырёх давлений:

```text
for all x,y in [0,1]:
  each component in [0,1]
  C + E + O_f + O_r == 1 within declared numeric policy
  Direction == x-y
```

Для композиций:

```text
evaluate(G o F, x) == evaluate(G, evaluate(F,x))
```

только если обе стороны `READY` и выполняются одинаковые контракты.

### 22.4. Тесты доказательств и контрпримеров

- proof artifact с изменённым assumption hash блокируется;
- `TESTED` никогда не отображается как `PROVED`;
- активный контрпример переводит универсальный claim в `REFUTED`;
- после сужения домена создаётся новая версия формулы;
- старый контрпример остаётся воспроизводимым для старой версии;
- Float64 tolerance является частью hash;
- manual proof без reviewer остаётся `CONDITIONAL`.

### 22.5. Тесты тезауруса

1. Одна лексема может иметь несколько `SenseId`.
2. Неоднозначный «лук» даёт `CLARIFY`.
3. OOV не получает выдуманного `SenseId`.
4. Domain/range несовместимого отношения блокируется.
5. `CAUSES` не становится транзитивным автоматически.
6. Inverse relation строится только если объявлен.
7. Отсутствующее ребро не становится отрицанием.
8. `DEFEASIBLE`-свойство уступает явному исключению.
9. Контекстные assertions не утекают в другой контекст.
10. Relation confidence не отображается как proof probability.

### 22.6. Тесты текста

- каждое декларативное предложение имеет хотя бы один proposition;
- claim coverage каждого предложения равен `1`;
- unsupported claim даёт `ABSTAIN`;
- перестановка внутренних assertion-records не меняет текст;
- синонимическая словоформа не меняет выбранный `SenseId`;
- изменение смысла омонима меняет план и trace;
- отрицание не теряется;
- обязательные поля новости проверяются;
- энциклопедический режим не создаёт дату события;
- grammar conflict блокирует `READY`;
- повторный запуск даёт тот же passage hash;
- roundtrip controlled sentence -> proposition сохраняет claim.

### 22.7. Корпус

Минимальный независимый набор должен содержать:

```text
20 математических определений;
20 причинно-следственных объяснений;
20 энциклопедических мини-статей;
20 новостных карточек с источником и временем;
20 полисемичных случаев;
20 OOV/неполных случаев;
20 грамматичных, но ложных или неподдержанных фраз;
20 пар claim/counterexample.
```

Разметчики отдельно оценивают:

- factual support;
- корректность выбранного значения;
- корректность отношения;
- грамматику;
- связность;
- полезность следующего хода;
- ясность маркировки «факт / вывод / гипотеза / интерпретация».

Итоговая метрика не должна смешивать эти столбцы в одно число до анализа ошибок.

---

## 23. Приёмочные примеры

| ID | Вход | Ожидаемый результат |
|---|---|---|
| `F-001` | `u=0.5` -> `M` | `READY`, значение `1`, proof link |
| `F-002` | `u=1.2` -> `M` | `DOMAIN_VIOLATION`, без clamp |
| `F-003` | `0.85,0.20` -> pressures | `sum=1`, `Direction=0.65`, `Margin=0.54` |
| `F-004` | метры + секунды | `DIMENSION_MISMATCH` |
| `F-005` | Novelty + Balance | блок до explicit policy |
| `G-001` | registry cycle | загрузка отклонена |
| `P-001` | tested identity | `TESTED`, не `PROVED` |
| `P-002` | active counterexample | claim `REFUTED` |
| `L-001` | «ключ открыл замок» | `key.object`, grammar PASS |
| `L-002` | «ключ бьёт из земли» | `key.spring` |
| `L-003` | «лук продолжает систему» | `CLARIFY`, без фразы |
| `L-004` | неподдержанный факт | `ABSTAIN_UNSUPPORTED_CLAIM` |
| `T-001` | иррациональный поворот | проверяемый энциклопедический абзац |
| `T-002` | новость без времени | `ABSTAIN_NEWS_EVIDENCE` |
| `I-001` | preview в P78 | source не изменён |
| `I-002` | exact commit | одна ledger-entry |
| `I-003` | stale source | commit заблокирован |

---

## 24. Риски и защита

| Риск | Проявление | Защита |
|---|---|---|
| Формульный театр | красивая строка без evaluator | AST + executable contract + test |
| Ложный soundness | structural выдан за proof | ортогональный EvidenceVector |
| Смешение шкал | складываются разные `[0,1]` | `MeasureKind` + explicit policy |
| Документационный drift | одна `Phi` обозначает разные выражения | immutable ID/version/hash |
| Комбинаторный взрыв | слишком много композиций | goal ports, depth/budget, memoization |
| Цикл | бесконечная матрёшка | DAG gate, отдельный FIXPOINT |
| Численная нестабильность | разные результаты платформ | NumericPolicy, interval/rational |
| Переуверенная семантика | unknown становится 0.62 | `UNKNOWN/OOV -> ABSTAIN` |
| Полисемия | неверный sense даёт связный текст | explicit resolution + CLARIFY |
| Ошибка наследования | «все птицы летают» | defeasible rules + exceptions |
| Грамматичный бред | форма PASS, claim ложен | claim support gate |
| Корпусная утечка | F1=1 на своих шаблонах | независимый holdout и external review |
| Шаблонный застой | верный, но однообразный текст | discourse role coverage + nonredundancy |
| LLM-галлюцинация | модель добавляет факт | constrained proposition plan + verifier |
| Тяжёлый UI | все детали показаны сразу | краткий результат + раскрываемый trace |
| Обход P78 | модуль сам пишет текст | report `actionable:false`, единый controller |

---

## 25. Варианты реализации

### 25.1. Вариант A - строгий минимальный

```text
JSON registry
+ закрытый AST
+ dimension checker
+ DAG
+ deterministic templates
```

Плюсы:

- полностью офлайн;
- воспроизводим;
- легко тестируется;
- достаточно для первой энциклопедической статьи на ограниченной теме.

Минусы:

- небольшой словарь;
- шаблонный язык;
- много ручной разметки.

**Рекомендация для MVP.**

### 25.2. Вариант B - rule engine и Datalog

Типизированные тезаурусные правила переводятся в ограниченный Datalog. Он полезен для:

- транзитивного `IS_A`;
- inverse relations;
- поиска поддерживающего пути;
- объяснимого derivation trace.

Нужны ограничения глубины и запрет неконтролируемого отрицания.

### 25.3. Вариант C - RDF/OWL/SHACL

- RDF хранит assertions;
- OWL задаёт часть онтологии;
- SHACL проверяет domain/range и обязательные поля;
- Formula Registry остаётся отдельным вычислительным слоем.

Это проверенная современная технология, но она усложняет локальный browser-only MVP.

### 25.4. Вариант D - e-graph формул

E-graph хранит эквивалентные выражения:

```math
4u(1-u) <=> 1-(2u-1)^2.
```

Польза:

- каноникализация;
- поиск более устойчивой формы;
- доказуемая оптимизация;
- обнаружение дубликатов.

Риск: равенство требует надёжных rewrite rules и доменных условий.

### 25.5. Вариант E - SMT/proof assistant

- SMT решает ограниченные proof obligations и ищет контрпримеры;
- Lean/Coq/Isabelle проверяет важные теоремы;
- runtime хранит сертификаты, но не включает тяжёлый prover в UI.

Рекомендуется только после стабильного реестра и набора формул.

### 25.6. Вариант F - constrained language model

Языковая модель может выполнять только реализацию готового `DiscoursePlan`:

```text
allowed claims = {c1,c2,c3}
required labels = {FACT, INTERPRETATION}
forbidden = any new named entity, date, number or causal relation
```

После генерации claim extractor обязан восстановить тот же набор claims. При несовпадении используется deterministic template или `ABSTAIN`.

Модель является стилистом, а не источником фактов.

---

## 26. Инновационные направления

### 26.1. Proof-carrying text

Каждое предложение несёт компактный машинный «паспорт»:

```text
sentence
  -> proposition IDs
  -> relation assertions
  -> formula trace
  -> proof/corpus provenance
```

Пользователь может раскрыть не просто ссылку, а полный путь возникновения фразы.

### 26.2. Counterexample-first planner

Перед выбором следующей формулы система ищет:

1. известный контрпример;
2. граничное значение;
3. альтернативную трактовку;
4. отсутствующее предусловие.

Только затем строится положительное продолжение. Это уменьшает уверенный, но хрупкий текст.

### 26.3. Двойной граф

```text
Formula DAG       - что из чего вычисляется.
Semantic Graph    - что с чем связано.
InterpretationMap - какие formula claims допускают какие propositions.
```

Ошибки можно локализовать:

- неверное число - Formula DAG;
- неверная связь - Semantic Graph;
- натянутая метафора - InterpretationMap;
- плохая фраза - Realizer.

### 26.4. Закон сохранения утверждений

Для controlled режима:

```math
Claims(output) subseteq
  Claims(input evidence)
  union Claims(valid derivations)
  union ExplicitlyMarkedInterpretations.
```

Это не закон естественного языка, а полезный инженерный инвариант «не создавать скрытые факты».

### 26.5. Семантические размерности

Исследовательский вариант вводит типы не как числовые координаты, а как ограничения:

```text
Cause cannot fill Location
Measurement cannot fill Agent
Interpretation cannot satisfy Proof
Lexeme cannot substitute Sense
```

Это «размерностный анализ» языка: не измеряет смысл числом, а блокирует несовместимые подстановки.

### 26.6. Топологические дыры знания

После построения knowledge graph можно искать:

- компоненты без мостов;
- циклы без evidence;
- proposition, соединяющие далёкие кластеры единственным слабым ребром;
- незаполненные роли статьи.

Это исследовательская диагностика, а не доказательство смысла. На первом этапе достаточно обычных connected components, articulation points и typed path search.

### 26.7. Контекстная согласованность как sheaf-inspired проверка

Спекулятивный вариант: локальные интерпретации слова в разных абзацах считаются «согласуемыми», если они дают непротиворечивое глобальное назначение sense. Полноценная теория пучков для MVP не нужна; практически это реализуется как constraint satisfaction над occurrence-to-sense assignments.

### 26.8. Исторические формы, которые полезно вернуть

- **Евклидова схема:** определения -> аксиомы -> предложение -> доказательство.
- **Схоластическая quaestio:** тезис -> сильное возражение -> ответ -> граница применимости.
- **Таблицы различений:** явное разведение омонимов и уровней утверждения.
- **Контролируемый естественный язык:** современная форма старой идеи точной грамматики.

Они полезны как структура документа и counterexample ledger, но не заменяют современную проверку данных.

---

## 27. Этапы реализации

### Этап F0 - заморозить контракт

Результат:

- JSON Schema для `FormulaRecord`, `ProofArtifact`, `CounterexampleRecord`;
- типы, размерности, `MeasureKind`;
- status/error vocabulary;
- canonical JSON и hash policy.

Ворота:

- примеры `M(u)` и pressures проходят schema;
- повреждённые записи fail closed;
- другие semantic modules не изменены.

### Этап F1 - Formula Registry MVP

Результат:

- immutable registry;
- AST validator/interpreter;
- dimension checker;
- exact dependency DAG;
- 8-12 атомарных формул MERIDIAN.

Первый набор:

```text
ring.balance
pressure.closure
pressure.edge
pressure.orbit-forward
pressure.orbit-reverse
pressure.partition
pressure.direction
pressure.margin
vitality.snapshot-geomean
vitality.trajectory
```

Ворота:

- property tests зелёные;
- две `Phi` различаются ID;
- никаких строковых формул без FormulaRecord.

### Этап F2 - Proof and Counterexample

Результат:

- proof graph;
- algebraic certificates для `M` и partition;
- counterexample replay;
- EvidenceVector в каждом результате.

Ворота:

- `TESTED != PROVED`;
- active counterexample виден в planner;
- версии и assumptions входят в hash.

### Этап F3 - Next Formula Planner

Результат:

- goal ports;
- admissibility gate;
- deterministic ranking;
- `READY/AMBIGUOUS/ABSTAIN/BLOCKED`;
- полный trace.

Ворота:

- незаконная формула не попадает в alternatives;
- неизвестный precondition выдаёт минимальный missing input;
- одинаковая ревизия воспроизводима.

### Этап L1 - Thesaurus Core

Результат:

- Lexeme/Sense/Relation schemas;
- минимум 100 значений в одной предметной области;
- 12 relation types;
- open-world inference;
- ambiguity/OOV.

Ворота:

- полисемия не маскируется;
- domain/range проверяются;
- confidence не смешан с truth.

### Этап L2 - Proposition and Controlled Russian

Результат:

- proposition planner;
- 12-20 phrase frames;
- morphology adapter;
- sentence claim roundtrip;
- encyclopedia mode.

Ворота:

- каждый READY sentence имеет claim coverage `1`;
- неподдержанный факт блокируется;
- одна тема порождает связный абзац из 4-6 предложений.

### Этап L3 - P78 Integration

Результат:

- read-only FormulaBranchReport;
- одна карточка preview;
- action controller готовит exact transaction;
- ledger хранит formula/passage hashes.

Ворота:

- анализ не меняет source;
- commit выполняется ровно один раз;
- stale source/target блокируется;
- P79/P80 выключены, а ветка остаётся READY.

### Этап V1 - Внешняя проверка

Результат:

- независимый корпус;
- baseline;
- human review;
- error taxonomy;
- калибровка только после holdout.

Ворота:

- опубликованы отдельные показатели factual support, sense accuracy, relation accuracy, grammar и usefulness;
- нет одной маскирующей «оценки смысла»;
- известны классы, на которых система обязана воздерживаться.

---

## 28. Definition of Done первой самостоятельной версии

- [ ] P78 работает без P79 и P80.
- [ ] Реестр содержит не менее 10 исполняемых формул.
- [ ] У каждой формулы есть строгие порты, размерности, версия и hash.
- [ ] Evaluation DAG ацикличен.
- [ ] `M(u)` и разложение давлений имеют проверяемые proof artifacts.
- [ ] Все активные контрпримеры воспроизводимы.
- [ ] Планировщик возвращает следующую формулу с причинами.
- [ ] Неизвестный precondition даёт `ABSTAIN`, а не числовой fallback.
- [ ] Тезаурус различает Lexeme и Sense.
- [ ] Relations проверяют domain/range и политику вывода.
- [ ] Энциклопедический абзац содержит только supported/derived claims.
- [ ] Каждое предложение имеет claim map и provenance.
- [ ] Факт, гипотеза и интерпретация визуально и структурно различены.
- [ ] Грамматичный неподдержанный текст не проходит.
- [ ] Preview не изменяет исходник.
- [ ] Commit/undo/replay проходят существующий P78 action controller.
- [ ] Unit, property, corpus и browser tests зелёные.
- [ ] Документация не называет structural-проверку доказательством истинности.

---

## 29. Главная рекомендация

Не начинать с большого тезауруса или генеративной модели. Сначала реализовать малую, но строгую формульную матрёшку:

```text
M(u)
+ четыре давления
+ partition proof
+ direction/margin
+ nextFormula
```

Затем перенести **не числа, а дисциплину типов и доказательств** на одну узкую энциклопедическую тему:

```text
Lexeme
-> Sense
-> typed Relation
-> supported Proposition
-> controlled Sentence
-> exact claim trace
```

Это даст P78 самостоятельное 2D-ядро: оно сможет продолжать текст без обязательного обращения к 1D и 3D, но при этом не будет выдавать математическую вычислимость за понимание языка. После этого P79 и P80 можно подключать как независимые аудиторы точности и структуры, а не как костыли семантики.

Итоговая формула архитектуры:

```text
корректный текстовый ход =
  математически допустимое вычисление
  + поддержанное тезаурусом утверждение
  + грамматически корректная реализация
  + явная граница интерпретации
  + транзакционное решение P78.
```

Знак `+` здесь обозначает последовательность обязательных ворот, а не числовое сложение показателей.

