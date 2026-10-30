# @evalexjs/tiptap

A [Tiptap](https://tiptap.dev/) extension that puts [evalex](https://github.com/rushelex/evalex/tree/main/packages/evalex#readme) formulas into the editor: inside a line of text or on a line of their own, next to everything else the document holds. The formulas are the ones of [`@evalexjs/prosemirror`](https://github.com/rushelex/evalex/tree/main/packages/prosemirror#readme): as the author types, each formula is colored, its fields show by their labels, its errors are underlined with their messages, misspelled names get fixes, fields, functions and methods are completed, and tooltips show the arguments of a call and what a name stands for.

## Installation

```bash
pnpm add evalex @evalexjs/prosemirror @evalexjs/tiptap
```

The package works on the copies of evalex, the ProseMirror formulas and Tiptap the app already has, so they are peer dependencies: `evalex`, `@evalexjs/prosemirror` and `@tiptap/core`.

## Usage

Add `FormulaKit` to the extensions of the editor, configured with the options of [`@evalexjs/prosemirror`](https://github.com/rushelex/evalex/tree/main/packages/prosemirror#usage), and load its stylesheet:

```ts
import '@evalexjs/prosemirror/style.css';
import { FormulaKit } from '@evalexjs/tiptap';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { FormulaScope } from 'evalex';
import { FormulaLanguage } from 'evalex/language';

new Editor({
  element: document.querySelector('#editor'),
  extensions: [
    StarterKit,
    FormulaKit.configure({
      language: new FormulaLanguage(new FormulaScope()),
      fields: [
        { name: 'price', label: 'Price', type: { kind: 'Number' } },
        { name: 'qty', label: 'Quantity', type: { kind: 'Number' } },
      ],
    }),
  ],
  content: '<p>Total: <span data-formula>round(price * qty, 2)</span></p>',
});
```

The kit adds the `formula`, `formulaBlock` and `formulaField` nodes of `@evalexjs/prosemirror` to the schema. In HTML, an inline formula is `<span data-formula>`, a block one `<div data-formula>`, and a field `<span data-formula-field="price">Price</span>`; the JSON of the editor gives a field with its `name` and `label`, and `getText()` gives it by its name, so a formula reads there as evalex stores it.

The completion list and chips take the keys they handle in a formula ahead of the keyboard shortcuts of other extensions. Enter in a formula is left to the editor: its keymap starts a new line there, and an extension that sends a message on Enter sends it.

For fields that change while the editor is open, `fields` is a function that returns the current list, and the `refreshFormulas` command makes the formulas read it again once it changes:

```ts
let fields = [{ name: 'price', label: 'Price', type: { kind: 'Number' } }];
const editor = new Editor({ extensions: [StarterKit, FormulaKit.configure({ language, fields: () => fields })] });

// Later, when the fields of the host change
fields = [{ name: 'price', label: 'Cost', type: { kind: 'Number' } }];
editor.commands.refreshFormulas();
```

The language and the other options are fixed for the editor.

## License

[MIT](./LICENSE) © Aleksey Shelementev
