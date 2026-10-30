import type { PluginView } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import type { FormulaService } from './formula-service';

import { Plugin } from 'prosemirror-state';

import { FormulaText } from './formula-text';
import { routineInfo } from './routine-info';
import { Tooltip } from './tooltip';

/**
 * Shows the argument lists of the call around the caret in a formula above the caret while the editor has focus, with
 * the argument being typed marked.
 */
export function formulaSignatureHelp(service: FormulaService): Plugin {
  return new Plugin({
    view: (view) => new SignatureHelp({ view, service }),
  });
}

class SignatureHelp implements PluginView {
  readonly #view: EditorView;
  readonly #service: FormulaService;
  readonly #tooltip = new Tooltip('pm-formula-signature-help');
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
    const formula = empty && view.hasFocus() ? FormulaText.at(view.state.doc, head) : undefined;
    const help = formula && this.#service.signatureHelp(formula, formula.offsetAt(head));

    if (help) {
      this.#tooltip.show({ view, pos: head, above: true, content: [routineInfo({ routines: help.routines, argument: help.argument })] });
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
