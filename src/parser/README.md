<div align="center">

# evalex / parser

**Turns formula text into an AST with exact source locations. No dependencies, no generated code.**

[Grammar](#grammar) · [Precedence](#operator-precedence) · [AST](#ast) · [Errors](#syntax-errors) · [Extending](#extending-the-grammar)

</div>

---

The parser is an internal module: `evalex` does not export it, and [`core`](../core/README.md) calls it through `Expression`. To inspect an AST from application code, use `new Expression(formula).parse()`.

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
| Number | `42`, `3.14`, `.5`, `1e3`, `2.5E-3` | `Literal` |
| Text | `"…"` or `'…'`; escapes `\n \t \r \b \f \v \\ \' \" \uXXXX` | `Literal` |
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

Whitespace, including line breaks, is allowed between any two tokens. Empty input parses to a `null` literal.

A member must be called: `user.name()` is valid, `user.name` is a syntax error. Object fields are exposed as methods by `core`, so this keeps one syntax for both.

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
| 7 | `==` `!=` `<` `<=` `>` `>=` `in` | Left |
| 9 | `+` `-` | Left |
| 11 | `*` `/` `%` | Left |
| 14 | `^` | Right: `2 ^ 3 ^ 2` is `2 ^ 9` |
| 17 | prefix `-` `!` `not` | — |

Prefix operators bind tighter than `^`, so `-2 ^ 2` is `(-2) ^ 2 = 4`. Method calls bind tighter than everything: `-items.sum()` negates the result of the call.

> [!NOTE]
> `in` is parsed but `core` does not evaluate it yet; using it fails with `RANGE_ERROR`.

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

`location` holds `start` and `end`, each with a zero-based `offset` and one-based `line` and `column`. In a method chain such as `a.b().c()`, every call and member node shares one span, from the start of `a` to the final closing parenthesis.

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

## Extending the grammar

- **New binary operator** — add a branch to `#peekOp` with its binding powers: equal `lbp` and `rbp` for left associativity, `rbp = lbp - 1` for right. Then handle the operator in `core`'s evaluator.
- **New literal or atom** — add a branch to `#parseAtom` keyed on its first character, and add that character to `#isExprStart` so binary operators know an operand can follow.
- **New node type** — add the interface to `ast.types.ts`, the class to `nodes.ts`, and a method to `IVisitor`; the compiler then lists every visitor that must handle it.

Tests live in [`parse.test.ts`](./parse.test.ts) and assert the full AST, locations included.
