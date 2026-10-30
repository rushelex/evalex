import type { NodeSpec } from 'prosemirror-model';

/**
 * The nodes of a formula, to add to the schema of the document: `formula` stands inside a line of text,
 * `formulaBlock` on lines of its own, and `formulaField` is a field inside either, shown by its label.
 *
 * @remarks
 * A formula holds its text and its fields, without marks. Its `textContent` is the formula as evalex stores it: a field
 * reads as its name, so `round(«Price», 2)` is `round(price, 2)`. Both keep the line breaks of the formula.
 *
 * @example
 * ```ts
 * import { formulaNodes } from '@evalexjs/prosemirror';
 * import { Schema } from 'prosemirror-model';
 * import { schema as basic } from 'prosemirror-schema-basic';
 *
 * const schema = new Schema({ nodes: basic.spec.nodes.append(formulaNodes), marks: basic.spec.marks });
 * ```
 */
export const formulaNodes = {
  formula: {
    group: 'inline',
    inline: true,
    content: '(text | formulaField)*',
    marks: '',
    whitespace: 'pre',
    parseDOM: [{ tag: 'span[data-formula]', preserveWhitespace: 'full' }],
    toDOM: () => ['span', { 'class': 'pm-formula', 'data-formula': '' }, 0],
  },
  formulaBlock: {
    group: 'block',
    content: '(text | formulaField)*',
    marks: '',
    code: true,
    defining: true,
    whitespace: 'pre',
    parseDOM: [{ tag: 'div[data-formula]', preserveWhitespace: 'full' }],
    toDOM: () => ['div', { 'class': 'pm-formula pm-formula-block', 'data-formula': '' }, 0],
  },
  formulaField: {
    inline: true,
    atom: true,
    selectable: true,
    attrs: { name: { validate: 'string' }, label: { validate: 'string' } },
    leafText: (node) => String(node.attrs.name),
    parseDOM: [{
      tag: 'span[data-formula-field]',
      getAttrs: (dom) => ({ name: dom.dataset.formulaField, label: dom.textContent }),
    }],
    toDOM: (node) => ['span', { 'class': 'pm-formula-field', 'data-formula-field': String(node.attrs.name), 'contenteditable': 'false' }, String(node.attrs.label)],
  },
} satisfies Readonly<Record<string, NodeSpec>>;
