import type { SyntaxError } from '../parser/grammar/syntax-error';
import type { SyntaxErrorCode } from '../parser/grammar/syntax-error-code';
import type { FormulaDiagnostic } from './formula-diagnostic';

import { diagnose as diagnoseFormula } from '../parser/grammar/parser';
import { SYNTAX_ERROR_MESSAGES } from '../parser/grammar/syntax-error-messages';

/**
 * Finds the syntax errors in formula text, for underlining them in an editor.
 *
 * @remarks
 * The first diagnostic is the error evaluating the formula throws, so the editor and the result agree. Reading goes on
 * past errors it can step over, so separate mistakes show at once: a bad escape or a method that is not called leaves
 * the rest readable, and an error inside brackets goes on from the next argument or element. An error outside any
 * bracket ends the reading, since what follows it cannot be told apart from what caused it.
 *
 * Never throws, so it can run on every keystroke.
 *
 * @param text - Formula text, as a host passes it to `FormulaScope.evaluate`.
 * @returns The diagnostics in the order the formula is read; empty when the formula has no syntax error.
 *
 * @example
 * ```ts
 * import { diagnose } from 'evalex/language';
 *
 * diagnose('round(price,, 2) + max(1 2)').map(({ code, location }) => [code, location.start.offset]);
 * // [['MISSING_ARGUMENT', 11], ['UNCLOSED_PARENTHESIS', 22]]
 * ```
 */
export function diagnose(text: string): FormulaDiagnostic[] {
  return diagnoseFormula(text).map((error) => toDiagnostic(error));
}

function toDiagnostic<C extends SyntaxErrorCode>({ code, payload, location }: SyntaxError<C>): FormulaDiagnostic<C> {
  return { code, payload, message: SYNTAX_ERROR_MESSAGES[code](payload), location };
}
