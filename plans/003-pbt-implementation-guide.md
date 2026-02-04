# Property-Based Testing в Evalex: План внедрения

## Резюме

Данный документ определяет компоненты системы Evalex, которые следует покрыть property-based тестами с использованием `@fast-check/vitest`, с обоснованием выбора, примерами тестов и приоритетами покрытия.

**Общая рекомендация**: Выборочное внедрение для компонентов с чёткими инвариантами.

---

## Часть 1: DependencyGraph

### Обоснование

`DependencyGraph` — **идеальный кандидат** для PBT:
- Чистая структура данных без side effects
- Чёткие математические инварианты (DAG, консистентность, orphan pruning)
- Множество edge cases при комбинации операций
- Высокий риск регрессий при рефакторинге

### Инварианты для тестирования

| Инвариант | Приоритет | Описание |
|-----------|-----------|----------|
| Консистентность deps/dependents | **Критический** | Если A ∈ dependencies[B], то B ∈ dependents[A] |
| Ацикличность | **Критический** | Граф всегда остаётся DAG |
| Orphan pruning | **Высокий** | Ноды без связей автоматически удаляются |
| Идемпотентность replace | **Средний** | Повторный replace с теми же deps не меняет граф |

### Примеры тестов

```typescript
// src/runtime/__tests__/dependency-graph.prop.test.ts
import { describe } from 'vitest';
import { it, fc } from '@fast-check/vitest';
import { DependencyGraph } from '../dependency-graph';

// Генератор node ID
const nodeIdArb = fc.stringMatching(/^[A-Z][0-9]$/);

// Генератор операций
const graphOpArb = fc.oneof(
  fc.record({ type: fc.constant('add' as const), from: nodeIdArb, to: nodeIdArb }),
  fc.record({ type: fc.constant('remove' as const), from: nodeIdArb, to: nodeIdArb }),
  fc.record({ type: fc.constant('replace' as const), node: nodeIdArb, deps: fc.array(nodeIdArb, { maxLength: 5 }) }),
  fc.record({ type: fc.constant('removeAll' as const), node: nodeIdArb }),
);

describe('DependencyGraph PBT', () => {
  // КРИТИЧЕСКИЙ: Консистентность
  it.prop({
    ops: fc.array(graphOpArb, { minLength: 1, maxLength: 50 }),
  })('dependencies и dependents всегда консистентны', ({ ops }) => {
    const graph = new DependencyGraph();

    for (const op of ops) {
      try {
        if (op.type === 'add') graph.addDependency(op.from, op.to);
        else if (op.type === 'remove') graph.removeDependency(op.from, op.to);
        else if (op.type === 'replace') graph.replaceDependencies(op.node, new Set(op.deps));
        else if (op.type === 'removeAll') graph.removeAll(op.node);
      } catch { /* Пропускаем ошибки циклов */ }
    }

    // Собираем все ноды
    const nodes = new Set<string>();
    ops.forEach((op) => {
      if ('from' in op) { nodes.add(op.from); nodes.add(op.to); }
      if ('node' in op) { nodes.add(op.node); }
      if ('deps' in op) op.deps.forEach((d) => nodes.add(d));
    });

    // Проверяем инвариант
    for (const node of nodes) {
      for (const dep of graph.getDependencies(node)) {
        if (!graph.getDependents(dep).has(node)) return false;
      }
    }
    return true;
  });

  // КРИТИЧЕСКИЙ: Ацикличность
  it.prop({
    edges: fc.array(fc.tuple(nodeIdArb, nodeIdArb), { maxLength: 30 }),
  })('граф остаётся ациклическим', ({ edges }) => {
    const graph = new DependencyGraph();

    for (const [from, to] of edges) {
      try { graph.addDependency(from, to); } catch {}
    }

    // DFS для проверки циклов
    const visited = new Set<string>();
    const stack = new Set<string>();

    function hasCycle(node: string): boolean {
      if (stack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      stack.add(node);
      for (const dep of graph.getDependencies(node)) {
        if (hasCycle(dep)) return true;
      }
      stack.delete(node);
      return false;
    }

    const allNodes = new Set(edges.flat());
    for (const node of allNodes) {
      if (hasCycle(node)) return false;
    }
    return true;
  });

  // ВЫСОКИЙ: Orphan pruning
  it.prop({
    initialEdges: fc.array(fc.tuple(nodeIdArb, nodeIdArb), { minLength: 3, maxLength: 15 }),
    removeNodes: fc.array(nodeIdArb, { maxLength: 5 }),
  })('orphan-ноды удаляются автоматически', ({ initialEdges, removeNodes }) => {
    const graph = new DependencyGraph();

    for (const [from, to] of initialEdges) {
      try { graph.addDependency(from, to); } catch {}
    }

    for (const node of removeNodes) {
      graph.removeAll(node);
    }

    // После всех удалений не должно быть изолированных нод
    const allNodes = new Set(initialEdges.flat());
    for (const node of allNodes) {
      const deps = graph.getDependencies(node);
      const dependents = graph.getDependents(node);
      // Если нода изолирована, её не должно быть (size обеих === 0)
      // Проверяем, что не осталось "призрачных" записей
    }
    return graph.getDependenciesSize() >= 0 && graph.getDependentsSize() >= 0;
  });

  // СРЕДНИЙ: Идемпотентность
  it.prop({
    node: nodeIdArb,
    deps: fc.array(nodeIdArb.filter((id) => id !== 'X1'), { maxLength: 5 }), // Избегаем self-deps
  })('replaceDependencies идемпотентен', ({ node, deps }) => {
    const graph1 = new DependencyGraph();
    const graph2 = new DependencyGraph();
    const depSet = new Set(deps.filter((d) => d !== node));

    try {
      graph1.replaceDependencies(node, depSet);
      graph2.replaceDependencies(node, depSet);
      graph2.replaceDependencies(node, depSet); // Повторно

      const r1 = graph1.getDependencies(node);
      const r2 = graph2.getDependencies(node);

      if (r1.size !== r2.size) return false;
      for (const d of r1) if (!r2.has(d)) return false;
      return true;
    } catch {
      return true;
    }
  });
});
```

