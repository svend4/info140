# 46 - P78: реализация контрактов девяти α-орбит

**Статус:** ALPHA_ORBIT_CONTRACTS_IMPLEMENTED_NOT_WIRED  
**Дата:** 2026-07-21  
**Срез:** A из [спецификации девяти орбит](45-p78-nine-semantic-orbits-and-alpha-automaton.md)  
**Runtime-статус:** NOT_WIRED_TO_P78_SHELL  
**Область authority:** STRUCTURAL_ONLY  
**Решение:** типы артефактов, рёбер и переходов реализованы как автономный детерминированный модуль без DOM, сети и права semantic commit

Связанные документы:

- [девять семантических орбит и α-автомат](45-p78-nine-semantic-orbits-and-alpha-automaton.md);
- [контракты source-backed слияния и расщепления](30-scientific-synthesis-fission-fusion-spec.md);
- [реализация Claim AST](35-p78-controlled-russian-claim-ast-implementation.md);
- [реализация семантического рабочего потока](40-p78-semantic-flow-projection-implementation.md);
- [кластерный речной конвейер](44-p1-p80-retrospective-and-cluster-river-conveyor.md).
- [реализация безопасного Data7Adapter и hardening α-инвариантов](48-p78-data7-adapter-implementation.md).

Исполняемые файлы:

- [`prototype/lib/p78-alpha-orbit-contracts.js`](../prototype/lib/p78-alpha-orbit-contracts.js);
- [`prototype/tests/semantic-p78-alpha-orbit-contracts-regression.cjs`](../prototype/tests/semantic-p78-alpha-orbit-contracts-regression.cjs).

**Актуализация 2026-07-21.** При реализации Data7Adapter закрыты две обнаруженные независимым аудитом дыры: preservation-переход теперь требует, чтобы `after.claimRefs` содержал все `before.claimRefs` (`CLAIM_REFERENCE_LOSS`), а каждый LINK witness обязан находиться на α связываемых артефактов (`LINK_WITNESS_ALPHA_MISMATCH`). Golden fixtures исправлены так, чтобы положительные переходы действительно сохраняли общий claim ref.

Data7-перестановка списка намеренно не получает α-`ORBIT` receipt: это workflow ordering, а не замена одного α-артефакта другим.

---

## 1. Что именно реализовано

Срез A не меняет внешний вид P78. Он создаёт проверяемый фундамент, на который следующая read-only визуализация сможет опираться без самостоятельного толкования текста.

Реализованы:

1. точное взаимно-однозначное соответствие девяти целых `α` и девяти типов артефактов;
2. контент-адресуемый `SemanticArtifact`;
3. контент-адресуемое типизированное `SemanticEdge`;
4. контент-адресуемый `AlphaTransitionReceipt`;
5. обычные переходы `GENERALIZE`, `SPECIALIZE`, `LINK`, `ORBIT`;
6. контролируемый пропуск уровней `BRIDGE`;
7. остановочные исходы `PARK`, `ROLLBACK`, `ABSTAIN`;
8. внутренняя и внешняя защитные границы;
9. сохранение claim coverage, source provenance и qualifiers;
10. запрет автоматического повышения authority;
11. линейное преобразование `α <-> radius` только внутри безопасного кольца;
12. fail-closed валидация схем, хешей, перечислений, массивов и скрытых полей;
13. отдельный golden/negative regression suite.

Не реализованы в этом срезе:

- классификация произвольного текста по `α`;
- генерация нового текста;
- source retrieval;
- семантическая истинность;
- автоматический commit;
- Canvas-проекция девяти орбит;
- изменение существующего `p78-living-ring-interface.html`.

---

## 2. Зависимость и режим отказа

Модуль зависит только от уже существующего [`p78-canonical-json.js`](../prototype/lib/p78-canonical-json.js). Если зависимость отсутствует, экспортируется замороженный объект:

