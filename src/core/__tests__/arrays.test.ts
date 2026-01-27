import { evaluate } from '../../testing-library';
import { FormulaArray, FormulaBoolean, FormulaNumber, FormulaString } from '../data-types';

describe('Array Expressions', () => {
  it('should create an empty array', () => {
    const result = evaluate('[]');
    expect(result).toBeFormulaDataType(FormulaArray, []);
  });

  it('should create an array of numbers', () => {
    const result = evaluate('[1, 2, 3]');
    expect(result).toBeFormulaDataType(FormulaArray, [
      new FormulaNumber(1),
      new FormulaNumber(2),
      new FormulaNumber(3),
    ]);
  });

  it('should create an array of mixed types', () => {
    const result = evaluate('[1, "hello", true]');
    expect(result).toBeFormulaDataType(FormulaArray, [
      new FormulaNumber(1),
      new FormulaString('hello'),
      new FormulaBoolean(true),
    ]);
  });

  it('should create an array with expressions', () => {
    const result = evaluate('[x, x * 2]', {
      context: { x: new FormulaNumber(5) },
    });
    expect(result).toBeFormulaDataType(FormulaArray, [
      new FormulaNumber(5),
      new FormulaNumber(10),
    ]);
  });
});
