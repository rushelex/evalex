import { fc, it } from '@fast-check/vitest';

import { decimalArithmetic } from './decimal-arithmetic';
import { exactValue } from './exact-value';
import { FormulaNumber } from './FormulaNumber';

interface Decimal {
  readonly units: bigint;
  readonly scale: number;
}

const MAX_UNITS = 10n ** 15n - 1n;

// Decimals of up to 15 significant digits, the inputs that arithmetic treats as exact.
const decimal: fc.Arbitrary<Decimal> = fc.record({
  units: fc.bigInt({ min: -MAX_UNITS, max: MAX_UNITS }),
  scale: fc.integer({ min: 0, max: 15 }),
});

const nonZeroDecimal: fc.Arbitrary<Decimal> = fc.record({
  units: fc.oneof(fc.bigInt({ min: -MAX_UNITS, max: -1n }), fc.bigInt({ min: 1n, max: MAX_UNITS })),
  scale: fc.integer({ min: 0, max: 15 }),
});

const toNumber = ({ units, scale }: Decimal): number => Number(`${units}e-${scale}`);

const rescale = ({ units, scale }: Decimal, to: number): bigint => units * 10n ** BigInt(to - scale);

function exactSum(a: Decimal, b: Decimal): number {
  const scale = Math.max(a.scale, b.scale);

  return toNumber({ units: rescale(a, scale) + rescale(b, scale), scale });
}

const exactProduct = (a: Decimal, b: Decimal): number => toNumber({ units: a.units * b.units, scale: a.scale + b.scale });

function exactRemainder(a: Decimal, b: Decimal): number {
  const scale = Math.max(a.scale, b.scale);

  return toNumber({ units: rescale(a, scale) % rescale(b, scale), scale });
}

const number = (value: number): FormulaNumber => new FormulaNumber(value);

describe('decimalArithmetic', () => {
  describe('add', () => {
    it.prop([decimal, decimal])('should give the double nearest to the exact decimal sum', (a, b) => {
      expect(decimalArithmetic.add(number(toNumber(a)), number(toNumber(b)))[exactValue]).toBe(exactSum(a, b));
    });

    it('should add decimals as written', () => {
      expect(decimalArithmetic.add(number(0.1), number(0.2))[exactValue]).toBe(0.3);
    });

    it('should keep integers beyond 15 digits exact', () => {
      expect(decimalArithmetic.add(number(1234567890123456), number(1))[exactValue]).toBe(1234567890123457);
    });

    it('should stay exact when the sum at the common scale passes the safe integer range', () => {
      expect(decimalArithmetic.add(number(0.999999999999999), number(9.00719925474099))[exactValue]).toBe(10.00719925474099);
    });
  });

  describe('subtract', () => {
    it.prop([decimal, decimal])('should give the double nearest to the exact decimal difference', (a, b) => {
      const negated = { units: -b.units, scale: b.scale };

      expect(decimalArithmetic.subtract(number(toNumber(a)), number(toNumber(b)))[exactValue]).toBe(exactSum(a, negated));
    });

    it('should cancel to zero when the decimals cancel', () => {
      const sum = decimalArithmetic.add(number(0.1), number(0.2));

      expect(decimalArithmetic.subtract(sum, number(0.3)).value).toBe(0);
    });
  });

  describe('multiply', () => {
    it.prop([decimal, decimal])('should give the double nearest to the exact decimal product', (a, b) => {
      expect(decimalArithmetic.multiply(number(toNumber(a)), number(toNumber(b)))[exactValue]).toBe(exactProduct(a, b));
    });

    it.each([
      [0.1, 3, 0.3],
      [1.1, 1.1, 1.21],
      [4.35, 100, 435],
      [1.005, 1000, 1005],
    ])('should multiply %d by %d as written', (a, b, expected) => {
      expect(decimalArithmetic.multiply(number(a), number(b))[exactValue]).toBe(expected);
    });
  });

  describe('divide', () => {
    it.each([
      [0.3, 0.1, 3],
      [0.07, 0.1, 0.7],
      [7, 100, 0.07],
    ])('should divide %d by %d as written', (a, b, expected) => {
      expect(decimalArithmetic.divide(number(a), number(b))[exactValue]).toBe(expected);
    });

    it('should keep a repeating quotient exact for the next operation', () => {
      const third = decimalArithmetic.divide(number(1), number(3));

      expect(decimalArithmetic.multiply(third, number(3)).value).toBe(1);
    });

    it('should show a repeating quotient at 15 significant digits', () => {
      expect(decimalArithmetic.divide(number(1), number(3)).value).toBe(0.333333333333333);
    });
  });

  describe('remainder', () => {
    it.prop([decimal, nonZeroDecimal])('should give the double nearest to the exact decimal remainder', (a, b) => {
      expect(decimalArithmetic.remainder(number(toNumber(a)), number(toNumber(b)))[exactValue]).toBe(exactRemainder(a, b));
    });

    it('should keep the sign of the dividend', () => {
      expect(decimalArithmetic.remainder(number(-5.5), number(2))[exactValue]).toBe(-1.5);
    });
  });

  describe('power', () => {
    it.each([
      [1.1, 2, 1.21],
      [1.05, 3, 1.157625],
      [0.1, 3, 0.001],
      [2, -2, 0.25],
      [10, 0, 1],
      [1.1, -2, 100 / 121],
    ])('should raise %d to %d as written', (a, b, expected) => {
      expect(decimalArithmetic.power(number(a), number(b))[exactValue]).toBe(expected);
    });

    it('should raise to a fractional exponent', () => {
      expect(decimalArithmetic.power(number(4), number(0.5)).value).toBe(2);
    });

    it('should keep an irrational base exact for the next operation', () => {
      const root = decimalArithmetic.power(number(2), number(0.5));

      expect(decimalArithmetic.power(root, number(2)).value).toBe(2);
    });
  });

  describe('negate', () => {
    it.prop([fc.double({ noNaN: true })])('should flip the sign of the full number', (value) => {
      expect(decimalArithmetic.negate(number(value))[exactValue]).toBe(value === 0 ? 0 : -value);
    });
  });
});
