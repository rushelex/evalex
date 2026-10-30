import type { FormulaDiagnostic } from 'evalex/language';
import type { EditorView } from 'prosemirror-view';

import type { FormulaService } from './formula-service';
import type { FormulaText } from './formula-text';

import { insertCompletion } from './insert-completion';

/** Shows the message of a diagnostic and a button per fix, which replaces the misspelled name. */
export function diagnosticInfo({ view, service, formula, diagnostic }: { view: EditorView; service: FormulaService; formula: FormulaText; diagnostic: FormulaDiagnostic }): HTMLElement {
  const dom = document.createElement('div');
  const message = document.createElement('span');

  dom.className = 'pm-formula-diagnostic';
  message.textContent = service.message(diagnostic);
  dom.append(message);

  for (const item of diagnostic.suggestions?.items ?? []) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'pm-formula-fix';
    button.textContent = item.label;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      const { suggestions } = diagnostic;

      // A tooltip hides as soon as the document changes, so the formula is still the one it was shown for
      if (suggestions) {
        view.dispatch(insertCompletion({ state: view.state, formula, from: suggestions.from, to: suggestions.to, item }));
        view.focus();
      }
    });
    dom.append(button);
  }

  return dom;
}
