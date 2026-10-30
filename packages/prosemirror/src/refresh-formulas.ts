import type { Transaction } from 'prosemirror-state';

import { formulaRefreshKey } from './formula-refresh-key';

/**
 * Makes a transaction tell the formula plugins to read the fields of every formula again, once the host's list of
 * fields has changed.
 *
 * @remarks
 * The plugins ask the `fields` option for the list of each formula, so for the change to show, `fields` is a function
 * that returns the new list. Errors and chips follow the new list at once, and the transaction stays out of the undo
 * history.
 *
 * @param transaction - The transaction to mark, such as `view.state.tr`.
 * @returns The same transaction.
 *
 * @example
 * ```ts
 * import { formula, refreshFormulas } from '@evalexjs/prosemirror';
 *
 * let fields = [{ name: 'price', label: 'Price', type: { kind: 'Number' } }];
 * const plugins = formula({ language, fields: () => fields });
 *
 * // Later, when the host's fields change
 * fields = [{ name: 'price', label: 'Cost', type: { kind: 'Number' } }];
 * view.dispatch(refreshFormulas(view.state.tr));
 * ```
 */
export function refreshFormulas(transaction: Transaction): Transaction {
  return transaction.setMeta(formulaRefreshKey, true).setMeta('addToHistory', false);
}
