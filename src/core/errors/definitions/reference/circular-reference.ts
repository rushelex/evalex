import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error held by every formula cell of a cycle: the formula reads a cell whose value depends on the formula itself.
 *
 * @example
 * ```typescript
 * const view = scope.evaluator().evaluate({ a: new Formula('b + 1'), b: new Formula('2 * a') });
 *
 * view.a.message; // 'Circular reference: "b" depends on this formula. [0,1]'
 * view.b.message; // 'Circular reference: "a" depends on this formula. [4,5]'
 * ```
 */
export const CircularReference = createErrorDefinition({
  code: FormulaErrorCode.CIRCULAR_REFERENCE,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.CIRCULAR_REFERENCE]) => payload,
  formatMessage: ({ name }) => `Circular reference: "${name}" depends on this formula.`,
  messageKey: 'formula_error.circular_reference',
});
