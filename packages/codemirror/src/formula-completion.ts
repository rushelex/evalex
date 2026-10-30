import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import type { FormulaCompletion } from 'evalex/language';

import type { FormulaOptions } from './formula-options';

import { autocompletion, pickedCompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

import { insertCompletion } from './insert-completion';

const TYPES: Readonly<Record<FormulaCompletion['kind'], string>> = {
  field: 'property',
  variable: 'variable',
  function: 'function',
  method: 'method',
  choice: 'constant',
};

// Characters after which the list opens before anything is typed: the dot of a method and the quote of a text argument
const OPENERS = new Set(['.', '"', '\'']);

/** Offers the fields, variables, functions and methods that can be typed at the caret, matched by their labels. */
export function formulaCompletion({ language, fields }: FormulaOptions): Extension {
  const source = ({ state, pos, explicit }: CompletionContext): CompletionResult | null => {
    const completions = language.complete(state.doc.toString(), pos, { fields });

    if (!completions || (!explicit && completions.from === pos && !OPENERS.has(state.sliceDoc(pos - 1, pos)))) {
      return null;
    }

    return { from: completions.from, to: completions.to, options: optionsOf(completions.items), validFor: /^[\w$]*$/ };
  };

  return [autocompletion(), EditorState.languageData.of(() => [{ autocomplete: source }])];
}

/**
 * One option per item a list shows: methods of one name on different kinds, such as `add` of numbers and of dates,
 * share an option that describes each of them.
 */
function optionsOf(items: readonly FormulaCompletion[]): Completion[] {
  const groups = Map.groupBy(items, ({ kind, label, text }) => `${kind} ${label} ${text}`);

  return [...groups.values()].map((group) => {
    const [item] = group;
    const descriptions = group.flatMap(({ routine }) => (routine ? [routine.description] : []));

    return {
      label: item.label,
      type: TYPES[item.kind],
      detail: item.kind === 'field' && item.label !== item.text ? item.text : undefined,
      info: descriptions.length > 0 ? [...new Set(descriptions)].join('\n') : undefined,
      apply: (view, completion, from, to) => {
        view.dispatch({ ...insertCompletion({ from, to, item }), annotations: pickedCompletion.of(completion) });
      },
    };
  });
}
