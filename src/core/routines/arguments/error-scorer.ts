import type { Kind } from '../../data-types';
import type { Argument } from './argument';
import type { ArgumentsDefinitions, ArgumentsPattern, ProcessedArguments } from './arguments-definitions';

import { CallbackArgument } from './callback-argument';
import { CallbackExecutor } from './callback-executor';
import { ProcessedArgument } from './processed-argument';

/**
 * Calculates scores for validation errors to determine the best error to show.
 * Higher scores indicate better error quality (more relevant to user's intent).
 */
export class ErrorScorer {
  constructor(private readonly definitions: ArgumentsDefinitions) {}

  /**
   * Calculates a score for how well arguments match a pattern.
   * Used to select the best error message when multiple patterns fail.
   * This is extracted from the original calculateErrorScore method in ArgumentsProcessor.
   * @param args The processed arguments
   * @param pattern The pattern to score against
   * @returns Score (higher is better, 0 means no match)
   */
  public calculatePatternScore(args: ProcessedArguments, pattern: ArgumentsPattern): number {
    const requiredCount = this.definitions.getRequiredCount(pattern);
    const maxCount = this.definitions.getMaxCount(pattern);

    if (args.length < requiredCount || args.length > maxCount) {
      return 0;
    }

    let score = 1;
    let typeMatches = 0;
    let literalFailures = 0;

    args.forEach((arg, index) => {
      const argDef = this.definitions.getArgumentForPattern(index, pattern);
      const actualType = arg instanceof ProcessedArgument ? arg.dataType.kind : 'any';

      if (!argDef) {
        return;
      }

      if (argDef instanceof CallbackArgument) {
        if (arg instanceof CallbackExecutor) {
          typeMatches++;
        }
        return;
      }

      if (!(arg instanceof ProcessedArgument)) {
        return;
      }

      if (this.isTypeMatch(actualType, argDef.types)) {
        typeMatches++;

        if (!this.isCustomValidationPass(arg, argDef)) {
          literalFailures++;
          score += 10;
        }
      }
    });

    if (typeMatches === args.length && literalFailures > 0) {
      return score + 100;
    }

    if (typeMatches > 0) {
      return score + typeMatches;
    }

    return 0;
  }

  /**
   * Checks if actual type matches any of the expected types.
   * @param actualType The actual data type kind
   * @param expectedTypes Single expected type or array of expected types
   * @returns True if types match
   */
  private isTypeMatch(actualType: Kind, expectedTypes: Kind | readonly Kind[]): boolean {
    const expectedTypesArray = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
    return expectedTypesArray.includes(actualType) || expectedTypesArray.includes('any');
  }

  /**
   * Validates custom validation function if present.
   * @param arg The processed argument
   * @param argDef The argument definition with optional validation
   * @returns True if validation passes or no validation is defined
   */
  private isCustomValidationPass(arg: ProcessedArgument, argDef: Argument): boolean {
    return !argDef.validation?.(arg.dataType);
  }
}
