# P78 B2: план выделения ядра реакции

## 1. Цель этапа

Выделить жизненный цикл наблюдаемой реакции из `p78-living-ring-runtime.js` в отдельный классический browser-модуль, не меняя:

- формулы semantic reaction field/runtime;
- частоту вызова из `requestAnimationFrame`;
- таймауты idle-очередей;
- правила паузы и продолжения;
- текстовые формулировки событий;
- открытый интервал кольца `0.18 < u < 0.82`.

Одновременно устранить ABA-сценарий A -> B -> A: старый idle-callback не должен продвигать новый runtime только потому, что детерминированная строка `revision` снова совпала.

## 2. Согласованный результат агентных аудитов

Новый файл:

```text
prototype/lib/p78-reaction-kernel.js
```

Глобальный контракт:

```text
window.MRDP78ReactionKernel
  version
  defaults
  create(config) -> controller
```

Kernel является единственным живым писателем `reactionState`. Основной runtime оставляет у себя canvas, DOM, геометрию мира, локализацию сообщений и единственный цикл `requestAnimationFrame`.

## 3. Разделение ответственности

Kernel владеет:

- расчётом и заменой `reactionState.field`;
- детерминированным `revision`;
- монотонным `runtimeEpoch`;
- созданием, продвижением и снимком observed runtime;
- step/UI idle-очередями и их владельцами;
- `tick`, `lastResult`, `runtimeMs`;
- накоплением UI payload до пассивного flush.

Living runtime владеет:

- cadence: один запрос реакции каждые 24 display-кадра;
- `requestIdleCallback`/`setTimeout(0)` как browser-адаптером;
- преобразованием `worldState.drops` в runtime particles;
- применением effects обратно к `worldState`;
- DOM- и canvas-отрисовкой;
- подготовкой analysis/target/lambda для revision;
- текстом события о BLOCKED или первом срабатывании.

Kernel не обращается к `document`, canvas, `requestAnimationFrame`, сети или глобальным DOM-элементам.

## 4. Схема reactionState 1.1

Сохраняются существующие поля и добавляются:

```text
runtimeEpoch: 0
stepScheduledEpoch: null
uiScheduledEpoch: null
uiPayloadEpoch: null
```

`runtimeEpoch` обозначает экземпляр runtime. Название `generation` не используется, потому что `generation` уже означает глубину причинного каскада semantic reaction runtime.

Правила:

1. `createState()` начинает с epoch `0`.
2. Каждая `initialize()` увеличивает epoch, даже при той же revision и даже если engine недоступен.
3. Общий `MRDP78RuntimeState.reset()` увеличивает прежний epoch и тем самым инвалидирует callback старого состояния.
4. `revision` остаётся детерминированным ключом содержимого и не заменяет epoch.
5. Boolean locks сохраняются для наблюдаемого состояния, а `*ScheduledEpoch` определяет их владельца.

## 5. Контракт controller

Конфигурация `create(config)`:

```text
state                 reactionState
fieldEngine           MRDSemanticReactionField или null
runtimeEngine         MRDSemanticReactionRuntime или null
rulebook              MRDSemanticReactionRules или null
scheduleIdle(task,t)  browser adapter
now()                 monotonic clock
hashText(text)        прежний hash helper
readRevisionInput()   {analysisHash, lambdaRaw, target, mode, triggerToken}
readRuntimeInput()    {running, worldTick, lambda, particles}
applyResult(result)   world adapter; возвращает message
flushUi(payload)      passive UI adapter
```

Публичные методы:

```text
recalculate(input, lambda) -> field|null
initialize() -> runtime|null
scheduleStep() -> boolean
advance() -> result|null
scheduleUi(message, includeOutput) -> boolean
snapshot() -> observed snapshot|null
particle(index) -> field particle|null
getField() -> field|null
```

Неизменяемые значения этапа:

```text
field options: maxDepth=3, budget=8
runtime output interval: 6
step idle timeout: 320
UI idle timeout: 260
runtime.create options: текущий полный набор без изменений
revision prefix: p78-r3
```

## 6. Epoch-owned step queue

При постановке шага:

1. Прочитать текущий epoch и running.
2. Если lock уже принадлежит этому epoch, второй callback не ставить.
3. Записать `stepScheduled=true` и `stepScheduledEpoch=epoch`.
4. Callback захватывает epoch и revision, но particles/lambda/worldTick читает только при исполнении.

При исполнении:

1. Снять lock только если callback всё ещё его владелец.
2. Проверить epoch, running и revision.
3. При любом несовпадении не выполнять других записей.
4. Актуальный callback вызывает `advance()` ровно один раз.

Так старый callback не снимает lock новой эпохи и не продвигает новый runtime в сценарии A -> B -> A.

## 7. Epoch-owned UI queue

Каждый UI payload помечается `uiPayloadEpoch`.

