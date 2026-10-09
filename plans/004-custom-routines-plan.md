# Пользовательские рутины: план открытия API

## Резюме

Рутины — это функции (`sum(1, 2)`) и методы типов данных (`[1, 2].sum()`). Все встроенные рутины регистрируются в глобальном `routinesRegistry` side-effect-импортами из `src/core/bootstrap.ts`.

Публичный вход для своих рутин уже есть: `initializeFormulaCore({ plugins })` передаёт каждому плагину `RoutinesRegistry`. Но написать плагин без обходных путей нельзя: типы и хелперы, без которых не собрать опции регистрации, из пакета не экспортируются.

**Цель**: пользователь регистрирует свои функции и методы через типизированный API — с валидацией аргументов, понятным контекстом обработчика и предсказуемым поведением при конфликте имён.

---

## 1. Текущее состояние

### 1.1 Что уже есть

| Что | Где | В публичном API |
|-----|-----|-----------------|
| `initializeFormulaCore({ plugins, finalize })` | `src/core/bootstrap.ts` | да |
| `RoutinesRegistry.registerFunction` / `registerMethod` | `src/core/routines/registry.ts` | доступны через аргумент плагина |
| `Errors` — типизированные ошибки формул | `src/core/errors` | да |
| Наследование методов: метод базового класса виден подклассам | `RoutinesRegistry#resolveMethodsForCtor` | — |

### 1.2 Что мешает

| Нужно для регистрации | Где | Экспортируется |
|-----------------------|-----|----------------|
| `FormulaPlugin` — тип плагина | `bootstrap.ts` | нет |
| `RoutinesRegistry` — тип реестра | `registry.ts` | нет, виден только как тип возврата `initializeFormulaCore` |
| `createRoutineExamples` / `RoutineExamples` — поле `examples` обязательно | `routine-examples.ts` | нет |
| `createRoutineArguments`, `Argument`, `CallbackArgument` — описание и валидация аргументов | `routines/arguments/` | нет |
| `ProcessedArgument`, `CallbackExecutor` — элементы `args` в обработчике | `routines/arguments/` | нет |
| `RoutineHandlerContext`: `visitor` (`FormulaEvaluatorVisitor`), `node` (`AST.ICallExpressionNode`), `location` (`AST.Location`) | `routine.ts` | нет |

Сейчас зарегистрировать рутину можно, только собрав вручную объект, структурно совместимый с `RoutineExamples`, и приводя элементы `args` к внутренним классам.

### 1.3 Ограничения текущей модели

- **Глобальный реестр.** `routinesRegistry` — синглтон модуля: плагин меняет поведение всех `Expression` в процессе, включая чужой код, который использует тот же экземпляр пакета.
- **Тихая перезапись.** Реестр хранит рутины в `Map` и при совпадении имени молча заменяет запись: плагин может подменить встроенную `sum`, а повторный вызов `initializeFormulaCore` регистрирует плагины заново.
- **Методы только для встроенных типов.** `registerMethod` принимает конструктор `FormulaDataType`; собственные типы данных пользователя — вне рамок этого плана.

---

## 2. Решения, которые нужно принять

| # | Вопрос | Варианты | Рекомендация |
|---|--------|----------|--------------|
| 1 | Что отдать обработчику вместо `visitor` | (а) `export type { FormulaEvaluatorVisitor }`; (б) узкий интерфейс `RoutineEvaluator` | **(б)**: встроенные обработчики используют только `evaluateNode`, `evaluateNodes` и `formula`. Весь класс в контракте закрепит его внутреннее устройство |
| 2 | AST в контексте (`node`, `location`) | (а) экспортировать типы AST; (б) `location` — непрозрачный тип для `Errors.*.create`, `node` убрать из публичного контекста | **(б)**, если хватит `args` и `utils.flatArgs`; проверить на `sum`, `if`, `map` |
| 3 | Конфликт с уже зарегистрированным именем | (а) молча перезаписать; (б) ошибка; (в) ошибка, но явный `override: true` разрешает | **(в)** |
| 4 | Глобальный реестр или реестр на экземпляр | (а) оставить глобальный и задокументировать; (б) реестр на экземпляр `Expression` / `FormulaRuntime` | **(а)** в этом плане; (б) — отдельный план: затрагивает `RoutineDispatcher` и `Expression` |
| 5 | Обязательность `examples` | (а) обязательны, как у встроенных; (б) опциональны | **(б)**: у встроенных рутин примеры — ещё и автотесты (`routine-test-generator.ts`), а пользователю это не нужно |

