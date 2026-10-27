import type { GlobalProperties } from './context';
import type { FormulaValue } from './data-types';
import type { CellPlace } from './data-types/converter';
import type { ValueFormat } from './value-format';

import { SyntaxError } from '../parser/grammar/parser';
import { FormulaDataType, isFormulaValue } from './data-types';
import { convertNamedValue } from './data-types/converter';
import { FormulaError } from './errors';
import { evaluateFormula, parseFormula } from './expression';
import { Formula } from './formula';

/** What a formula cell holds once computed: its value, or the error of the formula. */
export type FormulaCell = FormulaValue | FormulaError | SyntaxError;

/** The shape `evaluate` gives back for data of type `T`: every `Formula` replaced by what its cell holds. */
export type FormulaView<T> = T extends Formula ? FormulaCell
  : T extends (...args: never[]) => unknown ? T
  : T extends object ? { [K in keyof T]: FormulaView<T[K]> }
  : T;

/**
 * Computes the formula cells of host data, giving back data of the same shape with the results in place of formulas.
 *
 * @remarks
 * Every pass reads the data as it is at the call, so the host changes its data however it likes and calls `evaluate`
 * again. The data itself is never changed.
 */
export class FormulaEvaluator {
  readonly #format: ValueFormat | undefined;

  /** @param format Validated by the scope that creates the evaluator. */
  constructor(format: ValueFormat | undefined) {
    this.#format = format;
  }

  /**
   * Computes every formula cell found through the data properties of `data`.
   *
   * @returns Data of the shape of `data`: a formula cell holds its value or the error of its formula, an object or list
   * that holds formulas, directly or through its fields, is a copy, and everything else is what `data` holds.
   * @throws TypeError naming the path to a value a formula reads that has no formula form.
   */
  evaluate<T extends object>(data: T): FormulaView<T> {
    const pass = new EvaluationPass({ data, format: this.#format });

    return pass.view() as FormulaView<T>;
  }
}

/** Where a container of the data sits: the container that first holds it in a walk by depth, and the one before that. */
interface Place {
  readonly container: object;
  readonly parent: Place | undefined;
}

interface FoundCell {
  readonly owner: object;
  readonly key: string | number;
  readonly formula: Formula;
}

/**
 * One computation of the formula cells of host data.
 *
 * @remarks
 * A walk by depth gives each container its place, the shallowest path to it, first in key order among equally shallow
 * ones, so a container linked from several places computes its formulas once, with the names around that place.
 * A cell is computed the first time something reads it, by the pass or by a formula, and keeps its result for the pass.
 */
class EvaluationPass {
  readonly #root: object;
  readonly #format: ValueFormat | undefined;
  readonly #places = new Map<object, Place>();
  readonly #found: FoundCell[] = [];
  /** Containers each container is held by, through any of its data properties, to find the containers a view copies. */
  readonly #holders = new Map<object, object[]>();
  /** Results by owner and key; a list item is keyed by its index as text, as the view reads it from descriptors. */
  readonly #cells = new Map<object, Map<string, FormulaCell>>();
  readonly #views = new Map<object, object>();
  #copied = new Set<object>();

  constructor({ data, format }: { data: object; format: ValueFormat | undefined }) {
    this.#root = data;
    this.#format = format;
    this.#walk();
  }

  view(): object {
    for (const { owner, key, formula } of this.#found) {
      this.#cell({ owner, key }, formula);
    }

    this.#copied = this.#containersToCopy();

    return this.#viewOf(this.#root);
  }

  /** Reads a cell for a formula that reads it: a formula cell gives its value, anything else converts as host data. */
  readonly #readCell = (value: unknown, place: CellPlace): FormulaDataType | undefined => {
    if (!(value instanceof Formula)) {
      return undefined;
    }

    const cell = this.#cell(place, value);

    // A failed cell fails the formula that reads it.
    if (cell instanceof Error) {
      throw cell;
    }

    return cell;
  };

  #walk(): void {
    const queue = [this.#root];

    this.#places.set(this.#root, { container: this.#root, parent: undefined });

    for (let index = 0; index < queue.length; index++) {
      const container = queue[index];
      const place = this.#places.get(container)!;

      for (const [key, value] of dataFields(container)) {
        if (value instanceof Formula) {
          this.#found.push({ owner: container, key, formula: value });
        }
        else if (isContainer(value)) {
          this.#holdersOf(value).push(container);

          if (!this.#places.has(value)) {
            this.#places.set(value, { container: value, parent: place });
            queue.push(value);
          }
        }
      }
    }
  }

  #holdersOf(container: object): object[] {
    let holders = this.#holders.get(container);

    if (!holders) {
      holders = [];
      this.#holders.set(container, holders);
    }

    return holders;
  }

