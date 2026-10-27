import type { AST } from '../parser';
import type { GlobalProperties } from './context';
import type { FormulaValue } from './data-types';
import type { CellPlace, CellReader } from './data-types/converter';
import type { ValueFormat } from './value-format';

import { SyntaxError } from '../parser/grammar/parser';
import { CellReadFailure } from './cell-read-failure';
import { FormulaDataType, isFormulaValue } from './data-types';
import { convertNamedValue } from './data-types/converter';
import { Errors, FormulaError } from './errors';
import { evaluateFormula, parseFormula } from './expression';
import { Formula } from './formula';

/** What a formula cell holds once computed: its value, or the error of the formula. */
export type FormulaCell = FormulaValue | FormulaError | SyntaxError;

/** The shape `evaluate` gives back for data of type `T`: every `Formula` replaced by what its cell holds. */
export type FormulaView<T> = T extends Formula ? FormulaCell
  : T extends (...args: never[]) => unknown ? T
  : T extends object ? { [K in keyof T]: FormulaView<T[K]> }
  : T;

export interface FormulaEvaluatorOptions {
  /**
   * Gets a failure of host data a formula reads, such as a getter that threw or a value without a formula form, once
   * per failure in a pass. The formula itself fails with an `INPUT_ERROR` caused by it.
   */
  readonly onInputError?: (error: Error) => void;
}

/**
 * Computes the formula cells of host data, giving back data of the same shape with the results in place of formulas.
 *
 * @remarks
 * Every pass reads the data as it is at the call, so the host changes its data however it likes and calls `evaluate`
 * again. The data itself is never changed.
 */
export class FormulaEvaluator {
  readonly #format: ValueFormat | undefined;
  readonly #onInputError: ((error: Error) => void) | undefined;

  /** Takes `format` validated by the scope that creates the evaluator. */
  constructor({ format, onInputError }: FormulaEvaluatorOptions & { format: ValueFormat | undefined }) {
    this.#format = format;
    this.#onInputError = onInputError;
  }