---

## 3. Набросок публичного API

Финальная форма зависит от решений из раздела 2. Набросок исходит из рекомендаций.

```ts
import {
  Argument,
  createRoutineArguments,
  Errors,
  FormulaNumber,
  initializeFormulaCore,
  Kind,
} from 'evalex';

import type { FormulaPlugin } from 'evalex';

const financePlugin: FormulaPlugin = (registry) => {
  registry.registerFunction('percent', {
    description: 'Returns `part` as a percentage of `total`.',
    arguments: createRoutineArguments([
      new Argument(Kind.Number, { name: 'part' }),
      new Argument(Kind.Number, { name: 'total' }),
    ]),
    handler: ({ args, location }) => {
      const [part, total] = args.map((arg) => arg.dataType as FormulaNumber);

      if (total.value === 0) {
        throw Errors.Arithmetic.DivisionByZero.create({ dividend: part.value }, { location });
      }

      return new FormulaNumber((part.value / total.value) * 100);
    },
  });
};

initializeFormulaCore({ plugins: [financePlugin] });
```

Новые экспорты из `src/index.ts`:

- типы: `FormulaPlugin`, `InitializeFormulaOptions`, `RoutinesRegistry`, `RoutineHandlerContext`, `RoutineEvaluator`;
- значения: `createRoutineArguments`, `Argument`, `CallbackArgument`, `createRoutineExamples`;
- для разбора `args`: `ProcessedArgument` и `CallbackExecutor` — как типы либо через узкие публичные интерфейсы, по тому же принципу, что и решение 1.

---

## 4. Этапы

### Этап 1. Публичные типы и хелперы

- [ ] Ввести `RoutineEvaluator` и перевести на него `RoutineHandlerContext` (решение 1)
- [ ] Определить публичную форму `location` и `node` (решение 2)
- [ ] Сделать `examples` опциональным для пользовательских рутин (решение 5)
- [ ] Экспортировать типы и хелперы из раздела 3 через `src/core/index.ts`
- [ ] Проверить сборку: `pnpm build` и attw без ошибок, в `dist/index.d.ts` нет недоступных по имени типов из контекста обработчика

### Этап 2. Конфликты имён

- [ ] `registerFunction` / `registerMethod` бросают ошибку при повторной регистрации имени
- [ ] Опция `override: true` разрешает заменить рутину явно
- [ ] Повторный `initializeFormulaCore` с теми же плагинами не падает (решить: идемпотентность или явная ошибка)

### Этап 3. Документация

- [ ] JSDoc публичных символов с `@example`
- [ ] Раздел в README: как написать плагин, ограничения глобального реестра

---

## 5. Тесты

| Сценарий | Уровень |
|----------|---------|
| Функция из плагина вычисляется в `Expression.evaluate()` | contract |
| Метод, зарегистрированный на базовом классе, виден подклассам | contract |
| Неверные аргументы дают ошибку валидации с `location` | contract |
| Callback-аргумент (как у `map`) исполняется с переданным контекстом | contract |
| Повторная регистрация имени без `override` — ошибка, с `override` — замена | contract |
| Пользовательская рутина работает в `FormulaRuntime` с пересчётом зависимостей | integration |
| Контекст обработчика выводит типы `args` и `instance` без аннотаций | types (`*.test-d.ts`) |
