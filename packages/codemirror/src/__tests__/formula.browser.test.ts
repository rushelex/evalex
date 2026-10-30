/// <reference lib="dom" />
import type { Extension } from '@codemirror/state';
import type { FormulaField, FormulaTokenKind } from 'evalex/language';

import { acceptCompletion, completionStatus, currentCompletions, startCompletion } from '@codemirror/autocomplete';
import { syntaxHighlighting } from '@codemirror/language';
import { forceLinting, forEachDiagnostic } from '@codemirror/lint';
import { Compartment, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { it } from '@fast-check/vitest';
import { tagHighlighter, tags } from '@lezer/highlight';
import { FormulaScope } from 'evalex';
import { FormulaLanguage } from 'evalex/language';
import { afterEach, describe, expect, vi } from 'vitest';

import { spacedFormulaArbitrary } from '~/testing-library/formula-text-arbitrary';

import { formula } from '../index';

const CLASSES: Readonly<Record<Exclude<FormulaTokenKind, 'invalid'>, string>> = {
  number: 'tok-number',
  string: 'tok-string',
  regexp: 'tok-regexp',
  boolean: 'tok-bool',
  null: 'tok-null',
  name: 'tok-name',
  function: 'tok-function',
  method: 'tok-method',
  keyword: 'tok-keyword',
  operator: 'tok-operator',
  punctuation: 'tok-punctuation',
};

// The tags the extension documents for each kind of token
const highlighter = syntaxHighlighting(tagHighlighter([
  { tag: tags.number, class: `tok ${CLASSES.number}` },
  { tag: tags.string, class: `tok ${CLASSES.string}` },
  { tag: tags.regexp, class: `tok ${CLASSES.regexp}` },
  { tag: tags.bool, class: `tok ${CLASSES.boolean}` },
  { tag: tags.null, class: `tok ${CLASSES.null}` },
  { tag: tags.variableName, class: `tok ${CLASSES.name}` },
  { tag: tags.function(tags.variableName), class: `tok ${CLASSES.function}` },
  { tag: tags.function(tags.propertyName), class: `tok ${CLASSES.method}` },
  { tag: tags.keyword, class: `tok ${CLASSES.keyword}` },
  { tag: tags.operator, class: `tok ${CLASSES.operator}` },
  { tag: tags.punctuation, class: `tok ${CLASSES.punctuation}` },
  { tag: tags.invalid, class: 'tok tok-invalid' },
]));

const language = new FormulaLanguage(new FormulaScope());

const fields: readonly FormulaField[] = [
  { name: 'price', label: 'Price', type: { kind: 'Number' } },
  { name: 'qty', label: 'Quantity', type: { kind: 'Number' } },
  { name: 'due', type: { kind: 'Date' } },
];

const views: EditorView[] = [];

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy());
});

