import type { Expression } from './expression';

import { DependencyExtractorVisitor } from './dependency-extractor.visitor';
import { parseExpression } from './expression';

/**
 * Tells whether a formula calls a volatile routine, so the same inputs may still give a different result.
 *
 * @remarks
 * Kept with the parse of the formula, like its dependencies.
 */
export function isVolatileFormula(expression: Expression): boolean {
  const parsed = parseExpression(expression);

  parsed.volatile ??= DependencyExtractorVisitor.isVolatile(parsed.ast);

  return parsed.volatile;
}
