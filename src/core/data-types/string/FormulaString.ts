import type { ToStringOptions } from '../FormulaDataType';

import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

/** Text a formula computes: `value` holds it. */
export class FormulaString extends FormulaDataType<string, typeof Kind.String> {
  static readonly kind = Kind.String;

  /**
   * Creates a FormulaString instance.
   * @param value String value.
   */
  constructor(value: string) {
    super(Kind.String, String(value), 'Text');
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }

  toString(options?: ToStringOptions) {
    return options?.asJSON ? `"${this.value}"` : this.value;
  }

  static from(input: string): FormulaString {
    return new FormulaString(input);
  }

  static isValidInput(input: unknown): input is string {
    return typeof input === 'string';
  }
}
