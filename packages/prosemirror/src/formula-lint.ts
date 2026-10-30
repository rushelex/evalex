import type { FormulaDiagnostic } from 'evalex/language';
import type { Node } from 'prosemirror-model';

import type { FormulaService } from './formula-service';

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { formulaRefreshKey } from './formula-refresh-key';
import { FormulaText } from './formula-text';

// How long the author pauses before errors show, so a name is not underlined while it is typed
const DELAY = 500;

const key = new PluginKey<DecorationSet>('formulaLint');

/**
 * Underlines the errors of every formula a moment after it is edited, with `pm-formula-error`, or a
 * `pm-formula-error-point` mark where nothing is there to underline, as when a parenthesis is missing at the end.
 */
export function formulaLint(service: FormulaService): Plugin<DecorationSet> {
  return new Plugin({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply: (transaction, decorations) => {
        const found: unknown = transaction.getMeta(key);

        if (found instanceof DecorationSet) {
          return found;
        }

        // New fields are not typing, so their errors show at once
        return transaction.getMeta(formulaRefreshKey) ? decorationsOf({ doc: transaction.doc, service }) : decorations.map(transaction.mapping, transaction.doc);
      },
    },
    props: {
      decorations: (state) => key.getState(state),
    },
    view: (view) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const schedule = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          view.dispatch(view.state.tr.setMeta(key, decorationsOf({ doc: view.state.doc, service })));
        }, DELAY);
      };

      schedule();

      return {
        update: (_view, previous) => {
          if (!previous.doc.eq(view.state.doc)) {
            schedule();
          }
        },
        destroy: () => clearTimeout(timer),
      };
    },
  });
}

function decorationsOf({ doc, service }: { doc: Node; service: FormulaService }): DecorationSet {
  const decorations = FormulaText.all(doc).flatMap((formula) => service.diagnose(formula).map((diagnostic) => decorationOf({ formula, diagnostic })));

  return DecorationSet.create(doc, decorations);
}

function decorationOf({ formula, diagnostic }: { formula: FormulaText; diagnostic: FormulaDiagnostic }): Decoration {
  const { start, end } = diagnostic.location;
  const from = formula.posAt(start.offset);
  const to = formula.posAt(end.offset);

  if (from < to) {
    return Decoration.inline(from, to, { class: 'pm-formula-error' });
  }

  return Decoration.widget(from, () => {
    const point = document.createElement('span');

    point.className = 'pm-formula-error-point';

    return point;
  }, { side: -1 });
}
