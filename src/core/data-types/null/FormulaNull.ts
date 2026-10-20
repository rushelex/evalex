import type { ToStringOptions } from '../FormulaDataType';

import { formatWith } from '../../value-format';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

// Singleton instance - there's only one null value
let NULL_INSTANCE: FormulaNull | null = null;

/**
 * Represents null data type in the formula system.
 */
export class FormulaNull extends FormulaDataType<null, typeof Kind.Null> {
  static readonly kind = Kind.Null;

  /**
   * Creates an instance of FormulaNull.
   * Prefer using FormulaNull.instance() for singleton access.
   */
  constructor() {
    super(Kind.Null, null, 'Null');
  }

  isEmpty(): boolean {
    return true;
  }

  toString(options?: ToStringOptions): string {
    return formatWith({ formatter: options?.format?.null, value: null, kind: 'null' }) ?? '';
  }

  /**
   * Returns the singleton FormulaNull instance.
   * More efficient than creating new instances.
   */
  static instance(): FormulaNull {
    return NULL_INSTANCE ??= new FormulaNull();
  }
}
