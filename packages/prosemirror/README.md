# @evalexjs/prosemirror

[ProseMirror](https://prosemirror.net/) nodes and plugins that put [evalex](https://github.com/rushelex/evalex/tree/main/packages/evalex#readme) formulas into a document: inside a line of text or on a line of their own, next to the paragraphs, mentions and anything else the document holds. As the author types, each formula is colored, its fields show by their labels, its errors are underlined with their messages, misspelled names get fixes, fields, functions and methods are completed, and tooltips show the arguments of a call and what a name stands for.

## Installation

```bash
pnpm add evalex @evalexjs/prosemirror
```

The package works on the copies of evalex and ProseMirror the app already has, so they are peer dependencies: `evalex`, `prosemirror-model`, `prosemirror-state` and `prosemirror-view`.

## Usage

Add the formula nodes to the schema of the document and the plugins to its state, before the keymaps, and load the stylesheet:

```ts
import { formula, formulaNodes } from '@evalexjs/prosemirror';
import { FormulaScope } from 'evalex';
import { FormulaLanguage } from 'evalex/language';
import { baseKeymap } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { Schema } from 'prosemirror-model';
import { schema as basic } from 'prosemirror-schema-basic';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import '@evalexjs/prosemirror/style.css';

const schema = new Schema({ nodes: basic.spec.nodes.append(formulaNodes), marks: basic.spec.marks });
const language = new FormulaLanguage(new FormulaScope());

const plugins = [
  ...formula({
    language,
    fields: [
      { name: 'price', label: 'Price', type: { kind: 'Number' } },
      { name: 'qty', label: 'Quantity', type: { kind: 'Number' } },
    ],
  }),
  keymap(baseKeymap),
];

const doc = schema.node('doc', null, [
  schema.node('paragraph', null, [schema.text('Total: '), schema.node('formula', null, schema.text('round(price * qty, 2)'))]),
]);

new EditorView(document.querySelector('#editor'), { state: EditorState.create({ doc, plugins }) });
```

`formulaNodes` holds three nodes:

| Node | What it is |
| --- | --- |
| `formula` | A formula inside a line of text |
| `formulaBlock` | A formula on lines of its own |
| `formulaField` | A field inside a formula, shown by its label |

The `textContent` of a formula node is the formula as evalex reads it, so that is what the host stores and evaluates: a field reads as its name, `round(«Price» * «Quantity», 2)` as `round(price * qty, 2)`. A formula holds text and fields, without marks. For an editor of one formula, give the schema a `doc` of one `formulaBlock`.

`formula` takes:

| Option | What it is |
| --- | --- |
| `language` | The `FormulaLanguage` of the scope the formulas are evaluated in, with its functions and methods |
| `fields` | The fields a formula can read, with their labels and types: one list for every formula, or a function that gives the list for a formula node at its position, such as by an attribute the host adds to the node. Without them, names are not checked, completion offers no fields and there are no chips |
| `message` | Gives the text shown for an error, such as a translation found by its `messageKey` and filled in from its `payload`. The English message by default |

A function for `fields` that returns the same list for the same formula lets the plugins reuse what they found in it; a formula is read again once its node changes or its list does.

### Fields as chips

Each field a formula reads is a `formulaField` node, shown as a chip with its label, while the text of the formula keeps its name: the author sees «Price», the formula stores `price`, and copying it as text copies `price`. The arrows step over a chip, and Backspace and Delete remove it whole. A field of a record read by a method name, as `qty` in `lines.first().qty()`, is a chip too. A name that is not a field and a variable that hides one stay text, and a chip whose name stops being a field, as when a `let` declares it or a name typed next to it makes a longer one, turns back into text. A field the host no longer gives stays a chip with its last label, marked as an error, so the author still sees what the formula read and Backspace removes it whole.

The word being typed stays text until the caret leaves it or the editor loses focus, so `qty` on the way to `qtyTotal` never turns into «Quantity». A field inserted by completion, a fix or a paste is a chip at once. A document made from text shows its fields as chips as soon as the editor is set up. Turning names into chips and back stays out of the undo history.

### Lines

Both formulas are code to the editor, as a code block is: they keep line breaks, as a formula with `let` often has, and take a paste as plain text, so text of several lines pasted into an inline formula stays in it. What Enter does is the host's choice: the `newlineInCode` command of `baseKeymap` starts a new line in a formula, and an editor where Enter sends a message puts its own command first. A long inline formula wraps with the text around it.

The caret stops twice at each edge of an inline formula, once outside and once inside, and the padding the stylesheet gives the formula tells the two apart on screen. Backspace in an empty inline formula removes it.

### Colors and errors

Each token carries the class of its kind: `pm-formula-number`, `pm-formula-string`, `pm-formula-regexp`, `pm-formula-boolean`, `pm-formula-null`, `pm-formula-name`, `pm-formula-function`, `pm-formula-method`, `pm-formula-keyword`, `pm-formula-operator` and `pm-formula-punctuation`. The text after a syntax error has none: the error underline marks it.

Errors show half a second after the author stops typing, as `pm-formula-error`, or as a `pm-formula-error-point` mark where there is nothing to underline, as after `1 +`. Hovering over an error tells its message, with a button for each name spelled like a name the formula cannot read, and so does the caret inside an error while the editor has focus, below the line, so an author who moves by the keyboard reads it too. For assistive technology, an underlined error is `aria-invalid` and described by its message through `aria-describedby`, and a formula with an error that has nothing to underline is described by that message; the messages live in a hidden element in the body of the page.

### Completion

The list opens below the caret as a name is typed, after a dot and inside quotes, and on Ctrl-Space. ↑ and ↓ move through it, Enter and Tab insert the option, a click inserts the one clicked, and Escape closes it. Fields are listed by their labels and inserted by their names. Options whose label starts with the typed text come first, then the ones whose name does, then the ones whose label holds it. After a dot, the list holds the fields of a record and the methods of the type of the value before the dot, as the types of the fields tell. A function or a method is inserted as a call, with the caret between the parentheses unless it takes no arguments. While the list is open, the editor tells assistive technology which list it controls and which option is selected, through `aria-controls` and `aria-activedescendant`, as a combobox does.

### Arguments and hover

While the editor has focus and the caret is inside a call, the argument lists of what the call runs show above the caret, with the argument being typed marked: `round(number, [places]): Number`. Brackets mark an optional argument, `…` one that repeats, and a method shows the type it is called on.

Hovering over a name tells what it stands for: a field with its label and type, such as `Price · price: Number`, a variable with its type, or the argument lists and descriptions of a function or method.

### Styles

`style.css` styles every part through `pm-formula-*` classes, which a theme overrides: `pm-formula` and `pm-formula-block` for the formulas, `pm-formula-field` for chips, `pm-formula-tooltip` for every tooltip, `pm-formula-completions`, `pm-formula-completion` and `pm-formula-completion-info` for the list, and `pm-formula-routines`, `pm-formula-signature`, `pm-formula-argument-active`, `pm-formula-description`, `pm-formula-name`, `pm-formula-diagnostic` and `pm-formula-fix` inside tooltips. Tooltips are placed in the body of the page, so no container of the editor clips them.

A theme changes the colors and the font through CSS variables, without overriding the classes:

| Variable | What it styles | Default |
| --- | --- | --- |
| `--pm-formula-number-color`, `--pm-formula-string-color`, `--pm-formula-regexp-color`, `--pm-formula-boolean-color`, `--pm-formula-null-color`, `--pm-formula-function-color`, `--pm-formula-method-color`, `--pm-formula-keyword-color`, `--pm-formula-operator-color`, `--pm-formula-punctuation-color`, `--pm-formula-name-color` | The tokens of each kind | Light-theme colors, and the color of the text for names |
| `--pm-formula-font-family` | Formulas, argument lists and the completion list | A monospace font |
| `--pm-formula-background` | Inline and block formulas | Translucent gray |
| `--pm-formula-field-background` | Chips | Translucent gray |
| `--pm-formula-error-color` | Error underlines and marks, the edge of a message and the text of a chip of a field the host no longer gives | Red |
| `--pm-formula-error-background` | A chip of a field the host no longer gives | Translucent red |
| `--pm-formula-tooltip-background`, `--pm-formula-tooltip-color`, `--pm-formula-tooltip-border-color` | Tooltips and the completion list | Light gray, near black, gray |
| `--pm-formula-selected-background`, `--pm-formula-selected-color` | The selected option of the list | Blue, white |
| `--pm-formula-fix-background`, `--pm-formula-fix-color` | Fix buttons | Dark gray, white |

The variables of the formulas apply wherever the theme sets them, such as on the editor. Tooltips and the list are in the body of the page, so their variables are set on `:root`:

```css
:root {
  --pm-formula-tooltip-background: #222;
  --pm-formula-tooltip-color: #eee;
}

.dark-editor {
  --pm-formula-number-color: #8c8;
  --pm-formula-background: rgba(255, 255, 255, 0.08);
}
```

### Changing the fields

For fields that change while the editor is open, `fields` is a function that returns the current list. Once the list changes, `refreshFormulas` marks a transaction that makes the formulas read it again: errors and chips follow the new list at once, and the transaction stays out of the undo history.

```ts
import { formula, refreshFormulas } from '@evalexjs/prosemirror';

let fields = [{ name: 'price', label: 'Price', type: { kind: 'Number' } }];
const plugins = [...formula({ language, fields: () => fields }), keymap(baseKeymap)];

// Later, when the fields of the host change
fields = [{ name: 'price', label: 'Cost', type: { kind: 'Number' } }];
view.dispatch(refreshFormulas(view.state.tr));
```

The language and the other options are fixed for the plugins. To change them, reconfigure the state with plugins made from new options:

```ts
view.updateState(view.state.reconfigure({ plugins: [...formula({ language: otherLanguage, fields }), keymap(baseKeymap)] }));
```

## License

[MIT](./LICENSE) © Aleksey Shelementev
