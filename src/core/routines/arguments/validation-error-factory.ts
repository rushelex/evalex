import type { AST } from '../../../parser';
import type { FormulaError } from '../../errors';
import type { Argument } from './argument';
import type { ArgumentsPattern } from './arguments-definitions';
import type { CallbackArgument } from './callback-argument';
import type { CallbackExecutor } from './callback-executor';

import { ArgumentFormulaError } from '../../errors';
import { ProcessedArgument } from './processed-argument';
import { TypeFormatter } from './type-formatter';

/**
 * Factory class for creating validation error messages.
 * Centralizes error creation logic with consistent formatting.
 */
export class ValidationErrorFactory {
  readonly #typeFormatter: TypeFormatter;

  constructor() {
    this.#typeFormatter = new TypeFormatter();
  }

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
      return new ArgumentFormulaError(
        `Expected at least ${requiredCount} argument(s).`,
        {
          context: {
            expected: [requiredCount, maxCount],
            actual,
          },
          location: globalLocation,
        },
      );
    }

    if (actual > maxCount) {
      const expectedText = hasRepeatable
        ? `at least ${requiredCount}`
        : maxCount === 0
          ? '0'
          : `at most ${maxCount}`;

      return new ArgumentFormulaError(
        `Expected ${expectedText} argument(s).`,
        {
          context: {
            expected: [requiredCount, hasRepeatable ? Infinity : maxCount],
            actual,
          },
          location: globalLocation,
        },
      );
    }

    return new ArgumentFormulaError(
      'Unknown count validation error.',
      {
        context: {
          expected: [requiredCount, maxCount],
          actual,
        },
        location: globalLocation,
      },
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
    const expectedTypeStr = this.#typeFormatter.formatTypes(argDef.types);

    return new ArgumentFormulaError(
      `Expected type ${expectedTypeStr}.`,
      {
        context: {
          argumentPosition: position,
          expected: typeof argDef.types === 'string' ? argDef.types : [...argDef.types],
          actual: arg.dataType.kind,
        },
        location: arg.location,
      },
    );
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
    const message = argDef.validation?.(arg.dataType);

    if (!message) {
      return;
    }

    return new ArgumentFormulaError(
      message,
      {
        context: {
          argumentPosition: position,
          expected: 'unknown',
          actual: String(arg.dataType.value),
        },
        location: arg.location,
      },
    );
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
    return new ArgumentFormulaError(
      `Unexpected argument at position ${position}`,
      {
        context: {
          argumentPosition: position,
          expected: 'no more arguments',
          actual: arg instanceof ProcessedArgument ? arg.dataType.kind : 'callback',
        },
        location: arg.location,
      },
    );
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
    return new ArgumentFormulaError(
      `Expected callback for ${argDef.name || 'an argument'}`,
      {
        context: {
          argumentPosition: position,
          expected: 'callback',
          actual: arg.dataType.kind,
        },
        location: arg.location,
      },
    );
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
    return new ArgumentFormulaError(
      `Expected type ${this.#typeFormatter.formatTypes(argDef.types)}, but got callback.`,
      {
        context: {
          argumentPosition: position,
          expected: typeof argDef.types === 'string' ? argDef.types : [...argDef.types],
          actual: 'callback',
        },
        location: arg.location,
      },
    );
  }

  /**
   * Creates an error for multiple pattern mismatch.
   * @param patterns All available patterns
   * @param patternErrors Individual errors for each pattern
   * @param globalLocation The location of the global error
   * @returns Validation error info
   */
  createPatternMismatchError(
    patterns: readonly ArgumentsPattern[],
    patternErrors: FormulaError[],
    globalLocation: AST.Location,
  ): FormulaError {
    // Keep only unique errors
    const uniqueErrors = patternErrors.filter((error, index, array) => {
      return array.findIndex((error2) => error2.rawMessage === error.rawMessage) === index;
    });

    // Check if all errors are the same
    const areTheSameErrors = uniqueErrors.every((error) => {
      return error.rawMessage === patternErrors[0].rawMessage;
    });

    if (areTheSameErrors) {
      return patternErrors[0];
    }

    const errorMessages = patternErrors.map((error, i) => `Pattern ${i + 1}: ${error.rawMessage}`).join('; ');

    return new ArgumentFormulaError(
      `Arguments don't match. ${errorMessages}`,
      {
        context: {
          expected: `one of ${patterns.length} patterns`,
          actual: 'invalid',
        },
        location: globalLocation,
      },
    );
  }

  /**
   * Creates a fallback unknown error.
   * @param globalLocation The location of the global error
   * @returns Validation error info for unknown errors
   */
  createUnknownError(globalLocation: AST.Location): FormulaError {
    return new ArgumentFormulaError(
      'Unknown validation error.',
      {
        context: {
          expected: 'unknown',
          actual: 'unknown',
        },
        location: globalLocation,
      },
    );
  }
}
