import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../date';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

/** The two ends of a date range, both in UTC; `start` never comes after `end`. */
interface DateRangeBounds {
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
}

/** A date or a value `FormulaDate.from` reads as one. */
type DateInput = Parameters<typeof FormulaDate.from>[0];

export class FormulaDateRange extends FormulaDataType<DateRangeBounds> {
  static readonly kind = Kind.DateRange;

  constructor(value: DateRangeBounds) {
    super(Kind.DateRange, value, 'Date range');
  }

  isEmpty(): boolean {
    return false;
  }

  /** Formats both ends as ISO 8601 instants in UTC, joined by an arrow. */
  toString(): string {
    return `${this.value.start.toInstant().toString()} → ${this.value.end.toInstant().toString()}`;
  }

  /**
   * Creates a date range from its two ends, each given as anything `FormulaDate.from` accepts.
   *
   * @throws {RangeError} When an end holds no date, or the end comes before the start.
   */
  static from({ start, end }: { readonly start: DateInput; readonly end: DateInput }): FormulaDateRange {
    const startDate = FormulaDate.from(start).value;
    const endDate = FormulaDate.from(end).value;

    if (Temporal.ZonedDateTime.compare(startDate, endDate) > 0) {
      throw new RangeError(`Cannot create a date range that ends at ${endDate.toInstant().toString()}, before its start at ${startDate.toInstant().toString()}.`);
    }

    return new FormulaDateRange({ start: startDate, end: endDate });
  }
}
