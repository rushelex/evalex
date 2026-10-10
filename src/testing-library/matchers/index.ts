import type { Constructor } from 'type-fest';

import type { FormulaDataType } from '~/core';

import type { evaluateOutcome } from '../evaluate-outcome';

import { toBeCorrectRoutineExample } from './to-be-correct-routine-example';
import { toBeFormulaDataType } from './to-be-formula-data-type';
import { toHaveSameOutcomeAs } from './to-have-same-outcome-as';

// Register all matchers with Vitest
expect.extend({
  toBeCorrectRoutineExample,
  toBeFormulaDataType,
  toHaveSameOutcomeAs,
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

  /**
   * Asserts that two evaluations end the same way: with equal values, `NaN` included, or with errors of the same kind.
   *
   * @param expected - The outcome of the other evaluation, from `evaluateOutcome`
   *
   * @example
   * ```ts
   * expect(evaluateOutcome('(1).add(2)')).toHaveSameOutcomeAs(evaluateOutcome('add(1, 2)'));
   * ```
   */
  toHaveSameOutcomeAs: (expected: ReturnType<typeof evaluateOutcome>) => R;
}

declare module 'vitest' {
  // eslint-disable-next-line unused-imports/no-unused-vars -- augmentation must repeat Vitest's type parameters
  interface Matchers<R, T> extends CustomMatchers<R> {}
}
