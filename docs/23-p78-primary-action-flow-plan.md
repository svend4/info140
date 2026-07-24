# P78 Primary Action Flow: план до реализации

Дата: 2026-07-19  
Статус: контракт зафиксирован до изменения runtime  
Предыдущий этап: [22-p78-reaction-kernel-plan.md](22-p78-reaction-kernel-plan.md)

## 1. Почему это следующий этап

После B2 система уже умеет:

- детерминированно анализировать условие;
- различать движение к 3D-обобщению, по 2D-кольцу и к 1D-детализации;
- строить причинный `OBSERVED`/`FORECAST` trace;
- готовить типизированную транзакцию `ID -> STATE -> EFFECT -> STATE`;
- блокировать небезопасный или устаревший ход;
- записывать commit в ledger и выполнять точный откат.

Но эти возможности разнесены между панелями `текстовый вывод`, `протокол продолжения`, `портал`, `предохранитель`, `события` и `меню выводов`. Пользователь не видит единую цепочку:

```text
ввод -> реакция -> причина -> точное изменение -> guard до/после -> применить -> отменить
```

Это прямо соответствует долгу progressive disclosure и основному потоку из `docs/20-current-stage-audit.md` раздела 16.7.

Три независимых аудита дали два следующих направления:

1. UX и архитектура совпали на **Primary Action Flow**.
2. Семантический аудит предложил историческую Phi по реально принятым шагам.

В этом этапе выполняется только первое направление. Историческая Phi остаётся следующим отдельным срезом, чтобы не смешивать изменение пользовательского контракта с изменением формулы.

## 2. Цель этапа

Сделать основной экран P78 проверяемым рабочим циклом, не удаляя исследовательские приборы:

1. пользователь вводит условие и необязательную цель;
2. система показывает направление и причину реакции;
3. система показывает точную добавляемую строку и полный `afterText`;
4. система показывает `guard` до и после;
5. только `READY`-транзакция может быть применена;
6. применённый ход можно отменить только по точной квитанции;
7. расширенные приборы доступны в отдельном режиме `анализ`.

## 3. Не входит в этап

- новая семантическая формула;
- изменение `semanticPhi`, порогов, lambda, cadence или reaction budgets;
- изменение Canvas-физики и единственного `requestAnimationFrame`;
- удаление существующих исследовательских панелей;
- внешние embeddings или сетевой API;
- изменение transaction, ledger, DSL и action-gate контрактов;
- историческая Phi по ledger.

## 4. Новый владелец действий

Новый classic-script модуль:

```text
prototype/lib/p78-semantic-action-controller.js
window.MRDP78SemanticActionController
version 1.0.0
```

Модуль не знает о DOM, Canvas, rAF, сети и визуальном runtime. Он получает ссылки на `semanticState` и `uiState` и использует уже существующие engines.

### 4.1. API

```text
create(options) -> controller

controller.evaluate(source, target)
controller.commitLine(source, target, line, meta, expectedSource, expectedTarget)
controller.commitText(source, target, fullText, meta, expectedSource, expectedTarget)
controller.commitPrepared(source, target, decision, transaction, meta)
controller.undo(currentSource)
controller.replay(entry, currentSource, currentTarget)
controller.invalidate()
controller.canUndo(currentSource)
controller.snapshot()
```

### 4.2. Единственное владение

Controller становится единственным владельцем записей в:

- `semanticState.decision`;
- `semanticState.continuationProtocol`;
- `semanticState.action`;
- `semanticState.transaction`;
- `semanticState.ledger`;
- `uiState.portalUndo`;
- `uiState.portalLog`.

Living runtime остаётся DOM-адаптером: передаёт текущие source/target, применяет возвращённый `text`, вызывает общий refresh и пишет человекочитаемое событие.

### 4.3. Результат операции

Каждая операция возвращает один outcome:

```text
{
  status,
  changed,
  text,
  code,
  plan,
  decision,
  transaction,
  receipt,
  replayOf,
  evidenceLevel: STRUCTURAL | UNVERIFIED,
  soundness: NOT_COMPUTED
}
```

Controller никогда не изменяет текстовый DOM сам.

## 5. CAS и безопасность

### 5.1. Preview

`evaluate()` готовит decision и transaction, но не изменяет source.

Preview считается применимым только при одновременном выполнении:

- `decision.decision === 'apply'`;
- `transaction.status === 'READY'`;
- `transaction.afterGuard.zone` равен `safe` или `thin`;
- `0.18 < transaction.afterGuard.u < 0.82`;
- после проверки нет конфликтов;
- source и target совпадают с подготовленными снимками.

Последние три условия уже входят в transaction/action-gate. View только показывает их и не создаёт второй источник истины.

### 5.2. Commit

- commit использует только подготовленную transaction;
- первый commit записывает ровно одну ledger-entry и одну receipt;
- повторный commit не дублирует строку и квитанцию;
- stale source или target не изменяют текст и не создают ledger-entry;
- все существующие продвигающие действия проходят через controller.

### 5.3. Undo

- undo разрешён только когда текущий source точно равен `receipt.afterText`;
- успешный undo возвращает `receipt.beforeText` и помечает точную ledger-entry `ROLLED_BACK`;
- ручная правка создаёт `ROLLBACK_CONFLICT`, сохраняет пользовательский текст и инвалидирует устаревшую квитанцию;
- replay остаётся разрешён только для точной rolled-back записи.

