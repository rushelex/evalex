import { Temporal } from 'temporal-polyfill';

import type { EvaluateOptions } from '../expression';

import { evaluate } from '../../testing-library';
import { FormulaArray, FormulaNumber, FormulaObject, FormulaString } from '../data-types';

describe('Member Expressions and Method Calls', () => {
  const contextOptions: EvaluateOptions = {
    context: {
      myString: new FormulaString(' Hello World '),
      myList: new FormulaArray([
        new FormulaNumber(1),
        new FormulaNumber(2),
        new FormulaNumber(3),
      ]),
      person: FormulaObject.from({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        isActive: true,
        details: { role: 'admin', lastLogin: Temporal.Now.zonedDateTimeISO('UTC') },
      }),
      numList: new FormulaArray([new FormulaNumber(10), new FormulaNumber(20)]),
    },
  };

  it('should access a property of a FormulaObject', () => {
    const result = evaluate('person.name()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaString, 'Alice');
  });

  it('should access a nested property (person.details().role())', () => {
    const result = evaluate('person.details().role()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaString, 'admin');
  });

  it('should call a method without arguments (acting as a property) on FormulaString', () => {
    const result = evaluate('myString.length()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaNumber, 13); // " Hello World "
  });

  it('should call a method with arguments on FormulaString (upper)', () => {
    const result = evaluate('myString.upper()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaString, ' HELLO WORLD ');
  });

  it('should call a method with arguments on FormulaString (trim)', () => {
    const result = evaluate('myString.trim()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaString, 'Hello World');
  });

  it('should throw error for non-existent method on FormulaObject', () => {
    expect(() => evaluate('person.nonExistentProp()', contextOptions)).toThrowFormulaError(
      'Field "nonExistentProp" is not defined.',
      [7, 22],
    );
  });

  it('should not leak methods from one entity to another', () => {
    // Call FormulaArray's method "map" on FormulaObject's property "name" (FormulaString)
    expect(() => evaluate('person.name().map()', contextOptions)).toThrowFormulaError(
      'Method "map" is not defined.',
      [14, 17],
    );
  });
});

describe('Global Functions', () => {
  it('should evaluate nested functions', () => {
    const result = evaluate('format(pi())');
    expect(result).toBeFormulaDataType(FormulaString, String(Math.PI));
  });

  it('should evaluate combined nested functions', () => {
    const result = evaluate('format(sum(1, 2, pi()))');
    expect(result).toBeFormulaDataType(FormulaString, String(1 + 2 + Math.PI));
  });

  it('should throw error for non-existent function', () => {
    expect(() => evaluate('nonExistentFunc()')).toThrowFormulaError(
      'Function "nonExistentFunc" is not defined.',
      [0, 17],
    );
  });
});