```text
status: BLOCKED
code: ALPHA_ORBIT_CANONICAL_DEPENDENCY_UNAVAILABLE
semanticTruth: false
commitAllowed: false
```

Нет скрытого упрощённого режима, случайного хеширования или перехода к неканоническому `JSON.stringify`. После подключения зависимости модуль имеет статус `READY`.

Он не использует:

```text
document
requestAnimationFrame
Date.now
Math.random
fetch
XMLHttpRequest
eval
new Function
```

Поэтому результат не зависит от браузерного кадра, времени, сети, порядка полей во входном объекте или случайного состояния.

---

## 3. Публичный API

```text
MRDP78AlphaOrbitContracts
  version
  status
  artifactSchema
  edgeSchema
  receiptSchema
  levels
  operations
  relations
  horizontalRelations
  radialRelations
  authorityLevels
  semanticTruth
  soundness
  commitAllowed
  kindForAlpha(alpha)
  alphaForKind(kind)
  radiusForAlpha(alpha, rInner, rOuter)
  alphaForRadius(radius, rInner, rOuter)
  createArtifact(raw)
  validateArtifact(value)
  createEdge(fromArtifact, toArtifact, raw)
  validateEdge(value)
  validateEdgeAgainst(value, fromArtifact, toArtifact)
  createTransitionReceipt(beforeArtifact, afterArtifact, raw)
  validateTransitionReceipt(value)
  validateTransitionReceiptAgainst(value, beforeArtifact, afterArtifact)
```

API, таблицы уровней и все созданные значения глубоко заморожены. Внешний код не может изменить уже рассчитанный хеш через мутацию вложенного массива.

---

## 4. Девять уровней

Канонический порядок API идёт от внутренней полезной орбиты к внешней:

| α | `ArtifactKind` | Радиальное положение |
|---:|---|---|
| +4 | `ONTOLOGY` | самая внутренняя полезная 2D-орбита |
| +3 | `PHILOSOPHY` | внутренняя |
| +2 | `LAW` | внутренняя |
| +1 | `PRINCIPLE` | внутренняя около середины |
| 0 | `CONCEPT` | средняя опорная орбита |
| -1 | `SPECIFICATION` | внешняя около середины |
| -2 | `TEMPLATE` | внешняя |
| -3 | `EXAMPLE` | внешняя |
| -4 | `CODE` | самая внешняя полезная 2D-орбита |

Контракт запрещает:

```text
alpha = +5
alpha = -5
kind = CENTER_3D
kind = DISINTEGRATED_1D
```

Следовательно, 3D-центр и 1D-внешность технически не могут попасть в массив полезных `levels`.

Отдельно проверяется соответствие:

```text
alphaForKind(kind) == alpha
kindForAlpha(alpha) == kind
```

Ошибка `ALPHA_KIND_MISMATCH` возникает до хеширования, если вызывающий код пытается поместить `CODE` на `α=0` или `CONCEPT` на `α=1`.

---

## 5. Радиус

Реализована формула из документа 45:

```text
r(alpha) = rInner + ((4 - alpha) / 8) * (rOuter - rInner)
```

Для тестового кольца `rInner=20`, `rOuter=100`:

```text
r(+4) = 20
r( 0) = 60
r(-4) = 100
```

Обратная функция возвращает ближайший дискретный `α`, но только для радиуса внутри `[rInner, rOuter]`. Радиус меньше внутренней или больше внешней рабочей границы даёт `RADIUS_OUTSIDE_SAFE_ANNULUS`. Это важно: функция не превращает 3D/1D-защитные зоны в дополнительные уровни.

`radiusForAlpha` является геометрической утилитой. Она не классифицирует текст и не меняет authority.

---

## 6. Контракт артефакта

Схема:

```text
meridian.alpha-artifact/1
```

Входные поля:

```text
alpha
kind
title
body
language
claimRefs[]
sourceRefs[]
parentRefs[]
childRefs[]
horizontalRefs[]
qualifiers[]
authority
```

