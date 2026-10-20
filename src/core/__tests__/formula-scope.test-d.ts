import type { Temporal } from 'temporal-polyfill';

import type { FormulaScope } from '../formula-scope';

declare const scope: FormulaScope;

describe('FormulaScope values', () => {
  it('should accept values with a formula form', () => {
    class Order {
      constructor(readonly qty: number) {}

      total(): number {
        return this.qty * 2;
      }
    }

    interface Row {
      readonly price: number;
      readonly tags: readonly string[];
      readonly due: Date;
    }

    const row: Row = { price: 1, tags: [], due: new Date() };
    const parsed: unknown = JSON.parse('{}');

    scope.evaluate('order.qty()', { order: new Order(3) });
    scope.evaluate('row.price()', { row });
    scope.evaluate('data', { data: parsed });
    scope.evaluate('items', { items: new Set([1, 2]), bytes: new Uint8Array(2), big: 1n, nothing: undefined });
  });

  it('should reject values without a formula form', () => {
    // @ts-expect-error a map has no formula form
    scope.evaluate('meta', { meta: new Map() });

    // @ts-expect-error a promise has no formula form, however deep it sits
    scope.evaluate('order', { order: { lines: [{ total: Promise.resolve(1) }] } });

    // @ts-expect-error a symbol has no formula form
    scope.evaluate('key', { key: Symbol('key') });
  });

  it('should narrow the result by its kind', () => {
    const result = scope.evaluate('due', { due: new Date() });

    if (result.kind === 'Date') {
      expectTypeOf(result.value).toEqualTypeOf<Temporal.ZonedDateTime>();
    }

    if (result.kind === 'Boolean') {
      expectTypeOf(result.value).toEqualTypeOf<boolean>();
    }
  });
});
