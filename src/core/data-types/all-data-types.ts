import type { Class } from 'type-fest';

import type { FormulaDataType } from './FormulaDataType';
import type { Kind } from './kind';

import { FormulaArray } from './array';
import { FormulaBoolean } from './boolean';
import { FormulaDate } from './date';
import { FormulaDateRange } from './date-range';
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

/** A value a formula computes, of one of the data types, told apart by its `kind`. */
export type FormulaValue = InstanceType<DataTypeClass>;

/** Tells whether a value is of one of the data types, so its `kind` names its class. */
export function isFormulaValue(value: FormulaDataType): value is FormulaValue {
  return ALL_DATA_TYPES.some((dataType) => value instanceof dataType);
}
