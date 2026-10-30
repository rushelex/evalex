import { it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaArray, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('unique');

describe('unique routine', () => {
  it.prop([formulaValueArbitrary(Kind.Array)])('should keep an item only when no earlier item equals it', (list) => {
    const context = { list };

    expect(evaluateOutcome('unique(list)', { context }))
      .toHaveSameOutcomeAs(evaluateOutcome('list.filter(not includes(slice(list, 0, index), current))', { context }));
  });

  it.prop([formulaValueArbitrary(Kind.Array)])('should not change a list without repeats', (list) => {
    const context = { list };

    expect(evaluateOutcome('unique(unique(list))', { context })).toHaveSameOutcomeAs(evaluateOutcome('unique(list)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[].unique()',
      expected: FormulaArray.from([]),
    },
    {
      formula: '[0, "0", false, null, null].unique()',
      expected: FormulaArray.from([0, '0', false, null]),
    },
  ]));
});