  /**
   * Computes every formula cell found through the data properties of `data`.
   *
   * @returns Data of the shape of `data`: a formula cell holds its value or the error of its formula, an object or list
   * that holds formulas, directly or through its fields, is a copy, and everything else is what `data` holds.
   */
  evaluate<T extends object>(data: T): FormulaView<T> {
    const pass = new EvaluationPass({ data, format: this.#format, onInputError: this.#onInputError });

    return pass.view() as FormulaView<T>;
  }
}

/** Where a container of the data sits: the container that first holds it in a walk by depth, and the one before that. */
interface Place {
  readonly container: object;
  readonly parent: Place | undefined;
  /** The key of the container in its parent. */
  readonly key: string | number | undefined;
}

/**
 * How deep cells compute inside one another before the rest wait on an explicit stack, in levels of formula nesting.
 * The default call stack of Node holds about 2,300 such levels; the rest is left to the host's own frames.
 */
const NESTING_BUDGET = 500;

/** The levels a cell costs beyond the nesting of its formula: reading the cell and starting its evaluation. */
const CELL_NESTING = 10;

/** Nesting of each parsed formula, kept as long as its parse is cached. */
const nestings = new WeakMap<AST.AstNode, number>();

/** A formula cell of one pass and where its computation stands. */
interface Cell {
  readonly owner: object;
  readonly formula: Formula;
  /** The levels of nesting computing the cell takes, see {@link NESTING_BUDGET}. */
  readonly nesting: number;
  result: FormulaCell | undefined;
  /** Its formula is being evaluated. */
  computing: boolean;
  /** On the explicit stack, waiting for a cell its formula reads. */
  waiting: boolean;
  /** The cell a cycle was found at, for a cell that failed in that cycle. */
  cycle: Cell | undefined;
}

/** Unwinds cells computed too deep inside one another, so the cell it names is computed first, from the explicit stack. */
class CellNotReady extends Error {
  readonly cell: Cell;

  constructor(cell: Cell) {
    super('A cell is computed too deep inside other cells.');
    this.cell = cell;
  }
}

/**
 * One computation of the formula cells of host data.
 *
 * @remarks
 * A walk by depth gives each container its place, the shallowest path to it, first in key order among equally shallow
 * ones, so a container linked from several places computes its formulas once, with the names around that place.
 *
 * A cell is computed the first time something reads it, so cells come in the order they read each other, whatever their
 * order in the data. A read nested deeper than {@link NESTING_BUDGET} allows unwinds to an explicit stack instead of
 * growing the call stack, and the cells it interrupted start over once the cell they wait for is computed. Each read
 * that unwinds computes a new cell, so no order of cells costs more than a constant times another.
 *
 * Cells in progress, computing or waiting, form one path, each reading the next. A read of a cell in progress closes a
 * cycle: the reading cell fails, and so does every cell that reads a failed cell of the cycle while the cell the cycle
 * was found at is still in progress, since that cell depends on it.
 *
 * Any other read of a failed cell fails the reading formula with an `INPUT_ERROR` caused by that cell's error, and so
 * does a read of host data that fails. A failed place of host data is read once a pass: later reads fail with the same
 * cause without running the host's getter again.
 */
class EvaluationPass {
  readonly #root: object;
  readonly #format: ValueFormat | undefined;
  readonly #onInputError: ((error: Error) => void) | undefined;
  /** Failures of host data by owner and key, keyed as {@link EvaluationPass.#cells}. */
  readonly #failures = new Map<object, Map<string, Error>>();
  readonly #places = new Map<object, Place>();
  readonly #found: { readonly place: CellPlace; readonly formula: Formula }[] = [];
  /** Containers each container is held by, through any of its data properties, to find the containers a view copies. */
  readonly #holders = new Map<object, object[]>();
  /** Cells by owner and key; a list item is keyed by its index as text, as the view reads it from descriptors. */
  readonly #cells = new Map<object, Map<string, Cell>>();
  /** Cells being computed inside one another, the innermost last. */
  readonly #computing: Cell[] = [];
  /** The nesting of the cells being computed, together. */
  #nesting = 0;
  /** Copies of the containers that hold formulas, by container. */
  readonly #views = new Map<object, object>();

  constructor({ data, format, onInputError }: { data: object; format: ValueFormat | undefined; onInputError: ((error: Error) => void) | undefined }) {
    this.#root = data;
    this.#format = format;
    this.#onInputError = onInputError;
    this.#walk();
  }

  view(): object {
    for (const { place, formula } of this.#found) {
      this.#resultOf(place, formula);
    }

    this.#copyContainers(this.#containersToCopy());

    return this.#views.get(this.#root) ?? this.#root;
  }

  /** Reads a cell for a formula that reads it: a formula cell gives its value, anything else converts as host data. */
  readonly #readCell: CellReader = ({ place, read, convert }) => {
    const failure = this.#failures.get(place.owner)?.get(String(place.key));

    if (failure) {
      throw inputFailure(failure);
    }

    let value: unknown;

    try {
      value = read();

      if (!(value instanceof Formula)) {
        return convert(value);
      }
    }
    catch (error) {
      // A failure of a field or an item inside the value is already a read failure, and so is a cell not ready yet.
      if (error instanceof CellReadFailure || error instanceof CellNotReady) {
        throw error;
      }

      throw this.#failInput(place, error);
    }

    return this.#formulaCellValue(place, value);
  };

  /** Records a failure of host data and reports it to the host, giving the read failure for the formula that read it. */
  #failInput(place: CellPlace, thrown: unknown): CellReadFailure {
    const error = thrown instanceof Error ? thrown : new Error(`A getter of host data threw ${String(thrown)}.`, { cause: thrown });
    let failures = this.#failures.get(place.owner);

    if (!failures) {
      failures = new Map();
      this.#failures.set(place.owner, failures);
    }

    failures.set(String(place.key), error);
    this.#onInputError?.(error);

    return inputFailure(error);
  }

  #formulaCellValue(place: CellPlace, formula: Formula): FormulaValue {
    const cell = this.#cellAt(place, formula);

