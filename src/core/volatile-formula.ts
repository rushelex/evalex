import type { Expression } from './expression';

import { DependencyExtractorVisitor } from './dependency-extractor.visitor';
import { parseFormula } from './expression';

const volatileCache = new Map<string, boolean>();

/**
 * Tells whether a formula calls a volatile routine, so the same inputs may still give a different result.
 *
 * @remarks
 * Cached by formula text, like parsing and dependency extraction.
 */
export function isVolatileFormula(expression: Expression): boolean {
  let volatile = volatileCache.get(expression.formula);

  if (volatile === undefined) {
    volatile = DependencyExtractorVisitor.isVolatile(parseFormula(expression.formula));
    volatileCache.set(expression.formula, volatile);
  }

  return volatile;
}
