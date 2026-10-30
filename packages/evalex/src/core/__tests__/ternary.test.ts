import type { EvaluateOptions } from '../../testing-library';

import { evaluate } from '../../testing-library';
import { FormulaBoolean, FormulaNumber } from '../data-types';

describe('Conditional (ternary) Expressions', () => {
  const ternaryContext: EvaluateOptions = { context: { condition: new FormulaBoolean(true), a: new FormulaNumber(10), b: new FormulaNumber(20) } };

  it('should evaluate the consequent when condition is true', () => {
    const result = evaluate('condition ? a : b', ternaryContext);
    expect(result).toBeFormulaDataType(FormulaNumber, 10);
  });

  it('should evaluate the alternate when condition is false', () => {
    const result = evaluate('false ? a : b', ternaryContext);
    expect(result).toBeFormulaDataType(FormulaNumber, 20);
  });

  it('should evaluate complex expressions in condition, consequent, and alternate', () => {
    const result = evaluate('(a > 5) ? (a * 2) : (b / 2)', ternaryContext);
    expect(result).toBeFormulaDataType(FormulaNumber, 20); // (10 > 5) is true, so 10 * 2 = 20
  });

  it('should not throw error if condition is not boolean', () => {
    expect(() => evaluate('"not boolean" ? a : b', ternaryContext)).not.toThrowError();
  });
});
