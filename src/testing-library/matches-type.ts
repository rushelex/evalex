import type { FormulaDataType, FormulaType } from '../core';

import { FormulaArray, Kind } from '../core';

/** Tells whether a value is one the type describes, items of a list included. */
export function matchesType(value: FormulaDataType, type: FormulaType): boolean {
  if (type.kind === 'Union') {
    return type.of.some((member) => matchesType(value, member));
  }

  if (type.kind === Kind.Array) {
    return isList(value) && value.value.every((item) => matchesType(item, type.items));
  }

  return type.kind === Kind.Any || value.kind === type.kind;
}

// `instanceof` narrows a generic class to its `any` instantiation, so the guard names the item type.
function isList(value: FormulaDataType): value is FormulaArray<FormulaDataType> {
  return value instanceof FormulaArray;
}
