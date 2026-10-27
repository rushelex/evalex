import type { AST } from '../parser';

import { parse } from '../parser';
import { LRUCache } from './lru-cache';

/** How many distinct formula texts keep their parse. */
export const PARSED_TEXTS_CAPACITY = 1000;

// Formula texts come from the host and its users, so the cache shared by equal texts is bounded
const parsedTexts = new LRUCache<string, AST.AstNode>(PARSED_TEXTS_CAPACITY);

/**
 * Parses formula text into its AST, cached per text among the most recently used texts.
 *
 * @throws SyntaxError when the text is not a valid formula.
 */
export function parseFormula(formula: string): AST.AstNode {
  let ast = parsedTexts.get(formula);

  if (!ast) {
    ast = parse(formula);
    parsedTexts.set(formula, ast);
  }

  return ast;
}
