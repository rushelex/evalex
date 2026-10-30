import type { Extension } from '@codemirror/state';

import type { FormulaOptions } from './formula-options';

import { hoverTooltip } from '@codemirror/view';

import { routineInfo } from './routine-info';
import { typeText } from './type-text';

/**
 * Tells what the name under the pointer stands for: a field with its label and type, a variable with its type, or the
 * argument lists and descriptions of the routines a call may run.
 */
export function formulaHover({ language, fields }: FormulaOptions): Extension {
  return hoverTooltip((view, pos) => {
    const hover = language.hover(view.state.doc.toString(), pos, { fields });

    if (!hover) {
      return null;
    }

    const create = (): { dom: HTMLElement } => {
      if (hover.routines) {
        return { dom: routineInfo({ routines: hover.routines }) };
      }

      const name = view.state.sliceDoc(hover.from, hover.to);
      const dom = document.createElement('div');

      dom.className = 'cm-formula-name';
      dom.textContent = hover.label === name ? `${name}: ${typeText(hover.type)}` : `${hover.label} · ${name}: ${typeText(hover.type)}`;

      return { dom };
    };

    return { pos: hover.from, end: hover.to, above: true, create };
  });
}
