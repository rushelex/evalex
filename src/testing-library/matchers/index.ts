import type { Constructor } from 'type-fest';

import type { FormulaDataType } from '~/core';

import { toBeCorrectRoutineExample } from './to-be-correct-routine-example';
import { toBeFormulaDataType } from './to-be-formula-data-type';

// Register all matchers with Vitest
expect.extend({
  toBeCorrectRoutineExample,
  toBeFormulaDataType,
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
   * Asserts that a routine example returns its result, or fails with its error, in the given call form.
   *
   * @param form - The call form the example is written in
   *
   * @example
   * ```ts
   * expect(example).toBeCorrectRoutineExample('method');
   * ```
   */
  toBeCorrectRoutineExample: (form: 'function' | 'method') => R;
}

declare module 'vitest' {
  // eslint-disable-next-line unused-imports/no-unused-vars -- augmentation must repeat Vitest's type parameters
  interface Matchers<R, T> extends CustomMatchers<R> {}
}
