/* eslint-disable jsdoc/no-multi-asterisks */
import type { AstNode, ILetDeclaration, Location } from '../ast';
import type { FormulaToken, FormulaTokenKind } from '../ast/token';
import type { SyntaxErrorCode } from './syntax-error-code';
import type { SyntaxErrorPayloads } from './syntax-error-payloads';

import {
  ArrayExpressionNode,
  BinaryExpressionNode,
  CallExpressionNode,
  ConditionalExpressionNode,
  IdentifierNode,
  LetExpressionNode,
  LiteralNode,
  MemberExpressionNode,
  UnaryExpressionNode,
} from './nodes';
import { SyntaxError } from './syntax-error';

// ── Types ───────────────────────────────────────────────────────────────────

/** Snapshot of the scanner position used to build `Location` objects for AST nodes. */
interface Pos {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

/** Full scanner state used for save/restore (speculative parsing). */
interface State {
  readonly pos: number;
  readonly line: number;
  readonly column: number;
}

/** A token whose kind can still change: a name turns out to be a function once a `(` follows it. */
interface ScannedToken {
  kind: FormulaTokenKind;
  readonly location: Location;
}

/**
 * Operator descriptor returned by `peekOp()`.
 *
 * - `text`  — operator literal as it appears in the source (e.g. `"||"`, `"and"`)
 * - `lbp`   — left binding power: how strongly the operator binds to the left
 * - `rbp`   — right binding power: how strongly the operator binds to the right
 *
 * For left-associative operators `lbp === rbp` (e.g. `+` with bp=9).
 * For right-associative operators `rbp === lbp - 1` (e.g. `^` with lbp=14, rbp=13).
 */
interface OpInfo {
  readonly text: string;
  readonly lbp: number;
  readonly rbp: number;
}

/**
 * Intermediate representation of a call/member suffix collected during
 * postfix parsing. Suffixes are collected first and then reduced into
 * AST nodes so that every node in a chain like `obj.a().b()` shares
 * the same location span.
 */
type Suffix
  = | { readonly type: 'MemberCall'; readonly property: IdentifierNode; readonly args: AstNode[]; readonly end: Pos }
    | { readonly type: 'DirectCall'; readonly args: AstNode[]; readonly end: Pos };

/**
 * Names of one `let` while it is parsed, to reject a name used before its declaration.
 *
 * - `names` — each declared name with its position in the list
 * - `current` — position of the declaration whose value is being parsed; `Infinity` once the body starts
 * - `references` — names read while the list is open before this `let` declared them
 */
interface LetScope {
  readonly names: Map<string, number>;
  current: number;
  readonly references: { readonly name: string; readonly location: Location }[];
}

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * Operator precedence (binding power) table.
 *
 * Higher number = higher precedence = binds tighter.
 * The parser compares binding powers to decide whether to consume the next
 * operator or return the current sub-expression to the caller.
 *
 *
 *   ?:          bp = 1    ternary (lowest)
 *   ||  or      bp = 3    logical OR
 *   &&  and     bp = 5    logical AND
 *   == != < ..  bp = 7    comparison / equality
 *   +  -        bp = 9    additive
 *   *  /  %     bp = 11   multiplicative
 *   ^           bp = 14   power (right-associative, rbp = 13)
 *   -  !  not   bp = 17   prefix unary (highest)
 *
 *
 * To add a new operator: add one entry to `peekOp()` with the desired bp.
 * To change precedence: change the number. That's it.
 */
const PREFIX_BP = 17;

/**
 * How many levels a formula may nest, counting each operator of a chain and each call of a method chain as a level.
 *
 * @remarks
 * Parsing and evaluation recurse once per level, so without a bound a deep formula overflows the stack with a plain
 * `RangeError`. Nested calls cost the most stack and overflow Node's default stack at about 620 levels; 256 leaves
 * room for the stack the host already uses.
 */
const MAX_NESTING = 256;

const KEYWORDS = new Set([
  'null',
  'undefined',
  'true',
  'false',
  'or',
  'and',
  'not',
  'in',
]);

const HEX_DIGIT = /[\da-f]/i;

// ── Parser ──────────────────────────────────────────────────────────────────

/**
 * A Pratt parser (Top-Down Operator Precedence) for the formula language.
 *
 * ## What is a Pratt parser?
 *
 * A Pratt parser is a simple and elegant algorithm for parsing expressions
 * with operator precedence. Instead of creating one function per precedence
 * level (as in classic recursive descent), it uses a single loop that
 * consults a **binding power table** — a mapping from operators to numbers.
 *
 * The core loop (`parseExpr`) works as follows:
 * 1. Parse the left-hand side (a prefix operator or an atom) via `nud()`.
 * 2. While the next operator's binding power exceeds the current minimum,
 *    consume that operator and parse its right-hand side recursively.
 * 3. Return the accumulated expression.
 *
 * ## Key terminology
 *
 * - **Binding power (bp)** — a number that represents operator precedence.
 *   `*` has bp=11 while `+` has bp=9, so `1 + 2 * 3` parses as `1 + (2 * 3)`.
 * - **nud** (null denotation) — what to do when a token appears at the *start*
 *   of an expression. Handles prefix operators (`-x`, `!x`, `not x`) and atoms
 *   (numbers, strings, identifiers, parenthesized groups).
 * - **led** (left denotation) — what to do when a token appears *after* a left
 *   operand. Handles infix operators (`+`, `*`, `==`) and ternary (`? :`).
 *   In this implementation, `led` logic lives inside the `parseExpr` loop.
 *
 * ## Why Pratt over recursive descent?
 *
 * Precedence is encoded in **data** (numbers in `peekOp()`), not in **code**
 * (a chain of functions). Adding a new operator is one line; changing
 * precedence is changing one number. No risk of forgetting to wire functions.
 *
 * @see {@link https://tdop.github.io | Vaughan Pratt — Top Down Operator Precedence (1973)}
 */
class Parser {
  readonly #input: string;
  #pos = 0;
  #line = 1;
  #column = 1;
  // Inside the value or body of `let`, a bare `in` ends that part; brackets and parentheses lift this again.
  #noIn = false;
  readonly #letScopes: LetScope[] = [];
  // Levels of nesting around the current position, bounded by MAX_NESTING
  #depth = 0;
  // Tokens read so far, kept only when the caller asks for them
  readonly #tokens: ScannedToken[] | undefined;
  // Errors found so far, kept only when the caller asks the parse to go on past them
  readonly #diagnostics: SyntaxError[] | undefined;

