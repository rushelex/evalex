import type { ToStringOptions } from '../FormulaDataType';
import type { ToFormulaDataType } from '../types';

import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

/**
 * An object a formula computes or reads from host data: `value` holds its fields, each a formula value of its own kind.
 *
 * @remarks
 * A formula reads a field with method syntax: `user.name()`, `user.profile().city()`.
 */
export class FormulaObject<T extends Record<string, FormulaDataType> = Record<string, FormulaDataType>> extends FormulaDataType<Readonly<T>, typeof Kind.Object> {
  static readonly kind = Kind.Object;
  /** Objects whose text is being written, so a link back to one of them is written as `{…}` instead of looping. */
  static readonly #writing = new Set<FormulaObject>();

  constructor(value: T, displayType?: string) {
    super(Kind.Object, value, displayType || 'Object');
  }

  isEmpty(): boolean {
    return Object.keys(this.value).length === 0;
  }

  toString(options?: ToStringOptions): string {
    if (FormulaObject.#writing.has(this)) {
      return '{…}';
    }

    FormulaObject.#writing.add(this);

    try {
      const entries = Object.entries<FormulaDataType>(this.value).map(([key, value]) => `${key}: ${value.toString({ ...options, asJSON: options?.asJSON ?? true })}`);
      if (entries.length === 0)
        return '{}';
      return `{ ${entries.join(', ')} }`;
    }
    finally {
      FormulaObject.#writing.delete(this);
    }
  }

  /**
   * Converts a plain JavaScript object to a Record<string, FormulaDataType> format.
   *
   * This method recursively converts all properties of the input object to their corresponding
   * FormulaDataType instances, handling nested objects, arrays, and special values like dates,
   * functions, and circular references safely.
   *
   * @template T - The type of the input object
   * @param obj - Plain JavaScript object to convert
   * @returns Converted object with all values as FormulaDataType instances
   *
   * @example
   * ```typescript
   * const plainObj = {
   *   name: "John",
   *   age: 30,
   *   active: true,
   *   profile: {
   *     city: "New York",
   *     tags: ["developer", "typescript"]
   *   },
   *   createdAt: new Date("2024-01-01")
   * };
   *
   * const converted = FormulaObject.convert(plainObj);
   * // Returns: {
   * //   name: FormulaString("John"),
   * //   age: FormulaNumber(30),
   * //   active: FormulaBoolean(true),
   * //   profile: FormulaObject({
   * //     city: FormulaString("New York"),
   * //     tags: FormulaArray([FormulaString("developer"), FormulaString("typescript")])
   * //   }),
   * //   createdAt: FormulaDate(2024-01-01)
   * // }
   *
   * // Use with constructor
   * const formulaObj = new FormulaObject(converted);
   * ```
   */
  static convert: <T extends Record<string, unknown>>(obj: T) => ToFormulaDataType<T>;

  /**
   * Creates a new FormulaObject instance from a plain JavaScript object.
   *
   * This is a convenience method that combines `convert()` and the constructor in one call.
   * It automatically converts the plain object to FormulaDataType format and wraps it
   * in a FormulaObject instance.
   *
   * @template T - The type of the input object
   * @param value - Plain JavaScript object to convert and wrap
   * @returns New FormulaObject instance containing the converted data
   *
   * @example
   * ```typescript
   * // Simple object
   * const user = FormulaObject.from({
   *   name: "Alice",
   *   age: 25,
   *   isActive: true
   * });
   *
   * // Complex nested object
   * const order = FormulaObject.from({
   *   id: "order-123",
   *   customer: {
   *     name: "John Doe",
   *     tier: "premium"
   *   },
   *   items: [
   *     { name: "Widget A", price: 10.99, quantity: 2 },
   *     { name: "Widget B", price: 15.50, quantity: 1 }
   *   ],
   *   metadata: {
   *     createdAt: new Date(),
   *     source: "web"
   *   }
   * });
   *
   * // Use in formulas
   * evaluate('order.customer().name()', { context: { order } });
   * // Returns: FormulaString("John Doe")
   *
   * evaluate('order.items().length()', { context: { order } });
   * // Returns: FormulaNumber(2)
   * ```
   */
  static from<T extends Record<string, unknown>>(value: T): FormulaObject<ToFormulaDataType<T>> {
    const converted = FormulaObject.convert(value);
    return new FormulaObject(converted);
  }
}
