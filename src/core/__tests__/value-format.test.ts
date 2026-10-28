import type { ValueFormat } from '../value-format';

import { fc, it } from '@fast-check/vitest';

import { evaluate, formulaValueArbitrary } from '../../testing-library';
import { FormulaArray, FormulaBoolean, FormulaDateRange, FormulaDateTime, FormulaDuration, FormulaNull, FormulaNumber, FormulaObject, FormulaString } from '../data-types';
import { Errors } from '../errors';

const RUSSIAN_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const RUSSIAN_STANDALONE_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

const RUSSIAN_WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

const date = FormulaDateTime.from('2024-07-28T14:35:00Z');

describe('evaluate with format', () => {
  describe('text of a value', () => {
    it.prop([fc.double({ noNaN: true, noDefaultInfinity: true }).map((value) => new FormulaNumber(value))])('should take the text of a number from the number formatter', (value) => {
      const format: ValueFormat = { number: (number) => `<${number}>` };

      expect(evaluate('"x" + value', { context: { value }, format })).toBeFormulaDataType(FormulaString, `x<${value.value}>`);
    });

    it.prop([formulaValueArbitrary()])('should give the same text as without format when the format has no formatters', (value) => {
      const withoutFormat = evaluate('"x" + value', { context: { value } });

      expect(evaluate('"x" + value', { context: { value }, format: {} })).toBeFormulaDataType(FormulaString, withoutFormat.value);
    });

    it.each([
      { kind: 'a date', value: date, format: { dateTime: (value: Temporal.ZonedDateTime) => `day ${value.day}` }, text: 'xday 28' },
      { kind: 'a date range', value: FormulaDateRange.from({ start: '2024-07-28', end: '2024-08-01' }), format: { dateRange: ({ start, end }: { start: Temporal.ZonedDateTime; end: Temporal.ZonedDateTime }) => `${start.day}–${end.day}` }, text: 'x28–1' },
      { kind: 'a duration', value: FormulaDuration.from(Temporal.Duration.from({ hours: 3 })), format: { duration: (value: Temporal.Duration) => `${value.hours} h` }, text: 'x3 h' },
      { kind: 'a number', value: new FormulaNumber(1234.5), format: { number: (value: number) => value.toFixed(2) }, text: 'x1234.50' },
      { kind: 'a boolean', value: FormulaBoolean.from(true), format: { boolean: (value: boolean) => (value ? 'yes' : 'no') }, text: 'xyes' },
      { kind: 'null', value: FormulaNull.instance(), format: { null: () => '—' }, text: 'x—' },
    ])('should take the text of $kind from its formatter', ({ value, format, text }) => {
      expect(evaluate('"x" + value', { context: { value }, format })).toBeFormulaDataType(FormulaString, text);
    });

    it('should keep the text of a kind without a formatter', () => {
      const format: ValueFormat = { dateTime: () => 'a date' };

      expect(evaluate('"x" + value', { context: { value: new FormulaNumber(1.5) }, format })).toBeFormulaDataType(FormulaString, 'x1.5');
    });

    it('should hand the date to its formatter in UTC', () => {
      const format: ValueFormat = { dateTime: (value) => `${value.timeZoneId} ${value.hour}` };

      expect(evaluate('"" + value', { context: { value: FormulaDateTime.from('2024-07-28T14:35+03:00') }, format })).toBeFormulaDataType(FormulaString, 'UTC 11');
    });

    it('should build a date range from the date formatter when the range has none', () => {
      const format: ValueFormat = { dateTime: (value) => `${value.month}/${value.day}` };

      expect(evaluate('"" + value', { context: { value: FormulaDateRange.from({ start: '2024-07-28', end: '2024-08-01' }) }, format })).toBeFormulaDataType(FormulaString, '7/28 → 8/1');
    });

    it.each([
      { place: 'format()', formula: 'value.format()' },
      { place: 'join', formula: '[value, value].join(" and ")' },
    ])('should take the text from the formatter in $place', ({ formula }) => {
      const format: ValueFormat = { dateTime: () => 'today' };

      expect(evaluate(formula, { context: { value: date }, format })).toBeFormulaDataType(FormulaString, formula.includes('join') ? 'today and today' : 'today');
    });

    it.each([
      { container: 'a list', value: FormulaArray.from([date, 2]), text: 'xtoday, #2' },
      { container: 'an object', value: FormulaObject.from({ due: date, count: 2 }), text: 'x{ due: today, count: #2 }' },
    ])('should take the text of values inside $container from their formatters', ({ value, text }) => {
      const format: ValueFormat = { dateTime: () => 'today', number: (number) => `#${number}` };

      expect(evaluate('"x" + value', { context: { value }, format })).toBeFormulaDataType(FormulaString, text);
    });

    it('should keep the pattern of format() over the date formatter', () => {
      const format: ValueFormat = { dateTime: () => 'today' };

      expect(evaluate('value.format("YYYY")', { context: { value: date }, format })).toBeFormulaDataType(FormulaString, '2024');
    });

    it('should keep machine text in the payload of a date error', () => {
      const format: ValueFormat = { dateTime: () => 'today' };

      expect(() => evaluate('value.add(300000, "years")', { context: { value: date }, format })).toThrowError(
        expect.objectContaining({ code: Errors.Arithmetic.DateOutOfRange.code, payload: { value: '2024-07-28T14:35:00Z' } }),
      );
    });

    it('should let an exception of the formatter through as it is', () => {
      const failure = new RangeError('host failure');
      const format: ValueFormat = {
        dateTime: () => {
          throw failure;
        },
      };

      expect(() => evaluate('"" + value', { context: { value: date }, format })).toThrowError(failure);
    });

    it('should throw a TypeError when the formatter returns something other than text', () => {
      const format = { number: () => 42 };

      // @ts-expect-error -- a formatter written without types can return a number
      expect(() => evaluate('"" + 1', { format })).toThrowError(new TypeError('The number formatter returned number instead of text.'));
    });
  });

  describe('names in date patterns', () => {
    it.each([
      { token: 'MMMM', names: { months: RUSSIAN_MONTHS }, text: 'июля' },
      { token: 'MMM', names: { monthsShort: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'] }, text: 'июл.' },
      { token: 'LLLL', names: { monthsStandalone: RUSSIAN_STANDALONE_MONTHS }, text: 'июль' },
      { token: 'dddd', names: { weekdays: RUSSIAN_WEEKDAYS }, text: 'воскресенье' },
      { token: 'ddd', names: { weekdaysShort: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'] }, text: 'вс' },
      { token: 'dd', names: { weekdaysMin: ['В', 'П', 'В', 'С', 'Ч', 'П', 'С'] }, text: 'В' },
      { token: 'A', names: { dayPeriods: ['ДП', 'ПП'] as const }, text: 'ПП' },
      { token: 'a', names: { dayPeriods: ['ДП', 'ПП'] as const }, text: 'пп' },
      { token: 'Do', names: { ordinal: (day: number) => `${day}-е` }, text: '28-е' },
    ])('should take $token from the names of the format', ({ token, names, text }) => {
      expect(evaluate('formatDate(value, pattern)', { context: { value: date, pattern: new FormulaString(token) }, format: { names } })).toBeFormulaDataType(FormulaString, text);
    });

    it('should use the names in format() with a pattern as well', () => {
      expect(evaluate('value.format("D MMMM YYYY")', { context: { value: date }, format: { names: { months: RUSSIAN_MONTHS } } })).toBeFormulaDataType(FormulaString, '28 июля 2024');
    });

    it('should keep English for every name the format leaves out', () => {
      expect(evaluate('formatDate(value, "dddd, MMMM D")', { context: { value: date }, format: { names: { months: RUSSIAN_MONTHS } } })).toBeFormulaDataType(FormulaString, 'Sunday, июля 28');
    });

    it.each([
      { source: 'the months', names: { months: RUSSIAN_MONTHS }, text: 'июля 2024' },
      { source: 'English', names: {}, text: 'July 2024' },
    ])('should take a standalone month from $source when the format has no standalone names', ({ names, text }) => {
      expect(evaluate('formatDate(value, "LLLL YYYY")', { context: { value: date }, format: { names } })).toBeFormulaDataType(FormulaString, text);
    });

    it.each([
      { list: 'months', names: { months: RUSSIAN_MONTHS.slice(1) }, message: 'format.names.months must hold 12 names, not 11.' },
      { list: 'weekdays', names: { weekdays: [...RUSSIAN_WEEKDAYS, 'extra'] }, message: 'format.names.weekdays must hold 7 names, not 8.' },
    ])('should throw a TypeError for a list of $list of the wrong length', ({ names, message }) => {
      expect(() => evaluate('1', { format: { names } })).toThrowError(new TypeError(message));
    });
  });
});
