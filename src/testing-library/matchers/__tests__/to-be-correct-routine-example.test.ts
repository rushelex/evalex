import type { RoutineExampleError } from '~/core/routines/routine-example';

import { Errors, FormulaArray, FormulaNumber } from '~/core';
import { RoutineExample } from '~/core/routines/routine-example';

import { toBeCorrectRoutineExample } from '../to-be-correct-routine-example';

const callbackReturnError: RoutineExampleError = {
  type: Errors.Argument.CallbackReturnTypeMismatch,
  message: 'Expected callback to return type Boolean, but got Number.',
  location: { function: [12, 13], method: [11, 12] },
};

function errorExample(formula: string, error: RoutineExampleError = callbackReturnError): RoutineExample {
  return new RoutineExample('filter', { formula: () => formula, error });
}

describe(toBeCorrectRoutineExample, () => {
  it.each([
    { formula: 'filter([1], 2)', form: 'function' as const },
    { formula: '[1].filter(2)', form: 'method' as const },
  ])('should accept the error of the example in the $form form', ({ formula, form }) => {
    expect(errorExample(formula)).toBeCorrectRoutineExample(form);
  });

  it('should reject an error example whose formula does not fail', () => {
    expect(() => expect(errorExample('filter([1], true)')).toBeCorrectRoutineExample('function'))
      .toThrow('"filter([1], true)" returned FormulaArray(1) instead of failing with "Expected callback to return type Boolean, but got Number. [12,13]"');
  });

  it('should reject an error example that fails with another error', () => {
    expect(() => expect(errorExample('filter(1, true)')).toBeCorrectRoutineExample('function'))
      .toThrow('"filter(1, true)" failed with another error: "Expected type Array. [7,8]"');
  });

  it('should reject an error example that fails at another location', () => {
    expect(() => expect(errorExample('filter([1],  2)')).toBeCorrectRoutineExample('function'))
      .toThrow('"filter([1],  2)" failed with "Expected callback to return type Boolean, but got Number. [13,14]" instead of "Expected callback to return type Boolean, but got Number. [12,13]"');
  });

  it('should reject an error example without a location for the form being checked', () => {
    const example = errorExample('[1].filter(2)', { ...callbackReturnError, location: { function: [12, 13] } });

    expect(() => expect(example).toBeCorrectRoutineExample('method')).toThrow('The error of example "[1].filter(2)" has no location for the method form');
  });

  it('should reject a successful example whose result differs', () => {
    const example = new RoutineExample('filter', {
      formula: () => 'filter([1, 2], current > 1)',
      result: () => new FormulaArray([new FormulaNumber(1)]),
    });

    expect(() => expect(example).toBeCorrectRoutineExample('function')).toThrow('"filter([1, 2], current > 1)" returned FormulaArray(2) instead of FormulaArray(1)');
  });

  it('should reject a successful example whose formula fails', () => {
    const example = new RoutineExample('filter', {
      formula: () => 'filter([1, 2], 3)',
      result: () => new FormulaArray([]),
    });

    expect(() => expect(example).toBeCorrectRoutineExample('function'))
      .toThrow('"filter([1, 2], 3)" failed with "Expected callback to return type Boolean, but got Number. [15,16]" instead of returning FormulaArray()');
  });
});
