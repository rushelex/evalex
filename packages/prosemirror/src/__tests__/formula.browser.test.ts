import '../../style.css';

import type { FormulaField, FormulaTokenKind } from 'evalex/language';

import type { Node } from 'prosemirror-model';

import type { Transaction } from 'prosemirror-state';

import type { FormulaOptions } from '../formula-options';

import { it } from '@fast-check/vitest';
import { FormulaScope } from 'evalex';
import { FormulaLanguage } from 'evalex/language';

import { Schema } from 'prosemirror-model';
import { EditorState, NodeSelection, Plugin, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, vi } from 'vitest';

import { userEvent } from 'vitest/browser';

import { spacedFormulaArbitrary } from '~/testing-library/formula-text-arbitrary';

import { FormulaText } from '../formula-text';
import { formula, formulaNodes, refreshFormulas } from '../index';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0], parseDOM: [{ tag: 'p' }] },
    text: { group: 'inline' },
    ...formulaNodes,
  },
});

const language = new FormulaLanguage(new FormulaScope());

const line = { kind: 'Object', fields: [{ name: 'qty', label: 'Quantity', type: { kind: 'Number' } }] } as const;

const fields: readonly FormulaField[] = [
  { name: 'price', label: 'Price', type: { kind: 'Number' } },
  { name: 'qty', label: 'Quantity', type: { kind: 'Number' } },
  { name: 'due', type: { kind: 'Date' } },
  { name: 'lines', label: 'Lines', type: { kind: 'Array', items: line } },
];

// What the newlineInCode command of baseKeymap does on Enter, as a host's keymap runs it
const newlineInCode = new Plugin({
  props: {
    handleKeyDown: (view, event) => {
      const { $head, $anchor } = view.state.selection;

      if (event.key !== 'Enter' || !$head.parent.type.spec.code || !$head.sameParent($anchor)) {
        return false;
      }

      view.dispatch(view.state.tr.insertText('\n').scrollIntoView());

      return true;
    },
  },
});

const views: EditorView[] = [];

afterEach(() => {
  views.splice(0).forEach((view) => {
    view.dom.parentElement?.remove();
    view.destroy();
  });
});

