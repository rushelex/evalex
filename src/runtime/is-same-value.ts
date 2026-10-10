import type { FormulaDataType } from '../core';

/**
 * Tells whether a new value certainly equals the previous one, so whatever was computed from it stays valid.
 *
 * @remarks
 * Values are immutable, so the same instance is the same value. Apart from that only numbers, strings,
 * booleans and null are compared, by content; other lists, objects and dates count as changed,
 * since a date in another time zone is the same instant but shows differently.
 */
export function isSameValue(previous: FormulaDataType, next: FormulaDataType): boolean {
  if (previous === next) {
    return true;
  }

  if (previous.kind !== next.kind) {
    return false;
  }

  const value = previous.value;
  const isPrimitive = value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';

  return isPrimitive && Object.is(value, next.value);
}
