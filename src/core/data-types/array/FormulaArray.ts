import type { ToStringOptions } from '../FormulaDataType';
import type { Kind } from '../kind';
import type { InferFormulaDataTypeByKind, ToFormulaDataType } from '../types';

import { FormulaDataType } from '../FormulaDataType';

/**
 * Represents a typed list of elements in the formula system.
 * @template TItem Type of elements in the list. Must be a subclass of FormulaDataType.
 */
export class FormulaArray<TItem extends FormulaDataType = FormulaDataType> extends FormulaDataType<TItem[]> {
  static readonly SEPARATOR = ', ';

  static readonly kind = 'array';

  public readonly itemDisplayType: string;

  constructor(items: TItem[], itemDisplayTypeSingular?: string) {
    const nestedItemDisplayType = itemDisplayTypeSingular || (items.length > 0 ? items[0].kind : 'any');
    const itemDisplayType = `List of ${nestedItemDisplayType.toLowerCase()}s`;
    super('array', items, itemDisplayType);
    this.itemDisplayType = itemDisplayType;
  }

  public isEmpty(): boolean {
    return this.value.length === 0;
  }

  public toString(options?: ToStringOptions): string {
    const result = this.value.map((item) => item.toString(options)).join(FormulaArray.SEPARATOR);
    return options?.asJSON ? `[${result}]` : result;
  }

  public static convert: <T extends unknown[]>(items: T) => ToFormulaDataType<T[number], true>[];

  public static from<T extends unknown[]>(items: T, itemDisplayTypeSingular?: string): FormulaArray<ToFormulaDataType<T[number], true>> {
    const converted = FormulaArray.convert(items);
    return new FormulaArray(converted, itemDisplayTypeSingular);
  }

  public static isValidInput(input: unknown): input is FormulaDataType[] {
    return Array.isArray(input) && input.every((item) => item instanceof FormulaDataType);
  }

  public static isOfType<T extends Kind = 'any'>(instance: FormulaDataType, kind?: T): instance is FormulaArray<InferFormulaDataTypeByKind<T>> {
    if (!kind || kind === 'any') {
      return instance instanceof FormulaArray;
    }

    return instance instanceof FormulaArray && instance.value.every((item) => item instanceof FormulaDataType && item.kind === kind);
  }

  public static flatValues(instance: FormulaArray): FormulaDataType[] {
    return instance.value.flatMap((value) => {
      return FormulaArray.isOfType(value) ? FormulaArray.flatValues(value) : value;
    });
  }
}
