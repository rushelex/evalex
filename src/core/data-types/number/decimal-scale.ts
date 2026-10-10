import { POWERS_OF_TEN } from './powers-of-ten';

const MAX_FRACTION_DIGITS = 15;
const MAX_DECIMAL_UNITS = 1e15;

/**
 * Number of fraction digits of the decimal a double stands for, or `undefined` when it stands for none.
 *
 * @remarks
 * A double stands for a decimal when it is the double nearest to a decimal of at most 15 significant digits,
 * as `0.1` is. Safe integers stand for themselves at any length. Results such as `1 / 3` or `Math.SQRT2`
 * stand for no decimal, and arithmetic keeps them as plain doubles.
 */
export function decimalScale(value: number): number | undefined {
  if (Number.isSafeInteger(value)) {
    return 0;
  }

  for (let scale = 1; scale <= MAX_FRACTION_DIGITS; scale++) {
    const units = Math.round(value * POWERS_OF_TEN[scale]);

    // Negated so that NaN and infinities stop here too.
    if (!(Math.abs(units) < MAX_DECIMAL_UNITS)) {
      return undefined;
    }

    if (units / POWERS_OF_TEN[scale] === value) {
      return scale;
    }
  }

  return undefined;
}
