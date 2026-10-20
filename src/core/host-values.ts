import type { GlobalProperties } from './context';
import type { FormulaDataType } from './data-types';

import { convertNamedValue } from './data-types/converter';

/**
 * Host values a formula reads by name, each converted the first time the formula reads it.
 *
 * @remarks
 * Converting on read keeps a field the formula never reads from failing it, and puts a conversion failure at the
 * name that reads it. Only own fields count, so a formula never reaches the prototype of the host's object.
 */
export class HostValues implements GlobalProperties {
  readonly #values: object;
  readonly #converted = new Map<string, FormulaDataType>();

  constructor(values: object) {
    this.#values = values;
  }

  has(name: string): boolean {
    return Object.hasOwn(this.#values, name);
  }

  /** @throws TypeError naming the path from `name` to the first value without a formula form. */
  get(name: string): FormulaDataType | undefined {
    if (!this.has(name)) {
      return undefined;
    }

    let value = this.#converted.get(name);

    if (!value) {
      value = convertNamedValue({ name, value: Reflect.get(this.#values, name) });
      this.#converted.set(name, value);
    }

    return value;
  }
}
