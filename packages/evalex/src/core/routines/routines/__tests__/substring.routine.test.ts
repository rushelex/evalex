import { fc, it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaNumber, FormulaString, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('substring');

const index = fc.integer({ min: -3, max: 12 }).map((value) => new FormulaNumber(value));

describe('substring routine', () => {
  it.prop([formulaValueArbitrary(Kind.String), index])('should give back the text when the parts before and after an index are joined', (text, at) => {
    const context = { text, at };

    expect(evaluateOutcome('substring(text, 0, at) + substring(text, at)', { context })).toHaveSameOutcomeAs(evaluateOutcome('text', { context }));
  });

  it.prop([formulaValueArbitrary(Kind.String), index, index])('should give the same text whichever index comes first', (text, start, end) => {
    const context = { text, start, end };

    expect(evaluateOutcome('substring(text, end, start)', { context })).toHaveSameOutcomeAs(evaluateOutcome('substring(text, start, end)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '"👨‍👩‍👧x".substring(1)',
      expected: new FormulaString('x'),
    },
    {
      formula: '"abc".substring(-2, 2)',
      expected: new FormulaString('ab'),
    },
    {
      formula: '"abc".substring(5)',
      expected: new FormulaString(''),
    },
    {
      formula: '"abc".substring(0.5)',
      expected: {
        function: {
          message: 'Expected integer.',
          location: [17, 20],
        },
        method: {
          message: 'Expected integer.',
          location: [16, 19],
        },
      },
    },
  ]));
});
