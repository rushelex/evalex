import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when comparing values of incompatible types.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator for type mismatches in comparisons
 * evaluate('5 > "hello"') // throws ComparisonTypeMismatch
 * evaluate('true < 10') // throws ComparisonTypeMismatch
 *
 * // Valid comparisons (same types)
 * evaluate('5 > 3') // OK - numbers
 * evaluate('"b" > "a"') // OK - strings
 * evaluate('date1 < date2') // OK - dates
 *
 * // Manual creation
 * throw ComparisonTypeMismatch.create({ expression: '5 > "text"' }, { location: node.location });
 *
 * // Type checking
 * if (ComparisonTypeMismatch.is(error)) {
 *   console.log(error.payload.expression); // '5 > "text"'
 *   console.log(error.payload.reason); // 'Types must match for comparison'
 * }
 * ```
 *
 * @param expression - The expression string that caused the error
 */
export const ComparisonTypeMismatch = createErrorDefinition({
  code: FormulaErrorCode.EVALUATE_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.EVALUATE_ERROR], 'reason'>) => ({
    reason: 'Types must match for comparison',
    ...payload,
  }),
  formatMessage: () => 'Types must match for comparison (Number, String, Date, or DateTime).',
  messageKey: 'formula_error.comparison_type_mismatch',
});

/**
 * Error thrown when a date without a time meets a date and time where they would have to be compared, which needs a
 * time zone the formula has not named.
 *
 * @example
 * ```typescript
 * evaluate('due < now()')        // throws DateWithDateTime
 * evaluate('due < now().toDate()') // OK - two dates
 *
 * if (DateWithDateTime.is(error)) {
 *   console.log(error.payload.reason); // 'A date and a date and time do not compare'
 * }
 * ```
 *
 * @param expression - The formula that caused the error
 */
export const DateWithDateTime = createErrorDefinition({
  code: FormulaErrorCode.EVALUATE_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.EVALUATE_ERROR], 'reason'>) => ({
    reason: 'A date and a date and time do not compare',
    ...payload,
  }),
  formatMessage: () => 'A date and a date and time do not compare. Convert one of them: dateTime.toDate() or date.toDateTime().',
  messageKey: 'formula_error.date_with_date_time',
});

/**
 * Error thrown when attempting a math operation on a non-numeric value.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator for math operations on non-numbers
 * evaluate('"hello" * 2') // throws NonNumericMathOperation
 * evaluate('true + 5') // throws NonNumericMathOperation
 * evaluate('[1, 2] / 3') // throws NonNumericMathOperation
 *
 * // Valid operations
 * evaluate('5 * 2') // OK - numbers
 * evaluate('3.14 + 1.5') // OK - numbers
 *
 * // Manual creation
 * throw NonNumericMathOperation.create({ expression: '"text" * 5' }, { location: node.location });
 *
 * // Type checking
 * if (NonNumericMathOperation.is(error)) {
 *   console.log(error.payload.expression); // '"text" * 5'
 *   console.log(error.payload.reason); // 'Cannot perform math operation on non-numeric value'
 * }
 * ```
 *
 * @param expression - The expression string that caused the error
 */
export const NonNumericMathOperation = createErrorDefinition({
  code: FormulaErrorCode.EVALUATE_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.EVALUATE_ERROR], 'reason'>) => ({
    reason: 'Cannot perform math operation on non-numeric value',
    ...payload,
  }),
  formatMessage: () => 'Cannot perform math operation on a non-numeric value.',
  messageKey: 'formula_error.non_numeric_math_operation',
});

/**
 * Error thrown when applying unary minus to a non-numeric value.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator for unary minus on non-numbers
 * evaluate('-"hello"') // throws UnaryMinusNonNumeric
 * evaluate('-true') // throws UnaryMinusNonNumeric
 * evaluate('-[1, 2, 3]') // throws UnaryMinusNonNumeric
 *
 * // Valid operations
 * evaluate('-5') // OK - returns -5
 * evaluate('-(10 + 2)') // OK - returns -12
 *
 * // Manual creation
 * throw UnaryMinusNonNumeric.create({ expression: '-"text"' }, { location: node.location });
 *
 * // Type checking
 * if (UnaryMinusNonNumeric.is(error)) {
 *   console.log(error.payload.expression); // '-"text"'
 *   console.log(error.payload.reason); // 'Cannot apply unary minus to non-numeric value'
 * }
 * ```
 *
 * @param expression - The expression string that caused the error
 */
export const UnaryMinusNonNumeric = createErrorDefinition({
  code: FormulaErrorCode.EVALUATE_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.EVALUATE_ERROR], 'reason'>) => ({
    reason: 'Cannot apply unary minus to non-numeric value',
    ...payload,
  }),
  formatMessage: () => 'Cannot apply unary minus to a non-numeric value.',
  messageKey: 'formula_error.unary_minus_non_numeric',
});
