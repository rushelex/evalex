import type { EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import type { FormulaService } from './formula-service';

import { Plugin, PluginKey } from 'prosemirror-state';

import { formulaRefreshKey } from './formula-refresh-key';
import { FormulaText } from './formula-text';

interface Span {
  readonly from: number;
  readonly to: number;
}

interface ChipsState {
  readonly focused: boolean;
  /** The word being typed, which stays text. */
  readonly typing: Span | null;
}

/** A name to show as a chip, by the span of the name in the formula text. */
interface Chip extends Span {
  readonly name: string;
  readonly label: string;
}

const key = new PluginKey<ChipsState>('formulaFieldChips');

const WORD = /\w/;

/**
 * Keeps each field a formula reads as a `formulaField` node, shown by its label, and every other name as text: the
 * author sees «Price», the formula stores `price`.
 *
 * @remarks
 * The word the author is typing stays text until the caret leaves it or the editor loses focus, so a name that is a
 * field only on its way to a longer one, as `qty` on the way to `qtyTotal`, never turns into a chip. A name inserted by
 * completion, a fix or a paste is a chip at once. A chip that stops being a field, as when a `let` declares its name,
 * turns back into text. These changes stay out of the undo history. Without fields there are no chips.
 */
export function formulaFieldChips(service: FormulaService): Plugin<ChipsState> {
  return new Plugin<ChipsState>({
    key,
    state: {
      init: () => ({ focused: false, typing: null }),
      apply: (transaction, value, _old, state) => {
        const meta: unknown = transaction.getMeta(key);
        const focused = meta === 'focus' || (meta !== 'blur' && value.focused);

        if (!focused || meta === 'sync') {
          return { focused, typing: focused ? mapSpan(transaction, value.typing) : null };
        }

        // A paste, a drop or an inserted completion is not typing
        if (transaction.docChanged) {
          return { focused, typing: transaction.getMeta('uiEvent') === undefined ? wordAt(state) : null };
        }

        const typing = mapSpan(transaction, value.typing);
        const { head } = state.selection;

        return { focused, typing: typing && typing.from <= head && head <= typing.to ? typing : null };
      },
    },
    appendTransaction: (transactions, oldState, state) => {
      const before = key.getState(oldState)?.typing;
      const after = key.getState(state)?.typing;
      const moved = before?.from !== after?.from || before?.to !== after?.to;
      const changed = transactions.some((transaction) => (transaction.docChanged && transaction.getMeta(key) !== 'sync') || transaction.getMeta(formulaRefreshKey));

      return moved || changed ? syncChips({ state, service }) : null;
    },
    props: {
      handleDOMEvents: {
        focus: (view) => setFocused({ view, focused: true }),
        blur: (view) => setFocused({ view, focused: false }),
      },
    },
    view: (view) => {
      let live = true;

      // A document made from text shows its fields as chips once the editor is set up
      queueMicrotask(() => {
        const transaction = live ? syncChips({ state: view.state, service }) : null;

        if (transaction) {
          view.dispatch(transaction);
        }
      });

      return { destroy: () => {
        live = false;
      } };
    },
  });
}

function setFocused({ view, focused }: { view: EditorView; focused: boolean }): boolean {
  if (key.getState(view.state)?.focused !== focused) {
    view.dispatch(view.state.tr.setMeta(key, focused ? 'focus' : 'blur'));
  }

  return false;
}

function mapSpan(transaction: Transaction, span: Span | null): Span | null {
  return span && { from: transaction.mapping.map(span.from, -1), to: transaction.mapping.map(span.to, 1) };
}

/** The name around the caret inside a formula. */
function wordAt(state: EditorState): Span | null {
  const { empty, head } = state.selection;
  const formula = empty ? FormulaText.at(state.doc, head) : undefined;

  if (!formula) {
    return null;
  }

  const offset = formula.offsetAt(head);
  let from = offset;
  let to = offset;

  while (from > 0 && WORD.test(formula.text[from - 1] ?? '')) {
    from--;
  }

  while (to < formula.text.length && WORD.test(formula.text[to] ?? '')) {
    to++;
  }

  return from < to ? { from: formula.posAt(from), to: formula.posAt(to) } : null;
}

/** The names of a formula to show as chips: its fields, apart from the word being typed. */
function chipsOf({ formula, service, typing }: { formula: FormulaText; service: FormulaService; typing: Span | null }): Chip[] {
  if (!service.checksNames) {
    return [];
  }

  const skipped = typing && formula.holds(typing.from) ? { from: formula.offsetAt(typing.from), to: formula.offsetAt(typing.to) } : null;

  return service.names(formula).flatMap(({ kind, from, to, label }) => (
    kind === 'field' && !(skipped && from <= skipped.to && skipped.from <= to) ? [{ from, to, label, name: formula.text.slice(from, to) }] : []
  ));
}

/**
 * Turns the chips that no longer stand for fields into text, then the names that do into chips; null when every
 * formula already shows its fields as chips.
 */
function syncChips({ state, service }: { state: EditorState; service: FormulaService }): Transaction | null {
  const { schema, tr } = state;
  const typing = key.getState(state)?.typing ?? null;
  const formulas = FormulaText.all(state.doc);
  const wanted = formulas.map((formula) => chipsOf({ formula, service, typing }));

  formulas.forEach((formula, index) => {
    const chips = new Map(wanted[index]?.map((chip) => [chip.from, chip]));

    for (const { node, pos, from, to } of formula.fields()) {
      const chip = chips.get(from);
      const at = tr.mapping.map(pos);

      if (chip?.to !== to) {
        tr.replaceWith(at, at + 1, schema.text(node.textContent));
      }
      else if (chip.label !== node.attrs.label) {
        tr.setNodeAttribute(at, 'label', chip.label);
      }
    }
  });

  // From the end, so the positions of the formulas and names still to wrap stay as they are
  FormulaText.all(tr.doc).toReversed().forEach((formula, reversedIndex) => {
    const present = new Set(formula.fields().map(({ from }) => from));

    for (const { from, to, name, label } of (wanted[formulas.length - 1 - reversedIndex] ?? []).toReversed()) {
      if (!present.has(from)) {
        tr.replaceWith(formula.posAt(from), formula.posAt(to), schema.node('formulaField', { name, label }));
      }
    }
  });

  return tr.docChanged ? tr.setMeta(key, 'sync').setMeta('addToHistory', false) : null;
}
