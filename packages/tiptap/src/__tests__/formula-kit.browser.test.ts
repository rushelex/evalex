import '../../../prosemirror/style.css';

import type { FormulaOptions } from '@evalexjs/prosemirror';
import type { Content, JSONContent } from '@tiptap/core';
import type { NodeSpec } from '@tiptap/pm/model';
import type { FormulaField } from 'evalex/language';

import { formulaNodes } from '@evalexjs/prosemirror';
import { Editor, Extension, generateJSON, Node } from '@tiptap/core';
import { FormulaScope } from 'evalex';
import { FormulaLanguage } from 'evalex/language';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userEvent } from 'vitest/browser';

import { FormulaKit } from '../index';

const Document = Node.create({ name: 'doc', topNode: true, content: 'block+' });
const Paragraph = Node.create({ name: 'paragraph', group: 'block', content: 'inline*', parseHTML: () => [{ tag: 'p' }], renderHTML: () => ['p', 0] });
const Text = Node.create({ name: 'text', group: 'inline' });

const language = new FormulaLanguage(new FormulaScope());

const fields: readonly FormulaField[] = [
  { name: 'price', label: 'Price', type: { kind: 'Number' } },
  { name: 'qty', label: 'Quantity', type: { kind: 'Number' } },
];

const editors: Editor[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => {
    editor.view.dom.parentElement?.remove();
    editor.destroy();
  });
});

describe('FormulaKit', () => {
  it.each(Object.entries(formulaNodes))('should add the $0 node with the properties it has in the ProseMirror package', async (name, spec) => {
    const editor = await mount({ content: '<p></p>', options: { language } });

    expect(schemaProperties(editor.schema.nodes[name]?.spec ?? {})).toEqual(schemaProperties(spec));
  });

  it('should read formulas of the content, inline and on lines of their own, with their fields as chips', async () => {
    const editor = await mount({ content: '<p>Total: <span data-formula>round(price * qty, 2)</span></p><div data-formula>price</div>', options: { language, fields } });

    expect([formulasOf(editor), chipsOf(editor)]).toEqual([['round(price * qty, 2)', 'price'], ['Price', 'Quantity', 'Price']]);
  });

  it('should show the fields the host gives now, on the refreshFormulas command', async () => {
    let given: readonly FormulaField[] = fields;
    const editor = await mount({ content: '<div data-formula>price * total</div>', options: { language, fields: () => given } });

    given = [{ name: 'price', label: 'Cost' }, { name: 'total', label: 'Total' }];
    editor.commands.refreshFormulas();

    expect(chipsOf(editor)).toEqual(['Cost', 'Total']);
  });

  it('should give each field of a formula with its name and label in the JSON of the editor, and read it back from its HTML', async () => {
    const editor = await mount({ content: '<p>Total: <span data-formula>price * qty</span></p>', options: { language, fields } });
    const json = editor.getJSON();

    expect([fieldsIn(json), generateJSON(editor.getHTML(), [Document, Paragraph, Text, FormulaKit])]).toEqual([
      [{ name: 'price', label: 'Price' }, { name: 'qty', label: 'Quantity' }],
      json,
    ]);
  });

  it('should give a field by its name in the text of the editor', async () => {
    const editor = await mount({ content: '<p>Total: <span data-formula>price * qty</span></p>', options: { language, fields } });

    expect(editor.getText()).toBe('Total: price * qty');
  });

  it('should mark the tokens of a formula with the class of their kind', async () => {
    const editor = await mount({ content: '<div data-formula>1 + x</div>', options: { language } });

    expect([...editor.view.dom.querySelectorAll('.pm-formula span')].map(({ className }) => className)).toEqual(['pm-formula-number', 'pm-formula-operator', 'pm-formula-name']);
  });

  it('should insert the option of the completion list on Enter, ahead of a host extension that sends on Enter', async () => {
    const sent = vi.fn<() => boolean>(() => true);
    const editor = await mount({ content: '<div data-formula></div>', options: { language, fields }, extensions: [sendOnEnter(sent)] });

    editor.commands.focus();
    await userEvent.keyboard('Quan');
    await vi.waitFor(() => expect(document.querySelector('.pm-formula-completion')).not.toBeNull());
    await userEvent.keyboard('{Enter}');

    expect([formulasOf(editor), chipsOf(editor), sent.mock.calls.length]).toEqual([['qty'], ['Quantity'], 0]);
  });

  it('should leave Enter in a formula to a host extension that sends on it', async () => {
    const sent = vi.fn<() => boolean>(() => true);
    const editor = await mount({ content: '<p>a <span data-formula>1 + 2</span> b</p>', options: { language }, extensions: [sendOnEnter(sent)] });

    press({ editor, key: 'Enter' });

    expect([formulasOf(editor), sent.mock.calls.length]).toEqual([['1 + 2'], 1]);
  });

  it.each([
    { case: 'an inline formula', content: '<p>a <span data-formula>let x = 1</span> b</p>' },
    { case: 'a block formula', content: '<div data-formula>let x = 1</div>' },
  ])('should start a new line of $case on Enter, by the keymap of the editor', async ({ content }) => {
    const editor = await mount({ content, options: { language } });

    press({ editor, key: 'Enter' });
    editor.commands.insertContent('in x');

    expect([formulasOf(editor), editor.state.doc.childCount]).toEqual([['let x = 1\nin x'], 1]);
  });

  it('should delete a chip whole on Backspace', async () => {
    const editor = await mount({ content: '<div data-formula>1 + price</div>', options: { language, fields } });

    press({ editor, key: 'Backspace' });

    expect(formulasOf(editor)).toEqual(['1 + ']);
  });
});

