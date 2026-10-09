import type { RoutineExampleError } from '../../routine-example';

import { FormulaArray, FormulaNumber } from '../../../data-types';
import { Errors } from '../../../errors';
import { RoutineExample } from '../../routine-example';
import { checkRoutineExample } from '../check-routine-example';

const callbackReturnError: RoutineExampleError = {
  type: Errors.Argument.CallbackReturnTypeMismatch,
  message: 'Expected callback to return type Boolean, but got Number.',
  location: { function: [12, 13], method: [11, 12] },
};

function errorExample(formula: string, error: RoutineExampleError = callbackReturnError): RoutineExample {
  return new RoutineExample('filter', { formula: () => formula, error });
}

describe(checkRoutineExample, () => {
  it.each([
    { formula: 'filter([1], 2)', form: 'function' as const },
    { formula: '[1].filter(2)', form: 'method' as const },
  ])('should accept the error of the example in the $form form', ({ formula, form }) => {
    expect(() => checkRoutineExample(errorExample(formula), form)).not.toThrow();
  });

  it('should reject an error example whose formula does not fail', () => {
    expect(() => checkRoutineExample(errorExample('filter([1], true)'), 'function')).toThrow();
  });

  it('should reject an error example that fails with another error', () => {
    expect(() => checkRoutineExample(errorExample('filter(1, true)'), 'function')).toThrow();
  });

  it('should reject an error example that fails at another location', () => {
    expect(() => checkRoutineExample(errorExample('filter([1],  2)'), 'function')).toThrow();
  });

  it('should reject an error example without a location for the form being checked', () => {
    const example = errorExample('[1].filter(2)', { ...callbackReturnError, location: { function: [12, 13] } });

    expect(() => checkRoutineExample(example, 'method')).toThrow('The error of example "[1].filter(2)" has no location for the method form.');
  });

  it('should reject a successful example whose result differs', () => {
    const example = new RoutineExample('filter', {
      formula: () => 'filter([1, 2], current > 1)',
      result: () => new FormulaArray([new FormulaNumber(1)]),
    });

    expect(() => checkRoutineExample(example, 'function')).toThrow();
  });
});
