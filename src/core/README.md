# Formula Core

Ядро системы evalex для чистых вычислений с расширяемыми типами данных, выражениями формул и stateless обработкой. Основа для построения реактивных формульных систем.

## 🏗️ Архитектура

Модуль core предоставляет **framework-agnostic** реализацию формульного движка:

```
┌────────────────────────────────┐
│            runtime             │  <- Reactive orchestration, dependency management
│  FormulaOrchestrator           │
│  FormulaRuntime                │
└───────────────┬────────────────┘
                │ uses
┌───────────────┴────────────────┐
│            core                │  <- This package
│  • Data types                  │
│  • Evaluation visitors         │
│  • Dependency extractor        │
│  • Error helpers               │
│  • Global functions            │
│  • Expression evaluator        │
└───────────────┬────────────────┘
                │ uses
┌───────────────┴────────────────┐
│            parser              │  <- AST & grammar
│  • AST types & nodes           │
│  • Grammar                     │
│  • Syntax parsing              │
└────────────────────────────────┘
```

_Core не знает о UI, хранилище или асинхронном выполнении – только детерминистический код._

## 📊 Типы данных

Все типы данных наследуются от [`FormulaDataType`](data-types/FormulaDataType.ts:27) и имеют встроенные методы.

### FormulaNumber
Числовой тип данных для математических операций.

```typescript
import { FormulaNumber } from '~/shared/libs/formula/core';

const num = new FormulaNumber(42);
console.log(num.toString()); // "42"
console.log(num.isEmpty()); // false (0 считается пустым)
```

**Встроенные методы:**
- [`empty()`](data-types/methods/core-methods.ts:12) - проверка на пустоту (0 = true)
- [`format()`](data-types/methods/core-methods.ts:32) - форматирование в строку

### FormulaString
Строковый тип для работы с текстом.

```typescript
import { FormulaString } from '~/shared/libs/formula/core';

const text = new FormulaString("Hello World");
```

**Встроенные методы:**
- [`empty()`](data-types/methods/core-methods.ts:12) - проверка на пустоту ("" = true)
- [`format()`](data-types/methods/core-methods.ts:32) - форматирование в строку
- [`upper()`](data-types/string/methods.ts:8) - преобразование в верхний регистр
- [`lower()`](data-types/string/methods.ts:22) - преобразование в нижний регистр
- [`length()`](data-types/string/methods.ts:36) - длина строки
- [`trim()`](data-types/string/methods.ts:50) - удаление пробелов

**Примеры использования:**
```typescript
import { Expression } from '~/shared/libs/formula/core';

// В формулах
new Expression('"hello".upper()').evaluate(); // FormulaString("HELLO")
new Expression('"  text  ".trim().length()').evaluate(); // FormulaNumber(4)
```

### FormulaBoolean
Логический тип для условных операций.

```typescript
import { FormulaBoolean } from '~/shared/libs/formula/core';

const flag = new FormulaBoolean(true);
console.log(flag.isEmpty()); // false (false = true)
```

**Встроенные методы:**
- [`empty()`](data-types/methods/core-methods.ts:12) - проверка на пустоту (false = true)
- [`format()`](data-types/methods/core-methods.ts:32) - форматирование в строку

### FormulaArray
Типизированный массив элементов с функциональными методами.

```typescript
import { FormulaArray, FormulaNumber } from '~/shared/libs/formula/core';

const numbers = new FormulaArray([
  new FormulaNumber(1),
  new FormulaNumber(2),
  new FormulaNumber(3)
], 'Number');
```

**Встроенные методы:**
- [`empty()`](data-types/methods/core-methods.ts:12) - проверка на пустоту ([] = true)
- [`format()`](data-types/methods/core-methods.ts:32) - форматирование в строку
- [`map(callback)`](data-types/array/methods.ts:22) - применение функции к каждому элементу
- [`join(separator?)`](data-types/array/methods.ts:69) - объединение в строку
- [`length()`](data-types/array/methods.ts:99) - количество элементов

**Примеры использования:**
```typescript
import { Expression } from '~/shared/libs/formula/core';

// В формулах с контекстными переменными
new Expression('[1, 2, 3].map(current * 2)').evaluate(); // [2, 4, 6]
new Expression('[1, 2, 3].map(current + index)').evaluate(); // [1, 3, 5]
new Expression('["a", "b", "c"].join(", ")').evaluate(); // "a, b, c"
```

### FormulaObject
Универсальный объектный тип для работы с произвольными JavaScript объектами.

```typescript
import { FormulaObject, Expression } from '~/shared/libs/formula/core';

// Создание из обычного объекта
const user = FormulaObject.from({
  name: "John Doe",
  age: 30,
  profile: {
    city: "New York",
    preferences: { theme: "dark" }
  }
});

// Использование в формулах
new Expression('user.name()').evaluate({ context: { user } }); // FormulaString("John Doe")
new Expression('user.profile().city()').evaluate({ context: { user } }); // FormulaString("New York")
```

