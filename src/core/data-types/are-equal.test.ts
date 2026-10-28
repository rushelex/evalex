import { areEqual } from './are-equal';
import { FormulaArray } from './array';
import { FormulaBoolean } from './boolean';
import { FormulaDateRange } from './date-range';
import { FormulaDateTime } from './date-time';
import { FormulaDuration } from './duration';
import { FormulaNull } from './null';
import { FormulaNumber } from './number';
import { FormulaObject } from './object';
import { FormulaRegExp } from './regexp';
import { FormulaString } from './string';

const list = (...items: number[]): FormulaArray => new FormulaArray(items.map((item) => new FormulaNumber(item)));
const date = (isoString: string): FormulaDateTime => FormulaDateTime.from(isoString);
const range = (start: string, end: string): FormulaDateRange => FormulaDateRange.from({ start, end });
const duration = (isoString: string): FormulaDuration => new FormulaDuration(Temporal.Duration.from(isoString));

describe(areEqual, () => {
  it.each([
    { name: 'numbers', a: new FormulaNumber(1), b: new FormulaNumber(1) },
    { name: 'texts', a: new FormulaString('a'), b: new FormulaString('a') },
    { name: 'booleans', a: new FormulaBoolean(true), b: new FormulaBoolean(true) },
    { name: 'nulls', a: new FormulaNull(), b: new FormulaNull() },
    { name: 'lists', a: new FormulaArray([list(1, 2), new FormulaString('a')]), b: new FormulaArray([list(1, 2), new FormulaString('a')]) },
    { name: 'dates', a: date('2024-07-28T12:00:00Z'), b: date('2024-07-28T15:00:00+03:00') },
    { name: 'date ranges', a: range('2024-07-28T12:00Z', '2024-07-29T12:00Z'), b: range('2024-07-28T15:00+03:00', '2024-07-29T15:00+03:00') },
    { name: 'durations', a: duration('P1DT2H'), b: duration('P1DT2H') },
    { name: 'regexps', a: new FormulaRegExp('a+', 'gi'), b: new FormulaRegExp('a+', 'gi') },
    { name: 'objects', a: FormulaObject.from({ a: 1, b: [2] }), b: FormulaObject.from({ b: [2], a: 1 }) },
  ])('should treat $name with the same content as equal', ({ a, b }) => {
    expect(areEqual(a, b)).toBe(true);
  });

  it.each([
    { name: 'a number and a text', a: new FormulaNumber(1), b: new FormulaString('1') },
    { name: 'lists of different length', a: list(1, 2), b: list(1, 2, 3) },
    { name: 'lists in different order', a: list(1, 2), b: list(2, 1) },
    { name: 'different instants', a: date('2024-07-28T12:00:00Z'), b: date('2024-07-28T12:00:01Z') },
    { name: 'date ranges with different starts', a: range('2024-07-27', '2024-07-29'), b: range('2024-07-28', '2024-07-29') },
    { name: 'date ranges with different ends', a: range('2024-07-28', '2024-07-29'), b: range('2024-07-28', '2024-07-30') },
    { name: 'a date range and its start', a: range('2024-07-28', '2024-07-28'), b: date('2024-07-28') },
    { name: 'durations with different fields', a: duration('P1D'), b: duration('PT24H') },
    { name: 'regexps with different flags', a: new FormulaRegExp('a', 'g'), b: new FormulaRegExp('a', 'i') },
    { name: 'objects with different keys', a: FormulaObject.from({ a: 1 }), b: FormulaObject.from({ a: 1, b: 2 }) },
    { name: 'NaN and NaN', a: new FormulaNumber(Number.NaN), b: new FormulaNumber(Number.NaN) },
  ])('should treat $name as different', ({ a, b }) => {
    expect(areEqual(a, b)).toBe(false);
  });
});
