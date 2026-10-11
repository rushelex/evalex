import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when a formula is expected to be a string but is not.
 *
 * @example
 * ```typescript
 * // Thrown automatically during formula validation
 * const expression = new Expression(123); // throws StringFormulaExpected
 * const expression = new Expression(null); // throws StringFormulaExpected
 * const expression = new Expression(undefined); // throws StringFormulaExpected
 *
 * // Valid usage
 * const expression = new Expression('a + b'); // OK
 * const expression = new Expression('sum(1, 2, 3)'); // OK
 *
 * // Manual creation
 * throw StringFormulaExpected.create('number', { location: node.location });
 *
 * // Type checking
 * if (StringFormulaExpected.is(error)) {
 *   console.log(error.payload.expected); // ['string']
 *   console.log(error.payload.actual); // 'number'
 * }
 * ```
 *
 * @param actual - The actual type that was provided
 */
export const StringFormulaExpected = createErrorDefinition({
  code: FormulaErrorCode.TYPE_MISMATCH,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.TYPE_MISMATCH], 'expected'>) => ({
    expected: ['string'],
    ...payload,
  }),
  formatMessage: () => 'Formula must be a string.',
  messageKey: 'formula_error.string_formula_expected',
});

/**
 * Error thrown when a formula is expected to be non-empty but is empty.
 *
 * @example
 * ```typescript
 * // Thrown automatically during formula validation
 * const expression = new Expression(''); // throws NonEmptyFormulaExpected
 * const expression = new Expression('   '); // throws NonEmptyFormulaExpected (after trim)
 *
 * // Valid usage
 * const expression = new Expression('5'); // OK
 * const expression = new Expression('a + b'); // OK
 * const expression = new Expression(' 1 '); // OK - has content after trim
 *
 * // Manual creation
 * throw NonEmptyFormulaExpected.create('string', { location: node.location });
 *
 * // Type checking
 * if (NonEmptyFormulaExpected.is(error)) {
 *   console.log(error.payload.expected); // ['non-empty string']
 *   console.log(error.payload.actual); // 'string'
 * }
 * ```
 *
 * @param actual - The actual type (typically 'string' but empty)
 */
export const NonEmptyFormulaExpected = createErrorDefinition({
  code: FormulaErrorCode.TYPE_MISMATCH,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.TYPE_MISMATCH], 'expected'>) => ({
    expected: ['non-empty string'],
    ...payload,
  }),
  formatMessage: () => 'Formula cannot be empty.',
  messageKey: 'formula_error.non_empty_formula_expected',
});
