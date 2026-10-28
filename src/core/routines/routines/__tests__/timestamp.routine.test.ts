import { fc, it } from '@fast-check/vitest';

import { evaluate } from '../../../../testing-library';
import { FormulaDateTime, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('timestamp');

describe('timestamp routine', () => {
  it.prop([fc.integer({ min: -8_640_000_000_000_000, max: 8_640_000_000_000_000 })])('should give back the milliseconds a date was made from', (milliseconds) => {
    expect(evaluate('timestamp(date)', { context: { date: FormulaDateTime.from(milliseconds) } })).toBeFormulaDataType(FormulaNumber, milliseconds);
  });

  describe('examples', tester.examples([
    {
      formula: 'parseDate("1969-12-31T23:59:59.999Z").timestamp()',
      expected: new FormulaNumber(-1),
    },
  ]));
});