/** A host extension that sends the message on Enter, as a chat does. */
function sendOnEnter(send: () => boolean): Extension {
  return Extension.create({ name: 'sendOnEnter', addKeyboardShortcuts: () => ({ Enter: send }) });
}

/**
 * Mounts an editor of the content with the kit after the host's extensions, its caret at the end of the first formula,
 * and waits for the chips the plugins show once the editor is set up.
 */
async function mount({ content, options, extensions = [] }: { content: Content; options: FormulaOptions; extensions?: Extension[] }): Promise<Editor> {
  const element = document.createElement('div');

  document.body.append(element);

  const editor = new Editor({ element, extensions: [Document, Paragraph, Text, FormulaKit.configure(options), ...extensions], content });

  editors.push(editor);
  await Promise.resolve();

  const end = formulaEnds(editor)[0];

  if (end !== undefined) {
    editor.commands.setTextSelection(end);
  }

  return editor;
}

/** Presses a key as the editor's plugins see it, without what the browser would do on its own. */
function press({ editor, key }: { editor: Editor; key: string }): void {
  editor.view.focus();
  editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function formulaNodesOf(editor: Editor): { text: string; end: number }[] {
  const found: { text: string; end: number }[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'formula' || node.type.name === 'formulaBlock') {
      found.push({ text: node.textContent, end: pos + node.nodeSize - 1 });
    }
  });

  return found;
}

function formulasOf(editor: Editor): string[] {
  return formulaNodesOf(editor).map(({ text }) => text);
}

function formulaEnds(editor: Editor): number[] {
  return formulaNodesOf(editor).map(({ end }) => end);
}

/** The properties of a node spec that are data, leaving out how it is parsed and drawn. */
function schemaProperties(spec: NodeSpec): Partial<NodeSpec> {
  return Object.fromEntries(Object.entries(spec).filter(([key, value]) => key !== 'parseDOM' && typeof value !== 'function'));
}

/** The attributes of each field node in the JSON of a document. */
function fieldsIn(json: JSONContent): JSONContent['attrs'][] {
  const own = json.type === 'formulaField' ? [json.attrs] : [];

  return [...own, ...(json.content ?? []).flatMap(fieldsIn)];
}

function chipsOf(editor: Editor): (string | null)[] {
  return [...editor.view.dom.querySelectorAll('.pm-formula-field')].map(({ textContent }) => textContent);
}
