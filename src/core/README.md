<div align="center">

# evalex / core

**Evaluates formulas into typed values — data types, built-in routines, errors and dependency tracking.**

[Expression](#expression) · [Data types](#data-types) · [Built-in routines](#built-in-routines) · [Errors](#errors) · [Debugging](#debugging)

</div>

---

`core` takes formula text, parses it with the [parser](../parser/README.md), and evaluates the result against a context of typed values. It holds no state between calls: the same formula with the same context always produces the same value. For formulas that depend on each other, use the [runtime](../runtime/README.md) on top of it.

Everything below is imported from the package root:

```ts
import { Expression, FormulaNumber, FormulaString } from 'evalex';
```

## Expression

`Expression` is the entry point. It wraps one formula and exposes three operations:

| Method | Returns | Notes |
| --- | --- | --- |
| `evaluate({ context })` | `{ result, dependencies }` | Throws `SyntaxError` or `FormulaError` |
| `extractDependencies()` | `ReadonlySet<string>` | Every identifier in the formula, found without evaluating it |
| `parse()` | AST root node | Throws `SyntaxError` |

ASTs and static dependencies are cached per formula text, so recreating an `Expression` for the same string is cheap.

```ts
const expression = new Expression('if(score >= 50, "pass", "fail")');

const { result, dependencies } = expression.evaluate({
  context: { score: new FormulaNumber(72) },
});

result.value;    // 'pass'
dependencies;    // Set { 'score' }
```

`context` accepts a plain object or a `Map` of `FormulaDataType` values. Pass a prebuilt `Map` when evaluating many formulas against the same values — it is used as is, without copying.

### Static vs. runtime dependencies

`extractDependencies()` lists every context variable the formula mentions. `evaluate()` returns only the ones it actually read, which is narrower when branches are skipped:

```ts
const expression = new Expression('if(flag, a, b)');

expression.extractDependencies();
// Set { 'flag', 'a', 'b' }

expression.evaluate({
  context: { flag: new FormulaBoolean(false), a: new FormulaNumber(1), b: new FormulaNumber(2) },
}).dependencies;
// Set { 'flag', 'b' }
```

Neither set includes function names or the names a callback introduces. Inside a callback, `current` and `index` shadow context variables with the same names:

```ts
new Expression('current + items.map(current * index * price).sum()').extractDependencies();
// Set { 'current', 'items', 'price' }
```

> [!TIP]
> Use static dependencies to validate a formula before saving it, and runtime dependencies to decide what to recalculate.

## Data types

Every value inside a formula is an instance of a `FormulaDataType` subclass. Wrap your data with constructors or `from()` factories before putting it into a context, and read `.value` from results.

| Kind | Class | JS value | Create with |
| --- | --- | --- | --- |
| `Number` | `FormulaNumber` | `number` | `new FormulaNumber(42)` |
| `String` | `FormulaString` | `string` | `new FormulaString('hi')` |
| `Boolean` | `FormulaBoolean` | `boolean` | `new FormulaBoolean(true)` |
| `Date` | `FormulaDate` | `Temporal.ZonedDateTime` | `FormulaDate.from('2026-10-01T00:00:00Z')` — also a `Date`, a timestamp or a `ZonedDateTime`. Text is read as ISO 8601, in UTC unless it names an offset or time zone; a value that holds no date throws a `RangeError` |
| `Duration` | `FormulaDuration` | `Temporal.Duration` | `FormulaDuration.from(Temporal.Duration.from({ days: 3 }))` |
| `Array` | `FormulaArray` | `readonly FormulaDataType[]` | `FormulaArray.from([1, 2, 3])` |
| `Object` | `FormulaObject` | `Readonly<Record<string, FormulaDataType>>` | `FormulaObject.from({ name: 'Ada' })` |
| `RegExp` | `FormulaRegExp` | pattern and flags | `FormulaRegExp.from(/^[A-Z]{3}-\d+$/)` |
| `Null` | `FormulaNull` | `null` | `FormulaNull.instance()` |

Values are immutable. To change a list or an object, create a new one instead of changing `.value` in place: a formula result can be the very same instance as its input, so an in-place change would alter results that were never recalculated.

When `+` joins text with a value of another kind, the value becomes the same text `format()` gives: `"n: " + [1, "a"]` → `"n: 1, a"`, `"n: " + null` → `"n: "`.

`FormulaArray.from` and `FormulaObject.from` convert nested plain values recursively. Object fields are read with method syntax:

```ts
const order = FormulaObject.from({
  customer: { name: 'Ada' },
  lines: [{ qty: 2 }, { qty: 3 }],
});

new Expression('order.customer().name()').evaluate({ context: { order } }).result.value;           // 'Ada'
new Expression('order.lines().map(current.qty()).sum()').evaluate({ context: { order } }).result.value; // 5
```

Dates are backed by [`Temporal`](https://tc39.es/proposal-temporal/docs/) through `temporal-polyfill`.

## Built-in routines

Routines come in two forms: **functions** called by name, like `sum(1, 2)`, and **methods** called on a value, like `"text".upper()`. Most list and text routines exist in both forms.

Inside `filter` and `map`, the second argument is evaluated once per item with two extra variables: `current` holds the item and `index` its zero-based position.

### Text

| Method | Description | Example |
| --- | --- | --- |
| `contains(search)` | Tests whether the text contains a substring or a regex match | `"v1.2".contains(".")` → `true` |
| `test(pattern)` | Tests whether the text matches the pattern | `"Hello".test(/hello/i)` → `true` |
| `match(pattern)` | Returns every match as a list | `"Order #1, #2".match(/#\d/)` → `["#1", "#2"]` |
| `replace(pattern, replacement)` | Replaces the first match, or every match with the `g` flag | `"a.b.c".replace(/\./g, "-")` → `"a-b-c"` |
| `replaceAll(pattern, replacement)` | Replaces every match | `"2026-10-09".replaceAll(/-/, "/")` → `"2026/10/09"` |
| `length()` | Counts user-perceived characters, so an emoji counts as one | `"Hello".length()` → `5` |
| `upper()` / `lower()` | Changes the letter case | `"hello".upper()` → `"HELLO"` |
| `trim()` | Removes leading and trailing whitespace | `"  hi  ".trim()` → `"hi"` |

`pattern` accepts a regex literal or text. Text is compiled into a regular expression, so `"\\d+"` matches digits; `contains` is the exception and treats text as a plain substring.

### Numbers and math

| Routine | Description | Example |
| --- | --- | --- |
| `add(a, b)` | Adds two numbers like `+`, or joins two texts | `add(5, 10)` → `15` |
| `subtract(a, b)` / `multiply(a, b)` | Works like `-` and `*` | `multiply(5, 10)` → `50` |
| `divide(dividend, divisor)` / `mod(dividend, divisor)` | Works like `/` and `%`, failing on a zero divisor | `divide(5, 10)` → `0.5` |
| `pow(base, exponent)` | Works like `^` | `pow(5, 10)` → `9765625` |
| `sum(...values)` | Adds numbers and lists of numbers, flattening nested lists | `sum(1, [2, 3, [4, 5]])` → `15` |
| `min(...values)` / `max(...values)` | Smallest or largest number, taking values like `sum` | `max(1, [2, 3])` → `3` |
| `mean(...values)` / `median(...values)` | Arithmetic average or middle value, taking values like `sum` | `median([1, 2, 3], 4)` → `2.5` |
| `abs(n)` / `sign(n)` | Absolute value, or `1`, `-1` or `0` by the sign | `abs(-10)` → `10` |
| `round(n, places?)` | Rounds half up; negative `places` round to tens, hundreds and so on | `round(1234, -2)` → `1200` |
| `ceil(n)` / `floor(n)` | Rounds up or down to an integer | `floor(-0.6)` → `-1` |
| `sqrt(n)` / `cbrt(n)` | Square or cube root | `sqrt(4)` → `2` |
| `exp(n)` / `ln(n)` | `e` raised to the number, or the natural logarithm | `ln(e())` → `1` |
| `log2(n)` / `log10(n)` | Logarithm in base 2 or 10 | `log2(1024)` → `10` |
| `pi()` / `e()` | Mathematical constants | `pi()` → `3.141592653589793` |

All of them except `pi` and `e` also work as methods: `5.add(10)`, `[1, 2, 3].sum()`, `8.log2()`. `min`, `max`, `mean` and `median` return an empty value when every list they get is empty: `[].min()` → `null`.

### Lists

| Routine | Description | Example |
| --- | --- | --- |
| `filter(list, condition)` | Keeps the items for which the condition is true | `[1, 2, 3, 4].filter(current > 2)` → `[3, 4]` |
| `map(list, expression)` | Transforms every item | `[1, 2, 3].map(current * index)` → `[0, 2, 6]` |
| `join(list, separator?)` | Joins the items into text | `["a", "b"].join(", ")` → `"a, b"` |
| `length(list)` | Number of items | `[3, 1].length()` → `2` |
| `sum(list)` | Adds the items | `[1, 2, 3].sum()` → `6` |
| `at(list, index)` | Item at the index; a negative index counts from the end, a missing item is `null` | `[1, 2, 3].at(-1)` → `3` |
| `first(list)` `last(list)` | First or last item, `null` for an empty list | `[1, 2, 3].last()` → `3` |
| `slice(list, start, end?)` | Items from `start` up to, not including, `end`; negative indexes count from the end | `["a", "b", "c"].slice(1)` → `["b", "c"]` |
| `concat(list, ...lists)` | Joins lists into one | `[1, 2].concat([3, 4])` → `[1, 2, 3, 4]` |
| `reverse(list)` | Items in reverse order | `[1, 2, 3].reverse()` → `[3, 2, 1]` |
| `flat(list)` | Replaces each nested list with its items, one level deep | `[[1, 2], [3, [4]]].flat()` → `[1, 2, 3, [4]]` |
| `unique(list)` | Drops items equal, as in `==`, to an earlier item | `[1, 1, 2].unique()` → `[1, 2]` |
| `includes(list, value)` | Whether some item equals the value, as in `==` | `[1, 2, 3].includes(4)` → `false` |

### Dates and durations

| Routine | Description | Example |
| --- | --- | --- |
| `now()` / `today()` | Current date and time, or today at midnight | `today().add(1, "days")` |
| `parseDate(text)` | Parses an ISO 8601 date; text without an offset or time zone is read in UTC | `parseDate("2023-07-10T17:35Z")` |
| `fromTimestamp(ms)` | Date in UTC from a Unix timestamp in milliseconds, without seconds | `fromTimestamp(1689024900000)` |
| `dateAdd(date, amount, unit)` | Adds a whole number of units, or a duration | `parseDate("2023-08-30").add(2, "months")` |
| `dateSubtract(date, amount, unit)` | Subtracts a whole number of units, or a duration | `parseDate("2023-07-10").subtract(1, "years")` |
| `dateBetween(a, b, unit)` | Difference between two dates as a duration | `dateBetween(end, start, "days").days()` |
| `year()` `month()` `week()` `date()` `day()` `hour()` `minute()` | Date parts: `month` is 1–12, `week` is the ISO week, `day` is 1 (Monday) to 7 (Sunday) | `parseDate("2023-07-10").month()` → `7` |
| `years(duration)` … `milliseconds(duration)` | Reads one unit of a duration | `dateBetween(a, b, "years").months()` |

`dateAdd` and `dateSubtract` fail with `Errors.Arithmetic.DateOutOfRange` when the result falls outside the supported dates, about 270,000 years either side of 1970.

`add`, `subtract` and `between` are the method forms of the date functions. Units are `"years"`, `"months"`, `"weeks"`, `"days"`, `"hours"`, `"minutes"` and, except for `between`, `"seconds"`.

### Any value

| Routine | Description | Example |
| --- | --- | --- |
| `if(condition, then, else)` | Evaluates only the chosen branch | `if(stock > 0, "In stock", "Sold out")` |
| `empty(value)` | True for `0`, `""`, `false`, `[]` and `null` | `empty([])` → `true` |
| `format(value)` | Converts the value to text; a date becomes an ISO 8601 instant in UTC | `parseDate("2023-07-10").format()` → `"2023-07-10T00:00:00Z"` |
| `equal(a, b)` | Compares two values like `==`: lists item by item, dates by instant, values of different types are never equal | `[1, [2]].equal([1, [2]])` → `true` |

Conditions read a value the same way everywhere — in `if`, in `? :` and in `and`, `or` and `not`: an empty value counts as false and any other value as true. So `not []` is `true`, and `NaN` counts as true, because it is not `0`.

## Errors

Parse errors throw `SyntaxError`, a subclass of the built-in one. Evaluation errors throw `FormulaError`:

| Property | Contents |
| --- | --- |
| `code` | One of the codes below |
| `payload` | Structured details, e.g. `{ actual: 'String', expected: ['Array', 'Number'], argumentPosition: 1 }` |
| `location` | `{ start, end }`, each with `offset`, `line` and `column` |
| `message` | Human-readable text ending with `[start,end]` offsets |

| Code | Raised when |
| --- | --- |
| `REFERENCE_ERROR` | A variable, function, method or object field does not exist |
| `ARGUMENT_TYPE_MISMATCH` | An argument has the wrong type or an invalid value, such as an unknown date unit, or a callback returns a value of the wrong type |
| `ARGUMENT_COUNT_MISMATCH` | Too few or too many arguments |
| `PATTERN_MISMATCH` | The arguments fit none of the routine's accepted signatures |
| `ARITHMETIC_ERROR` | Division or remainder by zero |
| `EVALUATE_ERROR` | An operator gets operands it cannot combine, or text is not a valid regular expression |
| `RANGE_ERROR` | An unsupported operator or an out-of-range value |

The runtime adds `TYPE_MISMATCH`, `CIRCULAR_DEPENDENCY`, `MAX_DEPENDENCIES_EXCEEDED`, `MAX_FORMULA_DEPTH_EXCEEDED` and `MAX_FORMULAS_EXCEEDED`; see the [runtime README](../runtime/README.md#errors-and-limits).

Several errors share a code. `Errors.<Group>.<Error>.is(error)` matches exactly one of them; comparing `code` matches all errors with that code:

```ts
try {
  new Expression('price * qty').evaluate({ context: { price: new FormulaNumber(10) } });
}
catch (error) {
  if (Errors.Reference.VariableNotDefined.is(error)) {
    error.payload;  // { referenceType: 'variable', name: 'qty' }
    error.location; // points at `qty`
  }

  // A missing variable, function, method or field
  if (error instanceof FormulaError && error.code === 'REFERENCE_ERROR') {
    error.payload.referenceType; // 'variable'
  }
}
```

## Debugging

```ts
import { FormulaDebugger } from 'evalex';

FormulaDebugger.enable();
// [Formula Queue] Enqueued total: Manual enqueue
// [Formula Process] Evaluating total: price * 2
```

While enabled, the runtime logs every enqueue, cascade, evaluation and error with `console.info`. Call `FormulaDebugger.disable()` to stop.

## Source layout

| Path | Contents |
| --- | --- |
| [`expression.ts`](./expression.ts) | `Expression` and its caches |
| [`evaluator.visitor.ts`](./evaluator.visitor.ts) | Walks the AST and computes values |
| [`dependency-extractor.visitor.ts`](./dependency-extractor.visitor.ts) | Collects identifiers for static dependencies and finds calls to volatile routines |
| [`volatile-formula.ts`](./volatile-formula.ts) | Tells the runtime which formulas must be recalculated even with unchanged inputs |
| [`context.ts`](./context.ts) | Variable scopes, including the nested scopes used by callbacks |
| [`data-types/`](./data-types) | One folder per data type |
| [`routines/`](./routines) | Routine registry, argument validation and one file per routine in `routines/routines/` |
| [`errors/`](./errors) | `FormulaError`, error codes and the `Errors` factory namespace |
