import type { Node, ResolvedPos } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

import { NodeSelection, Plugin, TextSelection } from 'prosemirror-state';

import { FormulaText } from './formula-text';

type Direction = -1 | 1;

const MOVES: Readonly<Record<string, Direction>> = { ArrowLeft: -1, ArrowRight: 1 };
const DELETIONS: Readonly<Record<string, Direction>> = { Backspace: -1, Delete: 1 };

/**
 * Lets the caret step over a chip and a deletion remove it whole, gives each edge of an inline formula two caret stops,
 * one outside and one inside, which look the same on screen, and makes Enter start a new line of the formula.
 */
export function formulaKeys(): Plugin {
  return new Plugin({
    props: {
      handleKeyDown: (view, event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) {
          return false;
        }

        if (event.key === 'Enter') {
          return breakLine(view);
        }

        if (event.shiftKey) {
          return false;
        }

        const move = MOVES[event.key];
        const deletion = DELETIONS[event.key];

        if (move) {
          return moveCaret({ view, direction: move });
        }

        return deletion ? deleteChip({ view, direction: deletion }) : false;
      },
    },
  });
}

/** Inserts a line break in place of the selection when it lies within one formula. */
function breakLine(view: EditorView): boolean {
  const { $from, $to } = view.state.selection;

  if (!FormulaText.isFormula($from.parent) || !$from.sameParent($to)) {
    return false;
  }

  view.dispatch(view.state.tr.insertText('\n').scrollIntoView());

  return true;
}

function isInlineFormula(node: Node | null | undefined): boolean {
  return node?.type.name === 'formula';
}

/** Where the caret goes from a position in a direction when a chip or an edge of an inline formula is next to it. */
function stepFrom({ $pos, direction }: { $pos: ResolvedPos; direction: Direction }): number | undefined {
  const next = direction < 0 ? $pos.nodeBefore : $pos.nodeAfter;

  if (FormulaText.isField(next) || isInlineFormula(next)) {
    return $pos.pos + direction;
  }

  if (isInlineFormula($pos.parent) && $pos.pos === (direction < 0 ? $pos.start() : $pos.end())) {
    return $pos.pos + direction;
  }

  return undefined;
}

function moveCaret({ view, direction }: { view: EditorView; direction: Direction }): boolean {
  const { selection } = view.state;
  const target = selection.empty ? stepFrom({ $pos: selection.$head, direction }) : undefined;

  if (target === undefined) {
    return false;
  }

  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target)).scrollIntoView());

  return true;
}

function deleteChip({ view, direction }: { view: EditorView; direction: Direction }): boolean {
  const { selection, tr } = view.state;

  if (selection instanceof NodeSelection && FormulaText.isField(selection.node)) {
    view.dispatch(tr.deleteSelection().scrollIntoView());

    return true;
  }

  const { $head, empty } = selection;
  const next = direction < 0 ? $head.nodeBefore : $head.nodeAfter;

  if (empty && FormulaText.isField(next)) {
    view.dispatch(tr.delete(Math.min($head.pos, $head.pos + direction), Math.max($head.pos, $head.pos + direction)).scrollIntoView());

    return true;
  }

  // An inline formula with nothing left in it goes too
  if (empty && isInlineFormula($head.parent) && $head.parent.content.size === 0) {
    view.dispatch(tr.delete($head.before(), $head.after()).scrollIntoView());

    return true;
  }

  return false;
}
