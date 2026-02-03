import type { ToStringOptions } from '../FormulaDataType';

import type { FormulaDataTypeByKind, ToFormulaDataType } from '../types';

import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

/**
 * Represents a typed list of elements in the formula system.
 * @template TItem Type of elements in the list. Must be a subclass of FormulaDataType.
 */
export class FormulaArray<TItem extends FormulaDataType = FormulaDataType> extends FormulaDataType<TItem[]> {
  static readonly SEPARATOR = ', ';
  static readonly kind = Kind.Array;
  readonly itemDisplayType: string;

  constructor(items: TItem[], itemDisplayTypeSingular?: string) {
    const nestedItemDisplayType = itemDisplayTypeSingular || (items.length > 0 && new Set(items.map((item) => item.displayType)).size === 1 ? `${items[0].displayType} items` : 'any items');
    const itemDisplayType = `${nestedItemDisplayType} list`;
    super(Kind.Array, items, itemDisplayType);
    this.itemDisplayType = itemDisplayType;
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }

  toString(options?: ToStringOptions): string {
    const result = this.value.map((item) => item.toString(options)).join(FormulaArray.SEPARATOR);
    return options?.asJSON ? `[${result}]` : result;
  }

  static convert: <T extends unknown[]>(items: T) => ToFormulaDataType<T[number], true>[];

  static from<T extends unknown[]>(items: T, itemDisplayTypeSingular?: string): FormulaArray<ToFormulaDataType<T[number], true>> {
    const converted = FormulaArray.convert(items);
    return new FormulaArray(converted, itemDisplayTypeSingular);
  }

  static isValidInput(input: unknown): input is FormulaDataType[] {
    return Array.isArray(input) && input.every((item) => item instanceof FormulaDataType);
  }

  static isOfType<T extends Kind = Kind.Any>(instance: FormulaDataType, kind?: T): instance is FormulaArray<FormulaDataTypeByKind<T>> {
    if (!kind || kind === Kind.Any) {
      return instance instanceof FormulaArray;
    }

    return instance instanceof FormulaArray && instance.value.every((item) => item instanceof FormulaDataType && item.kind === kind);
  }

  static flatValues(instance: FormulaArray): FormulaDataType[] {
    return instance.value.flatMap((value) => {
      return FormulaArray.isOfType(value) ? FormulaArray.flatValues(value) : value;
    });
  }
}
