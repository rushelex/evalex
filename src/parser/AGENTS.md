# AGENTS.md — parser

- The parser is internal. Other code reaches it only through `core` and `language`; it is not exported from the package.
- Every piece of text the parser accepts becomes a token where it is read, so new syntax emits its tokens too.
- It stays hand-written and dependency-free. Don't introduce parser generators or tokenizer libraries.
- New syntax must not change the meaning of any formula that parses today. Where a character gets a second role, the parse position decides between the roles.
- Where formula syntax overlaps with JavaScript (numbers, strings, escapes, regular expressions), it behaves exactly like JavaScript. Users bring JavaScript intuition.
- Every node and every error carries an exact source location. An error points at the smallest span that explains it, so editors can underline it.
- Tests assert the whole AST, locations included, and every error message with its location.
