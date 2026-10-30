import type { FormulaCompletion } from 'evalex/language';
import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import type { FormulaService } from './formula-service';

import { Plugin, PluginKey } from 'prosemirror-state';

import { FormulaText } from './formula-text';
import { insertCompletion } from './insert-completion';
import { Tooltip } from './tooltip';

/** One line of the list: the items of one kind, label and text, such as `add` of numbers and of dates. */
interface CompletionOption {
  readonly item: FormulaCompletion;
  readonly description?: string;
}

interface CompletionState {
  /** Offsets in the formula text of the range an option replaces. */
  readonly from: number;
  readonly to: number;
  readonly options: readonly CompletionOption[];
  readonly selected: number;
}

/** `open` on Ctrl-Space, `close`, or the index of the option to select. */
type CompletionAction = 'open' | 'close' | number;

const key = new PluginKey<CompletionState | null>('formulaCompletion');

// Characters after which the list opens before anything is typed: the dot of a method and the quote of a text argument
const OPENERS = new Set(['.', '"', '\'']);

const PAGE = 10;

/**
 * Offers the fields, variables, functions and methods that can be typed at the caret in a formula, matched by their
 * labels, in a list below the caret.
 *
 * @remarks
 * The list opens by itself as a name is typed, after a dot and inside quotes, and on Ctrl-Space. ↑ and ↓ move through
 * it, Enter and Tab insert the option, Escape closes it. Options whose label starts with the typed text come first, then
 * the ones whose name does, then the ones whose label holds it.
 */
export function formulaCompletion(service: FormulaService): Plugin<CompletionState | null> {
  return new Plugin<CompletionState | null>({
    key,
    state: {
      init: () => null,
      apply: (transaction, value, previous, state) => {
        const action: unknown = transaction.getMeta(key);

        if (action === 'close') {
          return null;
        }

        if (typeof action === 'number') {
          return value && { ...value, selected: action };
        }

        if (action === 'open') {
          return completionsAt({ state, service, explicit: true });
        }

        if (transaction.getMeta('uiEvent') !== undefined && transaction.docChanged) {
          return null;
        }

        const typed = transaction.docChanged && state.doc.content.size > previous.doc.content.size;

        if (!transaction.docChanged && !transaction.selectionSet) {
          return value;
        }

        if (!value && !typed) {
          return null;
        }

        const next = completionsAt({ state, service, explicit: value !== null });

        // The caret left the word the list was for
        return value && !transaction.docChanged && next?.from !== value.from ? null : next;
      },
    },
    props: {
      handleKeyDown: (view, event) => handleKey({ view, event }),
      handleDOMEvents: {
        blur: (view) => {
          if (key.getState(view.state)) {
            dispatchAction({ view, action: 'close' });
          }

          return false;
        },
      },
    },
    view: (view) => new CompletionList(view),
  });
}

/** What can be typed at the caret, or null where nothing can or the caret is not in a word that wants a list. */
function completionsAt({ state, service, explicit }: { state: EditorState; service: FormulaService; explicit: boolean }): CompletionState | null {
  const { empty, head } = state.selection;
  const formula = empty ? FormulaText.at(state.doc, head) : undefined;

  if (!formula) {
    return null;
  }

  const offset = formula.offsetAt(head);
  const completions = service.complete(formula, offset);

  if (!completions || (!explicit && completions.from === offset && !OPENERS.has(formula.text[offset - 1] ?? ''))) {
    return null;
  }

  const options = matching({ options: optionsOf(completions.items), typed: formula.text.slice(completions.from, offset) });

  return options.length > 0 ? { from: completions.from, to: completions.to, options, selected: 0 } : null;
}

/** One option per item a list shows: methods of one name on different kinds share one, which describes each of them. */
function optionsOf(items: readonly FormulaCompletion[]): CompletionOption[] {
  const groups = Map.groupBy(items, ({ kind, label, text }) => `${kind} ${label} ${text}`);

  return [...groups.values()].map(([item, ...rest]) => {
    const descriptions = [...new Set([item, ...rest].flatMap(({ routine }) => (routine ? [routine.description] : [])))];

    return { item, description: descriptions.length > 0 ? descriptions.join('\n') : undefined };
  });
}

function matching({ options, typed }: { options: readonly CompletionOption[]; typed: string }): CompletionOption[] {
  const text = typed.toLowerCase();

  const rank = ({ item }: CompletionOption): number => {
    const label = item.label.toLowerCase();

    if (label.startsWith(text)) {
      return 0;
    }

    if (item.text.toLowerCase().startsWith(text)) {
      return 1;
    }

    return label.includes(text) ? 2 : 3;
  };

  return options.map((option) => ({ option, rank: rank(option) }))
    .filter(({ rank: found }) => found < 3)
    .sort((a, b) => a.rank - b.rank)
    .map(({ option }) => option);
}

