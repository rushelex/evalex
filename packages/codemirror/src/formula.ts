import type { Extension } from '@codemirror/state';

import type { FormulaOptions } from './formula-options';

import { EditorView } from '@codemirror/view';

import { formulaCompletion } from './formula-completion';
import { formulaFieldChips } from './formula-field-chips';
import { formulaHighlighting } from './formula-highlighting';
import { formulaHover } from './formula-hover';
import { formulaLint } from './formula-lint';
import { formulaSignatureHelp } from './formula-signature-help';

// Defaults a theme of the host overrides by the same class names
const theme = EditorView.baseTheme({
  '.cm-formula-routines, .cm-formula-name': { padding: '2px 6px', maxWidth: '40em' },
  '.cm-formula-signature, .cm-formula-name': { fontFamily: 'monospace' },
  '.cm-formula-argument-active': { fontWeight: 'bold' },
  '.cm-formula-description': { opacity: '0.75', marginBottom: '2px' },
  '.cm-formula-field': { padding: '0 4px', borderRadius: '4px', backgroundColor: 'rgba(127, 127, 127, 0.2)' },
});

/**
 * Makes a CodeMirror editor an editor of evalex formulas: it colors the formula, underlines its errors with fixes for
 * misspelled names, shows fields by their labels, completes fields, functions and methods as the author types, shows
 * the arguments of the call around the caret, and tells what a name stands for under the pointer.
 *
 * @remarks
 * Colors come from the highlight style of the editor, such as its theme, by the tags of `@lezer/highlight`: numbers are
 * `number`, names `variableName`, functions and methods `function(variableName)` and `function(propertyName)`. An
 * editor without a highlight style shows the formula uncolored.
 *
 * Each field the formula reads shows as a chip with its label, while the text keeps its name; the word being typed stays
 * text until the caret leaves it. A completion of a function or a method inserts its call with the caret between the
 * parentheses. The arguments of the call around the caret show above it while the editor has focus, with the one being
 * typed marked. Chips and tooltips use the classes `cm-formula-field`, `cm-formula-routines`, `cm-formula-signature`,
 * `cm-formula-argument-active`, `cm-formula-description` and `cm-formula-name`, which a theme may style.
 *
 * The options are fixed for the extension: to change the fields, as when the formula moves to another cell,
 * reconfigure it in a `Compartment`.
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
  return [formulaHighlighting(), formulaLint(options), formulaCompletion(options), formulaSignatureHelp(options), formulaHover(options), formulaFieldChips(options), theme];
}