**Особенности:**
- **Динамический доступ к полям**: `object.field()` синтаксис
- **Автоматическая конвертация**: [`FormulaObject.from()`](data-types/object/FormulaObject.ts:213) преобразует обычные объекты
- **Безопасная обработка**: Циклические ссылки и специальные значения обрабатываются корректно

**Встроенные методы:**
- [`empty()`](data-types/methods/core-methods.ts:12) - проверка на пустоту ({} = true)
- [`format()`](data-types/methods/core-methods.ts:32) - форматирование в строку
- Динамические методы для доступа к полям объекта

### FormulaDate
Тип для работы с датами, основанный на Temporal API.

```typescript
import { FormulaDate } from '~/shared/libs/formula/core';

const date = FormulaDate.from("2024-01-01");
const jsDate = FormulaDate.from(new Date());
```

**Встроенные методы:**
- [`empty()`](data-types/methods/core-methods.ts:12) - всегда false для дат
- [`format()`](data-types/methods/core-methods.ts:32) - локализованное форматирование
- Дополнительные методы для работы с датами (определены в methods.ts)

### FormulaNull
Специальный тип для представления отсутствующих значений.

```typescript
import { FormulaNull } from '~/shared/libs/formula/core';

const empty = new FormulaNull();
console.log(empty.isEmpty()); // true
```

## 🔧 Глобальные функции

Система предоставляет глобальные функции, доступные в любой формуле.

### if(condition, trueValue, falseValue)
Условная функция для выбора значения на основе условия.

```typescript
import { Expression } from '~/shared/libs/formula/core';

// Примеры использования
new Expression('if(1 > 0, "yes", "no")').evaluate(); // FormulaString("yes")
new Expression('if(user.age() >= 18, "adult", "minor")').evaluate();
```

**Особенности:**
- **Ленивое вычисление**: Вычисляется только нужная ветка
- **Условие пустоты**: Использует метод [`isEmpty()`](data-types/FormulaDataType.ts:69) для определения истинности

### sum(...numbers)
Функция суммирования чисел и массивов.

```typescript
import { Expression } from '~/shared/libs/formula/core';

// Примеры использования
new Expression('sum(1, 2, 3)').evaluate(); // FormulaNumber(6)
new Expression('sum([1, 2, 3])').evaluate(); // FormulaNumber(6)
new Expression('sum([1, 2], 3, 4, 5)').evaluate(); // FormulaNumber(15)
```

**Особенности:**
- **Гибкие аргументы**: Принимает числа и массивы в любых комбинациях
- **Автоматическое разворачивание**: Массивы автоматически разворачиваются

## 🚀 Использование Core API

### Базовая интерпретация

```typescript
import { Expression, FormulaNumber } from '~/shared/libs/formula/core';

// Простое вычисление
new Expression('2 + 3 * 4').evaluate(); // FormulaNumber(14)

// С контекстом
const context = {
  price: new FormulaNumber(100),
  quantity: new FormulaNumber(2),
  tax: new FormulaNumber(0.1)
};

const { result, dependencies } = new Expression('price * quantity * (1 + tax)').evaluate({ context });
console.log(result); // FormulaNumber(220)
console.log(dependencies); // Set(['price', 'quantity', 'tax'])
```

### Работа с объектами

```typescript
import { FormulaObject, Expression } from '~/shared/libs/formula/core';

// Создание сложного объекта
const order = FormulaObject.from({
  items: [
    { name: "Widget A", price: 10, quantity: 2 },
    { name: "Widget B", price: 15, quantity: 1 }
  ],
  customer: { tier: "premium", discount: 0.1 },
  shipping: { cost: 5, method: "express" }
});

// Сложные вычисления
const totalFormula = `
  sum(order.items().map(current.price() * current.quantity())) *
  (1 - order.customer().discount()) +
  order.shipping().cost()
`;

new Expression(totalFormula).evaluate({ context: { order } }); // FormulaNumber(32.5)
```

### Отслеживание зависимостей

```typescript
import { Expression, FormulaNumber, FormulaBoolean } from '~/shared/libs/formula/core';

// Контекст с переменными
const context = {
  flag: new FormulaBoolean(false),
  a: new FormulaNumber(10),
  b: new FormulaNumber(20)
};

// Условная формула
const result = new Expression('if(flag, a, b)').evaluate({ context });

console.log(result.result); // FormulaNumber(20) - так как flag = false
console.log(result.dependencies); // Set(['flag', 'b']) - только используемые зависимости
```

### Извлечение статических зависимостей

```typescript
const staticDeps = new Expression('if(flag, a, b)').extractDependencies();
console.log(staticDeps); // Set(['flag', 'a', 'b']) - все возможные зависимости
```

## 🛡️ Обработка ошибок

### Типы ошибок

```typescript
import {
  FormulaError,
  ArgumentFormulaError,
  ArithmeticFormulaError,
  NameNotFoundFormulaError,
  TypeFormulaError
} from '~/shared/libs/formula/core';
```

### Обработка ошибок

