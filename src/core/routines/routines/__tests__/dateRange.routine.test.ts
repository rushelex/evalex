import { fc, it } from '@fast-check/vitest';

import { evaluate } from '../../../../testing-library';
import { FormulaBoolean, FormulaDate, FormulaDateRange } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('dateRange');

// Every instant a date can hold, as Unix milliseconds
const instant = fc.integer({ min: -8_640_000_000_000_000, max: 8_640_000_000_000_000 });

const orderedDates = fc.tuple(instant, instant).map((milliseconds) => milliseconds.toSorted((a, b) => a - b).map((value) => FormulaDate.from(value)));

describe('dateRange routine', () => {
  it.prop([orderedDates])('should span from the start date to an end date that is not before it', ([start, end]) => {
    expect(evaluate('dateRange(start, end)', { context: { start, end } })).toBeFormulaDataType(FormulaDateRange, { start: start.value, end: end.value });
  });

  it.prop([orderedDates.filter(([start, end]) => !start.value.equals(end.value))])('should reject an end date before the start date', ([start, end]) => {
    expect(() => evaluate('dateRange(end, start)', { context: { start, end } })).toThrow('Expected an end date that is not before the start date. [15,20]');
  });

  it('should treat ranges with the same ends as equal', () => {
    expect(evaluate('dateRange(parseDate("2022-09-07"), parseDate("2023-09-07")) == parseDate("2022-09-07").range(parseDate("2023-09-07"))')).toBeFormulaDataType(FormulaBoolean, true);
  });

  it('should not order date ranges', () => {
    expect(() => evaluate('dateRange(today(), today()) < dateRange(today(), today())')).toThrow('Types must match for comparison');
  });

  it('should not move a date range by a duration', () => {
    expect(() => evaluate('dateAdd(dateRange(today(), today()), 1, "days")')).toThrow('Expected type Date. [8,35]');
  });

  describe('examples', tester.examples([
    {
      formula: 'parseDate("2023-09-07").range(parseDate("2023-09-07"))',
      expected: FormulaDateRange.from({ start: '2023-09-07', end: '2023-09-07' }),
    },
    {
      formula: 'parseDate("2023-09-07T12:00Z").dateRange(parseDate("2023-09-07T11:59Z"))',
      expected: {
        function: { message: 'Expected an end date that is not before the start date.', location: [42, 72] },
        method: { message: 'Expected an end date that is not before the start date.', location: [41, 71] },
      },
    },
  ]));
});
