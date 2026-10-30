import type { FormulaRoutine } from '../core/formula-routine';
import type { FormulaType } from '../core/types';

/** What the name under the caret stands for, for a tooltip over it. */
export interface FormulaHover {
  /** Offset where the name starts, for highlighting it. */
  readonly from: number;
  /** Offset where the name ends. */
  readonly to: number;
  /**
   * `field` for a field of the record or of a record value, `variable` for a name the formula itself declares, such as a
   * `let` name or `current` inside `filter`, `function` and `method` for routines of the scope.
   */
  readonly kind: 'field' | 'variable' | 'function' | 'method';
  /** The label of a field, otherwise the name as written. */
  readonly label: string;
  /** The type of the value of the field or the variable, or of the result of the call, such as a line for `first(lines)`. */
  readonly type: FormulaType;
  /** For a function or a method, the routines the call may run, with their descriptions and arguments. */
  readonly routines?: readonly FormulaRoutine[];
}
