import { fc, it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaArray, FormulaBoolean } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('includes');

// A value from the list half of the time, so that the routine is checked on hits as well as misses.
const listAndValue = fc.array(formulaValueArbitrary(), { maxLength: 4 }).chain((items) => fc.record({
  list: fc.constant(new FormulaArray(items)),
  value: items.length === 0 ? formulaValueArbitrary() : fc.oneof(fc.constantFrom(...items), formulaValueArbitrary()),
}));

describe('includes routine', () => {
  it.prop([listAndValue])('should find a value exactly when some item == it', ({ list, value }) => {
    const context = { list, value };

    expect(evaluateOutcome('includes(list, value)', { context }))
      .toHaveSameOutcomeAs(evaluateOutcome('length(list.filter(current == value)) > 0', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[].includes(null)',
      expected: new FormulaBoolean(false),
    },
    {
      formula: '[0].includes("0")',
      expected: new FormulaBoolean(false),
    },
  ]));
});
