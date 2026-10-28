import * as Defs from './definitions';

export { FormulaErrorCode } from './error-codes';
export type { FormulaErrorOptions } from './formula-error';
export { FormulaError } from './formula-error';
export { formatTypes, getRegExpFallbackError } from './utils';

/**
 * Tells apart formula errors that share a code: `Errors.<Group>.<Error>.is(error)` matches exactly one of them and
 * narrows its `payload`.
 *
 * @example
 * ```ts
 * import { Errors } from 'evalex';
 *
 * if (Errors.Reference.VariableNotDefined.is(error)) {
 *   error.payload.name; // the variable the formula reads but the host did not pass
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
    PatternMismatch: Defs.PatternMismatch,
    Validation: Defs.ArgumentValidationError,
    Unknown: Defs.ArgumentUnknownError,
  },

  /** Arithmetic operation errors */
  Arithmetic: {
    DivisionByZero: Defs.DivisionByZero,
    ModuloByZero: Defs.ModuloByZero,
    NumberOutOfRange: Defs.NumberOutOfRange,
    NotARealNumber: Defs.NotARealNumber,
    DateOutOfRange: Defs.DateOutOfRange,
  },

  /** Formula evaluation errors */
  Evaluation: {
    ComparisonTypeMismatch: Defs.ComparisonTypeMismatch,
    DateWithDateTime: Defs.DateWithDateTime,
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
    InputError: Defs.InputError,
  },

  /** Errors of a computation as a whole */
  Runtime: {
    ExecutionTimeout: Defs.ExecutionTimeout,
  },

  /** Operator errors */
  Operators: {
    UnsupportedBinary: Defs.UnsupportedBinaryOperator,
    UnsupportedUnary: Defs.UnsupportedUnaryOperator,
  },
} as const;
