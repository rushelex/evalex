import type { FormulaCompletion } from './formula-completion';

/** What an editor can offer to type at the caret, and the text it replaces. */
export interface FormulaCompletions {
  /** Offset where the text an item replaces starts: the start of the word or of the text inside quotes. */
  readonly from: number;
  /** Offset where it ends, which may be past the caret when the caret is inside a word. */
  readonly to: number;
  readonly items: readonly FormulaCompletion[];
}
