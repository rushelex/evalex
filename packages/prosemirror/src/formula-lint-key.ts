import type { DecorationSet } from 'prosemirror-view';

import { PluginKey } from 'prosemirror-state';

/** Holds the errors of the document that show, as their underlines and marks. */
export const formulaLintKey = new PluginKey<DecorationSet>('formulaLint');
