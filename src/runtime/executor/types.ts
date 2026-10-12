import type { Expression, FormulaDataType, ValueFormat } from '../../core';

/**
 * Serializable request for formula execution.
 */
export interface FormulaExecRequest {
  readonly expression: Expression;
  readonly context: ReadonlyMap<string, FormulaDataType>;
  readonly format?: ValueFormat;
}

/**
 * Serializable result of formula execution.
 */
export interface FormulaExecResult {
  readonly result: FormulaDataType;
  readonly dependencies: ReadonlySet<string>;
}
