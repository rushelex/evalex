import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';
import { formatTypes } from '../../utils';

/**
 * Error thrown when an argument has an incorrect type.
 *
 * @example
 * ```typescript
 * // Thrown automatically during argument validation
 * length(123) // throws ArgumentTypeMismatch if length expects string
 *
 * // Manual creation
 * throw ArgumentTypeMismatch.create({
 *   expected: ['string', 'array'],
 *   actual: 'number',
 *   argumentPosition: 1,
 *   argumentName: 'value'
 * }, { location: node.location });
 *
 * // Type checking
 * if (ArgumentTypeMismatch.is(error)) {
 *   console.log(error.payload.expected); // ['string', 'array']
 *   console.log(error.payload.actual); // 'number'
 * }
 * ```
 *
 * @param payload - Object containing expected types, actual type, argument position and name
 */
export const ArgumentTypeMismatch = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_TYPE_MISMATCH,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_TYPE_MISMATCH]) => payload,
  formatMessage: ({ expected }) => `Expected type ${formatTypes(expected)}.`,
  messageKey: 'formula_error.argument_type_mismatch',
});

/**
 * Error thrown when a callback is expected but not provided.
 *
 * @example
 * ```typescript
 * // Thrown automatically when callback is required
 * map([1, 2, 3], 'notACallback') // throws CallbackExpected
 *
 * // Manual creation
 * throw CallbackExpected.create({
 *   actual: 'string',
 *   argumentPosition: 2,
 *   argumentName: 'callback'
 * }, { location: node.location });
 *
 * // Type checking
 * if (CallbackExpected.is(error)) {
 *   console.log(error.payload.argumentName); // 'callback'
 *   console.log(error.payload.expected); // ['callback']
 * }
 * ```
 *
 * @param payload - Object without expected field (automatically set to ['callback'])
 */
export const CallbackExpected = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_TYPE_MISMATCH,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_TYPE_MISMATCH], 'expected'>) => ({
    ...payload,
    expected: ['callback'],
  }),
  formatMessage: ({ argumentName }) => `Expected callback for ${argumentName ?? 'an argument'}.`,
  messageKey: 'formula_error.callback_expected',
});

/**
 * Error thrown when a callback is provided but a value is expected.
 *
 * @example
 * ```typescript
 * // Thrown automatically when value is required
 * sum(x => x * 2) // throws UnexpectedCallback if sum expects number
 *
 * // Manual creation
 * throw UnexpectedCallback.create({
 *   expected: ['number', 'string'],
 *   argumentPosition: 1,
 *   argumentName: 'value'
 * }, { location: node.location });
 *
 * // Type checking
 * if (UnexpectedCallback.is(error)) {
 *   console.log(error.payload.actual); // 'callback'
 *   console.log(error.payload.expected); // ['number', 'string']
 * }
 * ```
 *
 * @param payload - Object without actual field (automatically set to 'callback')
 */
export const UnexpectedCallback = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_TYPE_MISMATCH,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_TYPE_MISMATCH], 'actual'>) => ({
    ...payload,
    actual: 'callback',
  }),
  formatMessage: ({ expected }) => `Expected type ${formatTypes(expected)}, but got callback.`,
  messageKey: 'formula_error.unexpected_callback',
});

/**
 * Error thrown when a callback returns a value of a type the routine does not accept.
 *
 * @example
 * ```typescript
 * // Thrown automatically when a callback result has the wrong type
 * filter([1], 2) // throws CallbackReturnTypeMismatch, location points at `2`
 *
 * // Type checking
 * if (CallbackReturnTypeMismatch.is(error)) {
 *   console.log(error.payload.expected); // ['Boolean']
 *   console.log(error.payload.actual); // 'Number'
 * }
 * ```
 *
 * @param payload - Expected return types, actual result type, and the callback argument's position and name
 */
export const CallbackReturnTypeMismatch = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_TYPE_MISMATCH,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_TYPE_MISMATCH]) => payload,
  formatMessage: ({ expected, actual }) => `Expected callback to return type ${formatTypes(expected)}, but got ${String(actual)}.`,
  messageKey: 'formula_error.callback_return_type_mismatch',
});

/**
 * Error thrown when an argument is provided at an unexpected position.
 *
 * @example
 * ```typescript
 * // Thrown automatically for extra arguments in strict patterns
 * pi(42) // throws UnexpectedArgument if pi expects 0 arguments
 *
 * // Manual creation
 * throw UnexpectedArgument.create({
 *   expected: [],
 *   actual: 'number',
 *   argumentPosition: 1
 * }, { location: node.location });
 *
 * // Type checking
 * if (UnexpectedArgument.is(error)) {
 *   console.log(error.payload.argumentPosition); // 1
 * }
 * ```
 *
 * @param payload - Object containing argument position and type information
 */
