import * as Defs from './definitions';

export { FormulaErrorCode } from './error-codes';
export type { FormulaErrorOptions } from './formula-error';
export { FormulaError } from './formula-error';
export { formatTypes, getRegExpFallbackError } from './utils';

/**
 * Namespace containing all formula errors grouped by domain.
 *
 * @example
 * ```typescript
 * import { Errors } from '@evalex/core/errors';
 *
 * // Create errors
 * throw Errors.Argument.TooFew.create({ expectedMin: 2, expectedMax: 5, actual: 1 });
 *
 * // Check error type
 * if (Errors.Runtime.CircularDependency.is(error)) {
 *   console.log(error.payload.nodeId);
 * }
 * ```
 */
export const Errors = {
  /** Argument validation errors */
  Argument: {
    TooFew: Defs.TooFewArguments,
    TooMany: Defs.TooManyArguments,
    ExactCount: Defs.ExactArgumentCount,
    TypeMismatch: Defs.ArgumentTypeMismatch,
    CallbackExpected: Defs.CallbackExpected,
    UnexpectedCallback: Defs.UnexpectedCallback,
    CallbackReturnTypeMismatch: Defs.CallbackReturnTypeMismatch,
    Unexpected: Defs.UnexpectedArgument,
    AllMustBeNumbers: Defs.AllArgumentsMustBeNumbers,
    AllMustBeFinite: Defs.AllNumbersMustBeFinite,
    PatternMismatch: Defs.PatternMismatch,
    Validation: Defs.ArgumentValidationError,
    Unknown: Defs.ArgumentUnknownError,
  },

  /** Arithmetic operation errors */
  Arithmetic: {
    DivisionByZero: Defs.DivisionByZero,
    ModuloByZero: Defs.ModuloByZero,
    DateOutOfRange: Defs.DateOutOfRange,
  },

  /** Expression evaluation errors */
  Evaluation: {
    ComparisonTypeMismatch: Defs.ComparisonTypeMismatch,
    NonNumericMath: Defs.NonNumericMathOperation,
    UnaryMinusNonNumeric: Defs.UnaryMinusNonNumeric,
    InvalidRegExp: Defs.InvalidRegExpPattern,
  },

  /** Reference resolution errors */
  Reference: {
    VariableNotDefined: Defs.VariableNotDefined,
    FunctionNotDefined: Defs.FunctionNotDefined,
    MethodNotDefined: Defs.MethodNotDefined,
    EmptyValueRead: Defs.EmptyValueRead,
    FieldNotDefined: Defs.FieldNotDefined,
    CircularReference: Defs.CircularReference,
  },

  /** Runtime errors */
  Runtime: {
    CircularDependency: Defs.CircularDependencyDetected,
    DuplicateNodeId: Defs.DuplicateNodeId,
    ExecutionTimeout: Defs.ExecutionTimeout,
  },

  /** Input validation errors */
  Validation: {
    StringFormulaExpected: Defs.StringFormulaExpected,
    NonEmptyFormulaExpected: Defs.NonEmptyFormulaExpected,
    PositiveNumberExpected: Defs.PositiveNumberExpected,
  },

  /** Operator errors */
  Operators: {
    UnsupportedBinary: Defs.UnsupportedBinaryOperator,
    UnsupportedUnary: Defs.UnsupportedUnaryOperator,
  },
} as const;
