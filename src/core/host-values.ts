import type { GlobalProperties } from './context';
import type { FormulaDataType } from './data-types';

import { convertNamedValue } from './data-types/converter';

/**
 * Host values a formula reads by name, each converted the first time the formula reads it.
 *
 * @remarks
 * Converting on read keeps a field the formula never reads from failing it, and puts a conversion failure at the
 * name that reads it. Only own fields count, and fields holding functions are left out as conversion leaves them out
 * of objects, so a formula never reaches the prototype or the methods of the host's object.
 */
export class HostValues implements GlobalProperties {
  readonly #values: object;
  readonly #converted = new Map<string, FormulaDataType | undefined>();

  constructor(values: object) {
    this.#values = values;
  }

  has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  /** @throws TypeError naming the path from `name` to the first value without a formula form. */
  get(name: string): FormulaDataType | undefined {
    if (this.#converted.has(name)) {
      return this.#converted.get(name);
    }

    const value = this.#read(name);

    this.#converted.set(name, value);

    return value;
  }

  #read(name: string): FormulaDataType | undefined {
    if (!Object.hasOwn(this.#values, name)) {
      return undefined;
    }

    const value: unknown = Reflect.get(this.#values, name);

    return typeof value === 'function' ? undefined : convertNamedValue({ name, value });
  }
}