export const UnexpectedArgument = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_TYPE_MISMATCH,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_TYPE_MISMATCH]) => payload,
  formatMessage: ({ argumentPosition }) => `Unexpected argument at position ${argumentPosition}.`,
  messageKey: 'formula_error.unexpected_argument',
});

/**
 * Error thrown when an argument that takes values of a type or lists of them, nested at any depth, holds another value.
 *
 * @example
 * ```typescript
 * sum(1, ['a']) // throws NestedTypeMismatch: Expected type Number, or lists of it.
 *
 * if (NestedTypeMismatch.is(error)) {
 *   console.log(error.payload.expected); // ['Number'], the kinds of the values
 *   console.log(error.payload.actual); // 'String', the kind of the first value that is none of them
 * }
 * ```
 *
 * @param payload - Object containing the kinds of the values, the kind of the value found, and the argument position
 */
export const NestedTypeMismatch = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_TYPE_MISMATCH,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_TYPE_MISMATCH]) => payload,
  formatMessage: ({ expected }) => `Expected type ${formatTypes(expected)}, or lists of it.`,
  messageKey: 'formula_error.nested_type_mismatch',
});

/**
 * Error thrown when function arguments don't match any of the expected patterns.
 *
 * @example
 * ```typescript
 * // Thrown automatically during argument validation for overloaded functions
 * // Function with multiple patterns: if(condition, trueValue, falseValue)
 * if(123) // throws PatternMismatch - wrong argument count
 * if('not a boolean', 1, 2) // throws PatternMismatch - wrong argument type
 *
 * // Valid calls
 * if(true, 'yes', 'no') // OK - matches pattern
 * if(5 > 3, 100, 200) // OK - matches pattern
 *
 * // Manual creation with pattern errors
 * const patterns: PatternError[] = [
 *   {
 *     error: TooFewArguments.create({ expectedMin: 3, expectedMax: 3, actual: 1 }),
 *     message: 'Expected 3 arguments',
 *     score: 10
 *   },
 *   {
 *     error: ArgumentTypeMismatch.create({
 *       expected: ['boolean'],
 *       actual: 'number',
 *       argumentPosition: 1
 *     }),
 *     message: 'Expected type boolean',
 *     score: 5
 *   }
 * ];
 *
 * throw PatternMismatch.create({ patterns }, { location: node.location });
 *
 * // Type checking
 * if (PatternMismatch.is(error)) {
 *   console.log(error.payload.patterns.length); // 2
 *   console.log(error.payload.patterns[0].message); // 'Expected 3 arguments'
 * }
 * ```
 *
 * @param patterns - Array of pattern errors with messages and scores
 */
export const PatternMismatch = createErrorDefinition({
  code: FormulaErrorCode.PATTERN_MISMATCH,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.PATTERN_MISMATCH]) => payload,
  formatMessage: ({ patterns }) => {
    if (patterns.length === 0) {
      return 'Arguments don\'t match any pattern.';
    }

    if (patterns.length === 1) {
      return patterns[0].message;
    }

    const errorMessages = patterns
      .map((e, i) => `Pattern ${i + 1}: ${e.message}`)
      .join('; ');

    return `Arguments don't match. ${errorMessages}`;
  },
  messageKey: 'formula_error.pattern_mismatch',
});

/**
 * Error thrown when a validation function fails.
 *
 * @example
 * ```typescript
 * // Thrown by argument validators
 * // Example: validating date range
 * if (date < minDate) {
 *   throw ArgumentValidationError.create({
 *     expected: ['date after 2000-01-01'],
 *     actual: 'date',
 *     argumentPosition: 1,
 *     message: 'Date must be after 2000-01-01'
 *   }, { location: node.location });
 * }
 *
 * // Type checking
 * if (ArgumentValidationError.is(error)) {
 *   console.log(error.payload.message); // Validation message
 * }
 * ```
 *
 * @param payload - Object with validation message
 */
export const ArgumentValidationError = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_TYPE_MISMATCH,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_TYPE_MISMATCH]) => payload,
  formatMessage: ({ message }) => message || 'Argument validation error',
  messageKey: 'formula_error.argument_validation_error',
});

/**
 * Error thrown when an unknown or unexpected error occurs during argument validation.
 *
 * @example
 * ```typescript
 * // Thrown as a fallback for unhandled validation errors
 * try {
 *   validateArgument(value);
 * } catch (err) {
 *   throw ArgumentUnknownError.create({
 *     expected: [],
 *     actual: typeof value,
 *     argumentPosition: 1,
 *     message: String(err)
 *   }, { location: node.location });
 * }
 *
 * // Type checking
 * if (ArgumentUnknownError.is(error)) {
 *   console.log(error.payload.message); // Error details
 * }
 * ```
 *
 * @param payload - Object with error message and context
 */
export const ArgumentUnknownError = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_TYPE_MISMATCH,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_TYPE_MISMATCH]) => payload,
  formatMessage: ({ message }) => message || 'Unknown argument error.',
  messageKey: 'formula_error.unknown_argument_error',
});
