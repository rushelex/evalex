/**
 * Names the groups of formula errors: the `code` of every `FormulaError` is one of them, and `FormulaErrorPayloads`
 * gives the payload of each.
 *
 * @example
 * ```ts
 * if (error instanceof FormulaError && error.code === FormulaErrorCode.REFERENCE_ERROR) {
 *   // a missing variable, function, method or field
 * }
 * ```
 */
export const FormulaErrorCode = {
  ARGUMENT_TYPE_MISMATCH: 'ARGUMENT_TYPE_MISMATCH',
  ARGUMENT_COUNT_MISMATCH: 'ARGUMENT_COUNT_MISMATCH',
  PATTERN_MISMATCH: 'PATTERN_MISMATCH',
  ARITHMETIC_ERROR: 'ARITHMETIC_ERROR',
  REFERENCE_ERROR: 'REFERENCE_ERROR',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  INPUT_ERROR: 'INPUT_ERROR',
  RANGE_ERROR: 'RANGE_ERROR',
  EVALUATE_ERROR: 'EVALUATE_ERROR',
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
} as const;

// eslint-disable-next-line ts/no-redeclare -- a value and a type under one name, the way an enum reads
export type FormulaErrorCode = (typeof FormulaErrorCode)[keyof typeof FormulaErrorCode];
