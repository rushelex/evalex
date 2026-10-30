import type { FormulaArray } from '../data-types/array';
import type { FormulaNumber } from '../data-types/number';
import type { FormulaObject } from '../data-types/object';

declare const list: FormulaArray<FormulaNumber>;
declare const record: FormulaObject<{ total: FormulaNumber }>;
declare const item: FormulaNumber;

describe('Formula values', () => {
  it('should not allow changing list items in place', () => {
    // @ts-expect-error A list value is replaced, never changed in place
    // eslint-disable-next-line ts/no-unsafe-call -- the missing method is what this test asserts
    list.value.push(item);

    // @ts-expect-error A list value is replaced, never changed in place
    list.value[0] = item;
  });

  it('should not allow changing object properties in place', () => {
    // @ts-expect-error An object value is replaced, never changed in place
    record.value.total = item;
  });
});
