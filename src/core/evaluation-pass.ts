import type { AST } from '../parser';
import type { FormulaValue } from './data-types';
import type { CellPlace, CellReader } from './data-types/converter';
import type { CellMemo, ContainerMemo, EvaluatorMemory, Read } from './evaluator-memory';
import type { FormulaCell, FormulaCellPlace } from './formula-evaluator';
import type { PassNames, Place } from './record-names';
import type { ValueFormat } from './value-format';

import { SyntaxError } from '../parser/grammar/parser';
import { CellReadFailure } from './cell-read-failure';
import { areEqual, isFormulaValue, Kind } from './data-types';
import { hostShape } from './data-types/converter';
import { Errors, FormulaError } from './errors';
import { evaluateFormula } from './evaluate-formula';
import { Formula } from './formula';
import { ABSENT, isContainer, readAgain } from './host-containers';
import { parseFormula } from './parse-formula';
import { RecordNames } from './record-names';
import { isVolatileFormula } from './volatile-formula';

/**
 * How deep cells compute inside one another before the rest wait on an explicit stack, in levels of formula nesting.
 * The default call stack of Node holds about 2,300 such levels; the rest is left to the host's own frames.
 */
const NESTING_BUDGET = 500;

/** The levels a cell costs beyond the nesting of its formula: reading the cell and starting its evaluation. */
const CELL_NESTING = 10;

/** Nesting of each parsed formula, kept as long as its parse is cached. */
const nestings = new WeakMap<AST.AstNode, number>();

/** Kinds of results that equal content shows the same in every way, so an equal new result can keep the old one. */
const PLAIN_KINDS: ReadonlySet<string> = new Set([Kind.Number, Kind.String, Kind.Boolean, Kind.Null]);

/** Bits of the attributes of a field, as {@link EvaluationPass} keeps them in a view memo. */
const ENUMERABLE = 1;
const CONFIGURABLE = 2;
const WRITABLE = 4;
const ACCESSOR = 8;
const PLAIN_FIELD = ENUMERABLE | CONFIGURABLE | WRITABLE;

/** How many cells of a container are searched in order, which costs a large list of records less than a map each. */
const FEW_CELLS = 8;

/**
 * A container of host data in one pass: where it sits, what its fields hold, its formula cells and its copy in the view,
 * kept together so a pass looks a container up once.
 */
interface Site extends Place {
  parent: Site | undefined;
  key: string | number | undefined;
  /** The walk gave it its place; a container reached only through a getter has none. */
  placed: boolean;
  /** Its own fields as {@link ownFields} gives them, read once a pass. */
  fields: unknown[] | undefined;
  /** The sites holding it through a data property, a repeat for each such property. */
  holders: Site[] | undefined;
  /** Its formula cells; a list item is keyed by its index as text, as the view reads it from descriptors. */
  cells: Cell[] | undefined;
  /** Its cells by key, once it has more than {@link FEW_CELLS}. */
  cellsByKey: Map<string, Cell> | undefined;
  /** What the evaluator kept for it, once {@link EvaluationPass.#memoOf} read it. */
  memo: ContainerMemo | undefined;
  memoRead: boolean;
  /** It holds formula cells, directly or through containers it holds, so the view copies it. */
  copied: boolean;
  /** Its copy changes in this pass. */
  renewed: boolean;
  view: object | undefined;
}

