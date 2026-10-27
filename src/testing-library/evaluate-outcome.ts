import type { FormulaDataType } from '../core';
import type { EvaluateOptions } from './evaluate';

import { FormulaError } from '../core';
import { evaluate } from './evaluate';

type FormulaOutcome = { readonly value: FormulaDataType } | { readonly error: FormulaError };

/**
 * Evaluates the formula and returns its result or its formula error, so two evaluations can be compared.
 *
 * @throws Any error other than a {@link FormulaError}: a formula never ends with one.
 */
export function evaluateOutcome(formula: string, options: EvaluateOptions = {}): FormulaOutcome {
  try {
    return { value: evaluate(formula, options) };
  }
  catch (error) {
    if (isFormulaError(error)) {
      return { error };
    }

    throw error;
  }
}

// Helpers

// `instanceof` narrows a generic class to its `any` instantiation, so the guard names the error type.
function isFormulaError(error: unknown): error is FormulaError {
  return error instanceof FormulaError;
}
