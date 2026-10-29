import type { Kind } from './data-types';

/**
 * A function or method a formula can call, as an editor shows it in completion and signature help.
 *
 * @see FormulaScope.routines
 */
export interface FormulaRoutine {
  /** The name a formula calls it by. */
  readonly name: string;
  /**
   * `function` for `name(…)`, `method` for `value.name(…)`. A routine with both forms is listed once for each, and a
   * method name that means different things on different kinds, such as `add` of numbers and of dates, once for each meaning.
   */
  readonly form: 'function' | 'method';
  /** One sentence of at most 65 characters, for a tooltip. */
  readonly description: string;
  /** For a method, the kinds of values it can be called on; empty for a function. */
  readonly kinds: readonly Kind[];
  /** The argument lists it accepts, one per alternative; empty when it checks its arguments itself. */
  readonly signatures: readonly FormulaRoutineSignature[];
}

/** One argument list a routine accepts; a method's list leaves out the value it is called on. */
export interface FormulaRoutineSignature {
  /** For a method, the kinds of values this list is accepted on, such as `Number` for `5.add(b)`; empty for a function. */
  readonly kinds: readonly Kind[];
  readonly parameters: readonly FormulaRoutineParameter[];
}

/** One argument of a routine signature. */
export interface FormulaRoutineParameter {
  /** The name signature help shows, such as `places`; absent when the routine gives none. */
  readonly name?: string;
  /**
   * The kinds the argument takes, `Any` for any value. For an argument evaluated once per item, such as the condition
   * of `filter`, the kinds each evaluation returns.
   */
  readonly kinds: readonly Kind[];
  readonly optional: boolean;
  /** The argument takes any number of values, as in `sum(1, 2, 3)`. */
  readonly repeatable: boolean;
  /** The only words a text argument takes, such as the units of `dateBetween`; absent when it takes any text. */
  readonly choices?: readonly string[];
  /** For an argument evaluated once per item, the variables it can read, such as `current` and `index`. */
  readonly variables?: readonly string[];
}
