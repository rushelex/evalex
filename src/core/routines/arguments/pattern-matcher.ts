import type { ArgumentsDefinitions, ArgumentsPattern, ProcessedArguments } from './arguments-definitions';

import { CallbackArgument } from './callback-argument';
import { CallbackExecutor } from './callback-executor';
import { ProcessedArgument } from './processed-argument';
import { TypeValidator } from './type-validator';

/**
 * Handles pattern matching logic for argument validation.
 * Determines which patterns match the provided arguments.
 */
export class PatternMatcher {
  private readonly definitions: ArgumentsDefinitions;
  private readonly typeValidator: TypeValidator;

  constructor(definitions: ArgumentsDefinitions) {
    this.definitions = definitions;
    this.typeValidator = new TypeValidator();
  }

  /**
   * Finds the first pattern that matches the provided arguments.
   * @param args The processed arguments to match
   * @returns The matching pattern or null if no match found
   */
  public findMatchingPattern(args: ProcessedArguments): ArgumentsPattern | null {
    for (const pattern of this.definitions.alternatives) {
      if (this.validatePatternStructure(args, pattern)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Validates if arguments match a specific pattern structure.
   * This includes argument count validation and individual argument validation.
   * @param args The processed arguments
   * @param pattern The pattern to validate against
   * @returns True if the pattern matches
   */
  public validatePatternStructure(args: ProcessedArguments, pattern: ArgumentsPattern): boolean {
    if (!this.checkArgumentCount(args, pattern)) {
      return false;
    }

    return args.every((arg, index) => {
      const argDef = this.definitions.getArgumentForPattern(index, pattern);

      if (!argDef) {
        return false;
      }

      if (argDef instanceof CallbackArgument) {
        // For CallbackArgument, expect CallbackExecutor (not ProcessedArgument)
        return arg instanceof CallbackExecutor;
      }

      // For regular arguments, expect ProcessedArgument
      if (!(arg instanceof ProcessedArgument)) {
        return false;
      }

      return this.typeValidator.validateArgumentType(arg, argDef);
    });
  }

  /**
   * Checks if the argument count is valid for the pattern.
   * @param args The processed arguments
   * @param pattern The pattern to check against
   * @returns True if argument count is valid
   */
  private checkArgumentCount(args: ProcessedArguments, pattern: ArgumentsPattern): boolean {
    const requiredCount = this.definitions.getRequiredCount(pattern);
    const maxCount = this.definitions.getMaxCount(pattern);

    return args.length >= requiredCount && args.length <= maxCount;
  }
}
