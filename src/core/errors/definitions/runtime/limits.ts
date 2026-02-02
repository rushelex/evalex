import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when a formula exceeds the maximum allowed number of dependencies.
 *
 * @example
 * ```typescript
 * // Thrown automatically by runtime when dependency limit is exceeded
 * // Default limit is typically 100 dependencies per formula
 * const formula = new Expression('a + b + c + ... + z99'); // > 100 dependencies
 *
 * const node: Node = {
 *   id: 'complexFormula',
 *   value: new FormulaNull(),
 *   expression: formula,
 *   error: null
 * };
 *
 * orchestrator.add(node);
 * await orchestrator.waitForProcessing();
 *
 * // Formula fails validation
 * expect(MaxDependenciesExceeded.is(node.error)).toBe(true);
 *
 * // Manual creation
 * throw MaxDependenciesExceeded.create({
 *   nodeId: 'complexFormula',
 *   limit: 100,
 *   actual: 150
 * }, { location: node.location });
 *
 * // Type checking
 * if (MaxDependenciesExceeded.is(error)) {
 *   console.log(error.payload.nodeId); // 'complexFormula'
 *   console.log(error.payload.limit); // 100
 *   console.log(error.payload.actual); // 150
 * }
 * ```
 *
 * @param payload - Object containing nodeId, limit, and actual dependency count
 */
export const MaxDependenciesExceeded = createErrorDefinition({
  code: FormulaErrorCode.MAX_DEPENDENCIES_EXCEEDED,
  createPayload: (payload: FormulaErrorPayloads[FormulaErrorCode.MAX_DEPENDENCIES_EXCEEDED]) => payload,
  formatMessage: ({ nodeId }) => `Formula "${nodeId}" exceeds maximum dependencies limit.`,
  messageKey: 'formula_error.max_dependencies_exceeded',
});

/**
 * Error thrown when a formula exceeds the maximum allowed depth in the dependency chain.
 *
 * @example
 * ```typescript
 * // Thrown automatically by runtime when depth limit is exceeded
 * // Default limit is typically 50 levels deep
 * // Create chain: f0 -> f1 -> f2 -> ... -> f51
 * const nodes: Node[] = [];
 * nodes.push({ id: 'f0', value: new FormulaNumber(1), error: null });
 *
 * for (let i = 1; i <= 51; i++) {
 *   nodes.push({
 *     id: `f${i}`,
 *     value: new FormulaNumber(0),
 *     expression: new Expression(`f${i - 1} + 1`),
 *     error: null
 *   });
 * }
 *
 * nodes.forEach(node => orchestrator.add(node));
 * await orchestrator.waitForProcessing();
 *
 * // Last formula fails with depth exceeded error
 * expect(MaxFormulaDepthExceeded.is(nodes[51].error)).toBe(true);
 *
 * // Manual creation
 * throw MaxFormulaDepthExceeded.create({
 *   nodeId: 'f51',
 *   limit: 50,
 *   actual: 51
 * }, { location: node.location });
 *
 * // Type checking
 * if (MaxFormulaDepthExceeded.is(error)) {
 *   console.log(error.payload.nodeId); // 'f51'
 *   console.log(error.payload.limit); // 50
 *   console.log(error.payload.actual); // 51
 * }
 * ```
 *
 * @param payload - Object containing nodeId, limit, and actual depth
 */
export const MaxFormulaDepthExceeded = createErrorDefinition({
  code: FormulaErrorCode.MAX_FORMULA_DEPTH_EXCEEDED,
  createPayload: (payload: FormulaErrorPayloads[FormulaErrorCode.MAX_FORMULA_DEPTH_EXCEEDED]) => payload,
  formatMessage: ({ nodeId }) => `Formula "${nodeId}" exceeds maximum depth limit.`,
  messageKey: 'formula_error.max_formula_depth_exceeded',
});

/**
 * Error thrown when the total number of formulas exceeds the maximum allowed limit.
 *
 * @example
 * ```typescript
 * // Thrown automatically by runtime when formula count limit is exceeded
 * // Default limit is typically 10,000 formulas
 * const runtime = new Runtime({ maxFormulas: 100 });
 *
 * // Add 100 formulas successfully
 * for (let i = 0; i < 100; i++) {
 *   const node: Node = {
 *     id: `f${i}`,
 *     value: new FormulaNumber(i),
 *     error: null
 *   };
 *   orchestrator.add(node);
 * }
 *
 * // 101st formula exceeds limit
 * const extraNode: Node = {
 *   id: 'f100',
 *   value: new FormulaNumber(0),
 *   error: null
 * };
 *
 * expect(() => orchestrator.add(extraNode)).toThrow(MaxFormulasExceeded);
 *
 * // Manual creation
 * throw MaxFormulasExceeded.create({
 *   nodeId: 'f100',
 *   limit: 100
 * }, { location: node.location });
 *
 * // Type checking
 * if (MaxFormulasExceeded.is(error)) {
 *   console.log(error.payload.nodeId); // 'f100'
 *   console.log(error.payload.limit); // 100
 * }
 * ```
 *
 * @param payload - Object containing nodeId and limit
 */
export const MaxFormulasExceeded = createErrorDefinition({
  code: FormulaErrorCode.MAX_FORMULAS_EXCEEDED,
  createPayload: (payload: FormulaErrorPayloads[FormulaErrorCode.MAX_FORMULAS_EXCEEDED]) => payload,
  formatMessage: ({ nodeId, limit }) => `Maximum formulas count of ${limit} exceeded. Cannot add formula "${nodeId}".`,
  messageKey: 'formula_error.max_formulas_exceeded',
});
