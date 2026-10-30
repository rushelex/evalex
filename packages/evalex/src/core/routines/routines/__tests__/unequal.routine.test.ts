import { fc, it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaBoolean } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('unequal');

const anyValue = formulaValueArbitrary();

const valuePair = fc.oneof(fc.tuple(anyValue, anyValue), anyValue.map((value) => [value, value] as const));

describe('unequal routine', () => {
  it.prop([valuePair])('should be the opposite of equal', ([a, b]) => {
    const context = { a, b };

    expect(evaluateOutcome('unequal(a, b)', { context })).toHaveSameOutcomeAs(evaluateOutcome('not equal(a, b)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '(1).unequal("1")',
      expected: new FormulaBoolean(true),
    },
    {
      formula: '[[1], "a"].unequal([[1], "a"])',
      expected: new FormulaBoolean(false),
    },
  ]));
});