  constructor(input: string, { collectTokens = false, recover = false }: { collectTokens?: boolean; recover?: boolean } = {}) {
    this.#input = input;
    this.#tokens = collectTokens ? [] : undefined;
    this.#diagnostics = recover ? [] : undefined;
  }

  // ── Entry point ─────────────────────────────────────────────────────────

  /**
   * Parses the entire input string and returns the root AST node.
   * Empty input is treated as `null`.
   */
  run(): AstNode {
    this.#skipWhitespace();
    if (this.#isEnd()) {
      const m = this.#mark();
      return new LiteralNode(null, 'null', this.#loc(m));
    }
    const expr = this.#parseExpr(0);
    this.#skipWhitespace();
    if (!this.#isEnd()) {
      const s = this.#mark();
      const ch = this.#advance();
      this.#fail('EXPECTED_END_OF_INPUT', { found: ch }, this.#loc(s));
    }
    return expr;
  }

  /**
   * Reads the input as `run` does and returns its tokens. After a syntax error they end with one `invalid` token from
   * the first text no token before the error covers to the end of the input, unless only whitespace is left.
   */
  tokens(): FormulaToken[] {
    const tokens = this.#tokens ?? [];

    try {
      this.run();

      return tokens;
    }
    catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }

      // Drops the tokens the error explains, such as the operator of `a + @b`, read before parsing backtracked
      const kept = tokens.filter((token) => token.location.end.offset <= error.location.start.offset);
      // An error may point inside a token it stopped, such as the flags of a regular expression.
      const { offset, line, column } = kept.at(-1)?.location.end ?? { offset: 0, line: 1, column: 1 };

      this.#restore({ pos: offset, line, column });
      this.#skipWhitespace();

      if (this.#isEnd()) {
        return kept;
      }

      const start = this.#mark();

      while (!this.#isEnd()) {
        this.#advance();
      }

      return [...kept, { kind: 'invalid', location: this.#loc(start) }];
    }
  }

  /**
   * Reads the input as `run` does, going on past the errors it can step over, and returns them in the order it finds
   * them. The first one is the error `run` throws.
   *
   * @remarks
   * An error inside a literal, such as a bad escape or bad flags, or a method that is not called, leaves the rest of the
   * formula readable as it is. Any other error inside a bracket skips to the next `,` or closing bracket at the same
   * level, so the next argument or element is read again. An error outside any bracket ends the reading.
   */
  diagnostics(): SyntaxError[] {
    const diagnostics = this.#diagnostics ?? [];

    try {
      this.run();
    }
    catch (error) {
      if (!isSyntaxError(error)) {
        throw error;
      }

      this.#record(error);
    }

    return diagnostics;
  }

  // ── Core Pratt loop ─────────────────────────────────────────────────────

  /**
   * The heart of the Pratt algorithm.
   *
   * Parses an expression whose operators must have binding power strictly
   * greater than `minBp`. This single parameter controls both precedence
   * and associativity:
   *
   * - For left-associative `+` (bp=9): the recursive call passes `rbp=9`,
   *   so a second `+` with `lbp=9` does NOT satisfy `9 > 9` and we stop,
   *   giving us left-to-right grouping: `(a + b) + c`.
   *
   * - For right-associative `^` (lbp=14, rbp=13): the recursive call passes
   *   `rbp=13`, so a second `^` with `lbp=14` satisfies `14 > 13` and we
   *   continue, giving us right-to-left grouping: `a ^ (b ^ c)`.
   *
   * @param minBp Minimum binding power — only operators with `lbp > minBp` are consumed.
   */
  #parseExpr(minBp: number): AstNode {
    // Nodes built here span from this start to the current position, not between their operands: parseGrouped()
    // returns `(1+2)` as the inner expression at [1,4], while `(1+2)*3` and `(1+2).f()` cover the parentheses.
    const ruleStart = this.#mark();
    const outerDepth = this.#depth;
    this.#nest(this.#nextCharLoc());

    // Step 1: parse prefix operator or atom (the "nud" phase)
    let left = this.#nud();
    left = this.#parseSuffixes(left, ruleStart);

    // Step 2: consume infix operators while they bind tighter than minBp
    while (true) {
      const saved = this.#save();
      this.#skipWhitespace();

      // Ternary operator `? :` has the lowest binding power (bp=1)
      if (this.#peek() === '?' && minBp < 1) {
        this.#consumePunctuation();
        this.#skipWhitespace();
        const consequent = this.#withNoIn(false, () => this.#parseExpr(0));
        this.#skipWhitespace();
        if (this.#peek() !== ':') {
          const m = this.#mark();
          this.#fail('MISSING_TOKEN', { expected: [':'] }, this.#loc(m));
        }
        this.#consumePunctuation();
        this.#skipWhitespace();
        const alternate = this.#parseExpr(0);
        left = new ConditionalExpressionNode(
          left,
          consequent,
          alternate,
          this.#loc(ruleStart),
        );
        continue;
      }

      // Binary operators — check if the next operator binds tighter
      const op = this.#peekOp();
      if (op && op.lbp > minBp) {
        const opStart = this.#mark();
        this.#consumeOp(op);
        const opLocation = this.#loc(opStart);
        this.#skipWhitespace();
        // If no valid expression follows the operator, backtrack.
        // This handles cases like trailing operators in partial input.
        if (!this.#isExprStart()) {
          this.#restore(saved);
          break;
        }
        const right = this.#parseExpr(op.rbp);
        // A chain like `a + b + c` nests its left side without recursing, so each operator counts a level
        this.#nest(opLocation);
        left = new BinaryExpressionNode(
          op.text,
          left,
          right,
          this.#loc(ruleStart),
        );
        left = this.#parseSuffixes(left, ruleStart);
        continue;
      }

      // No operator consumed — restore whitespace skip and exit
      this.#restore(saved);
      break;
    }
    this.#depth = outerDepth;
    return left;
  }

