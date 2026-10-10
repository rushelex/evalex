import type { AST } from '../../../parser';
import type { FormulaError } from '../../errors';
import type { ArgumentsDefinitions, ArgumentsPattern, ProcessedArguments } from './arguments-definitions';
import type { ArgumentsScoringOptions } from './types';

import { Kind } from '../../data-types';

import { CallbackArgument } from './callback-argument';
import { CallbackExecutor } from './callback-executor';
import { ErrorScorer } from './error-scorer';
import { ProcessedArgument } from './processed-argument';
import { ValidationErrorFactory } from './validation-error-factory';

/**
 * Collects and manages validation errors for argument processing.
 * Coordinates error generation and selection of the best error to display.
 */
export class ValidationErrorCollector {
  readonly #definitions: ArgumentsDefinitions;
  readonly #errorFactory: ValidationErrorFactory;
  readonly #errorScorer: ErrorScorer;

  constructor(definitions: ArgumentsDefinitions, scoring: ArgumentsScoringOptions = {}) {
    this.#definitions = definitions;
    this.#errorFactory = new ValidationErrorFactory();
    this.#errorScorer = new ErrorScorer(definitions, scoring);
  }

  /**
   * Collects validation errors for all patterns and returns the best one.
   * @param args The processed arguments that failed validation
   * @returns The most relevant validation error
   */
  collectBestError(args: ProcessedArguments, globalLocation: AST.Location): FormulaError {
    const patternErrors = this.collectPatternErrors(args, globalLocation);

    if (this.#definitions.alternatives.length > 1) {
      const bestError = this.#selectBestError(args, patternErrors);
      if (bestError) {
        return bestError;
      }

      return this.#errorFactory.createPatternMismatchError(
        patternErrors,
        globalLocation,
      );
    }

    return patternErrors[0];
  }

  collectPatternErrors(args: ProcessedArguments, globalLocation: AST.Location): FormulaError[] {
    return this.#definitions.alternatives.map((pattern) => {
      return this.#getPatternValidationError(args, pattern, globalLocation);
    });
  }

  /**
   * Gets validation error for a specific pattern.
   * @param args The processed arguments
   * @param pattern The pattern to validate against
   * @returns Validation error for the pattern
   */
  #getPatternValidationError(args: ProcessedArguments, pattern: ArgumentsPattern, globalLocation: AST.Location): FormulaError {
    const requiredCount = this.#definitions.getRequiredCount(pattern);
    const maxCount = this.#definitions.getMaxCount(pattern);
    const hasRepeatable = this.#definitions.hasRepeatableArg(pattern);

    // Check argument count first
    if (args.length < requiredCount || args.length > maxCount) {
      return this.#errorFactory.createCountError([requiredCount, maxCount], args.length, hasRepeatable, globalLocation);
    }

    // Check individual arguments
    const argumentError = this.#findFirstArgumentError(args, pattern);
    if (argumentError) {
      return argumentError;
    }

    return this.#errorFactory.createUnknownError(globalLocation);
  }

  /**
   * Finds the first argument that has a validation error.
   * @param args The processed arguments
   * @param pattern The pattern to validate against
   * @returns The first validation error found, or null if none
   */
  #findFirstArgumentError(args: ProcessedArguments, pattern: ArgumentsPattern): FormulaError | undefined {
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      const argDef = this.#definitions.getArgumentForPattern(index, pattern);

      if (!argDef) {
        return this.#errorFactory.createUnexpectedArgumentError(arg, index + 1);
      }

      // Handle callback arguments
      if (argDef instanceof CallbackArgument) {
        if (!(arg instanceof CallbackExecutor)) {
          return this.#errorFactory.createCallbackTypeError(arg, argDef, index + 1);
        }
        continue;
      }

      // Handle regular arguments
      if (!(arg instanceof ProcessedArgument)) {
        return this.#errorFactory.createWrongCallbackError(arg, argDef, index + 1);
      }

      // Check type match
      if (!this.#isTypeMatch(arg.dataType.kind, argDef.types)) {
        return this.#errorFactory.createTypeError(arg, argDef, index + 1);
      }

      // Check custom validation
      if (argDef.validation?.(arg.dataType)) {
        const customError = this.#errorFactory.createCustomValidationError(arg, argDef, index + 1);
        if (customError) {
          return customError;
        }
      }
    }
  }

  /**
   * Selects the best error from multiple pattern errors based on scoring.
   * @param args The processed arguments
   * @param patternErrors Errors for each pattern
   * @returns The best error or null if no good error found
   */
  #selectBestError(args: ProcessedArguments, patternErrors: FormulaError[]): FormulaError | null {
    let bestError: FormulaError | null = null;
    let bestScore = -1;

    for (let i = 0; i < this.#definitions.alternatives.length; i++) {
      const pattern = this.#definitions.alternatives[i];
      const error = patternErrors[i];
      const score = this.#errorScorer.calculatePatternScore(args, pattern);

      if (score > bestScore) {
        bestScore = score;
        bestError = error;
      }
    }

    return bestScore > 0 ? bestError : null;
  }

  /**
   * Checks if actual type matches any of the expected types.
   * @param actualType The actual data type kind
   * @param expectedTypes Single expected type or array of expected types
   * @returns True if types match
   */
  #isTypeMatch(actualType: Kind, expectedTypes: Kind | Kind[]): boolean {
    const expectedTypesArray = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
    return expectedTypesArray.includes(actualType) || expectedTypesArray.includes(Kind.Any);
  }
}
