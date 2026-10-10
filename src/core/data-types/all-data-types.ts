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
export const ALL_DATA_TYPES: ReadonlyArray<Class<FormulaDataType> & { readonly kind: Kind }> = [
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
];
