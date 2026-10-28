import type { FormulaValue } from './data-types';
import type { HostValue } from './data-types/types';
import type { FormulaEvaluatorOptions } from './formula-evaluator';
import type { FormulaRoutine } from './formula-routine';
import type { ValueFormat } from './value-format';

import { isFormulaValue } from './data-types';
import { evaluateFormula } from './evaluate-formula';
import { FormulaEvaluator } from './formula-evaluator';
import { HostValues } from './host-values';
import { parseFormula } from './parse-formula';
import { routinesRegistry } from './routines/registry';
import { routineCatalog } from './routines/routine-catalog';
import { DEFAULT_TIME_ZONE, isTimeZone } from './time-zone';
import { validateValueFormat } from './value-format';

/** Settings a host gives a `FormulaScope` once, for every formula it and its evaluators compute. */
export interface FormulaScopeOptions {
  /** How values look where a formula turns them into text: `+` with text, `join`, `format()`. */
  readonly format?: ValueFormat;
  /**
   * The time zone formulas read dates in: a time zone name such as `Europe/Berlin` or an offset such as `+05:00`.
   *
   * @remarks
   * It decides the day `today()` gives, the fields `hour()`, `month()` and the like read, the fields `formatDate` shows
   * without a zone of its own, where days and months start in date arithmetic, and the instant of a date and time written
   * without an offset. Dates still leave the formula in UTC.
   *
   * @default 'UTC'
   */
  readonly timeZone?: string;
}

/**
 * Evaluates formulas over plain host values with settings the host gives once.
 *
 * @remarks
 * A host value, and each field of an object inside it, converts to a formula value only when the formula reads it, so a
 * value the formula never reads never fails it, and records that link to each other both ways work. Only own fields of `values` are names. A formula value passed back, such as an earlier result,
 * is read as it is, without losing precision.
 *
 * Showing a result is up to the host: `format` applies only where the formula itself turns values into text.
 *
 * @example
 * ```ts
 * const scope = new FormulaScope({ format: { number: (value) => value.toFixed(2) } });
 *
 * const total = scope.evaluate('price * quantity', { price: 250, quantity: 4 });
 * total.kind;  // 'Number'
 * total.value; // 1000
 *
 * scope.evaluate('"Total: " + total', { total }).value; // 'Total: 1000.00'
 * ```
 */
export class FormulaScope {
  readonly #format: ValueFormat | undefined;
  readonly #timeZone: string;

  /**
   * @throws ReferenceError when the runtime has no `Temporal`, which dates need; `temporal-polyfill/global` provides it.
   * @throws TypeError when a name list of `format.names` holds a wrong number of names.
   * @throws RangeError when `timeZone` is neither a time zone name nor an offset.
   */
  constructor(options: FormulaScopeOptions = {}) {
    // Every date reads the global `Temporal` when it is computed, so a missing one fails here rather than inside a formula.
    if (typeof globalThis.Temporal !== 'object') {
      throw new ReferenceError('evalex needs Temporal, which this runtime lacks. Import "temporal-polyfill/global" before creating a FormulaScope.');
    }

    validateValueFormat(options.format);

    if (options.timeZone !== undefined && !isTimeZone(options.timeZone)) {
      throw new RangeError(`timeZone "${options.timeZone}" is neither a time zone name such as "Europe/Berlin" nor an offset such as "+05:00".`);
    }

    this.#format = options.format;
    this.#timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  }

  /**
   * Creates an evaluator that computes the formula cells of host data with the settings of the scope.
   *
   * @example
   * ```ts
   * const evaluator = scope.evaluator();
   * const view = evaluator.evaluate({ price: 250, quantity: 4, cost: new Formula('price * quantity') });
   *
   * view.cost.value; // 1000
   * ```
   */
  evaluator(options: FormulaEvaluatorOptions = {}): FormulaEvaluator {
    return new FormulaEvaluator({ ...options, format: this.#format, timeZone: this.#timeZone });
  }

  /**
   * Evaluates a formula over host values found by name.
   *
   * @param formula Formula text; its parse is cached per text.
   * @param values Host values by the names the formula reads them by: plain data, dates, class instances,
   * and formula values such as earlier results.
   * @returns The value the formula computes; its `kind` tells what it holds.
   * @throws SyntaxError when the text is not a valid formula.
   * @throws FormulaError when the formula fails; its location points at the part of the formula at fault.
   * @throws TypeError naming the path, such as `order.lines[2]`, to a value the formula reads that has no formula form.
   */
  evaluate<T extends object = Record<string, never>>(formula: string, values?: T & HostValue<T>): FormulaValue {
    const result = evaluateFormula({
      formula,
      ast: parseFormula(formula),
      properties: new HostValues({ values: values ?? {}, timeZone: this.#timeZone }),
      format: this.#format,
      timeZone: this.#timeZone,
    });

    if (!isFormulaValue(result)) {
      throw new TypeError(`The formula computed a value of an unknown data type, ${result.kind}.`);
    }

    return result;
  }

  /**
   * Lists the functions and methods formulas evaluated through the scope can call, for completion and signature help.
   *
   * @returns A new list on every call, sorted by name, a function before the methods of its name.
   *
   * @example
   * ```ts
   * const round = scope.routines().find(({ name, form }) => name === 'round' && form === 'function');
   *
   * round?.signatures[0]?.parameters.map(({ name, optional }) => (optional ? `[${name}]` : name)).join(', ');
   * // 'number, [places]'
   * ```
   */
  routines(): FormulaRoutine[] {
    return routineCatalog(routinesRegistry);
  }
}
