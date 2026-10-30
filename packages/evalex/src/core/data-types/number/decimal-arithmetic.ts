import { decimalScale } from './decimal-scale';
import { exactValue } from './exact-value';
import { FormulaNumber } from './FormulaNumber';
import { POWERS_OF_TEN } from './powers-of-ten';

// Past this many digits the exact power is far outside the double range, so `**` gives the same result.
const MAX_POWER_DIGITS = 400;

/**
 * Arithmetic of operators and routines that treats each number as the decimal it reads as.
 *
 * @remarks
 * When both operands stand for decimals of up to 15 significant digits, the result is the double nearest to the
 * exact decimal result, so `0.1 + 0.2` is `0.3` and `4.35 * 100` is `435`. Other operands, such as the result of
 * `1 / 3`, use plain double arithmetic on the full doubles, so `1 / 3 * 3` stays `1`. Division by zero is left
 * to the caller.
 */
export const decimalArithmetic = {
  add: (a: FormulaNumber, b: FormulaNumber): FormulaNumber => FormulaNumber.from(add(a[exactValue], b[exactValue])),
  subtract: (a: FormulaNumber, b: FormulaNumber): FormulaNumber => FormulaNumber.from(add(a[exactValue], -b[exactValue])),
  multiply: (a: FormulaNumber, b: FormulaNumber): FormulaNumber => FormulaNumber.from(multiply(a[exactValue], b[exactValue])),
  divide: (a: FormulaNumber, b: FormulaNumber): FormulaNumber => FormulaNumber.from(divide(a[exactValue], b[exactValue])),
  remainder: (a: FormulaNumber, b: FormulaNumber): FormulaNumber => FormulaNumber.from(remainder(a[exactValue], b[exactValue])),
  power: (a: FormulaNumber, b: FormulaNumber): FormulaNumber => FormulaNumber.from(power(a[exactValue], b[exactValue])),
  negate: (a: FormulaNumber): FormulaNumber => FormulaNumber.from(-a[exactValue]),
} as const;

function add(x: number, y: number): number {
  // Doubles are exact for integers, so only decimals with fraction digits need the integer detour.
  if (Number.isInteger(x) && Number.isInteger(y)) {
    return x + y;
  }

  const xScale = decimalScale(x);
  const yScale = decimalScale(y);

  if (xScale === undefined || yScale === undefined) {
    return x + y;
  }

  const scale = Math.max(xScale, yScale);
  const xUnits = toUnitsAt(x, xScale, scale);
  const yUnits = toUnitsAt(y, yScale, scale);
  const sum = xUnits + yUnits;

  if (Number.isSafeInteger(xUnits) && Number.isSafeInteger(yUnits) && Number.isSafeInteger(sum)) {
    return sum / POWERS_OF_TEN[scale];
  }

  return fromUnits(toBigUnitsAt(x, xScale, scale) + toBigUnitsAt(y, yScale, scale), scale);
}

function multiply(x: number, y: number): number {
  if (Number.isInteger(x) && Number.isInteger(y)) {
    return x * y;
  }

  const xScale = decimalScale(x);
  const yScale = decimalScale(y);

  if (xScale === undefined || yScale === undefined) {
    return x * y;
  }

  const scale = xScale + yScale;
  const product = toUnits(x, xScale) * toUnits(y, yScale);

  if (Number.isSafeInteger(product) && scale < POWERS_OF_TEN.length) {
    return product / POWERS_OF_TEN[scale];
  }

  return fromUnits(BigInt(toUnits(x, xScale)) * BigInt(toUnits(y, yScale)), scale);
}

function divide(x: number, y: number): number {
  if (Number.isInteger(x) && Number.isInteger(y)) {
    return x / y;
  }

  const xScale = decimalScale(x);
  const yScale = decimalScale(y);

  if (xScale === undefined || yScale === undefined) {
    return x / y;
  }

  // Bringing both to one scale makes the quotient a ratio of two integers, which a double divides with one rounding.
  const scale = Math.max(xScale, yScale);
  const xUnits = toUnitsAt(x, xScale, scale);
  const yUnits = toUnitsAt(y, yScale, scale);

  return Number.isSafeInteger(xUnits) && Number.isSafeInteger(yUnits) ? xUnits / yUnits : x / y;
}

function remainder(x: number, y: number): number {
  if (Number.isInteger(x) && Number.isInteger(y)) {
    return x % y;
  }

  const xScale = decimalScale(x);
  const yScale = decimalScale(y);

  if (xScale === undefined || yScale === undefined) {
    return x % y;
  }

  const scale = Math.max(xScale, yScale);
  const xUnits = toUnitsAt(x, xScale, scale);
  const yUnits = toUnitsAt(y, yScale, scale);

  if (Number.isSafeInteger(xUnits) && Number.isSafeInteger(yUnits)) {
    return (xUnits % yUnits) / POWERS_OF_TEN[scale];
  }

  return fromUnits(toBigUnitsAt(x, xScale, scale) % toBigUnitsAt(y, yScale, scale), scale);
}

function power(x: number, y: number): number {
  const scale = decimalScale(x);

  if (scale === undefined || scale === 0 || !Number.isSafeInteger(y)) {
    return x ** y;
  }

  const units = toUnits(x, scale);
  const exponent = Math.abs(y);

  if (exponent * String(Math.abs(units)).length > MAX_POWER_DIGITS) {
    return x ** y;
  }

  const exact = BigInt(units) ** BigInt(exponent);

  if (y >= 0) {
    return fromUnits(exact, scale * exponent);
  }

  // A negative power is 10^(scale * exponent) / units^exponent, divided with one rounding while both parts are exact.
  const denominator = Number(exact);

  return Number.isSafeInteger(denominator) && scale * exponent < POWERS_OF_TEN.length
    ? POWERS_OF_TEN[scale * exponent] / denominator
    : x ** y;
}

function toUnits(value: number, scale: number): number {
  return Math.round(value * POWERS_OF_TEN[scale]);
}

// Units of `value` at a scale at least as fine as its own; the result is exact only while it is a safe integer.
function toUnitsAt(value: number, valueScale: number, scale: number): number {
  return toUnits(value, valueScale) * POWERS_OF_TEN[scale - valueScale];
}

function toBigUnitsAt(value: number, valueScale: number, scale: number): bigint {
  return BigInt(toUnits(value, valueScale)) * 10n ** BigInt(scale - valueScale);
}

// Number parsing rounds once, to the nearest double, which is what an exact decimal result needs.
function fromUnits(units: bigint, scale: number): number {
  return Number(`${units}e-${scale}`);
}
