import type { Class } from 'type-fest';

import type { FormulaDataType } from './FormulaDataType';

import { FormulaArray } from './array';
import { FormulaBoolean } from './boolean';
import { FormulaDate } from './date';
import { FormulaDuration } from './duration';
import { FormulaNull } from './null';
import { FormulaNumber } from './number';
import { FormulaObject } from './object';
import { FormulaRegExp } from './regexp';
import { FormulaString } from './string';

/**
 * Every formula data type, for routines whose method form exists on any value.
 */
export const ALL_DATA_TYPES: ReadonlyArray<Class<FormulaDataType>> = [
  FormulaArray,
  FormulaBoolean,
  FormulaDate,
  FormulaDuration,
  FormulaNull,
  FormulaNumber,
  FormulaObject,
  FormulaRegExp,
  FormulaString,
];
