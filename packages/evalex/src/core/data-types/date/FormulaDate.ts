import type { ToStringOptions } from '../FormulaDataType';

import { formatWith } from '../../value-format';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

const YEAR = /^[+-]?\d{4,6}$/;

// A date and a time are separated by `T` or a space, so text without either names a day
const TIME_SEPARATOR = /[\sT]/i;

/** A day a formula computes, without a time or a time zone: `value` holds it as a `Temporal.PlainDate`. */
export class FormulaDate extends FormulaDataType<Temporal.PlainDate, typeof Kind.Date> {
  static readonly kind = Kind.Date;

  constructor(value: Temporal.PlainDate) {
    super(Kind.Date, value, 'Date');
  }

  isEmpty(): boolean {
    return false;
  }

  /** Formats the day as an ISO 8601 date, such as `2024-07-28`, unless the host formats dates itself. */
  toString(options?: ToStringOptions): string {
    return formatWith({ formatter: options?.format?.date, value: this.value, kind: 'date' }) ?? this.value.toString();
  }

  /**
   * Creates a day from a `Temporal.PlainDate` or from ISO 8601 text without a time: a date, a month or a year, which
   * stand for their first day.
   *
   * @throws {RangeError} When the text holds a time or no date.
   */
  static from(date: string | Temporal.PlainDate): FormulaDate {
    if (date instanceof Temporal.PlainDate) {
      return new FormulaDate(date);
    }

    const day = TIME_SEPARATOR.test(date) ? undefined : readDay(date);

    if (!day) {
      throw new RangeError(`Cannot create a date without a time from the text "${date}".`);
    }

    return new FormulaDate(day);
  }

  /** Tells whether `text` is ISO 8601 text of a day without a time, which `FormulaDate.from` reads. */
  static isDayText(text: string): boolean {
    return !TIME_SEPARATOR.test(text) && readDay(text) !== undefined;
  }
}

function readDay(text: string): Temporal.PlainDate | undefined {
  try {
    return Temporal.PlainDate.from(text);
  }
  catch { /* not a full date, try a month */ }

  try {
    return Temporal.PlainYearMonth.from(YEAR.test(text) ? `${text}-01` : text).toPlainDate({ day: 1 });
  }
  catch {
    return undefined;
  }
}
