<div align="center">

# evalex / parser

**Turns formula text into an AST with exact source locations. No dependencies, no generated code.**

[Grammar](#grammar) · [Precedence](#operator-precedence) · [AST](#ast) · [Errors](#syntax-errors) · [Extending](#extending-the-grammar)

</div>

---

The parser is an internal module: `evalex` does not export it, [`core`](../core/README.md) calls it through `FormulaScope` and the evaluator, and `evalex/language` reads its [tokens](#tokens).

It is a hand-written, scannerless [Pratt parser](https://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/) in a single file, [`grammar/parser.ts`](./grammar/parser.ts). Characters are read directly, without a separate tokenizer, and operator precedence is a table of numbers rather than a chain of grammar rules.

```ts
import { parse } from './parse';

parse('price * 2');
// {
//   type: 'BinaryExpression',
//   operator: '*',
//   left: { type: 'Identifier', name: 'price', … },
//   right: { type: 'Literal', value: 2, raw: '2', … },
//   location: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 9, line: 1, column: 10 } },
// }
```

## Grammar

| Construct | Syntax | Node |
| --- | --- | --- |
| Number | `42`, `3.14`, `.5`, `5.`, `1e3`, `2.5E-3` | `Literal` |
| Text | `"…"` or `'…'`; escapes `\n \t \r \b \f \v \0 \\ \' \" \xXX \uXXXX \u{X…}`, and a backslash before a line break continues the line. `\1`–`\9`, and `\0` before a digit, are errors, as in strict JavaScript | `Literal` |
| Keyword literal | `true`, `false`, `null`, `undefined` | `Literal` |
| Regular expression | `/pattern/flags` | `Literal` with a `RegExp` value |
| Identifier | Starts with a letter or `_`, continues with letters, digits or `_` | `Identifier` |
| List | `[a, b, c]` | `ArrayExpression` |
| Grouping | `(a + b)` | — |
| Function call | `name(a, b)` | `CallExpression` |
| Method call | `value.name(a, b)`, chainable | `CallExpression` over `MemberExpression` |
| Unary | `-a`, `!a`, `not a` | `UnaryExpression` |
| Binary | `a + b`, `a and b`, … | `BinaryExpression` |
| Ternary | `test ? a : b` | `ConditionalExpression` |
| Names | `let a = 1, b = a + 1 in a + b` | `LetExpression` |

Whitespace, including line breaks, is allowed between any two tokens. Empty input parses to a `null` literal.

A member must be called: `user.name()` is valid, `user.name` is a syntax error. Object fields are exposed as methods by `core`, so this keeps one syntax for both.

A dot after a number ends the number, as in JavaScript, unless a name follows it: `5.` and `5..round()` are the number 5, while `5.round()` and `5. round()` call `round` on 5. So `1.e3` is a call of `e3`, not the number 1000; write `1e3` or `1.0e3`.

### Names with `let`

`let` declares names for the expression after `in`. It can start any expression, so it also works as a call argument or inside a callback, and the body reaches as far as an expression can: `let a = 1 in a ? 2 : 3` has the whole conditional as its body.

- Each value sees the names declared before it, and the body sees them all. Reading a name in its own value or an earlier one is an error: `let a = b, b = 1 in a`. This holds even when an outer name or a host variable has the same name, as with `let` in JavaScript.
- A name cannot be declared twice in one `let`, and keywords, `let` and `const` are not names. An inner `let` may reuse an outer name and hides it until its body ends.
- A bare `in` inside a value or the body ends that part, so membership there goes in parentheses: `let found = (key in obj) in found`. Inside brackets, call arguments and the middle of `? :` it is the operator again. A bare `in` right after a body that no outer `let` can take is an error with this hint. `not in` cannot end a part, so it needs no parentheses: `let missing = key not in obj in missing`.
- `let` followed by a name starts a declaration. Otherwise it is an ordinary identifier, so `let + 1`, `let or x` and `let(x)` read a variable or function called `let`. `const` followed by a name is reserved and is an error.

### Regular expression literals

A `/` where an operand is expected starts a regex; after an operand it is division. `a / /b/` is `a` divided by the regex `/b/`.

The rules follow JavaScript: `/` inside a character class needs no escaping (`/[/a]/`), a literal cannot span lines, and the pattern must not be empty. Flags are validated before the pattern, so an invalid flag is reported at the flags and an invalid pattern at the whole literal.

## Operator precedence

From lowest to highest. The number is the binding power in [`#peekOp`](./grammar/parser.ts).

| Power | Operators | Associativity |
| --- | --- | --- |
| 1 | `? :` | Right |
| 3 | `or`, `\|\|` | Left |
| 5 | `and`, `&&` | Left |
| 7 | `==` `!=` `<` `<=` `>` `>=` `in` `not in` | Left |
| 9 | `+` `-` | Left |
| 11 | `*` `/` `%` | Left |
| 14 | `^` | Right: `2 ^ 3 ^ 2` is `2 ^ 9` |
| 17 | prefix `-` `!` `not` | — |

Prefix operators bind tighter than `^`, so `-2 ^ 2` is `(-2) ^ 2 = 4`. Method calls bind tighter than everything: `-items.sum()` negates the result of the call.

`not in` is one operator, whatever whitespace stands between its words: `x not in y`. Before an operand `not` stays a prefix, so `not x in y` is `(not x) in y`.

## AST

Every node carries `type` and `location`, and implements `accept(visitor)`. Types live in [`ast/ast.types.ts`](./ast/ast.types.ts), classes in [`grammar/nodes.ts`](./grammar/nodes.ts).

| Node | Fields |
| --- | --- |
| `Literal` | `value: string \| number \| boolean \| RegExp \| null \| undefined`, `raw` — the source text |
| `Identifier` | `name` |
| `UnaryExpression` | `operator`, `arg`, `prefix: true` |
| `BinaryExpression` | `operator`, `left`, `right` |
| `CallExpression` | `callee: Identifier \| MemberExpression`, `args` |
| `MemberExpression` | `object`, `property: Identifier`, `computed: false` |
| `ConditionalExpression` | `test`, `consequent`, `alternate` |
| `ArrayExpression` | `elements` |
| `LetExpression` | `declarations: { name: Identifier, value, location }[]`, `body` |

`location` holds `start` and `end`, each with a zero-based `offset` and one-based `line` and `column`. In a method chain such as `a.b().c()`, every node spans from the start of `a` to its own end: the call `a.b()` ends at its closing parenthesis, the member `a.b` at `b`. Parentheses make no node of their own: `(1 + 2)` is the sum at the offsets of `1 + 2`, while a node built around it covers them, so `(1 + 2) * 3` spans the whole text and `(a).f()` starts at the opening parenthesis.

### Visitors

Consumers walk the tree with `IVisitor<T>`, one method per node type. `core` implements two: the evaluator and the dependency extractor.

```ts
import type { AST } from '../parser';

class IdentifierCounter implements AST.IVisitor<number> {
  visitIdentifierNode = () => 1;
  visitLiteralNode = () => 0;
  visitBinaryExpressionNode = (node: AST.IBinaryExpressionNode) => node.left.accept(this) + node.right.accept(this);
  // …one method for each remaining node type
}
```

## Syntax errors

Invalid input throws the parser's `SyntaxError`, a subclass of the built-in one. Its `location` holds the span to highlight, and the message ends with the same span as `[start,end]` offsets:

| Input | Message |
| --- | --- |
| `1 +* 2` | `Expected end of input but "+" found. [2,3]` |
| `user.name` | `Expected function 'name()' to be called. [4,9]` |
| `"x".test(/[/)` | `Unterminated regular expression. [9,13]` |
| `/a/gg` | `Invalid regular expression flags "gg". [3,5]` |
| `"\u12"` | `Invalid Unicode escape sequence. [1,5]` |
| `"\xZ1"` | `Invalid hexadecimal escape sequence. [1,3]` |
| `"(a)\1"` | `Escape sequence \1 is not allowed; write \\1 for a backslash followed by 1. [4,6]` |
| 256 nested `(` around `1` | `Nested or chained more than 256 levels deep. [256,257]` |

A formula nests at most 256 levels, so parsing and evaluating it never overflows the stack. Each parenthesis, list, call, prefix operator and ternary branch around a part counts a level, and so does each operator of a chain like `a + b + c` or each call of `a.b().c()`.

## Tokens

`tokenize(text)` from [`grammar/parser.ts`](./grammar/parser.ts) parses the text and returns the tokens the parse read, each with a kind from [`ast/token.ts`](./ast/token.ts) and a location. There is no separate scanner: the parse position decides the kind, so the `/` of `a / /b/` is an operator and then a regular expression, and `let` is a keyword only where it starts a declaration.

- A token is recorded once it is fully read. A name becomes a `function` when a `(` follows it, before the arguments are read, so a call still being typed shows its name as a function.
- After a syntax error, the tokens that end before the error stay, and the rest of the text from the first character they leave uncovered is one `invalid` token. An error inside a token, such as bad regular expression flags, makes that whole token invalid.

## Extending the grammar

- **New binary operator** — add a branch to `#peekOp` with its binding powers: equal `lbp` and `rbp` for left associativity, `rbp = lbp - 1` for right. Then handle the operator in `core`'s evaluator.
- **New literal or atom** — add a branch to `#parseAtom` keyed on its first character, and add that character to `#isExprStart` so binary operators know an operand can follow. Emit its token once it is read.
- **New node type** — add the interface to `ast.types.ts`, the class to `nodes.ts`, and a method to `IVisitor`; the compiler then lists every visitor that must handle it.

Tests live in [`parse.test.ts`](./parse.test.ts) and assert the full AST, locations included.
