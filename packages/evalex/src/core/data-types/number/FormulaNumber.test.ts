import { fc, it } from '@fast-check/vitest';

import { FormulaNumber } from './FormulaNumber';

describe('FormulaNumber', () => {
  describe('Initialization', () => {
    it('should initialize from number', () => {
      const result = new FormulaNumber(42);
      expect(result).toBeFormulaDataType(FormulaNumber, 42);
    });

    it('should store negative zero as zero', () => {
      expect(new FormulaNumber(-0).value).toBe(0);
    });

    it('should keep the cached zero positive after creating negative zero', () => {
      FormulaNumber.from(-0);

      expect(FormulaNumber.from(0).value).toBe(0);
    });
  });

  describe('value', () => {
    it.prop([fc.maxSafeInteger()])('should keep a safe integer of any length', (integer) => {
      expect(new FormulaNumber(integer).value).toBe(integer);
    });

    it.prop([fc.bigInt({ min: -(10n ** 15n) + 1n, max: 10n ** 15n - 1n }), fc.integer({ min: 0, max: 15 })])('should keep a decimal of up to 15 significant digits', (units, scale) => {
      const decimal = Number(`${units}e-${scale}`);

      expect(new FormulaNumber(decimal).value).toBe(decimal);
    });

    it.prop([fc.double({ noNaN: true, noDefaultInfinity: true })])('should read the same as the given number at 15 significant digits', (number) => {
      const { value } = new FormulaNumber(number);

      expect(value.toPrecision(15)).toBe(number.toPrecision(15));
    });

    it.each([
      [0.30000000000000004, 0.3],
      [2.0000000000000004, 2],
      [1 / 3, 0.333333333333333],
      [0.9999999999999999, 1],
      [1.234567890123456, 1.23456789012346],
      [123456789012345680, 123456789012346000],
    ])('should give %d as %d', (number, expected) => {
      expect(new FormulaNumber(number).value).toBe(expected);
    });

    it('should keep infinity', () => {
      expect(new FormulaNumber(Number.POSITIVE_INFINITY).value).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('toString', () => {
    it('should write the number at 15 significant digits', () => {
      expect(new FormulaNumber(0.1 + 0.2).toString()).toBe('0.3');
    });
  });
});
