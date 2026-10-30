import type { EditorState, Extension } from '@codemirror/state';
import type { Tooltip } from '@codemirror/view';

import type { FormulaOptions } from './formula-options';

import { StateEffect, StateField } from '@codemirror/state';
import { EditorView, showTooltip } from '@codemirror/view';

import { routineInfo } from './routine-info';

interface SignatureHelpState {
  readonly focused: boolean;
  readonly tooltip: Tooltip | null;
}

/**
 * Shows the argument lists of the call around the caret above it while the editor has focus, with the argument being
 * typed marked.
 */
export function formulaSignatureHelp({ language }: Pick<FormulaOptions, 'language'>): Extension {
  const setFocused = StateEffect.define<boolean>();

  const tooltipAt = ({ state, focused }: { state: EditorState; focused: boolean }): Tooltip | null => {
    const { empty, head } = state.selection.main;
    const help = focused && empty ? language.signatureHelp(state.doc.toString(), head) : undefined;

    return help
      ? { pos: head, above: true, create: () => ({ dom: routineInfo({ routines: help.routines, argument: help.argument }) }) }
      : null;
  };

  const field = StateField.define<SignatureHelpState>({
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
