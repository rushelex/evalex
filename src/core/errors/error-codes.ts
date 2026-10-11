/**
 * Error codes for FormulaError.
 * Each code represents a specific error type with its own payload structure.
 */
export const FormulaErrorCode = {
  // Core errors
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  ARGUMENT_TYPE_MISMATCH: 'ARGUMENT_TYPE_MISMATCH',
  ARGUMENT_COUNT_MISMATCH: 'ARGUMENT_COUNT_MISMATCH',
  PATTERN_MISMATCH: 'PATTERN_MISMATCH',
  ARITHMETIC_ERROR: 'ARITHMETIC_ERROR',
  REFERENCE_ERROR: 'REFERENCE_ERROR',
  RANGE_ERROR: 'RANGE_ERROR',
  EVALUATE_ERROR: 'EVALUATE_ERROR',

  // Runtime errors
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  MAX_DEPENDENCIES_EXCEEDED: 'MAX_DEPENDENCIES_EXCEEDED',
  MAX_FORMULA_DEPTH_EXCEEDED: 'MAX_FORMULA_DEPTH_EXCEEDED',
  MAX_FORMULAS_EXCEEDED: 'MAX_FORMULAS_EXCEEDED',
  DUPLICATE_NODE_ID: 'DUPLICATE_NODE_ID',
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
} as const;

// eslint-disable-next-line ts/no-redeclare -- a value and a type under one name, the way an enum reads
export type FormulaErrorCode = (typeof FormulaErrorCode)[keyof typeof FormulaErrorCode];
