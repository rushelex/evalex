import type { EvaluateOptions } from '../../testing-library';

import { evaluate, loc } from '../../testing-library';
import { FormulaBoolean, FormulaNull, FormulaNumber, FormulaString } from '../data-types';
import { Errors } from '../errors';

describe('Identifiers', () => {
  const contextOptions: EvaluateOptions = {
    context: {
      myNumber: new FormulaNumber(42),
      myString: new FormulaString('test string'),
      myBoolean: new FormulaBoolean(true),
      myNullProp: new FormulaNull(),
    },
  };

  it('should resolve a number identifier', () => {
    const result = evaluate('myNumber', contextOptions);
    expect(result).toBeFormulaDataType(FormulaNumber, 42);
  });

  it('should resolve a string identifier', () => {
    const result = evaluate('myString', contextOptions);
    expect(result).toBeFormulaDataType(FormulaString, 'test string');
  });

  it('should resolve a boolean identifier', () => {
    const result = evaluate('myBoolean', contextOptions);
    expect(result).toBeFormulaDataType(FormulaBoolean, true);
  });

  it('should resolve a null identifier', () => {
    const result = evaluate('myNullProp', contextOptions);
    expect(result).toBeFormulaDataType(FormulaNull, null);
  });

  it('should throw FormulaError if identifier is not found', () => {
    expect(() => {
      evaluate('unknownVar', contextOptions);
    }).toThrow(Errors.Reference.VariableNotDefined.create(
      { name: 'unknownVar' },
      { location: loc(0, 10) },
    ));
  });
});