describe(formula, () => {
  describe('highlighting', () => {
    it.prop([spacedFormulaArbitrary], { numRuns: 50 })('should mark each token of a formula with the class of its kind', async ({ tokens, formula: text }) => {
      const view = await mount({ blocks: [block(text)], options: { language } });

      expect(coloredText(view)).toEqual(tokens.flatMap(({ text: token, kind }) => (kind === 'invalid' ? [] : [[token, kind]])));
    });

    it('should leave the text from a syntax error on unmarked', async () => {
      const view = await mount({ blocks: [block('round(price, @ 1)')], options: { language } });

      expect(coloredText(view)).toEqual([['round', 'function'], ['(', 'punctuation'], ['price', 'name'], [',', 'punctuation']]);
    });

    it('should mark the tokens of every formula of the document and nothing outside them', async () => {
      const view = await mount({ blocks: [paragraph('Total 1 + ', inline('2 * 3'), ' now'), block('"a"')], options: { language } });

      expect(coloredText(view)).toEqual([['2', 'number'], ['*', 'operator'], ['3', 'number'], ['"a"', 'string']]);
    });

    it('should mark a formula again as it is edited', async () => {
      const view = await mount({ blocks: [block('price')], options: { language } });

      view.dispatch(view.state.tr.insertText('.round(2)', caretAt({ view, offset: 5 })));

      expect(coloredText(view).map(([, kind]) => kind)).toEqual(['name', 'punctuation', 'method', 'punctuation', 'number', 'punctuation']);
    });
  });

  describe('field chips', () => {
    it.each([
      { case: 'an inline formula', blocks: [paragraph('a ', inline('let p = price\nin p * qty'), ' b')] },
      { case: 'a block formula', blocks: [block('let p = price\nin p * qty')] },
    ])('should show the fields of each line of $case', async ({ blocks }) => {
      const view = await mount({ blocks, options: { language, fields } });

      expect([chipsOf(view), formulasOf(view)]).toEqual([['Price', 'Quantity'], ['let p = price\nin p * qty']]);
    });

    it('should show each field a formula reads by its label, keeping its name in the text', async () => {
      const view = await mount({ blocks: [block('price * qty + lines.first().qty()')], options: { language, fields } });

      expect([chipsOf(view), formulasOf(view)]).toEqual([['Price', 'Quantity', 'Lines', 'Quantity'], ['price * qty + lines.first().qty()']]);
    });

    it.each([
      { case: 'a name that is not a field', text: 'total * 2' },
      { case: 'a variable that hides a field', text: 'let price = 2 in price' },
      { case: 'a function or a method', text: 'round(2).abs()' },
    ])('should show $case as it is written', async ({ text }) => {
      const view = await mount({ blocks: [block(text)], options: { language, fields } });

      expect(chipsOf(view)).toEqual([]);
    });

    it('should show no chips when the host passes no fields', async () => {
      const view = await mount({ blocks: [block('price * qty')], options: { language } });

      expect(chipsOf(view)).toEqual([]);
    });

    it('should show the fields of each formula of the document, by the fields the host gives that formula', async () => {
      const view = await mount({
        blocks: [paragraph('Pay ', inline('price * qty'), ' by ', inline('due')), block('price')],
        options: { language, fields: ({ node }) => (node.type.name === 'formula' ? fields.slice(0, 2) : fields.slice(2)) },
      });

      expect(chipsOf(view)).toEqual(['Price', 'Quantity']);
    });

    it('should show the fields the host gives a formula now, once the document changes', async () => {
      let given: readonly FormulaField[] = [];
      const view = await mount({ blocks: [block('price'), block('1')], options: { language, fields: () => given } });

      given = fields;
      view.dispatch(view.state.tr.insertText('2', caretAt({ view, offset: 1, index: 1 })));

      expect(chipsOf(view)).toEqual(['Price']);
    });

    it('should show the fields the host gives now, once told to refresh the formulas', async () => {
      let given: readonly FormulaField[] = fields;
      const view = await mount({ blocks: [block('price * qty + total')], options: { language, fields: () => given } });

      given = [{ name: 'price', label: 'Cost' }, { name: 'total', label: 'Total' }];
      view.dispatch(refreshFormulas(view.state.tr));

      expect([chipsOf(view), formulasOf(view)]).toEqual([['Cost', 'Quantity', 'Total'], ['price * qty + total']]);
    });

    it('should keep a field the host no longer gives as a chip with its last label, marked as an error', async () => {
      let given: readonly FormulaField[] = fields;
      const view = await mount({ blocks: [block('price * qty')], options: { language, fields: () => given } });

      given = [{ name: 'qty', label: 'Quantity' }];
      view.dispatch(refreshFormulas(view.state.tr));

      expect([chipsOf(view), [...view.dom.querySelectorAll('.pm-formula-field.pm-formula-error')].map(({ textContent }) => textContent)]).toEqual([['Price', 'Quantity'], ['Price']]);
    });

    it('should keep a refresh of the formulas and the chips it changes out of the undo history', async () => {
      const record: Transaction[] = [];
      let given: readonly FormulaField[] = [];
      const view = await mount({ blocks: [block('price')], options: { language, fields: () => given }, record });

      record.splice(0);
      given = fields;
      view.dispatch(refreshFormulas(view.state.tr));

      expect([chipsOf(view), record.map((transaction) => transaction.getMeta('addToHistory') !== false)]).toEqual([['Price'], [false, false]]);
    });

    it('should keep the word being typed as text, and show it as a chip once the author types on', async () => {
      const view = await mount({ blocks: [block('')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('qty');

      expect(chipsOf(view)).toEqual([]);

      await userEvent.keyboard(' ');

      expect([chipsOf(view), formulasOf(view)]).toEqual([['Quantity'], ['qty ']]);
    });

    it('should show the word being typed as a chip once the caret leaves it', async () => {
      const view = await mount({ blocks: [block(' + 1')], options: { language, fields }, offset: 0 });

      view.focus();
      await userEvent.keyboard('qty');
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, caretAt({ view, offset: 7 }))));

      expect(chipsOf(view)).toEqual(['Quantity']);
    });

    it('should not show a chip for a field on the way to a longer name', async () => {
      const view = await mount({ blocks: [block(' + 1')], options: { language, fields }, offset: 0 });

      view.focus();
      await userEvent.keyboard('qtyT');
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, caretAt({ view, offset: 0 }))));

      expect([chipsOf(view), formulasOf(view)]).toEqual([[], ['qtyT + 1']]);
    });

    it('should show the word being typed as a chip when the editor loses focus', async () => {
      const view = await mount({ blocks: [block('')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('price');
      view.dom.blur();

      await vi.waitFor(() => expect(chipsOf(view)).toEqual(['Price']));
    });

    it('should copy a chip as the name of its field', async () => {
      const view = await mount({ blocks: [block('price * qty')], options: { language, fields } });
      const clipboardData = new DataTransfer();
      const [formulaText] = FormulaText.all(view.state.doc);

      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, formulaText.from, formulaText.to)));
      view.focus();
      view.dom.dispatchEvent(new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true }));

      expect(clipboardData.getData('text/plain')).toBe('price * qty');
    });

    it('should keep text of several lines pasted into an inline formula in it', async () => {
      const view = await mount({ blocks: [paragraph('a ', inline('1 + '), ' b')], options: { language } });
      const clipboardData = new DataTransfer();

      clipboardData.setData('text/plain', 'let x = 2\nin x * 3');
      clipboardData.setData('text/html', '<p>let x = 2</p><p>in x * 3</p>');
      view.focus();
      view.dom.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));

      expect([formulasOf(view), view.state.doc.childCount]).toEqual([['1 + let x = 2\nin x * 3'], 1]);
    });

    it('should show a pasted field as a chip at once', async () => {
      const view = await mount({ blocks: [block('1 + ')], options: { language, fields } });
      const clipboardData = new DataTransfer();

      clipboardData.setData('text/plain', 'price');
      view.focus();
      view.dom.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));

      expect([formulasOf(view), chipsOf(view)]).toEqual([['1 + price'], ['Price']]);
    });

    it('should turn a chip back into its name when it stops being a field', async () => {
      const view = await mount({ blocks: [block('price')], options: { language, fields } });

      view.dispatch(view.state.tr.insertText('let price = 2 in ', caretAt({ view, offset: 0 })));

      expect([chipsOf(view), formulasOf(view)]).toEqual([[], ['let price = 2 in price']]);
    });

    it('should turn a chip into text when a name typed next to it makes a longer one', async () => {
      const view = await mount({ blocks: [block('price')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('x');

      expect([chipsOf(view), formulasOf(view)]).toEqual([[], ['pricex']]);
    });

    it('should show the labels of the fields the plugins are reconfigured with', async () => {
      const view = await mount({ blocks: [block('price')], options: { language, fields } });

      view.updateState(view.state.reconfigure({ plugins: formula({ language, fields: [{ name: 'price', label: 'Unit price' }] }) }));

      await vi.waitFor(() => expect(chipsOf(view)).toEqual(['Unit price']));
    });

    it('should turn the chips back into names when the plugins are reconfigured without fields', async () => {
      const view = await mount({ blocks: [block('price * qty')], options: { language, fields } });

      view.updateState(view.state.reconfigure({ plugins: formula({ language }) }));

      await vi.waitFor(() => expect([chipsOf(view), formulasOf(view)]).toEqual([[], ['price * qty']]));
    });

    it('should keep chips out of the undo history', async () => {
      const recorded: Transaction[] = [];
      const view = await mount({ blocks: [block('')], options: { language, fields }, record: recorded });

      view.focus();
      await userEvent.keyboard('price ');

      // Six characters typed, then the name turned into a chip
      expect(recorded.filter(({ docChanged }) => docChanged).map((transaction) => transaction.getMeta('addToHistory') !== false)).toEqual([true, true, true, true, true, true, false]);
    });
  });

  describe('errors', () => {
    it('should underline each error of a formula a moment after it is edited', async () => {
      const view = await mount({ blocks: [block('round(price,, 2) + max(1 2)')], options: { language, fields } });

      expect(await underlinesOf(view)).toEqual([',', '(1']);
    });

    it('should check the names of a formula against the fields', async () => {
      const view = await mount({ blocks: [block('price * total')], options: { language, fields } });

      expect(await underlinesOf(view)).toEqual(['total']);
    });

    it('should check the names against the fields the host gives now at once, once told to refresh the formulas', async () => {
      let given: readonly FormulaField[] = fields;
      const view = await mount({ blocks: [block('price * total + qty')], options: { language, fields: () => given } });

      await underlinesOf(view);
      given = [{ name: 'price' }, { name: 'total' }];
      view.dispatch(refreshFormulas(view.state.tr));

      expect([...view.dom.querySelectorAll('.pm-formula-error')].map(({ textContent }) => textContent)).toEqual(['Quantity']);
    });

    it('should mark an error where nothing is there to underline', async () => {
      const view = await mount({ blocks: [block('1 +')], options: { language } });

      await vi.waitFor(() => expect(view.dom.querySelectorAll('.pm-formula-error-point')).toHaveLength(1));
    });

    it('should underline the errors of every formula of the document', async () => {
      const view = await mount({ blocks: [paragraph('a ', inline('totl'), ' b'), block('price * qtty')], options: { language, fields } });

      expect(await underlinesOf(view)).toEqual(['totl', 'qtty']);
    });

    it('should tell the message of an error under the pointer, worded as the host does', async () => {
      const view = await mount({ blocks: [block('price * total')], options: { language, fields, message: ({ messageKey }) => messageKey } });

      await underlinesOf(view);

      expect((await hoverAt({ view, offset: 9 })).querySelector('.pm-formula-diagnostic')?.textContent).toBe('formula_error.variable_not_defined');
    });

    it('should fix a misspelled name with each name close to it', async () => {
      const view = await mount({ blocks: [block('price * qtty')], options: { language, fields } });

      await underlinesOf(view);
      await fix({ view, offset: 9, label: 'Quantity' });

      expect([formulasOf(view), chipsOf(view)]).toEqual([['price * qty'], ['Price', 'Quantity']]);
    });

    it('should fix a misspelled function with its name, keeping the call', async () => {
      const view = await mount({ blocks: [block('rond(price)')], options: { language, fields } });

      await underlinesOf(view);
      await fix({ view, offset: 2, label: 'round' });

      expect([formulasOf(view), view.state.selection.head]).toEqual([['round(price)'], caretAt({ view, offset: 5 })]);
    });
  });

  describe('completion', () => {
    it('should open the list as a name is typed and complete a function with its call, the caret between the parentheses', async () => {
      const view = await mount({ blocks: [block('')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('rou');
      await listOf(view);
      await userEvent.keyboard('{Enter}');

      expect([formulasOf(view), view.state.selection.head]).toEqual([['round()'], caretAt({ view, offset: 6 })]);
    });

    it('should list a field by its label and insert it as a chip', async () => {
      const view = await mount({ blocks: [block('')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('Quan');

      expect((await listOf(view))[0]).toBe('Quantity qty');

      await userEvent.keyboard('{Tab}');

      expect([formulasOf(view), chipsOf(view), listShown()]).toEqual([['qty'], ['Quantity'], false]);
    });

    it('should list first the options whose label starts with the typed text, then whose name does, then whose label holds it', async () => {
      const view = await mount({
        blocks: [block('')],
        options: { language, fields: [{ name: 'x', label: 'Has pre' }, { name: 'y', label: 'Other' }, { name: 'pre', label: 'Zed' }, { name: 'zed', label: 'Pre total' }] },
      });

      view.focus();
      await userEvent.keyboard('pre');

      expect((await listOf(view)).filter((option) => !option.startsWith('pre'))).toEqual(['Pre total zed', 'Zed pre', 'Has pre x']);
    });

    it('should list a method of one name once, with the description of each of its kinds', async () => {
      const view = await mount({ blocks: [block('x')], options: { language } });

      view.focus();
      await userEvent.keyboard('.ad');

      expect((await listOf(view)).filter((option) => option === 'add')).toHaveLength(1);
      await vi.waitFor(() => expect(view.dom.ownerDocument.querySelector('.pm-formula-completion-info')?.textContent).toContain('\n'));
    });

    it('should list only the methods of the type of the value before the dot', async () => {
      const view = await mount({ blocks: [block('due')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('.');

      const options = await listOf(view);

      expect([options.includes('year'), options.includes('upper')]).toEqual([true, false]);
    });

    it('should not open the list after a space is typed', async () => {
      const view = await mount({ blocks: [block('price +')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard(' ');
      await settle();

      expect(listShown()).toBe(false);
    });

    it('should open the list on Ctrl-Space', async () => {
      const view = await mount({ blocks: [block('price + ')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('{Control>} {/Control}');

      expect(await listOf(view)).toContain('Quantity qty');
    });

    it('should move through the list with the arrows and insert the option picked', async () => {
      const view = await mount({ blocks: [block('')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('q');

      const [, second] = await listOf(view);

      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}');

      expect(formulasOf(view)[0]).toBe(language.complete('q', 1, { fields })?.items.find(({ label }) => label === second)?.text);
    });

    it('should insert the option clicked', async () => {
      const view = await mount({ blocks: [block('')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('Pri');
      await listOf(view);
      await userEvent.click(document.querySelector('.pm-formula-completion')!);

      expect(formulasOf(view)).toEqual(['price']);
    });

    it.each([
      { case: 'on Escape', act: async (): Promise<void> => userEvent.keyboard('{Escape}') },
      { case: 'when the caret leaves the word', act: async (view: EditorView): Promise<void> => {
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, caretAt({ view, offset: 0 }))));
      } },
      { case: 'when the editor loses focus', act: async (view: EditorView): Promise<void> => view.dom.blur() },
    ])('should close the list $case', async ({ act }) => {
      const view = await mount({ blocks: [block('1 + ')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('pri');
      await listOf(view);
      await act(view);

      await vi.waitFor(() => expect(listShown()).toBe(false));
      expect(formulasOf(view)).toEqual(['1 + pri']);
    });

    it('should open the list below the caret on the line of a long inline formula it wrapped to', async () => {
      const view = await mount({ blocks: [paragraph('Total is ', inline('round(price * qty * 1.2, 2) + round(price * 0.5, 2) + qty'), ' today')], options: { language, fields }, width: 260 });

      view.focus();
      await userEvent.keyboard(' + pri');
      await listOf(view);

      const lines = view.dom.querySelector('span.pm-formula')?.getClientRects().length;
      const gap = document.querySelector('.pm-formula-completions')!.getBoundingClientRect().top - view.coordsAtPos(view.state.selection.head).bottom;

      expect([(lines ?? 0) > 1, Math.round(gap)]).toEqual([true, 0]);
    });

    it('should complete in an inline formula among the text of the document', async () => {
      const view = await mount({ blocks: [paragraph('Total: ', inline(''), ' today')], options: { language, fields } });

      view.focus();
      await userEvent.keyboard('Pri');
      await listOf(view);
      await userEvent.keyboard('{Enter}');

      expect([view.state.doc.textContent, chipsOf(view)]).toEqual(['Total: price today', ['Price']]);
    });
  });

  describe('signature help', () => {
    it('should show the arguments of the call around the caret, the one being typed marked', async () => {
      const view = await mount({ blocks: [block('round(price, ')], options: { language, fields } });

      view.focus();

      expect(await signatureHelpOf()).toEqual({ signatures: ['round(number, [places]): Number'], active: ['[places]'], descriptions: [expect.any(String)] });
    });

    it('should follow the caret to the next argument', async () => {
      const view = await mount({ blocks: [block('round(price')], options: { language, fields } });

      view.focus();
      await signatureHelpOf();
      await userEvent.keyboard(', ');

      await vi.waitFor(() => expect(document.querySelector('.pm-formula-argument-active')?.textContent).toBe('[places]'));
    });

    it('should hide when the caret leaves the call', async () => {
      const view = await mount({ blocks: [block('round(price, 2) + 1')], options: { language, fields }, offset: 13 });

      view.focus();
      await signatureHelpOf();
      await userEvent.keyboard('{End}');

      await vi.waitFor(() => expect(document.querySelector('.pm-formula-signature-help')).toBeNull());
    });

    it('should hide while the editor does not have focus', async () => {
      const view = await mount({ blocks: [block('round(price, ')], options: { language, fields } });

      view.focus();
      await signatureHelpOf();
      view.dom.blur();

      await vi.waitFor(() => expect(document.querySelector('.pm-formula-signature-help')).toBeNull());
    });
  });

  describe('hover', () => {
    it.each([
      { text: 'price * 2', offset: 2, expected: 'Price · price: Number' },
      { text: 'lines.length()', offset: 2, expected: 'Lines · lines: Array<{ qty: Number }>' },
      { text: 'let rate = 2 in rate * 3', offset: 17, expected: 'rate: Number' },
      { text: 'lines.first().qty()', offset: 15, expected: 'Quantity · qty: Number' },
    ])('should tell a name its label and the type of its value: $text at $offset', async ({ text, offset, expected }) => {
      const view = await mount({ blocks: [block(text)], options: { language, fields } });

      expect((await hoverAt({ view, offset })).querySelector('.pm-formula-name')?.textContent).toBe(expected);
    });

    it('should tell a call the argument lists and the description of what it runs', async () => {
      const view = await mount({ blocks: [block('lines.first()')], options: { language, fields } });
      const tooltip = await hoverAt({ view, offset: 8 });

      expect([...tooltip.querySelectorAll('.pm-formula-signature')].map(({ textContent }) => textContent)).toEqual(['Array<T>.first(): T | Null']);
    });

    it('should tell nothing over an operator', async () => {
      const view = await mount({ blocks: [block('price * 2')], options: { language, fields } });

      await expect(hoverAt({ view, offset: 6 })).rejects.toThrow();
    });
  });

  describe('keys', () => {
    // The keys are pressed without what the browser does on its own, which differs from one browser to another
    it('should step the caret over a chip', async () => {
      const view = await mount({ blocks: [block('1 + price + 2')], options: { language, fields }, offset: 4 });
      const chip = caretAt({ view, offset: 4 });

      press({ view, key: 'ArrowRight' });
      const right = view.state.selection;

      press({ view, key: 'ArrowLeft' });

      expect([right.empty, right.head, view.state.selection.empty, view.state.selection.head]).toEqual([true, chip + 1, true, chip]);
    });

    it.each([
      { key: 'Backspace', offset: 9 },
      { key: 'Delete', offset: 4 },
    ])('should delete a chip whole on $key', async ({ key, offset }) => {
      const view = await mount({ blocks: [block('1 + price + 2')], options: { language, fields }, offset });

      press({ view, key });

      expect(formulasOf(view)).toEqual(['1 +  + 2']);
    });

    it('should delete a selected chip', async () => {
      const view = await mount({ blocks: [block('1 + price')], options: { language, fields } });

      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, caretAt({ view, offset: 4 }))));
      view.focus();
      await userEvent.keyboard('{Backspace}');

      expect(formulasOf(view)).toEqual(['1 + ']);
    });

    it('should stop the caret outside and then inside each edge of an inline formula', async () => {
      // `ab` takes positions 1 to 3, the formula opens at 3, holds `1` from 4 to 5 and closes before 6
      const view = await mount({ blocks: [paragraph('ab', inline('1'), 'cd')], options: { language }, offset: 0 });
      const stops: number[] = [];

      view.focus();

      for (const key of ['{ArrowLeft}', '{ArrowRight}', '{ArrowRight}', '{ArrowRight}', '{ArrowLeft}']) {
        await userEvent.keyboard(key);
        stops.push(view.state.selection.head);
      }

      expect(stops).toEqual([3, 4, 5, 6, 5]);
    });

    it.each([
      { case: 'an inline formula', blocks: [paragraph('a ', inline('let x = 1'), ' b')] },
      { case: 'a block formula', blocks: [block('let x = 1')] },
    ])('should start a new line of $case with the newlineInCode command of the host on Enter', async ({ blocks }) => {
      const view = await mount({ blocks, options: { language }, keymap: [newlineInCode] });

      press({ view, key: 'Enter' });
      view.dispatch(view.state.tr.insertText('in x'));

      expect([formulasOf(view), view.state.doc.childCount]).toEqual([['let x = 1\nin x'], 1]);
    });

    it('should leave Enter in a formula to the host', async () => {
      const view = await mount({ blocks: [paragraph('a ', inline('1 + 2'), ' b')], options: { language } });

      expect(press({ view, key: 'Enter' })).toBe(true);
      expect(formulasOf(view)).toEqual(['1 + 2']);
    });

    it('should remove an empty inline formula on Backspace', async () => {
      const view = await mount({ blocks: [paragraph('ab', inline(''), 'cd')], options: { language } });

      press({ view, key: 'Backspace' });

      expect(view.state.doc.textContent).toBe('abcd');
      expect(formulasOf(view)).toEqual([]);
    });
  });
});

/** Presses a key as the plugins see it, without what the browser would do on its own; false when one handled it. */
function press({ view, key }: { view: EditorView; key: string }): boolean {
  view.focus();

  return view.dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/** The text of each underline once the errors show. */
async function underlinesOf(view: EditorView): Promise<(string | null)[]> {
  return vi.waitFor(() => {
    const found = [...view.dom.querySelectorAll('.pm-formula-error')].map(({ textContent }) => textContent);

    expect(found.length).toBeGreaterThan(0);

    return found;
  });
}

/** Moves the pointer over an offset of the first formula and waits for the hover tooltip; rejects when none shows. */
async function hoverAt({ view, offset }: { view: EditorView; offset: number }): Promise<Element> {
  const coords = view.coordsAtPos(caretAt({ view, offset }), 1);
  const x = coords.left + 1;
  const y = (coords.top + coords.bottom) / 2;

  (document.elementFromPoint(x, y) ?? view.dom).dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));

  return vi.waitFor(() => {
    const found = document.querySelector('.pm-formula-hover');

    expect(found).not.toBeNull();

    return found ?? view.dom;
  }, { timeout: 1500 });
}

async function fix({ view, offset, label }: { view: EditorView; offset: number; label: string }): Promise<void> {
  const tooltip = await hoverAt({ view, offset });
  const button = [...tooltip.querySelectorAll('.pm-formula-fix')].find(({ textContent }) => textContent === label);

  if (!(button instanceof HTMLElement)) {
    throw new TypeError(`No fix ${label}`);
  }

  await userEvent.click(button);
}

function listShown(): boolean {
  return document.querySelector('.pm-formula-completions') !== null;
}

/** The options of the open list, each as its label and the name of a field after it. */
async function listOf(view: EditorView): Promise<string[]> {
  return vi.waitFor(() => {
    const options = [...view.dom.ownerDocument.querySelectorAll('.pm-formula-completion')].map((option) => [...option.children].map(({ textContent }) => textContent).join(' '));

    expect(options.length).toBeGreaterThan(0);

    return options;
  });
}

async function signatureHelpOf(): Promise<{ signatures: (string | null)[]; active: (string | null)[]; descriptions: (string | null)[] }> {
  const tooltip = await vi.waitFor(() => {
    const found = document.querySelector('.pm-formula-signature-help');

    expect(found).not.toBeNull();

    return found;
  });
  const textsOf = (selector: string): (string | null)[] => [...(tooltip?.querySelectorAll(selector) ?? [])].map(({ textContent }) => textContent);

  return { signatures: textsOf('.pm-formula-signature'), active: textsOf('.pm-formula-argument-active'), descriptions: textsOf('.pm-formula-description') };
}

type Inline = string | Node;

function block(text: string): Node {
  return schema.node('formulaBlock', null, text ? schema.text(text) : undefined);
}

function inline(text: string): Node {
  return schema.node('formula', null, text ? schema.text(text) : undefined);
}

function paragraph(...content: Inline[]): Node {
  return schema.node('paragraph', null, content.map((part) => (typeof part === 'string' ? schema.text(part) : part)));
}

/**
 * Mounts an editor of the blocks with the formula plugins, its caret at `offset` of the first formula or at its end, and
 * waits for the chips the plugins show once the editor is set up.
 */
async function mount({ blocks, options, offset, record, width, keymap = [] }: { blocks: Node[]; options: FormulaOptions; offset?: number; record?: Transaction[]; width?: number; keymap?: Plugin[] }): Promise<EditorView> {
  const parent = document.createElement('div');

  parent.style.width = width === undefined ? '' : `${width}px`;

  document.body.append(parent);

  const view: EditorView = new EditorView(parent, {
    state: EditorState.create({ doc: schema.node('doc', null, blocks), plugins: [...formula(options), ...keymap] }),
    // Records the transactions the plugins append too, which do not pass through here
    dispatchTransaction: (transaction) => {
      const { state, transactions } = view.state.applyTransaction(transaction);

      record?.push(...transactions);
      view.updateState(state);
    },
  });

  views.push(view);
  await Promise.resolve();

  const [first] = FormulaText.all(view.state.doc);

  if (first) {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, offset === undefined ? first.to : first.posAt(offset))));
  }

  return view;
}

/** The document position of an offset in the text of a formula. */
function caretAt({ view, offset, index = 0 }: { view: EditorView; offset: number; index?: number }): number {
  const formulaText = FormulaText.all(view.state.doc)[index];

  if (!formulaText) {
    throw new Error(`No formula ${index}`);
  }

  return formulaText.posAt(offset);
}

/** The text of each formula of the document, fields written as their names. */
function formulasOf(view: EditorView): string[] {
  return FormulaText.all(view.state.doc).map(({ text }) => text);
}

function chipsOf(view: EditorView): (string | null)[] {
  return [...view.dom.querySelectorAll('.pm-formula-field')].map(({ textContent }) => textContent);
}

const KINDS = new Set<string>(['number', 'string', 'regexp', 'boolean', 'null', 'name', 'function', 'method', 'keyword', 'operator', 'punctuation', 'invalid'] satisfies FormulaTokenKind[]);

/** Each marked piece of formula text, with the kind its class names. */
function coloredText(view: EditorView): [string | null, string][] {
  return [...view.dom.querySelectorAll('.pm-formula [class^="pm-formula-"]')].flatMap((element) => {
    const kind = [...element.classList].map((name) => name.replace('pm-formula-', '')).find((name) => KINDS.has(name));

    return kind ? [[element.textContent, kind]] : [];
  });
}
