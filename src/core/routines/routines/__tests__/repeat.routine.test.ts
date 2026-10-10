import { fc, it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaNumber, FormulaString, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('repeat');

describe('repeat routine', () => {
  it.prop([formulaValueArbitrary(Kind.String), fc.nat({ max: 5 })])('should add one more copy for each extra time', (text, times) => {
    const context = { text, times: new FormulaNumber(times) };

    expect(evaluateOutcome('repeat(text, times) + text', { context })).toHaveSameOutcomeAs(evaluateOutcome('repeat(text, times + 1)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '"".repeat(3)',
      expected: new FormulaString(''),
    },
    {
      formula: '"ab".repeat(-1)',
      expected: {
        function: {
          message: 'Expected integer of 0 or more.',
          location: [13, 15],
        },
        method: {
          message: 'Expected integer of 0 or more.',
          location: [12, 14],
        },
      },
    },
    {
      formula: '"ab".repeat(1000000000)',
      expected: {
        function: {
          message: 'Expected fewer times: the text would be too long.',
          location: [13, 23],
        },
        method: {
          message: 'Expected fewer times: the text would be too long.',
          location: [12, 22],
        },
      },
    },
  ]));
});
