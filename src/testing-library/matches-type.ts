import type { FormulaDataType, FormulaType } from '../core';

import { FormulaArray, FormulaObject, Kind } from '../core';

/**
 * Tells whether a value is one the type describes, items of a list and fields of a record included; a type variable
 * admits any value.
 */
export function matchesType(value: FormulaDataType, type: FormulaType): boolean {
  if (type.kind === 'Union') {
    return type.of.some((member) => matchesType(value, member));
  }

  if (type.kind === Kind.Array) {
    return isList(value) && value.value.every((item) => matchesType(item, type.items));
  }

  if (type.kind === Kind.Object) {
    return isRecord(value) && (type.fields ?? []).every(({ name, type: fieldType }) => {
      const field = Object.hasOwn(value.value, name) ? value.value[name] : undefined;

      return field !== undefined && (!fieldType || matchesType(field, fieldType));
    });
  }

  return type.kind === Kind.Any || type.kind === 'Variable' || value.kind === type.kind;
}

// `instanceof` narrows a generic class to its `any` instantiation, so the guards name the types inside.
function isList(value: FormulaDataType): value is FormulaArray<FormulaDataType> {
  return value instanceof FormulaArray;
}

function isRecord(value: FormulaDataType): value is FormulaObject<Record<string, FormulaDataType>> {
  return value instanceof FormulaObject;
}
