import type { SyntaxError } from '../parser/grammar/parser';
import type { FormulaValue } from './data-types';
import type { CellReader } from './data-types/converter';
import type { FormulaError } from './errors';
import type { EvaluatorMemory } from './evaluator-memory';
import type { Formula } from './formula';
import type { ValueFormat } from './value-format';

import { Errors } from './errors';
import { EvaluationPass } from './evaluation-pass';
import { yieldToHost } from './yield-to-host';

/** What a formula cell holds once computed: its value, or the error of the formula. */
export type FormulaCell = FormulaValue | FormulaError | SyntaxError;

/** The shape `evaluate` gives back for data of type `T`: every `Formula` replaced by what its cell holds. */
export type FormulaView<T> = T extends Formula ? FormulaCell
  : T extends (...args: never[]) => unknown ? T
  : T extends object ? { [K in keyof T]: FormulaView<T[K]> }
  : T;

/** Where a cell of host data is: the object or list that holds it and its key there. */
export interface FormulaCellPlace {
  readonly owner: object;
  readonly key: string | number;
}

export interface FormulaEvaluatorOptions {
  /**
   * Reads a cell of data in a format of the host's own, such as a cell of a backend response, which cannot hold a
   * `Formula`: gives the value of the cell, or a `Formula` for a formula cell. Without it, every field is its own value.
   *
   * @remarks
   * Called once a pass for each field and list item of the data, in place of what the field holds: formulas read what
   * it gives, and the view holds it, or the result of the formula it gives. It gives the same value for the same cell
   * unchanged, so the evaluator keeps results between passes. An error it throws fails the formulas that read the cell
   * and goes to `onInputError`, and the view keeps what the field holds.
   */
  readonly cell?: (value: unknown, place: FormulaCellPlace) => unknown;
  /**
   * Gets a failure of host data a formula reads, such as a getter that threw or a value without a formula form, once
   * per failure in a pass. The formula itself fails with an `INPUT_ERROR` caused by it.
   */
  readonly onInputError?: (error: Error) => void;
}

/** How long `evaluateAsync` works before it lets the host run, in milliseconds: half of a frame at 60 Hz. */
const SLICE_MS = 8;

/**
 * Computes the formula cells of host data, giving back data of the same shape with the results in place of formulas.
 *
 * @remarks
 * Every pass reads the data as it is at the call, so the host changes its data however it likes, in place or by
 * replacing it, and calls `evaluate` again. The data itself is never changed.
 *
 * The evaluator keeps, for each formula cell, what its formula read and what it gave, as long as the host keeps the
 * object holding the cell. A later pass reads all of that again and evaluates only the formulas whose reads changed;
 * every other cell keeps the very same result, and a copied object or list whose fields hold the same keeps the very
 * same copy, so a host comparing by identity re-renders only what changed.
 */
export class FormulaEvaluator {
  readonly #format: ValueFormat | undefined;
  readonly #onInputError: ((error: Error) => void) | undefined;
  readonly #cell: ((value: unknown, place: FormulaCellPlace) => unknown) | undefined;
  readonly #memory: EvaluatorMemory = new WeakMap();
  #passes = 0;
  /** The last pass, which reads the fields of the values it computed for as long as they are read. */
  #pass: EvaluationPass | undefined;
  /** Aborts the call of `evaluateAsync` still computing, if any. */
  #pending: AbortController | undefined;

  /** Takes `format` validated by the scope that creates the evaluator. */
  constructor({ format, onInputError, cell }: FormulaEvaluatorOptions & { format: ValueFormat | undefined }) {
    this.#format = format;
    this.#onInputError = onInputError;
    this.#cell = cell;
  }

