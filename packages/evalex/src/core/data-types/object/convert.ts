import type { ToFormulaDataType } from '../types';

import { convertObjectFields } from '../converter';
import { FormulaObject } from './FormulaObject';

/**
 * Static convert method for converting plain objects to Record<string, FormulaDataType>
 * This method handles nested objects directly without markers
 */
FormulaObject.convert = function <T extends Record<string, any>>(obj: T): ToFormulaDataType<T> {
  return convertObjectFields(obj) as ToFormulaDataType<T>;
};
