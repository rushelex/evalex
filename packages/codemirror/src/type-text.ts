import type { FormulaType } from 'evalex';

/**
 * Writes a type the way a tooltip shows it: `Number`, `Array<String>`, `{ qty: Number }` for a record of known fields,
 * `Number | Null` for one of several types, and `T` for a type variable of a signature.
 */
export function typeText(type: FormulaType): string {
  if (type.kind === 'Array' || type.kind === 'Nested') {
    return `${type.kind}<${typeText(type.items)}>`;
  }

  if (type.kind === 'Object') {
    return type.fields ? `{ ${type.fields.map(({ name, type: fieldType }) => `${name}: ${fieldType ? typeText(fieldType) : 'Any'}`).join(', ')} }` : 'Object';
  }

  if (type.kind === 'Union') {
    return type.of.map(typeText).join(' | ');
  }

  return type.kind === 'Variable' ? type.name : type.kind;
}
