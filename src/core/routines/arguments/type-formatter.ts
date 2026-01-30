import type { Kind } from '../../data-types';

/**
 * Utility class for formatting data types for display purposes.
 * Handles both single types and union types.
 */
export class TypeFormatter {
  /**
   * Formats a single type or array of types into a human-readable string for type display.
   * Arrays are formatted as union types (e.g., "string | number").
   * @param types Single type or array of types to format
   * @returns Formatted string representation
   */
  formatTypes(types: Kind | Kind[]): string {
    if (Array.isArray(types)) {
      return types.join(' | ');
    }

    return types.toString();
  }

  /**
   * Formats expected and actual values for error context.
   * Arrays are preserved as arrays (e.g., [1, 2]).
   * @param expected Expected value(s)
   * @param actual Actual value
   * @returns Object with formatted expected and actual values
   */
  formatExpectedActual(expected: unknown, actual: unknown): { expected: unknown; actual: unknown } {
    return {
      expected: this.#formatErrorContextValue(expected),
      actual: this.#formatErrorContextValue(actual),
    };
  }

  /**
   * Formats a value for display in error context.
   * Arrays are preserved as arrays, other values are converted to strings.
   * @param value Value to format
   * @returns Formatted value for error context
   */
  #formatErrorContextValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return [...value]; // Preserve array structure for error context
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }

    return String(value);
  }
}
