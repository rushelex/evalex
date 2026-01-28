# Formula Runtime

Реактивная среда выполнения для evalex с отслеживанием зависимостей, каскадными обновлениями и автоматическим пересчетом. Оркестрирует выполнение формул с производительностью корпоративного уровня.

## 🏗️ Архитектура

Модуль runtime координирует выполнение формул и управление зависимостями:

```
┌─────────────────────────────────────────────────────────────┐
│                    FormulaOrchestrator                      │
│  • Node registry management                                 │
│  • Subscription lifecycle                                   │
│  • High-level API                                           │
└──────────────────────────────┬──────────────────────────────┘
                               │ uses
┌──────────────────────────────┴──────────────────────────────┐
│                    FormulaRuntime                           │
│  • Queue processing                                         │
│  • Dependency graph ownership                               │
│  • Cascading updates                                        │
│  • Memory management (FinalizationRegistry)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ uses
┌──────────────────────────────┴──────────────────────────────┐
│                 Supporting Components                       │
│  • DependencyGraph: Manages node relationships              │
│  • RecalculationQueue: Batches formula processing           │
│  • Scheduler: Controls timing (immediate/batched)           │
│  • Executor: Handles formula evaluation (sync/async)        │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Основные компоненты

### FormulaOrchestrator
Высокоуровневый оркестратор для управления реактивными формулами.

```typescript
import { FormulaOrchestrator } from '~/shared/libs/formula/runtime';

// Интерфейс узла для системы
interface FormulaNode {
  id: string;
  value: unknown;
  error: FormulaError | null;
  formula?: string;
  toFormulaDataType(): FormulaDataType;
}

// Создание оркестратора с адаптером
const orchestrator = new FormulaOrchestrator<FormulaNode>({
  adapter: {
    shouldProcess: (node) => {
      // Определяет, является ли узел формульным
      return node.formula !== undefined;
    },
    toFormulaDataType: (node) => {
      // Преобразует узел в FormulaDataType для контекста
      return node.toFormulaDataType();
    },
    toFormulaString: (node) => {
      // Возвращает строку формулы для вычисления
      return node.formula;
    },
    onCalculate: (node, value, deps) => {
      // Применение результата вычисления
      node.value = value;
    },
    onError: (node, error) => {
      // Обработка ошибок вычисления
      node.error = error;
    }
  }
});
```

### FormulaRuntime
Ядро системы, обрабатывающее вычисления формул и управление зависимостями.

```typescript
import { FormulaRuntime, SyncExecutor, BatchingScheduler } from '~/shared/libs/formula/runtime';

const runtime = new FormulaRuntime({
  nodeProvider: (id) => registry.get(id),
  adapter: myAdapter,
  executor: new SyncExecutor(),
  scheduler: new BatchingScheduler({ delay: 100 }),
  onNodeCleanup: (id) => {
    // Очистка реестра при удалении узла
    registry.delete(id);
  }
});
```

## 📊 Управление зависимостями

### DependencyGraph
Управляет направленным графом зависимостей между узлами.

```typescript
import { DependencyGraph } from '~/shared/libs/formula/runtime';

const graph = new DependencyGraph();

// Добавление зависимостей
graph.addDependency('formula1', 'data1'); // formula1 зависит от data1
graph.addDependency('formula1', 'data2'); // formula1 зависит от data2

// Замена всех зависимостей атомарно
graph.replaceDependencies('formula1', new Set(['data1', 'data3']));

// Получение зависимых узлов
const dependents = graph.getDependents('data1'); // ['formula1']

// Получение зависимостей узла
const dependencies = graph.getDependencies('formula1'); // ['data1', 'data3']
```

**Особенности:**
- **Обнаружение циклов**: Автоматически предотвращает циклические зависимости
- **Атомарные операции**: `replaceDependencies` обеспечивает консистентность
- **Автоматическая очистка**: Удаляет осиротевшие узлы

## ⚡ Планировщики (Schedulers)

### ImmediateScheduler
Выполняет обработку немедленно при поступлении задач.

```typescript
import { ImmediateScheduler } from '~/shared/libs/formula/runtime';

const scheduler = new ImmediateScheduler();

// Подходит для:
// - Простых приложений
// - Отладки
// - Случаев, когда задержка недопустима
```

### BatchingScheduler
Группирует задачи для пакетной обработки с настраиваемой задержкой.

```typescript
import { BatchingScheduler } from '~/shared/libs/formula/runtime';

const scheduler = new BatchingScheduler({
  delayMs: 100  // Запускать вычисление пачками раз в 100 мс
});

