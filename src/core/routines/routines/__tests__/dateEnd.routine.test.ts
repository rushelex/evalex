import { fc, it } from '@fast-check/vitest';

import { evaluate, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaDateRange, FormulaDateTime, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

// Every instant a date can hold, as Unix milliseconds
const instant = fc.integer({ min: -8_640_000_000_000_000, max: 8_640_000_000_000_000 });

const range = fc.tuple(instant, instant).map((milliseconds) => {
  const [start, end] = milliseconds.toSorted((a, b) => a - b);

  return FormulaDateRange.from({ start, end });
});

const tester = new RoutineTester('dateEnd');

describe('dateEnd routine', () => {
  it.prop([range])('should give back the end of a range', (value) => {
    expect(evaluate('dateEnd(range)', { context: { range: value } })).toBeFormulaDataType(FormulaDateTime, value.value.end);
  });

  it.prop([formulaValueArbitrary(Kind.DateTime)])('should give back a date as its own end', (date) => {
    expect(evaluate('date.end()', { context: { date } })).toBeFormulaDataType(FormulaDateTime, date.value);
  });

  describe('examples', tester.examples([
    {
      formula: 'dateRange(parseDate("2022-09-07T10:00Z"), parseDate("2022-09-07T18:30Z")).dateEnd()',
      expected: FormulaDateTime.from('2022-09-07T18:30Z'),
    },
  ]));
});
