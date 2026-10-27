import type { AST } from '../parser';
import type { FormulaValue } from './data-types';
import type { CellPlace, CellReader } from './data-types/converter';
import type { CellMemo, EvaluatorMemory, Read } from './evaluator-memory';
import type { FormulaCell, FormulaCellPlace } from './formula-evaluator';
import type { PassNames, Place } from './record-names';
import type { ValueFormat } from './value-format';

import { SyntaxError } from '../parser/grammar/parser';
import { CellReadFailure } from './cell-read-failure';
import { areEqual, isFormulaValue, Kind } from './data-types';
import { hostShape } from './data-types/converter';
import { DependencyExtractorVisitor } from './dependency-extractor.visitor';
import { Errors, FormulaError } from './errors';
import { evaluateFormula, parseFormula } from './expression';
import { Formula } from './formula';
import { ABSENT, isContainer, readAgain } from './host-containers';
import { RecordNames } from './record-names';

/**
 * How deep cells compute inside one another before the rest wait on an explicit stack, in levels of formula nesting.
 * The default call stack of Node holds about 2,300 such levels; the rest is left to the host's own frames.
 */
const NESTING_BUDGET = 500;

/** The levels a cell costs beyond the nesting of its formula: reading the cell and starting its evaluation. */
const CELL_NESTING = 10;

/** Nesting of each parsed formula, kept as long as its parse is cached. */
const nestings = new WeakMap<AST.AstNode, number>();

/** Whether each parsed formula calls a volatile routine, kept as long as its parse is cached. */
const volatiles = new WeakMap<AST.AstNode, boolean>();

/** Kinds of results that equal content shows the same in every way, so an equal new result can keep the old one. */
const PLAIN_KINDS: ReadonlySet<string> = new Set([Kind.Number, Kind.String, Kind.Boolean, Kind.Null]);

/** Bits of the attributes of a field, as {@link EvaluationPass} keeps them in a view memo. */
const ENUMERABLE = 1;
const CONFIGURABLE = 2;
const WRITABLE = 4;
const ACCESSOR = 8;
const PLAIN_FIELD = ENUMERABLE | CONFIGURABLE | WRITABLE;

/** A formula cell of one pass and where its computation stands. */
interface Cell {
  readonly owner: object;
  readonly key: string;
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
  /** What the formula read while evaluated, in order, or `undefined` once it read something that cannot be read again. */
  reads: Read[] | undefined;
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
 * One computation of the formula cells of host data, reusing what an earlier pass computed where nothing it read changed.
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
 * Computing a cell first reads again everything its formula read when it was last computed. When every read gives what
 * it gave then, and every cell it read holds the same result, the cell keeps its result without evaluating the formula.
 * A cell whose formula calls a volatile routine, fails in a cycle, or read host data that failed or cannot be read again
 * is evaluated in every pass.
 *
 * Cells in progress, computing or waiting, form one path, each reading the next. A read of a cell in progress closes a
 * cycle: the reading cell fails, and so does every cell that reads a failed cell of the cycle while the cell the cycle
 * was found at is still in progress, since that cell depends on it.
 *
 * Any other read of a failed cell fails the reading formula with an `INPUT_ERROR` caused by that cell's error, and so
 * does a read of host data that fails. A failed place of host data is read once a pass: later reads fail with the same
 * cause without running the host's getter again.
 */
export class EvaluationPass {
  readonly #root: object;
  readonly #format: ValueFormat | undefined;
  readonly #onInputError: ((error: Error) => void) | undefined;
  readonly #memory: EvaluatorMemory;
  /** The number of this pass, one more than the pass before it. */
  readonly #number: number;
  /** The reader every converted value reads its fields through, the same in every pass. */
  readonly #hostReader: CellReader;
  /** Failures of host data by owner and key, keyed as {@link EvaluationPass.#cells}. */
  readonly #failures = new Map<object, Map<string, Error>>();
  readonly #places = new Map<object, Place>();
  /** Containers in the order the walk reaches them, the root first, and how many of them it has visited. */
  readonly #queue: object[];
  #walked = 0;
  readonly #found: { readonly place: CellPlace; readonly formula: Formula }[] = [];
  /** How many of the cells found {@link EvaluationPass.advance} has computed. */
  #computed = 0;
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
  /** The own fields of each container as {@link ownFields} gives them, read once a pass. */
  readonly #ownFields = new Map<object, unknown[]>();
  readonly #cell: ((value: unknown, place: FormulaCellPlace) => unknown) | undefined;
  /** What `cell` gave for each place, keyed as {@link EvaluationPass.#cells}. */
  readonly #cellValues = new Map<object, Map<string, unknown>>();