Выход дополнительно содержит:

```text
schema
version
semanticTruth: false
soundness: NOT_COMPUTED
artifactId
contentHash
```

`artifactId` считается из неизменяемого содержательного identity до добавления идентификатора. `contentHash` считается из всего артефакта вместе с `artifactId`. Оба значения имеют формат `sha256:<64 hex>`.

### 6.1. Массивы ссылок

Все reference-массивы обязаны быть:

- плотными;
- без дополнительных именованных свойств;
- без accessors;
- отсортированными;
- уникальными;
- состоящими только из SHA-256 refs.

Это делает replay независимым от порядка вставки и не позволяет двум байтово разным представлениям выдать себя за один набор ссылок.

### 6.2. Authority

Допустимые декларативные статусы:

```text
DRAFT
SOURCE_BACKED
REVIEWED
ABSTAIN
```

`SOURCE_BACKED` и `REVIEWED` требуют непустые `claimRefs` и `sourceRefs`. Сам модуль не проверяет существование источника и поэтому сохраняет общую границу:

```text
semanticTruth: false
soundness: NOT_COMPUTED
```

Статус означает заявленное рабочее состояние артефакта, а не вычисленную истинность.

### 6.3. Скрытые поля

Объекты с symbol-полями, неenumerable-полями или getters/setters отклоняются до канонизации. Это закрывает класс ошибок, когда опасное поле не входит в `Object.keys`, исчезает при сериализации и не влияет на хеш.

---

## 7. Контракт ребра

Схема:

```text
meridian.alpha-edge/1
```

Поддерживаются радиальные отношения:

```text
GENERALIZES
SPECIALIZES
IMPLEMENTS
INSTANTIATES
```

И горизонтальные отношения:

```text
ASSOCIATES
USES
INCLUDES
DEPENDS_ON
SUPPORTS
REFUTES
QUALIFIES
```

Гейты:

| Отношение | Условие |
|---|---|
| `GENERALIZES` | `to.alpha = from.alpha + 1` |
| `SPECIALIZES` | `to.alpha = from.alpha - 1` |
| `IMPLEMENTS`, `INSTANTIATES` | реализация находится на меньшем `α`, чем описываемый ею артефакт |
| горизонтальные | `to.alpha = from.alpha` |

Self-edge запрещён. `REVIEWED` edge требует хотя бы одну source ref. Ребро сохраняет `semanticTruth:false` и `soundness:NOT_COMPUTED`.

`validateEdge` проверяет внутреннюю форму и хеш. `validateEdgeAgainst` дополнительно сверяет сохранённые refs с двумя фактически переданными артефактами.

---

## 8. Контракт перехода

Схема:

```text
meridian.alpha-transition-receipt/1
```

Каждая квитанция содержит:

```text
operation
status
beforeRef
afterRef | null
relation | null
coverageRefs[]
witnesses[]
reasonCodes[]
validatorVersions[]
priorReceiptRef | null
authority: STRUCTURAL_ONLY
evidenceLevel: STRUCTURAL
soundness: NOT_COMPUTED
semanticTruth: false
commitAllowed: false
receiptId
contentHash
```

Квитанция подтверждает только то, что структура перехода прошла объявленные валидаторы. Она не выполняет commit и не доказывает смысловую корректность сформулированного текста.

### 8.1. Обычные радиальные переходы

`GENERALIZE`:

```text
deltaAlpha = +1
relation = GENERALIZES
```

`SPECIALIZE`:

```text
deltaAlpha = -1
relation = SPECIALIZES
```

Для обоих обязательны:

- полное покрытие входных `claimRefs` в `coverageRefs`;
- сохранение всех входных `sourceRefs`;
- сохранение всех входных `qualifiers`;
- отсутствие повышения authority только за счёт перехода;
- непустой список версий валидаторов.

### 8.2. Защитные границы

```text
GENERALIZE from alpha=+4 -> INNER_GUARD_REACHED
SPECIALIZE from alpha=-4 -> OUTER_GUARD_REACHED
```

