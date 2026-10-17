import type { FormulaDataType } from './FormulaDataType';

import { fc, it } from '@fast-check/vitest';
import { Temporal } from 'temporal-polyfill';

import { FormulaArray } from './array';
import { convertValueToFormulaType } from './converter';
import { FormulaDate } from './date';
import { FormulaDateRange } from './date-range';
import { FormulaNumber } from './number';
import { FormulaObject } from './object';

// JSON text has no negative zero, so the round trip drops it as conversion does.
const jsonValue = fc.jsonValue().map((value) => JSON.parse(JSON.stringify(value)));

const hostValue = fc.anything({
  withBigInt: true,
  withBoxedValues: true,
  withDate: true,
  withMap: true,
  withNullPrototype: true,
  withObjectString: true,
  withSet: true,
  withSparseArray: true,
  withTypedArray: true,
});

/** Host values that have no formula form, with the reason a rejection gives for each. */
const valuesWithoutFormulaForm: ReadonlyArray<readonly [label: string, make: () => unknown, reason: string]> = [
  ['a function', () => () => 1, 'Function has no formula form'],
  ['a symbol', () => Symbol('s'), 'Symbol has no formula form'],
  ['a boxed symbol', () => new Object(Symbol('s')), 'Symbol has no formula form'],
  ['a map', () => new Map([[1, 2]]), 'Map has no formula form'],
  ['a weak map', () => new WeakMap(), 'WeakMap has no formula form'],
  ['a weak set', () => new WeakSet(), 'WeakSet has no formula form'],
  ['a promise', async () => 1, 'Promise has no formula form'],
  ['an error', () => new Error('x'), 'Error has no formula form'],
  ['an array buffer', () => new ArrayBuffer(2), 'ArrayBuffer has no formula form'],
  ['a data view', () => new DataView(new ArrayBuffer(2)), 'DataView has no formula form'],
  ['a time without a date', () => Temporal.PlainTime.from('10:00'), 'Temporal.PlainTime has no formula form'],
  ['NaN', () => Number.NaN, 'NaN has no formula form'],
  ['a date that holds no instant', () => new Date(Number.NaN), 'Invalid Date has no formula form'],
  ['a bigint beyond the safe integers', () => 2n ** 60n, 'bigint 1152921504606846976 is outside the safe integer range'],
];

