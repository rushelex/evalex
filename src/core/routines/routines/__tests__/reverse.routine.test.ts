import { it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaArray, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('reverse');

describe('reverse routine', () => {
  it.prop([formulaValueArbitrary(Kind.Array)])('should give back the list when reversed twice', (list) => {
    const context = { list };

    expect(evaluateOutcome('reverse(reverse(list))', { context })).toHaveSameOutcomeAs(evaluateOutcome('list', { context }));
  });

  it.prop([formulaValueArbitrary(Kind.Array)])('should move the last item to the front', (list) => {
    const context = { list };

    expect(evaluateOutcome('first(reverse(list))', { context })).toHaveSameOutcomeAs(evaluateOutcome('last(list)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[].reverse()',
      expected: FormulaArray.from([]),
    },
    {
      formula: '[[1, 2], 3].reverse()',
      expected: FormulaArray.from([3, [1, 2]]),
    },
  ]));
});
