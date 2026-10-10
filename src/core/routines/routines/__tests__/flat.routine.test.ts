import { it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaArray, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('flat');

describe('flat routine', () => {
  it.prop([formulaValueArbitrary(Kind.Array), formulaValueArbitrary(Kind.Array)])('should join a list of two lists as concat joins them', (a, b) => {
    const context = { a, b };

    expect(evaluateOutcome('flat([a, b])', { context })).toHaveSameOutcomeAs(evaluateOutcome('concat(a, b)', { context }));
  });

  it.prop([formulaValueArbitrary(Kind.Array)])('should give back the list when each item was wrapped in a list', (list) => {
    const context = { list };

    expect(evaluateOutcome('flat(list.map([current]))', { context })).toHaveSameOutcomeAs(evaluateOutcome('list', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[].flat()',
      expected: FormulaArray.from([]),
    },
    {
      formula: '[[], [[]]].flat()',
      expected: FormulaArray.from([[]]),
    },
  ]));
});
