# Каталог рутин: что осталось завести

## Резюме

Источник истины — база [Methods](https://app.notion.com/p/mindbox-cloud/23cd64d9addf806180ceceba5cbab330) в Notion, состояние на 2026-10-09. Сигнатуры и примеры взяты из справки Notion [Formula syntax & functions](https://www.notion.com/help/formula-syntax). В справке сигнатур нет, поэтому они **выведены из примеров**.

Как читать базу:

- строка с типом (`String`, `Date`, `Array`…) — метод этого типа;
- `All` — метод всех типов;
- строка без типа — глобальная функция;
- `Projektor Specific` — сущности Projektor (задача, доска, человек).

| Состояние | Строк |
|-----------|-------|
| Completed (из них `and`, `or`, `not` — won't planned) | 47 |
| Won't planned, не отмечено (`ifs`) | 1 |
| **Осталось завести** | **65** |
| Всего | 113 |

Completed означает, что рутина с этим именем зарегистрирована на этом типе. Поведение построчно со справкой не сверялось.

Две строки сознательно оставлены без отметки, хотя одноимённые рутины есть: `Date.format` (в базе это форматирование по строке формата, а у нас — `format` без аргументов) и `String.parseDate` (у нас есть только глобальная `parseDate`).

Из 65 оставшихся 15 упираются в решения, которых в движке пока нет (раздел 4). Остальные 50 — обычные рутины, которые описываются один раз на обе формы (раздел 1).

---

## 1. Одно описание на обе формы

В Notion любую функцию можно вызвать двумя способами: `lower("A")` и `"A".lower()`. У нас это две независимые регистрации, `registerFunction` и `registerMethod`, и отсюда две проблемы.

**Половина форм отсутствует.** 16 строк, отмеченных Completed, работают только как методы: `"A".lower()` работает, а `lower("A")` падает с `Function "lower" is not defined`. Это:

- 8 методов String: `trim`, `upper`, `lower`, `replace`, `replaceAll`, `match`, `test`, `contains`;
- 7 частей даты: `year`, `month`, `week`, `date`, `day`, `hour`, `minute`;
- `equal`.

**Где формы есть обе, они описаны дважды и расходятся при правке одной из копий.** Так устроены 9 рутин: `map`, `filter`, `join`, `length`, `log2`, `log10`, `sum`, `dateAdd`/`add`, `dateBetween`/`between`. Описание `filter` уже расходилось, сейчас выровнено руками. На примере [`filter.routine.ts`](../src/core/routines/routines/filter.routine.ts):

| Часть | Функция | Метод |
|-------|---------|-------|
| `description` | Returns the values in the list for which the condition is true. | та же строка, но отдельной копией |
| `examples` | `routineExamples` | тот же `routineExamples` |
| `arguments` | `list`, `predicate` | `self`, `predicate` — отличается только первый |
| `handler` | список из `args[0]` | список из `instance`, остальное — копия |

Кроме того, в описаниях методов `self` объявлен непоследовательно. У `map`, `filter`, `join` и regexp-методов String он есть. У `upper`, `trim`, `length` его нет.

**Что нужно.** Рутина описывается один раз: одно `description`, одни `examples`, один список аргументов и один `handler`. Обработчик получает объект вызова одинаково для обеих форм: для `x.f(a)` это `x`, для `f(x, a)` — первый аргумент. Аргументы функции получаются как объект вызова плюс аргументы метода. Чисто функциональные рутины без объекта вызова (`if`, `now`, `pi`, `let`) остаются на `registerFunction`.

Есть ещё одно требование. Функция с одним именем может принадлежать нескольким типам: `length` — у String и Array, `add` — у Number и Date, `sum` — у Number и Array. Поэтому вызов `f(x, …)` должен выбирать реализацию по типу `x`, а не падать на второй регистрации того же имени.

**Решение (2026-10-09):** вариант 1, хелпер регистрации. Делается отдельной задачей, первым шагом раздела 5.

**Варианты:**

1. **Хелпер регистрации (выбран).** Это `routinesRegistry.registerRoutine(name, { on: [FormulaArray], subject, arguments, handler })`, который из одного описания регистрирует метод на каждом типе из `on` и функцию. Реестр знает обе формы, поэтому:
   - список функций для автодополнения и документации полный;
   - ошибка типа в `lower(1)` говорит о типе аргумента, а не об отсутствии метода у Number;
   - примеры прогоняются в обеих формах через `toFunctionExamples` / `toMethodExamples`.

   Стоимость — ≈1 день: хелпер, перевод 9 рутин с двумя формами, 16 строк только с методом и `equal`.
2. **Fallback в диспетчере.** Регистрируется только метод, а `RoutineDispatcher.callFunction` при отсутствии функции `f` вызывает `x.f(...rest)`. Это дешевле (≈2 часа), но реестр о функциональной форме не знает. Функции не попадут в списки, `lower(1)` упадёт с `Method "lower" is not defined` у Number, а позиции аргументов в ошибках сдвинутся на единицу. После варианта 1 этот вариант не нужен.

Рутины живут по одной на файл в `src/core/routines/routines/<имя>.routine.ts`, все формы одного имени — в одном файле. Тесты лежат рядом, в `__tests__/<имя>.routine.test.ts`, на `RoutineTester`.

**Примеры из описания должны прогоняться всегда.** `RoutineTester` прогоняет встроенные `examples` рутины, но в трёх случаях они выпадают молча:

- **У рутины нет тест-файла.** Так ложный пример `"1".equal("1")` = false прожил до переноса тестов.
- **Тест вызван через `.examples.only`.** Встроенные примеры не прогоняются.
- **Свой случай с тем же текстом вызова.** Случаи объединяются по тексту вызова, побеждает последний, поэтому встроенный пример заменяется своим.

Ещё две дыры отбрасывают случаи без ошибки:

- случай с ошибкой под ключом `function` в наборе со `skipFunction`;
- случай, тип которого резолвер не определил.

Встроенные примеры с `now()` прогонять нельзя: ожидаемое значение считается в другой момент, чем результат. Поэтому примеры пишутся на фиксированных датах.

Хелпер из варианта 1 должен заводить прогон примеров сам, а `RoutineTester` — падать на выброшенном случае, а не пропускать его.

---

## 2. Что осталось: 65 строк

Обозначения в сигнатурах:

- `?` — необязательный аргумент;
- `...` — повторяемый аргумент;
- `cond` / `expr` — выражение с `current` (и `index`), которое вычисляется для каждого элемента, как у `filter` и `map`.

В колонке «Описание» — текст из базы, он же пойдёт в поле `description`. Пометка ¹ значит, что в базе описание пустое и взято из справки.

### 2.1 Number — 21

| Рутина | Сигнатура | Описание | Пример | Заметка |
|--------|-----------|----------|--------|---------|
| add | `add(a, b)` | Returns the sum of two numbers. | `add(5, 10)` = 15 | есть оператор `+` |
| subtract | `subtract(a, b)` | Returns the difference of two numbers. | `subtract(5, 10)` = -5 | есть оператор `-` |
| multiply | `multiply(a, b)` | Returns the product of two numbers. | `multiply(5, 10)` = 50 | есть оператор `*` |
| divide | `divide(a, b)` | Returns the quotient of two numbers. | `divide(5, 10)` = 0.5 | есть оператор `/` |
| mod | `mod(a, b)` | Returns the first number modulo the second number. | `mod(5, 10)` = 5 | есть оператор `%` |
| pow | `pow(base, exponent)` | Returns the result of a base number raised to an exponent power. | `pow(5, 10)` = 9765625 | есть оператор `^` |
| min | `min(...numbersOrLists)` | Returns the smallest number of the arguments. | `min([1, 2, 3])` = 1 | как `sum`: Number и Array |
| max | `max(...numbersOrLists)` | Returns the largest number of the arguments. | `max(1, 2, 3)` = 3 | как `sum` |
| mean | `mean(...numbersOrLists)` | Returns the arithmetic average of its arguments. | `mean([1, 2, 3], 4, 5)` = 3 | как `sum` |
| median | `median(...numbersOrLists)` | Returns the middle value of its arguments. | `median([1, 2, 3], 4)` = 2.5 | как `sum` |
| abs | `abs(number)` | Returns the absolute value of the number. | `abs(-10)` = 10 | |
| round | `round(number, places?)` | Returns the value of a number rounded to the nearest integer. | `round(1.234, 2)` = 1.23, `round(1234, -2)` = 1200, `round(-0.6)` = -1 | `places` бывает отрицательным |
| ceil | `ceil(number)` | Returns the smallest integer greater than or equal to the number. | `ceil(-0.6)` = 0 | |
| floor | `floor(number)` | Returns the largest integer less than or equal to the number. | `floor(-0.6)` = -1 | |
| sqrt | `sqrt(number)` | Returns the positive square root of the number. | `sqrt(4)` = 2 | |
| cbrt | `cbrt(number)` | Returns the cube root of the number. | `cbrt(64)` = 4 | |
| exp | `exp(number)` | Returns e^x, where x is the argument, and e is Euler's number (2.718…), the base of the natural logarithm. | `exp(1)` = 2.718281828459045 | |
| ln | `ln(number)` | Returns the natural logarithm of the number. | `ln(10)` = 2.302585092994046 | |
| sign | `sign(number)` | Returns 1 if the number is positive, -1 if it is negative, and 0 if it is zero. | `sign(-10)` = -1 | |
| fromTimestamp | `fromTimestamp(ms)` | Returns the date from the given Unix timestamp. The timestamp represents the number of milliseconds that have elapsed since January 1, 1970. Note: the returned date will not retain the seconds & milliseconds. | `fromTimestamp(1689024900000)` = @July 10, 2023 2:35 PM | отбрасывает секунды |
| toNumber | `toNumber(number)` | Parses a number from text. | `toNumber(2)` = 2 | тождество; см. 2.5 |

`Date.add` и `Date.subtract` уже есть. Числовые `add` и `subtract` регистрируются на Number, поэтому конфликта нет: при общем описании из раздела 1 вызов `add(x, …)` выберет реализацию по типу `x`.

### 2.2 String — 10

| Рутина | Сигнатура | Описание | Пример | Заметка |
|--------|-----------|----------|--------|---------|
| substring | `substring(text, start, end?)` | Returns the substring of the text from the start index (inclusive) to the end index (optional and exclusive). | `substring("Notion", 0, 3)` = "Not", `substring("Notion", 3)` = "ion" | |
| split | `split(text, separator)` | Returns the list of values created by splitting a text by a separator. | `split("apple,pear,orange", ",")` = ["apple", "pear", "orange"] | |
| repeat | `repeat(text, times)` | Repeats the text a given number of times. | `repeat("0", 4)` = "0000" | |
| padStart | `padStart(text, length, padding)` | Returns the text padded with the provided padding string at the start until the target length is reached. | `padStart("5", 3, "0")` = "005" | нет в справке |
| padEnd | `padEnd(text, length, padding)` | Returns the text padded with the provided padding string at the end until the target length is reached. | `padEnd("5", 3, "0")` = "500" | нет в справке |
| parseDate | `text.parseDate()` | Returns the date parsed according to the ISO 8601 standard. | `"2022-01-01".parseDate()` = @January 1, 2022 | методная форма готовой `parseDate` |
| toNumber | `toNumber(text)` | Parses a number from text. | `toNumber("2")` = 2 | |
| style | `style(text, ...styles)` | Adds styles and colors to the text. Valid formatting styles: "b" (bold), "u" (underline), "i" (italics), "c" (code), or "s" (strikethrough). Valid colors: "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", and "red". Add "_background" to colors to set background colors. | `style("Notion", "blue", "gray_background")` | блокер: rich text |
| unstyle | `unstyle(text, ...styles?)` | Removes formatting styles from the text. If no styles are specified, all styles are removed. | `unstyle("Text", "b")` | блокер: rich text |
| link | `link(label, url)` | Creates a hyperlink from the label text and the URL. | `link("Notion", "https://notion.so")` = "Notion" | блокер: rich text и имя (4.2) |

### 2.3 Array — 15

| Рутина | Сигнатура | Описание | Пример | Заметка |
|--------|-----------|----------|--------|---------|
| at | `at(list, index)` | Returns the value at the specified index in a list.¹ | `at([1, 2, 3], 1)` = 2 | |
| first | `first(list)` | Returns the first item in the list.¹ | `first([1, 2, 3])` = 1 | |
| last | `last(list)` | Returns the last item in the list.¹ | `last([1, 2, 3])` = 3 | |
| slice | `slice(list, start, end?)` | Returns the items of the list from the provided start index (inclusive) to the end index (optional and exclusive).¹ | `slice([1, 2, 3], 1, 2)` = [2], `slice(["a", "b", "c"], 1)` = ["b", "c"] | |
| concat | `concat(...lists)` | Returns the concatenation of multiple lists.¹ | `concat([1, 2], [3, 4])` = [1, 2, 3, 4] | |
| reverse | `reverse(list)` | Returns the reversed list. | `reverse(["green", "eggs", "ham"])` = ["ham", "eggs", "green"] | |
| unique | `unique(list)` | Returns the list of unique values in the input list. | `unique([1, 1, 2])` = [1, 2] | равенство — как у `equal` |
| includes | `includes(list, value)` | Returns true if the list contains the specified value, and false otherwise. | `includes([1, 2, 3], 4)` = false | равенство — как у `equal` |
| flat | `flat(list)` | Flattens a list of lists into a single list. | `flat([[1, 2], [3, 4]])` = [1, 2, 3, 4], `flat([1, 2, 3])` = [1, 2, 3] | |
| sort | `sort(list, expr?)` | Returns the list in sorted order. Optionally, a provided expression can be used to determine the sorting order. | `sort([3, 1, 2])` = [1, 2, 3] | `expr` — расширение базы (4.5) |
| find | `find(list, cond)` | Returns the first element in the list for which the condition returns true. | `find(["a", "b", "c"], current == "b")` = "b", `find([1, 2, 3], current > 100)` = Empty | Empty — `FormulaNull` |
| findIndex | `findIndex(list, cond)` | Returns the index of the first item in the list for which the condition evaluates to true. | `findIndex(["a", "b", "c"], current == "b")` = 1, без совпадения = -1 | |
| some | `some(list, cond)` | Returns true if any item in the list satisfies the given condition, and false otherwise. | `some([1, 2, 3], current == 2)` = true | |
| every | `every(list, cond)` | Returns true if every item in the list satisfies the given condition, and false otherwise. | `every([1, 2, 3], current > 0)` = true | |
| count | `count(list, cond?)` | Returns the number of elements in a list for which the condition is true. If no condition is provided, returns the total number of elements (equivalent to length()). | `count([1, 2, 3], current > 1)` = 2 | нет в справке |

Рутины с `cond` и `expr` строятся по образцу [`filter.routine.ts`](../src/core/routines/routines/filter.routine.ts).

### 2.4 Даты — 11

Методы Date (6) и глобальные функции (5) в одной таблице: часть глобальных — это другие имена тех же методов.

| Рутина | Где | Сигнатура | Описание | Пример | Заметка |
|--------|-----|-----------|----------|--------|---------|
| dateSubtract | функция | `dateSubtract(date, amount, unit)` | Subtracts time from the date. The unit argument can be one of: "years", "quarters", "months", "weeks", "days", "hours", or "minutes". | `dateSubtract(now(), 2, "months")` | функциональная форма готового `Date.subtract` |
| timestamp | Date | `timestamp(date)` | Returns the current Unix timestamp, representing the number of milliseconds that have elapsed since January 1, 1970. | `timestamp(now())` = 1693443300000 | |
| toNumber | Date | `toNumber(date)` | Parses a number from text. | `toNumber(now())` = 1693443300000 | то же, что `timestamp` |
| format | Date | `format(date, pattern, timezone?)` | Formats the date using a custom format string and optional timezone. The format string can contain the following text to represent parts of the date: "YYYY" for year, "MM" for month, "DD" for day, "HH" for hour, "mm" for minute. | `now().format("MM/DD/YYYY")` = "08/30/2023" | решение 4.4 |
| formatDate | функция | `formatDate(date, pattern, timezone?)` | то же, что `Date.format` | `formatDate(now(), "MMMM D, Y")` = "August 30, 2023" | функциональная форма `Date.format` |
| range | Date | `range(start, end)` | Returns a date range constructed from the start and end dates. | — | блокер 4.1 |
| start | Date | `start(range)` | Returns the start of the date range. | — | блокер 4.1 |
| end | Date | `end(range)` | Returns the end of the date range. | — | блокер 4.1 |
| dateRange | функция | `dateRange(start, end)` | то же, что `Date.range` | `dateRange(prop("Start Date"), prop("End Date"))` = @September 7, 2022 → September 7, 2023 | блокер 4.1 |
| dateStart | функция | `dateStart(range)` | то же, что `Date.start` | `dateStart(prop("Date Range"))` = @September 7, 2022 | блокер 4.1 |
| dateEnd | функция | `dateEnd(range)` | то же, что `Date.end` | `dateEnd(prop("Date range"))` = @September 7, 2023 | блокер 4.1 |

### 2.5 Boolean и All — 2

| Рутина | Где | Сигнатура | Описание | Пример |
|--------|-----|-----------|----------|--------|
| toNumber | Boolean | `toNumber(bool)` | Parses a number from text. | `toNumber(true)` = 1 |
| unequal | All | `unequal(a, b)` | Returns false if both values are equal and true otherwise.¹ | `unequal(1, 2)` = true |

`toNumber` в базе — четыре строки на String, Number, Date и Boolean. Описание «Parses a number from text» верно только для String: для остальных типов это приведение к числу.

### 2.6 Projektor — 4

| Рутина | Сигнатура | Описание | Пример |
|--------|-----------|----------|--------|
| id | `id(entity?)` | Returns the id of the task, board or person. If no task, board or person is provided, returns the id of the task the formula is on. | `id()`, `id(prop("Relation").first())` |
| link | `link(entity?)` | Returns the link to the task, board or person. If no task, board or person is provided, returns the link to the task the formula is on. | `link()` |
| name | `name(person)` | Returns the name of a person. | `prop("Pioneers").map(name(current)).join(", ")` = "Grace Hopper, Ada Lovelace" |
| email | `email(person)` | Returns the email address of a person. | `prop("People").map(email(current)).join(", ")` |

Все четыре упираются в блокер 4.3.

### 2.7 Переменные — 2

| Рутина | Сигнатура | Описание | Пример |
|--------|-----------|----------|--------|
| let | `let(name, value, expr)` | Assigns a value to a variable and evaluates the expression using that variable. | `let(radius, 4, round(pi() * radius ^ 2))` = 50 |
| lets | `lets(name1, value1, ...nameN, valueN, expr)` | Assigns values to multiple variables and evaluates the expression using those variables. | `lets(a, "Hello", b, "world", a + " " + b)` = "Hello world" |

Блокер 4.6.

---

## 3. Готовое под другим именем

Пять строк закрываются регистрацией второго имени у готовой реализации, без новой логики:

| Строка базы | Реализация |
|-------------|------------|
| `dateSubtract` | `Date.subtract` |
| `String.parseDate` | функция `parseDate` |
| `Date.toNumber` | `Date.timestamp` (сначала завести его) |
| `formatDate` | `Date.format` (сначала завести его) |
| `dateRange`, `dateStart`, `dateEnd` | `Date.range`, `Date.start`, `Date.end` (после 4.1) |

Общее описание из раздела 1 их не закрывает: имена функций и методов разные.

---

## 4. Блокеры и открытые решения

### 4.1 Диапазон дат — 6 строк

`Date.range`, `Date.start`, `Date.end`, `dateRange`, `dateStart`, `dateEnd`. Типа «диапазон» в движке нет. База кладёт `start`/`end` на тип Date, значит, вариант — у `FormulaDate` появляется необязательный конец, а не отдельный тип. Нужно выбрать: поле `end` в `FormulaDate` или новый `FormulaDateRange`. От выбора зависит, что вернёт `dateBetween` и операторы сравнения на диапазоне.

### 4.2 Rich text и имя `link` — 3 строки

`style`, `unstyle`, `String.link` возвращают текст с разметкой, а `FormulaString` хранит голую строку. Кроме того, имя `link` занято дважды: `link(label, url)` у String и `link(entity?)` у Projektor. Их можно различить по типу первого аргумента, но решить это нужно до регистрации.

### 4.3 Сущности Projektor — 4 строки

`id`, `link`, `name`, `email` работают с задачей, доской и человеком, а `id()` и `link()` без аргументов — с задачей, на которой стоит формула. Нужны типы этих сущностей и способ передать текущую задачу в контекст вычисления. Скорее всего, это плагин Projektor через `initializeFormulaCore({ plugins })`, а не встроенные рутины. Тогда эти строки уходят в план 004 о пользовательских рутинах.

### 4.4 Строка формата даты

Справка и база расходятся:

- **час:** в базе `HH`, в справке `h`;
- **токены из примеров справки:** `MMMM`, `D`, `Y`, `A` — в описании их нет;
- **часовой пояс:** в базе есть необязательный аргумент, в справке его нет.

Нужен фиксированный набор токенов. Даты у нас на `temporal-polyfill`, библиотеки форматирования нет: либо свой разбор токенов поверх `Temporal` (≈50 строк), либо зависимость — её нужно согласовать.

### 4.5 `sort` с выражением

В справке `sort` без второго аргумента. В базе выражение «determines the sorting order», но не сказано, ключ это (`current.name`) или компаратор. Рекомендация: ключ, по аналогии с `cond` у `filter`.

### 4.6 `let` / `lets` — 2 строки

Первый аргумент — имя переменной, а не выражение: его нельзя вычислять. Переменная должна попасть в область видимости `expr` так же, как `current` попадает в выражение `map`. Нужна правка того, как `visitor` разрешает идентификаторы.

---

## 5. Порядок работ

Оценки — на одного человека, рутина с тестами из примеров.

1. **Одно описание на обе формы** (раздел 1): ≈1 день. Убирает дубли у 9 рутин и даёт функциональную форму 16 готовым строкам. Все следующие рутины пишутся уже через него.
2. **Number** (21 строка): ≈1 день. Шесть рутин переиспользуют операторы, четыре повторяют устройство `sum`.
3. **Array** (15 строк): ≈1 день. `find`, `findIndex`, `some`, `every`, `count`, `sort` — по образцу `filter`.
4. **String без rich text** (7 строк) и **`unequal`, `Boolean.toNumber`**: ≈полдня.
5. **Даты без диапазона** (5 строк: `dateSubtract`, `timestamp`, `Date.toNumber`, `Date.format`, `formatDate`): ≈полдня после решения 4.4.

Итого ≈4–4,5 дня на 50 строк вместе с общим описанием. Оставшиеся 15 ждут решений 4.1, 4.2, 4.3 и 4.6.

---

## 6. Вне базы

- **`formatNumber`** — есть в справке, нет в базе. В справке только пример `formatNumber(prop("Number"), "usd", 0)` без описания.
- **Won't planned:** `and`, `or`, `not` (их покрывают операторы) и `ifs` (его покрывает вложенный `if`). Вызов `and(true, false)` парсер сейчас не разбирает (`Unexpected keyword "and"`), и с решением won't planned так и остаётся.
- **Duration** (`years`, `months`, …, `milliseconds`) — в справке Notion этого типа нет, в базе все 8 строк Completed.

---

## 7. Примечания

- **Расхождение с Notion допустимо только в сторону расширения.** На входах, которые понимает Notion, рутина возвращает то же, что Notion. Отличаться можно лишь там, где у нас богаче синтаксис или больше аргументов: литерал `/pattern/flags` и `RegExp` из контекста. Флаги задаются только литералом, отдельного аргумента `flags` у методов нет. Сверено пробами в Notion 2026-10-09: `contains` со строкой ищет подстроку (`contains("abc", "a.c")` = false), `length` считает графемы (`length("👨‍👩‍👧")` = 1), `match` возвращает все совпадения без групп захвата, `replace` поддерживает `$1` и `$&`.
- **Сигнатуры выведены из примеров.** Имена параметров условные. Повторяемость (`...`) и необязательность (`?`) взяты из примеров с разным числом аргументов.
- **`padStart` / `padEnd`, `count`** в справке отсутствуют, их сигнатуры выведены из описания в базе. Есть ли у `padding` значение по умолчанию (пробел, как в JS), описание не говорит.
- **Пример `toNumber(now())`** в справке возвращает миллисекунды — это подтверждает строку `Date.toNumber`.