describe(convertValueToFormulaType, () => {
  it.prop([hostValue])('should convert any host value or reject it with a TypeError', (value) => {
    const error = conversionError(() => convertValueToFormulaType(value));

    expect(error === undefined || error instanceof TypeError).toBe(true);
  });

  it.prop([jsonValue])('should keep every value of JSON data', (value) => {
    expect(toPlain(convertValueToFormulaType(value))).toEqual(withNumbersAsRead(value) ?? null);
  });

  it.prop([jsonValue])('should convert a value shared by two places in both of them', (value) => {
    expect(toPlain(convertValueToFormulaType([value, { again: value }]))).toEqual(withNumbersAsRead([value, { again: value }]));
  });

  it.prop([fc.date({ noInvalidDate: true })])('should keep the instant of a date', (date) => {
    const converted = convertValueToFormulaType(date);

    expect(converted).toBeInstanceOf(FormulaDate);
    expect(converted.value).toEqual(FormulaDate.from(date).value);
  });

  it('should keep a field named __proto__ as a field', () => {
    const converted = convertValueToFormulaType(JSON.parse('{"__proto__": 1}'));

    expect(isObject(converted) && Object.keys(converted.value)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(converted.value)).toBe(Object.prototype);
  });

  it('should convert a hole in a list to null', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(toPlain(convertValueToFormulaType([, 1]))).toEqual([null, 1]);
  });

  it('should keep a formula value found in host data as it is', () => {
    const price = new FormulaNumber(5);
    const converted = convertValueToFormulaType({ price });

    expect(isObject(converted) && converted.value.price).toBe(price);
  });

  it('should convert a class instance to an object of its own fields', () => {
    class Order {
      readonly qty = 2;

      get total(): number {
        return 10;
      }
    }

    expect(toPlain(convertValueToFormulaType(new Order()))).toEqual({ qty: 2 });
  });

  it('should let an error thrown by a field getter reach the host unchanged', () => {
    const failure = new Error('getter failed');
    const order = {
      get total(): number {
        throw failure;
      },
    };

    expect(conversionError(() => convertValueToFormulaType(order))).toBe(failure);
  });

  describe('values with an obvious formula form', () => {
    it.prop([fc.array(jsonValue)])('should convert a set like a list of its items', (items) => {
      expect(toPlain(convertValueToFormulaType(new Set(items)))).toEqual(toPlain(convertValueToFormulaType([...new Set(items)])));
    });

    it.prop([fc.oneof(fc.uint8Array(), fc.int32Array(), fc.float64Array({ noNaN: true }))])('should convert a typed array like a list of its numbers', (items) => {
      expect(toPlain(convertValueToFormulaType(items))).toEqual(toPlain(convertValueToFormulaType(Array.from(items))));
    });

    it.prop([fc.oneof(fc.string(), fc.double({ noNaN: true }), fc.boolean())])('should convert a boxed value like the value it holds', (value) => {
      expect(toPlain(convertValueToFormulaType(new Object(value)))).toEqual(toPlain(convertValueToFormulaType(value)));
    });

    it.prop([fc.bigInt({ min: BigInt(Number.MIN_SAFE_INTEGER), max: BigInt(Number.MAX_SAFE_INTEGER) })])('should convert a bigint within the safe integers to a number', (value) => {
      expect(convertValueToFormulaType(value).value).toBe(new FormulaNumber(Number(value)).value);
    });

    it('should convert an instant to the date at that instant', () => {
      const instant = Temporal.Instant.from('2024-07-28T14:35:00Z');

      expect(convertValueToFormulaType(instant).value).toEqual(FormulaDate.from(new Date('2024-07-28T14:35:00Z')).value);
    });

    it('should read a date and a date-time without a time zone in UTC', () => {
      expect(convertValueToFormulaType(Temporal.PlainDate.from('2024-07-28')).value).toEqual(FormulaDate.from(new Date('2024-07-28T00:00:00Z')).value);
      expect(convertValueToFormulaType(Temporal.PlainDateTime.from('2024-07-28T14:35')).value).toEqual(FormulaDate.from(new Date('2024-07-28T14:35:00Z')).value);
    });
  });

  describe('date ranges', () => {
    it.prop([fc.date({ noInvalidDate: true }), fc.date({ noInvalidDate: true })])('should convert an object of a start and an end date to a date range', (a, b) => {
      const [start, end] = a <= b ? [a, b] : [b, a];
      const converted = convertValueToFormulaType({ start, end });

      expect(converted).toBeInstanceOf(FormulaDateRange);
      expect(converted.value).toEqual(FormulaDateRange.from({ start, end }).value);
    });

    it.each([
      ['Date', (text: string) => new Date(`${text}T00:00:00Z`)],
      ['Temporal.ZonedDateTime', (text: string) => Temporal.ZonedDateTime.from(`${text}T03:00:00+03:00[Europe/Moscow]`)],
      ['Temporal.Instant', (text: string) => Temporal.Instant.from(`${text}T00:00:00Z`)],
      ['Temporal.PlainDateTime', (text: string) => Temporal.PlainDateTime.from(`${text}T00:00`)],
      ['Temporal.PlainDate', (text: string) => Temporal.PlainDate.from(text)],
    ])('should read the ends given as %s', (_label, make) => {
      const converted = convertValueToFormulaType({ start: make('2024-07-01'), end: make('2024-07-28') });

      expect(converted.value).toEqual(FormulaDateRange.from({ start: '2024-07-01', end: '2024-07-28' }).value);
    });

    it('should read ends of different date forms', () => {
      const converted = convertValueToFormulaType({ start: new Date('2024-07-01T00:00:00Z'), end: Temporal.PlainDate.from('2024-07-28') });

      expect(converted).toBeInstanceOf(FormulaDateRange);
    });

    it.each([
      ['a third field', { start: new Date('2024-07-01'), end: new Date('2024-07-28'), title: 'July' }],
      ['ends given as text', { start: '2024-07-01', end: '2024-07-28' }],
      ['ends given as timestamps', { start: 0, end: 1 }],
      ['only one of the ends', { start: new Date('2024-07-01') }],
      ['one end that is not a date', { start: new Date('2024-07-01'), end: null }],
    ])('should keep an object with %s as an object', (_label, value) => {
      expect(convertValueToFormulaType(value)).toBeInstanceOf(FormulaObject);
    });

    it('should reject a range that ends before its start, naming its place', () => {
      const error = conversionError(() => convertValueToFormulaType({ booking: { start: new Date('2024-07-28'), end: new Date('2024-07-01') } }));

      expect(error).toBeInstanceOf(TypeError);
      expect(error).toHaveProperty('message', 'Cannot convert booking to a formula value: the date range ends before it starts.');
    });
  });

  describe('values without a formula form', () => {
    it.each(valuesWithoutFormulaForm)('should reject %s', (_label, make, reason) => {
      const error = conversionError(() => convertValueToFormulaType({ field: make() }));

      expect(error).toBeInstanceOf(TypeError);
      expect(error).toHaveProperty('message', `Cannot convert field to a formula value: ${reason}.`);
    });

    it.prop([
      fc.array(fc.oneof(fc.nat({ max: 3 }), fc.stringMatching(/^[a-z]\w{0,5}$/)), { minLength: 1, maxLength: 6 }),
      fc.constantFrom(...valuesWithoutFormulaForm),
    ])('should name the place of the rejected value inside host data', (steps, [, make]) => {
      const data = steps.reduceRight<unknown>((inner, step) => typeof step === 'number' ? placeAt(step, inner) : Object.fromEntries([[step, inner]]), make());
      const path = steps.map((step, index) => typeof step === 'number' ? `[${step}]` : `${index === 0 ? '' : '.'}${step}`).join('');

      expect(conversionError(() => convertValueToFormulaType(data))).toHaveProperty('message', expect.stringMatching(new RegExp(`^Cannot convert ${escapeRegExp(path)} to a formula value: `)));
    });

    it.each([
      { key: 'first name', path: 'order["first name"]' },
      { key: '2nd', path: 'order["2nd"]' },
    ])('should quote the field name $key, which is not an identifier', ({ key, path }) => {
      const error = conversionError(() => convertValueToFormulaType({ order: { [key]: Symbol('s') } }));

      expect(error).toHaveProperty('message', `Cannot convert ${path} to a formula value: Symbol has no formula form.`);
    });

    it('should reject a bigint one past either end of the safe integers', () => {
      expect(convertValueToFormulaType(BigInt(Number.MAX_SAFE_INTEGER)).value).toBe(Number.MAX_SAFE_INTEGER);
      expect(convertValueToFormulaType(BigInt(Number.MIN_SAFE_INTEGER)).value).toBe(Number.MIN_SAFE_INTEGER);
      expect(conversionError(() => convertValueToFormulaType(BigInt(Number.MAX_SAFE_INTEGER) + 1n))).toBeInstanceOf(TypeError);
      expect(conversionError(() => convertValueToFormulaType(BigInt(Number.MIN_SAFE_INTEGER) - 1n))).toBeInstanceOf(TypeError);
    });

    it('should call a rejected value at the top level "the value"', () => {
      expect(conversionError(() => convertValueToFormulaType(Symbol('s')))).toHaveProperty('message', 'Cannot convert the value to a formula value: Symbol has no formula form.');
    });

    it('should reject an object that contains itself', () => {
      const order: Record<string, unknown> = { qty: 2 };
      order.lines = [{ order }];

      expect(conversionError(() => convertValueToFormulaType(order))).toHaveProperty('message', 'Cannot convert lines[0].order to a formula value: it is a circular reference.');
    });

    it('should reject a list that contains itself', () => {
      const list: unknown[] = [1];
      list.push(list);

      expect(conversionError(() => convertValueToFormulaType(list))).toHaveProperty('message', 'Cannot convert [1] to a formula value: it is a circular reference.');
    });

    it('should accept 1000 levels of nesting and reject one more', () => {
      expect(() => convertValueToFormulaType(nest(1000))).not.toThrow();
      expect(conversionError(() => convertValueToFormulaType(nest(1001)))).toHaveProperty('message', expect.stringMatching(/: it is nested deeper than 1000 levels\.$/));
    });
  });
});

