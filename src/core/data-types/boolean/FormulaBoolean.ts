import { FormulaDataType } from '../FormulaDataType';

// Cached singleton instances for true and false
let TRUE_INSTANCE: FormulaBoolean | null = null;
let FALSE_INSTANCE: FormulaBoolean | null = null;

/**
 * Represents a boolean data type in the formula system.
 */
export class FormulaBoolean extends FormulaDataType<boolean> {
  static readonly kind = 'boolean';

  /**
   * Creates a FormulaBoolean instance.
   * Prefer using FormulaBoolean.from() for better performance via caching.
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

  /**
   * Creates or returns a cached FormulaBoolean instance.
   * Uses singleton pattern for true/false values.
   */
  static from(input: boolean): FormulaBoolean {
    if (input) {
      return TRUE_INSTANCE ??= new FormulaBoolean(true);
    }
    else {
      return FALSE_INSTANCE ??= new FormulaBoolean(false);
    }
  }

  static isValidInput(input: unknown): input is boolean {
    return typeof input === 'boolean';
  }
}
