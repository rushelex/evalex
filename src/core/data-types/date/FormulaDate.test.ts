import { fc, it } from '@fast-check/vitest';
import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from './FormulaDate';

// Date and time text without an offset, from a whole day down to milliseconds, with either separator.
const textWithoutOffset = fc.record({
  date: fc.date({ min: new Date('1900-01-01T00:00:00Z'), max: new Date('2100-01-01T00:00:00Z'), noInvalidDate: true }),
  length: fc.constantFrom(10, 13, 16, 19, 23),
  separator: fc.constantFrom('T', ' '),
}).map(({ date, length, separator }) => {
  const iso = date.toISOString().slice(0, length);

  return {
    text: iso.replace('T', separator),
    inUTC: length === 10 ? `${iso}T00:00Z` : `${iso}Z`,
  };
});

describe('FormulaDate', () => {
  describe('on a machine far from UTC', () => {
    beforeAll(() => {
      vi.stubEnv('TZ', 'Pacific/Kiritimati');
    });

    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it.prop([textWithoutOffset])('should read date text without an offset as UTC', ({ text, inUTC }) => {
      expect(FormulaDate.from(text).value.equals(FormulaDate.from(inUTC).value)).toBe(true);
    });

    it.each([
      { text: '2024-07', inUTC: '2024-07-01T00:00Z' },
      { text: '2024', inUTC: '2024-01-01T00:00Z' },
    ])('should read the ISO 8601 date $text as its first moment in UTC', ({ text, inUTC }) => {
      expect(FormulaDate.from(text).value.equals(FormulaDate.from(inUTC).value)).toBe(true);
    });

    it.each(['July 28, 2024', '2024/07/28'])('should reject the date text $0, which is not ISO 8601', (text) => {
      expect(() => FormulaDate.from(text)).toThrowError(new RangeError(`Cannot create a date from the text "${text}".`));
    });
  });

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