  #cell(place: CellPlace, formula: Formula): FormulaCell {
    let cells = this.#cells.get(place.owner);

    if (!cells) {
      cells = new Map();
      this.#cells.set(place.owner, cells);
    }

    const key = String(place.key);
    let cell = cells.get(key);

    if (!cell) {
      cell = this.#compute(place.owner, formula);
      cells.set(key, cell);
    }

    return cell;
  }

  #compute(owner: object, formula: Formula): FormulaCell {
    try {
      const { result } = evaluateFormula({
        formula: formula.text,
        ast: parseFormula(formula.text),
        properties: new RecordNames({ records: this.#recordsAround(owner), readCell: this.#readCell }),
        format: this.#format,
      });

      if (!isFormulaValue(result)) {
        throw new TypeError(`The formula computed a value of an unknown data type, ${result.kind}.`);
      }

      return result;
    }
    catch (error) {
      if (error instanceof FormulaError || error instanceof SyntaxError) {
        return error;
      }

      throw error;
    }
  }

  /** The records a formula held by `owner` reads names from, innermost first: lists hold no names. */
  #recordsAround(owner: object): object[] {
    const records: object[] = [];
    let place = this.#places.get(owner);

    if (!place) {
      // A container reached only through a getter has no place of its own: its formulas read only its fields.
      return Array.isArray(owner) ? records : [owner];
    }

    for (; place; place = place.parent) {
      if (!Array.isArray(place.container)) {
        records.push(place.container);
      }
    }

    return records;
  }

  /** Containers holding formula cells, and every container that holds one of those, through any number of steps. */
  #containersToCopy(): Set<object> {
    const copied = new Set(this.#found.map(({ owner }) => owner));
    const queue = [...copied];

    for (let index = 0; index < queue.length; index++) {
      for (const holder of this.#holders.get(queue[index]) ?? []) {
        if (!copied.has(holder)) {
          copied.add(holder);
          queue.push(holder);
        }
      }
    }

    return copied;
  }

  #viewOf(container: object): object {
    if (!this.#copied.has(container)) {
      return container;
    }

    const existing = this.#views.get(container);

    if (existing) {
      return existing;
    }

    const view: object = Array.isArray(container) ? [] : Object.create(Reflect.getPrototypeOf(container)) as object;

    // Registered before its fields so a link back to the container finds the view.
    this.#views.set(container, view);

    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(container))) {
      if ('value' in descriptor) {
        descriptor.value = this.#viewOfField({ owner: container, key }, descriptor.value);
      }

      Object.defineProperty(view, key, descriptor);
    }

    return view;
  }

  #viewOfField(place: CellPlace, value: unknown): unknown {
    if (value instanceof Formula) {
      return this.#cell(place, value);
    }

    return isContainer(value) ? this.#viewOf(value) : value;
  }
}

/**
 * Names a formula reads from the records around its cell, the innermost record first.
 *
 * @remarks
 * Only own fields count, and a field holding a function is skipped as if absent, so the name is looked up further out.
 */
class RecordNames implements GlobalProperties {
  readonly #records: readonly object[];
  readonly #readCell: (value: unknown, place: CellPlace) => FormulaDataType | undefined;
  readonly #read = new Map<string, FormulaDataType | undefined>();

  constructor({ records, readCell }: {
    records: readonly object[];
    readCell: (value: unknown, place: CellPlace) => FormulaDataType | undefined;
  }) {
    this.#records = records;
    this.#readCell = readCell;
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
    for (const record of this.#records) {
      if (!Object.hasOwn(record, name)) {
        continue;
      }

      const value: unknown = Reflect.get(record, name);

      if (typeof value !== 'function') {
        return this.#readCell(value, { owner: record, key: name }) ?? convertNamedValue({ name, value, readCell: this.#readCell });
      }
    }

    return undefined;
  }
}

/** The fields of a container that are data properties, so a getter is read only when a formula reads it. */
function* dataFields(container: object): Generator<[string | number, unknown]> {
  if (Array.isArray(container)) {
    for (let index = 0; index < container.length; index++) {
      yield [index, container[index]];
    }

    return;
  }

  for (const key of Object.keys(container)) {
    const descriptor = Object.getOwnPropertyDescriptor(container, key);

    if (descriptor && 'value' in descriptor) {
      yield [key, descriptor.value];
    }
  }
}

/** Tells whether a value is a list or a record whose fields can hold cells: a plain object or a class instance. */
function isContainer(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || value instanceof Formula || value instanceof FormulaDataType) {
    return false;
  }

  return Array.isArray(value) || Object.prototype.toString.call(value) === '[object Object]';
}
