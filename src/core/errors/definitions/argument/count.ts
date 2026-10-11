import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when a function receives too few arguments.
 *
 * @example
 * ```typescript
 * // Thrown automatically during argument validation
 * sum() // throws TooFewArguments if sum requires at least 1 argument
 *
 * // Manual creation
 * throw TooFewArguments.create({
 *   expectedMin: 2,
 *   expectedMax: 5,
 *   actual: 1
 * }, { location: node.location });
 *
 * // Type checking
 * if (TooFewArguments.is(error)) {
 *   console.log(error.payload.expectedMin); // 2
 *   console.log(error.payload.actual); // 1
 * }
 * ```
 *
 * @param payload - Object containing expectedMin, expectedMax, and actual argument counts
 */
export const TooFewArguments = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_COUNT_MISMATCH,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_COUNT_MISMATCH]) => payload,
  formatMessage: ({ expectedMin }) => `Expected at least ${expectedMin} argument(s).`,
  messageKey: 'formula_error.too_few_arguments',
});

/**
 * Error thrown when a function receives too many arguments.
 *
 * @example
 * ```typescript
 * // Thrown automatically during argument validation
 * pi(1, 2) // throws TooManyArguments if pi expects 0 arguments
 *
 * // Manual creation
 * throw TooManyArguments.create({
 *   expectedMin: 0,
 *   expectedMax: 2,
 *   actual: 5
 * }, { location: node.location });
 *
 * // With repeatable flag (sets expectedMax to Infinity)
 * throw TooManyArguments.create({
 *   expectedMin: 1,
 *   expectedMax: 3,
 *   actual: 10,
 *   hasRepeatable: true
 * }, { location: node.location });
 *
 * // Type checking
 * if (TooManyArguments.is(error)) {
 *   console.log(error.payload.expectedMax); // 2 or Infinity
 *   console.log(error.payload.actual); // 5
 * }
 * ```
 *
 * @param payload - Object containing expectedMin, expectedMax, actual, and optional hasRepeatable flag
 */
export const TooManyArguments = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_COUNT_MISMATCH,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_COUNT_MISMATCH] & { hasRepeatable?: boolean }) => ({
    expectedMin: payload.expectedMin,
    expectedMax: payload.hasRepeatable ? Infinity : payload.expectedMax,
    actual: payload.actual,
  }),
  formatMessage: ({ expectedMax }) => {
    return `Expected at most ${expectedMax} argument(s).`;
  },
  messageKey: 'formula_error.too_many_arguments',
});

/**
 * Error thrown when a function requires an exact number of arguments.
 *
 * @example
 * ```typescript
 * // Thrown automatically for functions with exact argument count
 * if(1) // throws ExactArgumentCount if if() expects exactly 3 arguments
 * pi(1) // throws ExactArgumentCount if pi() expects exactly 0 arguments
 *
 * // Manual creation
 * throw ExactArgumentCount.create(
 *   { expected: 3, actual: 1 },
 *   { location: node.location }
 * );
 *
 * // Type checking
 * if (ExactArgumentCount.is(error)) {
 *   console.log(error.payload.expectedMin); // 3
 *   console.log(error.payload.actual); // 1
 * }
 * ```
 *
 * @param payload - Object containing expectedMin, expectedMax (should be equal), and actual argument counts
 */
export const ExactArgumentCount = createErrorDefinition({
  code: FormulaErrorCode.ARGUMENT_COUNT_MISMATCH,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.ARGUMENT_COUNT_MISMATCH], 'expectedMin' | 'expectedMax'> & { expected: number }) => ({
    expectedMin: payload.expected,
    expectedMax: payload.expected,
    actual: payload.actual,
  }),
  formatMessage: ({ expectedMax }) => {
    if (expectedMax === 0) {
      return `Expected no arguments.`;
    }

    if (expectedMax === 1) {
      return `Expected 1 argument.`;
    }

    return `Expected ${expectedMax} arguments.`;
  },
  messageKey: 'formula_error.exact_argument_count',
});
