import { FormulaDataType } from '../../data-types';

/**
 * Represents an expected error with message and location in the formula
 */
export interface ExpectedError {
  readonly message: string;
  readonly location: [start: number, end: number];
}

/**
 * Represents expected error results for function and/or method calls
 */
export interface ExpectedErrorResult {
  readonly function?: ExpectedError;
  readonly method?: ExpectedError;
}

/**
 * Union type representing expected test result - either a FormulaDataType or error expectations
 */
export type ExpectedResult = FormulaDataType | ExpectedErrorResult;

/**
 * Type guard to check if expected result is an error expectation
 */
export function isExpectedError(expected: ExpectedResult): expected is ExpectedErrorResult {
  return !(expected instanceof FormulaDataType);
}

/**
 * Type guard to check if expected result is a FormulaDataType (success case)
 */
export function isExpectedSuccess(expected: ExpectedResult): expected is FormulaDataType {
  return expected instanceof FormulaDataType;
}