```typescript
import { Expression } from '~/shared/libs/formula/core';

try {
  const { result } = new Expression('10 / 0').evaluate();
} catch (error) {
  if (error instanceof ArithmeticFormulaError) {
    console.log(error.message); // "Division by zero"
    console.log(error.location); // [3, 6] - позиция в формуле
    console.log(error.context);  // Контекст ошибки
  }
}
```

## 🔮 Расширяемость

### Добавление новых типов данных

```typescript
import { FormulaDataType, FormulaDataTypeKind, RoutineArguments, RoutineExamples } from '~/shared/libs/formula/core';

class FormulaCustomType extends FormulaDataType<string> {
  public readonly kind = 'Custom' as FormulaDataTypeKind;

  constructor(value: string) {
    super(value, 'Custom');
  }

  public isEmpty(): boolean {
    return this.value === '';
  }

  public toString(): string {
    return `Custom(${this.value})`;
  }
}

// Регистрация методов
routinesRegistry.registerMethod(FormulaCustomType, 'customMethod', {
  description: 'Custom method example',
  examples: createRoutineExamples([
    {
      formula: (name) => name('custom'),
      result: () => new FormulaCustomType('processed'),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: (instance) => {
    return new FormulaCustomType(`processed_${instance.value}`);
  },
});
```

### Добавление глобальных функций

```typescript
import { FormulaGlobalFunctions, ArgumentsProcessor, Argument } from '~/shared/libs/formula/core';

routinesRegistry.registerFunction('customFunction', {
  description: 'Custom global function',
  examples: createRoutineExamples([
    {
      formula: (name) => name('value'),
      result: () => new FormulaString('Custom: value'),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument('string', { name: 'input' }),
  ]),
  handler: ({ args }) => {
    const [stringArg] = args as [ProcessedArgument<FormulaString>];
    const value = stringArg.dataType.value;
    return new FormulaString(`Custom: ${value}`);
  }
});
```

## 🎯 Visitor Pattern

Core использует паттерн Visitor для обхода AST:

### FormulaEvaluatorVisitor
Основной visitor для вычисления формул.

```typescript
import { FormulaEvaluatorVisitor, FormulaEvaluationContext } from '~/shared/libs/formula/core';

const context = new FormulaEvaluationContext(/* ... */);
const visitor = new FormulaEvaluatorVisitor(context);

// Вычисление узла AST
const result = visitor.evaluateNode(astNode);
```

### DependencyExtractorVisitor
Visitor для извлечения зависимостей без вычисления.

```typescript
import { DependencyExtractorVisitor } from '~/shared/libs/formula/core';

const dependencies = DependencyExtractorVisitor.getDependencies(astNode);
console.log(dependencies); // Set<string>
```

## 📚 Контекст вычислений

### FormulaEvaluationContext
Управляет областями видимости переменных.

```typescript
import { FormulaEvaluationContext, FormulaNumber } from '~/shared/libs/formula/core';

// Создание контекста
const globalProps = new Map([
  ['x', new FormulaNumber(10)],
  ['y', new FormulaNumber(20)]
]);

const context = new FormulaEvaluationContext(globalProps);

// Создание вложенного контекста (для map, filter и т.д.)
const nestedContext = context.createNestedContext({
  current: new FormulaNumber(5),
  index: new FormulaNumber(0)
});
```

## 🔍 Отладка

### FormulaDebugger
Утилита для отладки вычислений.

```typescript
import { FormulaDebugger } from '~/shared/libs/formula/core';

// Включение отладки
FormulaDebugger.enable();

// Теперь все вычисления будут логироваться в консоль
new Expression('2 + 3').evaluate(); // Выведет: "Formula: 2 + 3 => Number: 5"

// Отключение отладки
FormulaDebugger.disable();
```

## 📝 Примеры использования

### Бизнес-логика
```typescript
import { Expression, FormulaNumber } from '~/shared/libs/formula/core';

// RICE scoring для приоритизации задач
const context = {
  priority: new FormulaNumber(4),
  reach: new FormulaNumber(100),
  impact: new FormulaNumber(3),
  confidence: new FormulaNumber(0.8),
  effort: new FormulaNumber(5)
};

new Expression('if(priority > 3, reach * impact * confidence / effort, 0)')
  .evaluate({ context }); // FormulaNumber(48)
```

### Аналитика команды
```typescript
// Анализ производительности команды
const teamData = FormulaObject.from({
  members: [
    { name: "Alice", tasksCompleted: 15, hoursWorked: 40 },
    { name: "Bob", tasksCompleted: 12, hoursWorked: 38 }
  ]
});

const productivity = new Expression(
  'sum(team.members().map(current.tasksCompleted() / current.hoursWorked()))'
).evaluate({ context: { team: teamData } }); // (15 / 40) + (12 / 38) => FormulaNumber(0.69)
```

## 📚 Связанные модули

- **[Parser](../parser/README.md)**: Предоставляет AST для интерпретации
- **[Runtime](../runtime/README.md)**: Использует Core для реактивных вычислений

---

**Примечание**: Core модуль является чистым и не зависит от фреймворков. Он предоставляет только детерминистические вычисления - реактивность и управление жизненным циклом реализованы в модуле Runtime.