  constructor({ data, format, onInputError, cell, memory, number, hostReader }: {
    data: object;
    format: ValueFormat | undefined;
    onInputError: ((error: Error) => void) | undefined;
    cell: ((value: unknown, place: FormulaCellPlace) => unknown) | undefined;
    memory: EvaluatorMemory;
    number: number;
    hostReader: CellReader;
  }) {
    this.#root = data;
    this.#queue = [data];
    this.#format = format;
    this.#onInputError = onInputError;
    this.#cell = cell;
    this.#memory = memory;
    this.#number = number;
    this.#hostReader = hostReader;
    this.#places.set(data, { container: data, parent: undefined, key: undefined });
  }

  /**
   * Walks the data, then computes the cells found, from where the last call stopped until `due` tells to stop.
   *
   * @remarks
   * Work stops only between containers and between cells, never inside a computation. The data may change between
   * calls: what was read keeps for the next pass to read again, as everything a pass reads does.
   *
   * @returns Whether all of the work is done.
   */
  advance(due: () => boolean): boolean {
    while (this.#walked < this.#queue.length) {
      this.#walkContainer(this.#queue[this.#walked]);
      this.#walked += 1;

      if (due()) {
        return false;
      }
    }

    while (this.#computed < this.#found.length) {
      const { place, formula } = this.#found[this.#computed];

      this.#resultOf(place, formula);
      this.#computed += 1;

      if (due()) {
        return false;
      }
    }

    return true;
  }

  view(): object {
    this.advance(() => false);
    this.#copyContainers(this.#containersToCopy());

    return this.#views.get(this.#root) ?? this.#root;
  }

  /** Reads a cell for a formula that reads it: a formula cell gives its value, anything else converts as host data. */
  readonly readCell: CellReader = ({ place, read, convert }) => {
    const failure = this.#failures.get(place.owner)?.get(String(place.key));

    if (failure) {
      this.#readerCannotKeep();

      throw inputFailure(failure);
    }

    let value: unknown;

    try {
      value = this.#throughCell(place, read());

      if (!(value instanceof Formula)) {
        this.#note({ kind: 'field', owner: place.owner, key: place.key, value, shape: hostShape(value) });

        return convert(value);
      }
    }
    catch (error) {
      // A failure of a field or an item inside the value is already a read failure, and so is a cell not ready yet.
      if (error instanceof CellReadFailure || error instanceof CellNotReady) {
        throw error;
      }

      throw this.#failInput({ place, thrown: error });
    }

    return this.#formulaCellValue(place, value);
  };

  /**
   * What a cell holds as the `cell` option reads it, called once a pass for each place; the host value itself without
   * the option, and `ABSENT` for a field that does not exist.
   *
   * @throws CellReadFailure when `cell` throws, after recording the failure for the place and reporting it.
   */
  #throughCell(place: CellPlace, value: unknown): unknown {
    if (!this.#cell || value === ABSENT) {
      return value;
    }

    const key = String(place.key);
    let values = this.#cellValues.get(place.owner);

    if (values?.has(key)) {
      return values.get(key);
    }

    const failure = this.#failures.get(place.owner)?.get(key);

    if (failure) {
      this.#readerCannotKeep();

      throw inputFailure(failure);
    }

    let read: unknown;

    try {
      read = this.#cell(value, { owner: place.owner, key: place.key });
    }
    catch (error) {
      throw this.#failInput({ place, thrown: error, thrower: 'The cell option' });
    }

    if (!values) {
      values = new Map();
      this.#cellValues.set(place.owner, values);
    }

    values.set(key, read);

    return read;
  }

  /** Records a failure of host data and reports it to the host, giving the read failure for the formula that read it. */
  #failInput({ place, thrown, thrower = 'A getter of host data' }: { place: CellPlace; thrown: unknown; thrower?: string }): CellReadFailure {
    const error = thrown instanceof Error ? thrown : new Error(`${thrower} threw ${String(thrown)}.`, { cause: thrown });
    let failures = this.#failures.get(place.owner);

