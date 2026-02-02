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
