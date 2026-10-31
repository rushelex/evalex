import type { FormulaTokenKind } from '../parser/ast/token';

/** A piece of formula text with what it is, for showing a formula that is not edited, with its fields by their labels. */
export interface FormulaSegment {
  /** The text of the piece; the texts of all pieces in order make up the formula. */
  readonly text: string;
  /** The kind of the token the piece is in, for coloring it; none for whitespace between tokens. */
  readonly kind?: FormulaTokenKind;
  /** For the name of a field, the field with the label to show in place of the name. */
  readonly field?: {
    readonly name: string;
    readonly label: string;
  };
}
