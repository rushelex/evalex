import type { TypedArray } from './types';

import { Temporal } from 'temporal-polyfill';

import { FormulaArray } from './array';
import { FormulaBoolean } from './boolean';
import { FormulaDate } from './date';
import { FormulaDateRange } from './date-range';
import { FormulaDuration } from './duration';
import { FormulaDataType } from './FormulaDataType';
import { FormulaNull } from './null';
import { FormulaNumber } from './number';
import { FormulaObject } from './object';
import { FormulaRegExp } from './regexp';
import { FormulaString } from './string';

/** Lists and objects a host value may nest; deeper data would overflow the stack of the recursive steps that read it. */
const MAX_NESTING = 1000;

const IDENTIFIER = /^[A-Z_$][\w$]*$/i;

/** Where a value sits inside the host data being converted. */
interface Position {
  readonly path: string;
  readonly nesting: number;
  /** Lists and objects that enclose the value, to tell a circular reference from a value shared by two places. */
  readonly ancestors: WeakSet<object>;
}

/**
 * Converts a host value to a formula value, the single path every host value takes.
 *
 * @remarks
 * A value with an obvious formula form converts to it: a `Set` or a typed array becomes a list, a boxed primitive its
 * primitive, a `bigint` within the safe integers a number, a `Temporal` instant, date or date-time a date read in UTC.
 * An object of exactly two fields, `start` and `end`, both dates, becomes a date range. Any other plain object or class
 * instance becomes an object of its own enumerable fields; fields holding functions are left out, like methods.
 * A formula value is kept as it is.
 *
 * @throws TypeError naming the path to the first value without a formula form: a function in place of a value, a symbol, `NaN`, a `Date`
 * that holds no instant, a `bigint` beyond the safe integers, a built-in object such as `Map` or `Promise`, a date range
 * that ends before it starts, a circular reference, or nesting deeper than 1000 lists and objects. An error thrown by
 * a field getter reaches the caller unchanged.
 */
export function convertValueToFormulaType(value: unknown): FormulaDataType {
  return convert(value, rootPosition());
}

/** Converts a host value a formula reads by `name`, so a rejection names the path from it: `order.lines[2]`. */
export function convertNamedValue({ name, value }: { name: string; value: unknown }): FormulaDataType {
  return convert(value, { ...rootPosition(), path: name });
}

/** Converts the items of a list passed to `FormulaArray.from`, treating the list itself as the root of the host data. */
export function convertListItems(items: readonly unknown[]): FormulaDataType[] {
  return convertItems(items, rootPosition());
}

/** Converts the fields of an object passed to `FormulaObject.from`, treating the object itself as the root of the host data. */
export function convertObjectFields(object: object): Record<string, FormulaDataType> {
  return convertFields(object, rootPosition());
}

function rootPosition(): Position {
  return { path: '', nesting: 0, ancestors: new WeakSet() };
}

function convert(value: unknown, position: Position): FormulaDataType {
  if (isFormulaDataType(value)) {
    return value;
  }

  switch (typeof value) {
    case 'undefined':
      return new FormulaNull();

    case 'object':
      return value === null ? new FormulaNull() : convertObject(value, position);

    case 'string':
      return FormulaString.from(value);

    case 'number':
      return Number.isNaN(value) ? reject(position, 'NaN has no formula form') : FormulaNumber.from(value);

    case 'boolean':
      return FormulaBoolean.from(value);

    case 'bigint':
      return isSafeBigInt(value) ? FormulaNumber.from(Number(value)) : reject(position, `bigint ${value} is outside the safe integer range`);

    case 'function':
    case 'symbol':
      return reject(position, `${builtInName(value)} has no formula form`);
  }
}

function convertObject(value: object, position: Position): FormulaDataType {
  const name = builtInName(value);

  if (name === 'Number' || name === 'String' || name === 'Boolean') {
    return convert(value.valueOf(), position);
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? reject(position, 'Invalid Date has no formula form') : FormulaDate.from(value);
  }

  const date = toZonedDateTime(value);

  if (date) {
    return FormulaDate.from(date);
  }

  if (value instanceof Temporal.Duration) {
    return FormulaDuration.from(value);
  }

  if (value instanceof RegExp) {
    return FormulaRegExp.from(value);
  }

  if (Array.isArray(value) || value instanceof Set || isTypedArray(value)) {
    return new FormulaArray(convertItems(value, position));
  }

  // Plain objects, objects without a prototype and class instances all report `Object`; built-ins report their own name.
  if (name === 'Object') {
    return toDateRange(value, position) ?? new FormulaObject(convertFields(value, position));
  }

  return reject(position, `${name} has no formula form`);
}

