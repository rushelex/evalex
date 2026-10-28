import type { FormulaLocation } from '../../parser';

import { InvalidRegExpPattern } from './definitions';
import { FormulaError } from './formula-error';

/**
 * Formats a single type or array of types into a human-readable string for type display.
 * Arrays are formatted as union types (e.g., "String | Number").
 * @param types Single type or array of types to format
 * @returns Formatted string representation
 */
export function formatTypes(types: unknown | readonly unknown[]): string {
  if (Array.isArray(types)) {
    return types.join(' | ');
  }

  return String(types);
}

/**
 * Creates InvalidRegExpPattern error from a SyntaxError or returns existing FormulaError.
 * Used to handle regexp compilation errors in string methods.
 *
 * @param error - Original error (SyntaxError or FormulaError)
 * @param location - AST location for error positioning
 * @param pattern - The regexp pattern that caused the error
 * @returns FormulaError with InvalidRegExpPattern code
 */
export function getRegExpFallbackError(
  error: unknown,
  location: FormulaLocation,
  pattern: string,
): FormulaError {
  if (error instanceof FormulaError) {
    return error as FormulaError;
  }

  const errorMessage = error instanceof SyntaxError
    ? error.message
    : `Invalid regular expression: ${error instanceof Error
      ? error.message
      : 'Unknown error'}`;

  const cause = error instanceof Error ? error : undefined;

  return InvalidRegExpPattern.create(
    { reason: errorMessage, expression: pattern },
    { location, cause },
  );
}
