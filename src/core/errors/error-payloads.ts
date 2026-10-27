import type { AST } from '../../parser';

import type { FormulaErrorCode } from './error-codes';

// ============================================================================
// Payload interfaces (without code - code belongs to FormulaError)
// ============================================================================

export interface ArgumentTypeMismatchPayload {
  readonly expected: readonly unknown[];
  readonly actual: unknown;
  readonly argumentPosition: number;
  readonly argumentName?: string;
  readonly message?: string;
}

export interface ArgumentCountMismatchPayload {
  readonly expectedMin: number;
  readonly expectedMax: number;
  readonly actual: number;
}

export interface PatternError {
  readonly patternIndex: number;
  readonly message: string;
  readonly location?: AST.Location;
}

export interface PatternMismatchPayload {
  readonly patterns: readonly PatternError[];
}

export interface ArithmeticErrorPayload {
  readonly operation: 'division' | 'modulo';
  readonly dividend: number;
}

export interface ReferenceErrorPayload {
  readonly name: string;
  readonly referenceType: 'variable' | 'function' | 'method' | 'field';
  readonly target?: string;
}

export interface CircularReferencePayload {
  /** The part of the formula that reads a cell depending on the formula itself, as written: `total`, `project.cost()`. */
  readonly name: string;
}

export interface InputErrorPayload {
  /** The part of the formula that reads the failed input, as written: `total`, `order.tags()`. */
  readonly name: string;
}

export interface RangeErrorPayload {
  readonly value: string | number;
  readonly min?: number;
  readonly max?: number;
}

export interface EvaluateErrorPayload {
  readonly expression?: string;
  readonly reason?: string;
}

export interface ExecutionTimeoutPayload {
  readonly timeoutMs: number;
}

// ============================================================================
// Formula Error Payloads mapping: code -> payload type
// ============================================================================

export interface FormulaErrorPayloads {
  [FormulaErrorCode.ARGUMENT_TYPE_MISMATCH]: ArgumentTypeMismatchPayload;
  [FormulaErrorCode.ARGUMENT_COUNT_MISMATCH]: ArgumentCountMismatchPayload;
  [FormulaErrorCode.PATTERN_MISMATCH]: PatternMismatchPayload;
  [FormulaErrorCode.ARITHMETIC_ERROR]: ArithmeticErrorPayload;
  [FormulaErrorCode.REFERENCE_ERROR]: ReferenceErrorPayload;
  [FormulaErrorCode.CIRCULAR_REFERENCE]: CircularReferencePayload;
  [FormulaErrorCode.INPUT_ERROR]: InputErrorPayload;
  [FormulaErrorCode.RANGE_ERROR]: RangeErrorPayload;
  [FormulaErrorCode.EVALUATE_ERROR]: EvaluateErrorPayload;
  [FormulaErrorCode.EXECUTION_TIMEOUT]: ExecutionTimeoutPayload;
}
