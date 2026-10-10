import { it } from '@fast-check/vitest';

import { evaluate, evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaBoolean, FormulaNumber, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('toNumber');

describe('toNumber routine', () => {
  it.prop([formulaValueArbitrary(Kind.Number).filter((number) => !Number.isNaN(number.value))])('should read a number back from its text', (number) => {
    expect(evaluate('toNumber(format(number)) == number', { context: { number } })).toBeFormulaDataType(FormulaBoolean, true);
  });

  it.prop([formulaValueArbitrary(Kind.Date)])('should give the timestamp of a date', (date) => {
    const context = { date };

    expect(evaluateOutcome('toNumber(date)', { context })).toHaveSameOutcomeAs(evaluateOutcome('timestamp(date)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '" -1.5e3 ".toNumber()',
      expected: new FormulaNumber(-1500),
    },
    {
      formula: 'false.toNumber()',
      expected: new FormulaNumber(0),
    },
    {
      formula: '"12px".toNumber()',
      expected: {
        function: {
          message: 'Expected text that holds a number.',
          location: [9, 15],
        },
        method: {
          message: 'Expected text that holds a number.',
          location: [7, 15],
        },
      },
    },
    {
      formula: '" ".toNumber()',
      expected: {
        function: {
          message: 'Expected text that holds a number.',
          location: [9, 12],
        },
        method: {
          message: 'Expected text that holds a number.',
          location: [4, 12],
        },
      },
    },
  ]));
});