/** The date range an object of exactly a `start` and an `end` date stands for, the form a date range takes outside formulas. */
function toDateRange(value: object, position: Position): FormulaDateRange | undefined {
  const fields = ownFields(value);

  if (fields.length !== 2) {
    return undefined;
  }

  const { start, end } = Object.fromEntries(fields);
  const startDate = toDate(start);
  const endDate = toDate(end);

  if (!startDate || !endDate) {
    return undefined;
  }

  // The shape alone makes a range, so an end before the start is an error rather than a reason to keep an object.
  if (Temporal.ZonedDateTime.compare(startDate, endDate) > 0) {
    return reject(position, 'the date range ends before it starts');
  }

  return new FormulaDateRange({ start: startDate, end: endDate });
}

/** The date a value converts to, or `undefined` when it does not convert to a date. */
function toDate(value: unknown): Temporal.ZonedDateTime | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : FormulaDate.from(value).value;
  }

  const date = typeof value === 'object' && value !== null ? toZonedDateTime(value) : undefined;

  return date && FormulaDate.from(date).value;
}

function convertItems(container: Iterable<unknown> | ArrayLike<unknown>, position: Position): FormulaDataType[] {
  return within(container, position, (inner) => {
    // `Array.from` visits holes of a sparse list as `undefined`, which `map` skips.
    return Array.from(container, (item, index) => convert(item, { ...inner, path: `${position.path}[${index}]` }));
  });
}

function convertFields(container: object, position: Position): Record<string, FormulaDataType> {
  return within(container, position, (inner) => {
    // `Object.fromEntries` defines each key as a field, so a `__proto__` key stays data instead of replacing the prototype.
    return Object.fromEntries(ownFields(container).map(([key, item]) => [key, convert(item, { ...inner, path: fieldPath(position.path, key) })]));
  });
}

/** The own enumerable fields of an object, except those holding functions, which are left out like methods. */
function ownFields(object: object): [string, unknown][] {
  return Object.entries(object).filter(([, value]) => typeof value !== 'function');
}

/** Runs `read` with `container` counted among the ancestors of its items, rejecting a circular reference and too deep nesting. */
function within<T>(container: object, position: Position, read: (inner: Position) => T): T {
  if (position.ancestors.has(container)) {
    return reject(position, 'it is a circular reference');
  }

  if (position.nesting >= MAX_NESTING) {
    return reject(position, `it is nested deeper than ${MAX_NESTING} levels`);
  }

  position.ancestors.add(container);

  try {
    return read({ ...position, nesting: position.nesting + 1 });
  }
  finally {
    position.ancestors.delete(container);
  }
}

function toZonedDateTime(value: object): Temporal.ZonedDateTime | undefined {
  if (value instanceof Temporal.ZonedDateTime) {
    return value;
  }

  if (value instanceof Temporal.Instant) {
    return value.toZonedDateTimeISO('UTC');
  }

  if (value instanceof Temporal.PlainDateTime || value instanceof Temporal.PlainDate) {
    return value.toZonedDateTime('UTC');
  }

  return undefined;
}

// `instanceof` narrows a generic class to its `any` instantiation, so the guard names the base type.
function isFormulaDataType(value: unknown): value is FormulaDataType {
  return value instanceof FormulaDataType;
}

function isTypedArray(value: object): value is TypedArray {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function isSafeBigInt(value: bigint): boolean {
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER);
}

/** The name the engine reports for a value, such as `Map`, `Function` or `Object`, the same in every engine and locale. */
function builtInName(value: unknown): string {
  return Object.prototype.toString.call(value).slice('[object '.length, -1);
}

function fieldPath(parent: string, key: string): string {
  if (!IDENTIFIER.test(key)) {
    return `${parent}[${JSON.stringify(key)}]`;
  }

  return parent === '' ? key : `${parent}.${key}`;
}

function reject(position: Position, reason: string): never {
  throw new TypeError(`Cannot convert ${position.path === '' ? 'the value' : position.path} to a formula value: ${reason}.`);
}
