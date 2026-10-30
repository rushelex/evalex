import type { Kind } from './data-types';
import type { FormulaRoutineExample } from './formula-routine-example';
import type { FormulaType } from './types';

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
  /**
   * Calls of it written in its form, such as `round(3.14159, 2)` for the function and `3.14159.round(2)` for the method,
   * each with what it returns or the error it fails with. Examples that read the records around their formula, as those
   * of `parent` do, are left out.
   */
  readonly examples: readonly FormulaRoutineExample[];
}

/** One argument list a routine accepts; a method's list leaves out the value it is called on. */
export interface FormulaRoutineSignature {
  /**
   * For a method, the type of the value it is called on with this list, such as `Number` for `5.add(b)` or a list of `T`
   * for `list.first()`; absent for a function, whose list starts with that value.
   */
  readonly subject?: FormulaType;
  readonly parameters: readonly FormulaRoutineParameter[];
  /** The type of the result of a call with this list, such as `Number` for `round`. */
  readonly returns: FormulaType;
}

/** One argument of a routine signature. */
export interface FormulaRoutineParameter {
  /** The name signature help shows, such as `places`. */
  readonly name: string;
  /**
   * The values the argument takes, such as a list of numbers. For an argument evaluated once per item, such as the
   * condition of `filter`, what each evaluation returns.
   */
  readonly type: FormulaType;
  readonly optional: boolean;
  /** The argument takes any number of values, as in `sum(1, 2, 3)`. */
  readonly repeatable: boolean;
  /** The only words a text argument takes, such as the units of `dateBetween`; absent when it takes any text. */
  readonly choices?: readonly string[];
  /** For an argument evaluated once per item, the variables it can read, such as `current` and `index`. */
  readonly variables?: readonly string[];
}
