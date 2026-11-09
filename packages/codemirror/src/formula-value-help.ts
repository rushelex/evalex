import type { EditorState, Extension } from '@codemirror/state';
import type { Tooltip } from '@codemirror/view';

import type { FormulaOptions } from './formula-options';

import { StateEffect, StateField } from '@codemirror/state';
import { EditorView, showTooltip } from '@codemirror/view';

import { valueInfo } from './value-info';

interface ValueHelpState {
  readonly focused: boolean;
  readonly tooltip: Tooltip | null;
}

/** Shows what the selected part of the formula evaluates to on the sample record below it while the editor has focus. */
export function formulaValueHelp({ language, sample, message }: FormulaOptions): Extension {
  if (!sample) {
    return [];
  }

  const setFocused = StateEffect.define<boolean>();

  const tooltipAt = ({ state, focused }: { state: EditorState; focused: boolean }): Tooltip | null => {
    const { empty, from, to } = state.selection.main;
    const value = focused && !empty ? language.valueAt(state.doc.toString(), { from, to }, { values: sample }) : undefined;

    return value ? { pos: value.from, above: false, create: () => ({ dom: valueInfo({ value, message }) }) } : null;
  };

  const field = StateField.define<ValueHelpState>({
    create: () => ({ focused: false, tooltip: null }),
    update: (value, transaction) => {
      const focus = transaction.effects.findLast((effect) => effect.is(setFocused));
      const focused = focus ? focus.value : value.focused;

      if (!focus && !transaction.docChanged && !transaction.selection) {
        return value;
      }

      return { focused, tooltip: tooltipAt({ state: transaction.state, focused }) };
    },
    provide: (self) => showTooltip.from(self, ({ tooltip }) => tooltip),
  });

  return [field, EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing))];
}
