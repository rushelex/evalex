import type { FormulaHover } from 'evalex/language';
import type { PluginView } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import type { FormulaService } from './formula-service';

import { Plugin } from 'prosemirror-state';

import { diagnosticInfo } from './diagnostic-info';
import { FormulaText } from './formula-text';
import { routineInfo } from './routine-info';
import { Tooltip } from './tooltip';
import { typeText } from './type-text';

// How long the pointer rests on a name before its tooltip shows
const DELAY = 300;

/**
 * Tells what is under the pointer in a formula: the errors there, with buttons that apply the fixes of a misspelled
 * name, and what the name stands for, a field with its label and type, a variable with its type, or the argument lists
 * and descriptions of the routines a call may run.
 */
export function formulaHover(service: FormulaService): Plugin {
  return new Plugin({
    view: (view) => new Hover({ view, service }),
  });
}

class Hover implements PluginView {
  readonly #view: EditorView;
  readonly #service: FormulaService;
  readonly #tooltip = new Tooltip('pm-formula-hover');
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #move = (event: MouseEvent): void => {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#showAt({ left: event.clientX, top: event.clientY }), DELAY);
  };
  // The pointer may cross over to the tooltip to press a fix
  readonly #leave = (): void => {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#tooltip.hide(), DELAY);
  };
  readonly #stay = (): void => clearTimeout(this.#timer);

  constructor({ view, service }: { view: EditorView; service: FormulaService }) {
    this.#view = view;
    this.#service = service;
    view.dom.addEventListener('mousemove', this.#move);
    view.dom.addEventListener('mouseleave', this.#leave);
    this.#tooltip.dom.addEventListener('mouseenter', this.#stay);
    this.#tooltip.dom.addEventListener('mouseleave', this.#leave);
  }

  update(view: EditorView, previous: EditorView['state']): void {
    if (!previous.doc.eq(view.state.doc)) {
      this.#tooltip.hide();
    }
  }

  destroy(): void {
    clearTimeout(this.#timer);
    this.#view.dom.removeEventListener('mousemove', this.#move);
    this.#view.dom.removeEventListener('mouseleave', this.#leave);
    this.#tooltip.hide();
  }

  #showAt(coords: { left: number; top: number }): void {
    const view = this.#view;
    const pos = view.posAtCoords(coords)?.pos;
    const formula = pos === undefined ? undefined : FormulaText.at(view.state.doc, pos);

    if (pos === undefined || !formula) {
      this.#tooltip.hide();

      return;
    }

    const offset = formula.offsetAt(pos);
    const diagnostics = this.#service.diagnose(formula).filter(({ location: { start, end } }) => start.offset <= offset && offset <= end.offset);
    const hover = this.#service.hover(formula, offset);
    const content = [
      ...diagnostics.map((diagnostic) => diagnosticInfo({ view, service: this.#service, formula, diagnostic })),
      ...(hover ? [hover.routines ? routineInfo({ routines: hover.routines }) : this.#nameOf({ formula, hover })] : []),
    ];

    if (content.length === 0) {
      this.#tooltip.hide();

      return;
    }

    const from = Math.min(...diagnostics.map(({ location }) => location.start.offset), hover?.from ?? offset);

    this.#tooltip.show({ view, pos: formula.posAt(from), above: true, content });
  }

  #nameOf({ formula, hover }: { formula: FormulaText; hover: FormulaHover }): HTMLElement {
    const name = formula.text.slice(hover.from, hover.to);
    const dom = document.createElement('div');

    dom.className = 'pm-formula-name';
    dom.textContent = hover.label === name ? `${name}: ${typeText(hover.type)}` : `${hover.label} · ${name}: ${typeText(hover.type)}`;

    return dom;
  }
}
