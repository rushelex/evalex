import type { EditorState, Extension } from '@codemirror/state';
import type { DecorationSet, PluginValue, ViewUpdate } from '@codemirror/view';

import type { FormulaOptions } from './formula-options';

import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';

/** A field shown by its label, which the caret steps over and a deletion removes whole. */
class FieldChip extends WidgetType {
  constructor(readonly label: string) {
    super();
  }

  override eq(other: FieldChip): boolean {
    return other.label === this.label;
  }

  override toDOM(): HTMLElement {
    const dom = document.createElement('span');

    dom.className = 'cm-formula-field';
    dom.textContent = this.label;

    return dom;
  }
}

interface Span {
  readonly from: number;
  readonly to: number;
}

/**
 * Shows each field the formula reads as a chip with its label, while the text keeps its name: the author sees «Price»,
 * the formula stores `price`.
 *
 * @remarks
 * The word the author is typing stays text until the caret leaves it or the editor loses focus, so a name that is a
 * field only on its way to a longer one, as `qty` on the way to `qtyTotal`, never flashes as a chip. A name inserted by
 * completion is a chip at once. Chips are atomic ranges, which the caret commands of CodeMirror step over and delete
 * whole. Without fields there are no chips, since then any name is a field.
 */
export function formulaFieldChips({ language, fields }: FormulaOptions): Extension {
  if (!fields) {
    return [];
  }

  const stopTyping = StateEffect.define<null>();

  // The word being typed, which stays text
  const typing = StateField.define<Span | null>({
    create: () => null,
    update: (value, transaction) => {
      if (transaction.effects.some((effect) => effect.is(stopTyping))) {
        return null;
      }

      const { head } = transaction.state.selection.main;

      if (transaction.docChanged && (transaction.isUserEvent('input.type') || transaction.isUserEvent('delete'))) {
        return transaction.state.wordAt(head);
      }

      const mapped = value && { from: transaction.changes.mapPos(value.from, -1), to: transaction.changes.mapPos(value.to, 1) };

      return mapped && mapped.from <= head && head <= mapped.to ? mapped : null;
    },
  });

  const chipsOf = (state: EditorState): DecorationSet => {
    const text = state.doc.toString();
    const skipped = state.field(typing);
    const builder = new RangeSetBuilder<Decoration>();

    for (const { kind, from, to, label } of language.names(text, { fields })) {
      if (kind === 'field' && !(skipped && from <= skipped.to && skipped.from <= to)) {
        builder.add(from, to, Decoration.replace({ widget: new FieldChip(label) }));
      }
    }

    return builder.finish();
  };

  class FieldChips implements PluginValue {
    chips: DecorationSet;

    constructor(view: EditorView) {
      this.chips = chipsOf(view.state);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.startState.field(typing) !== update.state.field(typing)) {
        this.chips = chipsOf(update.state);
      }
    }
  }

  const plugin = ViewPlugin.fromClass(FieldChips, {
    decorations: ({ chips }) => chips,
    provide: (self) => EditorView.atomicRanges.of((view) => view.plugin(self)?.chips ?? Decoration.none),
  });

  return [typing, plugin, EditorView.focusChangeEffect.of((_state, focusing) => (focusing ? null : stopTyping.of(null)))];
}
