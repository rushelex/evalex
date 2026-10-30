import type { EditorState, Extension } from '@codemirror/state';
import type { DecorationSet, EditorView, PluginValue, ViewUpdate } from '@codemirror/view';
import type { Tag } from '@lezer/highlight';
import type { FormulaTokenKind } from 'evalex/language';

import { highlightingFor } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { tokenize } from 'evalex/language';

// `invalid` runs from a syntax error to the end of the text, which the error underline already marks
const TAGS: Readonly<Record<FormulaTokenKind, Tag | undefined>> = {
  number: tags.number,
  string: tags.string,
  regexp: tags.regexp,
  boolean: tags.bool,
  null: tags.null,
  name: tags.variableName,
  function: tags.function(tags.variableName),
  method: tags.function(tags.propertyName),
  keyword: tags.keyword,
  operator: tags.operator,
  punctuation: tags.punctuation,
  invalid: undefined,
};

/** Marks each token of the formula with the class the highlight style of the editor gives its tag. */
class FormulaHighlighter implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = decorationsOf(view.state);
  }

  update(update: ViewUpdate): void {
    // A reconfiguration may bring another highlight style
    if (update.docChanged || update.transactions.some(({ reconfigured }) => reconfigured)) {
      this.decorations = decorationsOf(update.state);
    }
  }
}

/** Colors the tokens of the formula with the highlight style of the editor, such as its theme. */
export function formulaHighlighting(): Extension {
  return ViewPlugin.fromClass(FormulaHighlighter, { decorations: ({ decorations }) => decorations });
}

function decorationsOf(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { kind, location } of tokenize(state.doc.toString())) {
    const tag = TAGS[kind];
    const style = tag && highlightingFor(state, [tag]);

    if (style && location.start.offset < location.end.offset) {
      builder.add(location.start.offset, location.end.offset, Decoration.mark({ class: style }));
    }
  }

  return builder.finish();
}
