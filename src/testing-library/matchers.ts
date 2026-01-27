import type { Constructor } from 'type-fest';

import { SyntaxError } from '../parser/grammar/__generated__/grammar';

/**
 * Builds the full expected error message with location suffix.
 * Format: "Base message. [start,end]"
 * This mirrors the behavior in parse.ts buildErrorWithLocation function.
 */
function buildErrorMessageWithLocation(baseMessage: string, location: [number, number]): string {
  const normalizedMessage = baseMessage.endsWith('.') ? baseMessage : `${baseMessage}.`;
  return `${normalizedMessage} [${location[0]},${location[1]}]`;
}

expect.extend({
  toThrowSyntaxError(received: () => void, errorMessage: string, location: [start: number, end: number]) {
    const { isNot } = this;
    let thrown: unknown | null = null;
    let didThrow = false;

    try {
      received();
    }
    catch (error) {
      didThrow = true;
      thrown = error;
    }

    // Build the full expected message with location suffix
    const expectedFullMessage = buildErrorMessageWithLocation(errorMessage, location);

    // Determine if the test should pass
    const isSyntaxError = thrown instanceof SyntaxError;
    const syntaxError = thrown as SyntaxError;

    // Compare the full message including location suffix
    const hasCorrectMessage = isSyntaxError && syntaxError.message === expectedFullMessage;
    const hasLocation = isSyntaxError && syntaxError.location != null;
    const isStartLocationCorrect = hasLocation && syntaxError.location.start.offset === location[0];
    const isEndLocationCorrect = hasLocation && syntaxError.location.end.offset === location[1];

    // The matcher passes when:
    // - Function throws a SyntaxError with the correct message (including location suffix) and location object
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
          return `Expected function not to throw SyntaxError with message "${errorMessage}" at location [${location[0]}, ${location[1]}], but it did`;
        }

        if (!didThrow) {
          return `Expected function to throw SyntaxError with message "${errorMessage}", but it did not throw`;
        }

        if (!isSyntaxError) {
          return `Expected SyntaxError but got ${(thrown as Constructor<unknown>)?.constructor?.name || 'unknown'}`;
        }

        if (!hasCorrectMessage) {
          return `Expected message "${expectedFullMessage}" but got "${syntaxError.message}"`;
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
        return `Expected function ${isNot ? 'not ' : ''}to throw SyntaxError with message "${errorMessage}"`;
      },
      actual: !isSyntaxError
        ? (thrown as Constructor<unknown>)?.constructor?.name
        : syntaxError.message,
      expected: !isSyntaxError ? 'SyntaxError' : expectedFullMessage,
    };
  },
});

declare module 'vitest' {
  interface Matchers {
    toThrowSyntaxError: (errorMessage: string, location: [start: number, end: number]) => void;
  }
}