  // ── Prefix handling (nud) ───────────────────────────────────────────────

  /**
   * Handles the "null denotation" — tokens that appear at the start of an
   * expression. This includes prefix unary operators (`-`, `!`, `not`)
   * and atoms (numbers, strings, identifiers, etc.).
   */
  #nud(): AstNode {
    const s = this.#mark();
    if (this.#peek() === '-') {
      this.#advance();
      this.#emit('operator', s);
      this.#skipWhitespace();
      const arg = this.#parseExpr(PREFIX_BP);
      return new UnaryExpressionNode('-', arg, true, this.#loc(s));
    }
    if (this.#peek() === '!') {
      this.#advance();
      this.#emit('operator', s);
      this.#skipWhitespace();
      const arg = this.#parseExpr(PREFIX_BP);
      return new UnaryExpressionNode('!', arg, true, this.#loc(s));
    }
    if (this.#consumeKeyword('not', 'operator')) {
      this.#skipWhitespace();
      const arg = this.#parseExpr(PREFIX_BP);
      return new UnaryExpressionNode('not', arg, true, this.#loc(s));
    }
    if (this.#isDeclarationAhead('const')) {
      this.#consumeKeyword('const');
      this.#fail('RESERVED_CONST', {}, this.#loc(s));
    }
    if (this.#isDeclarationAhead('let')) {
      return this.#parseLet();
    }
    return this.#parseAtom();
  }

  // ── let ─────────────────────────────────────────────────────────────────

  /**
   * Parses `let a = 1, b = a + 1 in body`.
   *
   * Each value sees the names declared before it, and the body sees them all. A bare `in` inside a value
   * or the body ends that part, so membership there needs parentheses: `let found = (key in obj) in found`.
   */
  #parseLet(): LetExpressionNode {
    const start = this.#mark();
    const outerNoIn = this.#noIn;
    const scope: LetScope = { names: new Map(), current: 0, references: [] };
    const declarations: ILetDeclaration[] = [];

    this.#consumeKeyword('let', 'keyword');
    this.#letScopes.push(scope);

    try {
      do {
        this.#skipWhitespace();
        const name = this.#parseDeclaredName(scope);

        this.#skipWhitespace();

        if (this.#peek() !== '=' || this.#peekAt(1) === '=') {
          const m = this.#mark();
          this.#fail('MISSING_EQUALS', { name: name.name }, this.#loc(m));
        }

        const equals = this.#mark();
        this.#advance();
        this.#emit('operator', equals);
        this.#skipWhitespace();

        const value = this.#withNoIn(true, () => this.#parseExpr(0));

        declarations.push({ name, value, location: this.#loc(name.location.start) });
        this.#skipWhitespace();
      } while (this.#consumePunctuationChar(','));

      if (!this.#consumeKeyword('in', 'keyword')) {
        const m = this.#mark();
        this.#fail('MISSING_TOKEN', { expected: [',', 'in'] }, this.#loc(m));
      }

      this.#rejectForwardReferences(scope);
      scope.current = Number.POSITIVE_INFINITY;
      this.#skipWhitespace();

      const body = this.#withNoIn(true, () => this.#parseExpr(0));

      if (!outerNoIn) {
        this.#rejectBareIn();
      }

      return new LetExpressionNode(declarations, body, this.#loc(start));
    }
    finally {
      this.#letScopes.pop();
    }
  }

  /** Parses the name of a `let` declaration and adds it to the scope. */
  #parseDeclaredName(scope: LetScope): IdentifierNode {
    const s = this.#mark();

    if (!this.#isIdStart(this.#peek())) {
      this.#fail('EXPECTED_VARIABLE_NAME', {}, this.#loc(s));
    }

    const word = this.#readWord();
    const location = this.#loc(s);

    if (KEYWORDS.has(word) || word === 'let' || word === 'const') {
      this.#report(this.#error('RESERVED_VARIABLE_NAME', { name: word }, location));
    }
    else if (scope.names.has(word)) {
      this.#report(this.#error('DUPLICATE_VARIABLE', { name: word }, location));
    }

    scope.current = scope.names.size;
    scope.names.set(word, scope.current);
    this.#emit('name', s);

    return new IdentifierNode(word, location);
  }

  /** Checks a variable read against the open `let` lists: its own or a later declaration is not available yet. */
  #resolveReference(node: IdentifierNode): void {
    for (const scope of this.#letScopes.toReversed()) {
      const declaration = scope.names.get(node.name);

      if (declaration !== undefined && declaration < scope.current) {
        return;
      }

      if (declaration !== undefined) {
        this.#report(this.#error('VARIABLE_USED_BEFORE_DECLARATION', { name: node.name }, node.location));

        return;
      }

      scope.references.push({ name: node.name, location: node.location });
    }
  }

  /** Rejects a name that a value read before this `let` declared it. */
  #rejectForwardReferences(scope: LetScope): void {
    const early = scope.references.find(({ name }) => scope.names.has(name));

    if (early) {
      this.#report(this.#error('VARIABLE_USED_BEFORE_DECLARATION', { name: early.name }, early.location));
    }
  }

  /** Rejects `in` right after a `let` body, where no enclosing `let` list can take it. */
  #rejectBareIn(): void {
    const saved = this.#save();
    this.#skipWhitespace();

    if (this.#isKeywordAhead('in')) {
      const s = this.#mark();
      this.#consumeKeyword('in');
      // Read on, the `in` is the operator again, applied to the whole `let`
      this.#report(this.#error('BARE_IN_AFTER_LET', {}, this.#loc(s)));
    }

    this.#restore(saved);
  }

  /** Parses with `in` read as an operator or as the end of a `let` part, then restores the previous reading. */
  #withNoIn<T>(noIn: boolean, parse: () => T): T {
    const outer = this.#noIn;
    this.#noIn = noIn;

    try {
      return parse();
    }
    finally {
      this.#noIn = outer;
    }
  }

