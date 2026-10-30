import type { FormulaDataType, FormulaType } from '../core';

import { FormulaArray, FormulaObject, Kind } from '../core';
import { unionOf } from '../core/types';

/** The narrowest type of a value: its kind, for a list the types of its items, and for a record its fields. */
export function typeOfValue(value: FormulaDataType): FormulaType {
  if (isList(value)) {
    return { kind: Kind.Array, items: unionOf(value.value.map(typeOfValue)) };
  }

  if (isRecord(value)) {
    return { kind: Kind.Object, fields: Object.entries(value.value).map(([name, field]) => ({ name, type: typeOfValue(field) })) };
  }

  const { kind } = value;

  return kind === Kind.Array ? { kind, items: { kind: Kind.Any } } : { kind };
}

// `instanceof` narrows a generic class to its `any` instantiation, so the guards name the types inside.
function isList(value: FormulaDataType): value is FormulaArray<FormulaDataType> {
  return value instanceof FormulaArray;
}

function isRecord(value: FormulaDataType): value is FormulaObject<Record<string, FormulaDataType>> {
  return value instanceof FormulaObject;
}
