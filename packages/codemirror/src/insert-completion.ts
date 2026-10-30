import type { TransactionSpec } from '@codemirror/state';
import type { FormulaCompletion } from 'evalex/language';

/** Replaces the text from `from` to `to` with a completion item and puts the caret where the item says. */
export function insertCompletion({ from, to, item }: { from: number; to: number; item: FormulaCompletion }): TransactionSpec {
  return {
    changes: { from, to, insert: item.text },
    selection: { anchor: from + item.caret },
    scrollIntoView: true,
    userEvent: 'input.complete',
  };
}