Даже если вызывающий код передаёт другой артефакт того же вида и корректные хеши, переход блокируется. Это отделяет полезную онтологию от 3D-коллапса и полезный код от 1D-распада.

### 8.3. Горизонтальные переходы

`LINK`:

- оба артефакта находятся на одном `α`;
- relation относится к горизонтальному набору;
- артефакты различны;
- существует минимум один witness;
- операция не притворяется радиальным claim coverage.

`ORBIT`:

- `α` и kind сохраняются;
- after artifact отличается от before artifact;
- relation горизонтален;
- provenance и qualifiers сохраняются;
- входные claims покрыты.

Таким образом, анимация без нового content-addressed результата не может породить `ORBIT` receipt.

### 8.4. BRIDGE

`BRIDGE` разрешён только при расстоянии не менее двух уровней. Для каждого пропущенного целого `α` требуется witness:

```text
Concept alpha=0 -> Philosophy alpha=+3
witness alpha=+1
witness alpha=+2
```

Пропуск одного witness даёт:

```text
BRIDGE_WITNESS_CHAIN_INCOMPLETE
```

Направление relation также проверяется:

```text
deltaAlpha > 0 -> GENERALIZES
deltaAlpha < 0 -> SPECIALIZES
```

Witnesses не доказывают содержание промежуточных артефактов; они делают долг трассировки явным и адресуемым.

### 8.5. PARK, ABSTAIN и ROLLBACK

`PARK` и `ABSTAIN`:

- не имеют after artifact;
- не имеют relation;
- требуют минимум один reason code;
- не имеют coverage/witness payload.

`ROLLBACK`:

- имеет after artifact, который представляет восстанавливаемое состояние;
- требует `priorReceiptRef`;
- требует reason code;
- не выдаёт восстановление за новый семантический вывод.

---

## 9. Сохранение данных

Для `GENERALIZE`, `SPECIALIZE`, `ORBIT` и `BRIDGE` выполняются четыре жёстких проверки.

### 9.1. Claim coverage

```text
coverageRefs == before.claimRefs
```

В текущем одновходовом контракте требуется точное равенство. Когда появится multi-input merge, это правило будет расширено до матрицы `inputRef -> coveredClaimRefs`, а не ослаблено до одного общего процента.

### 9.2. Source provenance

```text
before.sourceRefs subsetOf after.sourceRefs
```

Добавить источник можно. Потерять существующую ссылку нельзя.

### 9.3. Qualifiers

```text
before.qualifiers subsetOf after.qualifiers
```

Это структурный предохранитель для условий, диапазонов и области действия. Он не понимает русский текст внутри body; полноценная проверка отрицаний и числовых ограничений остаётся задачей Claim AST и будущего semantic gate.

### 9.4. Authority

```text
rank(after.authority) <= rank(before.authority)
```

Операция изменения абстракции сама по себе не может превратить `DRAFT` в `SOURCE_BACKED` или `REVIEWED`. Такое повышение должно происходить отдельным review-процессом с evidence contracts.

---

## 10. Тестовый набор

Узкий прогон:

```text
node prototype/tests/semantic-p78-alpha-orbit-contracts-regression.cjs
PASS: 19/19 checks
```

Покрыты:

1. девять уровней и отсутствие commit authority;
2. биекция kind/alpha;
3. радиусы безопасного кольца;
4. детерминированные artifact hashes;
5. несовместимые `α/kind`, источники и порядок refs;
6. скрытые, symbol и accessor поля;
7. golden-chain из восьми последовательных специализаций через все девять орбит;
8. обычное обобщение;
9. обычная детализация;
10. внутренняя и внешняя защитные границы;
11. coverage/provenance/qualifier/authority loss;
12. типизированные radial/horizontal edges;
13. `LINK`;
14. содержательный `ORBIT`;
15. двунаправленный `BRIDGE`;
16. `PARK/ABSTAIN/ROLLBACK`;
17. порча хеша и повторно хешированная структурная подделка;
18. свежий VM replay и явный dependency failure;
19. отсутствие DOM/network/clock/random/evaluator/commit paths.

