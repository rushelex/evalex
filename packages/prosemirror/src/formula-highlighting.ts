import type { Node } from 'prosemirror-model';

import type { FormulaService } from './formula-service';

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { FormulaText } from './formula-text';

const key = new PluginKey<DecorationSet>('formulaHighlighting');

/** Marks each token of every formula with the class of its kind, such as `pm-formula-number` or `pm-formula-function`. */
export function formulaHighlighting(service: FormulaService): Plugin<DecorationSet> {
  return new Plugin({
    key,
    state: {
      init: (_config, { doc }) => decorationsOf({ doc, service }),
      apply: (transaction, decorations) => (transaction.docChanged ? decorationsOf({ doc: transaction.doc, service }) : decorations),
    },
    props: {
      decorations: (state) => key.getState(state),
    },
  });
}

// `invalid` runs from a syntax error to the end of the text, which the error underline already marks
function decorationsOf({ doc, service }: { doc: Node; service: FormulaService }): DecorationSet {
  const decorations = FormulaText.all(doc).flatMap((formula) => service.tokens(formula).flatMap(({ kind, location: { start, end } }) => (
    kind === 'invalid' || start.offset === end.offset ? [] : [Decoration.inline(formula.posAt(start.offset), formula.posAt(end.offset), { class: `pm-formula-${kind}` })]
  )));

  return DecorationSet.create(doc, decorations);
}
