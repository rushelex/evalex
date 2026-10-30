import type { FormulaLintState } from './formula-lint-state';

import { PluginKey } from 'prosemirror-state';

/** Holds the errors of the document that show. */
export const formulaLintKey = new PluginKey<FormulaLintState>('formulaLint');
