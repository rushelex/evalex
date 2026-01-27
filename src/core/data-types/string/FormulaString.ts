import type { ToStringOptions } from '../FormulaDataType';

import { FormulaDataType } from '../FormulaDataType';

/**
 * Represents a text data type in the formula system.
 */
export class FormulaString extends FormulaDataType<string> {
  static readonly kind = 'string';

  /**
   * Creates a FormulaString instance.
   * @param value String value.
   */
  constructor(value: string) {
    super('string', String(value), 'Text');
  }

  public isEmpty(): boolean {
    return this.value.length === 0;
  }

  public toString(options?: ToStringOptions) {
    return options?.asJSON ? `"${this.value}"` : this.value;
  }

  public static from(input: string): FormulaString {
    return new FormulaString(input);
  }

  public static isValidInput(input: unknown): input is string {
    return typeof input === 'string';
  }
}