  // ── Postfix: call/member suffixes ───────────────────────────────────────

  /**
   * Collects `.method(args)` and `(args)` suffixes after an expression,
   * then reduces them into a chain of CallExpression/MemberExpression nodes.
   *
   * Every node of a chain like `obj.a().b()` spans from `start`, where the head's
   * text begins, to its own end, so an error about `obj.a()` underlines `obj.a()`,
   * not the whole chain.
   */
  #parseSuffixes(head: AstNode, start: Pos): AstNode {
    const suffixes: Suffix[] = [];
    while (true) {
      const saved = this.#save();
      this.#skipWhitespace();
      // Like an operator chain, each call of `a.b().c()` nests the calls before it
      const suffixLocation = this.#nextCharLoc();
      if (this.#peek() === '.') {
        suffixes.push(this.#parseMemberCallSuffix());
        this.#nest(suffixLocation);
        continue;
      }
      if (this.#peek() === '(') {
        // Marked before the arguments, so a call still being typed shows its name as a function
        if (head instanceof IdentifierNode && suffixes.length === 0) {
          this.#markFunction(head);
        }
        suffixes.push(this.#parseDirectCallSuffix());
        this.#nest(suffixLocation);
        continue;
      }
      this.#restore(saved);
      break;
    }
    // A name called directly is a function, not a variable
    if (head instanceof IdentifierNode && suffixes[0]?.type !== 'DirectCall') {
      this.#resolveReference(head);
    }
    if (suffixes.length === 0) {
      return head;
    }
    return this.#buildSuffixChain(head, suffixes, start);
  }

  /** Parses `.method(args)` and returns a suffix descriptor. */
  #parseMemberCallSuffix(): Suffix {
    const dotStart = this.#mark();
    this.#consumePunctuation();
    this.#skipWhitespace();
    const prop = this.#parseIdentifier();
    this.#emit('method', prop.location.start);
    const saved = this.#save();
    this.#skipWhitespace();
    if (this.#peek() !== '(') {
      this.#report(this.#error('UNCALLED_METHOD', { name: prop.name }, this.#loc(dotStart, prop.location.end)));
      // Read on as a call without arguments
      this.#restore(saved);
      return { type: 'MemberCall', property: prop, args: [], end: prop.location.end };
    }
    const args = this.#parseCallArguments();
    return { type: 'MemberCall', property: prop, args, end: this.#mark() };
  }

  /** Parses `(args)` and returns a suffix descriptor. */
  #parseDirectCallSuffix(): Suffix {
    const args = this.#parseCallArguments();
    return { type: 'DirectCall', args, end: this.#mark() };
  }

  /** Parses the parenthesized arguments of a call, up to and with its `)`. */
  #parseCallArguments(): AstNode[] {
    const lpStart = this.#mark();
    this.#consumePunctuation();
    const lpEnd = this.#mark();
    this.#skipWhitespace();
    const args = this.#parseArguments(')', (list) => this.#unclosedParenError(lpStart, lpEnd, list));
    if (this.#peek() === ')') {
      this.#consumePunctuation();
    }
    return args;
  }

  /** Reduces a list of collected suffixes into a chain of AST nodes, each spanning from the head to its own end. */
  #buildSuffixChain(head: AstNode, suffixes: Suffix[], start: Pos): AstNode {
    let node: AstNode = head;
    for (const suffix of suffixes) {
      const location = this.#loc(start, suffix.end);
      if (suffix.type === 'MemberCall') {
        const member = new MemberExpressionNode(node, suffix.property, false, this.#loc(start, suffix.property.location.end));
        node = new CallExpressionNode(member, suffix.args, location);
      }
      else {
        node = new CallExpressionNode(node as IdentifierNode, suffix.args, location);
      }
    }
    return node;
  }

  // ── Atom parsers ────────────────────────────────────────────────────────

  /** Dispatches to the appropriate atom parser based on the current character. */
  #parseAtom(): AstNode {
    const ch = this.#peek();
    if (this.#isDigit(ch) || (ch === '.' && this.#isDigit(this.#peekAt(1)))) {
      return this.#parseNumber();
    }
    if (ch === '"' || ch === '\'') {
      return this.#parseString();
    }
    if (ch === '/') {
      return this.#parseRegExp();
    }
    if (ch === '(') {
      return this.#parseGrouped();
    }
    if (ch === '[') {
      return this.#parseArray();
    }
    if (this.#isIdStart(ch)) {
      return this.#parseIdOrLiteral();
    }
    const s = this.#mark();
    if (this.#isEnd()) {
      this.#fail('EXPECTED_EXPRESSION', {}, this.#loc(s));
    }
    const bad = this.#advance();
    this.#fail('UNEXPECTED_CHARACTER', { character: bad }, this.#loc(s));
  }

  /** Parses a numeric literal: integer, decimal, or scientific notation. */
  #parseNumber(): LiteralNode {
    const s = this.#mark();
    const start = this.#pos;
    // Leading dot: `.5`
    if (this.#peek() === '.') {
      this.#advance();
      while (this.#isDigit(this.#peek())) {
        this.#advance();
      }
    }
    else {
      // Integer part
      while (this.#isDigit(this.#peek())) {
        this.#advance();
      }
      // Optional decimal part: `3.14`
      if (this.#peek() === '.' && this.#isDigit(this.#peekAt(1))) {
        this.#advance();
        while (this.#isDigit(this.#peek())) {
          this.#advance();
        }
      }
      // A trailing dot belongs to the number unless a name follows it: `1.` is 1, `1. round()` is a method call
      else if (this.#peek() === '.' && !this.#isIdStart(this.#nextNonWhitespace(1))) {
        this.#advance();
      }
    }
    // Optional exponent: `1e10`, `2.5E-3`
    if (this.#peek() === 'e' || this.#peek() === 'E') {
      const sv = this.#save();
      this.#advance();
      if (this.#peek() === '+' || this.#peek() === '-') {
        this.#advance();
      }
      if (this.#isDigit(this.#peek())) {
        while (this.#isDigit(this.#peek())) {
          this.#advance();
        }
      }
      else {
        // Not a valid exponent (e.g. `1e` without digits) — backtrack
        this.#restore(sv);
      }
    }
    const raw = this.#input.slice(start, this.#pos);
    this.#emit('number', s);
    return new LiteralNode(Number.parseFloat(raw), raw, this.#loc(s));
  }

