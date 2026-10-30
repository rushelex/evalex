import type { DecorationSet } from 'prosemirror-view';

/** The errors of the document that show: their underlines and marks, and the message each of them describes itself by. */
export interface FormulaLintState {
  readonly decorations: DecorationSet;
  /** The message of each error that shows, by the id its `aria-describedby` names. */
  readonly messages: ReadonlyMap<string, string>;
}
