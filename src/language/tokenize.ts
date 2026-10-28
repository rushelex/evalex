import type { FormulaToken } from '../parser/ast/token';

import { tokenize as tokenizeFormula } from '../parser/grammar/parser';

/**
 * Splits formula text into tokens with their kinds, for highlighting the formula in an editor.
 *
 * @remarks
 * A word or a character gets its kind from where it stands, as when the formula is evaluated: the `/` in `a / /b/` is
 * an operator and then a regular expression, and `round` is a `function` in `round(x)` but a `method` in `x.round()`.
 * Whitespace between tokens gets no token.
 *
 * Text that is not a whole formula yet, such as one being typed, never throws: the tokens up to a syntax error come
 * first, then the rest of the text as one `invalid` token, which starts with the whole token the error is in. A
 * formula still being typed keeps what reads so far: `round(price, ` gives `round`, `(` and `price`, and its trailing
 * `, ` is `invalid`.
 *
 * @param text - Formula text, as a host passes it to `FormulaScope.evaluate`.
 * @returns Tokens in the order of the text; empty for blank text.
 *
 * @example
 * ```ts
 * import { tokenize } from 'evalex/language';
 *
 * tokenize('price * 2').map(({ kind, location }) => [kind, location.start.offset, location.end.offset]);
 * // [['name', 0, 5], ['operator', 6, 7], ['number', 8, 9]]
 * ```
 */
export function tokenize(text: string): FormulaToken[] {
  return tokenizeFormula(text);
}
