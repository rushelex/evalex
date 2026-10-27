import type { GlobalProperties } from './context';
import type { FormulaDataType } from './data-types';
import type { CellReader } from './data-types/converter';

import { convertNamedValue } from './data-types/converter';
import { ABSENT, isContainer } from './host-containers';

/** Where a container of the data sits: the container that first holds it in a walk by depth, and the one before that. */
export interface Place {
  readonly container: object;
  readonly parent: Place | undefined;
  /** The key of the container in its parent. */
  readonly key: string | number | undefined;
}

/**
 * What the names of records take from their pass: the cells formulas read, the places of records, and a note of each
 * read of the data that does not go through `readCell`, so the formula being computed depends on it.
 */
export interface PassNames {
  readonly readCell: CellReader;
  readonly placeOf: (container: object) => Place;
  /** Gives the place a place sits in, noting that the formula depends on where the container of `place` sits. */
  readonly parentOf: (place: Place) => Place | undefined;
  /**
   * Reads what the field at `key` of `owner` holding `held` gives formulas, through the `cell` option, and notes that the
   * formula read it; `held` is `ABSENT` for a field that does not exist, which is never a cell.
   */
  readonly readField: (owner: object, key: string | number, held: unknown) => unknown;
}

/**
 * Names a formula reads from the records around a place, the innermost record first; lists hold no names.
 *
 * @remarks
 * Only own fields count, and a data field holding a function is skipped as if absent, so the name is looked up further
 * out; a getter is not run to tell, so it is a name whatever it returns, as it is a field of an object.
 * The first record on the way out is the record the names belong to: `enclosing` starts at the record after it, and
 * `neighbor` at the record next to it in the list that holds it.
 */
export class RecordNames implements GlobalProperties {
  readonly #place: Place | undefined;
  readonly #pass: PassNames;
  readonly #read = new Map<string, FormulaDataType | undefined>();

  constructor({ place, pass }: { place: Place | undefined; pass: PassNames }) {
    this.#place = place;
    this.#pass = pass;
  }

  enclosing(): GlobalProperties {
    const own = this.#recordPlace(this.#place);

    return new RecordNames({ place: own && this.#pass.parentOf(own), pass: this.#pass });
  }

  neighbor(offset: -1 | 1): GlobalProperties | undefined {
    const own = this.#recordPlace(this.#place);
    const list = own && this.#pass.parentOf(own)?.container;

    if (!Array.isArray(list) || typeof own?.key !== 'number') {
      return undefined;
    }

    const index = own.key + offset;
    const record = this.#pass.readField(list, index, index in list ? list[index] : ABSENT);

    return isContainer(record) && !Array.isArray(record) ? new RecordNames({ place: this.#pass.placeOf(record), pass: this.#pass }) : undefined;
  }

  has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  get(name: string): FormulaDataType | undefined {
    if (this.#read.has(name)) {
      return this.#read.get(name);
    }

    const value = this.#find(name);

    this.#read.set(name, value);

    return value;
  }

  #find(name: string): FormulaDataType | undefined {
    const { readCell, parentOf, readField } = this.#pass;

    for (let place = this.#place; place; place = parentOf(place)) {
      const record = place.container;

      if (Array.isArray(record)) {
        continue;
      }

      if (!Object.hasOwn(record, name)) {
        readField(record, name, ABSENT);
        continue;
      }

      const descriptorValue: unknown = Object.getOwnPropertyDescriptor(record, name)?.value;

      if (typeof descriptorValue === 'function') {
        readField(record, name, descriptorValue);
        continue;
      }

      return readCell({
        place: { owner: record, key: name },
        read: (): unknown => Reflect.get(record, name),
        convert: (value) => convertNamedValue({ name, value, readCell }),
      });
    }

    return undefined;
  }

  /** The place of the first record at or outside `place`, skipping lists. */
  #recordPlace(place: Place | undefined): Place | undefined {
    let record = place;

    while (record && Array.isArray(record.container)) {
      record = this.#pass.parentOf(record);
    }

    return record;
  }
}
