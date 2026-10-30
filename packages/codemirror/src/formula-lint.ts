import type { Action } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { FormulaDiagnostic } from 'evalex/language';

import type { FormulaOptions } from './formula-options';

import { linter } from '@codemirror/lint';

import { insertCompletion } from './insert-completion';

/** Underlines the errors of the formula, with the names that can stand for a name it cannot read as fixes. */
export function formulaLint({ language, fields, message = ({ message: english }) => english }: FormulaOptions): Extension {
  return linter(({ state }) => language.diagnose(state.doc.toString(), { fields }).map((diagnostic) => ({
    from: diagnostic.location.start.offset,
    to: diagnostic.location.end.offset,
    severity: 'error',
    message: message(diagnostic),
    actions: fixesOf(diagnostic),
  })));
}

/** The suggestions of a diagnostic as lint actions, each replacing the name wherever the diagnostic has moved since. */
function fixesOf({ location, suggestions }: FormulaDiagnostic): Action[] {
  if (!suggestions) {
    return [];
  }

  return suggestions.items.map((item) => ({
    name: item.label,
    apply: (view, from) => {
      const shift = from - location.start.offset;

      view.dispatch(insertCompletion({ from: suggestions.from + shift, to: suggestions.to + shift, item }));
    },
  }));
}
