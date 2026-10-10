import { fc, it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaArray, FormulaNumber, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('slice');

describe('slice routine', () => {
  it.prop([formulaValueArbitrary(Kind.Array), fc.integer({ min: -6, max: 6 })])('should give back the list when the parts before and after an index are joined', (list, index) => {
    const context = { list, index: new FormulaNumber(index) };

    expect(evaluateOutcome('concat(slice(list, 0, index), slice(list, index))', { context })).toHaveSameOutcomeAs(evaluateOutcome('list', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[1, 2, 3].slice(-2, -1)',
      expected: FormulaArray.from([2]),
    },
    {
      formula: '[1, 2, 3].slice(2, 1)',
      expected: FormulaArray.from([]),
    },
    {
      formula: '[1, 2, 3].slice(5)',
      expected: FormulaArray.from([]),
    },
    {
      formula: '[1, 2, 3].slice(0, 1.5)',
      expected: {
        function: {
          message: 'Expected integer.',
          location: [20, 23],
        },
        method: {
          message: 'Expected integer.',
          location: [19, 22],
        },
      },
    },
  ]));
});
