import type { FormulaRoutine } from '../core/formula-routine';

/** How a `FormulaLanguage` words what it tells an editor. */
export interface FormulaLanguageOptions {
  /**
   * Gives the description of a function or method in the host's language, such as a translation found by its `name`
   * and `form`. Every routine the language service gives carries it.
   *
   * @default The English description of the routine.
   */
  readonly description?: (routine: FormulaRoutine) => string;
}
