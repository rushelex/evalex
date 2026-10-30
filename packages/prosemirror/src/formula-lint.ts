import type { Node } from 'prosemirror-model';

import type { FormulaLintState } from './formula-lint-state';
import type { FormulaService } from './formula-service';

import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { formulaLintKey as key } from './formula-lint-key';
import { formulaRefreshKey } from './formula-refresh-key';
import { FormulaText } from './formula-text';

// How long the author pauses before errors show, so a name is not underlined while it is typed
const DELAY = 500;

// Ids of the messages, unique across the editors of a page
let lastID = 0;

/**
 * Underlines the errors of every formula a moment after it is edited, with `pm-formula-error`, or a
 * `pm-formula-error-point` mark where nothing is there to underline, as when a parenthesis is missing at the end.
 *
 * @remarks
 * For assistive technology, an underlined error is `aria-invalid` and described by its message, and a formula with an
 * error that has nothing to underline is described by that message. The messages live in a hidden element in the body
 * of the page.
 */
export function formulaLint(service: FormulaService): Plugin<FormulaLintState> {
  return new Plugin<FormulaLintState>({
    key,
    state: {
      init: () => ({ decorations: DecorationSet.empty, messages: new Map() }),
      apply: (transaction, value) => {
        // New fields are not typing, so their errors show at once
        if (transaction.getMeta(key) === 'lint' || transaction.getMeta(formulaRefreshKey)) {
          return lintStateOf({ doc: transaction.doc, service });
        }

        return { decorations: value.decorations.map(transaction.mapping, transaction.doc), messages: value.messages };
      },
    },
    props: {
      decorations: (state) => key.getState(state)?.decorations,
    },
    view: (view) => {
      const messages = view.dom.ownerDocument.createElement('div');
      let timer: ReturnType<typeof setTimeout> | undefined;

      const schedule = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => view.dispatch(view.state.tr.setMeta(key, 'lint')), DELAY);
      };

      messages.className = 'pm-formula-messages';
      messages.hidden = true;
      view.dom.ownerDocument.body.append(messages);
      schedule();

      return {
        update: (_view, previous) => {
          const shown = key.getState(view.state)?.messages;

          if (shown && shown !== key.getState(previous)?.messages) {
            messages.replaceChildren(...[...shown].map(([id, text]) => {
              const message = view.dom.ownerDocument.createElement('div');

              message.id = id;
              message.textContent = text;

              return message;
            }));
          }

          if (!previous.doc.eq(view.state.doc)) {
            schedule();
          }
        },
        destroy: () => {
          clearTimeout(timer);
          messages.remove();
        },
      };
    },
  });
}

function lintStateOf({ doc, service }: { doc: Node; service: FormulaService }): FormulaLintState {
  const decorations: Decoration[] = [];
  const messages = new Map<string, string>();

  for (const formula of FormulaText.all(doc)) {
    const points: string[] = [];

    for (const diagnostic of service.diagnose(formula)) {
      const id = `pm-formula-message-${++lastID}`;
      const from = formula.posAt(diagnostic.location.start.offset);
      const to = formula.posAt(diagnostic.location.end.offset);

      messages.set(id, service.message(diagnostic));

      if (from < to) {
        decorations.push(Decoration.inline(from, to, { 'class': 'pm-formula-error', 'aria-invalid': 'true', 'aria-describedby': id }));
      }
      else {
        points.push(id);
        decorations.push(Decoration.widget(from, errorPoint, { side: -1 }));
      }
    }

    if (points.length > 0) {
      decorations.push(Decoration.node(formula.pos, formula.pos + formula.node.nodeSize, { 'aria-describedby': points.join(' ') }));
    }
  }

  return { decorations: DecorationSet.create(doc, decorations), messages };
}

function errorPoint(): HTMLElement {
  const point = document.createElement('span');

  point.className = 'pm-formula-error-point';

  return point;
}