describe(formula, () => {
  describe('highlighting', () => {
    it.prop([spacedFormulaArbitrary], { numRuns: 50 })('should color each token of a formula by its kind, with the highlight style of the editor', ({ tokens, formula: text }) => {
      const view = mount({ doc: text, extensions: [formula({ language }), highlighter] });

      expect(coloredText(view)).toEqual(tokens.map(({ text: token, kind }) => [token, kind === 'invalid' ? undefined : CLASSES[kind]]));
    });

    it('should leave the text from a syntax error on uncolored', () => {
      const view = mount({ doc: 'round(price, @ 1)', extensions: [formula({ language }), highlighter] });

      expect(coloredText(view)).toEqual([['round', CLASSES.function], ['(', CLASSES.punctuation], ['price', CLASSES.name], [',', CLASSES.punctuation]]);
    });

    it('should color the formula again as it is edited', () => {
      const view = mount({ doc: 'price', extensions: [formula({ language }), highlighter] });

      view.dispatch({ changes: { from: 5, insert: '.round(2)' } });

      expect(coloredText(view).map(([, style]) => style)).toEqual([CLASSES.name, CLASSES.punctuation, CLASSES.method, CLASSES.punctuation, CLASSES.number, CLASSES.punctuation]);
    });

    it('should take up a highlight style the editor gets later', () => {
      const style = new Compartment();
      const view = mount({ doc: '1 + x', extensions: [formula({ language }), style.of([])] });

      view.dispatch({ effects: style.reconfigure(highlighter) });

      expect(coloredText(view)).toEqual([['1', CLASSES.number], ['+', CLASSES.operator], ['x', CLASSES.name]]);
    });

    it('should leave the formula uncolored in an editor without a highlight style', () => {
      const view = mount({ doc: 'round(price, 2)', extensions: [formula({ language })] });

      expect(view.contentDOM.querySelectorAll('.cm-line span')).toHaveLength(0);
    });
  });

  describe('errors', () => {
    it('should underline each error of the formula with its message', async () => {
      const view = mount({ doc: 'round(price,, 2) + max(1 2)', extensions: [formula({ language, fields })] });

      expect(await diagnosticsOf(view)).toEqual([
        { from: 11, to: 12, message: 'Unexpected comma or missing argument in function call.' },
        { from: 22, to: 24, message: 'Expected token ")".' },
      ]);
    });

    it('should check the names of the formula against the fields', async () => {
      const view = mount({ doc: 'price * total', extensions: [formula({ language, fields })] });

      expect(await diagnosticsOf(view)).toEqual([{ from: 8, to: 13, message: 'Variable "total" is not defined.' }]);
    });

    it('should word each error as the host does', async () => {
      const view = mount({ doc: 'price * total', extensions: [formula({ language, fields, message: ({ messageKey, payload }) => `${messageKey} ${Object.entries(payload).sort().join(' ')}` })] });

      expect((await diagnosticsOf(view)).map(({ message }) => message)).toEqual(['formula_error.variable_not_defined name,total referenceType,variable']);
    });

    it('should fix a misspelled name with each name close to it', async () => {
      const view = mount({ doc: 'price * qtty', extensions: [formula({ language, fields })] });

      await diagnosticsOf(view);
      applyFix({ view, name: 'Quantity' });

      expect(view.state.doc.toString()).toBe('price * qty');
    });

    it('should fix a misspelled name where it has moved since the formula was checked', async () => {
      const view = mount({ doc: 'price * qtty', extensions: [formula({ language, fields })] });

      await diagnosticsOf(view);
      view.dispatch({ changes: { from: 0, insert: '2 * ' } });
      applyFix({ view, name: 'Quantity' });

      expect(view.state.doc.toString()).toBe('2 * price * qty');
    });

    it('should fix a misspelled function with its name, keeping the call', async () => {
      const view = mount({ doc: 'rond(price)', extensions: [formula({ language, fields })] });

      await diagnosticsOf(view);
      applyFix({ view, name: 'round' });

      expect([view.state.doc.toString(), view.state.selection.main.head]).toEqual(['round(price)', 5]);
    });
  });

  describe('completion', () => {
    it('should complete a function with its call, the caret between the parentheses', async () => {
      const view = mount({ doc: 'rou', extensions: [formula({ language, fields })] });

      await complete(view);
      await accept(view);

      expect([view.state.doc.toString(), view.state.selection.main.head]).toEqual(['round()', 6]);
    });

    it('should list a field by its label and insert its name', async () => {
      const view = mount({ doc: 'Quan', extensions: [formula({ language, fields })] });

      expect((await complete(view)).map(({ label }) => label)).toContain('Quantity');

      await accept(view);

      expect(view.state.doc.toString()).toBe('qty');
    });

    it('should list a method of one name once, however many kinds it has', async () => {
      const view = mount({ doc: 'x.ad', extensions: [formula({ language })] });
      const adds = (await complete(view)).filter(({ label }) => label === 'add');

      expect(adds).toHaveLength(1);
      expect(adds[0]?.info).toEqual(expect.stringContaining('\n'));
    });

    it('should list only the methods of the type of the value before the dot', async () => {
      const view = mount({ doc: 'due.', extensions: [formula({ language, fields })] });
      const labels = (await complete(view)).map(({ label }) => label);

      expect([labels.includes('year'), labels.includes('upper')]).toEqual([true, false]);
    });

    it('should open the list after a dot is typed', async () => {
      const view = mount({ doc: 'due', extensions: [formula({ language, fields })] });

      type(view, '.');

      await vi.waitFor(() => expect(completionStatus(view.state)).toBe('active'));
    });

    it('should not open the list after a space is typed', async () => {
      const view = mount({ doc: 'price +', extensions: [formula({ language, fields })] });

      type(view, ' ');
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(completionStatus(view.state)).toBeNull();
    });
  });
});

function mount({ doc, extensions }: { doc: string; extensions: Extension }): EditorView {
  const view = new EditorView({ doc, extensions, parent: document.body });

  views.push(view);
  // The editor reads a line break of any kind as one character
  view.dispatch({ selection: EditorSelection.cursor(view.state.doc.length) });

  return view;
}

/** Each colored piece of the text, with its class for the kind of a token. */
function coloredText(view: EditorView): [string | null, string | undefined][] {
  return [...view.contentDOM.querySelectorAll('.tok')].map((element) => [element.textContent, [...element.classList].find((name) => name !== 'tok')]);
}

async function diagnosticsOf(view: EditorView): Promise<{ from: number; to: number; message: string }[]> {
  forceLinting(view);

  return vi.waitFor(() => {
    const found: { from: number; to: number; message: string }[] = [];

    forEachDiagnostic(view.state, ({ message }, from, to) => found.push({ from, to, message }));
    expect(found.length).toBeGreaterThan(0);

    return found;
  });
}

function applyFix({ view, name }: { view: EditorView; name: string }): void {
  forEachDiagnostic(view.state, ({ actions }, from, to) => actions?.find((action) => action.name === name)?.apply(view, from, to));
}

async function complete(view: EditorView): Promise<readonly { label: string; info?: unknown }[]> {
  startCompletion(view);

  return vi.waitFor(() => {
    expect(completionStatus(view.state)).toBe('active');

    return currentCompletions(view.state);
  });
}

async function accept(view: EditorView): Promise<void> {
  // The list takes a choice only once it has been open for a moment
  await vi.waitFor(() => expect(acceptCompletion(view)).toBe(true));
}

function type(view: EditorView, text: string): void {
  const { head } = view.state.selection.main;

  view.dispatch({ changes: { from: head, insert: text }, selection: { anchor: head + text.length }, userEvent: 'input.type' });
}
