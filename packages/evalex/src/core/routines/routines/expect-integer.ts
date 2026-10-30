import type { FormulaNumber } from '../../data-types';
import type { ArgumentValidationFailure } from '../arguments';

/** Argument check for counts and positions, which only make sense as whole numbers. */
export function expectInteger(number: FormulaNumber): ArgumentValidationFailure | undefined {
  return Number.isInteger(number.value) ? undefined : { message: 'Expected integer.', expected: ['integer'], actual: number.value };
}
