import { FormulaError } from '~/core';

import type { LocationTuple, MatcherState } from './utils';

import {
  buildErrorMessageWithLocation,
  checkInstance,
} from './utils';

/**
 * Custom matcher that asserts a value is a FormulaError with the specified message and location.
 *
 * The error message is automatically formatted with the location suffix
 * in the format: "Message. [start,end]"
 *
 * Supports asymmetric matchers for the error message parameter.
 *
 * @example
 * ```ts
 * // Check a FormulaError with specific message and location
 * expect(error).toBeFormulaError('Division by zero', [5, 10]);
 *
 * // Works with .not for negative assertions
 * expect(error).not.toBeFormulaError('Wrong message', [0, 1]);
 *
 * // Works with asymmetric matchers
 * expect(error).toBeFormulaError(expect.stringContaining('zero'), [5, 10]);
 * ```
 */
export function toBeFormulaError(
  received: FormulaError,
  errorMessage: unknown,
  location: LocationTuple,
) {
  // @ts-expect-error - `this` is provided by expect.extend at runtime
  const context = this as MatcherState;
  const { isNot } = context;

  // Check instance type
  const instanceCheck = checkInstance(received, FormulaError);
  const isFormulaError = instanceCheck.isInstance;

  // Build expected message for display (only when errorMessage is a string)
  const isAsymmetricMatcher = typeof errorMessage === 'object' && errorMessage !== null && 'asymmetricMatch' in errorMessage;
  const expectedMessageDisplay = isAsymmetricMatcher
    ? String(errorMessage)
    : buildErrorMessageWithLocation(errorMessage as string, location);

  // Check message equality using Vitest's equals (supports asymmetric matchers)
  let hasCorrectMessage = false;
  if (isFormulaError) {
    if (isAsymmetricMatcher) {
      // For asymmetric matchers, check against the base message (without location suffix)
      const baseMessage = received.message.replace(/\. \[\d+,\d+\]$/, '');
      hasCorrectMessage = context.equals(baseMessage, errorMessage);
    }
    else {
      // For direct string comparison, use the full message with location
      const expectedMessage = buildErrorMessageWithLocation(errorMessage as string, location);
      hasCorrectMessage = received.message === expectedMessage;
    }
  }
  const pass = isFormulaError && hasCorrectMessage;

  return {
    pass,
    message: () => {
      if (isNot && pass) {
        return `Expected not to be FormulaError with message "${expectedMessageDisplay}", but it was`;
      }

      if (!isFormulaError) {
        return `Expected FormulaError but got ${instanceCheck.actualTypeName}`;
      }

      if (!hasCorrectMessage) {
        return `Expected message "${expectedMessageDisplay}" but got "${received.message}"`;
      }

      // This case should not happen when pass is true, but included for completeness
      return `Expected ${isNot ? 'not ' : ''}to be FormulaError with message "${expectedMessageDisplay}"`;
    },
    actual: !isFormulaError ? instanceCheck.actualTypeName : received.message,
    expected: !isFormulaError ? 'FormulaError' : expectedMessageDisplay,
  };
}
