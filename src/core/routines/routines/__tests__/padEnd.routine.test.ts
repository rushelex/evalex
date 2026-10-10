import { fc, it } from '@fast-check/vitest';

import { evaluate, evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaNumber, FormulaString, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('padEnd');

describe('padEnd routine', () => {
  it.prop([formulaValueArbitrary(Kind.String), fc.integer({ min: -2, max: 10 }), formulaValueArbitrary(Kind.String)])('should keep the text whole', (text, length, padding) => {
    const padded = evaluate('padEnd(text, length, padding)', { context: { text, length: new FormulaNumber(length), padding } });

    expect(padded).toBeInstanceOf(FormulaString);
    expect(String(padded.value).startsWith(String(text.value))).toBe(true);
  });

  it.prop([formulaValueArbitrary(Kind.String), fc.nat({ max: 3 }), formulaValueArbitrary(Kind.String)])('should not change a text already as long as the length', (text, shorter, padding) => {
    const context = { text, shorter: new FormulaNumber(shorter), padding };

    expect(evaluateOutcome('padEnd(text, length(text) - shorter, padding)', { context })).toHaveSameOutcomeAs(evaluateOutcome('text', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '"5".padEnd(3, "abc")',
      expected: new FormulaString('5ab'),
    },
    {
      formula: '"5".padEnd(3, "👍")',
      expected: new FormulaString('5👍👍'),
    },
    {
      formula: '"5".padEnd(2)',
      expected: new FormulaString('5 '),
    },
    {
      formula: '"5".padEnd(3, "")',
      expected: new FormulaString('5'),
    },
    {
      formula: '"5".padEnd(1000000000)',
      expected: {
        function: {
          message: 'Expected a smaller length: the text would be too long.',
          location: [12, 22],
        },
        method: {
          message: 'Expected a smaller length: the text would be too long.',
          location: [11, 21],
        },
      },
    },
  ]));
});
