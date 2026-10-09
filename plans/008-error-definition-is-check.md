# `Errors.*.is()`: проверка конкретной ошибки, а не кода

## Резюме

Каждое определение ошибки в `Errors` даёт два предиката: `is` сверяет только `code`, `isExact` — ещё и `messageKey`. Несколько определений делят один код, поэтому `is` у конкретного определения отвечает «да» на чужую ошибку:

```ts
// foo — неизвестная переменная
Errors.Reference.FieldNotDefined.is(error);         // true
Errors.Reference.FieldNotDefined.isExact(error);    // false
```

**Цель**: предикат на конкретном определении проверяет именно эту ошибку; проверка категории доступна отдельно и называется так, чтобы с ней не перепутать.

---

## 1. Текущее состояние

- Реализация: `createErrorDefinition` в `src/core/errors/create-error-definition.ts`.
- 31 определение, у всех есть `messageKey`, кодов — 12. Например, `REFERENCE_ERROR` делят `VariableNotDefined`, `FunctionNotDefined`, `MethodNotDefined`, `FieldNotDefined`.
- JSDoc определений и `Errors` показывает `is` как проверку конкретной ошибки (`if (MaxDependenciesExceeded.is(error))`), то есть документация обещает поведение `isExact`.
- Тесты runtime уже используют `isExact`.
- `Errors` экспортируется из корня пакета, так что это публичный API.

## 2. Решения, которые нужно принять

| # | Вопрос | Варианты | Рекомендация |
|---|--------|----------|--------------|
| 1 | Что делает `is` | (а) становится точной проверкой, `isExact` удаляется; (б) `is` точный, `isExact` остаётся синонимом с `@deprecated`; (в) оставить и переписать JSDoc | **(а)**: пакет не опубликован, совместимость ломать некому |
| 2 | Где проверка категории | (а) `error.code === 'REFERENCE_ERROR'`; (б) хелпер `FormulaError.hasCode(error, code)` | **(а)**: `code` — уже публичное поле, хелпер ничего не добавляет |

## 3. Этапы

1. `is` сравнивает `code` и `messageKey`; `isExact` удаляется, вызовы в тестах переходят на `is`.
2. JSDoc в `createErrorDefinition`, `Errors` и определениях согласуется с новым поведением.
3. Раздел «Errors» в `src/core/README.md` показывает обе проверки: `Errors.X.Y.is(error)` и `error.code`.

## 4. Тесты

- Для каждой пары определений с общим кодом `A.is(ошибка B)` → `false`.
- `A.is(ошибка A)` → `true`; `A.is(new Error())` и `A.is(undefined)` → `false`.
