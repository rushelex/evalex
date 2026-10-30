import { evaluate } from '../../testing-library';
import { FormulaBoolean, FormulaNull, FormulaNumber, FormulaString } from '../data-types';

describe('Literals', () => {
  it('should evaluate a number literal', () => {
    const result = evaluate('123');
    expect(result).toBeFormulaDataType(FormulaNumber, 123);
  });

  it('should evaluate a string literal', () => {
    const result = evaluate('"hello"');
    expect(result).toBeFormulaDataType(FormulaString, 'hello');
  });

  it('should evaluate a boolean true literal', () => {
    const result = evaluate('true');
    expect(result).toBeFormulaDataType(FormulaBoolean, true);
  });

  it('should evaluate a boolean false literal', () => {
    const result = evaluate('false');
    expect(result).toBeFormulaDataType(FormulaBoolean, false);
  });

  it('should evaluate a boolean "false" literal as string', () => {
    const result = evaluate('"false"');
    expect(result).toBeFormulaDataType(FormulaString, 'false');
  });

  it('should evaluate a null literal', () => {
    const result = evaluate('null');
    expect(result).toBeFormulaDataType(FormulaNull, null);
  });

  it('should evaluate an undefined literal', () => {
    const result = evaluate('undefined');
    expect(result).toBeFormulaDataType(FormulaNull, null);
  });
});
