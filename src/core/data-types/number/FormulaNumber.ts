import type { ToStringOptions } from '../FormulaDataType';

import { formatWith } from '../../value-format';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';
import { decimalScale } from './decimal-scale';
import { exactValue } from './exact-value';

const SIGNIFICANT_DIGITS = 15;

// Cache for common small integer values (-10 to 100)
const CACHE_MIN = -10;
const CACHE_MAX = 100;
const numberCache: (FormulaNumber | undefined)[] = Array.from({ length: CACHE_MAX - CACHE_MIN + 1 });

/**
 * Represents a number data type in the formula system.
 */
export class FormulaNumber extends FormulaDataType<number> {
  static readonly kind = Kind.Number;
  /** The full double, so that `1 / 3 * 3` is `1` even though `value` of `1 / 3` is cut to 15 digits. */
  readonly [exactValue]: number;

  /**
   * Creates a FormulaNumber instance.
   * Prefer using FormulaNumber.from() for small integers for better performance.
   * @param value Numeric value. Negative zero is stored as zero, so it never shows up in results or poisons the cache.
   * `value` of the instance keeps it at 15 significant digits, so binary noise such as `0.30000000000000004` reads `0.3`.
   */
  constructor(value: number) {
    const exact = Object.is(value, -0) ? 0 : value;

    super(Kind.Number, toSignificantDigits(exact), 'Number');
    this[exactValue] = exact;
  }

  isEmpty(): boolean {
    return this.value === 0;
  }

  toString(options?: ToStringOptions): string {
    return formatWith({ formatter: options?.format?.number, value: this.value, kind: 'number' }) ?? String(this.value);
  }

  /**
   * Creates or returns a cached FormulaNumber instance.
   * Caches small integers (-10 to 100) for better performance.
   */
  static from(input: number): FormulaNumber {
    // Only cache small integers
    if (Number.isInteger(input) && input >= CACHE_MIN && input <= CACHE_MAX) {
      const idx = input - CACHE_MIN;
      let cached = numberCache[idx];
      if (!cached) {
        cached = new FormulaNumber(input);
        numberCache[idx] = cached;
      }
      return cached;
    }
    return new FormulaNumber(input);
  }

  static isValidInput(input: unknown): input is number {
    return typeof input === 'number';
  }
}

// A decimal of up to 15 digits and a safe integer already read as written; the check skips the slower `toPrecision`.
function toSignificantDigits(value: number): number {
  if (decimalScale(value) !== undefined) {
    return value;
  }

  const rounded = Number(value.toPrecision(SIGNIFICANT_DIGITS));

  // Rounding up next to the largest double would overflow to infinity.
  return Number.isFinite(rounded) ? rounded : value;
}
