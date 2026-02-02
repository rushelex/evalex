import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when a circular dependency is detected in formula references.
 *
 * @example
 * ```typescript
 * // Thrown automatically by runtime when circular dependency is detected
 * const a: Node = {
 *   id: 'a',
 *   value: new FormulaNumber(0),
 *   expression: new Expression('b + 1'),
 *   error: null
 * };
 * const b: Node = {
 *   id: 'b',
 *   value: new FormulaNumber(0),
 *   expression: new Expression('a * 2'),
 *   error: null
 * };
 *
 * orchestrator.add(a);
 * orchestrator.add(b);
 * await orchestrator.waitForProcessing();
 *
 * // Node a processes first (b is 0, so a = 0 + 1 = 1)
 * expect(a.error).toBeNull();
 *
 * // Node b fails with circular dependency error (would create cycle: a -> b -> a)
 * expect(CircularDependencyDetected.is(b.error)).toBe(true);
 * expect(b.value).toBeInstanceOf(FormulaNull);
 *
 * // Manual creation
 * throw CircularDependencyDetected.create({
 *   nodeId: 'formulaB',
 *   dependsOnId: 'formulaA'
 * }, { location: node.location });
 *
 * // Type checking
 * if (CircularDependencyDetected.is(error)) {
 *   console.log(error.payload.nodeId); // 'formulaB'
 *   console.log(error.payload.dependsOnId); // 'formulaA'
 * }
 * ```
 *
 * @param payload - Object containing nodeId and dependsOnId that form the cycle
 */
export const CircularDependencyDetected = createErrorDefinition({
  code: FormulaErrorCode.CIRCULAR_DEPENDENCY,
  createPayload: (payload: FormulaErrorPayloads[FormulaErrorCode.CIRCULAR_DEPENDENCY]) => payload,
  formatMessage: ({ nodeId, dependsOnId }) => `Circular dependency detected: ${nodeId} depends on ${dependsOnId}.`,
  messageKey: 'formula_error.circular_dependency',
});
