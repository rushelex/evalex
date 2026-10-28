import type { Class } from 'type-fest';

import type { FormulaDataType } from './FormulaDataType';
import type { Kind } from './kind';

import { FormulaArray } from './array';
import { FormulaBoolean } from './boolean';
import { FormulaDate } from './date';
import { FormulaDateRange } from './date-range';
import { FormulaDateTime } from './date-time';
import { FormulaDuration } from './duration';
import { FormulaNull } from './null';
import { FormulaNumber } from './number';
import { FormulaObject } from './object';
import { FormulaRegExp } from './regexp';
import { FormulaString } from './string';

/**
 * Every formula data type, for routines whose method form exists on any value.
 */
export const ALL_DATA_TYPES = [
  FormulaArray,
  FormulaBoolean,
  FormulaDate,
  FormulaDateTime,
  FormulaDateRange,
  FormulaDuration,
  FormulaNull,
  FormulaNumber,
  FormulaObject,
  FormulaRegExp,
  FormulaString,
] as const satisfies ReadonlyArray<Class<FormulaDataType> & { readonly kind: Kind }>;

/** A class of formula values. */
export type DataTypeClass = (typeof ALL_DATA_TYPES)[number];

/**
 * A value a formula computes, of one of the data types, told apart by its `kind`.
 *
 * @example
 * ```ts
 * function show(result: FormulaValue): string {
 *   return result.kind === 'Date' ? result.value.toLocaleString('en-GB') : result.toString();
 * }
 * ```
 */
export type FormulaValue = InstanceType<DataTypeClass>;

const DATA_TYPE_CLASSES: ReadonlySet<unknown> = new Set(ALL_DATA_TYPES);

/** Tells whether a value is of one of the data types, so its `kind` names its class. */
export function isFormulaValue(value: FormulaDataType): value is FormulaValue {
  // Every computed value is checked, and nearly all are instances of the classes themselves rather than of subclasses.
  return DATA_TYPE_CLASSES.has(value.constructor) || ALL_DATA_TYPES.some((dataType) => value instanceof dataType);
}
