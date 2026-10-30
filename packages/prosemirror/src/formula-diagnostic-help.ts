import type { PluginView } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import type { FormulaService } from './formula-service';

import { Plugin } from 'prosemirror-state';

import { diagnosticInfo } from './diagnostic-info';
import { formulaLintKey } from './formula-lint-key';
import { FormulaText } from './formula-text';
import { Tooltip } from './tooltip';

/**
 * Tells the errors at the caret below it while the editor has focus, with the buttons of their fixes, so an author who
 * moves by the keyboard reads them as one who points at them does.
 *
 * @remarks
 * Only an error that shows counts, so the name being typed does not bring up a message before its underline does.
 */
export function formulaDiagnosticHelp(service: FormulaService): Plugin {
  return new Plugin({
    view: (view) => new DiagnosticHelp({ view, service }),
  });
}

class DiagnosticHelp implements PluginView {
  readonly #view: EditorView;
  readonly #service: FormulaService;
  readonly #tooltip = new Tooltip('pm-formula-diagnostic-help');
  readonly #refresh = (): void => this.update(this.#view);

  constructor({ view, service }: { view: EditorView; service: FormulaService }) {
    this.#view = view;
    this.#service = service;
    view.dom.addEventListener('focus', this.#refresh);
    view.dom.addEventListener('blur', this.#refresh);
    this.update(view);
  }

  update(view: EditorView): void {
    const { empty, head } = view.state.selection;
    const shown = empty && view.hasFocus() && (formulaLintKey.getState(view.state)?.find(head, head).length ?? 0) > 0;
    const formula = shown ? FormulaText.at(view.state.doc, head) : undefined;
    const offset = formula?.offsetAt(head) ?? 0;
    const diagnostics = formula ? this.#service.diagnose(formula).filter(({ location: { start, end } }) => start.offset <= offset && offset <= end.offset) : [];

    if (formula && diagnostics.length > 0) {
      const from = Math.min(...diagnostics.map(({ location }) => location.start.offset));
      const content = diagnostics.map((diagnostic) => diagnosticInfo({ view, service: this.#service, formula, diagnostic }));

      this.#tooltip.show({ view, pos: formula.posAt(from), above: false, content });
    }
    else {
      this.#tooltip.hide();
    }
  }

  destroy(): void {
    this.#view.dom.removeEventListener('focus', this.#refresh);
    this.#view.dom.removeEventListener('blur', this.#refresh);
    this.#tooltip.hide();
  }
}
