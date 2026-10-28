import type { ToStringOptions } from '../FormulaDataType';

import { DEFAULT_TIME_ZONE } from '../../time-zone';
import { formatWith } from '../../value-format';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

const YEAR = /^[+-]?\d{4,6}$/;

// ISO 8601 and RFC 9557 forms, from the most specific; `Date` parsing is left out because it reads text without an offset in the host time zone
const TEXT_PARSERS: readonly ((text: string, timeZone: string) => Temporal.ZonedDateTime)[] = [
  (text) => Temporal.ZonedDateTime.from(text),
  (text) => Temporal.Instant.from(text).toZonedDateTimeISO('UTC'),
  (text, timeZone) => Temporal.PlainDateTime.from(text).toZonedDateTime(timeZone),
  (text, timeZone) => Temporal.PlainYearMonth.from(YEAR.test(text) ? `${text}-01` : text).toPlainDate({ day: 1 }).toZonedDateTime(timeZone),
];

/** A date a formula computes: `value` holds its instant as a `Temporal.ZonedDateTime` in UTC. */
export class FormulaDateTime extends FormulaDataType<Temporal.ZonedDateTime, typeof Kind.DateTime> {
  static readonly kind = Kind.DateTime;

  constructor(value: Temporal.ZonedDateTime) {
    super(Kind.DateTime, value, 'Date and time');
  }

  isEmpty(): boolean {
    return false;
  }

  /** Formats the date as an ISO 8601 instant in UTC, so the text never depends on the host locale, unless the host formats dates itself. */
  toString(options?: ToStringOptions): string {
    return formatWith({ formatter: options?.format?.dateTime, value: this.value, kind: 'date and time' }) ?? this.value.toInstant().toString();
  }

  /**
   * Creates a date from text, a timestamp in milliseconds, a `Date` or a `Temporal.ZonedDateTime`.
   *
   * @param date - The value to read.
   * @param options - How to read the value.
   * @param options.timeZone - The zone text without an offset is read in, UTC when left out.
   * @throws {RangeError} When the value holds no date: unreadable text, an invalid `Date` or a timestamp out of range.
   */
  static from(date: string | number | Date | Temporal.ZonedDateTime, options: { readonly timeZone?: string } = {}): FormulaDateTime {
    const { timeZone = DEFAULT_TIME_ZONE } = options;

    if (typeof date === 'number') {
      const jsDate = new Date(date);

      if (Number.isNaN(jsDate.getTime())) {
        throw new RangeError(`Cannot create a date from the timestamp ${date}.`);
      }

      return FormulaDateTime.#fromJSDate(jsDate);
    }

    if (date instanceof Date) {
      if (Number.isNaN(date.getTime())) {
        throw new RangeError('Cannot create a date from an invalid Date.');
      }

      return FormulaDateTime.#fromJSDate(date);
    }

    if (date instanceof Temporal.ZonedDateTime) {
      return FormulaDateTime.#fromZonedDateTime(date);
    }

    for (const parse of TEXT_PARSERS) {
      try {
        return FormulaDateTime.#fromZonedDateTime(parse(date, timeZone));
      }
      catch { /* ignore and try next parser */ }
    }

    throw new RangeError(`Cannot create a date from the text "${date}".`);
  }

  static isValidInput(date: unknown): date is string | number | Date | Temporal.ZonedDateTime {
    return typeof date === 'string'
      || typeof date === 'number'
      || date instanceof Date
      || date instanceof Temporal.ZonedDateTime;
  }

  static #fromJSDate(date: Date) {
    return new FormulaDateTime(
      Temporal.ZonedDateTime.from({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
        millisecond: date.getUTCMilliseconds(),
        timeZone: 'UTC',
      }),
    );
  }

  static #fromZonedDateTime(value: Temporal.ZonedDateTime) {
    return new FormulaDateTime(value.withTimeZone('UTC'));
  }
}
