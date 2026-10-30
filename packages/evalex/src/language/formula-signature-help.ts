import type { FormulaRoutine } from '../core/formula-routine';

/** The call around the caret, for showing its arguments with the one being typed marked. */
export interface FormulaSignatureHelp {
  /**
   * The routines the call may run: the function of its name, or every method of its name, since the kind of the value
   * before the dot is not known until the formula is evaluated.
   */
  readonly routines: readonly FormulaRoutine[];
  /** Zero-based position of the argument the caret is in, counted by the commas of the call before it. */
  readonly argument: number;
}
