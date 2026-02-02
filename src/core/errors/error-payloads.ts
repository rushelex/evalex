import type { AST } from '../../parser';

import type { FormulaErrorCode } from './error-codes';

// ============================================================================
// Payload interfaces (without code - code belongs to FormulaError)
// ============================================================================

export interface TypeMismatchPayload {
  readonly expected: readonly unknown[];
  readonly actual: unknown;
  readonly message?: string;
}

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

export interface RangeErrorPayload {
  readonly value: string | number;
  readonly min?: number;
  readonly max?: number;
}

export interface EvaluateErrorPayload {
  readonly expression?: string;
  readonly reason?: string;
}

export interface CircularDependencyPayload {
  readonly nodeId: string;
  readonly dependsOnId: string;
}

export interface MaxDependenciesPayload {
  readonly nodeId: string;
  readonly count: number;
  readonly limit: number;
}

export interface MaxFormulaDepthPayload {
  readonly nodeId: string;
  readonly depth: number;
  readonly limit: number;
}

export interface MaxFormulasPayload {
  readonly nodeId: string;
  readonly count: number;
  readonly limit: number;
}

// ============================================================================
// Formula Error Payloads mapping: code -> payload type
// ============================================================================

export interface FormulaErrorPayloads {
  [FormulaErrorCode.TYPE_MISMATCH]: TypeMismatchPayload;
  [FormulaErrorCode.ARGUMENT_TYPE_MISMATCH]: ArgumentTypeMismatchPayload;
  [FormulaErrorCode.ARGUMENT_COUNT_MISMATCH]: ArgumentCountMismatchPayload;
  [FormulaErrorCode.PATTERN_MISMATCH]: PatternMismatchPayload;
  [FormulaErrorCode.ARITHMETIC_ERROR]: ArithmeticErrorPayload;
  [FormulaErrorCode.REFERENCE_ERROR]: ReferenceErrorPayload;
  [FormulaErrorCode.RANGE_ERROR]: RangeErrorPayload;
  [FormulaErrorCode.EVALUATE_ERROR]: EvaluateErrorPayload;
  [FormulaErrorCode.CIRCULAR_DEPENDENCY]: CircularDependencyPayload;
  [FormulaErrorCode.MAX_DEPENDENCIES_EXCEEDED]: MaxDependenciesPayload;
  [FormulaErrorCode.MAX_FORMULA_DEPTH_EXCEEDED]: MaxFormulaDepthPayload;
  [FormulaErrorCode.MAX_FORMULAS_EXCEEDED]: MaxFormulasPayload;
}