  /**
   * Computes every formula cell found through the data properties of `data`.
   *
   * @returns Data of the shape of `data`: a formula cell holds its value or the error of its formula, an object or list
   * that holds formulas, directly or through its fields, is a copy, and everything else is what `data` holds. Data read
   * through the `cell` option has a shape of the host's own, which the host names: `evaluate<ReportView>(report)`.
   */
  evaluate<T extends object>(data: T): FormulaView<T>;
  evaluate<View>(data: object): View;
  evaluate(data: object): unknown {
    this.#abortPending();

    return this.#evaluate(data);
  }

  /**
   * Computes what `evaluate` computes without holding the main thread for long, for data too large to compute at once.
   *
   * @remarks
   * The cells compute in short slices, with the host running its own tasks in between, so the data may change while they
   * compute. Then a pass like `evaluate` reads again what each cell read and computes again only what changed, so the
   * view matches the data as it is when the promise resolves. That last pass is not split: it takes as long as a pass of
   * `evaluate` after a change.
   *
   * A later call of `evaluate` or `evaluateAsync` aborts the pending call: its promise rejects with an `AbortError`.
   *
   * @param options.signal - Aborts the call; the promise rejects with the reason of the signal.
   * @param options.timeoutMs - How long the call may take; the promise rejects with an `EXECUTION_TIMEOUT` error once a
   * slice ends later.
   * @returns A promise of what `evaluate` gives.
   */
  evaluateAsync<T extends object>(data: T, options?: { readonly signal?: AbortSignal; readonly timeoutMs?: number }): Promise<FormulaView<T>>;
  evaluateAsync<View>(data: object, options?: { readonly signal?: AbortSignal; readonly timeoutMs?: number }): Promise<View>;
  async evaluateAsync(data: object, { signal, timeoutMs }: { readonly signal?: AbortSignal; readonly timeoutMs?: number } = {}): Promise<unknown> {
    this.#abortPending();

    const pending = new AbortController();
    const start = performance.now();
    // Its failures are reported by the pass that gives the view, which evaluates again every cell that read one.
    const slices = new EvaluationPass({
      data,
      format: this.#format,
      onInputError: undefined,
      cell: this.#cell,
      memory: this.#memory,
      number: ++this.#passes,
      hostReader: this.#hostReader,
    });

    const resume = async (): Promise<void> => {
      await yieldToHost();
      pending.signal.throwIfAborted();
      signal?.throwIfAborted();

      if (timeoutMs !== undefined && performance.now() - start >= timeoutMs) {
        throw Errors.Runtime.ExecutionTimeout.create({ timeoutMs });
      }
    };

    this.#pending = pending;

    try {
      do {
        await resume();
      } while (!this.#slice(slices));

      await resume();
      // The copies it keeps spare the last pass making them, so that pass only compares them.
      slices.view();
      await resume();
    }
    finally {
      if (this.#pending === pending) {
        this.#pending = undefined;
      }
    }

    return this.#evaluate(data);
  }

  /** Computes a slice of a pass, with the fields of computed values read through it meanwhile; tells whether it is done. */
  #slice(pass: EvaluationPass): boolean {
    const latest = this.#pass;
    const end = performance.now() + SLICE_MS;

    this.#pass = pass;

    try {
      return pass.advance(() => performance.now() >= end);
    }
    finally {
      this.#pass = latest;
    }
  }

  #abortPending(): void {
    this.#pending?.abort(new DOMException('A later call of the evaluator replaced this one.', 'AbortError'));
    this.#pending = undefined;
  }

  #evaluate(data: object): unknown {
    this.#passes += 1;
    this.#pass = new EvaluationPass({
      data,
      format: this.#format,
      onInputError: this.#onInputError,
      cell: this.#cell,
      memory: this.#memory,
      number: this.#passes,
      hostReader: this.#hostReader,
    });

    return this.#pass.view();
  }

  // A value an earlier pass computed is reused by later ones, so the fields of its objects read through the latest pass.
  readonly #hostReader: CellReader = (cell) => (this.#pass ? this.#pass.readCell(cell) : cell.convert(cell.read()));
}
