import type { SyntaxError } from '../parser/grammar/parser';
import type { FormulaValue } from './data-types';
import type { CellReader } from './data-types/converter';
import type { FormulaError } from './errors';
import type { EvaluatorMemory } from './evaluator-memory';
import type { Formula } from './formula';
import type { ValueFormat } from './value-format';

import { EvaluationPass } from './evaluation-pass';

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
  readonly #memory: EvaluatorMemory = { cells: new WeakMap(), views: new WeakMap() };
  #passes = 0;
  /** The last pass, which reads the fields of the values it computed for as long as they are read. */
  #pass: EvaluationPass | undefined;

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
    this.#passes += 1;
    this.#pass = new EvaluationPass({
      data,
      format: this.#format,
      onInputError: this.#onInputError,
      memory: this.#memory,
      number: this.#passes,
      hostReader: this.#hostReader,
    });

    return this.#pass.view() as FormulaView<T>;
  }

  // A value an earlier pass computed is reused by later ones, so the fields of its objects read through the latest pass.
  readonly #hostReader: CellReader = (cell) => (this.#pass ? this.#pass.readCell(cell) : cell.convert(cell.read()));
}
