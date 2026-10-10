import { it } from '@fast-check/vitest';

import { evaluateOutcome } from '../../../../testing-library';
import { FormulaBoolean } from '../../../data-types';
import { listConditionArbitrary } from '../../test-helpers/list-condition-arbitrary';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('every');

describe('every routine', () => {
  it.prop([listConditionArbitrary()])('should be true exactly when filter keeps every item', ({ context, condition }) => {
    expect(evaluateOutcome(`every(list, ${condition})`, { context }))
      .toHaveSameOutcomeAs(evaluateOutcome(`length(filter(list, ${condition})) == length(list)`, { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[1, "a"].every(current > 1)',
      expected: new FormulaBoolean(false),
    },
  ]));
});
