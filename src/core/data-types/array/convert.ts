import type { ToFormulaDataType } from '../types';

import { convertListItems } from '../converter';
import { FormulaArray } from './FormulaArray';

FormulaArray.convert = function <T>(items: T[]): ToFormulaDataType<T>[] {
  return convertListItems(items) as ToFormulaDataType<T>[];
};
