import type { FormulaOptions } from '@evalexjs/prosemirror';

import { formula, formulaNodes } from '@evalexjs/prosemirror';
import { Extension, Node } from '@tiptap/core';

const { formula: inlineSpec, formulaBlock: blockSpec, formulaField: fieldSpec } = formulaNodes;

const formulaNode = Node.create({
  name: 'formula',
  group: inlineSpec.group,
  inline: inlineSpec.inline,
  content: inlineSpec.content,
  marks: inlineSpec.marks,
  code: inlineSpec.code,
  parseHTML: () => inlineSpec.parseDOM,
  renderHTML: () => inlineSpec.toDOM(),
});

const formulaBlockNode = Node.create({
  name: 'formulaBlock',
  group: blockSpec.group,
  content: blockSpec.content,
  marks: blockSpec.marks,
  code: blockSpec.code,
  defining: blockSpec.defining,
  whitespace: blockSpec.whitespace,
  parseHTML: () => blockSpec.parseDOM,
  renderHTML: () => blockSpec.toDOM(),
});

const formulaFieldNode = Node.create({
  name: 'formulaField',
  inline: fieldSpec.inline,
  atom: fieldSpec.atom,
  selectable: fieldSpec.selectable,
  // The parse rule of the node reads both from the chip
  addAttributes: () => ({ name: { isRequired: true, validate: 'string' }, label: { isRequired: true, validate: 'string' } }),
  // Tiptap builds no `leafText` of its own, and the formula text the plugins read is the `textContent` of the formula
  extendNodeSchema: (extension) => (extension.name === 'formulaField' ? { leafText: fieldSpec.leafText } : {}),
  parseHTML: () => fieldSpec.parseDOM,
  renderHTML: ({ node }) => fieldSpec.toDOM(node),
  renderText: ({ node }) => fieldSpec.leafText(node),
});

/**
 * Makes a Tiptap editor an editor of evalex formulas: it adds the `formula`, `formulaBlock` and `formulaField` nodes to
 * the schema, and makes every formula colored, its errors underlined with fixes for misspelled names, its fields shown
 * as chips by their labels, with completion, the arguments of a call and what a name stands for as the author types.
 *
 * @remarks
 * The nodes and their behavior are the ones of `@evalexjs/prosemirror`, so its stylesheet styles them and its options
 * configure the kit. The kit goes before the keyboard shortcuts of other extensions, so the completion list and chips
 * take the keys they handle in a formula, and Enter in a formula is left to the editor, which starts a new line there.
 *
 * The options are fixed for the editor: to change the fields, create the editor again with the kit configured anew.
 *
 * @example
 * ```ts
 * import '@evalexjs/prosemirror/style.css';
 * import { FormulaKit } from '@evalexjs/tiptap';
 * import { Editor } from '@tiptap/core';
 * import StarterKit from '@tiptap/starter-kit';
 * import { FormulaScope } from 'evalex';
 * import { FormulaLanguage } from 'evalex/language';
 *
 * new Editor({
 *   element: document.querySelector('#editor'),
 *   extensions: [
 *     StarterKit,
 *     FormulaKit.configure({
 *       language: new FormulaLanguage(new FormulaScope()),
 *       fields: [{ name: 'price', label: 'Price', type: { kind: 'Number' } }],
 *     }),
 *   ],
 *   content: '<p>Total: <span data-formula>round(price * 1.2, 2)</span></p>',
 * });
 * ```
 */
export const FormulaKit = Extension.create<FormulaOptions, Record<string, never>>({
  name: 'formulaKit',
  // Tiptap runs the plugins of a higher priority first, and keyboard shortcuts are plugins too
  priority: 1000,
  addExtensions: () => [formulaNode, formulaBlockNode, formulaFieldNode],
  addProseMirrorPlugins() {
    return formula(this.options);
  },
});
