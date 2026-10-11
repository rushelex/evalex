import type { AstNode } from './ast';

import { parse as parseFormula, SyntaxError } from './grammar/parser';

function buildErrorWithLocation(error: SyntaxError) {
  const message = `${error.message.endsWith('.') ? error.message : `${error.message}.`}`;

  return new SyntaxError(`${message} [${error.location.start.offset},${error.location.end.offset}]`, error.location);
}

/**
 * Parses a formula string into an AST.
 *
 * @param formula Formula string to parse.
 * @returns Root of the AST tree of type AstNode.
 * @throws SyntaxError if the formula is invalid.
 */
export function parse(formula: string): AstNode {
  try {
    return parseFormula(formula);
  }
  catch (error) {
    if (error instanceof SyntaxError) {
      throw buildErrorWithLocation(error);
    }

    throw error;
  }
}
