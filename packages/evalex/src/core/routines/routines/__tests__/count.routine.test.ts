import { it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaNumber, Kind } from '../../../data-types';
import { listConditionArbitrary } from '../../test-helpers/list-condition-arbitrary';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('count');

describe('count routine', () => {
  it.prop([listConditionArbitrary()])('should give the number of items filter keeps', ({ context, condition }) => {
    expect(evaluateOutcome(`count(list, ${condition})`, { context }))
      .toHaveSameOutcomeAs(evaluateOutcome(`length(filter(list, ${condition}))`, { context }));
  });

  it.prop([formulaValueArbitrary(Kind.Array)])('should give the length of the list without a condition', (list) => {
    const context = { list };

    expect(evaluateOutcome('count(list)', { context })).toHaveSameOutcomeAs(evaluateOutcome('length(list)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[].count(current > 1)',
      expected: new FormulaNumber(0),
    },
  ]));
});
