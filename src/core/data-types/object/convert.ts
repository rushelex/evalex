import type { ToFormulaDataType } from '../types';

import { convertObjectWithCircularCheck } from '../converter';
import { FormulaObject } from './FormulaObject';

/**
 * Static convert method for converting plain objects to Record<string, FormulaDataType>
 * This method handles nested objects directly without markers
 */
FormulaObject.convert = function <T extends Record<string, any>>(obj: T): ToFormulaDataType<T> {
  const visited = new WeakSet<object>();
  // Add the root object to visited set to prevent self-references
  visited.add(obj);
  return convertObjectWithCircularCheck(obj, visited) as ToFormulaDataType<T>;
};
