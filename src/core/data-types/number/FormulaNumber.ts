import { FormulaDataType } from '../FormulaDataType';

/**
 * Represents a number data type in the formula system.
 */
export class FormulaNumber extends FormulaDataType<number> {
  static readonly kind = 'number';

  /**
   * Creates a FormulaNumber instance.
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

  static from(input: number): FormulaNumber {
    return new FormulaNumber(input);
  }

  static isValidInput(input: unknown): input is number {
    return typeof input === 'number';
  }
}
