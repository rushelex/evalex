import type { LocationTuple, MatcherState } from './utils';

import { FormulaError } from '~/core';

import {
  buildErrorMessageWithLocation,
  captureThrow,
  checkInstance,
} from './utils';

/**
 * Custom matcher that asserts a function throws a FormulaError with the specified message and location.
 *
 * The function is executed synchronously and any thrown error is checked
 * against the expected FormulaError type, message, and location.
 *
 * Supports asymmetric matchers for the error message.
 *
 * @example
 * ```ts
 * // Check that a function throws a specific FormulaError
 * expect(() => evaluate('1/0')).toThrowFormulaError('Division by zero', [0, 3]);
 *
 * // Check that parsing fails with a specific error
 * expect(() => parse('invalid')).toThrowFormulaError('Unexpected token', [0, 7]);
 *
 * // Works with .not for negative assertions
 * expect(() => evaluate('1+1')).not.toThrowFormulaError('Any error', [0, 3]);
 *
 * // Works with asymmetric matchers
 * expect(() => evaluate('1/0')).toThrowFormulaError(expect.stringContaining('zero'), [0, 3]);
 * ```
 */
export function toThrowFormulaError(
  received: () => void,
  errorMessage: unknown,
  location: LocationTuple,
) {
  // @ts-expect-error - `this` is provided by expect.extend at runtime
  const context = this as MatcherState;
  const { isNot } = context;

  // Execute function and capture any throw
  const { didThrow, thrown } = captureThrow(received);

  // Check instance type
  const instanceCheck = checkInstance(thrown, FormulaError);
  const isFormulaError = instanceCheck.isInstance;

  // Build expected message for display (only when errorMessage is a string)
  const isAsymmetricMatcher = typeof errorMessage === 'object' && errorMessage !== null && 'asymmetricMatch' in errorMessage;
  const expectedMessageDisplay = isAsymmetricMatcher
    ? String(errorMessage)
    : buildErrorMessageWithLocation(errorMessage as string, location);

  // Check message equality using Vitest's equals (supports asymmetric matchers)
  let hasCorrectMessage = false;
  if (isFormulaError) {
    const thrownError = thrown as FormulaError;
    if (isAsymmetricMatcher) {
      // For asymmetric matchers, check against the base message (without location suffix)
      const baseMessage = thrownError.message.replace(/\. \[\d+,\d+\]$/, '');
      hasCorrectMessage = context.equals(baseMessage, errorMessage);
    }
    else {
      // For direct string comparison, use the full message with location
      const expectedMessage = buildErrorMessageWithLocation(errorMessage as string, location);
      hasCorrectMessage = thrownError.message === expectedMessage;
    }
  }
  const pass = didThrow && isFormulaError && hasCorrectMessage;

  return {
    pass,
    message: () => {
      if (isNot && pass) {
        return `Expected function not to throw FormulaError with message "${expectedMessageDisplay}", but it did`;
      }

      if (!didThrow) {
        return `Expected function to throw FormulaError with message "${expectedMessageDisplay}", but it did not throw`;
      }

      if (!isFormulaError) {
        return `Expected FormulaError but got ${instanceCheck.actualTypeName}`;
      }

      if (!hasCorrectMessage) {
        return `Expected message "${expectedMessageDisplay}" but got "${(thrown as FormulaError).message}"`;
      }

      // This case should not happen when pass is true, but included for completeness
      return `Expected function ${isNot ? 'not ' : ''}to throw FormulaError with message "${expectedMessageDisplay}"`;
    },
    actual: !isFormulaError ? instanceCheck.actualTypeName : (thrown as FormulaError).message,
    expected: !isFormulaError ? 'FormulaError' : expectedMessageDisplay,
  };
}
