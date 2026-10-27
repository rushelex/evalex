import type { AST } from '../parser';

import { DependencyExtractorVisitor } from './dependency-extractor.visitor';
import { parseFormula } from './parse-formula';

/** Whether each parsed formula calls a volatile routine, kept as long as its parse is cached. */
const volatiles = new WeakMap<AST.AstNode, boolean>();

/**
 * Tells whether a formula calls a volatile routine, such as `now`, so its result may change with nothing it reads; a
 * formula that does not parse evaluates nothing and is not volatile.
 */
export function isVolatileFormula(formula: string): boolean {
  let ast: AST.AstNode;

  try {
    ast = parseFormula(formula);
  }
  catch {
    return false;
  }

  let volatile = volatiles.get(ast);

  if (volatile === undefined) {
    volatile = DependencyExtractorVisitor.isVolatile(ast);
    volatiles.set(ast, volatile);
  }

  return volatile;
}
