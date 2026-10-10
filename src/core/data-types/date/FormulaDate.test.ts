import { Temporal } from 'temporal-polyfill';

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

    describe('From a value that holds no date', () => {
      it.each([
        { input: new Date(Number.NaN), message: 'Cannot create a date from an invalid Date.' },
        { input: Number.NaN, message: 'Cannot create a date from the timestamp NaN.' },
        { input: Number.POSITIVE_INFINITY, message: 'Cannot create a date from the timestamp Infinity.' },
        { input: 1e20, message: 'Cannot create a date from the timestamp 100000000000000000000.' },
        { input: 'garbage', message: 'Cannot create a date from the text "garbage".' },
      ])('should throw a RangeError naming $input', ({ input, message }) => {
        expect(() => FormulaDate.from(input)).toThrowError(new RangeError(message));
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

  describe('toString', () => {
    it('should format the date as an ISO 8601 instant in UTC', () => {
      expect(FormulaDate.from('2024-07-28T12:34:56+03:00').toString()).toBe('2024-07-28T09:34:56Z');
    });

    it('should keep milliseconds when the date has them', () => {
      expect(FormulaDate.from('2024-07-28T12:34:56.789Z').toString()).toBe('2024-07-28T12:34:56.789Z');
    });
  });
});
