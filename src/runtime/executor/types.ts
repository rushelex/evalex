import type { Expression, FormulaDataType } from '../../core';

/**
 * Serializable request for formula execution.
 */
export interface FormulaExecRequest {
  readonly expression: Expression;
  readonly context: Record<string, FormulaDataType>;
}

/**
 * Serializable result of formula execution.
 */
export interface FormulaExecResult {
  readonly result: FormulaDataType;
  readonly dependencies: string[];
}
