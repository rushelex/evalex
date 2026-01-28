import type { Expression, FormulaDataType } from '../core';

export interface FormulaNode {
  readonly id: string;
}

/**
 * NodeAdapter abstracts property/formula node operations for FormulaRuntime.
 */
export interface NodeAdapter<T extends FormulaNode> {
  /** Checks if the node should be processed */
  shouldProcess: (item: T) => boolean;
  /** Converts node to formula data type */
  toFormulaDataType: (item: T) => FormulaDataType;
  /** Converts node to formula string */
  toExpression: (item: T) => Expression | null;
  /** Handles calculation results */
  onCalculate: (item: T, value: FormulaDataType, dependencies?: ReadonlySet<string>) => void;
  /** Handles processing errors */
  onError: (item: T, error: Error) => void;
}
