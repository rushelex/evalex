# Formula Parser

Парсер формул для системы evalex с поддержкой расширяемых типов данных и синтаксического анализа. Основа для построения реактивных формульных систем.

## 🏗️ Архитектура

Модуль parser состоит из двух основных компонентов:

### AST (Abstract Syntax Tree)
- **Типы узлов**: Определения интерфейсов для всех типов узлов AST
- **Visitor Pattern**: Реализация паттерна посетитель для обхода дерева
- **Location Tracking**: Отслеживание позиций в исходном коде для точной диагностики ошибок

### Grammar
- **PEG Grammar**: Грамматика на основе PEG.js для парсинга формул
- **Node Constructors**: Конструкторы узлов AST
- **Generated Parser**: Автоматически сгенерированный парсер

## 📊 Поддерживаемые конструкции

### Литералы
```typescript
// Числа
123
123.45

// Строки
"hello world"
'single quotes'

// Логические значения
true
false

// Null и undefined
null
undefined
```

### Идентификаторы
```typescript
// Переменные
myVar
user_name
item123
```

### Бинарные операции
```typescript
// Арифметические
1 + 2
10 - 5
3 * 4
15 / 3
2 ^ 3  // Возведение в степень
10 % 3 // Остаток от деления

// Сравнения
a > b
x <= y
value == 42
name != "test"

// Логические (два варианта синтаксиса)
flag && condition  // или flag and condition
result || fallback // или result or fallback
```

### Унарные операции
```typescript
// Отрицание
-value
!condition    // или not condition
```

### Вызовы функций
```typescript
// Глобальные функции
sum(1, 2, 3)
if(condition, trueValue, falseValue)

// Методы объектов
user.name()
items.map(current * 2)
text.upper().trim()
```

### Условные выражения (тернарный оператор)
```typescript
condition ? trueValue : falseValue
age >= 18 ? "adult" : "minor"
```

### Массивы
```typescript
// Литералы массивов
[1, 2, 3]
["a", "b", "c"]
[user.name(), user.age()]

// Смешанные типы
[1, "text", true, null]
```

### Доступ к свойствам объектов
```typescript
// Только через вызовы методов
user.name()        // ✅ Поддерживается
user.profile().city()  // ✅ Цепочки вызовов

// Прямой доступ к свойствам не поддерживается
user.name          // ❌ Ошибка синтаксиса
user["name"]       // ❌ Не поддерживается
```

## 🔧 Использование

### Базовый парсинг

```typescript
import { parse } from '~/shared/libs/formula/parser';

try {
  const ast = parse('2 + 3 * 4');
  console.log(ast.type); // 'BinaryExpression'
} catch (error) {
  console.error('Синтаксическая ошибка:', error.message);
  console.error('Позиция:', error.location);
}
```

### Работа с AST через Visitor Pattern

```typescript
import type { AST } from '~/shared/libs/formula/parser';

class MyVisitor implements AST.IVisitor<string> {
  visitLiteralNode(node: AST.ILiteralNode): string {
    return `Literal(${node.value})`;
  }

  visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): string {
    const left = node.left.accept(this);
    const right = node.right.accept(this);
    return `Binary(${left} ${node.operator} ${right})`;
  }

  // ... другие методы visitor
}

const ast = parse('2 + 3');
const visitor = new MyVisitor();
const result = ast.accept(visitor);
console.log(result); // "Binary(Literal(2) + Literal(3))"
```

### Обработка ошибок

```typescript
import { parse, SyntaxError } from '~/shared/libs/formula/parser';

try {
  parse('1 +'); // Неполное выражение
} catch (error) {
  if (error instanceof SyntaxError) {
    console.log('Сообщение:', error.message);
    console.log('Позиция:', error.location);
    console.log('Ожидалось:', error.expected);
    console.log('Найдено:', error.found);
  }
}
```

## 📝 Типы узлов AST

### ILiteralNode
Представляет литеральные значения (числа, строки, булевы, null, undefined).

```typescript
interface ILiteralNode {
  type: 'Literal';
  value: string | number | boolean | null | undefined;
  raw: string;        // Исходное представление в коде
  location: Location; // Позиция в исходном коде
}
```

### IIdentifierNode
Представляет идентификаторы (имена переменных).

```typescript
interface IIdentifierNode {
  type: 'Identifier';
  name: string;
  location: Location;
}
```

### IBinaryExpressionNode
Представляет бинарные операции.

```typescript
interface IBinaryExpressionNode {
  type: 'BinaryExpression';
  operator: string;   // '+', '-', '*', '/', '^', '%', '>', '<', '==', '&&', '||', 'and', 'or', etc.
  left: AstNode;
  right: AstNode;
  location: Location;
}
```

### IUnaryExpressionNode
Представляет унарные операции.

```typescript
interface IUnaryExpressionNode {
  type: 'UnaryExpression';
  operator: string;   // '-', '!', 'not'
  arg: AstNode;
  prefix: boolean;    // Всегда true (префиксные операторы)
  location: Location;
}
```

