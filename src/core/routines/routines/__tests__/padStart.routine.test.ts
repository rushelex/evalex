import { fc, it } from '@fast-check/vitest';

import { evaluate, evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaNumber, FormulaString, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('padStart');

describe('padStart routine', () => {
  it.prop([formulaValueArbitrary(Kind.String), fc.integer({ min: -2, max: 10 }), formulaValueArbitrary(Kind.String)])('should keep the text whole', (text, length, padding) => {
    const padded = evaluate('padStart(text, length, padding)', { context: { text, length: new FormulaNumber(length), padding } });

    expect(padded).toBeInstanceOf(FormulaString);
    expect(String(padded.value).endsWith(String(text.value))).toBe(true);
  });

  it.prop([formulaValueArbitrary(Kind.String), fc.nat({ max: 3 }), formulaValueArbitrary(Kind.String)])('should not change a text already as long as the length', (text, shorter, padding) => {
    const context = { text, shorter: new FormulaNumber(shorter), padding };

    expect(evaluateOutcome('padStart(text, length(text) - shorter, padding)', { context })).toHaveSameOutcomeAs(evaluateOutcome('text', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '"5".padStart(3, "abc")',
      expected: new FormulaString('ab5'),
    },
    {
      formula: '"5".padStart(3, "👍")',
      expected: new FormulaString('👍👍5'),
    },
    {
      formula: '"5".padStart(2)',
      expected: new FormulaString(' 5'),
    },
    {
      formula: '"5".padStart(3, "")',
      expected: new FormulaString('5'),
    },
    {
      formula: '"5".padStart(1000000000)',
      expected: {
        function: {
          message: 'Expected a smaller length: the text would be too long.',
          location: [14, 24],
        },
        method: {
          message: 'Expected a smaller length: the text would be too long.',
          location: [13, 23],
        },
      },
    },
  ]));
});
