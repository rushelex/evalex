import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error of a formula cell that reads an input without a value: a formula cell that failed, or host data that could not
 * be read, such as a getter that threw or a value without a formula form. The failure is its `cause`.
 *
 * @example
 * ```typescript
 * const view = scope.evaluator().evaluate({ total: new Formula('missing * 2'), tax: new Formula('total * 0.1') });
 *
 * view.tax.message; // 'Cannot use "total": its value failed. [0,5]'
 * view.tax.cause === view.total; // true
 * ```
 */
export const InputError = createErrorDefinition({
  code: FormulaErrorCode.INPUT_ERROR,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.INPUT_ERROR]) => payload,
  formatMessage: ({ name }) => `Cannot use "${name}": its value failed.`,
  messageKey: 'formula_error.input_error',
});