// Подходит для:
// - UI приложений
// - Высокочастотных обновлений
// - Оптимизации производительности
```

## 🔄 Исполнители (Executors)

### SyncExecutor
Синхронное выполнение формул в основном потоке.

```typescript
import { SyncExecutor } from '~/shared/libs/formula/runtime';

const executor = new SyncExecutor();

// Характеристики:
// - Простота использования
// - Предсказуемое поведение
// - Подходит для большинства случаев
```

### AsyncExecutor
Асинхронное выполнение формул (может использовать Workers).

```typescript
import { AsyncExecutor } from '~/shared/libs/formula/runtime';

const executor = new AsyncExecutor();

// Характеристики:
// - Не блокирует UI
// - Подходит для сложных вычислений
// - Требует обработки асинхронности
```

## 📋 Очереди обработки

### RecalculationQueue
Стандартная FIFO очередь для обработки формул.

```typescript
import { RecalculationQueue } from '~/shared/libs/formula/runtime';

const queue = new RecalculationQueue();

queue.enqueue('formula1');
queue.enqueue('formula2');

const next = queue.dequeue(); // 'formula1'
const size = queue.size(); // 1
```

## 🚀 Использование

### Базовая настройка

```typescript
import {
  FormulaOrchestrator,
  SyncExecutor,
  ImmediateScheduler
} from '~/shared/libs/formula/runtime';
import { FormulaDataType, FormulaError } from '~/shared/libs/formula/core';

interface MyNode {
  id: string;
  value: FormulaDataType;
  error: FormulaError | null;
  formula?: string;
}

const orchestrator = new FormulaOrchestrator<MyNode>({
  adapter: {
    shouldProcess: (node) => !!node.formula,
    toFormulaDataType: (node) => node.value,
    toFormulaString: (node) => node.formula ?? null,
    onCalculate: (node, value) => {
      node.value = value;
      node.error = null;
    },
    onError: (node, error) => {
      node.error = error;
    }
  },
  executor: new SyncExecutor(),
  scheduler: new ImmediateScheduler()
});
```

### Добавление узлов с подписками

> node должен реализовать `subscribe` метод

```typescript
// Добавление узла с подпиской на изменения
orchestrator.add(node, () => {
  return node.subscribe(() => {
    // При изменении узла пересчитываем зависимые формулы
    orchestrator.enqueueDependents(node.id);
  });
});
```

### Управление жизненным циклом

```typescript
// Добавление узла
orchestrator.add(node);

// Получение узла
const retrievedNode = orchestrator.get(node.id);

// Проверка существования
const exists = orchestrator.has(node.id);

// Удаление узла (с очисткой подписок и зависимостей)
orchestrator.remove(node.id);

// Получение всех ID
const allIds = orchestrator.getAllIds();
```

### Управление вычислениями

```typescript
// Постановка узла в очередь на пересчет
orchestrator.enqueue('formula1');

// Постановка всех зависимых узлов в очередь
orchestrator.enqueueDependents('data1');

// Ожидание завершения всех вычислений
await orchestrator.waitForProcessing();
```

## 🔄 Реактивные обновления

### Каскадные обновления
Система автоматически обновляет зависимые формулы при изменении данных:

```typescript
// Настройка узлов
const data = { id: 'price', value: new FormulaNumber(100) };
const formula1 = { id: 'total', formula: 'price * 2', value: new FormulaNumber(0) };
const formula2 = { id: 'tax', formula: 'total * 0.1', value: new FormulaNumber(0) };

orchestrator.add(data);
orchestrator.add(formula1);
orchestrator.add(formula2);

await orchestrator.waitForProcessing();
// total = 200, tax = 20

// Изменение исходных данных
data.value = new FormulaNumber(150);
orchestrator.enqueueDependents('price');

await orchestrator.waitForProcessing();
// total = 300, tax = 30 (автоматически пересчитано)
```

### Динамические зависимости
Зависимости могут изменяться в зависимости от значений:

```typescript
const condition = { id: 'flag', value: new FormulaBoolean(true) };
const option1 = { id: 'a', value: new FormulaNumber(10) };
const option2 = { id: 'b', value: new FormulaNumber(20) };
const result = { id: 'result', formula: 'if(flag, a, b)', value: new FormulaNumber(0) };

// При flag = true, result зависит от flag и a
// При flag = false, result зависит от flag и b
```

## 🛡️ Безопасность и ограничения

### Встроенные ограничения
```typescript
import { FORMULA_RUNTIME_LIMITS } from '~/shared/libs/formula/runtime';