  /** Parses a single- or double-quoted string literal with escape sequences. */
  #parseString(): LiteralNode {
    const s = this.#mark();
    const quote = this.#advance();
    let value = '';
    while (!this.#isEnd() && this.#peek() !== quote) {
      if (this.#peek() === '\\') {
        const escape = this.#mark();
        this.#advance();

        // A backslash at the very end leaves the text unterminated, with nothing to escape
        if (this.#isEnd()) {
          break;
        }

        value += this.#parseEscapeSequence(escape);
      }
      else {
        value += this.#advance();
      }
    }
    if (this.#isEnd()) {
      this.#fail('UNTERMINATED_STRING', {}, this.#loc(s));
    }
    this.#advance();
    this.#emit('string', s);
    return new LiteralNode(value, this.#input.slice(s.offset, this.#pos), this.#loc(s));
  }

  /** Parses a single escape sequence after the backslash at `start` has been consumed. */
  #parseEscapeSequence(start: Pos): string {
    const c = this.#advance();
    switch (c) {
      case '\'':
        return '\'';
      case '"':
        return '"';
      case '\\':
        return '\\';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'v':
        return '\v';
      case 'u':
        return this.#parseUnicodeEscape(start);
      case 'x': {
        const hex = this.#readHexDigits(2);

        if (hex === undefined) {
          this.#report(this.#error('INVALID_HEX_ESCAPE', {}, this.#loc(start)));
          return '';
        }

        return String.fromCharCode(Number.parseInt(hex, 16));
      }
      case '0':
        if (this.#isDigit(this.#peek())) {
          this.#report(this.#error('ZERO_ESCAPE_BEFORE_DIGIT', {}, this.#loc(start)));
        }
        return '\0';
      // JavaScript rejects octal escapes and `\8`, `\9`; reading them as digits would silently turn a backreference like `\1` into a literal digit
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        this.#report(this.#error('DIGIT_ESCAPE', { digit: c }, this.#loc(start)));
        return c;
      // A backslash before a line break continues the text on the next line
      case '\r':
        if (this.#peek() === '\n') {
          this.#advance();
        }
        return '';
      case '\n':
      case '\u2028':
      case '\u2029':
        return '';
      default:
        return c;
    }
  }

  /** Parses `\uXXXX` or `\u{X…}` after the `u`; the escape starts at `start`. */
  #parseUnicodeEscape(start: Pos): string {
    if (this.#peek() !== '{') {
      const hex = this.#readHexDigits(4);

      if (hex === undefined) {
        this.#report(this.#error('INVALID_UNICODE_ESCAPE', {}, this.#loc(start)));
        return '';
      }

      return String.fromCharCode(Number.parseInt(hex, 16));
    }

    this.#advance();

    let hex = '';

    while (HEX_DIGIT.test(this.#peek())) {
      hex += this.#advance();
    }

    const closed = this.#peek() === '}';

    if (closed) {
      this.#advance();
    }

    const codePoint = Number.parseInt(hex, 16);

    if (!closed || hex === '' || codePoint > 0x10FFFF) {
      this.#report(this.#error('INVALID_UNICODE_ESCAPE', {}, this.#loc(start)));
      return '';
    }

    return String.fromCodePoint(codePoint);
  }

  /** Consumes exactly `count` hex digits, or returns `undefined` after consuming the ones that are there. */
  #readHexDigits(count: number): string | undefined {
    let hex = '';

    while (hex.length < count && HEX_DIGIT.test(this.#peek())) {
      hex += this.#advance();
    }

    return hex.length === count ? hex : undefined;
  }

  /**
   * Parses a regular expression literal `/pattern/flags`.
   *
   * An atom never follows an operand, so a `/` here always starts a literal
   * and never conflicts with division. As in JS, `/` inside a character class
   * needs no escaping, and the literal cannot span lines.
   */
  #parseRegExp(): LiteralNode {
    const s = this.#mark();
    this.#advance();
    const patternStart = this.#pos;
    let inClass = false;
    while (this.#peek() !== '/' || inClass) {
      if (this.#isEnd() || this.#isLineBreak(this.#peek())) {
        this.#fail('UNTERMINATED_REGEXP', {}, this.#loc(s));
      }
      const c = this.#advance();
      if (c === '\\' && !this.#isEnd() && !this.#isLineBreak(this.#peek())) {
        this.#advance();
      }
      else if (c === '[') {
        inClass = true;
      }
      else if (c === ']') {
        inClass = false;
      }
    }
    const pattern = this.#input.slice(patternStart, this.#pos);
    this.#advance();
    if (pattern === '') {
      this.#report(this.#error('EMPTY_REGEXP', {}, this.#loc(s)));
      this.#readWord();
      return this.#placeholder(s);
    }
    const flagsStart = this.#mark();
    const flags = this.#readWord();
    // Flags are checked against an empty pattern first so the error points at the flags, not the pattern
    if (this.#createRegExp('', flags) instanceof Error) {
      this.#report(this.#error('INVALID_REGEXP_FLAGS', { flags }, this.#loc(flagsStart)));
      return this.#placeholder(s);
    }
    const regexp = this.#createRegExp(pattern, flags);
    if (regexp instanceof Error) {
      this.#report(this.#error('INVALID_REGEXP', { reason: regexp.message }, this.#loc(s)));
      return this.#placeholder(s);
    }
    this.#emit('regexp', s);
    return new LiteralNode(regexp, `/${pattern}/${flags}`, this.#loc(s));
  }

  /**
   * Parses a word and returns either a literal node (`true`, `false`, `null`,
   * `undefined`) or an identifier node. Keyword words (`or`, `and`, etc.)
   * in expression position are an error.
   */
  #parseIdOrLiteral(): AstNode {
    const s = this.#mark();
    const word = this.#readWord();
    const location = this.#loc(s);
    switch (word) {
      case 'null':
        this.#emit('null', s);
        return new LiteralNode(null, 'null', location);
      case 'undefined':
        this.#emit('null', s);
        return new LiteralNode(undefined as never, 'undefined', location);
      case 'true':
        this.#emit('boolean', s);
        return new LiteralNode(true, 'true', location);
      case 'false':
        this.#emit('boolean', s);
        return new LiteralNode(false, 'false', location);
      case 'or':
      case 'and':
      case 'not':
      case 'in':
        this.#fail('UNEXPECTED_KEYWORD', { keyword: word }, location);
      // falls through — never reached, fail() throws
      default:
        this.#emit('name', s);
        return new IdentifierNode(word, location);
    }
  }

  /** Parses an identifier (non-keyword word). Used for member access properties. */
  #parseIdentifier(): IdentifierNode {
    const s = this.#mark();
    if (!this.#isIdStart(this.#peek())) {
      this.#fail('EXPECTED_METHOD_NAME', {}, this.#loc(s));
    }
    const word = this.#readWord();
    if (KEYWORDS.has(word)) {
      this.#report(this.#error('KEYWORD_AS_METHOD_NAME', { keyword: word }, this.#loc(s)));
    }
    return new IdentifierNode(word, this.#loc(s));
  }

  /** Parses a parenthesized group `(expr)` and returns the inner expression. */
  #parseGrouped(): AstNode {
    const lp = this.#mark();
    this.#consumePunctuation();
    this.#skipWhitespace();
    if (this.#peek() === ')') {
      this.#advance();
      this.#report(this.#error('EMPTY_PARENTHESES', {}, this.#loc(lp)));
      return this.#placeholder(lp);
    }
    const expr = this.#recoverable(this.#parseListItem);
    this.#skipWhitespace();
    if (this.#peek() !== ')') {
      const m = this.#mark();
      this.#report(this.#error('MISSING_TOKEN', { expected: [')'] }, this.#loc(m)));
      this.#skipToSync();
    }
    if (this.#peek() === ')') {
      this.#consumePunctuation();
    }
    return expr;
  }

  // An expression inside brackets, where `in` is the operator again; one bound function, not a closure per item
  readonly #parseListItem = (): AstNode => this.#withNoIn(false, this.#parseFullExpr);
  readonly #parseFullExpr = (): AstNode => this.#parseExpr(0);

  /** Parses an array literal `[el1, el2, ...]`. */
  #parseArray(): ArrayExpressionNode {
    const s = this.#mark();
    this.#consumePunctuation();
    this.#skipWhitespace();
    const elements = this.#parseArguments(']', () => this.#error('MISSING_TOKEN', { expected: [']'] }, this.#loc(this.#mark())));
    if (this.#peek() === ']') {
      this.#consumePunctuation();
    }
    return new ArrayExpressionNode(elements, this.#loc(s));
  }

  /**
   * Parses a comma-separated list of expressions (used for function args and array elements) up to its `closer`,
   * which it leaves for the caller to consume.
   *
   * @param closer - The bracket that ends the list.
   * @param closeError - The error for a list that something other than `,` or `closer` follows.
   */
  #parseArguments(closer: ')' | ']', closeError: (args: readonly AstNode[]) => SyntaxError): AstNode[] {
    const args: AstNode[] = [];
    if (this.#peek() === ',') {
      const s = this.#mark();
      this.#advance();
      this.#report(this.#error('LEADING_COMMA', {}, this.#loc(s)));
      this.#skipWhitespace();
    }
    let expectArgument = this.#peek() !== ')' && this.#peek() !== ']' && !this.#isEnd();
    while (true) {
      if (expectArgument) {
        args.push(this.#recoverable(this.#parseListItem));
      }
      this.#skipWhitespace();
      if (this.#peek() !== ',') {
        if (this.#peek() === closer) {
          return args;
        }
        this.#report(closeError(args));
        // Read on from the next argument, if the list has one
        this.#skipToSync();
        if (this.#peek() !== ',') {
          return args;
        }
      }
      const commaStart = this.#mark();
      this.#consumePunctuation();
      const commaEnd = this.#mark();
      this.#skipWhitespace();
      expectArgument = !(this.#peek() === ')' || this.#peek() === ']' || this.#peek() === ',' || this.#isEnd());
      if (!expectArgument) {
        this.#report(this.#error('MISSING_ARGUMENT', {}, { start: commaStart, end: commaEnd }));
      }
    }
  }

  // ── Operator table ──────────────────────────────────────────────────────

  /**
   * Looks at the current input and returns the operator descriptor if an
   * infix/binary operator is found. Does NOT consume any input.
   *
   * This is the **precedence table** of the parser, encoded as data.
   * To add a new operator, add one `if` branch here with its binding powers.
   */
  #peekOp(): OpInfo | null {
    const c = this.#peek();
    const c2 = this.#peekAt(1);
    // Two-character operators (check first to avoid prefix matches)
    if (c === '|' && c2 === '|') {
      return { text: '||', lbp: 3, rbp: 3 };
    }
    if (c === '&' && c2 === '&') {
      return { text: '&&', lbp: 5, rbp: 5 };
    }
    if (c === '=' && c2 === '=') {
      return { text: '==', lbp: 7, rbp: 7 };
    }
    if (c === '!' && c2 === '=') {
      return { text: '!=', lbp: 7, rbp: 7 };
    }
    if (c === '<' && c2 === '=') {
      return { text: '<=', lbp: 7, rbp: 7 };
    }
    if (c === '>' && c2 === '=') {
      return { text: '>=', lbp: 7, rbp: 7 };
    }
    // Single-character operators
    if (c === '<') {
      return { text: '<', lbp: 7, rbp: 7 };
    }
    if (c === '>') {
      return { text: '>', lbp: 7, rbp: 7 };
    }
    if (c === '+') {
      return { text: '+', lbp: 9, rbp: 9 };
    }
    if (c === '-') {
      return { text: '-', lbp: 9, rbp: 9 };
    }
    if (c === '*') {
      return { text: '*', lbp: 11, rbp: 11 };
    }
    if (c === '/') {
      return { text: '/', lbp: 11, rbp: 11 };
    }
    if (c === '%') {
      return { text: '%', lbp: 11, rbp: 11 };
    }
    // Power — right-associative: rbp = lbp - 1
    if (c === '^') {
      return { text: '^', lbp: 14, rbp: 13 };
    }
    // Keyword operators
    if (this.#isKeywordAhead('or')) {
      return { text: 'or', lbp: 3, rbp: 3 };
    }
    if (this.#isKeywordAhead('and')) {
      return { text: 'and', lbp: 5, rbp: 5 };
    }
    if (!this.#noIn && this.#isKeywordAhead('in')) {
      return { text: 'in', lbp: 7, rbp: 7 };
    }
    // `not` cannot end a `let` part, so `not in` stays the operator where a bare `in` does not
    if (this.#isNotInAhead()) {
      return { text: 'not in', lbp: 7, rbp: 7 };
    }
    return null;
  }

  /** Checks for `not` and `in` with any whitespace between them. */
  #isNotInAhead(): boolean {
    if (!this.#isKeywordAhead('not')) {
      return false;
    }

    const saved = this.#save();
    this.#consumeKeyword('not');
    this.#skipWhitespace();

    const found = this.#isKeywordAhead('in');
    this.#restore(saved);

    return found;
  }

  /** Advances the scanner past the given operator's characters. */
  #consumeOp(op: OpInfo): void {
    if (op.text === 'not in') {
      this.#consumeKeyword('not', 'operator');
      this.#skipWhitespace();
      this.#consumeKeyword('in', 'operator');
      return;
    }

    const start = this.#mark();

    for (let i = 0; i < op.text.length; i++) {
      this.#advance();
    }

    this.#emit('operator', start);
  }

  // ── Scanner primitives ──────────────────────────────────────────────────

  /** Returns a position snapshot for building Location objects. */
  #mark(): Pos {
    return { offset: this.#pos, line: this.#line, column: this.#column };
  }

  /** Saves the full scanner state for speculative parsing (backtracking). */
  #save(): State {
    return { pos: this.#pos, line: this.#line, column: this.#column };
  }

  /** Restores the scanner state to a previously saved checkpoint. */
  #restore(state: State): void {
    this.#pos = state.pos;
    this.#line = state.line;
    this.#column = state.column;
  }

  /** Consumes one character of punctuation, such as a bracket or a comma. */
  #consumePunctuation(): void {
    const start = this.#mark();
    this.#advance();
    this.#emit('punctuation', start);
  }

  /** Records a token of `kind` from `start` to the current position, when the caller collects tokens. */
  #emit(kind: FormulaTokenKind, start: Pos): void {
    this.#tokens?.push({ kind, location: this.#loc(start) });
  }

  /** Records the name that `node` reads as a function, now that a `(` follows it. */
  #markFunction(node: IdentifierNode): void {
    const token = this.#tokens?.findLast((candidate) => candidate.location.start.offset === node.location.start.offset);

    if (token) {
      token.kind = 'function';
    }
  }

  /** Returns the current character without consuming it (empty string at end). */
  #peek(): string {
    return this.#input[this.#pos] ?? '';
  }

  /** Returns the character `n` positions ahead without consuming it. */
  #peekAt(n: number): string {
    return this.#input[this.#pos + n] ?? '';
  }

  /** Returns the first character from `n` positions ahead that is not whitespace, without consuming anything. */
  #nextNonWhitespace(n: number): string {
    let offset = n;

    while (' \t\n\r'.includes(this.#peekAt(offset)) && this.#peekAt(offset) !== '') {
      offset++;
    }

    return this.#peekAt(offset);
  }

  /** Returns `true` if the scanner has reached the end of input. */
  #isEnd(): boolean {
    return this.#pos >= this.#input.length;
  }

  /** Consumes and returns the current character, updating line/column tracking. */
  #advance(): string {
    const ch = this.#input[this.#pos];
    this.#pos++;
    if (ch === '\n') {
      this.#line++;
      this.#column = 1;
    }
    else {
      this.#column++;
    }
    return ch;
  }

  /** Skips whitespace characters (space, tab, newline, carriage return). */
  #skipWhitespace(): void {
    while (!this.#isEnd() && ' \t\n\r'.includes(this.#peek())) {
      this.#advance();
    }
  }

  #isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  #isIdStart(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  #isIdChar(c: string): boolean {
    return this.#isIdStart(c) || this.#isDigit(c);
  }

  /** Checks whether the current position could be the start of an expression. */
  #isExprStart(): boolean {
    const c = this.#peek();
    return this.#isDigit(c)
      || this.#isIdStart(c)
      || c === '"'
      || c === '\''
      || c === '/'
      || c === '('
      || c === '['
      || c === '-'
      || c === '!'
      || c === '.';
  }

  #isLineBreak(c: string): boolean {
    return c === '\n' || c === '\r';
  }

  /** Builds a RegExp, returning the engine's error instead of throwing when the pattern or flags are invalid. */
  #createRegExp(pattern: string, flags: string): RegExp | Error {
    try {
      return new RegExp(pattern, flags);
    }
    catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }

  /** Checks if the given keyword appears at the current position followed by a non-identifier character. */
  #isKeywordAhead(kw: string): boolean {
    return this.#input.startsWith(kw, this.#pos)
      && !this.#isIdChar(this.#input[this.#pos + kw.length] ?? '');
  }

  /** Consumes the keyword if it matches at the current position, as a token of `kind` when given. Returns `true` on success. */
  #consumeKeyword(kw: string, kind?: FormulaTokenKind): boolean {
    if (!this.#isKeywordAhead(kw)) {
      return false;
    }
    const start = this.#mark();
    for (let i = 0; i < kw.length; i++) {
      this.#advance();
    }
    if (kind) {
      this.#emit(kind, start);
    }
    return true;
  }

  /** Checks for `word` followed by a name, which starts a declaration rather than reading a variable called `word`. */
  #isDeclarationAhead(word: string): boolean {
    if (!this.#isKeywordAhead(word)) {
      return false;
    }

    const saved = this.#save();
    this.#consumeKeyword(word);
    this.#skipWhitespace();

    const next = this.#isIdStart(this.#peek()) ? this.#readWord() : '';
    this.#restore(saved);

    // `let or x`, `let and x` and `let in x` read a variable called `let`
    return next !== '' && next !== 'or' && next !== 'and' && next !== 'in';
  }

  /** Consumes the punctuation character if it is next. Returns `true` on success. */
  #consumePunctuationChar(c: string): boolean {
    if (this.#peek() !== c) {
      return false;
    }
    this.#consumePunctuation();
    return true;
  }

  /** Reads a contiguous word of identifier characters. */
  #readWord(): string {
    let word = '';
    while (!this.#isEnd() && this.#isIdChar(this.#peek())) {
      word += this.#advance();
    }
    return word;
  }

  // ── Error helpers ───────────────────────────────────────────────────────

  /** Throws a SyntaxError at the given location. Always returns `never`. */
  #fail<C extends SyntaxErrorCode>(code: C, payload: SyntaxErrorPayloads[C], location: Location): never {
    throw this.#error(code, payload, location);
  }

  #error<C extends SyntaxErrorCode>(code: C, payload: SyntaxErrorPayloads[C], location: Location): SyntaxError {
    return new SyntaxError(code, payload, location);
  }

  /** Records an error the parse can read on after, or throws it when the caller asked for no recovery. */
  #report(error: SyntaxError): void {
    if (!this.#diagnostics) {
      throw error;
    }

    this.#record(error);
  }

  #record(error: SyntaxError): void {
    // Brackets of one kind that all lack their closer at the end of input report the same error at the same place
    const known = this.#diagnostics?.some(({ code, message }) => code === error.code && message === error.message);

    if (!known) {
      this.#diagnostics?.push(error);
    }
  }

  /**
   * Parses an argument, an element or a parenthesized expression; when recovering, an error inside it is recorded and
   * the input is skipped to the next `,` or closing bracket, leaving a placeholder in the tree.
   */
  #recoverable(parse: () => AstNode): AstNode {
    if (!this.#diagnostics) {
      return parse();
    }

    const start = this.#mark();
    const depth = this.#depth;

    try {
      return parse();
    }
    catch (error) {
      if (!isSyntaxError(error)) {
        throw error;
      }

      this.#record(error);
      // The levels the parse entered before the error are left on a throw
      this.#depth = depth;
      this.#skipToSync();

      return this.#placeholder(start);
    }
  }

  /** Skips to the next `,` or closing bracket at the current level of brackets, stepping over quoted text. */
  #skipToSync(): void {
    let depth = 0;

    while (!this.#isEnd()) {
      const c = this.#peek();

      if (depth === 0 && (c === ',' || c === ')' || c === ']')) {
        return;
      }

      if (c === '"' || c === '\'') {
        this.#skipQuoted(c);
        continue;
      }

      if (c === '(' || c === '[') {
        depth++;
      }
      else if (c === ')' || c === ']') {
        depth--;
      }

      this.#advance();
    }
  }

  /** Skips text quoted with `quote`, up to its closing quote or the end of input. */
  #skipQuoted(quote: string): void {
    this.#advance();

    while (!this.#isEnd() && this.#peek() !== quote) {
      if (this.#advance() === '\\' && !this.#isEnd()) {
        this.#advance();
      }
    }

    if (!this.#isEnd()) {
      this.#advance();
    }
  }

  /** Stands in the tree for text that could not be read, from `start` to the current position. */
  #placeholder(start: Pos): LiteralNode {
    return new LiteralNode(null, this.#input.slice(start.offset, this.#pos), this.#loc(start));
  }

  /** Enters one more level of nesting; the parser leaves it when the enclosing `#parseExpr` returns. */
  #nest(location: Location): void {
    this.#depth++;
    if (this.#depth > MAX_NESTING) {
      this.#fail('TOO_DEEP', { limit: MAX_NESTING }, location);
    }
  }

  /** Builds the Location of the next character, empty at the end of input. */
  #nextCharLoc(): Location {
    const saved = this.#save();
    const start = this.#mark();
    if (!this.#isEnd()) {
      this.#advance();
    }
    const location = this.#loc(start);
    this.#restore(saved);
    return location;
  }

  /** Builds a Location from a start position to an optional end position (defaults to current). */
  #loc(start: Pos, end?: Pos): Location {
    return { start, end: end ?? this.#mark() };
  }

  /** Builds the "unclosed parenthesis" error with a location spanning from `(` to the last argument. */
  #unclosedParenError(lpStart: Pos, lpEnd: Pos, args: readonly AstNode[]): SyntaxError {
    const lastArg = args.at(-1);
    const end = lastArg ? lastArg.location.end : lpEnd;
    return this.#error('UNCLOSED_PARENTHESIS', {}, { start: lpStart, end });
  }
}

// `instanceof` reads the code of a generic error class as `any`
function isSyntaxError(value: unknown): value is SyntaxError {
  return value instanceof SyntaxError;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parses a formula string into an AST using the Pratt parsing algorithm.
 *
 * @param input The formula string to parse.
 * @returns The root AST node.
 * @throws {SyntaxError} If the input does not conform to the grammar.
 */
export function parse(input: string): AstNode {
  return new Parser(input).run();
}

/**
 * Splits a formula string into the tokens the parser reads, with their kinds.
 *
 * @param input The formula string to split.
 * @returns Tokens in the order of the text; after a syntax error, the rest of the text as one `invalid` token.
 */
export function tokenize(input: string): FormulaToken[] {
  return new Parser(input, { collectTokens: true }).tokens();
}

/**
 * Finds the syntax errors of a formula string, reading on past each one it can step over.
 *
 * @param input The formula string to check.
 * @returns The errors in the order they are found, the first being the one `parse` throws; empty when it parses.
 */
export function diagnose(input: string): SyntaxError[] {
  return new Parser(input, { recover: true }).diagnostics();
}
