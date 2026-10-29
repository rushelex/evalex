<div align="center">

# evalex / core

**Evaluates formulas into typed values — data types, built-in routines, errors and formulas in host data.**

[Scope](#formulascope) · [Formulas in data](#formulas-in-data) · [Names with `let`](#names-with-let) · [Data types](#data-types) · [Built-in routines](#built-in-routines) · [Errors](#errors)

</div>

---

`core` takes formula text, parses it with the [parser](../parser/README.md), and evaluates the result against host values found by name. The same formula with the same values always produces the same value. Formulas that live in host data and read each other are computed by an evaluator, which keeps what each formula read to compute again only what changed, see [Formulas in data](#formulas-in-data).

Everything below is imported from the package root:

```ts
import { Errors, Formula, FormulaError, FormulaScope } from 'evalex';
import type { FormulaNumber, FormulaValue } from 'evalex';
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
- **A formula value out.** `evaluate` returns the value the formula computes. Its `kind` tells what it holds and narrows the type: after `if (result.kind === 'DateTime')`, `result.value` is a `Temporal.ZonedDateTime`. A list holds formula values, each with its own `kind`.
- **Results back in.** A result passed back as a value is read as it is, so `third * 3` with `third` from `1 / 3` gives `1`.
- **Showing a result is up to the host.** `format` decides how values read only where a formula itself turns them into text, see [Text of values](#text-of-values). A host that passes the formatters it draws its cells with gets the same text in `"Total: " + price` as in the `price` cell. `toString()` gives machine text, not text for readers.

`timeZone` is the zone formulas read dates in, by name (`"Europe/Moscow"`) or as an offset (`"+03:00"`), UTC when left out. evalex never reads the zone of the machine it runs on, so a host that wants its readers' zone passes it here. The zone decides the day `today()` gives, the day `toDate()` reads from a date and time and the instant `toDateTime()` gives a day, the parts `hour()`, `date()` and the like read, the zone a [date pattern](#dates-and-durations) shows without a zone of its own, where days and months start when `dateAdd`, `dateSubtract` and `dateBetween` count them, and the instant of a date and time without an offset, written in a formula or passed as a `Temporal.PlainDateTime`. Dates and times still come out of a formula in UTC.

```ts
const scope = new FormulaScope({ timeZone: 'Europe/Moscow' });

scope.evaluate('hour(due)', { due: new Date('2024-07-28T22:30Z') }).value; // 1
```

`format` and `timeZone` are checked when the scope is created: a name list of the wrong length throws a `TypeError` there, and a zone that is neither a name nor an offset a `RangeError`. Parses are cached per formula text among the 1,000 most recently used texts, so evaluating the same text again does not parse it again, and texts no longer in use do not stay in memory.

## Formulas in data

A formula is a cell of the host's own data: `new Formula(text)` in any field of an object or item of a list. `scope.evaluator()` creates an evaluator that computes every formula cell with the settings of the scope and gives back data of the same shape, with results in place of formulas:

```ts
import { Formula, FormulaScope } from 'evalex';

const evaluator = new FormulaScope().evaluator();

const order = {
  taxRate: 0.2,
  lines: [
    { price: 250, quantity: 4, cost: new Formula('price * quantity'), tax: new Formula('cost * taxRate') },
    { price: 100, quantity: 1, cost: new Formula('price * quantity'), tax: new Formula('cost * taxRate') },
  ],
  total: new Formula('lines.map(current.cost() + current.tax()).sum()'),
};

const view = evaluator.evaluate(order);
view.lines[0].tax; // FormulaNumber, value 200
view.total;        // FormulaNumber, value 1320
```

- **Names resolve outward.** A formula reads the fields of its own record first, then the fields of each enclosing object up to the root. Lists hold no names: a record in `lines` reads `taxRate` from the object that holds `lines`, and a list is read by the name of the field that holds it. An inner field hides an outer field of the same name, and `parent(taxRate)` reads it from the enclosing object instead, `parent(parent(taxRate))` from the one around that. A data field holding a function is not a name; a getter is, whatever it returns. Names the formula itself defines, such as `current` in a callback or a `let` name, stay visible inside `parent`.
- **Neighbor records.** `previous(expression, default)` and `next(expression, default)` evaluate the expression over the record before or after the formula's record in the list that holds it, so a running total is `previous(total, 0) + amount`. Neighbors follow the order of the array. The first record, the last record and a record outside a list get the default, evaluated over the record itself, and so does a record whose neighbor is not a record. A formula evaluated by name with `scope.evaluate` has no neighbors and no enclosing object.
- **Formulas read formulas.** A formula that reads another formula cell, by name or through a record or list, gets its value, whatever the order of the cells in the data. A chain of any length computes in time linear in its length, in any order of its cells.
- **Cycles.** Every cell of a cycle holds a `CIRCULAR_REFERENCE` error pointing at the part of its own formula that reads into the cycle: with `a = b + 1` and `b = 2 * a`, `a` fails with `Circular reference: "b" depends on this formula. [0,1]` and `b` at `a`. Cells outside the cycle compute as usual.
- **Failed inputs.** A formula that reads a failed cell fails with `INPUT_ERROR` at the read, with that cell's error as `cause`: with `total = missing * 2`, `tax = total * 0.1` fails with `Cannot use "total": its value failed. [0,5]`. Each formula points at the input written in its own text, not at what broke that input, and a cell outside a cycle that reads into it fails the same way. A read of host data that fails, a getter that throws or a value without a formula form such as a `Map`, fails the reading formula the same way, with the host's own error as `cause`. `scope.evaluator({ onInputError })` gets each such failure once a pass, however many formulas read it, and the getter runs only once. A `FormulaError` or `SyntaxError` is for the formula author; the `cause` and `onInputError` are for the host.
- **What is walked.** Records are found through data properties only: a getter is read only when a formula reads it. A record reached by several paths has one place, the shallowest one, the first in key order among equally shallow ones. Its formulas are computed once, with the names around that place; every other reference is a link to it.
- **The view.** A formula cell holds its value, or the `FormulaError` or `SyntaxError` of its formula; the type `SyntaxError` is exported to read its `location`. `FormulaView<T>` is the type of the view of data of type `T`, and `FormulaCell` the type of what a formula cell holds. An object or list that holds formulas, directly or through its fields, is a copy with the same prototype, and a link to it in the view leads to the copy. Everything else is what the data holds, and the data itself never changes.
- **Changes.** Each `evaluate` reads the data as it is at the call: change the data however you like, in place or by replacing objects, and call it again. The evaluator keeps what each formula read, as long as you keep the object that holds the formula, and evaluates again only the formulas whose reads changed, including a list that grew, a record that moved and a `Date` changed in place. A formula that calls `now()` or `today()` is evaluated in every pass. Every other formula cell keeps the very same result, and a copied object or list whose fields hold the same keeps the very same copy, so a memoized row does not re-render. A formula reading a field of a result kept from an earlier pass reads the field as it is now. Each pass still walks all of the data and reads again what the formulas read: with 200,000 formulas over 100,000 records, a pass with one edit takes about a third of the time a new evaluator takes, and the more a formula computes, the more a pass saves.

The type of the view follows from the type of the data: a `Formula` field becomes `FormulaValue | FormulaError | SyntaxError`, other fields keep their types.

`evaluate` computes inside the call, so a result is fresh right after a change. For data too large to compute at once, such as the first pass over 100,000 records, `await evaluator.evaluateAsync(data, { signal, timeoutMs })` gives the same view without holding the main thread for long:

- The cells compute in slices of about 8 ms, and the host runs its own tasks in between, so it may change the data meanwhile. A last pass then reads again what each formula read and computes again only what changed, so the view matches the data as it is when the promise resolves. That pass is not split and takes as long as a pass of `evaluate` with nothing changed: with 200,000 formulas over 100,000 records, the main thread is held at most about 120 ms at a time instead of 260 ms, and the whole call takes about 50% longer than `evaluate`.
- A later call of `evaluate` or `evaluateAsync` aborts the pending one: its promise rejects with an `AbortError`. An aborted `signal` rejects it with the reason of the signal, and `timeoutMs` running out with an `EXECUTION_TIMEOUT` error. Either is checked between slices.

Data that cannot hold a `Formula`, such as a backend response with cells like `{ value, isFormula }`, is read through the `cell` option. It gets what each field or list item holds, with its place, `{ owner, key }`, and gives the value of the cell, or a `Formula` for a formula cell; any other field it gives back as is. Formulas read what it gives, and the view shows it, or the result of the formula it gives. The view of such data has a shape the host names, `evaluate<ReportView>(report)`:

```ts
const evaluator = new FormulaScope().evaluator({
  cell: (held) => isBackendCell(held) ? (held.isFormula ? new Formula(held.value) : held.value) : held,
});

const report = { rows: [{ price: { value: 250, isFormula: false }, cost: { value: 'price * 2', isFormula: true } }] };
evaluator.evaluate<ReportView>(report).rows[0].cost; // FormulaNumber, value 500
```

`cell` is called once a pass for each field and item, never for a list item past the end of the list. For a cell that has not changed it gives the same value, which keeps the results that read it. An error it throws is a failed input: the formulas that read the cell fail with `INPUT_ERROR`, `onInputError` gets it once, and the view shows what the field holds.

## Names with `let`

`let` names a value once and reuses it, anywhere an expression can stand, callbacks included:

```ts
scope.evaluate(`
  orders.map(
    let
      net = current.price() * current.qty(),
      tax = net * rate
    in net + tax
  ).sum()
`, { orders: [{ price: 10, qty: 2 }], rate: 0.2 }).value;
// 24
```

Each value is computed once, in order, even if the body does not read it; inside a callback it is computed for every item, and inside a branch that is not taken it is not computed at all. A declared name hides a host value or an outer name with the same name. The parser's README lists the syntax rules.

## Data types

Every value inside a formula is an instance of a `FormulaDataType` subclass. The host passes plain values, which convert as the table further down shows; a result holds its JavaScript value in `.value`, and its `kind` tells the classes apart. The classes are exported as types only: `import type { FormulaNumber } from 'evalex'`. A result passed back in is read as it is.

| Kind | Class | JS value |
| --- | --- | --- |
| `Number` | `FormulaNumber` | `number` |
| `String` | `FormulaString` | `string` |
| `Boolean` | `FormulaBoolean` | `boolean` |
| `Date` | `FormulaDate` | `Temporal.PlainDate` |
| `DateTime` | `FormulaDateTime` | `Temporal.ZonedDateTime` |
| `DateRange` | `FormulaDateRange` | `{ start, end }`, both `Temporal.PlainDate` or both `Temporal.ZonedDateTime` |
| `Duration` | `FormulaDuration` | `Temporal.Duration` |
| `Array` | `FormulaArray` | `readonly FormulaDataType[]` |
| `Object` | `FormulaObject` | `Readonly<Record<string, FormulaDataType>>` |
| `RegExp` | `FormulaRegExp` | pattern and flags |
| `Null` | `FormulaNull` | `null` |

Values are immutable. To change a list or an object, create a new one instead of changing `.value` in place: a formula result can be the very same instance as its input, so an in-place change would alter results that were never recalculated.

When `+` joins text with a value of another kind, the value becomes the same text `format()` gives: `"n: " + [1, "a"]` → `"n: 1, a"`, `"n: " + null` → `"n: "`.

### Text of values

Once a formula turns a value into text, the host can no longer format that value for its reader. So the host decides up front: `format` holds a formatter per kind, and evalex calls it with the value wherever a formula turns that value into text — `+` with text, `join`, `format()` without a pattern, and values inside lists and objects.

```ts
const dates = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/London' });

const scope = new FormulaScope({ format: { dateTime: (value) => dates.format(value.epochMilliseconds) } });

scope.evaluate('"Due: " + due', { due: new Date('2024-07-28T14:35Z') }).value;
// 'Due: 28 July 2024 at 15:35'
```

| Formatter | Gets | Text without it |
| --- | --- | --- |
| `date` | `Temporal.PlainDate` | ISO 8601 date: `2024-07-28` |
| `dateTime` | `Temporal.ZonedDateTime` in UTC | ISO 8601 instant in UTC: `2024-07-28T14:35:00Z` |
| `dateRange` | `{ start, end }` | Both ends as `date` or `dateTime` gives them, joined by ` → ` |
| `duration` | `Temporal.Duration` | ISO 8601 duration: `P1DT2H` |
| `number` | `number` | `1234.5` |
| `boolean` | `boolean` | `true` / `false` |
| `null` | `null` | empty text |

Text and regular expressions keep their own text. Error payloads keep machine text whatever the formatters are; error messages are localized through `messageKey`. A formatter that throws fails the evaluation with its own exception, and one that returns something other than text throws a `TypeError`.

`format.names` gives the words of [date patterns](#dates-and-durations) in the host's language. Each list is optional, and a token whose list is left out stays English:

```ts
const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

new FormulaScope({ format: { names: { months } } }).evaluate('formatDate(due, "D MMMM YYYY")', { due }).value;
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

`FormulaArray.from` and `FormulaObject.from` convert nested host values: the items of a list right away, a field of an object the first time something reads it:

| Host value | Becomes |
| --- | --- |
| `null`, `undefined`, a hole in a list | `null` |
| A list, a `Set`, a typed array | a list |
| An object of exactly two fields, `start` and `end`, both dates without a time or both dates and times of the forms below | a date range |
| Any other plain object, object without a prototype or class instance | an object of its own enumerable fields; getters on the prototype, symbol keys and fields holding functions are left out, like methods |
| `new Number(5)`, `new String('a')`, `new Boolean(true)` | the value it holds |
| A `bigint` from `-(2^53 - 1)` to `2^53 - 1` | a number |
| `Date`, `Temporal.ZonedDateTime`, `Temporal.Instant` | a date and time at that instant |
| `Temporal.PlainDateTime` | a date and time read in the [zone of the scope](#formulascope) |
| `Temporal.PlainDate` | a date without a time |
| A formula value, such as a `FormulaNumber` | itself |

Every other value is rejected with a `TypeError` that names where it sits: `Cannot convert order.lines[2] to a formula value: Map has no formula form.` That covers a function in place of a value, such as an item of a list, symbols, `NaN`, `Infinity` and `-Infinity`, a `Date` that holds no instant, a larger `bigint`, built-in objects such as `Map`, `Promise`, `Error` or `Temporal.PlainTime`, a date range that ends before it starts or has a date without a time at one end and a date and time at the other, a list that contains itself, and lists and objects nested more than 1000 deep. A field is rejected when it is read, so `order.qty()` works even when `order.tags` holds a `Map`. A field getter runs only when its field is read, and an error it throws reaches the caller unchanged.

Records may link to each other both ways, such as a project that lists its tasks and tasks that point back at the project: one host object converts to one formula object, and a formula follows the links as far as it reads them. The text of an object writes a link back to an object it is already inside as `{…}`: `{ title: "Design", project: { name: "Apollo", tasks: [{…}] } }`. Two such objects are equal when nothing reachable from them differs.

Object fields are read with method syntax:

```ts
const order = {
  customer: { name: 'Ada' },
  lines: [{ qty: 2 }, { qty: 3 }],
};

scope.evaluate('order.customer().name()', { order }).value;                // 'Ada'
scope.evaluate('order.lines().map(current.qty()).sum()', { order }).value; // 5
```

Dates are backed by the global [`Temporal`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal): the runtime's own, or `temporal-polyfill/global` where the runtime has none. A `Temporal` value the host passes in is recognized only when it comes from that same global.

## Built-in routines

Routines come in two forms: **functions** called by name, like `sum(1, 2)`, and **methods** called on a value, like `"text".upper()`. Most list and text routines exist in both forms.

Inside `filter` and `map`, the second argument is evaluated once per item with two extra variables: `current` holds the item and `index` its zero-based position.

`scope.routines()` lists the same routines as data for an editor's completion and signature help: the name, the form, the description and the argument lists, each argument with its name, kinds, whether it is optional or repeatable, and the words it takes when it takes only some, such as the units of `dateBetween`. A routine with both forms is listed once as a function and once as a method, and a method lists the kinds of values it is called on. A method name that means different things on different kinds, such as `add` of numbers and of dates, is listed once for each meaning, and each argument list of a method names the kinds it is accepted on: `"a".add(b)` takes text, `5.add(b)` a number.

```ts
const round = scope.routines().find(({ name, form }) => name === 'round' && form === 'function');

round.signatures[0].parameters.map(({ name, optional }) => (optional ? `[${name}]` : name)).join(', ');
// 'number, [places]'
```

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

Every number a formula computes is finite. A result too large to hold, such as `10 ^ 400`, `exp(1000)` or `toNumber("1e400")`, fails with `Errors.Arithmetic.NumberOutOfRange`; a result that is no real number, such as `(-8) ^ (1 / 3)`, fails with `Errors.Arithmetic.NotARealNumber`. Both point at the operator, call or literal that produced the number.

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
| `sort(list, key?)` | Items in ascending order of `<`, or of the key computed for each item; all must be numbers, all texts, all dates or all dates and times. Equal items keep their order, texts compare by character code (`"B"` before `"a"`) | `["ccc", "a", "bb"].sort(length(current))` → `["a", "bb", "ccc"]` |

### Dates and durations

A date is a day of the calendar without a time, such as a birthday or a due day: it is the same day in every zone. A date and time is an instant, such as when an order was placed, and its day depends on the zone it is read in. Text without a time, `today()` and a host `Temporal.PlainDate` give dates; text with a time, `now()` and the other host dates give dates and times.

| Routine | Description | Example |
| --- | --- | --- |
| `now()` / `today()` | Current date and time, or the current date in the zone of the scope | `today().add(1, "days")` |
| `parseDate(text)` | Parses ISO 8601 text: without a time it gives a date, with a time a date and time, read in the zone of the scope when the text has no offset or time zone | `parseDate("2023-07-10T17:35Z")` |
| `toDate(dateTime, timezone?)` | The date a date and time falls on in the zone of the scope, or in the zone given | `now().toDate()` |
| `toDateTime(date, time?, timezone?)` | The start of a date, or a time such as `"13:30"` on it, in the zone of the scope, or in the zone given | `due.toDateTime("18:00")` |
| `fromTimestamp(ms)` | Date and time in UTC from a Unix timestamp in milliseconds, without seconds | `fromTimestamp(1689024900000)` |
| `timestamp(dateTime)` | Unix timestamp of the date and time in milliseconds | `parseDate("2023-07-10T21:35Z").timestamp()` → `1689024900000` |
| `dateAdd(date, amount, unit)` | Adds a whole number of units, or a duration | `parseDate("2023-08-30").add(2, "months")` |
| `dateSubtract(date, amount, unit)` | Subtracts a whole number of units, or a duration | `parseDate("2023-07-10").subtract(1, "years")` |
| `dateBetween(a, b, unit)` | Difference between two dates, or two dates and times, as a duration | `dateBetween(end, start, "days").days()` |
| `formatDate(date, pattern, timezone?)` | Date as text built from a pattern; also `date.format(pattern, timezone?)` | `parseDate("2023-08-30T14:05Z").format("MMMM D, YYYY h:mm A")` → `"August 30, 2023 2:05 PM"` |
| `dateRange(start, end)` | Date range of two dates, or of two dates and times; an end before the start is an error | `parseDate("2022-09-07").range(parseDate("2023-09-07"))` |
| `dateStart(range)` / `dateEnd(range)` | Start or end of a date range; a date is its own start and end | `dateRange(a, b).end()` → `b` |
| `year()` `month()` `week()` `date()` `day()` | Date parts, of a date and time in the zone of the scope: `month` is 1–12, `week` is the ISO week, `day` is 1 (Monday) to 7 (Sunday) | `parseDate("2023-07-10").month()` → `7` |
| `hour()` `minute()` | Time parts of a date and time in the zone of the scope | `parseDate("2023-07-10T17:35Z").hour()` → `17` |
| `years(duration)` … `milliseconds(duration)` | Reads one unit of a duration | `dateBetween(a, b, "years").months()` |

A date and a date and time do not mix. `<`, `<=`, `>`, `>=`, `in` and `sort` fail on the two with `Errors.Evaluation.DateWithDateTime`, a routine that takes two dates fails at the second one, and `==` never finds them equal. A formula converts one of them first: `due < now().toDate()` or `due.toDateTime("18:00") < now()`.

Date ranges are equal when both ends are; they cannot be ordered with `<` or `>`, and date arithmetic takes a single date, such as `dateStart(range)`.

`dateAdd`, `dateSubtract` and `toDateTime` fail with `Errors.Arithmetic.DateOutOfRange` when the result falls outside the supported dates, about 270,000 years either side of 1970.

`add`, `subtract`, `between`, `range`, `start` and `end` are the method forms of the date functions; the function names work as methods too, as in `now().dateAdd(1, "days")`. Units are `"years"`, `"months"`, `"weeks"`, `"days"` and, except for `between`, `"quarters"` (three months). A date and time also takes `"hours"`, `"minutes"` and, except for `between`, `"seconds"`, and a duration added to a date holds whole days and longer units only.

`dateAdd`, `dateSubtract` and `dateBetween` count days and longer units of a date and time by the calendar of the zone of the scope: a day added across a daylight saving change keeps the time of day.

A date pattern shows a date and time in the zone of the scope unless a time zone is given by name (`"Europe/Berlin"`) or as an offset (`"+05:00"`). A pattern for a date takes no time zone and no tokens of the time, from the hour to the offset and the timestamp. Names are in English on every machine, unless the host gives its own in [`format.names`](#text-of-values). Text in brackets is kept as is, and so is any letter that is not a token:

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
| `parent(expression)` | Evaluates the expression over the fields of the enclosing object, see [Formulas in data](#formulas-in-data) | `parent(taxRate)` |
| `previous(expression, default)` | Evaluates the expression over the previous record of the list, or the default for the first record | `previous(total, 0) + amount` |
| `next(expression, default)` | Evaluates the expression over the next record of the list, or the default for the last record | `next(rest, 0) + amount` |
| `empty(value)` | True for `0`, `""`, `false`, `[]` and `null` | `empty([])` → `true` |
| `format(value)` | Converts the value to text; a date becomes an ISO 8601 date, and a date and time an ISO 8601 instant in UTC, unless the host [formats dates](#text-of-values) | `parseDate("2023-07-10T17:35Z").format()` → `"2023-07-10T17:35:00Z"` |
| `equal(a, b)` | Compares two values like `==`: lists item by item, dates by day, dates and times by instant, values of different types are never equal | `[1, [2]].equal([1, [2]])` → `true` |
| `unequal(a, b)` | The opposite of `equal`, like `!=` | `unequal(1, 2)` → `true` |
| `toNumber(value)` | Text read as a number, `1` or `0` for a boolean, the timestamp of a date; text that holds no number, blank text included, is an error | `"2".toNumber()` → `2` |

Conditions read a value the same way everywhere — in `if`, in `? :` and in `and`, `or` and `not`: an empty value counts as false and any other value as true. So `not []` is `true`.

`value in container` tells whether the value is in the container, and `not in` is its opposite. What the value must be depends on the container; anything else is an `ARGUMENT_TYPE_MISMATCH` at the operand at fault:

| Container | True when | Example |
| --- | --- | --- |
| List | Some item equals the value, as in `==` | `2 in [1, 2, 3]` → `true` |
| Text | The text holds the value, which is text, as plain text: case and pattern characters count | `"." in "v12"` → `false` |
| Object | The object has an own field named by the value, which is text, even an empty one | `"price" in item` |
| Date range | The value, of the kind of the ends, is from the start to the end, both included; a range of dates holds its last day whole | `due in dateRange(start, end)` |

## Errors

Parse errors throw `SyntaxError`, a subclass of the built-in one, with a `code` from `SyntaxErrorCode`, a `payload` typed by `SyntaxErrorPayloads` and a `location`. A formula that nests or chains more than 256 levels, such as a sum of 257 terms, is one of them, so a long formula never overflows the stack. See the [parser README](../parser/README.md#syntax-errors) for the codes and for what counts a level. Evaluation errors throw `FormulaError`:

| Property | Contents |
| --- | --- |
| `code` | One of the codes below, as text. `FormulaErrorCode` holds them all: `FormulaErrorCode.REFERENCE_ERROR` is `'REFERENCE_ERROR'` |
| `payload` | Structured details, e.g. `{ actual: 'String', expected: ['Array', 'Number'], argumentPosition: 1 }`; `FormulaErrorPayloads` types it by code |
| `location` | A `FormulaLocation`: `{ start, end }`, each with `offset`, `line` and `column`; a `SyntaxError` has one too |
| `message` | Human-readable text ending with `[start,end]` offsets |

| Code | Raised when |
| --- | --- |
| `REFERENCE_ERROR` | A variable, function, method or object field does not exist, or the formula reads one from an empty value |
| `ARGUMENT_TYPE_MISMATCH` | An argument has the wrong type or an invalid value, such as an unknown date unit, or a callback returns a value of the wrong type |
| `ARGUMENT_COUNT_MISMATCH` | Too few or too many arguments |
| `PATTERN_MISMATCH` | The arguments fit none of the routine's accepted signatures |
| `ARITHMETIC_ERROR` | Division or remainder by zero |
| `EVALUATE_ERROR` | An operator gets operands it cannot combine, such as a date and a date and time, or text is not a valid regular expression |
| `RANGE_ERROR` | An unsupported operator, a number too large to hold or that is no real number, or a date outside the supported dates |
| `CIRCULAR_REFERENCE` | A formula cell reads a cell that depends on it, see [Formulas in data](#formulas-in-data) |
| `INPUT_ERROR` | A formula cell reads a failed cell or host data that cannot be read; the failure is its `cause`, see [Formulas in data](#formulas-in-data) |
| `EXECUTION_TIMEOUT` | `evaluateAsync` runs longer than its `timeoutMs`; the promise rejects with it, see [Formulas in data](#formulas-in-data) |

An error about a value points at the part of the formula the value came from. When `if`, `? :`, parentheses or a `let` body hand on a value unchanged, the location narrows to that value: in `sum(if(flag, 1, "a"))` with `flag` false, the error points at `"a"`, not at the whole `if`. A value read through a name points at the name. Reading from an empty value points at that value: `project.rate()` with `project` empty fails with `Cannot read "rate" of an empty value.` at `project`, and `task.project().rate()` at `task.project()`.

Several errors share a code. `Errors.<Group>.<Error>.is(error)` matches exactly one of them; comparing `code` matches all errors with that code:

```ts
try {
  scope.evaluate('price * qty', { price: 10 });
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

## Source layout

| Path | Contents |
| --- | --- |
| [`formula-scope.ts`](./formula-scope.ts) | `FormulaScope`, which evaluates one formula over host values and creates evaluators |
| [`parse-formula.ts`](./parse-formula.ts) | Parsing with the cache of recently used formula texts |
| [`evaluate-formula.ts`](./evaluate-formula.ts) | Evaluating a parsed formula over values found by name, shared by the scope and the evaluator |
| [`formula.ts`](./formula.ts) | `Formula`, the marker of a formula cell in host data |
| [`formula-evaluator.ts`](./formula-evaluator.ts) | `FormulaEvaluator`, which computes the formula cells of host data |
| [`evaluation-pass.ts`](./evaluation-pass.ts) | One pass of an evaluator: the walk, the order of cells, cycles, reuse of results and the view |
| [`yield-to-host.ts`](./yield-to-host.ts) | Lets the host run its own tasks between the slices of `evaluateAsync` |
| [`evaluator-memory.ts`](./evaluator-memory.ts) | What an evaluator keeps between passes: the reads and result of each cell, and the copies of the view |
| [`record-names.ts`](./record-names.ts) | The names a formula reads from the records around it, its enclosing object and neighbor records |
| [`host-containers.ts`](./host-containers.ts) | Which host values hold cells, and how a field is read again |
| [`cell-read-failure.ts`](./cell-read-failure.ts) | The failure of a read of a cell, turned into an error at the part of the formula that read it |
| [`lru-cache.ts`](./lru-cache.ts) | The bounded cache that keeps parses of recently used formula texts |
| [`evaluator.visitor.ts`](./evaluator.visitor.ts) | Walks the AST and computes values |
| [`dependency-extractor.visitor.ts`](./dependency-extractor.visitor.ts) | Collects identifiers for static dependencies and finds calls to volatile routines |
| [`volatile-formula.ts`](./volatile-formula.ts) | Tells the evaluator which formulas to evaluate in every pass, even with unchanged reads |
| [`context.ts`](./context.ts) | Variable scopes, including the nested scopes used by callbacks |
| [`data-types/`](./data-types) | One folder per data type |
| [`routines/`](./routines) | Routine registry, argument validation and one file per routine in `routines/routines/` |
| [`errors/`](./errors) | `FormulaError`, error codes and the `Errors` factory namespace |