console.log(FORMULA_RUNTIME_LIMITS.MAX_FORMULAS_COUNT); // 10,000
console.log(FORMULA_RUNTIME_LIMITS.MAX_DEPENDENCIES_PER_FORMULA); // 100
console.log(FORMULA_RUNTIME_LIMITS.MAX_FORMULA_DEPTH); // 50
```

### Обработка ошибок
```typescript
import {
  CircularDependencyError,
  MaxDependenciesExceededError,
  MaxFormulaDepthExceededError,
  MaxFormulasExceededError
} from '~/shared/libs/formula/runtime';

// Ошибки автоматически обрабатываются через adapter.onError
```

## 🧠 Управление памятью

### Автоматическая очистка
Runtime использует `FinalizationRegistry` для автоматической очистки:

```typescript
// Регистрация объекта для GC-очистки
runtime.register(node.id, node);

// При сборке мусора автоматически вызывается:
// - graph.removeAll(nodeId)
// - onNodeCleanup?.(nodeId)
```

### Ручная очистка
```typescript
// Явное удаление регистрации
runtime.unregister(node);

// Удаление узла из оркестратора
orchestrator.remove(node.id);
```

## 🎯 Примеры использования

### Простая реактивная система
```typescript
import { FormulaOrchestrator, SyncExecutor } from '~/shared/libs/formula/runtime';
import { FormulaNumber } from '~/shared/libs/formula/core';

class SimpleNode {
  id: string;
  value: FormulaNumber;
  formula?: string;
  subscribers = new Set<() => void>();

  constructor(id: string, value: FormulaNumber, formula?: string) {
    this.id = id;
    this.value = value;
    this.formula = formula;
  }

  subscribe(callback: () => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  setValue(value: FormulaNumber) {
    this.value = value;
    this.subscribers.forEach(callback => callback());
  }
}

const orchestrator = new FormulaOrchestrator<SimpleNode>({
  adapter: {
    shouldProcess: (node) => !!node.formula,
    toFormulaDataType: (node) => node.value,
    toFormulaString: (node) => node.formula!,
    onCalculate: (node, value) => node.setValue(value as FormulaNumber), // value is FormulaDataType by default
    onError: (node, error) => console.error(`Error in ${node.id}:`, error),
  },
});

// Создание узлов
const price = new SimpleNode('price', new FormulaNumber(100));
const quantity = new SimpleNode('quantity', new FormulaNumber(2));
const total = new SimpleNode('total', new FormulaNumber(0), 'price * quantity');

// Добавление с подписками
orchestrator.add(price, () => price.subscribe(() => {
  orchestrator.enqueueDependents(price.id);
}));

orchestrator.add(quantity, () => quantity.subscribe(() => {
  orchestrator.enqueueDependents(quantity.id);
}));

// Добавление без подписок
orchestrator.add(total);

await orchestrator.waitForProcessing();
console.log(total.value.value); // 200
```

### Производительная система с батчингом
```typescript
import { BatchingScheduler } from '~/shared/libs/formula/runtime';

const performantOrchestrator = new FormulaOrchestrator({
  adapter: myAdapter,
  scheduler: new BatchingScheduler({ delayMs: 10 }),
});

// Множественные изменения будут сгруппированы
for (let i = 0; i < 100; i++) {
  performantOrchestrator.enqueue(`formula${i}`);
}

// Все 100 формул будут обработаны в одном батче
await performantOrchestrator.waitForProcessing();
```

## 📈 Производительность

### Бенчмарки
> [!IMPORTANT]
> Бенчмарк запускался на Apple MacBook Pro M1 Pro 32GB.
> - **Node.js**: 22.13.0
> - **pnpm**: 10.13.1
> - **Vite**: 7.0.0
> - **Vitest**: 3.2.4

- **Простая формула (A + B)**: < 5ms
- **Цепочка из 10 формул**: < 10ms
- **Граф из 100 формул**: < 20ms
- **50 зависимых формул**: обновление < 20ms
- **1000 формул**: холодный старт < 200ms

### Оптимизации
- **Батчинг**: Группировка обновлений для снижения накладных расходов
- **Ленивое вычисление**: Вычисление только активных зависимостей
- **Кэширование AST**: Переиспользование разобранных формул
- **Эффективный граф**: Оптимизированные структуры данных для зависимостей

## 📚 Связанные модули

- **[Parser](../parser/README.md)**: Предоставляет AST для интерпретации
- **[Core](../core/README.md)**: Выполняет вычисления формул

---

**Примечание**: Runtime модуль координирует все аспекты выполнения формул - от управления зависимостями до планирования обработки. Он обеспечивает реактивность и производительность корпоративного уровня для сложных формульных систем.