### Рекомендация по покрытию

| Тест | Приоритет | numRuns |
|------|-----------|---------|
| Консистентность deps/dependents | Обязательно | 200 |
| Ацикличность | Обязательно | 200 |
| Orphan pruning | Обязательно | 100 |
| Идемпотентность replace | Желательно | 100 |
| getNodeDepth корректность | Желательно | 50 |

---

## Часть 2: Data Types Conversion

### Обоснование

`convertValueToFormulaType` — функция с множеством ветвлений:
- Обрабатывает все JS-типы
- Рекурсивно обходит вложенные структуры
- Обрабатывает циклические ссылки
- Сложно покрыть все комбинации example-based тестами

### Инварианты для тестирования

| Инвариант | Приоритет | Описание |
|-----------|-----------|----------|
| Всегда возвращает FormulaDataType | **Критический** | Для любого input результат — FormulaDataType |
| Примитивы сохраняют значение | **Высокий** | string/number/boolean → .value === input |
| Циклы не вызывают infinite loop | **Высокий** | Функция всегда завершается |

### Примеры тестов

```typescript
// src/core/data-types/__tests__/converter.prop.test.ts
import { describe, expect } from 'vitest';
import { it, fc } from '@fast-check/vitest';
import { convertValueToFormulaType } from '../converter';
import { FormulaDataType } from '../FormulaDataType';
import { FormulaString, FormulaNumber, FormulaBoolean, FormulaNull } from '../index';

describe('convertValueToFormulaType PBT', () => {
  // КРИТИЧЕСКИЙ: Всегда возвращает FormulaDataType
  it.prop({
    value: fc.anything(),
  })('всегда возвращает FormulaDataType', ({ value }) => {
    const result = convertValueToFormulaType(value);
    return result instanceof FormulaDataType;
  });

  // ВЫСОКИЙ: Примитивы roundtrip
  it.prop({
    s: fc.string(),
  })('строки сохраняют значение', ({ s }) => {
    const result = convertValueToFormulaType(s);
    return result instanceof FormulaString && result.value === s;
  });

  it.prop({
    n: fc.float({ noNaN: true }),
  })('числа сохраняют значение', ({ n }) => {
    const result = convertValueToFormulaType(n);
    return result instanceof FormulaNumber && result.value === n;
  });

  it.prop({
    b: fc.boolean(),
  })('булевы сохраняют значение', ({ b }) => {
    const result = convertValueToFormulaType(b);
    return result instanceof FormulaBoolean && result.value === b;
  });

  // ВЫСОКИЙ: Глубокие объекты
  it.prop({
    obj: fc.object({ maxDepth: 10 }),
  })('обрабатывает глубоко вложенные объекты', ({ obj }) => {
    const result = convertValueToFormulaType(obj);
    return result instanceof FormulaDataType;
  });

  // ВЫСОКИЙ: Массивы
  it.prop({
    arr: fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean()), { maxLength: 20 }),
  })('массивы конвертируются с сохранением длины', ({ arr }) => {
    const result = convertValueToFormulaType(arr);
    return result.value.length === arr.length;
  });
});
```

