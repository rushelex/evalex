import type { Extension } from '@codemirror/state';

import type { FormulaOptions } from './formula-options';

import { formulaCompletion } from './formula-completion';
import { formulaHighlighting } from './formula-highlighting';
import { formulaLint } from './formula-lint';

/**
 * Makes a CodeMirror editor an editor of evalex formulas: it colors the formula, underlines its errors with fixes for
 * misspelled names, and completes fields, functions and methods as the author types.
 *
 * @remarks
 * Colors come from the highlight style of the editor, such as its theme, by the tags of `@lezer/highlight`: numbers are
 * `number`, names `variableName`, functions and methods `function(variableName)` and `function(propertyName)`. An
 * editor without a highlight style shows the formula uncolored.
 *
 * A completion of a function or a method inserts its call with the caret between the parentheses. The options are
 * fixed for the extension: to change the fields, as when the formula moves to another cell, reconfigure it in a
 * `Compartment`.
 *
 * @param options - The language service of the scope, the fields the formula can read and how to word its errors.
 * @returns The extension to add to the editor state.
 *
 * @example
 * ```ts
 * import { formula } from '@evalexjs/codemirror';
 * import { FormulaScope } from 'evalex';
 * import { FormulaLanguage } from 'evalex/language';
 *
 * const language = new FormulaLanguage(new FormulaScope());
 *
 * new EditorView({
 *   parent: document.querySelector('#formula')!,
 *   doc: 'round(price * 1.2, 2)',
 *   extensions: [formula({ language, fields: [{ name: 'price', label: 'Price', type: { kind: 'Number' } }] })],
 * });
 * ```
 */
export function formula(options: FormulaOptions): Extension {
  return [formulaHighlighting(), formulaLint(options), formulaCompletion(options)];
}
