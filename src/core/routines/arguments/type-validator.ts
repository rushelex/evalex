import type { Argument } from './argument';
import type { CallbackExecutor } from './callback-executor';

import { Kind } from '../../data-types';

import { CallbackArgument } from './callback-argument';
import { ProcessedArgument } from './processed-argument';

/**
 * Handles type validation for arguments.
 * Validates both type matching and custom validation rules.
 */
export class TypeValidator {
  /**
   * Validates if an argument matches the expected type definition.
   * @param arg The processed argument or callback executor
   * @param argDef The argument definition to validate against
   * @returns True if the argument is valid
   */
  validateArgumentType(arg: ProcessedArgument | CallbackExecutor, argDef: Argument | CallbackArgument): boolean {
    if (argDef instanceof CallbackArgument) {
      // For CallbackArgument, expect CallbackExecutor (not ProcessedArgument)
      return !(arg instanceof ProcessedArgument);
    }

    // For regular arguments, expect ProcessedArgument
    if (!(arg instanceof ProcessedArgument)) {
      return false;
    }

    return this.#isTypeMatch(arg.dataType.kind, argDef.kinds) && this.#isCustomValidationPass(arg, argDef);
  }

  /**
   * Validates custom validation rules for an argument.
   * @param arg The processed argument
   * @param argDef The argument definition with validation rules
   * @returns True if custom validation passes
   */
  validateCustomRules(arg: ProcessedArgument, argDef: Argument): boolean {
    return this.#isCustomValidationPass(arg, argDef);
  }

  /**
   * Checks if the actual type matches any of the expected types.
   * @param actualType The actual data type kind
   * @param expectedTypes The expected types
   * @returns True if types match
   */
  #isTypeMatch(actualType: Kind, expectedTypes: readonly Kind[]): boolean {
    return expectedTypes.includes(actualType) || expectedTypes.includes(Kind.Any);
  }

  /**
   * Validates custom validation function if present.
   * @param arg The processed argument
   * @param argDef The argument definition with optional validation
   * @returns True if validation passes or no validation is defined
   */
  #isCustomValidationPass(arg: ProcessedArgument, argDef: Argument): boolean {
    return !argDef.failureOn(arg);
  }
}