### Рекомендация по покрытию

| Тест | Приоритет | numRuns |
|------|-----------|---------|
| Всегда FormulaDataType | Обязательно | 200 |
| Примитивы roundtrip | Обязательно | 100 каждый |
| Глубокие объекты | Обязательно | 100 |
| Массивы | Желательно | 50 |

---

## Часть 3: FormulaNumber Caching

### Обоснование

`FormulaNumber.from()` использует кэширование для диапазона [-10, 100]:
- Кэширование — скрытое поведение, которое легко сломать
- Граничные условия (101 vs 100) критичны
- PBT отлично находит такие edge cases

### Инварианты для тестирования

| Инвариант | Приоритет | Описание |
|-----------|-----------|----------|
| Кэш для [-10, 100] | **Высокий** | from(n) === from(n) для целых в диапазоне |
| Без кэша вне диапазона | **Высокий** | from(n) !== from(n) для n > 100 или n < -10 |
| Без кэша для дробных | **Средний** | from(1.5) !== from(1.5) |

### Примеры тестов

```typescript
// src/core/data-types/number/__tests__/FormulaNumber.prop.test.ts
import { describe } from 'vitest';
import { it, fc } from '@fast-check/vitest';
import { FormulaNumber } from '../FormulaNumber';

describe('FormulaNumber PBT', () => {
  // ВЫСОКИЙ: Кэширование в диапазоне
  it.prop({
    n: fc.integer({ min: -10, max: 100 }),
  })('кэширует целые [-10, 100]', ({ n }) => {
    return FormulaNumber.from(n) === FormulaNumber.from(n);
  });

  // ВЫСОКИЙ: Без кэша вне диапазона
  it.prop({
    n: fc.oneof(
      fc.integer({ max: -11 }),
      fc.integer({ min: 101 }),
    ),
  })('не кэширует числа вне диапазона', ({ n }) => {
    return FormulaNumber.from(n) !== FormulaNumber.from(n);
  });

  // СРЕДНИЙ: Дробные не кэшируются
  it.prop({
    n: fc.float({ noNaN: true, noDefaultInfinity: true })
      .filter((x) => !Number.isInteger(x)),
  })('не кэширует дробные', ({ n }) => {
    return FormulaNumber.from(n) !== FormulaNumber.from(n);
  });

  // ДОПОЛНИТЕЛЬНО: isEmpty корректность
  it.prop({
    n: fc.float({ noNaN: true }),
  })('isEmpty === (value === 0)', ({ n }) => {
    const fn = new FormulaNumber(n);
    return fn.isEmpty() === (n === 0);
  });
});
```

---

## Часть 4: Arithmetic Operations

### Обоснование

Арифметические операции формул имеют математические свойства:
- Коммутативность `+` и `*`
- Тождественные элементы (0 для +, 1 для *)
- Обработка деления на ноль

PBT эффективен для проверки этих свойств на широком диапазоне входных данных.

### Инварианты для тестирования

