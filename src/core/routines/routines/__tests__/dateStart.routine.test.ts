import { fc, it } from '@fast-check/vitest';

import { evaluate, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaDate, FormulaDateRange, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

// Every instant a date can hold, as Unix milliseconds
const instant = fc.integer({ min: -8_640_000_000_000_000, max: 8_640_000_000_000_000 });

const range = fc.tuple(instant, instant).map((milliseconds) => {
  const [start, end] = milliseconds.toSorted((a, b) => a - b);

  return FormulaDateRange.from({ start, end });
});

const tester = new RoutineTester('dateStart');

describe('dateStart routine', () => {
  it.prop([range])('should give back the start of a range', (value) => {
    expect(evaluate('dateStart(range)', { context: { range: value } })).toBeFormulaDataType(FormulaDate, value.value.start);
  });

  it.prop([formulaValueArbitrary(Kind.Date)])('should give back a date as its own start', (date) => {
    expect(evaluate('date.start()', { context: { date } })).toBeFormulaDataType(FormulaDate, date.value);
  });

  describe('examples', tester.examples([
    {
      formula: 'dateRange(parseDate("2022-09-07T10:00Z"), parseDate("2022-09-07T18:30Z")).dateStart()',
      expected: FormulaDate.from('2022-09-07T10:00Z'),
    },
  ]));
});
