import type { FormulaCompletion } from 'evalex/language';
import type { EditorState, Transaction } from 'prosemirror-state';

import type { FormulaText } from './formula-text';

import { TextSelection } from 'prosemirror-state';

/**
 * Replaces the text of a formula from offset `from` to `to` with a completion item and puts the caret where the item
 * says; a field it inserts becomes a chip at once, since the change is not typing.
 */
export function insertCompletion({ state, formula, from, to, item }: { state: EditorState; formula: FormulaText; from: number; to: number; item: FormulaCompletion }): Transaction {
  const start = formula.posAt(from);
  const transaction = state.tr.insertText(item.text, start, formula.posAt(to));

  return transaction
    .setSelection(TextSelection.create(transaction.doc, start + item.caret))
    .setMeta('uiEvent', 'complete')
    .scrollIntoView();
}
