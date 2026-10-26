import type { Expression } from '../core';
import type { FormulaError } from '../core/errors';

import { Errors } from '../core/errors';

export type ValidationResult
  = | { isValid: true }
    | { isValid: false; error: FormulaError };

/**
 * Validates the formula text a host passes.
 */
export class FormulaValidator {
  /**
   * Validates formula string format.
   */
  validateFormula(expression: Expression | undefined | null): ValidationResult {
    if (typeof expression?.formula !== 'string') {
      return {
        isValid: false,
        error: Errors.Validation.StringFormulaExpected.create({ actual: typeof expression?.formula }),
      };
    }

    if (expression.formula.trim().length === 0) {
      return {
        isValid: false,
        error: Errors.Validation.NonEmptyFormulaExpected.create({ actual: expression.formula }),
      };
    }

    return { isValid: true };
  }
}