/** A formula cell of one pass and where its computation stands. */
interface Cell {
  readonly site: Site;
  readonly key: string;
  readonly formula: Formula;
  /** The levels of nesting computing the cell takes, see {@link NESTING_BUDGET}, once {@link EvaluationPass.#nestingOf} told. */
  nesting: number | undefined;
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
  readonly #root: Site;
  readonly #format: ValueFormat | undefined;
  readonly #onInputError: ((error: Error) => void) | undefined;
  readonly #memory: EvaluatorMemory;
  /** The number of this pass, one more than the pass before it. */
  readonly #number: number;
  /** The reader every converted value reads its fields through, the same in every pass. */
  readonly #hostReader: CellReader;
  /** Failures of host data by owner and key, keyed as {@link Site.cells}. */
  readonly #failures = new Map<object, Map<string, Error>>();
  readonly #sites = new Map<object, Site>();
  /** Sites in the order the walk reaches them, the root first, and how many of them it has visited. */
  readonly #queue: Site[];
  #walked = 0;
  readonly #found: Cell[] = [];
  /** How many of the cells found {@link EvaluationPass.advance} has computed. */
  #computed = 0;
  /** Cells being computed inside one another, the innermost last. */
  readonly #computing: Cell[] = [];
  /** Cells waiting on the explicit stack, the next to compute last. */
  readonly #waiting: Cell[] = [];
  /** The nesting of the cells being computed, together. */
  #nesting = 0;
  readonly #cell: ((value: unknown, place: FormulaCellPlace) => unknown) | undefined;
  /** What `cell` gave for each place, keyed as {@link Site.cells}. */
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
    this.#root = this.#siteOf(data);
    this.#root.placed = true;
    this.#queue = [this.#root];
    this.#format = format;
    this.#onInputError = onInputError;
    this.#cell = cell;
    this.#memory = memory;
    this.#number = number;
    this.#hostReader = hostReader;
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
      this.#resultOf(this.#found[this.#computed]);
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

    return this.#root.view ?? this.#root.container;
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
    const cell = this.#cellAt({ site: this.#siteOf(place.owner), key: String(place.key), formula });

    if (!cell.result) {
      if (cell.computing || cell.waiting) {
        throw this.#cycleAt(cell);
      }

      if (this.#nesting + this.#nestingOf(cell) > NESTING_BUDGET) {
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
    placeOf: (container) => this.#siteOf(container),
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
  #walkContainer(site: Site): void {
    const container = site.container;
    const visit = (key: string | number, held: unknown): void => {
      // Without the option a field shows what it holds, which spares a place for each field of large data.
      const value = this.#cell ? this.#shownCell({ owner: container, key }, held) : held;

      if (value instanceof Formula) {
        this.#found.push(this.#cellAt({ site, key: String(key), formula: value }));
      }
      else if (isContainer(value)) {
        const inner = this.#siteOf(value);

        if (inner.holders) {
          inner.holders.push(site);
        }
        else {
          inner.holders = [site];
        }

        if (!inner.placed) {
          inner.placed = true;
          inner.parent = site;
          inner.key = key;
          this.#queue.push(inner);
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

    site.fields = fields;

    for (let field = 0; field < fields.length; field += 4) {
      const attributes = fields[field + 1] as number;

      if ((attributes & ENUMERABLE) !== 0 && (attributes & ACCESSOR) === 0) {
        visit(fields[field] as string, fields[field + 2]);
      }
    }
  }

  /** The site of a container, placed by the walk once it reaches it; until then its formulas read only its own fields. */
  #siteOf(container: object): Site {
    let site = this.#sites.get(container);

    if (!site) {
      site = {
        container,
        parent: undefined,
        key: undefined,
        placed: false,
        fields: undefined,
        holders: undefined,
        cells: undefined,
        cellsByKey: undefined,
        memo: undefined,
        memoRead: false,
        copied: false,
        renewed: false,
        view: undefined,
      };
      this.#sites.set(container, site);
    }

    return site;
  }

  #memoOf(site: Site): ContainerMemo | undefined {
    if (!site.memoRead) {
      site.memo = this.#memory.get(site.container);
      site.memoRead = true;
    }

    return site.memo;
  }

  #keptMemoOf(site: Site): ContainerMemo {
    let memo = this.#memoOf(site);

    if (!memo) {
      memo = { cells: undefined, view: undefined };
      this.#memory.set(site.container, memo);
      site.memo = memo;
    }

    return memo;
  }

  #cellAt({ site, key, formula }: { site: Site; key: string; formula: Formula }): Cell {
    const found = site.cellsByKey ? site.cellsByKey.get(key) : site.cells?.find((cell) => cell.key === key);

    if (found) {
      return found;
    }

    const cell: Cell = {
      site,
      key,
      formula,
      nesting: undefined,
      result: undefined,
      computing: false,
      waiting: false,
      cycle: undefined,
      reads: undefined,
    };

    site.cells ??= [];
    site.cells.push(cell);

    if (site.cellsByKey) {
      site.cellsByKey.set(key, cell);
    }
    else if (site.cells.length > FEW_CELLS) {
      site.cellsByKey = new Map(site.cells.map((each) => [each.key, each]));
    }

    return cell;
  }