1. Payload другой эпохи сначала очищается, затем получает текущий epoch.
2. Повторные запросы одной эпохи объединяются.
3. Новый epoch может поставить собственный callback, даже если в очереди остался callback старого epoch.
4. Callback снимает только принадлежащий ему lock.
5. Старый callback не рендерит и не очищает payload новой эпохи.
6. Актуальный callback вызывает `flushUi(payload)` и только после успешного render очищает dirty flags, event и `uiPayloadEpoch`.

`initialize()` очищает payload прежней эпохи, но не обнуляет locks уже поставленных callback.

## 8. Порядок подключения

```text
semantic-reaction-rules.js
semantic-reaction-field.js
semantic-reaction-runtime.js
...
p78-runtime-state.js?v=1.1.0
p78-reaction-kernel.js?v=1.0.0
p78-living-ring-runtime.js?v=1.1.0
```

Все файлы остаются синхронными classic scripts без `type="module"`, `async` и `defer`. Living runtime остаётся последним.

## 9. Порядок исполнения

1. Расширить state contract и его регрессии.
2. Создать kernel и VM-harness с fake engine, clock и управляемой idle-очередью.
3. Доказать same-revision ABA, ownership locks, coalescing и render-before-clear.
4. Подключить kernel в HTML и создать adapters в living runtime.
5. Удалить из living runtime прежние реализации init/advance/step/UI scheduler и все прямые записи в `reactionState`.
6. Обновить fixture и статические интеграционные проверки без `combinedSource`-маскировки дубликатов.
7. Запустить все suites.
8. Проверить localhost: движение, pause/resume, повторный одинаковый apply, известную и OOV-фразы, console errors и frame telemetry.

## 10. Файловые владельцы

| Пакет | Файлы |
|---|---|
| State | `lib/p78-runtime-state.js`, `tests/semantic-p78-runtime-state-regression.cjs` |
| Kernel | новый `lib/p78-reaction-kernel.js`, новый kernel regression |
| Shell | `tests/p78-fixture.cjs`, `tests/semantic-p78-shell-regression.cjs` |
| Интеграция | HTML, living runtime, frame/reaction integration regressions |

Параллельные исполнители не редактируют HTML и living runtime. Эти два файла изменяет только интегратор после готовности State и Kernel.

## 11. Приёмочные ворота

- один экспорт `MRDP78ReactionKernel`, без DOM, canvas, сети и dynamic evaluation;
- ни одной старой реализации reaction scheduler в living runtime;
- ни одной прямой записи living runtime в `reactionState`;
- same-revision old step не меняет новый runtime/tick/effects;
- stale UI callback не очищает новый payload и не снимает новый lock;
- burst одной эпохи создаёт один step callback и один UI callback;
- tick продвигается ровно один раз на актуальный callback;
- BLOCKED не применяет effects;
- pause не ставит новый step; pause/resume сохраняет прежнюю семантику;
- один `requestAnimationFrame(frame)` во всём p78 runtime;
- полный набор регрессий зелёный;
- localhost показывает `READY`, предсказуемый `ABSTAIN`, живое движение и отсутствие ошибок консоли.

## 12. Не входит в B2

- изменение semantic formulas или revision key;
- изменение cadence, idle timeouts или runtime budgets;
- новая pause-семантика;
- перенос canvas renderer;
- перенос semantic transaction/ledger;
- оптимизация frame timing под результаты автоматизации браузера.
## 13. Результат внедрения и измерения

Реализация завершила B2 без изменения смысловых формул, cadence и runtime budgets. Дополнительно браузерная проверка выявила источник старого рывка: каждый шестой `reaction-ui` повторно выполнял `semanticPhi`, `semanticGoal` и сборку текстового меню. Один такой callback занимал около 2916 мс.

Исправление:

- living runtime формирует `semanticOutputContext` с уже рассчитанными `analysis`, `guard`, `rails`, `phi` и `goal`;
- пакет действует только при точном совпадении нормализованных `source` и `target`; при несовпадении модули автоматически выполняют полный расчёт;
- `output-menu` повторно использует актуальный `textResult`, поэтому одна UI-проекция не запускает те же формулы второй и третий раз;
- внешний API сохраняет полный самостоятельный расчёт, если предварительный пакет не передан.

Проверка на `http://localhost/01/games/02/prototype/p78-living-ring-interface.html` в Microsoft Edge после перезагрузки:

- `reaction-ui`: 1.6-4.9 мс вместо примерно 2916 мс;
- `reaction-step`: 3.8-13.5 мс в измеренном окне;
- максимальный межкадровый разрыв за 6 секунд: 83.4 мс, многосекундная остановка не повторилась;
- движение, pause/resume, повторный apply, известная фраза, честный OOV `ABSTAIN` и заполненный canvas прошли;
- ошибок приложения нет; предупреждение Canvas2D создал только диагностический `getImageData`.

Итог регрессий: `ALL PASS | suites 19/19 | checks 220/220`.
