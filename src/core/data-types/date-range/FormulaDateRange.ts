import type { ToStringOptions } from '../FormulaDataType';

import { formatWith } from '../../value-format';
import { FormulaDate } from '../date';
import { FormulaDateTime } from '../date-time';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

/**
 * The two ends of a date range: both days, or both dates and times in UTC; `start` never comes after `end`.
 *
 * @remarks
 * A range of days covers each of its days whole, so a day is in it however the day is spelled.
 */
export type DateRangeBounds
  = { readonly start: Temporal.PlainDate; readonly end: Temporal.PlainDate }
    | { readonly start: Temporal.ZonedDateTime; readonly end: Temporal.ZonedDateTime };

/** An end of a date range: a `Temporal.PlainDate` or text of a day, or a value `FormulaDateTime.from` reads. */
type DateRangeEnd = Temporal.PlainDate | Parameters<typeof FormulaDateTime.from>[0];

/** A date range a formula computes: `value` holds its `start` and `end`, both days or both dates and times. */
export class FormulaDateRange extends FormulaDataType<DateRangeBounds, typeof Kind.DateRange> {
  static readonly kind = Kind.DateRange;

  constructor(value: DateRangeBounds) {
    super(Kind.DateRange, value, 'Date range');
  }

  isEmpty(): boolean {
    return false;
  }

  /** Formats both ends the way a date formats, joined by an arrow, unless the host formats date ranges itself. */
  toString(options?: ToStringOptions): string {
    const text = formatWith({ formatter: options?.format?.dateRange, value: this.value, kind: 'date range' });

    if (text !== undefined) {
      return text;
    }

    const { start, end } = this.value;

    return `${rangeEnd(start).toString(options)} → ${rangeEnd(end).toString(options)}`;
  }

  /** The start of the range as a formula value: a date or a date and time. */
  get start(): FormulaDate | FormulaDateTime {
    return rangeEnd(this.value.start);
  }

  /** The end of the range as a formula value: a date or a date and time. */
  get end(): FormulaDate | FormulaDateTime {
    return rangeEnd(this.value.end);
  }

  /**
   * Creates a date range from its two ends: two days, given as `Temporal.PlainDate` or as text without a time, or two
   * values `FormulaDateTime.from` reads.
   *
   * @throws {RangeError} When an end holds no date, one end is a day and the other is not, or the end comes before the start.
   */
  static from({ start, end }: { readonly start: DateRangeEnd; readonly end: DateRangeEnd }): FormulaDateRange {
    const startDate = readEnd(start);
    const endDate = readEnd(end);

    if (startDate instanceof Temporal.PlainDate && endDate instanceof Temporal.PlainDate) {
      if (Temporal.PlainDate.compare(startDate, endDate) > 0) {
        throw new RangeError(`Cannot create a date range that ends on ${endDate.toString()}, before its start on ${startDate.toString()}.`);
      }

      return new FormulaDateRange({ start: startDate, end: endDate });
    }

    if (startDate instanceof Temporal.ZonedDateTime && endDate instanceof Temporal.ZonedDateTime) {
      if (Temporal.ZonedDateTime.compare(startDate, endDate) > 0) {
        throw new RangeError(`Cannot create a date range that ends at ${endDate.toInstant().toString()}, before its start at ${startDate.toInstant().toString()}.`);
      }

      return new FormulaDateRange({ start: startDate, end: endDate });
    }

    throw new RangeError('Cannot create a date range from a date and a date and time; both ends must be of one kind.');
  }
}

function rangeEnd(end: Temporal.PlainDate | Temporal.ZonedDateTime): FormulaDate | FormulaDateTime {
  return end instanceof Temporal.PlainDate ? new FormulaDate(end) : new FormulaDateTime(end);
}

function readEnd(end: DateRangeEnd): Temporal.PlainDate | Temporal.ZonedDateTime {
  if (end instanceof Temporal.PlainDate || (typeof end === 'string' && FormulaDate.isDayText(end))) {
    return FormulaDate.from(end).value;
  }

  return FormulaDateTime.from(end).value;
}
