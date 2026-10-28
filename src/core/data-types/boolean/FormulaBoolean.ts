import type { ToStringOptions } from '../FormulaDataType';

import { formatWith } from '../../value-format';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

// Cached singleton instances for true and false
let TRUE_INSTANCE: FormulaBoolean | null = null;
let FALSE_INSTANCE: FormulaBoolean | null = null;

/** A boolean a formula computes, such as the result of a comparison: `value` holds it. */
export class FormulaBoolean extends FormulaDataType<boolean, typeof Kind.Boolean> {
  static readonly kind = Kind.Boolean;

  /**
   * Creates a FormulaBoolean instance.
   * Prefer using FormulaBoolean.from() for better performance via caching.
   * @param value Boolean value.
   */
  constructor(value: boolean) {
    super(Kind.Boolean, value, 'Boolean');
  }

  isEmpty(): boolean {
    return !this.value;
  }

  toString(options?: ToStringOptions): string {
    return formatWith({ formatter: options?.format?.boolean, value: this.value, kind: 'boolean' }) ?? (this.value ? 'true' : 'false');
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
