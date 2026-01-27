import type { Constructor } from 'type-fest';
import type { DiffOptions } from 'vitest';
import type { StringifyOptions } from 'vitest/internal/browser';

export interface MatcherState {
  error?: Error;
  equals: (a: unknown, b: unknown) => boolean;
  isExpectingAssertions?: boolean;
  isExpectingAssertionsError?: Error | null;
  isNot: boolean;
  promise: string;
  suppressedErrors: Array<Error>;
  testPath?: string;
  utils: {
    printDiffOrStringify: (a: unknown, b: unknown) => string | undefined;
    printReceived: (a: unknown) => string;
    printExpected: (a: unknown) => string;
    diff: (a: any, b: any, options?: DiffOptions | undefined) => string | undefined;
    stringify: (object: unknown, maxDepth?: number | undefined, options?: StringifyOptions | undefined) => string;
  };
}

/**
 * Location tuple representing [start, end] offsets in the source.
 */
export type LocationTuple = readonly [start: number, end: number];

/**
 * Result of checking an instance type with detailed information.
 */
export interface InstanceCheckResult {
  readonly isInstance: boolean;
  readonly actualTypeName: string;
  readonly expectedTypeName: string;
}

/**
 * Result of checking a thrown error with detailed information.
 */
export interface ThrowCheckResult {
  readonly didThrow: boolean;
  readonly thrown: unknown;
}

/**
 * Helper function to safely get constructor name from any value.
 * Handles null, undefined, and objects without constructor.
 *
 * @param value - The value to get the constructor name from
 * @returns The constructor name or a descriptive fallback
 */
export function getTypeName(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'object') {
    return value.constructor?.name ?? 'Object';
  }
  return typeof value;
}

/**
 * Builds the full expected error message with location suffix.
 * Format: "Base message. [start,end]"
 *
 * This mirrors the behavior in parse.ts buildErrorWithLocation function.
 *
 * @param baseMessage - The base error message without location
 * @param location - The [start, end] tuple of offsets
 * @returns The formatted message with location suffix
 *
 * @example
 * ```ts
 * buildErrorMessageWithLocation('Division by zero', [5, 10])
 * // Returns: "Division by zero. [5,10]"
 *
 * buildErrorMessageWithLocation('Already ends with period.', [0, 5])
 * // Returns: "Already ends with period. [0,5]"
 * ```
 */
export function buildErrorMessageWithLocation(baseMessage: string, location: LocationTuple): string {
  const normalizedMessage = baseMessage.endsWith('.') ? baseMessage : `${baseMessage}.`;
  return `${normalizedMessage} [${location[0]},${location[1]}]`;
}

/**
 * Checks if a value is an instance of a specific constructor.
 *
 * @param value - The value to check
 * @param expectedType - The expected constructor type
 * @returns Instance check result with type names
 */
export function checkInstance<T>(
  value: unknown,
  expectedType: Constructor<T>,
): InstanceCheckResult {
  return {
    isInstance: value instanceof expectedType,
    actualTypeName: getTypeName(value),
    expectedTypeName: expectedType.name,
  };
}

/**
 * Safely executes a function and captures any thrown error.
 *
 * @param fn - The function to execute
 * @returns Object containing throw status and captured error
 */
export function captureThrow(fn: () => void): ThrowCheckResult {
  try {
    fn();
    return { didThrow: false, thrown: null };
  }
  catch (error) {
    return { didThrow: true, thrown: error };
  }
}

/**
 * Converts a value to its string representation for error messages.
 * Unlike `utils.printReceived/printExpected`, this produces clean output
 * without color codes or additional formatting wrappers.
 *
 * @param value - The value to stringify
 * @returns Clean string representation
 *
 * @example
 * ```ts
 * stringify(42)         // "42"
 * stringify('hello')    // "'hello'"
 * stringify(null)       // "null"
 * stringify(undefined)  // "undefined"
 * stringify([1, 2])     // "[1, 2]"
 * ```
 */
export function stringify(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return `'${value}'`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stringify).join(', ')}]`;
  }
  if (typeof value === 'function') {
    // Normalize function stringification - collapse empty bodies
    const fnString = String(value);
    // Collapse empty function bodies to single line
    return fnString.replace(/\{\s*\}/g, '{}');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    }
    catch {
      return String(value);
    }
  }
  return String(value);
}
