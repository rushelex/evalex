import type { FormulaRoutine } from '../core/formula-routine';

/** One thing an editor can offer to type at the caret. */
export interface FormulaCompletion {
  /**
   * `field` for a field the host passed, `variable` for a name the formula itself declares, such as a `let` name or
   * `current` inside `filter`, `function` and `method` for routines of the scope, `choice` for a word a text argument takes.
   */
  readonly kind: 'field' | 'variable' | 'function' | 'method' | 'choice';
  /** What the list shows and the author types to find it: the label of a field, otherwise `text`. */
  readonly label: string;
  /**
   * What replaces the text the caret is in. For a function or a method, its call with empty parentheses, or its name
   * alone when parentheses already follow.
   */
  readonly text: string;
  /**
   * Offset in `text` to put the caret at once it is in: between the parentheses of a call that takes arguments,
   * otherwise after `text`.
   */
  readonly caret: number;
  /** For a function or a method, the routine, with its description and arguments. */
  readonly routine?: FormulaRoutine;
}
