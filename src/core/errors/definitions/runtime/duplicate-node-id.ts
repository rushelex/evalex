import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when a node is added under an id that another node already holds.
 *
 * @example
 * ```typescript
 * orchestrator.add({ id: 'price', value: new FormulaNumber(1) });
 *
 * try {
 *   orchestrator.add({ id: 'price', value: new FormulaNumber(2) });
 * }
 * catch (error) {
 *   if (DuplicateNodeId.is(error)) {
 *     console.log(error.payload.nodeId); // 'price'
 *   }
 * }
 * ```
 *
 * @param payload - Object containing the taken nodeId
 */
export const DuplicateNodeId = createErrorDefinition({
  code: FormulaErrorCode.DUPLICATE_NODE_ID,
  createPayload: (payload: FormulaErrorPayloads[typeof FormulaErrorCode.DUPLICATE_NODE_ID]) => payload,
  formatMessage: ({ nodeId }) => `Node with id "${nodeId}" already exists`,
  messageKey: 'formula_error.duplicate_node_id',
});
