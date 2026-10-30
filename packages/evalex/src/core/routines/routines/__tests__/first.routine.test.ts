import { it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaString, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('first');

describe('first routine', () => {
  it.prop([formulaValueArbitrary(Kind.Array)])('should give the item at index 0', (list) => {
    const context = { list };

    expect(evaluateOutcome('first(list)', { context })).toHaveSameOutcomeAs(evaluateOutcome('at(list, 0)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[["a"], "b"].first().first()',
      expected: new FormulaString('a'),
    },
  ]));
});
