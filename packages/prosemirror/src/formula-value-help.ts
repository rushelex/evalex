import type { PluginView } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import type { FormulaService } from './formula-service';

import { Plugin } from 'prosemirror-state';

import { FormulaText } from './formula-text';
import { Tooltip } from './tooltip';
import { valueInfo } from './value-info';

/**
 * Shows what the selected part of a formula evaluates to on the sample record below the selection while the editor has
 * focus.
 */
export function formulaValueHelp(service: FormulaService): Plugin {
  return new Plugin({
    view: (view) => new ValueHelp({ view, service }),
  });
}

class ValueHelp implements PluginView {
  readonly #view: EditorView;
  readonly #service: FormulaService;
  readonly #tooltip = new Tooltip('pm-formula-value-help');
  readonly #refresh = (): void => this.update(this.#view);

  constructor({ view, service }: { view: EditorView; service: FormulaService }) {
    this.#view = view;
    this.#service = service;
    view.dom.addEventListener('focus', this.#refresh);
    view.dom.addEventListener('blur', this.#refresh);
    this.update(view);
  }

  update(view: EditorView): void {
    const { empty, from, to } = view.state.selection;
    const formula = !empty && view.hasFocus() ? FormulaText.at(view.state.doc, from) : undefined;
    const value = formula?.holds(to) ? this.#service.valueAt(formula, { from: formula.offsetAt(from), to: formula.offsetAt(to) }) : undefined;

    if (formula && value) {
      this.#tooltip.show({ view, pos: formula.posAt(value.from), above: false, content: [valueInfo({ value, service: this.#service })] });
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
