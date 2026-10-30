# @evalexjs/codemirror

A [CodeMirror 6](https://codemirror.net/) extension that makes an editor an editor of [evalex](https://github.com/rushelex/evalex/tree/main/packages/evalex#readme) formulas. As the author types, the formula is colored by the editor's theme, its errors are underlined with their messages, misspelled names get fixes, and fields, functions and methods are completed.

## Installation

```bash
pnpm add evalex @evalexjs/codemirror
```

The extension works on the copies of evalex and CodeMirror the app already has, so they are peer dependencies: `evalex`, `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/autocomplete`, `@codemirror/lint` and `@lezer/highlight`. An app that installs the `codemirror` package has all of the CodeMirror ones; npm and pnpm install the missing ones on their own.

## Usage

```ts
import { formula } from '@evalexjs/codemirror';
import { basicSetup, EditorView } from 'codemirror';
import { FormulaScope } from 'evalex';
import { FormulaLanguage } from 'evalex/language';

const language = new FormulaLanguage(new FormulaScope());

new EditorView({
  parent: document.querySelector('#formula')!,
  doc: 'round(price * qty, 2)',
  extensions: [
    basicSetup,
    formula({
      language,
      fields: [
        { name: 'price', label: 'Price', type: { kind: 'Number' } },
        { name: 'qty', label: 'Quantity', type: { kind: 'Number' } },
      ],
    }),
  ],
});
```

`formula` takes:

| Option | What it is |
| --- | --- |
| `language` | The `FormulaLanguage` of the scope the formula is evaluated in, with its functions and methods |
| `fields` | The fields the formula can read, with their labels and types. Without them, names are not checked and completion offers no fields |
| `message` | Gives the text shown for an error, such as a translation found by its `messageKey` and filled in from its `payload`. The English message by default |

### Colors

Tokens are colored by the highlight style of the editor, such as the one its theme brings, through the tags of `@lezer/highlight`:

| Token | Tag |
| --- | --- |
| Number, text, regular expression | `number`, `string`, `regexp` |
| `true` and `false`, `null` | `bool`, `null` |
| A name, such as a field or `current` | `variableName` |
| A function, a method | `function(variableName)`, `function(propertyName)` |
| `let` and its `in` | `keyword` |
| An operator, punctuation | `operator`, `punctuation` |

An editor without a highlight style shows the formula uncolored. The text after a syntax error is left uncolored: the error underline marks it.

### Completion

Fields are listed by their labels and inserted by their names: the author picks «Quantity», the formula gets `qty`. After a dot, the list holds the fields of a record and the methods of the type of the value before the dot, as the types of the fields tell. A function or a method is inserted as a call, with the caret between the parentheses unless it takes no arguments. The list opens by itself as a name is typed, after a dot and inside quotes, where it offers the words a text argument takes.

### Changing the fields

The options are fixed for the extension. To change them, as when the formula moves to another cell, put the extension in a `Compartment` and reconfigure it:

```ts
import { Compartment } from '@codemirror/state';

const formulaOptions = new Compartment();
const view = new EditorView({ extensions: [basicSetup, formulaOptions.of(formula({ language, fields }))] });

view.dispatch({ effects: formulaOptions.reconfigure(formula({ language, fields: otherFields })) });
```

## License

[MIT](./LICENSE) © Aleksey Shelementev
