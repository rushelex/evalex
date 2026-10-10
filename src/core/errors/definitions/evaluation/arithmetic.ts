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
  createPayload: (payload: Omit<FormulaErrorPayloads[FormulaErrorCode.ARITHMETIC_ERROR], 'operation'>) => ({
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
  createPayload: (payload: Omit<FormulaErrorPayloads[FormulaErrorCode.ARITHMETIC_ERROR], 'operation'>) => ({
    operation: 'modulo' as const,
    ...payload,
  }),
  formatMessage: () => 'Division by zero (modulo).',
  messageKey: 'formula_error.modulo_by_zero',
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
  createPayload: (payload: FormulaErrorPayloads[FormulaErrorCode.RANGE_ERROR]) => payload,
  formatMessage: () => 'Date is out of the supported range.',
  messageKey: 'formula_error.date_out_of_range',
});
