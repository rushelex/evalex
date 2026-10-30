import type { Plugin } from 'prosemirror-state';

import type { FormulaOptions } from './formula-options';

import { formulaCompletion } from './formula-completion';
import { formulaFieldChips } from './formula-field-chips';
import { formulaHighlighting } from './formula-highlighting';
import { formulaHover } from './formula-hover';
import { formulaKeys } from './formula-keys';
import { formulaLint } from './formula-lint';
import { FormulaService } from './formula-service';
import { formulaSignatureHelp } from './formula-signature-help';

/**
 * Makes every formula node of a ProseMirror document, `formula` and `formulaBlock` of `formulaNodes`, an editor of
 * evalex formulas: it colors the formula, underlines its errors with fixes for misspelled names, shows fields as chips
 * by their labels, completes fields, functions and methods as the author types, shows the arguments of the call around
 * the caret, and tells what a name stands for under the pointer.
 *
 * @remarks
 * The plugins handle the keys of the completion list and of chips, so they go before the keymaps of the editor. Tokens,
 * errors, chips, the list and tooltips carry `pm-formula-*` classes, which `@evalexjs/prosemirror/style.css` styles and
 * a theme may override.
 *
 * Each field a formula reads shows as a chip with its label, while the text keeps its name, and the word being typed
 * stays text until the caret leaves it. The caret steps over a chip and a deletion removes it whole. Errors show a
 * moment after the author stops typing.
 *
 * The options are fixed for the plugins. For fields that change, `fields` is a function that returns the current list,
 * and a transaction marked by `refreshFormulas` makes the formulas read it again; to change the other options,
 * reconfigure the state with plugins made from new options.
 *
 * @param options - The language service of the scope, the fields the formulas can read and how to word their errors.
 * @returns The plugins to add to the editor state, in this order.
 *
 * @example
 * ```ts
 * import { formula, formulaNodes } from '@evalexjs/prosemirror';
 * import { FormulaScope } from 'evalex';
 * import { FormulaLanguage } from 'evalex/language';
 * import '@evalexjs/prosemirror/style.css';
 *
 * const schema = new Schema({ nodes: basic.spec.nodes.append(formulaNodes), marks: basic.spec.marks });
 * const language = new FormulaLanguage(new FormulaScope());
 *
 * new EditorView(document.querySelector('#editor'), {
 *   state: EditorState.create({
 *     schema,
 *     plugins: [...formula({ language, fields: [{ name: 'price', label: 'Price', type: { kind: 'Number' } }] }), keymap(baseKeymap)],
 *   }),
 * });
 * ```
 */
export function formula(options: FormulaOptions): Plugin[] {
  const service = new FormulaService(options);

  return [
    formulaCompletion(service),
    formulaKeys(),
    formulaHighlighting(service),
    formulaLint(service),
    formulaFieldChips(service),
    formulaSignatureHelp(service),
    formulaHover(service),
  ];
}
