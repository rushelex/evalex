import type { FormulaDiagnostic, FormulaField, FormulaLanguage } from 'evalex/language';
import type { Node } from 'prosemirror-model';

/** What the formula plugins know about the formulas of the document. */
export interface FormulaOptions {
  /** The language service of the scope the formulas are evaluated in, with its functions and methods. */
  readonly language: FormulaLanguage;
  /**
   * The fields a formula can read, with their labels and types: one list for every formula of the document, or the list
   * for a formula node at its position, such as by an attribute the host gives the node. Without them, names are not
   * checked, completion offers no fields and there are no chips.
   *
   * @remarks
   * A function that returns the same list for the same formula lets the plugins reuse what they found in it. Once the
   * list changes, `refreshFormulas` makes the formulas read it again.
   */
  readonly fields?: readonly FormulaField[] | ((formula: { readonly node: Node; readonly pos: number }) => readonly FormulaField[] | undefined);
  /**
   * A record of the host's data a formula is evaluated on, such as the first row of a table, by the names the formula
   * reads, as `FormulaScope.evaluate` takes them: one for every formula of the document, or the record for a formula node
   * at its position. A name under the pointer and a selected part of a formula show what they evaluate to on it. Without
   * it, no values show.
   */
  readonly sample?: object | ((formula: { readonly node: Node; readonly pos: number }) => object | undefined);
  /**
   * Gives the text shown for a diagnostic, such as a translation found by its `messageKey` and filled in from its
   * `payload`.
   *
   * @default The English `message` of the diagnostic.
   */
  readonly message?: (diagnostic: FormulaDiagnostic) => string;
}
