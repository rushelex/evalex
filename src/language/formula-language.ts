import type { FormulaRoutine } from '../core/formula-routine';
import type { FormulaScope } from '../core/formula-scope';
import type { FormulaSignatureHelp } from './formula-signature-help';

import { findCalls } from '../parser/grammar/parser';

/**
 * Answers what a formula editor asks about the text being typed, with the functions and methods of a scope.
 *
 * @remarks
 * Create one per scope and reuse it on every keystroke: it reads the routines of the scope once, when it is created.
 * Its answers never throw, whatever the text.
 *
 * @example
 * ```ts
 * import { FormulaScope } from 'evalex';
 * import { FormulaLanguage } from 'evalex/language';
 *
 * const language = new FormulaLanguage(new FormulaScope());
 *
 * const help = language.signatureHelp('round(price, ', 13);
 * help?.routines[0]?.name; // 'round'
 * help?.argument;          // 1, the places to round to
 * ```
 */
export class FormulaLanguage {
  readonly #routines: readonly FormulaRoutine[];

  constructor(scope: FormulaScope) {
    this.#routines = scope.routines();
  }

  /**
   * Returns the call the caret is in and the argument it is in, for showing the arguments of the call as they are typed.
   *
   * @remarks
   * The call is the innermost one whose parentheses hold the caret, and a call not closed yet holds the rest of the
   * text it reads. Commas inside text, regular expressions, lists and inner calls do not count.
   *
   * @param text - Formula text, complete or still being typed.
   * @param offset - Offset of the caret in `text`.
   * @returns `undefined` when the caret is not inside the parentheses of a call by name, or the scope has no routine
   * of that name and form.
   */
  signatureHelp(text: string, offset: number): FormulaSignatureHelp | undefined {
    // Inner calls come first, so the first call around the caret is the innermost one
    const call = findCalls(text).find(({ open, end }) => open <= offset && offset <= end);
    const routines = this.#routines.filter(({ name, form }) => name === call?.name && form === call.form);

    if (!call || routines.length === 0) {
      return undefined;
    }

    return { routines, argument: call.commas.filter((comma) => comma < offset).length };
  }
}