    if (!failures) {
      failures = new Map();
      this.#failures.set(place.owner, failures);
    }

    failures.set(String(place.key), error);
    this.#readerCannotKeep();
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

    this.#note({ kind: 'cell', owner: place.owner, key: place.key, result });

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

  /** Adds a read to the cell whose formula is being evaluated, if any: a value read by the host has no reader. */
  #note(read: Read): void {
    this.#computing.at(-1)?.reads?.push(read);
  }

  #readerCannotKeep(): void {
    const reader = this.#computing.at(-1);

    if (reader) {
      reader.reads = undefined;
    }
  }

  readonly #names: PassNames = {
    readCell: (cell) => this.#hostReader(cell),
    placeOf: (container) => this.#placeOf(container),
    parentOf: (place) => {
      this.#note({ kind: 'place', container: place.container, parent: place.parent?.container, key: place.key });

      return place.parent;
    },
    readField: (owner, key, held) => {
      const value = this.#throughCell({ owner, key }, held);

      this.#note({ kind: 'field', owner, key, value, shape: hostShape(value) });

      return value;
    },
  };

  /** What a field shows outside formulas, in the walk and in the view: what `cell` gave, or what it holds if `cell` failed. */
  #shownCell(place: CellPlace, held: unknown): unknown {
    try {
      return this.#throughCell(place, held);
    }
    catch (error) {
      if (error instanceof CellReadFailure) {
        return held;
      }

      throw error;
    }
  }

  /** Visits the fields of a container in the walk by depth, finding the formula cells and the containers it holds. */
  #walkContainer(container: object): void {
    const place = this.#places.get(container)!;
    const visit = (key: string | number, held: unknown): void => {
      const value = this.#shownCell({ owner: container, key }, held);

      if (value instanceof Formula) {
        this.#found.push({ place: { owner: container, key }, formula: value });
      }
      else if (isContainer(value)) {
        this.#holdersOf(value).push(container);

        if (!this.#places.has(value)) {
          this.#places.set(value, { container: value, parent: place, key });
          this.#queue.push(value);
        }
      }
    };

    if (Array.isArray(container)) {
      for (let item = 0; item < container.length; item++) {
        visit(item, container[item]);
      }

      return;
    }

    // The fields read once serve both the walk, which follows enumerable data fields only, and the copy in the view.
    const fields = ownFields(container);

    this.#ownFields.set(container, fields);

    for (let field = 0; field < fields.length; field += 4) {
      const attributes = fields[field + 1] as number;

      if ((attributes & ENUMERABLE) !== 0 && (attributes & ACCESSOR) === 0) {
        visit(fields[field] as string, fields[field + 2]);
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
        key,
        formula,
        nesting: CELL_NESTING + nestingOf(formula),
        result: undefined,
        computing: false,
        waiting: false,
        cycle: undefined,
        reads: undefined,
      };
      cells.set(key, cell);
    }

    return cell;
  }

  /** Computes a cell, and every cell it waits for, outside any other cell. */
  #resultOf(place: CellPlace, formula: Formula): FormulaCell {
    const target = this.#cellAt(place, formula);

    if (target.result) {
      return target.result;
    }

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
      const memo = this.#memory.cells.get(cell.owner)?.get(cell.key);

      cell.result = memo && this.#holds(cell, memo) ? memo.result : this.#evaluateAndKeep(cell, memo);

      return cell.result;
    }
    finally {
      cell.computing = false;
      this.#computing.pop();
      this.#nesting -= cell.nesting;
    }
  }

  /** Tells whether every read of the last computation of a cell gives what it gave then. */
  #holds(cell: Cell, memo: CellMemo): boolean {
    if (memo.text !== cell.formula.text) {
      return false;
    }

    for (const read of memo.reads) {
      if (!this.#readHolds(read)) {
        return false;
      }
    }

    return true;
  }

  #readHolds(read: Read): boolean {
    if (read.kind === 'place') {
      const place = this.#placeOf(read.container);

      return place.parent?.container === read.parent && place.key === read.key;
    }

    let value: unknown;

    try {
      value = this.#throughCell({ owner: read.owner, key: read.key }, readAgain(read.owner, read.key));
    }
    catch {
      // Evaluating the formula reads the failing value again and fails as a read of host data does.
      return false;
    }

    if (read.kind === 'field') {
      return Object.is(value, read.value) && Object.is(hostShape(value), read.shape);
    }

    return value instanceof Formula && this.#resultToCompare({ owner: read.owner, key: read.key }, value) === read.result;
  }

  /** The result of a cell an earlier computation read, or `undefined` for a cell in progress, which tells a cycle. */
  #resultToCompare(place: CellPlace, formula: Formula): FormulaCell | undefined {
    const cell = this.#cellAt(place, formula);

    if (!cell.result) {
      if (cell.computing || cell.waiting) {
        return undefined;
      }

      if (this.#nesting + cell.nesting > NESTING_BUDGET) {
        throw new CellNotReady(cell);
      }
    }

    return this.#compute(cell);
  }

  /** Evaluates the formula of a cell and keeps what it read for the next pass, if the next pass can read it again. */
  #evaluateAndKeep(cell: Cell, memo: CellMemo | undefined): FormulaCell {
    cell.reads = [];

    const evaluated = this.#evaluate(cell);
    const result = memo && isSameResult(memo.result, evaluated) ? memo.result : evaluated;
    let memos = this.#memory.cells.get(cell.owner);

    if (cell.reads && !cell.cycle && !isVolatile(cell.formula)) {
      if (!memos) {
        memos = new Map();
        this.#memory.cells.set(cell.owner, memos);
      }

      memos.set(cell.key, { text: cell.formula.text, reads: cell.reads, result });
    }
    else {
      memos?.delete(cell.key);
    }

    cell.reads = undefined;

    return result;
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

  /**
   * Copies every container that holds formulas, keeping the copy of the previous pass for a container whose fields hold
   * the same and whose copied containers all keep theirs; all copies exist before any is filled, so links between them
   * need no recursion.
   */
  #copyContainers(copied: ReadonlySet<object>): void {
    const changed: object[] = [];

    for (const container of copied) {
      const memo = this.#memory.views.get(container);

      if (!memo || memo.pass !== this.#number - 1 || !this.#holdsFields(container, memo.fields)) {
        changed.push(container);
      }
    }

    // A container that holds a changed one changes too, since its copy links to the new copy.
    const renewed = new Set(changed);

    for (let index = 0; index < changed.length; index++) {
      for (const holder of this.#holders.get(changed[index]) ?? []) {
        if (copied.has(holder) && !renewed.has(holder)) {
          renewed.add(holder);
          changed.push(holder);
        }
      }
    }

    for (const container of copied) {
      const memo = this.#memory.views.get(container);

      if (memo && !renewed.has(container)) {
        memo.pass = this.#number;
        this.#views.set(container, memo.view);
      }
      else {
        const view = Array.isArray(container) ? [] : Object.create(Reflect.getPrototypeOf(container)) as object;

        this.#memory.views.set(container, { view, fields: this.#fieldsOf(container), pass: this.#number });
        this.#views.set(container, view);
      }
    }

    for (const container of renewed) {
      this.#fill(this.#views.get(container)!, this.#memory.views.get(container)!.fields);
    }
  }

  /** Tells whether the fields of a container hold what `kept` says they held, see {@link EvaluationPass.#fieldsOf}. */
  #holdsFields(container: object, kept: readonly unknown[]): boolean {
    const fields = this.#rawFieldsOf(container);

    if (fields.length !== kept.length) {
      return false;
    }

    for (let index = 0; index < fields.length; index += 4) {
      const key = fields[index] as string;
      const shown = this.#shownField({ container, key, attributes: fields[index + 1] as number, held: fields[index + 2] });

      if (key !== kept[index] || fields[index + 1] !== kept[index + 1] || !Object.is(shown, kept[index + 2]) || fields[index + 3] !== kept[index + 3]) {
        return false;
      }
    }

    return true;
  }

  /**
   * The own fields of a container as {@link ownFields} gives them, with what its cell holds in place of a formula: what a
   * view memo compares and a copy is filled with.
   */
  #fieldsOf(container: object): unknown[] {
    const fields = [...this.#rawFieldsOf(container)];

    for (let index = 0; index < fields.length; index += 4) {
      fields[index + 2] = this.#shownField({ container, key: fields[index] as string, attributes: fields[index + 1] as number, held: fields[index + 2] });
    }

    return fields;
  }

  /** What a field of a container shows in the view: a cell what `cell` gave, a formula cell what it holds. */
  #shownField({ container, key, attributes, held }: { container: object; key: string; attributes: number; held: unknown }): unknown {
    if ((attributes & ACCESSOR) !== 0 || (attributes & ENUMERABLE) === 0) {
      return held;
    }

    const place = { owner: container, key };
    const value = this.#shownCell(place, held);

    return value instanceof Formula ? this.#resultOf(place, value) : value;
  }

  #rawFieldsOf(container: object): unknown[] {
    let fields = this.#ownFields.get(container);

    if (!fields) {
      fields = ownFields(container);
      this.#ownFields.set(container, fields);
    }

    return fields;
  }

  /** Fills a copy with the fields {@link EvaluationPass.#fieldsOf} gave, a container linking to its copy. */
  #fill(view: object, fields: readonly unknown[]): void {
    for (let index = 0; index < fields.length; index += 4) {
      const key = fields[index] as string;
      const attributes = fields[index + 1] as number;
      const value = fields[index + 2];

      if (attributes & ACCESSOR) {
        Object.defineProperty(view, key, {
          get: value as (() => unknown) | undefined,
          set: fields[index + 3] as ((value: unknown) => void) | undefined,
          enumerable: (attributes & ENUMERABLE) !== 0,
          configurable: (attributes & CONFIGURABLE) !== 0,
        });

        continue;
      }

      const shown = isContainer(value) ? this.#views.get(value) ?? value : value;

      // Assigning a `__proto__` key would replace the prototype instead of adding a field.
      if (attributes === PLAIN_FIELD && key !== '__proto__') {
        Reflect.set(view, key, shown);
      }
      else {
        Object.defineProperty(view, key, {
          value: shown,
          enumerable: (attributes & ENUMERABLE) !== 0,
          configurable: (attributes & CONFIGURABLE) !== 0,
          writable: (attributes & WRITABLE) !== 0,
        });
      }
    }
  }
}

