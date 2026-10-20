import type { ToStringOptions } from '../FormulaDataType';

import { Temporal } from 'temporal-polyfill';

import { formatWith } from '../../value-format';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

const YEAR = /^[+-]?\d{4,6}$/;

// ISO 8601 and RFC 9557 forms, from the most specific; `Date` parsing is left out because it reads text without an offset in the host time zone
const TEXT_PARSERS: readonly ((text: string) => Temporal.ZonedDateTime)[] = [
  (text) => Temporal.ZonedDateTime.from(text),
  (text) => Temporal.Instant.from(text).toZonedDateTimeISO('UTC'),
  (text) => Temporal.PlainDateTime.from(text).toZonedDateTime('UTC'),
  (text) => Temporal.PlainYearMonth.from(YEAR.test(text) ? `${text}-01` : text).toPlainDate({ day: 1 }).toZonedDateTime('UTC'),
];

export class FormulaDate extends FormulaDataType<Temporal.ZonedDateTime, typeof Kind.Date> {
  static readonly kind = Kind.Date;

  constructor(value: Temporal.ZonedDateTime) {
    super(Kind.Date, value, 'Date');
  }

  isEmpty(): boolean {
    return false;
  }

  /** Formats the date as an ISO 8601 instant in UTC, so the text never depends on the host locale, unless the host formats dates itself. */
  toString(options?: ToStringOptions): string {
    return formatWith({ formatter: options?.format?.date, value: this.value, kind: 'date' }) ?? this.value.toInstant().toString();
  }

  /**
   * Creates a date from text, a timestamp in milliseconds, a `Date` or a `Temporal.ZonedDateTime`.
   *
   * @throws {RangeError} When the value holds no date: unreadable text, an invalid `Date` or a timestamp out of range.
   */
  static from(date: string | number | Date | Temporal.ZonedDateTime): FormulaDate {
    if (typeof date === 'number') {
      const jsDate = new Date(date);

      if (Number.isNaN(jsDate.getTime())) {
        throw new RangeError(`Cannot create a date from the timestamp ${date}.`);
      }

      return FormulaDate.#fromJSDate(jsDate);
    }

    if (date instanceof Date) {
      if (Number.isNaN(date.getTime())) {
        throw new RangeError('Cannot create a date from an invalid Date.');
      }

      return FormulaDate.#fromJSDate(date);
    }

    if (date instanceof Temporal.ZonedDateTime) {
      return FormulaDate.#fromZonedDateTime(date);
    }

    for (const parse of TEXT_PARSERS) {
      try {
        return FormulaDate.#fromZonedDateTime(parse(date));
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
    return new FormulaDate(
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
    return new FormulaDate(value.withTimeZone('UTC'));
  }
}
