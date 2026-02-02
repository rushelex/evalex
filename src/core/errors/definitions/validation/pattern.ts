import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when a regular expression pattern is invalid.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator for invalid RegExp patterns
 * evaluate('/[unclosed/') // throws InvalidRegExpPattern
 * evaluate('/(?<incomplete/') // throws InvalidRegExpPattern
 * evaluate('/(invalid)(/') // throws InvalidRegExpPattern
 *
 * // Valid patterns
 * evaluate('/\\d+/') // OK
 * evaluate('/[a-z]+/i') // OK
 *
 * // Manual creation
 * throw InvalidRegExpPattern.create(
 *   { reason: 'Unterminated character class', expression: '/[abc/' },
 *   { location: node.location }
 * );
 *
 * // Type checking
 * if (InvalidRegExpPattern.is(error)) {
 *   console.log(error.payload.reason); // 'Unterminated character class'
 *   console.log(error.payload.expression); // '/[abc/'
 * }
 * ```
 *
 * @param errorMessage - The error message from the RegExp constructor
 * @param expression - The expression string that caused the error
 */
export const InvalidRegExpPattern = createErrorDefinition({
  code: FormulaErrorCode.EVALUATE_ERROR,
  createPayload: (payload: FormulaErrorPayloads[FormulaErrorCode.EVALUATE_ERROR]) => payload,
  formatMessage: ({ reason }) => reason ?? 'Invalid regular expression.',
  messageKey: 'formula_error.invalid_regexp_pattern',
});
