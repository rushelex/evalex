import { it } from '@fast-check/vitest';

import { evaluateOutcome } from '../../../../testing-library';
import { FormulaBoolean } from '../../../data-types';
import { listConditionArbitrary } from '../../test-helpers/list-condition-arbitrary';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('some');

describe('some routine', () => {
  it.prop([listConditionArbitrary()])('should be true exactly when filter keeps an item', ({ context, condition }) => {
    expect(evaluateOutcome(`some(list, ${condition})`, { context }))
      .toHaveSameOutcomeAs(evaluateOutcome(`length(filter(list, ${condition})) > 0`, { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[1, "a"].some(current > 0)',
      expected: new FormulaBoolean(true),
    },
  ]));
});
