import { fc, it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaNull, FormulaNumber, FormulaString, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('at');

describe('at routine', () => {
  it.prop([formulaValueArbitrary(Kind.Array), fc.nat({ max: 6 })])('should find the same item from the start and from the end', (list, offset) => {
    const context = { list, offset: new FormulaNumber(offset) };

    expect(evaluateOutcome('at(list, offset)', { context }))
      .toHaveSameOutcomeAs(evaluateOutcome('if(offset < length(list), at(list, offset - length(list)), null)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '["a", "b"].at(0)',
      expected: new FormulaString('a'),
    },
    {
      formula: '["a", "b"].at(-3)',
      expected: FormulaNull.instance(),
    },
    {
      formula: '[1, 2].at(0.5)',
      expected: {
        function: {
          message: 'Expected integer.',
          location: [11, 14],
        },
        method: {
          message: 'Expected integer.',
          location: [10, 13],
        },
      },
    },
  ]));
});
