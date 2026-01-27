import type { Constructor } from 'type-fest';

import type { FormulaDataType } from '~/core';

import type { MatcherState } from './utils';

import { checkInstance, stringify } from './utils';

/**
 * Custom matcher that asserts a value is a specific FormulaDataType with the expected value.
 *
 * This matcher checks both the type (instanceof) and the value equality
 * using deep comparison via `this.equals()`.
 *
 * @example
 * ```ts
 * // Check a FormulaNumber with value 42
 * expect(result).toBeFormulaDataType(FormulaNumber, 42);
 *
 * // Check a FormulaString with a specific string
 * expect(result).toBeFormulaDataType(FormulaString, 'hello');
 *
 * // Check a FormulaArray with specific contents
 * expect(result).toBeFormulaDataType(FormulaArray, [1, 2, 3]);
 *
 * // Works with .not for negative assertions
 * expect(result).not.toBeFormulaDataType(FormulaNull, null);
 *
 * // Works with asymmetric matchers for the value
 * expect(result).toBeFormulaDataType(FormulaString, expect.stringContaining('hello'));
 * ```
 */
export function toBeFormulaDataType<TValue>(
  received: FormulaDataType<TValue>,
  expectedDataType: Constructor<FormulaDataType<TValue>>,
  expectedValue: TValue,
) {
  // @ts-expect-error - `this` is provided by expect.extend at runtime
  const context = this as MatcherState;
  const { isNot } = context;

  // Check instance type
  const instanceCheck = checkInstance(received, expectedDataType);
  const passInstance = instanceCheck.isInstance;

  // Check value equality using Vitest's deep equality (supports asymmetric matchers)
  const passValue = context.equals(received?.value, expectedValue);
  const pass = passInstance && passValue;

  return {
    pass,
    message: () => {
      if (isNot && pass) {
        return `Expected not to be ${expectedDataType.name} with value ${stringify(expectedValue)}, but it was`;
      }

      if (!passInstance) {
        return `${instanceCheck.actualTypeName} != ${instanceCheck.expectedTypeName}`;
      }

      if (!passValue) {
        return `${stringify(received.value)} != ${stringify(expectedValue)}`;
      }

      // Pass case (for .not assertions)
      return `${received.constructor.name} == ${expectedDataType.name}, ${stringify(received.value)} == ${stringify(expectedValue)}`;
    },
    actual: {
      type: instanceCheck.actualTypeName,
      value: received?.value,
    },
    expected: {
      type: instanceCheck.expectedTypeName,
      value: expectedValue,
    },
  };
}
