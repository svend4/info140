# 06 — Псевдокод и псевдо-решения

> Документ серии MERIDIAN. Это **самый технический** документ серии. Здесь нет философии «зачем» — она в [01-philosophy.md](01-philosophy.md). Нет полного описания полей инфонов — оно в [02-infons-closed-system.md](02-infons-closed-system.md). Нет вывода геометрии — он в [03-geometry-topology.md](03-geometry-topology.md). Нет физики потоков и логистики — она в [04-logistics-dynamics.md](04-logistics-dynamics.md). Здесь — **исполнимая логика**: структуры данных, главный цикл, рычаг λ, маршрутизация, расписание, балансировка пробок, взаимодействия, инварианты и конфиг.
>
> Псевдокод **язык-агностичен**: отступы значимы, типы аннотированы, комментарии на русском. Цель — чтобы разработчик мог взять блок и почти дословно перенести его в Rust/C#/TypeScript/C++ без додумывания семантики. Это ПРОХОД 1 («теория + псевдокод»). Визуализация, схемы и интерактивный прототип — в следующих проходах ([07-roadmap.md](07-roadmap.md)).

---

## Содержание

- [06.0 Соглашения и нотация](#060-соглашения-и-нотация)
- [06.1 Структуры данных](#061-структуры-данных)
- [06.2 Главный цикл симуляции (tick)](#062-главный-цикл-симуляции-tick)
- [06.3 Рычаг λ: реакции дробления и слияния](#063-рычаг-λ-реакции-дробления-и-слияния)
- [06.4 Маршрутизация по гибридному графу](#064-маршрутизация-по-гибридному-графу)
- [06.5 Расписание / конвейер (фазовый планировщик)](#065-расписание--конвейер-фазовый-планировщик)
- [06.6 Пробки и балансировка потоков](#066-пробки-и-балансировка-потоков)
- [06.7 Взаимодействия двух инфонов](#067-взаимодействия-двух-инфонов)
- [06.8 Инварианты и законы сохранения](#068-инварианты-и-законы-сохранения)
- [06.9 Конфиг: параметры по умолчанию](#069-конфиг-параметры-по-умолчанию)
- [06.10 Карта зависимостей и порядок реализации](#0610-карта-зависимостей-и-порядок-реализации)

---

## 06.0 Соглашения и нотация

**Определение 0.1 (нотация типов).** Используем краткие имена типов:

| Тип | Значение |
|---|---|
| `Int`, `Float` | целое / число с плавающей точкой (рекомендуется `f64`) |
| `Bool` | логическое |
| `Id` | непрозрачный целочисленный идентификатор (u64), `0` зарезервирован под «нет» |
| `Vec2` | двумерный вектор `{x: Float, y: Float}` (для 2D-варианта) |
| `Polar` | полярные координаты `{r: Float, theta: Float}` на орбитальной плоскости |
| `Enum{...}` | перечисление |
| `List<T>` | динамический массив |
| `Map<K,V>` | хеш-таблица |
| `Ref<T>` | ссылка/индекс на объект (не владеющая) |
| `Opt<T>` | значение либо «нет» (nullable) |

**Соглашение 0.2 (детерминизм).** Симуляция **детерминирована** при фиксированном `seed`. Весь рандом идёт через `World.rng` (PCG/xoshiro), никаких обращений к глобальному ГСЧ. Это критично для воспроизводимости багов и для будущего сетевого/replay-режима.

**Соглашение 0.3 (единицы рычага).** Управляющий параметр λ ∈ (0,1) — **строго внутри открытого интервала**. Нигде в коде λ не может стать 0 или 1: при чтении/записи применяется `clamp_open(λ, ε, 1−ε)` (см. [06.3](#063-рычаг-λ-реакции-дробления-и-слияния)). Это прямое воплощение центральной идеи из [01-philosophy.md](01-philosophy.md): оба полюса губительны, рычаг никогда не выкручивается до упора.

**Соглашение 0.4 (фиксированный шаг).** Интегрирование — с **фиксированным** `dt` (полу-неявный Эйлер / симплектик). Рендер может идти с интерполяцией между тиками, но физика — только фиксированным шагом. Это нужно для устойчивости законов сохранения ([06.8](#068-инварианты-и-законы-сохранения)).

---

## 06.1 Структуры данных

Полная семантика полей инфона — в [02-infons-closed-system.md](02-infons-closed-system.md); здесь даём **рабочий слепок полей** в виде структуры, пригодной для реализации.

### 06.1.1 Infon

```
// ИНФОН — частица-носитель смысла И транспортная единица одновременно.
// Метафора: смайлик в городе с высоты птичьего полёта (см. 02).
struct Infon:
    // --- идентичность ---
    id            : Id            // уникальный, неизменный
    generation    : Int          // поколение (растёт при split/merge) — для отладки и анти-дребезга

    // --- смысловая нагрузка (СЕМАНТИКА) ---
    payload       : Semantics     // содержимое смысла (см. ниже)
    mass          : Float         // «смысловая масса» m > 0 — СОХРАНЯЕМАЯ величина
    charge        : Float         // «смысловой заряд» q (знак = притяжение/отталкивание) — СОХРАНЯЕМАЯ
    coherence     : Float         // связность c ∈ [0,1]: 1 = цельный смысл, 0 = шум/пыль
    entropy       : Float         // внутренняя энтропия s ∈ [0,1]: мера «раздробленности» содержимого

    // --- кинематика (ТРАНСПОРТ) ---
    pos           : Polar         // позиция на орбитальной плоскости (r, theta)
    vel           : Vec2          // линейная скорость (в декартовых, для интегрирования)
    orbit_id      : Id            // текущая оболочка/орбита (см. Orbit) — «дом» инфона
    target_orbit  : Id            // целевая орбита (куда стремится; может == orbit_id)

    // --- логистика (МАРШРУТ) ---
    node_at       : Opt<Id>       // станция/узел, на котором инфон сейчас стоит (если стоит)
    route         : Opt<Route>    // текущий план перемещения по графу
    route_progress: Float         // прогресс вдоль текущего ребра [0,1]
    state         : InfonState    // конечный автомат поведения (см. ниже)
    wait_ticks    : Int           // сколько тиков стоит в очереди/ожидании

    // --- служебное ---
    last_interact : Id            // id последнего партнёра по взаимодействию (анти-дребезг)
    cooldown      : Int           // тики до следующей разрешённой реакции split/merge
    flags         : BitSet        // PINNED, SPLITTING, MERGING, FROZEN_DEBUG, ...

// Содержимое смысла. В прототипе можно держать как токены/строку,
// в продакшене — как ссылку на узел смыслового графа.
struct Semantics:
    tokens        : List<Token>   // атомы смысла (буквы/цифры/слова/идеограммы — см. 01)
    label         : Opt<String>   // «заголовок» агрегата (важно для полюса ОБОБЩЕНИЯ)
    depth         : Int           // уровень обобщения: 0 = шум, выше = более обобщённо

enum InfonState:
    IDLE          // дрейфует на орбите, без задачи
    SEEKING       // движется к target_orbit / по маршруту
    QUEUED        // стоит в очереди на станции
    TRANSFERRING  // едет по ребру (в «вагоне»/линии)
    REACTING      // в процессе split/merge (заблокирован на cooldown)
    PARKED        // припаркован (PINNED), не участвует в потоке
```

**Замечание 1.1.** `mass`, `charge` — это величины, по которым работают **законы сохранения** ([06.8](#068-инварианты-и-законы-сохранения)). `coherence` и `entropy` — это «качество смысла»: к полюсу ДРОБЛЕНИЯ `entropy→1, coherence→0`; к полюсу ОБОБЩЕНИЯ `depth→∞`, и единственный мега-инфон поглощает всё (`label` = «энциклопедия мира», см. [01-philosophy.md](01-philosophy.md)).

### 06.1.2 Orbit (оболочка / орбита)

```
// ОРБИТА — концентрическая оболочка (как электронная оболочка / орбита планеты).
// Конечный упорядоченный набор орбит = «таблица Менделеева» системы (см. 02, 03).
struct Orbit:
    id            : Id
    index         : Int          // 0 = ближайшая к центру, растёт наружу
    radius        : Float        // средний радиус r_k
    width         : Float        // допустимый «коридор» по r вокруг radius
    capacity      : Int          // макс. число инфонов (как заполнение оболочки)
    occupancy     : Int          // текущее число (кэш; пересчитывается)
    potential_k   : Float        // коэф. удерживающего потенциала на этой оболочке
    node_ids      : List<Id>     // станции, лежащие на этой орбите
    is_core_guard : Bool         // ближайшая к центру: усиленный штраф «за центр»
    is_rim_guard  : Bool         // самая внешняя: усиленный штраф «к границе»
```

### 06.1.3 Node / Station (узел / станция)

```
// УЗЕЛ ГРАФА. Станция метро = узел с очередью и расписанием.
// Пересечения дуг «Цветка жизни» / Шри Янтры тоже узлы (см. 03).
struct Node:
    id            : Id
    pos           : Polar         // положение узла
    orbit_id      : Id            // к какой орбите принадлежит (или 0 для пересечений-«мостов»)
    kind          : NodeKind
    edges_out     : List<Id>      // исходящие рёбра
    queue         : Deque<Id>     // очередь инфонов, ожидающих отправки (FIFO + приоритет)
    queue_cap     : Int           // вместимость очереди (порог переполнения)
    served_phase  : Int           // фаза расписания, в которой узел «отпускает» очередь
    load_ema      : Float         // сглаженная загрузка (для балансировки, см. 06.6)

enum NodeKind:
    STATION       // обычная станция (посадка/высадка)
    JUNCTION      // пересадка (несколько линий)
    BRIDGE        // «мост» между орбитами (радиальный переход)
    SINK_SOFT     // мягкий приёмник (временная парковка), НЕ выход из системы
```

> Важно: в системе **нет** узлов-выходов наружу и нет стока в центр. Система **замкнута** (см. [02-infons-closed-system.md](02-infons-closed-system.md), [06.8](#068-инварианты-и-законы-сохранения)). `SINK_SOFT` — это лишь буфер, он отдаёт инфоны обратно.

### 06.1.4 Edge / Lane / Route (ребро / линия / маршрут)

```
// РЕБРО — направленный участок пути между двумя узлами.
struct Edge:
    id            : Id
    a             : Id            // узел-источник
    b             : Id            // узел-приёмник
    kind          : EdgeKind      // тип геометрии участка
    base_len      : Float         // геометрическая длина (стоимость по умолчанию)
    capacity      : Int           // сколько инфонов помещается одновременно (вместимость линии)
    occupancy     : Int           // текущая загрузка
    dyn_weight    : Float         // динамический вес (растёт с загрузкой; см. 06.4 и 06.6)
    speed         : Float         // базовая скорость движения по ребру
    lane_id       : Id            // к какой «линии метро» (Lane) принадлежит ребро

enum EdgeKind:
    ARC           // дуга по орбите (касательное движение)
    RADIAL        // радиальный переход между орбитами (BRIDGE→BRIDGE)
    CHORD         // хорда «Цветка жизни» (диагональ-пересечение, см. 03)

// LANE — «линия метро»: упорядоченная цепочка рёбер с общим расписанием.
struct Lane:
    id            : Id
    edge_ids      : List<Id>      // последовательность рёбер
    phase_offset  : Int           // сдвиг фазы в расписании (волна отправления)
    headway       : Int           // интервал между «поездами» в тиках

// ROUTE — конкретный план перемещения инфона (результат маршрутизации).
struct Route:
    node_path     : List<Id>      // последовательность узлов
    edge_path     : List<Id>      // последовательность рёбер (между узлами пути)
    cursor        : Int           // индекс текущего ребра в edge_path
    cost_estimate : Float         // оценочная стоимость (для перепланирования)
    issued_tick   : Int           // когда построен (для протухания/инвалидации)
```

### 06.1.5 Scheduler (планировщик-конвейер)

```
// ПЛАНИРОВЩИК — фазовый конвейер: разбивает время на такты и фазы,
// рассылает «волны отправления» по линиям (см. 06.5).
struct Scheduler:
    tick          : Int           // глобальный счётчик тиков
    phase         : Int           // текущая фаза в цикле (0..phase_count-1)
    phase_count   : Int           // число фаз в одном полном такте конвейера
    lane_phase    : Map<Id,Int>   // lane_id -> назначенная фаза отправления
    departures    : List<Departure> // запланированные отправления на текущий тик

struct Departure:
    lane_id       : Id
    from_node     : Id
    batch_size    : Int           // сколько инфонов отпустить из очереди
```

### 06.1.6 Lever (рычаг λ)

```
// РЫЧАГ — единый управляющий параметр λ ∈ (0,1).
// λ→0: усиливается ДРОБЛЕНИЕ (split); λ→1: усиливается ОБОБЩЕНИЕ (merge).
// Реализован как ОБРАТНО-ПРОПОРЦИОНАЛЬНАЯ пара тенденций (см. 01, 06.3).
struct Lever:
    lambda        : Float         // текущее значение, ВСЕГДА в (eps, 1-eps)
    eps           : Float         // зазор от краёв (напр. 0.02) — гарантия открытого интервала
    target        : Float         // куда плавно ведём lambda (для анимации/управления)
    slew          : Float         // макс. изменение lambda за тик (плавность рычага)
    // производные тенденции (кэш, пересчитываются из lambda каждый тик):
    split_drive   : Float         // тяга к дроблению  = f_split(lambda)
    merge_drive   : Float         // тяга к слиянию    = f_merge(lambda)
```

### 06.1.7 World / System (мир)

```
// МИР — корневой контейнер замкнутой системы.
struct World:
    cfg           : Config        // параметры (см. 06.9)
    rng           : Rng           // детерминированный ГСЧ (см. соглашение 0.2)
    lever         : Lever
    scheduler     : Scheduler

    infons        : SlotMap<Id,Infon>   // все инфоны (стабильные id, плотное хранение)
    orbits        : List<Orbit>
    nodes         : Map<Id,Node>
    edges         : Map<Id,Edge>
    lanes         : Map<Id,Lane>

    // пространственный индекс для быстрого поиска соседей (взаимодействия, столкновения)
    grid          : SpatialHash   // бакеты по (orbit_index, theta-сектор)

    // законсервированные суммы (эталон для инвариантов, см. 06.8)
    total_mass_0  : Float         // эталонная суммарная масса (на момент init)
    total_charge_0: Float         // эталонный суммарный заряд

    // телеметрия (для балансировки и отладки)
    metrics       : Metrics
```

---

## 06.2 Главный цикл симуляции (tick)

Порядок шагов **фиксирован** и обоснован: расписание задаёт «кто едет», силы и интегрирование двигают всех, столкновения разрешают конфликты позиций, реакции по λ меняют состав, инварианты проверяют замкнутость, рендер-хук только читает.

```
function world_tick(W: World):
    // ----------------------------------------------------------------
    // ШАГ 0. Обновить рычаг (плавно подвести lambda к target)
    // ----------------------------------------------------------------
    lever_update(W.lever)            // см. 06.3 — clamp в открытый интервал

    // ----------------------------------------------------------------
    // ШАГ 1. РАСПИСАНИЕ: продвинуть фазу конвейера, сформировать отправления
    // ----------------------------------------------------------------
    scheduler_advance(W.scheduler)        // tick++, phase = (phase+1) % phase_count
    departures = scheduler_collect(W)     // какие линии отправляют волну в этой фазе
    for d in departures:
        release_from_queue(W, d)          // выпустить batch_size инфонов из очереди узла
                                          // → перевести их в state=TRANSFERRING на ребро

    // ----------------------------------------------------------------
    // ШАГ 2. СИЛЫ: вычислить ускорения для всех «свободно летящих» инфонов
    //   (удержание на орбите + межинфонные силы заряда + потенциалы графа)
    // ----------------------------------------------------------------
    rebuild_spatial_index(W.grid, W.infons)   // обновить бакеты по позициям
    for inf in W.infons where inf.state in {IDLE, SEEKING}:
        a = vec2(0,0)
        a += orbital_restoring_force(W, inf)      // тянет к radius целевой орбиты
        a += inter_infon_force(W, inf)            // заряд: притяжение/отталкивание (по grid)
        a += graph_potential_force(W, inf)        // штраф «за центр»/«к границе» как сила
        inf.accel = a

    // ----------------------------------------------------------------
    // ШАГ 3. ИНТЕГРИРОВАНИЕ: полу-неявный (симплектик) Эйлер, фикс. dt
    // ----------------------------------------------------------------
    dt = W.cfg.dt
    for inf in W.infons where inf.state in {IDLE, SEEKING}:
        inf.vel += inf.accel * dt
        inf.vel = clamp_speed(inf.vel, W.cfg.v_max)   // нет «вечного ускорения» (см. 01)
        inf.pos = integrate_polar(inf.pos, inf.vel, dt)
        inf.pos = clamp_to_orbit_corridor(W, inf)     // нельзя покинуть систему/центр

    // продвинуть тех, кто едет по рёбрам (детерминированно, по speed ребра)
    for inf in W.infons where inf.state == TRANSFERRING:
        advance_along_edge(W, inf, dt)                // route_progress += ...; смена ребра/узла

    // ----------------------------------------------------------------
    // ШАГ 4. СТОЛКНОВЕНИЯ / ВСТРЕЧИ: собрать пары-кандидаты и разрешить
    // ----------------------------------------------------------------
    pairs = collect_neighbor_pairs(W.grid, W.cfg.interact_radius)
    for (a, b) in pairs:
        resolve_interaction(W, a, b)        // см. 06.7: обмен/слияние/отталкивание/очередь

    // ----------------------------------------------------------------
    // ШАГ 5. РЕАКЦИИ ПО λ: применить дробление и слияние
    //   (split тянется split_drive, merge — merge_drive; обратно-пропорц.)
    // ----------------------------------------------------------------
    apply_lambda_reactions(W)               // см. 06.3

    // ----------------------------------------------------------------
    // ШАГ 6. ПРОБКИ И БАЛАНСИРОВКА: пересчитать загрузки, перераспределить
    // ----------------------------------------------------------------
    recompute_edge_loads(W)                 // dyn_weight по occupancy (см. 06.4/06.6)
    balance_flows(W)                        // разгрузить пробки, оживить «пустые улицы»

    // ----------------------------------------------------------------
    // ШАГ 7. ИНВАРИАНТЫ: проверить законы сохранения (замкнутость системы)
    // ----------------------------------------------------------------
    check_invariants(W)                     // см. 06.8 — assert суммарной массы/заряда

    // ----------------------------------------------------------------
    // ШАГ 8. РЕНДЕР-ХУК: только ЧТЕНИЕ состояния (мутации запрещены)
    // ----------------------------------------------------------------
    render_hook(W)                          // визуализация делается в следующем проходе
    metrics_collect(W)                      // телеметрия для тюнинга баланса
```

**Замечание 2.1 (почему такой порядок).** Расписание (1) первично, потому что оно решает, кто вообще двигается по графу в этой фазе; силы (2) и интегрирование (3) обновляют непрерывное движение; столкновения (4) разрешают конфликты *после* движения; реакции (5) меняют **состав** системы и потому идут после кинематики; балансировка (6) реагирует на уже сложившуюся загрузку; инварианты (7) ловят нарушение замкнутости *до* рендера; рендер (8) — read-only.

---

## 06.3 Рычаг λ: реакции дробления и слияния

Центральная идея ([01-philosophy.md](01-philosophy.md)): два полюса бесконечны и губительны; λ включает их **обратно пропорционально**, никогда не на 100%.

### 06.3.1 Обновление рычага и производные тенденции

```
function clamp_open(x: Float, lo: Float, hi: Float) -> Float:
    // гарантирует СТРОГО открытый интервал: never lo, never hi
    return max(lo, min(hi, x))

function lever_update(L: Lever):
    // плавно подвести lambda к target (рычаг не «прыгает»)
    step = clamp(L.target - L.lambda, -L.slew, +L.slew)
    L.lambda = clamp_open(L.lambda + step, L.eps, 1 - L.eps)   // КЛЮЧЕВОЕ: (0,1)

    // Тенденции — обратно пропорциональны.
    // При lambda→0 доминирует дробление; при lambda→1 — слияние.
    // Симметричная пара: split_drive высок слева, merge_drive высок справа.
    L.split_drive = (1 - L.lambda)        // тяга к ДРОБЛЕНИЮ
    L.merge_drive = (L.lambda)            // тяга к ОБОБЩЕНИЮ
    // (нелинейность можно усилить: pow(1-λ, k) и pow(λ, k); см. cfg.lever_gamma)
```

**Определение 3.1 («осмысленность» / жизнь системы).** Вводим индекс жизни
`vitality(λ) = 4 · λ · (1−λ)` — парабола с максимумом в λ=0.5 и нулями на краях. Это **операционная** форма тезиса «смысл максимален где-то внутри, не на краях» ([01-philosophy.md](01-philosophy.md)). Используется в телеметрии и для авто-регулятора (см. [06.6](#066-пробки-и-балансировка-потоков)). Оптимум *не обязан* быть ровно 0.5 — реальный максимум смещают пробки и состав; парабола лишь базовая модель.

### 06.3.2 Пороги и вероятности реакций как функция λ

```
// Чем сильнее тяга к дроблению, тем НИЖЕ порог и ВЫШЕ вероятность split.
// Симметрично для merge. Все вероятности в [0,1].
function split_probability(W, inf: Infon) -> Float:
    L = W.lever
    // предрасположенность инфона к распаду: больше у «тяжёлых» и связных
    affinity = saturate(inf.mass / W.cfg.split_mass_ref) * inf.coherence
    p = L.split_drive * W.cfg.split_base_rate * affinity
    // подавление, если инфон уже слишком «пыльный» (нечего больше дробить осмысленно)
    p *= (1 - inf.entropy)
    return saturate(p)

function merge_probability(W, a: Infon, b: Infon) -> Float:
    L = W.lever
    // слияние охотнее для совместимых (близкий depth, согласный заряд)
    compat = semantic_compatibility(a, b)             // ∈[0,1], см. 06.7
    p = L.merge_drive * W.cfg.merge_base_rate * compat
    // подавление около «энциклопедического» предела: не даём схлопнуть всё в одно
    p *= generalization_brake(W, a, b)                // см. ниже
    return saturate(p)

// ТОРМОЗ ОБОБЩЕНИЯ: чем ближе к единственному мега-инфону, тем сильнее душим merge.
// Не даём системе достичь полюса ОБОБЩЕНИЯ (всё=ничто).
function generalization_brake(W, a, b) -> Float:
    n = W.infons.count
    // при малом числе инфонов тормоз → 0 (merge почти запрещён)
    return saturate( (n - W.cfg.min_infons) / (W.cfg.merge_brake_span) )

// СИММЕТРИЧНО: тормоз дробления у нижней границы — не даём всё рассыпать в шум.
function fragmentation_brake(W) -> Float:
    n = W.infons.count
    return saturate( (W.cfg.max_infons - n) / W.cfg.split_brake_span )
```

**Замечание 3.2.** `generalization_brake` и `fragmentation_brake` — это «стенки» открытого интервала на уровне *популяции*: λ обеспечивает открытость на уровне параметра, тормоза — на уровне числа объектов. Вместе они гарантируют, что система не достигнет ни «одного заголовка-энциклопедии», ни «пыли из букв» ([01-philosophy.md](01-philosophy.md)).

### 06.3.3 split(infon) — дробление с сохранением массы и заряда

```
// Разбивает инфон на 2 (или k) дочерних. СУММАРНАЯ масса и заряд СОХРАНЯЮТСЯ.
function split(W, inf: Infon) -> List<Id>:
    if inf.cooldown > 0 or inf.flags.PINNED: return []
    if fragmentation_brake(W) <= 0: return []        // нельзя дробить ниже предела популяции

    k = 2                                             // базовое деление надвое
    children = []

    // 1) делим СЕМАНТИКУ: токены распределяются между детьми (см. 02)
    parts = partition_tokens(inf.payload.tokens, k, W.rng)

    // 2) делим СОХРАНЯЕМЫЕ величины так, чтобы сумма была равна исходной
    mass_parts   = split_conserving(inf.mass,   k, W.rng)   // Σ mass_parts   == inf.mass
    charge_parts = split_conserving(inf.charge, k, W.rng)   // Σ charge_parts == inf.charge

    for i in 0..k:
        c = new Infon
        c.id          = alloc_id(W)
        c.generation  = inf.generation + 1
        c.payload     = make_semantics(parts[i], depth = max(0, inf.payload.depth - 1))
        c.mass        = mass_parts[i]
        c.charge      = charge_parts[i]
        c.coherence   = inf.coherence * W.cfg.split_coherence_decay   // дробление РАЗМЫВАЕТ связь
        c.entropy     = saturate(inf.entropy + W.cfg.split_entropy_gain)
        c.pos         = jitter_pos(inf.pos, W.cfg.split_spread, W.rng) // разлёт у места распада
        c.vel         = inf.vel + radial_kick(W.rng, W.cfg.split_kick) // импульс разлёта
        c.orbit_id    = inf.orbit_id
        c.target_orbit= choose_outer_or_same(W, inf.orbit_id)         // дробление тянет наружу
        c.state       = IDLE
        c.cooldown    = W.cfg.reaction_cooldown
        children.push(c.id)
        W.infons.insert(c)

    destroy_infon(W, inf.id)            // родитель исчезает, его масса/заряд ушли в детей
    return children
```

> **Инвариант split:** `Σ child.mass == parent.mass` и `Σ child.charge == parent.charge` (с точностью до `cfg.eps_conserve`). Проверяется в [06.8](#068-инварианты-и-законы-сохранения).

### 06.3.4 merge(a,b) — слияние с сохранением массы и заряда

```
// Сливает два инфона в один. Масса и заряд СУММИРУЮТСЯ (сохраняются).
function merge(W, a: Infon, b: Infon) -> Opt<Id>:
    if a.cooldown > 0 or b.cooldown > 0: return none
    if a.flags.PINNED or b.flags.PINNED: return none
    if generalization_brake(W, a, b) <= 0: return none    // нельзя сливать у предела «всё в одно»

    m = new Infon
    m.id          = alloc_id(W)
    m.generation  = max(a.generation, b.generation) + 1

    // 1) СОХРАНЕНИЕ: суммируем массу и заряд
    m.mass        = a.mass + b.mass
    m.charge      = a.charge + b.charge

    // 2) СЕМАНТИКА: объединяем токены, поднимаем уровень обобщения
    m.payload     = unify_semantics(a.payload, b.payload)
    m.payload.depth = max(a.payload.depth, b.payload.depth) + 1
    m.payload.label = synth_label(a.payload, b.payload)    // новый «заголовок» агрегата (см. 01)

    // 3) КАЧЕСТВО: слияние ПОВЫШАЕТ связность, СНИЖАЕТ энтропию (до предела)
    m.coherence   = saturate( weighted_avg(a.coherence, a.mass, b.coherence, b.mass)
                              + W.cfg.merge_coherence_gain )
    m.entropy     = saturate( weighted_avg(a.entropy, a.mass, b.entropy, b.mass)
                              - W.cfg.merge_entropy_drop )

    // 4) КИНЕМАТИКА: центр масс + сохранение импульса
    m.pos         = mass_weighted_pos(a, b)
    m.vel         = (a.vel * a.mass + b.vel * b.mass) / m.mass      // импульс сохраняется
    m.orbit_id    = nearest_orbit(W, m.pos)
    m.target_orbit= choose_inner_or_same(W, m.orbit_id)            // обобщение тянет к центру
    m.state       = IDLE
    m.cooldown    = W.cfg.reaction_cooldown
    m.last_interact = b.id

    W.infons.insert(m)
    destroy_infon(W, a.id)
    destroy_infon(W, b.id)
    return m.id
```

> **Инвариант merge:** `merged.mass == a.mass + b.mass` и `merged.charge == a.charge + b.charge`. Импульс `p = Σ m·v` сохраняется по построению.

### 06.3.5 apply_lambda_reactions — применение реакций за тик

```
function apply_lambda_reactions(W):
    // --- ДРОБЛЕНИЕ ---
    // проходим снапшот id (split меняет коллекцию)
    for id in snapshot_ids(W.infons):
        inf = W.infons.get(id); if inf == none: continue
        if inf.state == REACTING or inf.cooldown > 0: continue
        if rng_chance(W.rng, split_probability(W, inf)):
            inf.flags.SPLITTING = true
            split(W, inf)

    // --- СЛИЯНИЕ ---
    // используем уже собранные пары-соседи (см. ШАГ 4); фильтруем по совместимости
    for (a, b) in nearby_merge_candidates(W):
        if a.cooldown > 0 or b.cooldown > 0: continue
        if rng_chance(W.rng, merge_probability(W, a, b)):
            merge(W, a, b)

    // декремент кулдаунов
    for inf in W.infons: inf.cooldown = max(0, inf.cooldown - 1)
```

---

## 06.4 Маршрутизация по гибридному графу

Геометрия — гибрид орбит + «Цветка жизни» + метро ([03-geometry-topology.md](03-geometry-topology.md)). Маршрут ищется по графу `(nodes, edges)` модифицированным A* со **взвешенными потенциалами**: штраф «за центр» (не сваливаться в коллапс) и штраф «к границе» (не убегать из системы), плюс динамический вес по загрузке (анти-пробка).

### 06.4.1 Стоимость ребра

```
// Полная стоимость прохода ребра = геометрия × динамика × потенциалы.
function edge_cost(W, e: Edge, from: Node, to: Node) -> Float:
    base = e.base_len / max(e.speed, W.cfg.eps)

    // --- ДИНАМИЧЕСКИЙ ВЕС (анти-пробка): растёт нелинейно с загрузкой ---
    load = e.occupancy / max(e.capacity, 1)
    congestion = 1 + W.cfg.congestion_k * pow(load, W.cfg.congestion_pow)

    // --- ПОТЕНЦИАЛ «ЗА ЦЕНТР»: чем ближе к центру, тем дороже туда лезть ---
    // (мешает «пробке/коллапсу» в центре — см. 01, 04)
    to_orbit = orbit_of(W, to)
    center_penalty = W.cfg.center_w * center_potential(to_orbit.index)  // ↑ при index→0

    // --- ПОТЕНЦИАЛ «К ГРАНИЦЕ»: чем ближе к внешнему краю, тем дороже ---
    // (мешает «вылету частицы из системы» — см. 01)
    rim_penalty = W.cfg.rim_w * rim_potential(to_orbit.index, W.orbits.len)  // ↑ при index→max

    return base * congestion + center_penalty + rim_penalty

// Потенциалы — монотонные «стенки» у обоих краёв (U-образная долина посередине).
function center_potential(index: Int) -> Float:
    return 1.0 / (index + 1)            // велик у центра (index=0), мал снаружи
function rim_potential(index: Int, n: Int) -> Float:
    return 1.0 / (n - index)            // велик у внешней орбиты, мал внутри
```

**Замечание 4.1.** Сумма двух потенциалов даёт **долину устойчивости** в средних орбитах — прямой геометрический аналог «жизнь максимальна внутри интервала» из [06.3](#063-рычаг-λ-реакции-дробления-и-слияния). Маршрутизатор естественно избегает и центра, и края.

### 06.4.2 Эвристика и A*

```
// Допустимая эвристика: геометрическое расстояние / макс. скорость.
// Потенциалы в эвристику НЕ включаем (иначе потеряем допустимость) —
// они учитываются только в реальной стоимости edge_cost.
function heuristic(W, n: Node, goal: Node) -> Float:
    return polar_distance(n.pos, goal.pos) / W.cfg.v_max

function find_route(W, start: Id, goal: Id) -> Opt<Route>:
    open   = PriorityQueue()            // по f = g + h
    g_cost = Map<Id,Float>(default = +inf)
    came   = Map<Id, (Id /*node*/, Id /*edge*/)>()

    g_cost[start] = 0
    open.push(start, heuristic(W, node(W,start), node(W,goal)))

    while not open.empty():
        cur = open.pop()
        if cur == goal: return reconstruct(came, start, goal)

        for e_id in node(W,cur).edges_out:
            e = edge(W, e_id)
            nb = e.b
            tentative = g_cost[cur] + edge_cost(W, e, node(W,cur), node(W,nb))
            if tentative < g_cost[nb]:
                g_cost[nb] = tentative
                came[nb]   = (cur, e_id)
                f = tentative + heuristic(W, node(W,nb), node(W,goal))
                open.push_or_update(nb, f)

    return none                          // путь не найден (в замкнутой связной системе — редко)
```

**Замечание 4.2 (перепланирование).** `Route.issued_tick` позволяет **инвалидировать** маршрут при сильном росте пробок: если оценочная стоимость текущего ребра выросла больше чем в `cfg.reroute_factor` раз — инфон вызывает `find_route` заново из ближайшего узла. Это делает анти-пробку *реактивной*, а не только превентивной.

---

## 06.5 Расписание / конвейер (фазовый планировщик)

Движение по линиям-метро организовано **волнами отправления**: время режется на такты, такт — на фазы, каждой линии назначена фаза. Это даёт «дыхание» системы (см. [04-logistics-dynamics.md](04-logistics-dynamics.md)).

```
function scheduler_advance(S: Scheduler):
    S.tick  += 1
    S.phase  = (S.phase + 1) mod S.phase_count

// Назначение фаз линиям так, чтобы соседние линии не отправлялись одновременно
// (распределение нагрузки по фазам — против синхронных пробок).
function assign_phases(W):
    for (i, lane_id) in enumerate(W.lanes.keys_sorted()):
        W.scheduler.lane_phase[lane_id] = (i * W.cfg.phase_stride) mod W.scheduler.phase_count
        W.lanes[lane_id].phase_offset    = W.scheduler.lane_phase[lane_id]

// Собрать отправления текущей фазы.
function scheduler_collect(W) -> List<Departure>:
    out = []
    for lane in W.lanes.values():
        // линия отправляет, если её фаза совпала и прошёл headway
        if (W.scheduler.phase == lane.phase_offset)
           and (W.scheduler.tick mod lane.headway == 0):
            head = first_node_of(lane)
            // batch адаптивен: больше отправляем, если очередь длинная (см. 06.6)
            batch = adaptive_batch(W, head, lane)
            out.push(Departure{ lane_id: lane.id, from_node: head.id, batch_size: batch })
    return out

// Выпуск инфонов из очереди узла на первое ребро линии.
function release_from_queue(W, d: Departure):
    n = node(W, d.from_node)
    first_edge = first_edge_of(W, d.lane_id)
    sent = 0
    while sent < d.batch_size and not n.queue.empty():
        if first_edge.occupancy >= first_edge.capacity: break   // ребро полно — стоп
        id  = n.queue.pop_front()
        inf = W.infons.get(id)
        inf.state         = TRANSFERRING
        inf.route_progress= 0
        inf.node_at       = none
        first_edge.occupancy += 1
        sent += 1
```

```
// Адаптивный размер «поезда»: длинная очередь → больше отправляем,
// но не превышаем свободную вместимость первого ребра.
function adaptive_batch(W, head: Node, lane: Lane) -> Int:
    qlen  = head.queue.len
    free  = first_edge_of(W, lane.id).capacity - first_edge_of(W, lane.id).occupancy
    want  = ceil(qlen * W.cfg.batch_fill_ratio)
    return clamp(want, W.cfg.batch_min, min(W.cfg.batch_max, free))
```

---

## 06.6 Пробки и балансировка потоков

Запрещены оба патологических режима: **пробка/коллапс** (слишком плотно) и **пустые улицы** (мёртвая статика). Балансировщик держит плотность в коридоре (см. [04-logistics-dynamics.md](04-logistics-dynamics.md)).

```
function recompute_edge_loads(W):
    for e in W.edges.values():
        load = e.occupancy / max(e.capacity, 1)
        // динамический вес для маршрутизации (нелинейный, см. 06.4)
        e.dyn_weight = 1 + W.cfg.congestion_k * pow(load, W.cfg.congestion_pow)
    for n in W.nodes.values():
        inst = n.queue.len / max(n.queue_cap, 1)
        // EMA — сглаживаем, чтобы балансировщик не «дёргался»
        n.load_ema = lerp(n.load_ema, inst, W.cfg.load_ema_alpha)

function balance_flows(W):
    for n in W.nodes.values():
        // --- ПРОБКА: очередь переполнена → раскидать часть на альтернативы ---
        if n.load_ema > W.cfg.jam_high:
            overflow = n.queue.len - floor(n.queue_cap * W.cfg.jam_target)
            redistribute(W, n, overflow)          // см. ниже

        // --- ПУСТАЯ УЛИЦА: узел почти мёртв → «оживить» приток ---
        else if n.load_ema < W.cfg.empty_low:
            attract_flow(W, n)                    // приподнять привлекательность узла

// Раскидать лишние инфоны на наименее загруженные исходящие маршруты.
function redistribute(W, n: Node, count: Int):
    moved = 0
    // отсортировать исходящие рёбра по dyn_weight (сначала самые свободные)
    alts = sort_by(n.edges_out, key = e -> edge(W,e).dyn_weight)
    for e_id in alts:
        e = edge(W, e_id)
        while moved < count and e.occupancy < e.capacity and not n.queue.empty():
            id  = n.queue.pop_back()              // снимаем с хвоста очереди
            inf = W.infons.get(id)
            // перепланировать маршрут с учётом нового первого ребра
            inf.route = find_route(W, e.b, route_goal(inf))    // см. 06.4
            inf.state = TRANSFERRING
            e.occupancy += 1
            moved += 1
        if moved >= count: break

// «Оживить» пустой узел: временно снизить его потенциальные штрафы,
// чтобы маршрутизатор охотнее вёл через него потоки (анти-застой).
function attract_flow(W, n: Node):
    n.bias = max(n.bias - W.cfg.attract_step, -W.cfg.attract_cap)   // bias входит в edge_cost
    // как только узел снова наполнится, bias плавно вернётся к 0 (см. decay ниже)

function decay_node_bias(W):
    for n in W.nodes.values():
        n.bias = move_toward(n.bias, 0, W.cfg.bias_decay)
```

**Авто-регулятор λ (опционально, см. [06.3](#063-рычаг-λ-реакции-дробления-и-слияния)).**

```
// Если хотим, чтобы система сама держалась в «живой» зоне:
// сдвигаем target рычага так, чтобы максимизировать vitality при разумной плотности.
function autoregulate_lambda(W):
    density = global_density(W)                    // средняя загрузка по системе
    if density > W.cfg.density_high:
        W.lever.target = clamp_open(W.lever.target + W.cfg.lambda_nudge, eps, 1-eps) // больше merge → меньше частиц
    else if density < W.cfg.density_low:
        W.lever.target = clamp_open(W.lever.target - W.cfg.lambda_nudge, eps, 1-eps) // больше split → больше частиц
```

---

## 06.7 Взаимодействия двух инфонов

Когда два инфона встречаются (см. ШАГ 4 главного цикла), выбирается один из исходов: **обмен**, **слияние**, **отталкивание** или **очередь**. Выбор зависит от совместимости, зарядов и локальной плотности.

```
// Семантическая совместимость: близость уровней обобщения + перекрытие токенов.
function semantic_compatibility(a: Infon, b: Infon) -> Float:
    depth_close = 1 - saturate(abs(a.payload.depth - b.payload.depth) / cfg.depth_span)
    token_overlap = jaccard(a.payload.tokens, b.payload.tokens)
    return saturate(0.5*depth_close + 0.5*token_overlap)

function resolve_interaction(W, a: Infon, b: Infon):
    if a.id == b.id: return
    if a.last_interact == b.id and a.cooldown > 0: return        // анти-дребезг

    same_sign = sign(a.charge) == sign(b.charge)
    compat    = semantic_compatibility(a, b)
    dist      = polar_distance(a.pos, b.pos)
    crowded   = local_density(W, a.pos) > W.cfg.crowd_threshold

    // 1) ОЧЕРЕДЬ: если оба у станции и тесно — встают в очередь, а не толкаются
    if crowded and near_station(W, a) and near_station(W, b):
        enqueue_at_nearest_station(W, a)
        enqueue_at_nearest_station(W, b)
        a.state = QUEUED; b.state = QUEUED
        return

    // 2) ОТТАЛКИВАНИЕ: одинаковый заряд ИЛИ несовместимый смысл → разлёт
    if same_sign or compat < W.cfg.compat_min:
        apply_repulsion(W, a, b, W.cfg.repulse_strength)        // импульсы сохраняются
        a.last_interact = b.id; b.last_interact = a.id
        return

    // 3) СЛИЯНИЕ: совместимы, разный/притягивающий заряд, тянет merge_drive
    if compat >= W.cfg.compat_merge and rng_chance(W.rng, merge_probability(W, a, b)):
        merge(W, a, b)                                          // см. 06.3 (сохранение массы)
        return

    // 4) ОБМЕН: частичная передача смысла/заряда без слияния (диалог «смайликов»)
    exchange(W, a, b)

// ОБМЕН: переносим часть заряда и токенов; масса и СУММАРНЫЙ заряд сохраняются.
function exchange(W, a: Infon, b: Infon):
    dq = (b.charge - a.charge) * W.cfg.exchange_rate            // выравнивание заряда
    a.charge += dq;  b.charge -= dq                            // Σ charge неизменна
    transfer_tokens(a.payload, b.payload, W.cfg.exchange_tokens, W.rng)  // обмен смыслом
    // лёгкое выравнивание связности (общение повышает когерентность обоих)
    a.coherence = saturate(a.coherence + W.cfg.exchange_coherence)
    b.coherence = saturate(b.coherence + W.cfg.exchange_coherence)
    a.last_interact = b.id; b.last_interact = a.id
    a.cooldown = W.cfg.interact_cooldown; b.cooldown = W.cfg.interact_cooldown

// ОТТАЛКИВАНИЕ: симметричный импульс вдоль линии центров (закон сохр. импульса).
function apply_repulsion(W, a, b, strength):
    dir = normalize(to_cartesian(a.pos) - to_cartesian(b.pos))
    j   = strength / max(polar_distance(a.pos,b.pos), W.cfg.eps)
    // импульс делится обратно пропорционально массам
    a.vel += dir * (j / a.mass)
    b.vel -= dir * (j / b.mass)
    a.vel = clamp_speed(a.vel, W.cfg.v_max)
    b.vel = clamp_speed(b.vel, W.cfg.v_max)
```

---

## 06.8 Инварианты и законы сохранения

Замкнутость системы (см. [02-infons-closed-system.md](02-infons-closed-system.md)) гарантируется проверками: суммарная масса и заряд должны оставаться в узком коридоре вокруг эталона; ни один инфон не покидает границу и не проваливается в центр.

```
function check_invariants(W):
    // --- 1) СОХРАНЕНИЕ МАССЫ (в коридоре ε) ---
    total_mass = sum(inf.mass for inf in W.infons)
    assert_in_corridor(total_mass, W.total_mass_0, W.cfg.eps_conserve,
                       "НАРУШЕНА суммарная масса")

    // --- 2) СОХРАНЕНИЕ ЗАРЯДА ---
    total_charge = sum(inf.charge for inf in W.infons)
    assert_in_corridor(total_charge, W.total_charge_0, W.cfg.eps_conserve,
                       "НАРУШЕН суммарный заряд")

    // --- 3) ЗАМКНУТОСТЬ ПО ГЕОМЕТРИИ: никто не вне границ ---
    r_min = W.orbits.first().radius - W.orbits.first().width
    r_max = W.orbits.last().radius  + W.orbits.last().width
    for inf in W.infons:
        assert(inf.pos.r >= r_min, "инфон провалился в центр (коллапс) — нарушена замкнутость")
        assert(inf.pos.r <= r_max, "инфон покинул систему (вылет) — нарушена замкнутость")

    // --- 4) НЕТ ВЕЧНОГО УСКОРЕНИЯ: скорости ограничены ---
    for inf in W.infons:
        assert(speed(inf.vel) <= W.cfg.v_max + W.cfg.eps, "превышен предел скорости")

    // --- 5) ПОПУЛЯЦИЯ В ГРАНИЦАХ (открытый интервал на уровне числа объектов) ---
    n = W.infons.count
    assert(n >= W.cfg.min_infons, "достигнут полюс ОБОБЩЕНИЯ (всё в одно)")
    assert(n <= W.cfg.max_infons, "достигнут полюс ДРОБЛЕНИЯ (всё в пыль)")

    // --- 6) РЫЧАГ строго внутри (0,1) ---
    assert(W.lever.lambda > 0 and W.lever.lambda < 1, "λ вышел за открытый интервал")

    // --- 7) НЕТ ЗАСТЫВАНИЯ: средняя кинетика выше порога «жизни» ---
    if W.scheduler.tick mod W.cfg.liveness_window == 0:
        assert(mean_kinetic_energy(W) > W.cfg.liveness_floor, "система застыла (нет движения)")

function assert_in_corridor(value, ref, eps, msg):
    if abs(value - ref) > eps * max(abs(ref), 1):
        // в проде: лог + мягкая коррекция (renormalize); в дебаге: hard assert
        on_invariant_violation(msg, value, ref)
```

**Мягкая коррекция (ренормализация).** Из-за накопления ошибок с плавающей точкой суммарная масса может «плыть». В проде вместо падения применяем нормировку:

```
function renormalize_mass(W):
    total = sum(inf.mass for inf in W.infons)
    k = W.total_mass_0 / max(total, W.cfg.eps)
    for inf in W.infons: inf.mass *= k          // восстанавливаем эталон, доли сохраняются
```

---

## 06.9 Конфиг: параметры по умолчанию

Все числа — **стартовые точки для тюнинга**, не догма. Они согласованы по порядку величины с физикой потоков из [04-logistics-dynamics.md](04-logistics-dynamics.md).

### 06.9.1 Ядро симуляции

| Параметр | Значение | Смысл |
|---|---|---|
| `dt` | `0.016` | шаг интегрирования (с), фиксированный |
| `v_max` | `6.0` | предел скорости (нет «вечного ускорения») |
| `seed` | `0xC0FFEE` | сид ГСЧ (детерминизм) |
| `eps` | `1e-6` | малое число против деления на ноль |
| `interact_radius` | `0.8` | радиус поиска соседей для взаимодействий |

### 06.9.2 Рычаг λ

| Параметр | Значение | Смысл |
|---|---|---|
| `lambda_init` | `0.5` | стартовое λ (центр интервала) |
| `lever_eps` | `0.02` | зазор от краёв: λ ∈ (0.02, 0.98) |
| `lever_slew` | `0.01` | макс. изменение λ за тик (плавность) |
| `lever_gamma` | `1.5` | нелинейность тенденций split/merge |
| `lambda_nudge` | `0.005` | шаг авто-регулятора λ |

### 06.9.3 Реакции (split / merge)

| Параметр | Значение | Смысл |
|---|---|---|
| `split_base_rate` | `0.04` | базовая вероятность дробления за тик |
| `merge_base_rate` | `0.04` | базовая вероятность слияния за тик |
| `split_mass_ref` | `5.0` | масса, при которой split-affinity ≈ 1 |
| `reaction_cooldown` | `30` | тики блокировки реакций после split/merge |
| `split_coherence_decay` | `0.85` | множитель связности при дроблении |
| `split_entropy_gain` | `0.10` | прирост энтропии при дроблении |
| `merge_coherence_gain` | `0.08` | прирост связности при слиянии |
| `merge_entropy_drop` | `0.08` | падение энтропии при слиянии |
| `split_spread` | `0.15` | разлёт позиций детей |
| `split_kick` | `0.5` | импульс разлёта детей |
| `eps_conserve` | `1e-4` | коридор законов сохранения (относительный) |

### 06.9.4 Популяция (тормоза полюсов)

| Параметр | Значение | Смысл |
|---|---|---|
| `min_infons` | `64` | нижняя граница (анти-полюс ОБОБЩЕНИЯ) |
| `max_infons` | `8192` | верхняя граница (анти-полюс ДРОБЛЕНИЯ) |
| `merge_brake_span` | `128` | зона смягчения тормоза слияния |
| `split_brake_span` | `512` | зона смягчения тормоза дробления |

### 06.9.5 Маршрутизация и потенциалы

| Параметр | Значение | Смысл |
|---|---|---|
| `center_w` | `2.0` | вес штрафа «за центр» |
| `rim_w` | `2.0` | вес штрафа «к границе» |
| `congestion_k` | `3.0` | сила анти-пробочного веса |
| `congestion_pow` | `2.0` | нелинейность пробки (квадрат загрузки) |
| `reroute_factor` | `1.8` | во сколько раз рост цены вызывает перепланирование |

### 06.9.6 Расписание / конвейер

| Параметр | Значение | Смысл |
|---|---|---|
| `phase_count` | `8` | число фаз в такте конвейера |
| `phase_stride` | `3` | сдвиг фаз между соседними линиями |
| `batch_fill_ratio` | `0.5` | какую долю очереди отправлять за волну |
| `batch_min` | `1` | минимум в «поезде» |
| `batch_max` | `16` | максимум в «поезде» |

### 06.9.7 Пробки / балансировка

| Параметр | Значение | Смысл |
|---|---|---|
| `jam_high` | `0.85` | порог пробки (EMA очереди) |
| `jam_target` | `0.6` | целевая загрузка после разгрузки |
| `empty_low` | `0.10` | порог «пустой улицы» |
| `load_ema_alpha` | `0.2` | сглаживание загрузки |
| `attract_step` | `0.05` | шаг «оживления» пустого узла |
| `attract_cap` | `1.0` | предел отрицательного bias |
| `bias_decay` | `0.02` | возврат bias к нулю |
| `density_high` | `0.7` | верхний порог авто-регулятора λ |
| `density_low` | `0.3` | нижний порог авто-регулятора λ |

### 06.9.8 Взаимодействия

| Параметр | Значение | Смысл |
|---|---|---|
| `compat_min` | `0.25` | ниже — отталкивание |
| `compat_merge` | `0.7` | выше — кандидат на слияние |
| `repulse_strength` | `1.2` | сила отталкивания |
| `exchange_rate` | `0.3` | доля выравнивания заряда при обмене |
| `exchange_tokens` | `2` | сколько токенов переносится при обмене |
| `exchange_coherence` | `0.02` | прирост связности от «общения» |
| `interact_cooldown` | `8` | анти-дребезг взаимодействий |
| `crowd_threshold` | `0.6` | плотность, при которой включается очередь |
| `depth_span` | `6` | масштаб различия уровней обобщения |

### 06.9.9 Liveness (анти-застывание)

| Параметр | Значение | Смысл |
|---|---|---|
| `liveness_window` | `120` | период проверки «жизни» (тики) |
| `liveness_floor` | `0.01` | минимальная средняя кинетика |

---

## 06.10 Карта зависимостей и порядок реализации

Рекомендуемый порядок сборки прототипа (от простого к сложному, см. [05-game-variants.md](05-game-variants.md) и [07-roadmap.md](07-roadmap.md)):

| Этап | Что реализовать | Зависит от | Проверка |
|---|---|---|---|
| 1 | Структуры данных ([06.1](#061-структуры-данных)) + `World init` | — | компиляция, ассерты init |
| 2 | Интегрирование 1D на одной орбите ([06.2](#062-главный-цикл-симуляции-tick) шаги 2–3) | 1 | инфоны кружат, не вылетают |
| 3 | Инварианты ([06.8](#068-инварианты-и-законы-сохранения)) | 2 | масса/заряд держатся в коридоре |
| 4 | Рычаг λ + split/merge ([06.3](#063-рычаг-λ-реакции-дробления-и-слияния)) | 3 | сохранение при реакциях |
| 5 | Граф + маршрутизация ([06.4](#064-маршрутизация-по-гибридному-графу)) | 1 | путь обходит центр и край |
| 6 | Расписание/конвейер ([06.5](#065-расписание--конвейер-фазовый-планировщик)) | 5 | волны отправления идут |
| 7 | Взаимодействия ([06.7](#067-взаимодействия-двух-инфонов)) | 2,4 | обмен/слияние/отталкивание/очередь |
| 8 | Пробки/балансировка ([06.6](#066-пробки-и-балансировка-потоков)) | 5,6 | нет пробок и пустых улиц |
| 9 | Авто-регулятор λ + тюнинг | 4,8 | система держится в «живой» зоне |

> Дальше — визуализация, схемы и интерактивный прототип ([07-roadmap.md](07-roadmap.md)). Этот документ остаётся живым ТЗ: при изменении баланса правится таблица конфига ([06.9](#069-конфиг-параметры-по-умолчанию)), при изменении модели смысла — структуры ([06.1](#061-структуры-данных)) и реакции ([06.3](#063-рычаг-λ-реакции-дробления-и-слияния)).
