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
  readonly #subjectFirst: boolean;

  constructor(definitions: ArgumentsDefinitions, scoring: ArgumentsScoringOptions = {}) {
    this.#definitions = definitions;
    this.#errorFactory = new ValidationErrorFactory();
    this.#errorScorer = new ErrorScorer(definitions, scoring);
    this.#subjectFirst = scoring.subjectFirst ?? false;
  }

  /**
   * Collects validation errors for all patterns and returns the best one.
   * @param args The processed arguments that failed validation
   * @returns The most relevant validation error
   */
  collectBestError(args: ProcessedArguments, globalLocation: AST.Location): FormulaError {
    const subjectError = this.#subjectTypeError(args);

    if (subjectError) {
      return subjectError;
    }

    const patterns = this.#reportedPatterns(args);
    const patternErrors = patterns.map((pattern) => this.#getPatternValidationError(args, pattern, globalLocation));

    if (patterns.length > 1) {
      const bestError = this.#selectBestError(args, patterns, patternErrors);
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
      if (!this.#isTypeMatch(arg.dataType.kind, argDef.kinds)) {
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

  // A function form reports what its method form on the subject's type would, since the method has only these signatures
  #reportedPatterns(args: ProcessedArguments): readonly ArgumentsPattern[] {
    const [subject] = args;

    if (!this.#subjectFirst || !(subject instanceof ProcessedArgument)) {
      return this.#definitions.alternatives;
    }

    const accepting = this.#definitions.alternatives.filter((pattern) => this.#subjectTypes(pattern).some((kind) => this.#isTypeMatch(subject.dataType.kind, [kind])));

    return accepting.length > 0 ? accepting : this.#definitions.alternatives;
  }

  // A subject no signature takes is the fault of the call, so it names every type the signatures take, not those of one
  #subjectTypeError(args: ProcessedArguments): FormulaError | undefined {
    const [subject] = args;
    const patterns = this.#definitions.alternatives;

    if (!this.#subjectFirst || patterns.length < 2 || !(subject instanceof ProcessedArgument)) {
      return undefined;
    }

    const types = [...new Set(patterns.flatMap((pattern) => this.#subjectTypes(pattern)))];

    if (types.length === 0 || this.#isTypeMatch(subject.dataType.kind, types)) {
      return undefined;
    }

    return this.#errorFactory.createTypeError(subject, { kinds: types }, 1);
  }

  #subjectTypes(pattern: ArgumentsPattern): readonly Kind[] {
    const argDef = this.#definitions.getArgumentForPattern(0, pattern);

    if (argDef === undefined || argDef instanceof CallbackArgument) {
      return [];
    }

    return argDef.kinds;
  }

  /**
   * Selects the best error from multiple pattern errors based on scoring.
   * @param args The processed arguments
   * @param patterns The patterns the call is reported against
   * @param patternErrors Errors for each of the patterns, in the same order
   * @returns The best error or null if no good error found
   */
  #selectBestError(args: ProcessedArguments, patterns: readonly ArgumentsPattern[], patternErrors: FormulaError[]): FormulaError | null {
    let bestError: FormulaError | null = null;
    let bestScore = -1;

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
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
   * @param expectedTypes The expected types
   * @returns True if types match
   */
  #isTypeMatch(actualType: Kind, expectedTypes: readonly Kind[]): boolean {
    return expectedTypes.includes(actualType) || expectedTypes.includes(Kind.Any);
  }
}