    if (!cell.result) {
      if (cell.computing || cell.waiting) {
        throw this.#cycleAt(cell);
      }

      if (this.#nesting + cell.nesting > NESTING_BUDGET) {
        throw new CellNotReady(cell);
      }
    }

    const result = this.#compute(cell);

    if (cell.cycle && (cell.cycle.computing || cell.cycle.waiting)) {
      throw this.#cycleAt(cell.cycle);
    }

    if (result instanceof Error) {
      throw inputFailure(result);
    }

    return result;
  }

  /** Fails the cell whose formula is reading, as a cell of the cycle found at `cell`. */
  #cycleAt(cell: Cell): CellReadFailure {
    const reader = this.#computing.at(-1);

    if (reader) {
      reader.cycle = cell;
    }

    return new CellReadFailure(({ name, location }) => Errors.Reference.CircularReference.create({ name }, { location }));
  }

  #walk(): void {
    const queue = [this.#root];

    this.#places.set(this.#root, { container: this.#root, parent: undefined, key: undefined });

    for (let index = 0; index < queue.length; index++) {
      const container = queue[index];
      const place = this.#places.get(container)!;

      for (const [key, value] of dataFields(container)) {
        if (value instanceof Formula) {
          this.#found.push({ place: { owner: container, key }, formula: value });
        }
        else if (isContainer(value)) {
          this.#holdersOf(value).push(container);

          if (!this.#places.has(value)) {
            this.#places.set(value, { container: value, parent: place, key });
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

  #cellAt(place: CellPlace, formula: Formula): Cell {
    let cells = this.#cells.get(place.owner);

    if (!cells) {
      cells = new Map();
      this.#cells.set(place.owner, cells);
    }

    const key = String(place.key);
    let cell = cells.get(key);

    if (!cell) {
      cell = {
        owner: place.owner,
        formula,
        nesting: CELL_NESTING + nestingOf(formula),
        result: undefined,
        computing: false,
        waiting: false,
        cycle: undefined,
      };
      cells.set(key, cell);
    }

    return cell;
  }

  /** Computes a cell, and every cell it waits for, outside any other cell. */
  #resultOf(place: CellPlace, formula: Formula): FormulaCell {
    const target = this.#cellAt(place, formula);
    const waiting = [target];

    target.waiting = true;

    while (waiting.length > 0) {
      const cell = waiting[waiting.length - 1];

      try {
        this.#compute(cell);
        cell.waiting = false;
        waiting.pop();
      }
      catch (error) {
        if (!(error instanceof CellNotReady)) {
          throw error;
        }

        error.cell.waiting = true;
        waiting.push(error.cell);
      }
    }

    return target.result!;
  }

  #compute(cell: Cell): FormulaCell {
    if (cell.result) {
      return cell.result;
    }

    cell.computing = true;
    this.#computing.push(cell);
    this.#nesting += cell.nesting;

    try {
      cell.result = this.#evaluate(cell);

      return cell.result;
    }
    finally {
      cell.computing = false;
      this.#computing.pop();
      this.#nesting -= cell.nesting;
    }
  }

  #evaluate({ owner, formula }: Cell): FormulaCell {
    try {
      const { result } = evaluateFormula({
        formula: formula.text,
        ast: parseFormula(formula.text),
        properties: new RecordNames({ place: this.#placeOf(owner), pass: this.#names }),
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

  #placeOf(container: object): Place {
    // A container reached only through a getter has no place in the walk: its formulas read only its own fields.
    return this.#places.get(container) ?? { container, parent: undefined, key: undefined };
  }

  readonly #names: PassNames = {
    readCell: this.#readCell,
    placeOf: (container) => this.#placeOf(container),
  };

  /** Containers holding formula cells, and every container that holds one of those, through any number of steps. */
  #containersToCopy(): Set<object> {
    const copied = new Set(this.#found.map(({ place }) => place.owner));
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

  /** Copies every container that holds formulas; all copies exist before any is filled, so links between them need no recursion. */
  #copyContainers(copied: ReadonlySet<object>): void {
    for (const container of copied) {
      this.#views.set(container, Array.isArray(container) ? [] : Object.create(Reflect.getPrototypeOf(container)) as object);
    }

    for (const [container, view] of this.#views) {
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(container))) {
        if ('value' in descriptor) {
          descriptor.value = this.#viewOfField({ owner: container, key }, descriptor.value);
        }

        Object.defineProperty(view, key, descriptor);
      }
    }
  }

  #viewOfField(place: CellPlace, value: unknown): unknown {
    if (value instanceof Formula) {
      return this.#resultOf(place, value);
    }

    return isContainer(value) ? this.#views.get(value) ?? value : value;
  }
}

/** What the names of records take from their pass: the cells formulas read, and the places of records. */
interface PassNames {
  readonly readCell: CellReader;
  readonly placeOf: (container: object) => Place;
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
class RecordNames implements GlobalProperties {
  readonly #place: Place | undefined;
  readonly #pass: PassNames;
  readonly #read = new Map<string, FormulaDataType | undefined>();

  constructor({ place, pass }: { place: Place | undefined; pass: PassNames }) {
    this.#place = place;
    this.#pass = pass;
  }

  enclosing(): GlobalProperties {
    return new RecordNames({ place: recordPlace(this.#place)?.parent, pass: this.#pass });
  }

  neighbor(offset: -1 | 1): GlobalProperties | undefined {
    const own = recordPlace(this.#place);
    const list = own?.parent?.container;

    if (!Array.isArray(list) || typeof own?.key !== 'number') {
      return undefined;
    }

    const record: unknown = list[own.key + offset];

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
    const { readCell } = this.#pass;

    for (let place = this.#place; place; place = place.parent) {
      const record = place.container;

      if (Array.isArray(record) || !Object.hasOwn(record, name) || typeof Object.getOwnPropertyDescriptor(record, name)?.value === 'function') {
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
}

/** The read failure of an input without a value, for the formula that reads it. */
function inputFailure(cause: Error): CellReadFailure {
  return new CellReadFailure(({ name, location }) => Errors.Reference.InputError.create({ name }, { location, cause }));
}

/** The place of the first record at or outside `place`, skipping lists. */
function recordPlace(place: Place | undefined): Place | undefined {
  let record = place;

  while (record && Array.isArray(record.container)) {
    record = record.parent;
  }

  return record;
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

/** How deep the parts of a formula nest, or none for a formula that does not parse and so evaluates nothing. */
function nestingOf(formula: Formula): number {
  let ast: AST.AstNode;

  try {
    ast = parseFormula(formula.text);
  }
  catch {
    return 0;
  }

  let nesting = nestings.get(ast);

  if (nesting === undefined) {
    nesting = measureNesting(ast);
    nestings.set(ast, nesting);
  }

  return nesting;
}

/** Walks the tree with a stack of its own, since the formula may nest as deep as the call stack allows. */
function measureNesting(ast: AST.AstNode): number {
  const pending: { readonly node: AST.AstNode; readonly depth: number }[] = [{ node: ast, depth: 1 }];
  let deepest = 0;

  for (let entry = pending.pop(); entry; entry = pending.pop()) {
    deepest = Math.max(deepest, entry.depth);

    for (const child of childrenOf(entry.node)) {
      pending.push({ node: child, depth: entry.depth + 1 });
    }
  }

  return deepest;
}

function childrenOf(node: AST.AstNode): readonly AST.AstNode[] {
  switch (node.type) {
    case 'Literal':
    case 'Identifier':
      return [];

    case 'UnaryExpression':
      return [node.arg];

    case 'BinaryExpression':
      return [node.left, node.right];

    case 'CallExpression':
      return [node.callee, ...node.args];

    case 'MemberExpression':
      return [node.object];

    case 'ConditionalExpression':
      return [node.test, node.consequent, node.alternate];

    case 'ArrayExpression':
      return node.elements;

    case 'LetExpression':
      return [...node.declarations.map((declaration) => declaration.value), node.body];
  }
}
