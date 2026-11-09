import type { FormulaDiagnostic, FormulaField, FormulaLanguage } from 'evalex/language';

/** What the formula extension knows about the formula being edited. */
export interface FormulaOptions {
  /** The language service of the scope the formula is evaluated in, with its functions and methods. */
  readonly language: FormulaLanguage;
  /**
   * The fields the formula can read at its place in the host's data, with their labels and types. Without them, names
   * are not checked, and completion offers no fields.
   */
  readonly fields?: readonly FormulaField[];
  /**
   * A record of the host's data the formula is evaluated on, such as the first row of a table, by the names the formula
   * reads, as `FormulaScope.evaluate` takes them: a name under the pointer and a selected part of the formula show what
   * they evaluate to on it. Without it, no values show.
   */
  readonly sample?: object;
  /**
   * Gives the text shown for a diagnostic, such as a translation found by its `messageKey` and filled in from its
   * `payload`.
   *
   * @default The English `message` of the diagnostic.
   */
  readonly message?: (diagnostic: FormulaDiagnostic) => string;
}
