import { Temporal } from 'temporal-polyfill';

import { FormulaDataType } from '../FormulaDataType';

export class FormulaDate extends FormulaDataType<Temporal.ZonedDateTime> {
  static readonly kind = 'date';

  constructor(value: Temporal.ZonedDateTime) {
    super('date', value, 'Date');
  }

  public isEmpty(): boolean {
    return false;
  }

  public toString(): string {
    return this.value.toLocaleString();
  }

  public static from(date: string | number | Date | Temporal.ZonedDateTime): FormulaDate {
    if (typeof date === 'number') {
      return FormulaDate.fromJSDate(new Date(date));
    }

    if (date instanceof Date) {
      return FormulaDate.fromJSDate(date);
    }

    if (date instanceof Temporal.ZonedDateTime) {
      return FormulaDate.fromZonedDateTime(date);
    }

    const parsers: (() => FormulaDate)[] = [
      () => {
        const jsDate = new Date(date);

        if (Number.isNaN(jsDate.getTime())) {
          throw new TypeError('Invalid JS Date');
        }

        return FormulaDate.fromJSDate(jsDate);
      },
      () => {
        return FormulaDate.fromZonedDateTime(Temporal.ZonedDateTime.from(date));
      },
    ];

    for (const parse of parsers) {
      try {
        return parse();
      }
      catch { /* ignore and try next parser */ }
    }

    throw new TypeError(`Failed to parse date string: "${date}"`);
  }

  public static isValidInput(date: unknown): date is string | number | Date | Temporal.ZonedDateTime {
    return typeof date === 'string'
      || typeof date === 'number'
      || date instanceof Date
      || date instanceof Temporal.ZonedDateTime;
  }

  private static fromJSDate(date: Date) {
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

  private static fromZonedDateTime(value: Temporal.ZonedDateTime) {
    return new FormulaDate(value.withTimeZone('UTC'));
  }
}
