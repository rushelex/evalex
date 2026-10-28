import type { FormulaErrorCode } from '../error-codes';
import type { FormulaError } from '../formula-error';

import { Errors } from '..';

interface DefinitionSample {
  readonly name: string;
  readonly definition: {
    readonly code: FormulaErrorCode;
    readonly is: (error: unknown) => boolean;
  };
  readonly error: FormulaError;
}

const samples: readonly DefinitionSample[] = [
  { name: 'Argument.TooFew', definition: Errors.Argument.TooFew, error: Errors.Argument.TooFew.create({ expectedMin: 2, expectedMax: 3, actual: 1 }) },
  { name: 'Argument.TooMany', definition: Errors.Argument.TooMany, error: Errors.Argument.TooMany.create({ expectedMin: 1, expectedMax: 2, actual: 3 }) },
  { name: 'Argument.ExactCount', definition: Errors.Argument.ExactCount, error: Errors.Argument.ExactCount.create({ expected: 2, actual: 1 }) },
  { name: 'Argument.TypeMismatch', definition: Errors.Argument.TypeMismatch, error: Errors.Argument.TypeMismatch.create({ expected: ['Number'], actual: 'String', argumentPosition: 0 }) },
  { name: 'Argument.CallbackExpected', definition: Errors.Argument.CallbackExpected, error: Errors.Argument.CallbackExpected.create({ actual: 'Number', argumentPosition: 1 }) },
  { name: 'Argument.UnexpectedCallback', definition: Errors.Argument.UnexpectedCallback, error: Errors.Argument.UnexpectedCallback.create({ expected: ['Number'], argumentPosition: 0 }) },
  { name: 'Argument.CallbackReturnTypeMismatch', definition: Errors.Argument.CallbackReturnTypeMismatch, error: Errors.Argument.CallbackReturnTypeMismatch.create({ expected: ['Boolean'], actual: 'Number', argumentPosition: 2 }) },
  { name: 'Argument.Unexpected', definition: Errors.Argument.Unexpected, error: Errors.Argument.Unexpected.create({ expected: [], actual: 'Number', argumentPosition: 2 }) },
  { name: 'Argument.AllMustBeNumbers', definition: Errors.Argument.AllMustBeNumbers, error: Errors.Argument.AllMustBeNumbers.create({ actual: 'String' }) },
  { name: 'Argument.AllMustBeFinite', definition: Errors.Argument.AllMustBeFinite, error: Errors.Argument.AllMustBeFinite.create({ actual: 'Infinity' }) },
  { name: 'Argument.PatternMismatch', definition: Errors.Argument.PatternMismatch, error: Errors.Argument.PatternMismatch.create({ patterns: [] }) },
  { name: 'Argument.Validation', definition: Errors.Argument.Validation, error: Errors.Argument.Validation.create({ expected: ['Number'], actual: 'String', argumentPosition: 0 }) },
  { name: 'Argument.Unknown', definition: Errors.Argument.Unknown, error: Errors.Argument.Unknown.create({ expected: ['Number'], actual: 'String', argumentPosition: 0 }) },
  { name: 'Arithmetic.DivisionByZero', definition: Errors.Arithmetic.DivisionByZero, error: Errors.Arithmetic.DivisionByZero.create({ dividend: 1 }) },
  { name: 'Arithmetic.DateOutOfRange', definition: Errors.Arithmetic.DateOutOfRange, error: Errors.Arithmetic.DateOutOfRange.create({ value: '2024-01-01T00:00:00Z' }) },
  { name: 'Arithmetic.ModuloByZero', definition: Errors.Arithmetic.ModuloByZero, error: Errors.Arithmetic.ModuloByZero.create({ dividend: 1 }) },
  { name: 'Arithmetic.NumberOutOfRange', definition: Errors.Arithmetic.NumberOutOfRange, error: Errors.Arithmetic.NumberOutOfRange.create({ value: 'Infinity' }) },
  { name: 'Arithmetic.NotARealNumber', definition: Errors.Arithmetic.NotARealNumber, error: Errors.Arithmetic.NotARealNumber.create() },
  { name: 'Evaluation.ComparisonTypeMismatch', definition: Errors.Evaluation.ComparisonTypeMismatch, error: Errors.Evaluation.ComparisonTypeMismatch.create({ expression: '1 < "a"' }) },
  { name: 'Evaluation.NonNumericMath', definition: Errors.Evaluation.NonNumericMath, error: Errors.Evaluation.NonNumericMath.create({ expression: '1 * "a"' }) },
  { name: 'Evaluation.UnaryMinusNonNumeric', definition: Errors.Evaluation.UnaryMinusNonNumeric, error: Errors.Evaluation.UnaryMinusNonNumeric.create({ expression: '-"a"' }) },
  { name: 'Evaluation.InvalidRegExp', definition: Errors.Evaluation.InvalidRegExp, error: Errors.Evaluation.InvalidRegExp.create({ expression: '(', reason: 'Unterminated group' }) },
  { name: 'Reference.VariableNotDefined', definition: Errors.Reference.VariableNotDefined, error: Errors.Reference.VariableNotDefined.create({ name: 'price' }) },
  { name: 'Reference.FunctionNotDefined', definition: Errors.Reference.FunctionNotDefined, error: Errors.Reference.FunctionNotDefined.create({ name: 'total' }) },
  { name: 'Reference.MethodNotDefined', definition: Errors.Reference.MethodNotDefined, error: Errors.Reference.MethodNotDefined.create({ name: 'total', target: 'String' }) },
  { name: 'Reference.EmptyValueRead', definition: Errors.Reference.EmptyValueRead, error: Errors.Reference.EmptyValueRead.create({ name: 'rate', target: 'Null' }) },
  { name: 'Reference.FieldNotDefined', definition: Errors.Reference.FieldNotDefined, error: Errors.Reference.FieldNotDefined.create({ name: 'email', target: 'user' }) },
  { name: 'Reference.CircularReference', definition: Errors.Reference.CircularReference, error: Errors.Reference.CircularReference.create({ name: 'total' }) },
  { name: 'Reference.InputError', definition: Errors.Reference.InputError, error: Errors.Reference.InputError.create({ name: 'total' }) },
  { name: 'Runtime.ExecutionTimeout', definition: Errors.Runtime.ExecutionTimeout, error: Errors.Runtime.ExecutionTimeout.create({ timeoutMs: 100 }) },
  { name: 'Operators.UnsupportedBinary', definition: Errors.Operators.UnsupportedBinary, error: Errors.Operators.UnsupportedBinary.create('<>') },
  { name: 'Operators.UnsupportedUnary', definition: Errors.Operators.UnsupportedUnary, error: Errors.Operators.UnsupportedUnary.create('~') },
];

const sharedCodePairs = samples.flatMap(
  (own) => samples
    .filter((other) => other !== own && other.definition.code === own.definition.code)
    .map((other) => ({ checker: own.name, foreign: other.name, definition: own.definition, error: other.error })),
);

describe('Errors', () => {
  it('should cover every error definition', () => {
    const definitionCount = Object.values(Errors).reduce((count, group) => count + Object.keys(group).length, 0);

    expect(samples).toHaveLength(definitionCount);
  });

  it.each(samples)('$name should accept its own error', ({ definition, error }) => {
    expect(definition.is(error)).toBe(true);
  });

  it.each(sharedCodePairs)('$checker should reject $foreign with the same code', ({ definition, error }) => {
    expect(definition.is(error)).toBe(false);
  });

  it.each(samples)('$name should reject non-formula errors', ({ definition }) => {
    expect(definition.is(new Error('failure'))).toBe(false);
    expect(definition.is(undefined)).toBe(false);
  });
});
