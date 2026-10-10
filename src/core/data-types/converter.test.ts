import type { FormulaDataType } from './FormulaDataType';

import { fc, it } from '@fast-check/vitest';

import { FormulaArray } from './array';
import { convertValueToFormulaType } from './converter';
import { FormulaDate } from './date';
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

describe(convertValueToFormulaType, () => {
  it.prop([hostValue])('should convert any host value without failing', (value) => {
    expect(convertValueToFormulaType(value)).toBeDefined();
  });

  it.prop([jsonValue])('should keep every value of JSON data', (value) => {
    expect(toPlain(convertValueToFormulaType(value))).toEqual(value ?? null);
  });

  it.prop([jsonValue])('should convert a value shared by two places in both of them', (value) => {
    expect(toPlain(convertValueToFormulaType([value, { again: value }]))).toEqual([value, { again: value }]);
  });

  it.prop([fc.date({ noInvalidDate: true })])('should keep the instant of a date', (date) => {
    const converted = convertValueToFormulaType(date);

    expect(converted).toBeInstanceOf(FormulaDate);
    expect(converted.value).toEqual(FormulaDate.from(date).value);
  });

  it('should convert a hole in a list to null', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(toPlain(convertValueToFormulaType([, 1]))).toEqual([null, 1]);
  });
});

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