/** The read failure of an input without a value, for the formula that reads it. */
function inputFailure(cause: Error): CellReadFailure {
  return new CellReadFailure(({ name, location }) => Errors.Reference.InputError.create({ name }, { location, cause }));
}

/** Tells whether a new result shows the same as the kept one in every way, so readers of the cell keep their results. */
function isSameResult(kept: FormulaCell, result: FormulaCell): boolean {
  if (kept instanceof Error || result instanceof Error || kept.kind !== result.kind || !PLAIN_KINDS.has(kept.kind)) {
    return false;
  }

  return areEqual(kept, result) && kept.toString() === result.toString();
}

/**
 * The own fields of a container as a flat list, four items a field: its key, its attributes, and for a data field what
 * it holds, or for an accessor its getter and setter.
 */
function ownFields(container: object): unknown[] {
  const fields: unknown[] = [];

  for (const key of Object.getOwnPropertyNames(container)) {
    const descriptor = Object.getOwnPropertyDescriptor(container, key)!;
    const attributes = Number(descriptor.enumerable) | Number(descriptor.configurable) << 1 | Number(descriptor.writable) << 2;

    if ('value' in descriptor) {
      fields.push(key, attributes, descriptor.value, undefined);
    }
    else {
      // eslint-disable-next-line ts/unbound-method -- the accessors are compared by identity, never called
      fields.push(key, attributes | ACCESSOR, descriptor.get, descriptor.set);
    }
  }

  return fields;
}

/** Tells whether a formula calls a volatile routine, such as `now`, so its result may change with nothing it reads. */
function isVolatile(formula: Formula): boolean {
  let ast: AST.AstNode;

  try {
    ast = parseFormula(formula.text);
  }
  catch {
    return false;
  }

  let volatile = volatiles.get(ast);

  if (volatile === undefined) {
    volatile = DependencyExtractorVisitor.isVolatile(ast);
    volatiles.set(ast, volatile);
  }

  return volatile;
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
