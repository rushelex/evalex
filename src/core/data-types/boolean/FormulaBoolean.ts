import { FormulaDataType } from '../FormulaDataType';

/**
 * Represents a boolean data type in the formula system.
 */
export class FormulaBoolean extends FormulaDataType<boolean> {
  static readonly kind = 'boolean';

  /**
   * Creates a FormulaBoolean instance.
   * @param value Boolean value.
   */
  constructor(value: boolean) {
    super('boolean', value, 'Boolean');
  }

  isEmpty(): boolean {
    return !this.value;
  }

  toString(): string {
    return this.value ? 'true' : 'false';
  }

  static from(input: boolean): FormulaBoolean {
    return new FormulaBoolean(input);
  }

  static isValidInput(input: unknown): input is boolean {
    return typeof input === 'boolean';
  }
}