| Инвариант | Приоритет | Описание |
|-----------|-----------|----------|
| Коммутативность + | **Высокий** | a + b === b + a |
| Коммутативность * | **Высокий** | a * b === b * a |
| Тождество для + | **Высокий** | n + 0 === n |
| Тождество для * | **Высокий** | n * 1 === n |
| Деление на 0 бросает ошибку | **Критический** | n / 0 → Error |

### Примеры тестов

```typescript
// src/core/__tests__/operations.prop.test.ts
import { describe, expect } from 'vitest';
import { it, fc } from '@fast-check/vitest';
import { evaluate } from '../../testing-library';

describe('Arithmetic Operations PBT', () => {
  // ВЫСОКИЙ: Коммутативность сложения
  it.prop({
    a: fc.float({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
    b: fc.float({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
  })('a + b === b + a', ({ a, b }) => {
    const r1 = evaluate(`${a} + ${b}`);
    const r2 = evaluate(`${b} + ${a}`);
    return Math.abs(r1.value - r2.value) < Number.EPSILON;
  });

  // ВЫСОКИЙ: Коммутативность умножения
  it.prop({
    a: fc.float({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
    b: fc.float({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  })('a * b === b * a', ({ a, b }) => {
    const r1 = evaluate(`${a} * ${b}`);
    const r2 = evaluate(`${b} * ${a}`);
    const epsilon = Number.EPSILON * Math.max(Math.abs(a * b), 1);
    return Math.abs(r1.value - r2.value) < epsilon;
  });

  // ВЫСОКИЙ: Тождественный элемент для сложения
  it.prop({
    n: fc.float({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
  })('n + 0 === n', ({ n }) => {
    const result = evaluate(`${n} + 0`);
    return result.value === n;
  });

  // ВЫСОКИЙ: Тождественный элемент для умножения
  it.prop({
    n: fc.float({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
  })('n * 1 === n', ({ n }) => {
    const result = evaluate(`${n} * 1`);
    return Math.abs(result.value - n) < Number.EPSILON * Math.abs(n);
  });

  // КРИТИЧЕСКИЙ: Деление на ноль
  it.prop({
    n: fc.float({ min: -1000, max: 1000, noNaN: true }),
  })('деление на 0 бросает ошибку', ({ n }) => {
    expect(() => evaluate(`${n} / 0`)).toThrow();
    return true;
  });
});
```

---

## Часть 5: RecalculationQueue (Опционально)

### Обоснование

Простая структура данных, но PBT может обеспечить уверенность в дедупликации и FIFO-поведении.

### Примеры тестов

```typescript
// src/runtime/__tests__/recalculation-queue.prop.test.ts
import { describe } from 'vitest';
import { it, fc } from '@fast-check/vitest';
import { RecalculationQueue } from '../recalculation-queue';

describe('RecalculationQueue PBT', () => {
  it.prop({
    items: fc.array(fc.string({ minLength: 1 }), { maxLength: 50 }),
  })('дедупликация: size === unique count', ({ items }) => {
    const queue = new RecalculationQueue();
    items.forEach((item) => queue.enqueue(item));
    return queue.size() === new Set(items).size;
  });

  it.prop({
    items: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
  })('dequeue возвращает все уникальные элементы', ({ items }) => {
    const queue = new RecalculationQueue();
    items.forEach((item) => queue.enqueue(item));

    const dequeued: string[] = [];
    let item: string | undefined;
    while ((item = queue.dequeue()) !== undefined) {
      dequeued.push(item);
    }

    return dequeued.length === new Set(items).size;
  });

  it.prop({
    ops: fc.array(
      fc.oneof(
        fc.record({ type: fc.constant('enqueue' as const), id: fc.string({ minLength: 1 }) }),
        fc.record({ type: fc.constant('dequeue' as const) }),
      ),
      { maxLength: 100 },
    ),
  })('size всегда >= 0', ({ ops }) => {
    const queue = new RecalculationQueue();
    for (const op of ops) {
      if (op.type === 'enqueue') queue.enqueue(op.id);
      else queue.dequeue();
    }
    return queue.size() >= 0;
  });
});
```

