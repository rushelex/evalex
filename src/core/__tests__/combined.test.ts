import type { EvaluateOptions } from '../expression';

import { evaluate } from '../../testing-library';
import { FormulaArray, FormulaNumber, FormulaObject, FormulaString } from '../data-types';

describe('Complex and Combined Expressions', () => {
  const context: EvaluateOptions = {
    context: {
      person: FormulaObject.from({ name: 'Test User', age: 25, id: 'u1' }),
      items: new FormulaArray([
        FormulaObject.from({ name: 'ItemA', age: 100, id: 'i1' }),
        FormulaObject.from({ name: 'ItemB', age: 200, id: 'i2' }),
      ]),
    },
  };

  it('should handle iterator inside map()', () => {
    const directMapResult = evaluate('items.map(current.age())', context);
    expect(directMapResult).toBeFormulaDataType(FormulaArray, [
      new FormulaNumber(100),
      new FormulaNumber(200),
    ]);
  });

  it('should handle method call on a property', () => {
    const result = evaluate('myStr.trim()', {
      context: { myStr: new FormulaString(' example ') },
    });
    expect(result).toBeFormulaDataType(FormulaString, 'example');
  });

  it('should handle nested calls and member access', () => {
    const result = evaluate('person.name().upper()', context);
    expect(result).toBeFormulaDataType(FormulaString, 'TEST USER');
  });

  it('should handle multi-lined formula', () => {
    const result = evaluate(`
      person.age() +
      10
    `, context);
    expect(result).toBeFormulaDataType(FormulaNumber, 35);
  });

  it('should handle multi-lined formula for method chaining', () => {
    const result = evaluate(`
      person
        .name()
        .upper()
        .length() +
      10
    `, context);
    expect(result).toBeFormulaDataType(FormulaNumber, 19);
  });
});
