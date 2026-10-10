import type { FormulaDataType } from '~/core';

import type { evaluateOutcome } from '../evaluate-outcome';

import { areEqual, FormulaArray, FormulaNumber, FormulaObject } from '~/core/data-types';

type FormulaOutcome = ReturnType<typeof evaluateOutcome>;

interface MatcherResult {
  readonly pass: boolean;
  readonly message: () => string;
}

/**
 * Custom matcher that asserts two evaluations end the same way: with equal values, or with errors of the same kind.
 *
 * @remarks
 * Values are equal as in `==`, except that `NaN` equals `NaN`, so a routine that returns `NaN` in both call forms passes.
 * Errors match by code and message key; their locations and argument counts may differ between call forms.
 *
 * @example
 * ```ts
 * expect(evaluateOutcome('(1).add(2)')).toHaveSameOutcomeAs(evaluateOutcome('add(1, 2)'));
 * ```
 */
export function toHaveSameOutcomeAs(received: FormulaOutcome, expected: FormulaOutcome): MatcherResult {
  return {
    pass: isSameOutcome(received, expected),
    message: () => `${describe(received)} differs from ${describe(expected)}`,
  };
}

// Helpers

function isSameOutcome(received: FormulaOutcome, expected: FormulaOutcome): boolean {
  if ('value' in received && 'value' in expected) {
    return isSameValue(received.value, expected.value);
  }

  if ('error' in received && 'error' in expected) {
    return received.error.code === expected.error.code && received.error.messageKey === expected.error.messageKey;
  }

  return false;
}

function isSameValue(a: FormulaDataType, b: FormulaDataType): boolean {
  if (a instanceof FormulaNumber && b instanceof FormulaNumber) {
    return Object.is(a.value, b.value);
  }

  if (isList(a) && isList(b)) {
    return a.value.length === b.value.length && a.value.every((item, index) => isSameValue(item, b.value[index]));
  }

  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a.value);

    return keys.length === Object.keys(b.value).length && keys.every((key) => Object.hasOwn(b.value, key) && isSameValue(a.value[key], b.value[key]));
  }

  return areEqual(a, b);
}

// `instanceof` narrows a generic class to its `any` instantiation, so the guards name the item type.
function isList(value: FormulaDataType): value is FormulaArray<FormulaDataType> {
  return value instanceof FormulaArray;
}

function isObject(value: FormulaDataType): value is FormulaObject<Record<string, FormulaDataType>> {
  return value instanceof FormulaObject;
}

function describe(outcome: FormulaOutcome): string {
  return 'value' in outcome
    ? `${outcome.value.constructor.name}(${outcome.value.toString()})`
    : `${outcome.error.code} "${outcome.error.message}"`;
}
