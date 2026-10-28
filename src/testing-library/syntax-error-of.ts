import type { SyntaxError } from '~/parser/grammar/syntax-error';

import { parse } from '~/parser/grammar/parser';

import { isSyntaxError } from './is-syntax-error';

/** The syntax error parsing `formula` throws; fails the test when the formula parses. */
export function syntaxErrorOf(formula: string): SyntaxError {
  try {
    parse(formula);
  }
  catch (error) {
    if (isSyntaxError(error)) {
      return error;
    }

    throw error;
  }

  throw new Error(`Expected "${formula}" to fail to parse.`);
}
