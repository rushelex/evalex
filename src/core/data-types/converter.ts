import type { TypedArray } from './types';

import { FormulaArray } from './array';
import { FormulaBoolean } from './boolean';
import { FormulaDateRange } from './date-range';
import { FormulaDateTime } from './date-time';
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
  /** Lists that enclose the value, to tell a list that contains itself from a list shared by two places. */
  readonly ancestors: WeakSet<object>;
  /** Objects converted from the same host data, so a link back to one of them closes a loop instead of growing the tree. */
  readonly objects: WeakMap<object, FormulaObject>;
  readonly readCell: CellReader | undefined;
}

/**
 * Reads a field or a list item of host data in place of the converter: the value a computed cell holds, or the host
 * value converted.
 *
 * @remarks
 * `read` gives the host value, running a getter of the host if the field has one, and `convert` converts it; both fail
 * on the host side, so the reader decides what a failure becomes.
 */
export type CellReader = (cell: {
  place: CellPlace;
  read: () => unknown;
  convert: (value: unknown) => FormulaDataType;
}) => FormulaDataType;

/** The object or list that holds a cell, and the key of the cell in it. */
export interface CellPlace {
  readonly owner: object;
  readonly key: string | number;
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
 * A field of an object converts the first time it is read, so a field nobody reads never fails, a host getter runs only
 * when its field is read, and objects that link back to each other convert into objects that do the same.
 *
 * @throws TypeError naming the path to the first value without a formula form: a function in place of a value, a symbol, `NaN`, `±Infinity`, a `Date`
 * that holds no instant, a `bigint` beyond the safe integers, a built-in object such as `Map` or `Promise`, a date range
 * that ends before it starts, a list that contains itself, or nesting deeper than 1000 lists and objects. Inside an
 * object, it is thrown when the field is read, and so is an error a field getter throws, unchanged.
 */
export function convertValueToFormulaType(value: unknown): FormulaDataType {
  return convert(value, rootPosition());
}

/**
 * Converts a host value a formula reads by `name`, so a rejection names the path from it: `order.lines[2]`.
 *
 * @remarks
 * `readCell` reads the fields and items inside the value in place of the converter, such as fields that hold formulas.
 */
export function convertNamedValue({ name, value, readCell }: {
  name: string;
  value: unknown;
  readCell?: CellReader;
}): FormulaDataType {
  return convert(value, { ...rootPosition(), path: name, readCell });
}

/**
 * What converting a host value reads of it beyond its identity, so a value changed in place converts differently: the
 * length of a list, the fields of an object, the instant of a `Date`. `undefined` for a value that does not change.
 *
 * @remarks
 * Shapes of one value compare with `Object.is`. Items and field values are not part of the shape: they are read, and
 * compared, as cells of their own.
 */
export function hostShape(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  if (Array.isArray(value) || isTypedArray(value)) {
    return value.length;
  }

  if (value instanceof Set) {
    return value.size;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (builtInName(value) !== 'Object') {
    return undefined;
  }

  const keys = fieldKeys(value);
  const range = keys.length === 2 && keys.includes('start') && keys.includes('end')
    ? [toDate(Reflect.get(value, 'start'))?.epochNanoseconds, toDate(Reflect.get(value, 'end'))?.epochNanoseconds]
    : [];

  return [...keys, ...range].join('\0');
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
  return { path: '', nesting: 0, ancestors: new WeakSet(), objects: new WeakMap(), readCell: undefined };
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
      return Number.isFinite(value) ? FormulaNumber.from(value) : reject(position, `${value} has no formula form`);

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
    return Number.isNaN(value.getTime()) ? reject(position, 'Invalid Date has no formula form') : FormulaDateTime.from(value);
  }

  const date = toZonedDateTime(value);

  if (date) {
    return FormulaDateTime.from(date);
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
    return toDateRange(value, position) ?? toObject(value, position);
  }

  return reject(position, `${name} has no formula form`);
}

/** The object a host object converts to, the same one wherever the host data links to it. */
function toObject(value: object, position: Position): FormulaObject {
  const converted = position.objects.get(value);

  if (converted) {
    return converted;
  }

  const object = new FormulaObject(convertFields(value, position));

  position.objects.set(value, object);

  return object;
}

/** The date range an object of exactly a `start` and an `end` date stands for, the form a date range takes outside formulas. */
function toDateRange(value: object, position: Position): FormulaDateRange | undefined {
  const keys = fieldKeys(value);

  if (keys.length !== 2 || !keys.includes('start') || !keys.includes('end')) {
    return undefined;
  }

  const start: unknown = Reflect.get(value, 'start');
  const end: unknown = Reflect.get(value, 'end');
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
    return Number.isNaN(value.getTime()) ? undefined : FormulaDateTime.from(value).value;
  }

  const date = typeof value === 'object' && value !== null ? toZonedDateTime(value) : undefined;

  return date && FormulaDateTime.from(date).value;
}

function convertItems(container: Iterable<unknown> | ArrayLike<unknown>, position: Position): FormulaDataType[] {
  return within(container, position, (inner) => {
    // `Array.from` visits holes of a sparse list as `undefined`, which `map` skips.
    return Array.from(container, (item, index) => convertCell({
      place: { owner: container, key: index },
      read: () => item,
      position: { ...inner, path: `${position.path}[${index}]` },
    }));
  });
}

function convertCell({ place, read, position }: { place: CellPlace; read: () => unknown; position: Position }): FormulaDataType {
  const convertValue = (value: unknown): FormulaDataType => convert(value, position);

  return position.readCell ? position.readCell({ place, read, convert: convertValue }) : convertValue(read());
}

/**
 * Fields that read and convert the host field the first time something reads them.
 *
 * @remarks
 * A field nobody reads never fails the value, a getter of the host runs only when its field is read, and a link back to
 * an enclosing object is converted only as far as it is followed.
 */
function convertFields(container: object, position: Position): Record<string, FormulaDataType> {
  if (position.nesting >= MAX_NESTING) {
    return reject(position, `it is nested deeper than ${MAX_NESTING} levels`);
  }

  // A link back to the object does not repeat a list that encloses it, so only lists that enclose a field stay ancestors.
  const inner: Position = { ...position, nesting: position.nesting + 1, ancestors: new WeakSet() };
  const fields: Record<string, FormulaDataType> = {};

  for (const key of fieldKeys(container)) {
    let converted: FormulaDataType | undefined;
    const readField = (): FormulaDataType => convertCell({
      place: { owner: container, key },
      read: (): unknown => Reflect.get(container, key),
      position: { ...inner, path: fieldPath(position.path, key) },
    });

    // Defining each key as a field keeps a `__proto__` key data instead of replacing the prototype. A reader may keep a
    // value across reads of changing data, so a field read through it is read again each time.
    Object.defineProperty(fields, key, {
      enumerable: true,
      get: position.readCell ? readField : () => converted ??= readField(),
    });
  }

  return fields;
}

/** The own enumerable fields of an object, except data fields holding functions, which are left out like methods. */
function fieldKeys(object: object): string[] {
  return Object.keys(object).filter((key) => typeof Object.getOwnPropertyDescriptor(object, key)?.value !== 'function');
}

/** Runs `read` with `container` counted among the ancestors of its items, rejecting a list that contains itself and too deep nesting. */
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
