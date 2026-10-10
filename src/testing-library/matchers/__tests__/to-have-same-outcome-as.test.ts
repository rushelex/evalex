import { Errors, FormulaArray, FormulaNumber, FormulaString } from '~/core';

import { loc } from '../../location';
import { toHaveSameOutcomeAs } from '../to-have-same-outcome-as';

function typeMismatch(start: number): ReturnType<typeof Errors.Argument.TypeMismatch.create> {
  return Errors.Argument.TypeMismatch.create({ expected: ['Number'], actual: 'String', argumentPosition: 1 }, { location: loc(start, start + 3) });
}

describe(toHaveSameOutcomeAs, () => {
  it.each([
    { name: 'equal numbers', received: new FormulaNumber(1), expected: new FormulaNumber(1) },
    { name: 'NaN and NaN', received: new FormulaNumber(Number.NaN), expected: new FormulaNumber(Number.NaN) },
    { name: 'lists holding NaN', received: new FormulaArray([new FormulaNumber(Number.NaN)]), expected: new FormulaArray([new FormulaNumber(Number.NaN)]) },
  ])('should accept $name', ({ received, expected }) => {
    expect({ value: received }).toHaveSameOutcomeAs({ value: expected });
  });

  it('should accept errors of the same kind at different locations', () => {
    expect({ error: typeMismatch(8) }).toHaveSameOutcomeAs({ error: typeMismatch(12) });
  });

  it('should reject different values', () => {
    expect(() => expect({ value: new FormulaNumber(1) }).toHaveSameOutcomeAs({ value: new FormulaString('1') }))
      .toThrow('FormulaNumber(1) differs from FormulaString(1)');
  });

  it('should reject errors of different kinds', () => {
    const other = Errors.Arithmetic.DivisionByZero.create({ dividend: 1 }, { location: loc(0, 5) });

    expect(() => expect({ error: typeMismatch(8) }).toHaveSameOutcomeAs({ error: other }))
      .toThrow('ARGUMENT_TYPE_MISMATCH "Expected type Number. [8,11]" differs from ARITHMETIC_ERROR "Division by zero. [0,5]"');
  });

  it('should reject a value where an error is expected', () => {
    expect(() => expect({ value: new FormulaNumber(1) }).toHaveSameOutcomeAs({ error: typeMismatch(8) }))
      .toThrow('FormulaNumber(1) differs from ARGUMENT_TYPE_MISMATCH "Expected type Number. [8,11]"');
  });
});
