import type { Extension } from '@codemirror/state';

import type { FormulaOptions } from './formula-options';

import { hoverTooltip } from '@codemirror/view';

import { routineInfo } from './routine-info';
import { typeText } from './type-text';
import { valueInfo } from './value-info';

/**
 * Tells what the name under the pointer stands for: a field with its label and type, a variable with its type, or the
 * argument lists and descriptions of the routines a call may run, and with a sample record, what it evaluates to on it.
 */
export function formulaHover({ language, fields, sample, message }: FormulaOptions): Extension {
  return hoverTooltip((view, pos) => {
    const hover = language.hover(view.state.doc.toString(), pos, { fields });

    if (!hover) {
      return null;
    }

    const create = (): { dom: HTMLElement } => {
      const dom = hover.routines ? routineInfo({ routines: hover.routines }) : document.createElement('div');
      const value = sample && language.valueAt(view.state.doc.toString(), { from: hover.from, to: hover.to }, { values: sample });

      if (!hover.routines) {
        const name = view.state.sliceDoc(hover.from, hover.to);

        dom.className = 'cm-formula-name';
        dom.textContent = hover.label === name ? `${name}: ${typeText(hover.type)}` : `${hover.label} · ${name}: ${typeText(hover.type)}`;
      }

      if (value) {
        dom.append(valueInfo({ value, message }));
      }

      return { dom };
    };

    return { pos: hover.from, end: hover.to, above: true, create };
  });
}
