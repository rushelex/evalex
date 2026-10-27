import { FormulaDataType } from './data-types';
import { Formula } from './formula';

/** What a read of an own field gives when the field does not exist, as told from a field holding `undefined`. */
export const ABSENT: unique symbol = Symbol('absent');

/** Tells whether a value is a list or a record whose fields can hold cells: a plain object or a class instance. */
export function isContainer(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || value instanceof Formula || value instanceof FormulaDataType) {
    return false;
  }

  return Array.isArray(value) || Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Reads a field or an item again the way a formula read it: an item of a list as the list gives it, a field of an
 * object only when it is an own field, `ABSENT` otherwise. A getter runs, and a getter that throws throws.
 */
export function readAgain(owner: object, key: string | number): unknown {
  if (Array.isArray(owner) || ArrayBuffer.isView(owner)) {
    return Reflect.get(owner, key);
  }

  return Object.hasOwn(owner, key) ? Reflect.get(owner, key) : ABSENT;
}
