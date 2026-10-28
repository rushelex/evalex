import type { FormulaDataType } from './FormulaDataType';

import { FormulaArray } from './array';
import { FormulaDate } from './date';
import { FormulaDateRange } from './date-range';
import { FormulaDuration } from './duration';
import { FormulaObject } from './object';
import { FormulaRegExp } from './regexp';

const DURATION_FIELDS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds'] as const;

/**
 * Compares two formula values by content, the equality behind `==`, `!=`, `equal` and the list routines.
 *
 * @remarks
 * Lists are equal item by item in order, objects key by key in any order, dates when they mark the same instant, date ranges when both ends do,
 * durations when every field matches (`P1D` differs from `PT24H`), regular expressions by pattern and flags.
 * Values of different types are never equal, and `NaN` is not equal to itself. Objects that link back to themselves are
 * equal when nothing reachable from them differs.
 */
export function areEqual(a: FormulaDataType, b: FormulaDataType): boolean {
  return compare(a, b, new Map());
}

/** Compares two values; `comparing` holds the pairs of objects whose comparison is under way. */
function compare(a: FormulaDataType, b: FormulaDataType, comparing: Map<FormulaObject, Set<FormulaObject>>): boolean {
  if (a.kind !== b.kind) {
    return false;
  }

  if (isList(a) && isList(b)) {
    return a.value.length === b.value.length && a.value.every((item, index) => compare(item, b.value[index], comparing));
  }

  if (isObject(a) && isObject(b)) {
    return compareObjects(a, b, comparing);
  }

  if (a instanceof FormulaDate && b instanceof FormulaDate) {
    return isSameInstant(a.value, b.value);
  }

  if (a instanceof FormulaDateRange && b instanceof FormulaDateRange) {
    return isSameInstant(a.value.start, b.value.start) && isSameInstant(a.value.end, b.value.end);
  }

  if (a instanceof FormulaDuration && b instanceof FormulaDuration) {
    return DURATION_FIELDS.every((field) => a.value[field] === b.value[field]);
  }

  if (a instanceof FormulaRegExp && b instanceof FormulaRegExp) {
    return a.pattern === b.pattern && a.flags === b.flags;
  }

  return a.value === b.value;
}

function compareObjects(a: FormulaObject, b: FormulaObject, comparing: Map<FormulaObject, Set<FormulaObject>>): boolean {
  const against = comparing.get(a) ?? new Set();

  // A pair met again while its comparison is under way differs only if some other field differs, which that comparison finds.
  if (against.has(b)) {
    return true;
  }

  comparing.set(a, against.add(b));

  try {
    const keys = Object.keys(a.value);

    return keys.length === Object.keys(b.value).length
      && keys.every((key) => Object.hasOwn(b.value, key) && compare(a.value[key], b.value[key], comparing));
  }
  finally {
    against.delete(b);
  }
}

function isSameInstant(a: Temporal.ZonedDateTime, b: Temporal.ZonedDateTime): boolean {
  return Temporal.Instant.compare(a.toInstant(), b.toInstant()) === 0;
}

// `instanceof` narrows a generic class to its `any` instantiation, so the guards name the item type.
function isList(value: FormulaDataType): value is FormulaArray<FormulaDataType> {
  return value instanceof FormulaArray;
}

function isObject(value: FormulaDataType): value is FormulaObject<Record<string, FormulaDataType>> {
  return value instanceof FormulaObject;
}
