import type { FormulaDataType, FormulaType } from '../core';

import { FormulaArray, Kind } from '../core';
import { unionOf } from '../core/types';

/** The narrowest type of a value: its kind, and for a list the types of its items. */
export function typeOfValue(value: FormulaDataType): FormulaType {
  if (isList(value)) {
    return { kind: Kind.Array, items: unionOf(value.value.map(typeOfValue)) };
  }

  const { kind } = value;

  return kind === Kind.Array ? { kind, items: { kind: Kind.Any } } : { kind };
}

// `instanceof` narrows a generic class to its `any` instantiation, so the guard names the item type.
function isList(value: FormulaDataType): value is FormulaArray<FormulaDataType> {
  return value instanceof FormulaArray;
}