describe('conversion through FormulaArray.from and FormulaObject.from', () => {
  it('should convert a hole in a list to null', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(toPlain(FormulaArray.from([, 1]))).toEqual([null, 1]);
  });

  it('should reject a list that contains itself', () => {
    const list: unknown[] = [1];
    list.push(list);

    expect(conversionError(() => FormulaArray.from(list))).toHaveProperty('message', 'Cannot convert [1] to a formula value: it is a circular reference.');
  });

  it('should reject an object that contains itself', () => {
    const order: Record<string, unknown> = { qty: 2 };
    order.self = order;

    expect(conversionError(() => FormulaObject.from(order))).toHaveProperty('message', 'Cannot convert self to a formula value: it is a circular reference.');
  });
});

/** The error a conversion throws, or `undefined` when it succeeds. */
function conversionError(convert: () => unknown): unknown {
  try {
    convert();
    return undefined;
  }
  catch (error) {
    return error;
  }
}

/** A list with `value` at `index` and `null` before it. */
function placeAt(index: number, value: unknown): unknown[] {
  return [...Array.from({ length: index }).fill(null), value];
}

/** Objects nested `levels` deep, the innermost one empty. */
function nest(levels: number): Record<string, unknown> {
  let value: Record<string, unknown> = {};

  for (let level = 1; level < levels; level++) {
    value = { inner: value };
  }

  return value;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** JSON data with each number as a formula reads it, at 15 significant digits. */
function withNumbersAsRead(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value), (_key, item: unknown) => typeof item === 'number' ? new FormulaNumber(item).value : item);
}

/** The plain JavaScript value a converted value stands for, to compare it with the input. */
function toPlain(value: FormulaDataType): unknown {
  if (isList(value)) {
    return value.value.map(toPlain);
  }

  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value.value).map(([key, item]) => [key, toPlain(item)]));
  }

  return value.value;
}

// Guards keep the item type, which `instanceof` on these classes loses.
function isList(value: FormulaDataType): value is FormulaArray {
  return value instanceof FormulaArray;
}

function isObject(value: FormulaDataType): value is FormulaObject {
  return value instanceof FormulaObject;
}
