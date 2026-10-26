import { it } from '@fast-check/vitest';

import { formulaValueArbitrary, loc } from '../../testing-library';
import { FormulaDateRange, FormulaNumber, FormulaString } from '../data-types';
import { Errors } from '../errors';
import { FormulaScope } from '../formula-scope';

describe(FormulaScope, () => {
  describe('evaluate', () => {
    it('should evaluate a formula over plain values', () => {
      expect(new FormulaScope().evaluate('price * quantity', { price: 250, quantity: 4 })).toBeFormulaDataType(FormulaNumber, 1000);
    });

    it('should evaluate a formula without values', () => {
      expect(new FormulaScope().evaluate('1 + 2')).toBeFormulaDataType(FormulaNumber, 3);
    });

    it('should turn values into text with the formatters of the scope', () => {
      const scope = new FormulaScope({ format: { number: (number) => `<${number}>` } });

      expect(scope.evaluate('"x" + n', { n: 1 })).toBeFormulaDataType(FormulaString, 'x<1>');
    });

    it('should read a date range given as its start and end', () => {
      const period = { start: new Date('2024-07-01T00:00:00Z'), end: new Date('2024-07-28T00:00:00Z') };

      expect(new FormulaScope().evaluate('period', { period })).toBeInstanceOf(FormulaDateRange);
    });

    it.prop([formulaValueArbitrary()])('should give back a formula value passed in as it is', (value) => {
      expect(new FormulaScope().evaluate('value', { value })).toBe(value);
    });

    it('should compute a result passed back as input as it did inside one formula', () => {
      const scope = new FormulaScope();
      const third = scope.evaluate('1 / 3');

      expect(scope.evaluate('third * 3', { third })).toBeFormulaDataType(FormulaNumber, 1);
    });
  });

  describe('host values', () => {
    it('should not convert a value the formula does not read', () => {
      // @ts-expect-error a map fails to compile; a host without types reaches the check at run time
      expect(new FormulaScope().evaluate('price * 2', { price: 1, meta: new Map() })).toBeFormulaDataType(FormulaNumber, 2);
    });

    it('should name the path of a value it cannot convert, starting at its name', () => {
      // @ts-expect-error a map fails to compile; a host without types reaches the check at run time
      expect(() => new FormulaScope().evaluate('order.qty()', { order: { qty: 1, tags: new Map() } }))
        .toThrow(new TypeError('Cannot convert order.tags to a formula value: Map has no formula form.'));
    });

    it('should read a value once however many times the formula reads its name', () => {
      let reads = 0;
      const values = {
        get price(): number {
          reads++;
          return 2;
        },
      };

      new FormulaScope().evaluate('price + price * price', values);

      expect(reads).toBe(1);
    });

    it.each([
      { label: 'a name the values inherit', name: 'price', values: Object.create({ price: 1 }) as object },
      { label: 'a name of the object prototype', name: 'toString', values: {} },
      { label: 'a name that holds a function', name: 'onChange', values: { onChange: () => undefined } },
    ])('should not find $label', ({ name, values }) => {
      expect(() => new FormulaScope().evaluate(name, values)).toThrow(Errors.Reference.VariableNotDefined.create(
        { name },
        { location: loc(0, name.length) },
      ));
    });
  });

  describe('format', () => {
    it('should reject a name list of the wrong length when the scope is created', () => {
      expect(() => new FormulaScope({ format: { names: { months: ['a'] } } })).toThrow(new TypeError('format.names.months must hold 12 names, not 1.'));
    });
  });
});
