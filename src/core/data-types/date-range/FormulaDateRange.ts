import type { ToStringOptions } from '../FormulaDataType';

import { formatWith } from '../../value-format';
import { FormulaDateTime } from '../date-time';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

/** The two ends of a date range, both in UTC; `start` never comes after `end`. */
interface DateRangeBounds {
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
}

/** A date or a value `FormulaDateTime.from` reads as one. */
type DateInput = Parameters<typeof FormulaDateTime.from>[0];

/** A date range a formula computes: `value` holds its `start` and `end` as `Temporal.ZonedDateTime` in UTC. */
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

    return `${new FormulaDateTime(start).toString(options)} → ${new FormulaDateTime(end).toString(options)}`;
  }

  /**
   * Creates a date range from its two ends, each given as anything `FormulaDateTime.from` accepts.
   *
   * @throws {RangeError} When an end holds no date, or the end comes before the start.
   */
  static from({ start, end }: { readonly start: DateInput; readonly end: DateInput }): FormulaDateRange {
    const startDate = FormulaDateTime.from(start).value;
    const endDate = FormulaDateTime.from(end).value;

    if (Temporal.ZonedDateTime.compare(startDate, endDate) > 0) {
      throw new RangeError(`Cannot create a date range that ends at ${endDate.toInstant().toString()}, before its start at ${startDate.toInstant().toString()}.`);
    }

    return new FormulaDateRange({ start: startDate, end: endDate });
  }
}
