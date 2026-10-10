import { it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaString, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('last');

describe('last routine', () => {
  it.prop([formulaValueArbitrary(Kind.Array)])('should give the item at index -1', (list) => {
    const context = { list };

    expect(evaluateOutcome('last(list)', { context })).toHaveSameOutcomeAs(evaluateOutcome('at(list, -1)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '["a", ["b"]].last().last()',
      expected: new FormulaString('b'),
    },
  ]));
});
