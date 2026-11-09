import type { FormulaValue } from '../core/data-types';
import type { FormulaDiagnostic } from './formula-diagnostic';

/** The values a part of a formula evaluates to on a sample record, for showing them next to it. */
export interface FormulaValueAt {
  /** Offset where the part starts, for highlighting it. */
  readonly from: number;
  /** Offset where the part ends. */
  readonly to: number;
  /**
   * A value for each time evaluation reached the part: one for most parts, one per item inside an expression evaluated
   * per item, such as the condition of `filter`, and none in a branch evaluation skipped.
   */
  readonly values: readonly FormulaValue[];
  /** The error evaluation failed with inside the part, which ends its values. */
  readonly error?: FormulaDiagnostic;
}
