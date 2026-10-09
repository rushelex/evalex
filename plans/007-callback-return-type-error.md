# Ошибка типа результата колбэка: `FormulaError` с местом в формуле

## Резюме

Когда колбэк `filter` возвращает не `Boolean`, вылетает голый `TypeError` без `code`, `payload` и `location`. Все остальные ошибки вычисления — `FormulaError`, и потребитель подсвечивает по `location` нужный фрагмент формулы.

**Цель**: ошибка типа результата колбэка — `FormulaError` с кодом `ARGUMENT_TYPE_MISMATCH`, позицией аргумента и `location` колбэка.

---

## 1. Текущее состояние

```
filter([1], 2)
→ TypeError: Expected return type Boolean but got Number.
```

- Источник: `CallbackExecutor.execute` в `src/core/routines/arguments/callback-executor.ts`.
- Нет суффикса `[start,end]`, который есть у всех остальных сообщений.
- В runtime ошибка доходит до `onError` как обычный `Error`, и по `code` её не отличить от сбоя движка.
- Тип результата объявляют `filter` (`Kind.Boolean`) и `map` (`Kind.Any`, проверка всегда проходит).

## 2. Решения, которые нужно принять

| # | Вопрос | Варианты | Рекомендация |
|---|--------|----------|--------------|
| 1 | Определение ошибки | (а) `Errors.Argument.TypeMismatch` с `expected` = типы результата; (б) новое определение `CallbackReturnTypeMismatch` с тем же кодом и своим `messageKey` | **(б)**: сообщение говорит о результате колбэка, а не об аргументе, и `isExact` их различает |
| 2 | Куда указывает `location` | (а) весь колбэк; (б) весь вызов | **(а)**: `CallbackExecutor.location` уже хранит место колбэка |
| 3 | Позиция аргумента | `CallbackExecutor` её не знает, передать из `ArgumentsProcessor` при создании | — |

## 3. Этапы

1. Определение ошибки в `src/core/errors/definitions/argument/` и в `Errors.Argument`.
2. `ArgumentsProcessor` передаёт в `CallbackExecutor` позицию аргумента.
3. `CallbackExecutor.execute` бросает новую ошибку с `location: this.node.location`.
4. Пример в `filter.routine.ts` с ожидаемой ошибкой — routine tester проверит обе формы вызова.

## 4. Тесты

- `filter([1], 2)` → `FormulaError`, `ARGUMENT_TYPE_MISMATCH`, сообщение с `[12,13]`.
- `[1].filter(current)` → то же, `location` на `current`.
- `map` с любым результатом ошибку не бросает.
- Runtime: `onError` получает `FormulaError`.
