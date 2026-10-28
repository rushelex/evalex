/**
 * Words that date patterns of `formatDate` and `format(date, pattern)` put into the text.
 *
 * @remarks
 * Every list is optional; a token whose list is left out keeps its English words.
 * Weekday lists start with Sunday, as the `d` token counts.
 *
 * @example
 * ```ts
 * const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
 *
 * new FormulaScope({ format: { names: { months } } }).evaluate('formatDate(due, "D MMMM YYYY")', { due });
 * // "28 июля 2024"
 * ```
 */
export interface DateNames {
  /** Twelve month names in the form they take next to a day, for `MMMM`. */
  readonly months?: readonly string[];
  /** Twelve month names in the form they take on their own, for `LLLL`; without them, `LLLL` takes `months`. */
  readonly monthsStandalone?: readonly string[];
  /** Twelve short month names, for `MMM`. */
  readonly monthsShort?: readonly string[];
  /** Seven weekday names from Sunday, for `dddd`. */
  readonly weekdays?: readonly string[];
  /** Seven short weekday names from Sunday, for `ddd`. */
  readonly weekdaysShort?: readonly string[];
  /** Seven shortest weekday names from Sunday, for `dd`. */
  readonly weekdaysMin?: readonly string[];
  /** The words for before and after noon, for `A`; `a` takes them in lower case. */
  readonly dayPeriods?: readonly [before: string, after: string];
  /** The day of the month as an ordinal, for `Do`. */
  readonly ordinal?: (day: number) => string;
}

/**
 * Formatters that decide how values look when a formula turns them into text.
 *
 * @remarks
 * A formatter is used wherever a formula turns a value into text: `+` with text, `join`, `format()` without
 * a pattern, and values inside lists and objects that become text. A kind without a formatter keeps its own text.
 * Dates reach the formatter in UTC; convert them to the reader's time zone in the formatter.
 * An exception thrown by a formatter reaches the caller as it is.
 *
 * Error payloads keep machine text whatever the formatters are.
 *
 * @example
 * ```ts
 * const dates = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/London' });
 *
 * const scope = new FormulaScope({ format: { dateTime: (value) => dates.format(value.epochMilliseconds) } });
 *
 * scope.evaluate('"Due: " + due', { due: new Date('2024-07-28T14:35Z') });
 * // "Due: 28 July 2024 at 15:35"
 * ```
 */
export interface ValueFormat {
  readonly dateTime?: (value: Temporal.ZonedDateTime) => string;
  /** Without it, a date range is both ends joined by an arrow, each as the `dateTime` formatter gives it. */
  readonly dateRange?: (value: { readonly start: Temporal.ZonedDateTime; readonly end: Temporal.ZonedDateTime }) => string;
  readonly duration?: (value: Temporal.Duration) => string;
  readonly number?: (value: number) => string;
  readonly boolean?: (value: boolean) => string;
  readonly null?: (value: null) => string;
  /** Words for date patterns. */
  readonly names?: DateNames;
}

const NAME_COUNTS = [
  ['months', 12],
  ['monthsStandalone', 12],
  ['monthsShort', 12],
  ['weekdays', 7],
  ['weekdaysShort', 7],
  ['weekdaysMin', 7],
  ['dayPeriods', 2],
] as const satisfies readonly (readonly [keyof DateNames, number])[];

/**
 * Text of a value from the host's formatter, or `undefined` when the host has none for its kind.
 *
 * @throws {TypeError} When the formatter returns something other than text.
 */
export function formatWith<T>({ formatter, value, kind }: { formatter: ((value: T) => string) | undefined; value: T; kind: string }): string | undefined {
  if (!formatter) {
    return undefined;
  }

  const text: unknown = formatter(value);

  if (typeof text !== 'string') {
    throw new TypeError(`The ${kind} formatter returned ${typeof text} instead of text.`);
  }

  return text;
}

/**
 * Checks the name lists of a format up front, so a wrong list fails the call instead of leaving a gap in the text.
 *
 * @throws {TypeError} When a list holds a different number of names than its token needs.
 */
export function validateValueFormat(format: ValueFormat | undefined): void {
  const names = format?.names;

  if (!names) {
    return;
  }

  for (const [list, count] of NAME_COUNTS) {
    const length = names[list]?.length;

    if (length !== undefined && length !== count) {
      throw new TypeError(`format.names.${list} must hold ${count} names, not ${length}.`);
    }
  }
}
