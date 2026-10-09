import type { Class } from 'type-fest';

import type { FormulaDataType } from '../data-types';

import {
  FormulaArray,
  FormulaBoolean,
  FormulaDate,
  FormulaDuration,
  FormulaNull,
  FormulaNumber,
  FormulaObject,
  FormulaRegExp,
  FormulaString,
} from '../data-types';

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
