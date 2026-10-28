import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when division by zero is attempted.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator
 * evaluate('10 / 0') // throws DivisionByZero
 *
 * // Manual creation
 * throw DivisionByZero.create({ dividend: 10 }, { location: node.location });
 *
 * // Type checking
 * if (DivisionByZero.is(error)) {
 *   console.log(error.payload.dividend); // 10
 *   console.log(error.payload.operation); // 'division'
 * }
 * ```
 *
 * @param dividend - The dividend value that was being divided by zero
 */
export const DivisionByZero = createErrorDefinition({
  code: FormulaErrorCode.ARITHMETIC_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.ARITHMETIC_ERROR], 'operation'>) => ({
    operation: 'division' as const,
    ...payload,
  }),
  formatMessage: () => 'Division by zero.',
  messageKey: 'formula_error.division_by_zero',
});

/**
 * Error thrown when modulo by zero is attempted.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator
 * evaluate('10 % 0') // throws ModuloByZero
 *
 * // Manual creation
 * throw ModuloByZero.create({ dividend: 10 }, { location: node.location });
 *
 * // Type checking
 * if (ModuloByZero.is(error)) {
 *   console.log(error.payload.dividend); // 10
 *   console.log(error.payload.operation); // 'modulo'
 * }
 * ```
 *
 * @param dividend - The dividend value that was being used with modulo zero
 */
export const ModuloByZero = createErrorDefinition({
  code: FormulaErrorCode.ARITHMETIC_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.ARITHMETIC_ERROR], 'operation'>) => ({
    operation: 'modulo' as const,
    ...payload,
  }),
  formatMessage: () => 'Division by zero (modulo).',
  messageKey: 'formula_error.modulo_by_zero',
});

/**
 * Error thrown when a number a formula computes is too large in magnitude to hold.
 *
 * @example
 * ```typescript
 * evaluate('10 ^ 400') // throws NumberOutOfRange
 *
 * if (NumberOutOfRange.is(error)) {
 *   console.log(error.payload.value); // 'Infinity', or '-Infinity' for a negative number
 *   console.log(error.payload.max); // Number.MAX_VALUE
 * }
 * ```
 *
 * @param value - `'Infinity'` or `'-Infinity'`, the side of the range the number left
 */
export const NumberOutOfRange = createErrorDefinition({
  code: FormulaErrorCode.RANGE_ERROR,
  createPayload: (payload: Pick<FormulaErrorPayloads[typeof FormulaErrorCode.RANGE_ERROR], 'value'>) => ({
    ...payload,
    min: -Number.MAX_VALUE,
    max: Number.MAX_VALUE,
  }),
  formatMessage: () => 'Number is out of the supported range.',
  messageKey: 'formula_error.number_out_of_range',
});

/**
 * Error thrown when a computation has no real number as its result, such as a fractional power of a negative number.
 *
 * @example
 * ```typescript
 * evaluate('(-8) ^ (1 / 3)') // throws NotARealNumber
 *
 * if (NotARealNumber.is(error)) {
 *   console.log(error.payload.value); // 'NaN'
 * }
 * ```
 */
export const NotARealNumber = createErrorDefinition({
  code: FormulaErrorCode.RANGE_ERROR,
  createPayload: () => ({ value: 'NaN' }),
  formatMessage: () => 'Result is not a real number.',
  messageKey: 'formula_error.not_a_real_number',
});

/**
 * Error thrown when date arithmetic produces a date outside the supported range.
 *
 * @example
 * ```typescript
 * // Thrown by date routines
 * evaluate('parseDate("2024-01-01").add(300000, "years")') // throws DateOutOfRange
 *
 * // Type checking
 * if (DateOutOfRange.is(error)) {
 *   console.log(error.payload.value); // '2024-01-01T00:00:00Z', the date the arithmetic started from
 * }
 * ```
 *
 * @param value - The date the arithmetic started from
 */
export const DateOutOfRange = createErrorDefinition({
  code: FormulaErrorCode.RANGE_ERROR,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.RANGE_ERROR]) => payload,
  formatMessage: () => 'Date is out of the supported range.',
  messageKey: 'formula_error.date_out_of_range',
});