Тест автоматически входит в `prototype/tests/run-all.cjs`, потому что имя соответствует шаблону `semantic-*-regression.cjs`. Раннер не требует ручного списка suites.

---

## 11. Дефект, найденный тестами

Первый прогон обнаружил ошибку в общем helper перечислений:

```js
if (!values[value]) reject();
```

Для `KIND_TO_ALPHA.CONCEPT = 0` корректный элемент выглядел ложным. Проверка заменена на наличие собственного ключа:

```js
if (!Object.prototype.hasOwnProperty.call(values, value)) reject();
```

Это принципиально важный тест именно для средней орбиты: без него `α=0`, задуманная как опорная зона, была бы единственным недоступным уровнем. После исправления весь узкий набор проходит `19/19`.

---

## 12. Разделение графов

Контракты относятся к `G_sem` и создают структурные receipts для `G_work`:

```text
G_sem:
  alpha artifacts
  typed semantic edges

G_work:
  transition proposal
  validation outcome
  AlphaTransitionReceipt

G_view:
  пока отсутствует
```

Формула радиуса экспортирована как чистая функция, но модуль ничего не рисует. Будущий `G_view` сможет прочитать `artifact.alpha` и вычислить радиус. Обратного канала `pixel radius -> semantic commit` нет.

Сохраняется инвариант:

```text
metric(G_view) must not authorize semantic commit
```

---

## 13. Почему модуль пока не подключён к shell

Подключение одной строкой `<script>` технически просто, но преждевременное подключение не даст пользователю новой функции. Оно лишь увеличит runtime surface.

До подключения нужны:

1. read-only adapter, который получает существующие P78 results и создаёт только валидные alpha artifacts;
2. фиксированный демонстрационный snapshot для девяти орбит;
3. пассивная view без кнопок commit;
4. тест загрузочного порядка;
5. desktop/mobile screenshot-проверка;
6. проверка отсутствия влияния на frame scheduler.

Поэтому текущий статус честно называется `NOT_WIRED_TO_P78_SHELL`, а не «готовый интерфейс девяти орбит».

---

## 14. Следующий срез B

Следующий минимальный вертикальный результат:

```text
AlphaSnapshot
  -> passive AlphaOrbitViewModel
  -> static nine-ring projection
  -> selected-artifact inspector
```

Ограничения среза B:

- snapshot создаётся из заранее валидированных artifacts/edges/receipts;
- view model является чистой функцией;
- Canvas не создаёт и не изменяет artifacts;
- все девять радиусов стабильны;
- цвет дублируется `α`, текстовой меткой и типом линии;
- защитные зоны видимы, но не интерактивны;
- текстовый инспектор показывает source refs, qualifiers и receipt;
- perpetual animation не обязательна;
- основной существующий semantic result остаётся главным выводом.

После read-only среза можно отдельно проектировать рабочую очередь трёх операторов. Нельзя сразу соединять кнопку пользователя с `createTransitionReceipt` и считать receipt разрешением на semantic commit: текущий контракт специально публикует `commitAllowed:false`.

---

## 15. Итог

Девять орбит перестали быть только документированной метафорой. Срез A даёт исполняемую и тестируемую структуру:

- полезные `α=-4..+4` находятся внутри 2D;
- центр и внешность закрыты отдельными guards;
- артефакты и связи типизированы;
- переходы content-addressed;
- обычный шаг равен одной орбите;
- пропуск требует полной witness chain;
- provenance и qualifiers нельзя молча потерять;
- структурная проверка не получает authority истины или commit.

Технически срез A завершён. Пользовательский интерфейс пока не изменён; следующий проверяемый этап — пассивная проекция `G_view`, а не генерация или автоматическое принятие текста.