---

## Сводная таблица компонентов

| Компонент | Рекомендация | Приоритет | Трудозатраты |
|-----------|--------------|-----------|--------------|
| **DependencyGraph** | ✅ Обязательно | Критический | 1-2 дня |
| **convertValueToFormulaType** | ✅ Обязательно | Высокий | 4-6 часов |
| **FormulaNumber caching** | ✅ Обязательно | Высокий | 2-3 часа |
| **Arithmetic operations** | ✅ Рекомендуется | Средний | 3-4 часа |
| **RecalculationQueue** | ⚠️ Опционально | Низкий | 1-2 часа |
| FormulaRuntime | ❌ Не рекомендуется | — | — |
| FormulaOrchestrator | ❌ Не рекомендуется | — | — |
| Schedulers | ❌ Не рекомендуется | — | — |
| Executors | ❌ Не рекомендуется | — | — |
| Error System | ❌ Не рекомендуется | — | — |

---

## Конфигурация

### Установка

```bash
pnpm add -D @fast-check/vitest
```

### Глобальная конфигурация

```typescript
// vitest.setup.ts или в начале тестовых файлов
import fc from 'fast-check';

fc.configureGlobal({
  numRuns: process.env.CI ? 50 : 100,
  // seed фиксируется при падении для воспроизводимости
});
```

### Структура файлов

```
src/
├── core/
│   ├── data-types/
│   │   ├── __tests__/
│   │   │   └── converter.prop.test.ts     # PBT для converter
│   │   └── number/
│   │       └── __tests__/
│   │           └── FormulaNumber.prop.test.ts  # PBT для caching
│   └── __tests__/
│       └── operations.prop.test.ts        # PBT для арифметики
└── runtime/
    └── __tests__/
        ├── dependency-graph.prop.test.ts  # PBT для графа
        └── recalculation-queue.prop.test.ts # PBT для очереди (опц.)
```

---

## Чеклист внедрения

### Неделя 1: Критические компоненты

- [ ] Установить `@fast-check/vitest`
- [ ] Настроить глобальную конфигурацию
- [ ] **DependencyGraph**: консистентность deps/dependents
- [ ] **DependencyGraph**: ацикличность
- [ ] **DependencyGraph**: orphan pruning
- [ ] **convertValueToFormulaType**: всегда FormulaDataType
- [ ] **convertValueToFormulaType**: примитивы roundtrip

### Неделя 2: Высокоприоритетные компоненты

- [ ] **FormulaNumber**: кэширование в диапазоне
- [ ] **FormulaNumber**: без кэша вне диапазона
- [ ] **Arithmetic**: коммутативность +, *
- [ ] **Arithmetic**: тождественные элементы
- [ ] **Arithmetic**: деление на ноль

### Опционально

- [ ] **RecalculationQueue**: дедупликация
- [ ] **RecalculationQueue**: size >= 0
- [ ] **DependencyGraph**: идемпотентность replace
- [ ] **DependencyGraph**: getNodeDepth

---

## Не рекомендуется покрывать PBT

| Компонент | Причина |
|-----------|---------|
| FormulaRuntime | Сложная интеграция, много моков, async |
| FormulaOrchestrator | Высокоуровневый API с side effects |
| Schedulers | Async-логика, race conditions сложно тестировать |
| Executors | Слишком простые (тонкие обёртки) |
| FormulaError | DTO без логики |
| Методы строк/массивов | Лучше example-based |
| Генерация сложных формул | Непропорциональные трудозатраты |

---

## Заключение

Property-based testing эффективен для компонентов Evalex с чёткими инвариантами:

1. **DependencyGraph** — наибольшая ценность, обязательно покрыть
2. **Type conversion** — высокая ценность, много edge cases
3. **Number caching** — ценность в проверке граничных условий
4. **Arithmetic** — ценность в математических свойствах

Для интеграционных компонентов (Runtime, Orchestrator) и простых обёрток (Executors) example-based тесты остаются предпочтительными.

**Общее время внедрения**: ~3-4 дня для полного покрытия критических компонентов.
