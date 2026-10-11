import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when a positive number is expected but a non-positive value is provided.
 *
 * @example
 * ```typescript
 * // Thrown automatically by functions requiring positive numbers
 * log10(0) // throws PositiveNumberExpected
 * log10(-5) // throws PositiveNumberExpected
 * log2(-1) // throws PositiveNumberExpected
 *
 * // Valid calls
 * log10(10) // OK - returns 1
 * log2(8) // OK - returns 3
 *
 * // Manual creation
 * throw PositiveNumberExpected.create({
 *   value: -5
 * }, { location: node.location });
 *
 * // Type checking
 * if (PositiveNumberExpected.is(error)) {
 *   console.log(error.payload.value); // -5
 * }
 * ```
 *
 * @param payload - Object containing the invalid value
 */
export const PositiveNumberExpected = createErrorDefinition({
  code: FormulaErrorCode.RANGE_ERROR,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.RANGE_ERROR]) => payload,
  formatMessage: () => 'Expected positive number.',
  messageKey: 'formula_error.positive_number_expected',
});
