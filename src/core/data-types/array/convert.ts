import type { ToFormulaDataType } from '../types';

import { convertValueToFormulaType } from '../converter';
import { FormulaArray } from './FormulaArray';

FormulaArray.convert = function <T>(items: T[]): ToFormulaDataType<T>[] {
  return items.map((item) => {
    return convertValueToFormulaType(item);
  }) as ToFormulaDataType<T>[];
};
