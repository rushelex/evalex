import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error reported when a formula runs longer than the executor's `timeoutMs`.
 *
 * @example
 * ```typescript
 * const orchestrator = new FormulaOrchestrator({
 *   adapter,
 *   executor: new AsyncExecutor({ timeoutMs: 500 }),
 * });
 *
 * // In the adapter
 * onError: (node, error) => {
 *   if (ExecutionTimeout.is(error)) {
 *     console.log(error.payload.timeoutMs); // 500
 *   }
 * };
 * ```
 *
 * @param payload - Object containing the timeoutMs that ran out
 */
export const ExecutionTimeout = createErrorDefinition({
  code: FormulaErrorCode.EXECUTION_TIMEOUT,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.EXECUTION_TIMEOUT]) => payload,
  formatMessage: ({ timeoutMs }) => `Formula execution timed out after ${timeoutMs}ms`,
  messageKey: 'formula_error.execution_timeout',
});