### ICallExpressionNode
Представляет вызовы функций и методов.

```typescript
interface ICallExpressionNode {
  type: 'CallExpression';
  callee: IIdentifierNode | IMemberExpressionNode;
  args: AstNode[];
  location: Location;
}
```

### IMemberExpressionNode
Представляет доступ к свойствам объектов.

```typescript
interface IMemberExpressionNode {
  type: 'MemberExpression';
  object: AstNode;
  property: IIdentifierNode;
  computed: false;    // Только точечная нотация
  location: Location;
}
```

### IConditionalExpressionNode
Представляет тернарный оператор.

```typescript
interface IConditionalExpressionNode {
  type: 'ConditionalExpression';
  test: AstNode;      // Условие
  consequent: AstNode; // Значение если true
  alternate: AstNode;  // Значение если false
  location: Location;
}
```

### IArrayExpressionNode
Представляет литералы массивов.

```typescript
interface IArrayExpressionNode {
  type: 'ArrayExpression';
  elements: AstNode[];
  location: Location;
}
```

## 🎯 Приоритет операторов

Операторы перечислены в порядке убывания приоритета:

1. **Вызовы функций и методов**: `func()`, `obj.method()`
2. **Унарные операторы**: `-`, `!`, `not`
3. **Возведение в степень**: `^` (правоассоциативный)
4. **Умножение и деление**: `*`, `/`, `%`
5. **Сложение и вычитание**: `+`, `-`
6. **Сравнения**: `<`, `<=`, `>`, `>=`
7. **Равенство**: `==`, `!=`
8. **Логическое И**: `&&`, `and`
9. **Логическое ИЛИ**: `||`, `or`
10. **Тернарный оператор**: `? :`

### Примеры приоритета

```typescript
// 2 + 3 * 4 = 2 + (3 * 4) = 14
parse('2 + 3 * 4');

// 2 ^ 3 ^ 2 = 2 ^ (3 ^ 2) = 2 ^ 9 = 512 (правоассоциативность)
parse('2 ^ 3 ^ 2');

// 2 * 3 ^ 2 = 2 * (3 ^ 2) = 2 * 9 = 18
parse('2 * 3 ^ 2');

// a > b ? 1 : 0 + 2 = (a > b) ? 1 : (0 + 2)
parse('a > b ? 1 : 0 + 2');

// Логические операторы (альтернативный синтаксис)
parse('flag and condition');  // то же что flag && condition
parse('result or fallback');  // то же что result || fallback
parse('not condition');       // то же что !condition
```

## 🚫 Ограничения

### Не поддерживается
- **Квадратные скобки**: `array[index]` - используйте методы массивов
- **Прямой доступ к свойствам**: `obj.prop` - только `obj.prop()`
- **Присваивание**: `a = b` - парсер только для выражений
- **Операторы инкремента**: `++`, `--`
- **Битовые операторы**: `&`, `|`, `<<`, `>>`

### Синтаксические ошибки
```typescript
// Неполные выражения
parse('1 +');           // Ошибка: ожидается операнд
parse('func(a,)');      // Ошибка: лишняя запятая
parse('()');            // Ошибка: пустые скобки

// Неподдерживаемые конструкции
parse('obj.prop');      // Ошибка: ожидается вызов функции
parse('arr[0]');        // Ошибка: квадратные скобки не поддерживаются
```

## 🔍 Отладка и диагностика

### Location Tracking
Каждый узел AST содержит информацию о позиции в исходном коде:

```typescript
interface Location {
  start: { offset: number; line: number; column: number };
  end: { offset: number; line: number; column: number };
}
```

### Детальные ошибки
```typescript
try {
  parse('user.name');
} catch (error) {
  console.log(error.message);
  // "Expected function 'name()' to be called. [4,8]"

  console.log(error.location);
  // { start: { offset: 4, line: 1, column: 5 },
  //   end: { offset: 8, line: 1, column: 9 } }
}
```

## 🌟 Альтернативный синтаксис

Парсер поддерживает два варианта синтаксиса для логических операторов:

### Символьный синтаксис (JavaScript-стиль)
```typescript
!condition
flag && other
result || fallback
```

### Словесный синтаксис (SQL/Python-стиль)
```typescript
not condition
flag and other
result or fallback
```

Оба варианта полностью эквивалентны и могут использоваться взаимозаменяемо:

```typescript
// Эти выражения идентичны
parse('!flag && (a > b)');
parse('not flag and (a > b)');

// Можно смешивать стили
parse('!flag and (a > b)');
parse('not flag && (a > b)');
```

## 📚 Связанные модули

- **[Core](../core/README.md)**: Использует AST для вычисления формул
- **[Runtime](../runtime/README.md)**: Использует парсер для реактивных вычислений

---

**Примечание**: Этот парсер является основой для всей формульной системы. Он предоставляет только синтаксический анализ - семантический анализ и вычисления выполняются в модуле Core.
