import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when an unsupported binary operator is used.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator for unknown binary operators
 * // This typically shouldn't happen in normal usage as parser validates operators
 * evaluate('5 ** 2') // OK - supported operator
 * evaluate('5 & 2') // Could throw UnsupportedBinaryOperator if not implemented
 *
 * // Manual creation
 * throw UnsupportedBinaryOperator.create('**', { location: node.location });
 *
 * // Type checking
 * if (UnsupportedBinaryOperator.is(error)) {
 *   console.log(error.payload.value); // '**'
 * }
 * ```
 *
 * @param operator - The unsupported operator string
 */
export const UnsupportedBinaryOperator = createErrorDefinition({
  code: FormulaErrorCode.RANGE_ERROR,
  createPayload: (operator: string) => ({ value: operator }),
  formatMessage: ({ value }) => `Unsupported binary operator: ${value}.`,
  messageKey: 'formula_error.unsupported_binary_operator',
});

/**
 * Error thrown when an unsupported unary operator is used.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator for unknown unary operators
 * // This typically shouldn't happen in normal usage as parser validates operators
 * evaluate('-5') // OK - supported unary minus
 * evaluate('!true') // OK - supported logical NOT
 * evaluate('~5') // Could throw UnsupportedUnaryOperator if not implemented
 *
 * // Manual creation
 * throw UnsupportedUnaryOperator.create('~', { location: node.location });
 *
 * // Type checking
 * if (UnsupportedUnaryOperator.is(error)) {
 *   console.log(error.payload.value); // '~'
 * }
 * ```
 *
 * @param operator - The unsupported operator string
 */
export const UnsupportedUnaryOperator = createErrorDefinition({
  code: FormulaErrorCode.RANGE_ERROR,
  createPayload: (operator: string) => ({ value: operator }),
  formatMessage: ({ value }) => `Unsupported unary operator: ${value}.`,
  messageKey: 'formula_error.unsupported_unary_operator',
});
