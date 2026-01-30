import type { EvaluateOptions } from '../../expression';

import { Temporal } from 'temporal-polyfill';

import { evaluate } from '../../../testing-library';
import { FormulaDuration } from '../duration';
import { FormulaNumber } from '../number';
import { FormulaDate } from './FormulaDate';

describe('FormulaDate', () => {
  describe('Initialization', () => {
    describe('From Number', () => {
      it('should initialize from number', () => {
        const date = new Date('2024-07-28T12:34:56Z').getTime();
        const result = FormulaDate.from(date);

        expect(result).toBeInstanceOf(FormulaDate);
        if (result instanceof FormulaDate) {
          expect(result.value.equals(Temporal.ZonedDateTime.from({
            timeZone: 'UTC',
            year: 2024,
            month: 7,
            day: 28,
            hour: 12,
            minute: 34,
            second: 56,
          }))).toBe(true);
        }
      });
    });

    describe('From Date', () => {
      it('should initialize from Date instance', () => {
        const date = new Date('2024-07-28T12:34:56Z');
        const result = FormulaDate.from(date);

        expect(result).toBeInstanceOf(FormulaDate);
        if (result instanceof FormulaDate) {
          expect(result.value.equals(Temporal.ZonedDateTime.from({
            timeZone: 'UTC',
            year: 2024,
            month: 7,
            day: 28,
            hour: 12,
            minute: 34,
            second: 56,
          }))).toBe(true);
        }
      });

      it('should initialize from ISO 8601 string', () => {
        const date = '2024-07-28T12:34:56Z';
        const result = FormulaDate.from(date);

        expect(result).toBeInstanceOf(FormulaDate);
        if (result instanceof FormulaDate) {
          expect(result.value.equals(Temporal.ZonedDateTime.from({
            timeZone: 'UTC',
            year: 2024,
            month: 7,
            day: 28,
            hour: 12,
            minute: 34,
            second: 56,
          }))).toBe(true);
        }
      });

      it.each([
        '',
        'invalid-date',
        '2024-13-01',
        '2024-00-01',
      ])('should throw error if date string is invalid', (input) => {
        expect(() => FormulaDate.from(input)).toThrowError();
      });
    });

    describe('From Temporal.ZonedDateTime', () => {
      it('should initialize from Temporal.ZonedDateTime instance', () => {
        const date = Temporal.ZonedDateTime.from({
          year: 2024,
          month: 7,
          day: 28,
          hour: 12,
          minute: 34,
          second: 56,
          timeZone: 'UTC',
        });
        const result = FormulaDate.from(date);

        expect(result).toBeInstanceOf(FormulaDate);
        if (result instanceof FormulaDate) {
          expect(result.value.equals(date)).toBe(true);
        }
      });

      it('should initialize from RFC 9557 string without TZ', () => {
        const date = '2024-07-28T12:34:56+00:00';
        const result = FormulaDate.from(date);

        expect(result).toBeInstanceOf(FormulaDate);
        if (result instanceof FormulaDate) {
          expect(result.value.equals(Temporal.ZonedDateTime.from({
            timeZone: 'UTC',
            year: 2024,
            month: 7,
            day: 28,
            hour: 12,
            minute: 34,
            second: 56,
          }))).toBe(true);
        }
      });

      it('should initialize from RFC 9557 string with named TZ', () => {
        const date = '2024-07-28T12:34:56-07:00[America/Los_Angeles]';
        const result = FormulaDate.from(date);

        expect(result).toBeInstanceOf(FormulaDate);
        if (result instanceof FormulaDate) {
          expect(result.value.equals(Temporal.ZonedDateTime.from({
            timeZone: 'UTC',
            year: 2024,
            month: 7,
            day: 28,
            hour: 19,
            minute: 34,
            second: 56,
          }))).toBe(true);
        }
      });

      it('should initialize from RFC 9557 string with unnamed TZ', () => {
        const date = '2024-07-28T12:34:56+05:00';
        const result = FormulaDate.from(date);

        expect(result).toBeInstanceOf(FormulaDate);
        if (result instanceof FormulaDate) {
          expect(result.value.equals(Temporal.ZonedDateTime.from({
            timeZone: 'UTC',
            year: 2024,
            month: 7,
            day: 28,
            hour: 7,
            minute: 34,
            second: 56,
          }))).toBe(true);
        }
      });
    });
  });

  describe('Own Methods', () => {
    const contextOptions: EvaluateOptions = {
      context: {
        d: new FormulaDate(
          Temporal.ZonedDateTime.from({
            timeZone: 'UTC',
            year: 2024,
            month: 7,
            day: 28,
          }),
        ),
        duration: new FormulaDuration(Temporal.Duration.from({ years: 2, months: 5, days: 10, hours: 12, minutes: 30, seconds: 15 })),
      },
    };

    it('should return the year of the date', () => {
      const result = evaluate('d.year()', contextOptions);
      expect(result).toBeFormulaDataType(FormulaNumber, 2024);
    });

    it('should return the month of the date', () => {
      const result = evaluate('d.month()', contextOptions);
      expect(result).toBeFormulaDataType(FormulaNumber, 7);
    });

    it('should return the week of the date', () => {
      const result = evaluate('d.week()', contextOptions);
      expect(result).toBeFormulaDataType(FormulaNumber, 30);
    });

    it('should return the date of the date', () => {
      const result = evaluate('d.date()', contextOptions);
      expect(result).toBeFormulaDataType(FormulaNumber, 28);
    });

    it('should return the day of the date', () => {
      const result = evaluate('d.day()', contextOptions);
      expect(result).toBeFormulaDataType(FormulaNumber, 7);
    });

    it('should return an error when calling a method with arguments', () => {
      expect(() => evaluate('d.year(1)', contextOptions)).toThrowFormulaError(
        'Expected 0 argument(s).',
        [2, 6],
      );
    });

    describe('add', () => {
      const base = Temporal.ZonedDateTime.from('2025-06-01T10:00:00Z[UTC]');

      it('should add duration (FormulaDuration)', () => {
        const duration = Temporal.Duration.from({ weeks: 1 });
        const result = evaluate('d.add(w)', {
          context: {
            d: new FormulaDate(base),
            w: new FormulaDuration(duration),
          },
        });

        expect(result).toBeFormulaDataType(FormulaDate, base.add(duration));
      });

      it('should add duration (number + unit)', () => {
        const result = evaluate('d.add(2, "days")', {
          context: { d: new FormulaDate(base) },
        });

        expect(result).toBeFormulaDataType(FormulaDate, base.add({ days: 2 }));
      });

      it('should throw an error when provided duration and unit', () => {
        expect(() => evaluate('d.add(duration, "hours")', contextOptions)).toThrowFormulaError(
          'Expected type Number.',
          [6, 14],
        );
      });

      it('should throw an error when provided number without unit', () => {
        expect(() => evaluate('d.add(1)', contextOptions)).toThrowFormulaError(
          'Arguments don\'t match. Pattern 1: Expected type Duration.; Pattern 2: Expected at least 2 argument(s).',
          [2, 5],
        );
      });

      it('should throw an error when provided incorrect unit', () => {
        expect(() => evaluate('d.add(1, "minute")', contextOptions)).toThrowFormulaError(
          'Expected "years", "months", "weeks", "days", "hours", "minutes", "seconds".',
          [9, 17],
        );
      });
    });

    describe('subtract', () => {
      const base = Temporal.ZonedDateTime.from('2025-06-01T10:00:00Z[UTC]');

      it('should subtract duration (FormulaDuration)', () => {
        const duration = Temporal.Duration.from({ weeks: 1 });
        const result = evaluate('d.subtract(w)', {
          context: {
            d: new FormulaDate(base),
            w: new FormulaDuration(duration),
          },
        });

        expect(result).toBeFormulaDataType(FormulaDate, base.subtract(duration));
      });

      it('should subtract duration (number + unit)', () => {
        const result = evaluate('d.subtract(2, "days")', {
          context: { d: new FormulaDate(base) },
        });

        expect(result).toBeFormulaDataType(FormulaDate, base.subtract({ days: 2 }));
      });

      it('should throw an error when provided duration and unit', () => {
        expect(() => evaluate('d.subtract(duration, "hours")', contextOptions)).toThrowFormulaError(
          'Expected type Number.',
          [11, 19],
        );
      });

      it('should throw an error when provided number without unit', () => {
        expect(() => evaluate('d.subtract(1)', contextOptions)).toThrowFormulaError(
          'Arguments don\'t match. Pattern 1: Expected type Duration.; Pattern 2: Expected at least 2 argument(s).',
          [2, 10],
        );
      });

      it('should throw an error when provided incorrect unit', () => {
        expect(() => evaluate('d.subtract(1, "minute")', contextOptions)).toThrowFormulaError(
          'Expected "years", "months", "weeks", "days", "hours", "minutes", "seconds".',
          [14, 22],
        );
      });
    });

    describe('between', () => {
      it('should return 14 days duration if start date is before end date', () => {
        const start = Temporal.ZonedDateTime.from({ year: 2024, month: 7, day: 1, timeZone: 'UTC' });
        const end = Temporal.ZonedDateTime.from({ year: 2024, month: 7, day: 15, timeZone: 'UTC' });

        const context: EvaluateOptions = {
          context: {
            start: new FormulaDate(start),
            end: new FormulaDate(end),
          },
        };

        const result = evaluate('start.between(end, "days")', context);

        expect(result).toBeInstanceOf(FormulaDuration);
        if (result instanceof FormulaDuration) {
          expect(result.value.toString()).toBe('-P14D');
        }
      });

      it('should return 14 days duration if start date is after end date', () => {
        const start = Temporal.ZonedDateTime.from({ year: 2024, month: 7, day: 15, timeZone: 'UTC' });
        const end = Temporal.ZonedDateTime.from({ year: 2024, month: 7, day: 1, timeZone: 'UTC' });

        const context: EvaluateOptions = {
          context: {
            start: new FormulaDate(start),
            end: new FormulaDate(end),
          },
        };

        const result = evaluate('start.between(end, "days")', context);

        expect(result).toBeInstanceOf(FormulaDuration);
        if (result instanceof FormulaDuration) {
          expect(result.value.toString()).toBe('P14D');
        }
      });
    });
  });
});
