import type { Constructor } from 'type-fest';

import type { FormulaDataType } from '~/core';

import type { LocationTuple } from './utils';

import { toBeFormulaDataType } from './to-be-formula-data-type';
import { toBeFormulaError } from './to-be-formula-error';
import { toThrowFormulaError } from './to-throw-formula-error';
import { toThrowSyntaxError } from './to-throw-syntax-error';

/**
 * Type for parameters that accept either a direct string or an asymmetric matcher.
 * Vitest's asymmetric matchers (expect.stringContaining, etc.) return `any`,
 * so we need to accept both string and any to allow their usage without ESLint errors.
 *
 * @example
 * ```ts
 * // Direct string
 * expect(error).toBeFormulaError('Division by zero', [5, 10]);
 * // Asymmetric matcher
 * expect(error).toBeFormulaError(expect.stringContaining('zero'), [5, 10]);
 * ```
 */

// Register all matchers with Vitest
expect.extend({
  toBeFormulaDataType,
  toBeFormulaError,
  toThrowFormulaError,
  toThrowSyntaxError,
});

/**
 * Custom matchers interface for extending Vitest's expect.
 */
interface CustomMatchers<R = unknown> {
  /**
   * Asserts that a value is a specific FormulaDataType with the expected value.
   *
   * @param expectedDataType - The expected constructor type (e.g., FormulaNumber)
   * @param expectedValue - The expected inner value
   *
   * @example
   * ```ts
   * expect(result).toBeFormulaDataType(FormulaNumber, 42);
   * expect(result).toBeFormulaDataType(FormulaString, expect.stringContaining('hello'));
   * ```
   */
  toBeFormulaDataType: <TValue>(
    expectedDataType: Constructor<FormulaDataType<TValue>>,
    expectedValue: TValue,
  ) => R;

  /**
   * Asserts that a value is a FormulaError with the specified message and location.
   *
   * Supports asymmetric matchers for the error message.
   *
   * @param errorMessage - The expected error message (without location suffix) or asymmetric matcher
   * @param location - The expected [start, end] location tuple
   *
   * @example
   * ```ts
   * expect(error).toBeFormulaError('Division by zero', [5, 10]);
   * expect(error).toBeFormulaError(expect.stringContaining('zero'), [5, 10]);
   * ```
   */
  toBeFormulaError: (
    errorMessage: unknown,
    location: LocationTuple,
  ) => R;

  /**
   * Asserts that a function throws a FormulaError with the specified message and location.
   *
   * Supports asymmetric matchers for the error message.
   *
   * @param errorMessage - The expected error message (without location suffix) or asymmetric matcher
   * @param location - The expected [start, end] location tuple
   *
   * @example
   * ```ts
   * expect(() => evaluate('1/0')).toThrowFormulaError('Division by zero', [0, 3]);
   * expect(() => evaluate('1/0')).toThrowFormulaError(expect.stringContaining('zero'), [0, 3]);
   * ```
   */
  toThrowFormulaError: (
    errorMessage: unknown,
    location: LocationTuple,
  ) => R;

  /**
   * Asserts that a function throws a SyntaxError with the specified message and location.
   *
   * Supports asymmetric matchers for the error message.
   *
   * @param errorMessage - The expected error message (without location suffix) or asymmetric matcher
   * @param location - The expected [start, end] location tuple
   *
   * @example
   * ```ts
   * expect(() => parse('foo bar')).toThrowSyntaxError('Unexpected identifier', [4, 7]);
   * expect(() => parse('foo bar')).toThrowSyntaxError(expect.any(String), [4, 7]);
   * ```
   */
  toThrowSyntaxError: (
    errorMessage: unknown,
    location: LocationTuple,
  ) => R;
}

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
