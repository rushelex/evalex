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

  public isEmpty(): boolean {
    return this.value === 0;
  }

  public toString(): string {
    return String(this.value);
  }

  public static from(input: number): FormulaNumber {
    return new FormulaNumber(input);
  }

  public static isValidInput(input: unknown): input is number {
    return typeof input === 'number';
  }
}