## 6. Основной интерфейс

### 6.1. Два режима dock

Верх dock получает сегментированный переключатель:

```text
ход | анализ
```

По умолчанию открыт `ход`.

`ход` показывает только:

- ритм процесса;
- реакцию условия;
- предохранитель;
- единый `resultFlow`.

`анализ` сохраняет все остальные существующие приборы. Переключение режима:

- не пересчитывает семантику;
- не меняет source/target;
- не сбрасывает движение;
- не создаёт transaction;
- управляется также клавишами ArrowLeft/ArrowRight/Home/End.

Отдельный пассивный модуль `p78-interface-mode.js` управляет только видимостью `[data-surface]` и ARIA-состоянием кнопок.

### 6.2. Цель рядом с вводом

Существующий `goalTarget` переносится из глубины dock под основной textarea. ID и обработчики не меняются. Полный `goalMap` остаётся в режиме анализа.

### 6.3. Единый resultFlow

Существующий `continuationProtocol` становится содержимым секции `#resultFlow` и показывает:

- состояние `ready | blocked | stale | applied`;
- направление `к 3D | по кольцу | к 1D`;
- revision и тот же trace hash, который опубликован Canvas;
- `OBSERVED | FORECAST`;
- одну рекомендацию;
- точную `insertLine`;
- полный `afterText`;
- `beforeGuard.zone/u -> afterGuard.zone/u`;
- transaction ID и source/after hashes;
- кнопки проверить, копировать, применить и знакомую пиктограмму undo;
- компактный ledger.

`semantic-decision-view.js` остаётся пассивным: только DOM и callbacks, без записи в состояние и без commit.

## 7. Порядок render

Текущий protocol строится до `resetWorld()` и до обновления trace overlay. Порядок меняется:

```text
analyze -> reaction recalculate -> resetWorld -> text/trace projection -> resultFlow
```

Так `resultFlow.dataset.revision` и `resultFlow.dataset.traceHash` относятся к той же ревизии, что Canvas.

## 8. Файловые владельцы

| Ответственность | Файл |
|---|---|
| action state machine | новый `lib/p78-semantic-action-controller.js` |
| progressive disclosure | новый `lib/p78-interface-mode.js` |
| passive preview/undo UI | `lib/semantic-decision-view.js` |
| DOM adapters and refresh | `lib/p78-living-ring-runtime.js` |
| markup and script order | `p78-living-ring-interface.html` |
| responsive visual states | `p78-living-ring-interface.css` |
| controller contract | новый `tests/semantic-p78-action-controller-regression.cjs` |
| workflow and mode contract | новый `tests/semantic-p78-primary-flow-regression.cjs` |

`semantic-core.js`, transaction, ledger, DSL, action gate, state owner and reaction kernel не меняются.

## 9. Автоматические проверки

### 9.1. Controller

- READY preview не изменяет source;
- exact commit меняет текст ровно один раз;
- repeated commit идемпотентен;
- stale source/target fail closed;
- ledger и receipt записываются один раз;
- exact undo возвращает beforeText и помечает ledger;
- ручная правка даёт `ROLLBACK_CONFLICT`;
- replay сохраняет provenance;
- OOV/clarify/reject не создают применимого действия;
- API статичен, versioned и не использует dynamic evaluation.

### 9.2. Workflow view

- HTML имеет ровно два mode-button;
- каждая dock-section классифицирована как `flow`, `analysis` или `shared`;
- default flow не показывает advanced panels;
- mode switch не вызывает semantic/runtime callback;
- preview показывает exact transaction payload;
- apply/undo disabled-state следует transaction и receipt;
- runtime не содержит прежних реализаций commit/receipt/undo/replay;
- script order: transaction/ledger/decision/action-gate -> controller -> interface mode -> runtime.

### 9.3. Existing suite

Полный baseline до этапа:

```text
ALL PASS | suites 19/19 | checks 220/220
```

После этапа все существующие проверки обязаны сохраниться, а новые suites добавляются к runner автоматически.

## 10. Browser acceptance через localhost

1. `ход` открыт по умолчанию; advanced panels не занимают страницу.
2. Переключение `ход/анализ` не останавливает Canvas и не меняет condition.
3. Рабочая фраза показывает READY preview, exact insertLine/afterText, guard before/after и canvas trace hash.
4. Открытие preview не изменяет textarea.
5. Apply устанавливает exact afterText один раз; повтор не дублирует строку.
6. Undo в той же панели возвращает exact source.
7. Ручная правка после apply блокирует undo без потери правки.
8. OOV даёт clarify/ABSTAIN, disabled Apply и конкретный reason code.
9. Обобщающий и детализирующий fixtures показывают разные направления.
10. Desktop и mobile не имеют горизонтального overflow и перекрытий.
11. Нет ошибок приложения в console.
12. Реакция и движение сохраняют показатели B2 без многосекундных stall.

## 11. Приёмочные ворота

- основной пользовательский путь виден без открытия режима анализа;
- ни одна продвигающая запись не обходит action controller;
- preview и Canvas относятся к одной revision;
- source не меняется до явного Apply;
- Apply и Undo доказаны exact CAS тестами;
- advanced instruments не удалены;
- один rAF и B2 kernel остаются неизменными;
- полный test runner зелёный;
- localhost browser episode пройден.

