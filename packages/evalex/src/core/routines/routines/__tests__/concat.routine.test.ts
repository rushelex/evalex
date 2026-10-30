import { it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaArray, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('concat');

describe('concat routine', () => {
  it.prop([formulaValueArbitrary(Kind.Array), formulaValueArbitrary(Kind.Array)])('should keep the first list in front and the second after it', (a, b) => {
    const context = { a, b };

    expect(evaluateOutcome('slice(concat(a, b), 0, length(a))', { context })).toHaveSameOutcomeAs(evaluateOutcome('a', { context }));
    expect(evaluateOutcome('slice(concat(a, b), length(a))', { context })).toHaveSameOutcomeAs(evaluateOutcome('b', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[1].concat()',
      expected: FormulaArray.from([1]),
    },
    {
      formula: '[1].concat([], [2])',
      expected: FormulaArray.from([1, 2]),
    },
    {
      formula: '[1].concat(2)',
      expected: {
        function: {
          message: 'Expected type Array.',
          location: [12, 13],
        },
        method: {
          message: 'Expected type Array.',
          location: [11, 12],
        },
      },
    },
  ]));
});