  /** Computes a cell, and every cell it waits for, outside any other cell. */
  #resultOf(target: Cell): FormulaCell {
    if (target.result) {
      return target.result;
    }

    const waiting = this.#waiting;
    // The host may read a computed value inside `cell` while a view is made, which computes cells from here again.
    const outside = waiting.length;

    waiting.push(target);
    target.waiting = true;

    while (waiting.length > outside) {
      const cell = waiting[waiting.length - 1];

      try {
        this.#compute(cell);
        cell.waiting = false;
        waiting.pop();
      }
      catch (error) {
        if (!(error instanceof CellNotReady)) {
          waiting.length = outside;

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

    const memo = this.#memoOf(cell.site)?.cells?.get(cell.key);
    const nesting = this.#nestingOf(cell, memo);

    cell.computing = true;
    this.#computing.push(cell);
    this.#nesting += nesting;

    try {
      cell.result = memo && this.#holds(cell, memo) ? memo.result : this.#evaluateAndKeep(cell, memo);

      return cell.result;
    }
    finally {
      cell.computing = false;
      this.#computing.pop();
      this.#nesting -= nesting;
    }
  }

  /** The nesting of a cell, taken from its memo while the formula is the same, since parsing it again costs more. */
  #nestingOf(cell: Cell, memo = this.#memoOf(cell.site)?.cells?.get(cell.key)): number {
    cell.nesting ??= memo?.text === cell.formula.text ? memo.nesting : CELL_NESTING + nestingOf(cell.formula);

    return cell.nesting;
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
      const place = this.#siteOf(read.container);

      return place.parent?.container === read.parent && place.key === read.key;
    }

    let value: unknown;

    try {
      value = readAgain(read.owner, read.key);

      if (this.#cell) {
        value = this.#throughCell({ owner: read.owner, key: read.key }, value);
      }
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
    const cell = this.#cellAt({ site: this.#siteOf(place.owner), key: String(place.key), formula });

    if (!cell.result) {
      if (cell.computing || cell.waiting) {
        return undefined;
      }

      if (this.#nesting + this.#nestingOf(cell) > NESTING_BUDGET) {
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

    if (cell.reads && !cell.cycle && !isVolatileFormula(cell.formula.text)) {
      const kept = this.#keptMemoOf(cell.site);

      kept.cells ??= new Map();
      kept.cells.set(cell.key, { text: cell.formula.text, nesting: cell.nesting!, reads: cell.reads, result });
    }
    else {
      this.#memoOf(cell.site)?.cells?.delete(cell.key);
    }

    cell.reads = undefined;

    return result;
  }

  #evaluate({ site, formula }: Cell): FormulaCell {
    try {
      const result = evaluateFormula({
        formula: formula.text,
        ast: parseFormula(formula.text),
        properties: new RecordNames({ place: site, pass: this.#names }),
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

  /** Sites holding formula cells, and every site that holds one of those, through any number of steps. */
  #containersToCopy(): Site[] {
    const copied: Site[] = [];

    for (const { site } of this.#found) {
      if (!site.copied) {
        site.copied = true;
        copied.push(site);
      }
    }

    for (let index = 0; index < copied.length; index++) {
      for (const holder of copied[index].holders ?? []) {
        if (!holder.copied) {
          holder.copied = true;
          copied.push(holder);
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
  #copyContainers(copied: readonly Site[]): void {
    const renewed: Site[] = [];

    for (const site of copied) {
      const memo = this.#memoOf(site)?.view;

      if (!memo || memo.pass !== this.#number - 1 || !this.#holdsFields(site, memo.fields)) {
        site.renewed = true;
        renewed.push(site);
      }
    }

    // A container that holds a changed one changes too, since its copy links to the new copy.
    for (let index = 0; index < renewed.length; index++) {
      for (const holder of renewed[index].holders ?? []) {
        if (holder.copied && !holder.renewed) {
          holder.renewed = true;
          renewed.push(holder);
        }
      }
    }

    for (const site of copied) {
      const memo = this.#memoOf(site)?.view;

      if (memo && !site.renewed) {
        memo.pass = this.#number;
        site.view = memo.view;
      }
      else {
        const container = site.container;
        const view = Array.isArray(container) ? [] : Object.create(Reflect.getPrototypeOf(container)) as object;

        this.#keptMemoOf(site).view = { view, fields: this.#fieldsOf(site), pass: this.#number };
        site.view = view;
      }
    }

    for (const site of renewed) {
      this.#fill(site.view!, this.#memoOf(site)!.view!.fields);
    }
  }

  /** Tells whether the fields of a container hold what `kept` says they held, see {@link EvaluationPass.#fieldsOf}. */
  #holdsFields(site: Site, kept: readonly unknown[]): boolean {
    const fields = this.#rawFieldsOf(site);

    if (fields.length !== kept.length) {
      return false;
    }

    for (let index = 0; index < fields.length; index += 4) {
      if (fields[index] !== kept[index] || fields[index + 1] !== kept[index + 1] || fields[index + 3] !== kept[index + 3]) {
        return false;
      }

      if (!Object.is(this.#shownFieldAt(site, fields, index), kept[index + 2])) {
        return false;
      }
    }

    return true;
  }

  /** What the field at `index` of `fields` shows in the view, see {@link EvaluationPass.#shownField}. */
  #shownFieldAt(site: Site, fields: readonly unknown[], index: number): unknown {
    const held = fields[index + 2];

    // Only a formula or the cell option changes what a field shows; the rest of large data takes this way.
    if (!this.#cell && !(held instanceof Formula)) {
      return held;
    }

    return this.#shownField({ site, key: fields[index] as string, attributes: fields[index + 1] as number, held });
  }

  /**
   * The own fields of a container as {@link ownFields} gives them, with what its cell holds in place of a formula: what a
   * view memo compares and a copy is filled with.
   */
  #fieldsOf(site: Site): unknown[] {
    const fields = [...this.#rawFieldsOf(site)];

    for (let index = 0; index < fields.length; index += 4) {
      fields[index + 2] = this.#shownFieldAt(site, fields, index);
    }

    return fields;
  }

  /** What a field of a container shows in the view: a cell what `cell` gave, a formula cell what it holds. */
  #shownField({ site, key, attributes, held }: { site: Site; key: string; attributes: number; held: unknown }): unknown {
    if ((attributes & ACCESSOR) !== 0 || (attributes & ENUMERABLE) === 0) {
      return held;
    }

    const value = this.#cell ? this.#shownCell({ owner: site.container, key }, held) : held;

    return value instanceof Formula ? this.#resultOf(this.#cellAt({ site, key, formula: value })) : value;
  }

  #rawFieldsOf(site: Site): unknown[] {
    site.fields ??= ownFields(site.container);

    return site.fields;
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

      // Only a container the walk reached has a copy, so any other object is looked up in vain but cheaply.
      const shown = typeof value === 'object' && value !== null ? this.#sites.get(value)?.view ?? value : value;

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
    const attributes = (descriptor.enumerable ? ENUMERABLE : 0) | (descriptor.configurable ? CONFIGURABLE : 0) | (descriptor.writable ? WRITABLE : 0);

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
