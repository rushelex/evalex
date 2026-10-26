<div align="center">

# evalex / core

**Evaluates formulas into typed values — data types, built-in routines, errors and dependency tracking.**

[Scope](#formulascope) · [Expression](#expression) · [Data types](#data-types) · [Built-in routines](#built-in-routines) · [Errors](#errors) · [Debugging](#debugging)

</div>

---

`core` takes formula text, parses it with the [parser](../parser/README.md), and evaluates the result against a context of typed values. It holds no state between calls: the same formula with the same context always produces the same value. For formulas that depend on each other, use the [runtime](../runtime/README.md) on top of it.

Everything below is imported from the package root:

```ts
import { Expression, FormulaNumber, FormulaString } from 'evalex';
```

## FormulaScope

A scope evaluates formulas over plain host values. The host creates it once with its settings:

```ts
import { FormulaScope } from 'evalex';

const scope = new FormulaScope({ format: { number: (value) => value.toFixed(2) } });

const total = scope.evaluate('price * quantity', { price: 250, quantity: 4 });
total.kind;  // 'Number'
total.value; // 1000

scope.evaluate('"Total: " + total', { total }).value; // 'Total: 1000.00'
```

- **Values in.** Each name the formula reads converts to a formula value as [Data types](#data-types) describes, the first time the formula reads it. A field the formula does not read is never converted, so it never fails the formula. Only own fields of the values are names, except those holding functions. A value without a formula form fails to compile, and at run time throws a `TypeError` that names its path from the name: `Cannot convert order.tags to a formula value: Map has no formula form.`
- **A formula value out.** `evaluate` returns the value the formula computes. Its `kind` tells what it holds and narrows the type: after `if (result.kind === 'Date')`, `result.value` is a `Temporal.ZonedDateTime`. A list holds formula values, each with its own `kind`.
- **Results back in.** A result passed back as a value is read as it is, so `third * 3` with `third` from `1 / 3` gives `1`.
- **Showing a result is up to the host.** `format` decides how values read only where a formula itself turns them into text, see [Text of values](#text-of-values). A host that passes the formatters it draws its cells with gets the same text in `"Total: " + price` as in the `price` cell. `toString()` gives machine text, not text for readers.

`format` is checked when the scope is created: a name list of the wrong length throws a `TypeError` there.

## Expression

`Expression` wraps one formula and exposes two operations:

| Method | Returns | Notes |
| --- | --- | --- |
| `evaluate({ context, format })` | `{ result, dependencies }` | Throws `SyntaxError` or `FormulaError`; `format` is optional, see [Text of values](#text-of-values) |
| `extractDependencies()` | `ReadonlySet<string>` | Every identifier in the formula, found without evaluating it. Throws `SyntaxError` |

ASTs and static dependencies are cached per formula text among the 1,000 most recently used texts, so recreating an `Expression` for the same string is cheap, and texts no longer in use do not stay in memory. An `Expression` keeps its own parse for as long as it lives.

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

Neither set includes function names, the names a callback introduces or the names a `let` declares. Inside a callback, `current` and `index` shadow context variables with the same names:

```ts
new Expression('current + items.map(current * index * price).sum()').extractDependencies();
// Set { 'current', 'items', 'price' }
```

> [!TIP]
> Use static dependencies to validate a formula before saving it, and runtime dependencies to decide what to recalculate.

### Names with `let`

`let` names a value once and reuses it, anywhere an expression can stand, callbacks included:

```ts
new Expression(`
  orders.map(
    let
      net = current.price() * current.qty(),
      tax = net * rate
    in net + tax
  )
`).extractDependencies();
// Set { 'orders', 'rate' }
```

Each value is computed once, in order, even if the body does not read it; inside a callback it is computed for every item, and inside a branch that is not taken it is not computed at all. A declared name hides a context variable or an outer name with the same name. The parser's README lists the syntax rules.

## Data types

Every value inside a formula is an instance of a `FormulaDataType` subclass. Wrap your data with constructors or `from()` factories before putting it into a context, and read `.value` from results.

| Kind | Class | JS value | Create with |
| --- | --- | --- | --- |
| `Number` | `FormulaNumber` | `number` | `new FormulaNumber(42)` |
| `String` | `FormulaString` | `string` | `new FormulaString('hi')` |
| `Boolean` | `FormulaBoolean` | `boolean` | `new FormulaBoolean(true)` |
| `Date` | `FormulaDate` | `Temporal.ZonedDateTime` | `FormulaDate.from('2026-10-01T00:00:00Z')` — also a `Date`, a timestamp or a `ZonedDateTime`. Text is read as ISO 8601, in UTC unless it names an offset or time zone; a value that holds no date throws a `RangeError` |
| `DateRange` | `FormulaDateRange` | `{ start, end }` of `Temporal.ZonedDateTime` | `FormulaDateRange.from({ start: '2026-10-01', end: '2026-10-07' })` — each end as `FormulaDate.from` takes it; an end before the start throws a `RangeError` |
| `Duration` | `FormulaDuration` | `Temporal.Duration` | `FormulaDuration.from(Temporal.Duration.from({ days: 3 }))` |
| `Array` | `FormulaArray` | `readonly FormulaDataType[]` | `FormulaArray.from([1, 2, 3])` |
| `Object` | `FormulaObject` | `Readonly<Record<string, FormulaDataType>>` | `FormulaObject.from({ name: 'Ada' })` |
| `RegExp` | `FormulaRegExp` | pattern and flags | `FormulaRegExp.from(/^[A-Z]{3}-\d+$/)` |
| `Null` | `FormulaNull` | `null` | `FormulaNull.instance()` |

Values are immutable. To change a list or an object, create a new one instead of changing `.value` in place: a formula result can be the very same instance as its input, so an in-place change would alter results that were never recalculated.

When `+` joins text with a value of another kind, the value becomes the same text `format()` gives: `"n: " + [1, "a"]` → `"n: 1, a"`, `"n: " + null` → `"n: "`.

### Text of values

Once a formula turns a value into text, the host can no longer format that value for its reader. So the host decides up front: `format` holds a formatter per kind, and evalex calls it with the value wherever a formula turns that value into text — `+` with text, `join`, `format()` without a pattern, and values inside lists and objects.

```ts
const dates = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/London' });

new Expression('"Due: " + due').evaluate({
  context: { due: FormulaDate.from('2024-07-28T14:35Z') },
  format: { date: (value) => dates.format(value.epochMilliseconds) },
}).result.value;
// 'Due: 28 July 2024 at 15:35'
```

| Formatter | Gets | Text without it |
| --- | --- | --- |
| `date` | `Temporal.ZonedDateTime` in UTC | ISO 8601 instant in UTC: `2024-07-28T14:35:00Z` |
| `dateRange` | `{ start, end }` | Both ends as `date` gives them, joined by ` → ` |
| `duration` | `Temporal.Duration` | ISO 8601 duration: `P1DT2H` |
| `number` | `number` | `1234.5` |
| `boolean` | `boolean` | `true` / `false` |
| `null` | `null` | empty text |

Text and regular expressions keep their own text. Error payloads keep machine text whatever the formatters are; error messages are localized through `messageKey`. A formatter that throws fails the evaluation with its own exception, and one that returns something other than text throws a `TypeError`.

`format.names` gives the words of [date patterns](#dates-and-durations) in the host's language. Each list is optional, and a token whose list is left out stays English:

```ts
new Expression('formatDate(due, "D MMMM YYYY")').evaluate({
  context: { due },
  format: { names: { months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'] } },
}).result.value;
// '28 июля 2024'
```

| Name list | Tokens | Holds |
| --- | --- | --- |
| `months` | `MMMM` | 12 names in the form they take next to a day |
| `monthsStandalone` | `LLLL` | 12 names in the form they take on their own; without it, `LLLL` takes `months` |
| `monthsShort` | `MMM` | 12 names |
| `weekdays`, `weekdaysShort`, `weekdaysMin` | `dddd`, `ddd`, `dd` | 7 names each, from Sunday |
| `dayPeriods` | `A`, `a` | Before and after noon; `a` takes them in lower case |
| `ordinal` | `Do` | A function from the day of the month to its text |

A list of the wrong length throws a `TypeError` before the formula runs.

`FormulaArray.from` and `FormulaObject.from` convert nested host values recursively:

| Host value | Becomes |
| --- | --- |
| `null`, `undefined`, a hole in a list | `null` |
| A list, a `Set`, a typed array | a list |
| An object of exactly two fields, `start` and `end`, both dates of the forms below | a date range |
| Any other plain object, object without a prototype or class instance | an object of its own enumerable fields; getters on the prototype, symbol keys and fields holding functions are left out, like methods |
| `new Number(5)`, `new String('a')`, `new Boolean(true)` | the value it holds |
| A `bigint` from `-(2^53 - 1)` to `2^53 - 1` | a number |
| `Date`, `Temporal.ZonedDateTime`, `Temporal.Instant` | a date at that instant |
| `Temporal.PlainDate`, `Temporal.PlainDateTime` | a date read in UTC |
| A formula value, such as a `FormulaNumber` | itself |

Every other value is rejected with a `TypeError` that names where it sits: `Cannot convert order.lines[2] to a formula value: Map has no formula form.` That covers a function in place of a value, such as an item of a list, symbols, `NaN`, a `Date` that holds no instant, a larger `bigint`, built-in objects such as `Map`, `Promise`, `Error` or `Temporal.PlainTime`, a date range that ends before it starts, a circular reference, and lists and objects nested more than 1000 deep. A value shared by two places is not circular. An error thrown by a field getter reaches the caller unchanged.

Object fields are read with method syntax:

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
| `substring(start, end?)` | Characters from `start` up to, not including, `end`; indexes are clamped to the text, and a start after the end swaps them | `"Formula".substring(0, 3)` → `"For"` |
| `split(separator)` | Parts between matches of the separator; an empty separator splits into characters | `"a,b".split(",")` → `["a", "b"]` |
| `repeat(times)` | The text repeated `times` times | `"0".repeat(4)` → `"0000"` |
| `padStart(length, padding?)` / `padEnd(length, padding?)` | Adds the padding, a space by default, at the start or end until the text has `length` characters | `"5".padStart(3, "0")` → `"005"` |
| `parseDate()` | Reads an ISO 8601 date, like the `parseDate(text)` function | `"2022-01-01".parseDate()` |

`pattern` accepts a regex literal or text. Text is compiled into a regular expression, so `"\\d+"` matches digits; `contains` and `split` are the exceptions and treat text as plain text, so `"v1.2".split(".")` splits at the dot.

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
| `pi()` / `e()` | Mathematical constants | `pi()` → `3.14159265358979` |

All of them except `pi` and `e` also work as methods: `5.add(10)`, `[1, 2, 3].sum()`, `8.log2()`. `min`, `max`, `mean` and `median` return an empty value when every list they get is empty: `[].min()` → `null`.

Numbers behave as the decimals they are written as: `0.1 + 0.2` → `0.3`, `0.3 / 0.1` → `3`, `4.35 * 100` → `435`. A number reads at 15 significant digits, in `.value` and in text, so `1 / 3` → `0.333333333333333`; integers up to 2^53 read in full. The next operation still gets the whole number, also when the `FormulaNumber` is passed into another formula: `1 / 3 * 3` → `1`.

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
| `find(list, condition)` | First item for which the condition is true, `null` if none | `["a", "b"].find(current == "b")` → `"b"` |
| `findIndex(list, condition)` | Index of that item, `-1` if none | `["a", "b"].findIndex(current == "b")` → `1` |
| `some(list, condition)` `every(list, condition)` | Whether the condition is true for any item, or for every item; they stop at the first item that settles the answer | `[1, 2, 3].every(current > 0)` → `true` |
| `count(list, condition?)` | Number of items for which the condition is true; without a condition, the length | `[1, 2, 3].count(current > 1)` → `2` |
| `sort(list, key?)` | Items in ascending order of `<`, or of the key computed for each item; all must be numbers, all texts or all dates. Equal items keep their order, `NaN` goes last, texts compare by character code (`"B"` before `"a"`) | `["ccc", "a", "bb"].sort(length(current))` → `["a", "bb", "ccc"]` |

### Dates and durations

| Routine | Description | Example |
| --- | --- | --- |
| `now()` / `today()` | Current date and time, or today at midnight | `today().add(1, "days")` |
| `parseDate(text)` | Parses an ISO 8601 date; text without an offset or time zone is read in UTC | `parseDate("2023-07-10T17:35Z")` |
| `fromTimestamp(ms)` | Date in UTC from a Unix timestamp in milliseconds, without seconds | `fromTimestamp(1689024900000)` |
| `timestamp(date)` | Unix timestamp of the date in milliseconds | `parseDate("2023-07-10T21:35Z").timestamp()` → `1689024900000` |
| `dateAdd(date, amount, unit)` | Adds a whole number of units, or a duration | `parseDate("2023-08-30").add(2, "months")` |
| `dateSubtract(date, amount, unit)` | Subtracts a whole number of units, or a duration | `parseDate("2023-07-10").subtract(1, "years")` |
| `dateBetween(a, b, unit)` | Difference between two dates as a duration | `dateBetween(end, start, "days").days()` |
| `formatDate(date, pattern, timezone?)` | Date as text built from a pattern; also `date.format(pattern, timezone?)` | `parseDate("2023-08-30T14:05Z").format("MMMM D, YYYY h:mm A")` → `"August 30, 2023 2:05 PM"` |
| `dateRange(start, end)` | Date range; an end before the start is an error | `parseDate("2022-09-07").range(parseDate("2023-09-07"))` |
| `dateStart(range)` / `dateEnd(range)` | Start or end of a date range; a date is its own start and end | `dateRange(a, b).end()` → `b` |
| `year()` `month()` `week()` `date()` `day()` `hour()` `minute()` | Date parts: `month` is 1–12, `week` is the ISO week, `day` is 1 (Monday) to 7 (Sunday) | `parseDate("2023-07-10").month()` → `7` |
| `years(duration)` … `milliseconds(duration)` | Reads one unit of a duration | `dateBetween(a, b, "years").months()` |

Date ranges are equal when both ends are; they cannot be ordered with `<` or `>`, and date arithmetic takes a single date, such as `dateStart(range)`.

`dateAdd` and `dateSubtract` fail with `Errors.Arithmetic.DateOutOfRange` when the result falls outside the supported dates, about 270,000 years either side of 1970.

`add`, `subtract`, `between`, `range`, `start` and `end` are the method forms of the date functions; the function names work as methods too, as in `now().dateAdd(1, "days")`. Units are `"years"`, `"months"`, `"weeks"`, `"days"`, `"hours"`, `"minutes"` and, except for `between`, `"quarters"` (three months) and `"seconds"`.

A date pattern shows the date in UTC unless a time zone is given by name (`"Europe/Berlin"`) or as an offset (`"+05:00"`). Names are in English on every machine, unless the host gives its own in [`format.names`](#text-of-values). Text in brackets is kept as is, and so is any letter that is not a token:

| Part | Tokens | For 2023-08-03 14:05:09.007 UTC |
| --- | --- | --- |
| Year | `YYYY` `YY` `Y` | `2023` `23` `2023` |
| Quarter | `Q` | `3` |
| Month | `MMMM` `LLLL` `MMM` `MM` `M` | `August` `August` `Aug` `08` `8` (`LLLL` is the month on its own, which some languages write differently) |
| Day of month | `DD` `D` `Do` | `03` `3` `3rd` |
| Day of week | `dddd` `ddd` `dd` `d` | `Thursday` `Thu` `Th` `4` (`0` is Sunday) |
| Hour | `HH` `H` `hh` `h` | `14` `14` `02` `2` |
| Minute, second, millisecond | `mm` `m` `ss` `s` `SSS` | `05` `5` `09` `9` `007` |
| AM/PM | `A` `a` | `PM` `pm` |
| Offset | `Z` `ZZ` | `+00:00` `+0000` |
| Unix timestamp | `X` `x` | seconds, milliseconds |

### Any value

| Routine | Description | Example |
| --- | --- | --- |
| `if(condition, then, else)` | Evaluates only the chosen branch | `if(stock > 0, "In stock", "Sold out")` |
| `empty(value)` | True for `0`, `""`, `false`, `[]` and `null` | `empty([])` → `true` |
| `format(value)` | Converts the value to text; a date becomes an ISO 8601 instant in UTC unless the host [formats dates](#text-of-values) | `parseDate("2023-07-10").format()` → `"2023-07-10T00:00:00Z"` |
| `equal(a, b)` | Compares two values like `==`: lists item by item, dates by instant, values of different types are never equal | `[1, [2]].equal([1, [2]])` → `true` |
| `unequal(a, b)` | The opposite of `equal`, like `!=` | `unequal(1, 2)` → `true` |
| `toNumber(value)` | Text read as a number, `1` or `0` for a boolean, the timestamp of a date; text that holds no number, blank text included, is an error | `"2".toNumber()` → `2` |

Conditions read a value the same way everywhere — in `if`, in `? :` and in `and`, `or` and `not`: an empty value counts as false and any other value as true. So `not []` is `true`, and `NaN` counts as true, because it is not `0`.

## Errors

Parse errors throw `SyntaxError`, a subclass of the built-in one. Evaluation errors throw `FormulaError`:

| Property | Contents |
| --- | --- |
| `code` | One of the codes below, as text. `FormulaErrorCode` holds them all: `FormulaErrorCode.REFERENCE_ERROR` is `'REFERENCE_ERROR'` |
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

An error about a value points at the part of the formula the value came from. When `if`, `? :`, parentheses or a `let` body hand on a value unchanged, the location narrows to that value: in `sum(if(flag, 1, "a"))` with `flag` false, the error points at `"a"`, not at the whole `if`. A value read through a name points at the name.

The runtime adds `TYPE_MISMATCH`, `CIRCULAR_DEPENDENCY`, `MAX_DEPENDENCIES_EXCEEDED`, `MAX_FORMULA_DEPTH_EXCEEDED`, `MAX_FORMULAS_EXCEEDED`, `DUPLICATE_NODE_ID` and `EXECUTION_TIMEOUT`; see the [runtime README](../runtime/README.md#errors-and-limits).

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
| [`lru-cache.ts`](./lru-cache.ts) | The bounded cache that keeps parses of recently used formula texts |
| [`evaluator.visitor.ts`](./evaluator.visitor.ts) | Walks the AST and computes values |
| [`dependency-extractor.visitor.ts`](./dependency-extractor.visitor.ts) | Collects identifiers for static dependencies and finds calls to volatile routines |
| [`volatile-formula.ts`](./volatile-formula.ts) | Tells the runtime which formulas must be recalculated even with unchanged inputs |
| [`context.ts`](./context.ts) | Variable scopes, including the nested scopes used by callbacks |
| [`data-types/`](./data-types) | One folder per data type |
| [`routines/`](./routines) | Routine registry, argument validation and one file per routine in `routines/routines/` |
| [`errors/`](./errors) | `FormulaError`, error codes and the `Errors` factory namespace |