function dispatchAction({ view, action }: { view: EditorView; action: CompletionAction }): void {
  view.dispatch(view.state.tr.setMeta(key, action));
}

function accept({ view, index }: { view: EditorView; index: number }): void {
  const completions = key.getState(view.state);
  const option = completions?.options[index];
  const formula = FormulaText.at(view.state.doc, view.state.selection.head);

  if (completions && option && formula) {
    view.dispatch(insertCompletion({ state: view.state, formula, from: completions.from, to: completions.to, item: option.item }));
  }
}

function handleKey({ view, event }: { view: EditorView; event: KeyboardEvent }): boolean {
  if (event.key === ' ' && event.ctrlKey && !event.altKey && !event.metaKey) {
    const inFormula = FormulaText.at(view.state.doc, view.state.selection.head) !== undefined;

    if (inFormula) {
      dispatchAction({ view, action: 'open' });
    }

    return inFormula;
  }

  const completions = key.getState(view.state);

  if (!completions || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  const { selected, options } = completions;
  const last = options.length - 1;
  const moves: Readonly<Record<string, number>> = {
    ArrowDown: selected === last ? 0 : selected + 1,
    ArrowUp: selected === 0 ? last : selected - 1,
    PageDown: Math.min(last, selected + PAGE),
    PageUp: Math.max(0, selected - PAGE),
  };
  const move = moves[event.key];

  if (move !== undefined) {
    dispatchAction({ view, action: move });

    return true;
  }

  if (event.key === 'Enter' || event.key === 'Tab') {
    accept({ view, index: selected });

    return true;
  }

  if (event.key === 'Escape') {
    dispatchAction({ view, action: 'close' });

    return true;
  }

  return false;
}

/** Shows the options below the start of the text they replace, with the description of the selected one beside them. */
class CompletionList {
  readonly #view: EditorView;
  readonly #tooltip = new Tooltip('pm-formula-completions');
  readonly #list = document.createElement('ul');
  readonly #info = document.createElement('div');
  #shown: CompletionState | null = null;

  constructor(view: EditorView) {
    this.#view = view;
    this.#list.className = 'pm-formula-completion-list';
    this.#list.setAttribute('role', 'listbox');
    this.#info.className = 'pm-formula-completion-info';
    // Keeps the focus in the editor, so a click inserts the option instead of closing the list
    this.#tooltip.dom.addEventListener('mousedown', (event) => event.preventDefault());
    this.update(view);
  }

  update(view: EditorView): void {
    const completions = key.getState(view.state) ?? null;
    const formula = completions && FormulaText.at(view.state.doc, view.state.selection.head);

    if (!completions || !formula) {
      this.#shown = null;
      this.#tooltip.hide();

      return;
    }

    if (completions.options !== this.#shown?.options) {
      this.#list.replaceChildren(...completions.options.map((option, index) => this.#itemOf({ option, index })));
    }

    this.#shown = completions;
    this.#list.childNodes.forEach((item, index) => {
      if (item instanceof HTMLElement) {
        item.setAttribute('aria-selected', String(index === completions.selected));
      }
    });

    const description = completions.options[completions.selected]?.description;

    this.#info.textContent = description ?? '';
    this.#info.hidden = description === undefined;
    this.#tooltip.show({ view, pos: formula.posAt(completions.from), above: false, content: [this.#list, this.#info] });
    this.#list.children[completions.selected]?.scrollIntoView({ block: 'nearest' });
  }

  destroy(): void {
    this.#tooltip.hide();
  }

  #itemOf({ option: { item }, index }: { option: CompletionOption; index: number }): HTMLElement {
    const dom = document.createElement('li');
    const label = document.createElement('span');

    dom.className = `pm-formula-completion pm-formula-completion-${item.kind}`;
    dom.setAttribute('role', 'option');
    label.className = 'pm-formula-completion-label';
    label.textContent = item.label;
    dom.append(label);

    if (item.kind === 'field' && item.label !== item.text) {
      const detail = document.createElement('span');

      detail.className = 'pm-formula-completion-detail';
      detail.textContent = item.text;
      dom.append(detail);
    }

    dom.addEventListener('click', () => accept({ view: this.#view, index }));

    return dom;
  }
}
