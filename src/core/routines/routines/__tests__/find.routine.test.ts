import { it } from '@fast-check/vitest';

import { evaluateOutcome } from '../../../../testing-library';
import { FormulaNumber } from '../../../data-types';
import { listConditionArbitrary } from '../../test-helpers/list-condition-arbitrary';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('find');

describe('find routine', () => {
  it.prop([listConditionArbitrary()])('should give the first item filter keeps', ({ context, condition }) => {
    expect(evaluateOutcome(`find(list, ${condition})`, { context }))
      .toHaveSameOutcomeAs(evaluateOutcome(`first(filter(list, ${condition}))`, { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[1, "a"].find(current > 0)',
      expected: new FormulaNumber(1),
    },
    {
      formula: '[1].find(current)',
      expected: {
        function: {
          message: 'Expected callback to return type Boolean, but got Number.',
          location: [10, 17],
        },
        method: {
          message: 'Expected callback to return type Boolean, but got Number.',
          location: [9, 16],
        },
      },
    },
  ]));
});
