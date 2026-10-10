import { it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaArray, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('split');

describe('split routine', () => {
  it.prop([formulaValueArbitrary(Kind.String), formulaValueArbitrary(Kind.String)])('should give back the text when the parts are joined with the separator', (text, separator) => {
    const context = { text, separator };

    expect(evaluateOutcome('join(split(text, separator), separator)', { context })).toHaveSameOutcomeAs(evaluateOutcome('text', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '"👨‍👩‍👧ab".split("")',
      expected: FormulaArray.from(['👨‍👩‍👧', 'a', 'b']),
    },
    {
      formula: '"".split(",")',
      expected: FormulaArray.from(['']),
    },
    {
      formula: '"a,,b".split(",")',
      expected: FormulaArray.from(['a', '', 'b']),
    },
    {
      formula: '"a1b2".split(/(\\d)/)',
      expected: FormulaArray.from(['a', '1', 'b', '2', '']),
    },
  ]));
});
