import type { LocationTuple, MatcherState } from './utils';

import { SyntaxError } from '../../parser/grammar/__generated__/grammar';
import {
  buildErrorMessageWithLocation,
  captureThrow,
  checkInstance,
} from './utils';

/**
 * Custom matcher that asserts a function throws a SyntaxError with the specified message and location.
 *
 * This matcher validates:
 * 1. The function throws an error
 * 2. The error is an instance of SyntaxError (from the parser)
 * 3. The error message matches (with location suffix automatically added)
 * 4. The location object has correct start and end offsets
 *
 * Supports asymmetric matchers for the error message.
 *
 * @example
 * ```ts
 * // Check that parsing throws a specific SyntaxError
 * expect(() => parse('foo bar')).toThrowSyntaxError('Unexpected identifier', [4, 7]);
 *
 * // Error message can end with period or not
 * expect(() => parse('1 +')).toThrowSyntaxError('Unexpected end of input', [3, 3]);
 *
 * // Works with .not for negative assertions
 * expect(() => parse('1 + 2')).not.toThrowSyntaxError('Any error', [0, 5]);
 *
 * // Works with asymmetric matchers
 * expect(() => parse('foo bar')).toThrowSyntaxError(expect.any(String), [4, 7]);
 * ```
 */
export function toThrowSyntaxError(
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
  const instanceCheck = checkInstance(thrown, SyntaxError);
  const isSyntaxError = instanceCheck.isInstance;
  const syntaxError = thrown as SyntaxError;

  // Build expected message for display (only when errorMessage is a string)
  const isAsymmetricMatcher = typeof errorMessage === 'object' && errorMessage !== null && 'asymmetricMatch' in errorMessage;
  const expectedMessageDisplay = isAsymmetricMatcher
    ? String(errorMessage)
    : buildErrorMessageWithLocation(errorMessage as string, location);

  // Check message equality using Vitest's equals (supports asymmetric matchers)
  let hasCorrectMessage = false;
  if (isSyntaxError) {
    if (isAsymmetricMatcher) {
      // For asymmetric matchers, check against the base message (without location suffix)
      const baseMessage = syntaxError.message.replace(/\. \[\d+,\d+\]$/, '');
      hasCorrectMessage = context.equals(baseMessage, errorMessage);
    }
    else {
      // For direct string comparison, use the full message with location
      const expectedFullMessage = buildErrorMessageWithLocation(errorMessage as string, location);
      hasCorrectMessage = syntaxError.message === expectedFullMessage;
    }
  }

  // Check location object
  const hasLocation = isSyntaxError && syntaxError.location != null;
  const isStartLocationCorrect = hasLocation && syntaxError.location.start.offset === location[0];
  const isEndLocationCorrect = hasLocation && syntaxError.location.end.offset === location[1];

  const pass = didThrow
    && isSyntaxError
    && hasCorrectMessage
    && hasLocation
    && isStartLocationCorrect
    && isEndLocationCorrect;

  return {
    pass,
    message: () => {
      if (isNot && pass) {
        return `Expected function not to throw SyntaxError with message "${expectedMessageDisplay}" at location [${location[0]}, ${location[1]}], but it did`;
      }

      if (!didThrow) {
        return `Expected function to throw SyntaxError with message "${expectedMessageDisplay}", but it did not throw`;
      }

      if (!isSyntaxError) {
        return `Expected SyntaxError but got ${instanceCheck.actualTypeName}`;
      }

      if (!hasCorrectMessage) {
        return `Expected message "${expectedMessageDisplay}" but got "${syntaxError.message}"`;
      }

      if (!hasLocation) {
        return `Expected SyntaxError to have location, but location is undefined`;
      }

      if (!isStartLocationCorrect || !isEndLocationCorrect) {
        const actualLocation = `[${syntaxError.location.start.offset}, ${syntaxError.location.end.offset}]`;
        const expectedLocation = `[${location[0]}, ${location[1]}]`;
        return `Expected location ${expectedLocation} but got ${actualLocation}`;
      }

      // This case should not happen when pass is true, but included for completeness
      return `Expected function ${isNot ? 'not ' : ''}to throw SyntaxError with message "${expectedMessageDisplay}"`;
    },
    actual: !isSyntaxError ? instanceCheck.actualTypeName : syntaxError.message,
    expected: !isSyntaxError ? 'SyntaxError' : expectedMessageDisplay,
  };
}
