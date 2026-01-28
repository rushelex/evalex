import { FormulaDataType } from '../FormulaDataType';

/**
 * Represents null data type in the formula system.
 */
export class FormulaNull extends FormulaDataType<null> {
  static readonly kind = 'null';

  /**
   * Creates an instance of FormulaNull.
   */
  constructor() {
    super('null', null, 'Null');
  }

  isEmpty(): boolean {
    return true;
  }

  toString(): string {
    return '';
  }
}
