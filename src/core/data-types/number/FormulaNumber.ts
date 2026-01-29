import { FormulaDataType } from '../FormulaDataType';

// Cache for common small integer values (-10 to 100)
const CACHE_MIN = -10;
const CACHE_MAX = 100;
const numberCache: (FormulaNumber | undefined)[] = Array.from({ length: CACHE_MAX - CACHE_MIN + 1 });

/**
 * Represents a number data type in the formula system.
 */
export class FormulaNumber extends FormulaDataType<number> {
  static readonly kind = 'number';

  /**
   * Creates a FormulaNumber instance.
   * Prefer using FormulaNumber.from() for small integers for better performance.
   * @param value Numeric value.
   */
  constructor(value: number) {
    super('number', value, 'Number');
  }

  isEmpty(): boolean {
    return this.value === 0;
  }

  toString(): string {
    return String(this.value);
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
