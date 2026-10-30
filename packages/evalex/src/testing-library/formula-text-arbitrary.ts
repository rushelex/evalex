import type { FormulaTokenKind } from '~/parser/ast/token';

import { fc } from '@fast-check/vitest';

/** A token of a generated formula: its text and the kind `tokenize` gives it. */
interface GeneratedToken {
  readonly text: string;
  readonly kind: FormulaTokenKind;
}

// `fc.letrec` types `tie` only for a type with an index signature.
interface FormulaArbitraries extends Record<string, readonly GeneratedToken[]> {
  readonly expression: readonly GeneratedToken[];
}

// Identifiers that start with a keyword check where a keyword ends.
const IDENTIFIERS = ['a', 'price', '_x1', 'notes', 'android', 'orange', 'inner', 'trueValue', 'nullable'];

const LITERALS: readonly GeneratedToken[] = [
  ...['1', '0.5', '.5', '1e3', '2.5E-3'].map((text) => ({ text, kind: 'number' as const })),
  ...['"text"', '\'it\\\'s\''].map((text) => ({ text, kind: 'string' as const })),
  ...['true', 'false'].map((text) => ({ text, kind: 'boolean' as const })),
  ...['null', 'undefined'].map((text) => ({ text, kind: 'null' as const })),
  ...['/a+/gi', '/[/]/'].map((text) => ({ text, kind: 'regexp' as const })),
];

const ATOMS: readonly GeneratedToken[] = [...LITERALS, ...IDENTIFIERS.map((text) => ({ text, kind: 'name' as const }))];

const BINARY_OPERATORS = ['or', '||', 'and', '&&', '==', '!=', '<', '<=', '>', '>=', 'in', 'not in', '+', '-', '*', '/', '%', '^'];

const PREFIX_OPERATORS = ['-', '!', 'not'];

const WHITESPACE = [' ', '  ', '\n', '\t', '\r\n'];

// Names a `let` declares; none of them is in IDENTIFIERS, so a generated value never reads a name too early.
const DECLARED_NAMES = ['x', 'total'];

const PUNCTUATION = ['(', ')', '[', ']', ',', '.', '?', ':', '"', '\'', '\\', '/', '=', '!', '&', '|', '<', '>', '\n', ' '];

const OPEN = { text: '(', kind: 'punctuation' } as const;

const CLOSE = { text: ')', kind: 'punctuation' } as const;

// Tokens of well-formed formulas; every compound operand is parenthesized, so the tree follows the token order.
const { expression: formulaTokens } = fc.letrec<FormulaArbitraries>((tie) => ({
  expression: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom(...ATOMS).map((atom) => [atom]),
    fc.tuple(fc.constantFrom(...PREFIX_OPERATORS), tie('expression')).map(([operator, operand]) => [operatorToken(operator), ...group(operand)]),
    fc.tuple(tie('expression'), fc.constantFrom(...BINARY_OPERATORS), tie('expression'))
      .map(([left, operator, right]) => [...group(left), ...operator.split(' ').map((text) => operatorToken(text)), ...group(right)]),
    fc.tuple(tie('expression'), tie('expression'), tie('expression'))
      .map(([test, consequent, alternate]) => [...group(test), punctuationToken('?'), ...group(consequent), punctuationToken(':'), ...group(alternate)]),
    fc.tuple(fc.constantFrom(...IDENTIFIERS), fc.array(tie('expression'), { maxLength: 3 }))
      .map(([name, args]) => [{ text: name, kind: 'function' as const }, OPEN, ...commaSeparated(args), CLOSE]),
    fc.tuple(tie('expression'), fc.constantFrom(...IDENTIFIERS), fc.array(tie('expression'), { maxLength: 3 }))
      .map(([object, name, args]) => [...group(object), punctuationToken('.'), { text: name, kind: 'method' as const }, OPEN, ...commaSeparated(args), CLOSE]),
    fc.array(tie('expression'), { maxLength: 3 }).map((elements) => [punctuationToken('['), ...commaSeparated(elements), punctuationToken(']')]),
    fc.tuple(fc.constantFrom(...DECLARED_NAMES), tie('expression'), tie('expression')).map(([name, value, body]) => [
      { text: 'let', kind: 'keyword' as const },
      { text: name, kind: 'name' as const },
      operatorToken('='),
      ...group(value),
      { text: 'in', kind: 'keyword' as const },
      ...group(body),
    ]),
  ),
}));

/**
 * Well-formed formulas with whitespace before each token, and their tokens: `not in` gives two tokens, which any
 * whitespace may separate.
 */
export const spacedFormulaArbitrary = formulaTokens.chain((tokens) => fc.array(fc.constantFrom(...WHITESPACE), { minLength: tokens.length, maxLength: tokens.length })
  .map((gaps) => ({ tokens, formula: tokens.map((token, index) => `${gaps[index]}${token.text}`).join('') })));

/** Any text, from random characters through pieces of formulas to well-formed formulas. */
export const formulaTextArbitrary = fc.oneof(
  fc.string({ unit: 'binary' }),
  fc.array(fc.constantFrom(...ATOMS.map(({ text }) => text), ...BINARY_OPERATORS, ...PREFIX_OPERATORS, ...PUNCTUATION, 'let ', 'const ', ' in '), { maxLength: 12 })
    .map((tokens) => tokens.join('')),
  spacedFormulaArbitrary.map(({ formula }) => formula),
);

function operatorToken(text: string): GeneratedToken {
  return { text, kind: 'operator' };
}

function punctuationToken(text: string): GeneratedToken {
  return { text, kind: 'punctuation' };
}

function group(tokens: readonly GeneratedToken[]): GeneratedToken[] {
  return tokens.length === 1 ? [...tokens] : [OPEN, ...tokens, CLOSE];
}

function commaSeparated(groups: readonly (readonly GeneratedToken[])[]): GeneratedToken[] {
  return groups.flatMap((tokens, index) => (index === 0 ? [...tokens] : [punctuationToken(','), ...tokens]));
}
