import type { AST } from '../../../parser';
import type { FormulaError } from '../../errors';
import type { Argument } from './argument';
import type { CallbackArgument } from './callback-argument';

import type { CallbackExecutor } from './callback-executor';

import { Errors } from '../../errors';
import { ProcessedArgument } from './processed-argument';

/**
 * Factory class for creating validation error messages.
 * Centralizes error creation logic with consistent formatting.
 */
export class ValidationErrorFactory {
  /**
   * Creates an error for incorrect argument count.
   * @param expected Array of [min, max] expected argument counts
   * @param actual Actual number of arguments
   * @param hasRepeatable Whether the pattern has repeatable arguments
   * @param globalLocation The location of the global error
   * @returns Validation error info
   */
  createCountError(
    expected: [number, number],
    actual: number,
    hasRepeatable: boolean = false,
    globalLocation: AST.Location,
  ): FormulaError {
    const [requiredCount, maxCount] = expected;

    if (actual < requiredCount) {
      return Errors.Argument.TooFew.create({
        expectedMin: requiredCount,
        expectedMax: maxCount,
        actual,
      }, {
        location: globalLocation,
      });
    }

    if (actual > maxCount) {
      if (maxCount === 0 || requiredCount === maxCount) {
        return Errors.Argument.ExactCount.create(
          { actual, expected: maxCount },
          { location: globalLocation },
        );
      }

      return Errors.Argument.TooMany.create(
        {
          expectedMin: requiredCount,
          expectedMax: maxCount,
          actual,
          hasRepeatable,
        },
        {
          location: globalLocation,
        },
      );
    }

    // A fallback error that should never occur.
    // The condition is already checked in ValidationErrorCollector.#getPatternValidationError.
    return Errors.Argument.ExactCount.create(
      { actual, expected: maxCount },
      { location: globalLocation },
    );
  }

  /**
   * Creates an error for type mismatch.
   * @param arg The processed argument with wrong type
   * @param argDef The argument definition
   * @param position The 1-based position of the argument
   * @returns Validation error info
   */
  createTypeError(
    arg: ProcessedArgument,
    argDef: Argument,
    position: number,
  ): FormulaError {
    return Errors.Argument.TypeMismatch.create({
      actual: arg.dataType.kind,
      expected: Array.isArray(argDef.types) ? [...argDef.types] : [argDef.types],
      argumentPosition: position,
    }, {
      location: arg.location,
    });
  }

  /**
   * Creates an error for custom validation failure.
   * @param arg The processed argument that failed validation
   * @param argDef The argument definition with validation
   * @param position The 1-based position of the argument
   * @returns Validation error info or undefined if no validation message
   */
  createCustomValidationError(
    arg: ProcessedArgument,
    argDef: Argument,
    position: number,
  ): FormulaError | undefined {
    const payload = argDef.validation?.(arg.dataType);

    if (!payload) {
      return;
    }

    return Errors.Argument.Validation.create({
      actual: String(arg.dataType.value),
      expected: ['valid value'],
      argumentPosition: position,
      ...payload,
    }, {
      location: arg.location,
    });
  }

  /**
   * Creates an error for unexpected argument at position.
   * @param arg The unexpected argument
   * @param position The 1-based position of the argument
   * @returns Validation error info
   */
  createUnexpectedArgumentError(
    arg: ProcessedArgument | CallbackExecutor,
    position: number,
  ): FormulaError {
    return Errors.Argument.Unexpected.create({
      actual: arg instanceof ProcessedArgument ? arg.dataType.kind : 'callback',
      expected: ['no more arguments'],
      argumentPosition: position,
    }, {
      location: arg.location,
    });
  }

  /**
   * Creates an error for callback argument type mismatch.
   * @param arg The argument that should be a callback
   * @param argDef The callback argument definition
   * @param position The 1-based position of the argument
   * @returns Validation error info
   */
  createCallbackTypeError(
    arg: ProcessedArgument,
    argDef: CallbackArgument,
    position: number,
  ): FormulaError {
    return Errors.Argument.CallbackExpected.create({
      argumentPosition: position,
      argumentName: argDef.name,
      actual: arg.dataType.kind,
    }, {
      location: arg.location,
    });
  }

  /**
   * Creates an error for wrong argument type when callback was expected.
   * @param arg The callback executor that was provided instead of regular argument
   * @param argDef The argument definition
   * @param position The 1-based position of the argument
   * @returns Validation error info
   */
  createWrongCallbackError(
    arg: CallbackExecutor,
    argDef: Argument,
    position: number,
  ): FormulaError {
    return Errors.Argument.UnexpectedCallback.create({
      argumentPosition: position,
      argumentName: argDef.name,
      expected: Array.isArray(argDef.types) ? [...argDef.types] : [argDef.types],
    }, {
      location: arg.location,
    });
  }

  /**
   * Creates an error for multiple pattern mismatch.
   * @param patternErrors Individual errors for each pattern
   * @param globalLocation The location of the global error
   * @returns Validation error info
   */
  createPatternMismatchError(
    patternErrors: FormulaError[],
    globalLocation: AST.Location,
  ): FormulaError {
    // Keep only unique errors by message
    const uniqueErrors = patternErrors.filter((error, index, array) => {
      return array.findIndex((error2) => error2.message === error.message) === index;
    });

    // Check if all errors are the same
    const areTheSameErrors = uniqueErrors.length === 1;

    if (areTheSameErrors) {
      return patternErrors[0];
    }

    // Convert FormulaError[] to PatternError[] for the new API
    const patternErrorsPayload = patternErrors.map((error, i) => ({
      patternIndex: i,
      message: error.message.replace(/\s*\[\d+,\d+\]\.?$/, ''), // Remove location suffix from message
      location: error.location,
    }));

    return Errors.Argument.PatternMismatch.create({ patterns: patternErrorsPayload }, {
      location: globalLocation,
    });
  }

  /**
   * Creates a fallback unknown error.
   * @param globalLocation The location of the global error
   * @returns Validation error info for unknown errors
   */
  createUnknownError(globalLocation: AST.Location): FormulaError {
    return Errors.Argument.Unknown.create({
      actual: ['unknown'],
      expected: ['unknown'],
      argumentPosition: -1,
    }, {
      location: globalLocation,
    });
  }
}
