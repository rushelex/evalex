import type { AstNode, Location } from './ast';

import { fc, it } from '@fast-check/vitest';

import { SyntaxError } from './grammar/parser';
import { parse } from './parse';

// `fc.letrec` types `tie` only for a type with an index signature.
interface FormulaArbitraries extends Record<string, readonly string[]> {
  readonly expression: readonly string[];
}

// Identifiers that start with a keyword check where a keyword ends.
const IDENTIFIERS = ['a', 'price', '_x1', 'notes', 'android', 'orange', 'inner', 'trueValue', 'nullable'];

const ATOMS = ['1', '0.5', '.5', '1e3', '2.5E-3', '"text"', '\'it\\\'s\'', 'true', 'false', 'null', 'undefined', '/a+/gi', '/[/]/', ...IDENTIFIERS];

const BINARY_OPERATORS = ['or', '||', 'and', '&&', '==', '!=', '<', '<=', '>', '>=', 'in', '+', '-', '*', '/', '%', '^'];

const PREFIX_OPERATORS = ['-', '!', 'not'];

const WHITESPACE = [' ', '  ', '\n', '\t', '\r\n'];

// Names a `let` declares; none of them is in IDENTIFIERS, so a generated value never reads a name too early.
const DECLARED_NAMES = ['x', 'total'];

const PUNCTUATION = ['(', ')', '[', ']', ',', '.', '?', ':', '"', '\'', '\\', '/', '=', '!', '&', '|', '<', '>', '\n', ' '];

// Token lists of well-formed formulas; every compound operand is parenthesized, so the tree follows the token order.
const { expression: formulaTokens } = fc.letrec<FormulaArbitraries>((tie) => ({
  expression: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom(...ATOMS).map((atom) => [atom]),
    fc.tuple(fc.constantFrom(...PREFIX_OPERATORS), tie('expression')).map(([operator, operand]) => [operator, ...group(operand)]),
    fc.tuple(tie('expression'), fc.constantFrom(...BINARY_OPERATORS), tie('expression')).map(([left, operator, right]) => [...group(left), operator, ...group(right)]),
    fc.tuple(tie('expression'), tie('expression'), tie('expression')).map(([test, consequent, alternate]) => [...group(test), '?', ...group(consequent), ':', ...group(alternate)]),
    fc.tuple(fc.constantFrom(...IDENTIFIERS), fc.array(tie('expression'), { maxLength: 3 })).map(([name, args]) => [name, '(', ...commaSeparated(args), ')']),
    fc.tuple(tie('expression'), fc.constantFrom(...IDENTIFIERS), fc.array(tie('expression'), { maxLength: 3 })).map(([object, name, args]) => [...group(object), '.', name, '(', ...commaSeparated(args), ')']),
    fc.array(tie('expression'), { maxLength: 3 }).map((elements) => ['[', ...commaSeparated(elements), ']']),
    fc.tuple(fc.constantFrom(...DECLARED_NAMES), tie('expression'), tie('expression')).map(([name, value, body]) => ['let', name, '=', ...group(value), 'in', ...group(body)]),
  ),
}));

const spacedFormula = formulaTokens.chain((tokens) => fc.array(fc.constantFrom(...WHITESPACE), { minLength: tokens.length, maxLength: tokens.length })
  .map((gaps) => ({ tokens, formula: tokens.map((token, index) => `${gaps[index]}${token}`).join('') })));

const anyText = fc.oneof(
  fc.string({ unit: 'binary' }),
  fc.array(fc.constantFrom(...ATOMS, ...BINARY_OPERATORS, ...PREFIX_OPERATORS, ...PUNCTUATION, 'let ', 'const ', ' in '), { maxLength: 12 }).map((tokens) => tokens.join('')),
  spacedFormula.map(({ formula }) => formula),
);

const numberText = fc.oneof(
  fc.double({ min: 0, noNaN: true }).map(String).filter((text) => text !== 'Infinity'),
  fc.tuple(
    fc.stringMatching(/^\d{0,25}$/),
    fc.option(fc.stringMatching(/^\d{0,25}$/), { nil: undefined }),
    fc.option(fc.tuple(fc.constantFrom('e', 'E'), fc.constantFrom('', '+', '-'), fc.stringMatching(/^\d{1,4}$/)), { nil: undefined }),
  )
    .map(([whole, fraction, exponent]) => `${whole}${fraction === undefined ? '' : `.${fraction}`}${exponent?.join('') ?? ''}`)
    // A name after a trailing dot is a method call, so `1.e3` is not the number 1000.
    .filter((text) => /^(?:\d+\.?\d*|\.\d+)/.test(text) && !/\.e/i.test(text)),
);

describe(parse, () => {
  it.prop([anyText])('should return a tree or throw a syntax error pointing inside the text for any text', (formula) => {
    try {
      const tree = parse(formula);

      expect(spanProblems(formula, tree)).toEqual([]);
    }
    catch (error) {
      expect(error).toBeInstanceOf(SyntaxError);

      const { location, message } = error as SyntaxError;

      expect(locationProblems(formula, location)).toEqual([]);
      expect(message).toMatch(new RegExp(`\\[${location.start.offset},${location.end.offset}\\]$`));
    }
  });

  it.prop([spacedFormula])('should parse a well-formed formula to the same tree whatever whitespace separates its tokens', ({ tokens, formula }) => {
    expect(withoutPositions(parse(formula))).toEqual(withoutPositions(parse(tokens.join(' '))));
  });

  it.prop([numberText])('should read a number literal as JavaScript reads it', (text) => {
    expect(parse(text)).toMatchObject({ type: 'Literal', value: Number(text), raw: text });
  });

  it.prop([fc.string({ unit: 'binary' })])('should read a quoted text literal as JavaScript reads it', (text) => {
    const source = JSON.stringify(text);

    expect(parse(source)).toMatchObject({ type: 'Literal', value: text, raw: source });
  });

  describe('Literals', () => {
    it('should parse a number', () => {
      const ast = parse('123');
      expect(ast).toEqual({
        type: 'Literal',
        value: 123,
        raw: '123',
        location: createLocation(0, 3),
      });
    });

    it('should parse a floating point number', () => {
      const ast = parse('123.45');
      expect(ast).toEqual({
        type: 'Literal',
        value: 123.45,
        raw: '123.45',
        location: createLocation(0, 6),
      });
    });

    it('should parse a string with double quotes', () => {
      const ast = parse('"hello"');
      expect(ast).toEqual({
        type: 'Literal',
        value: 'hello',
        raw: '"hello"',
        location: createLocation(0, 7),
      });
    });

    it('should parse a string with single quotes', () => {
      const ast = parse('\'world\'');
      expect(ast).toEqual({
        type: 'Literal',
        value: 'world',
        raw: '\'world\'',
        location: createLocation(0, 7),
      });
    });

    it('should parse boolean true', () => {
      const ast = parse('true');
      expect(ast).toEqual({
        type: 'Literal',
        value: true,
        raw: 'true',
        location: createLocation(0, 4),
      });
    });

    it('should parse boolean false', () => {
      const ast = parse('false');
      expect(ast).toEqual({
        type: 'Literal',
        value: false,
        raw: 'false',
        location: createLocation(0, 5),
      });
    });

    it('should parse null', () => {
      const ast = parse('null');
      expect(ast).toEqual({
        type: 'Literal',
        value: null,
        raw: 'null',
        location: createLocation(0, 4),
      });
    });
  });

  describe('Identifiers', () => {
    it('should parse an identifier', () => {
      const ast = parse('myVar');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'myVar',
        location: createLocation(0, 5),
      });
    });

    it('should parse an identifier with underscores and numbers', () => {
      const ast = parse('my_Var123');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'my_Var123',
        location: createLocation(0, 9),
      });
    });
  });

  describe('Binary Expressions', () => {
    it('should parse an addition expression', () => {
      const ast = parse('1 + 2');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'Literal', value: 1, raw: '1', location: createLocation(0, 1) },
        right: { type: 'Literal', value: 2, raw: '2', location: createLocation(4, 5) },
        location: createLocation(0, 5),
      });
    });

    it('should parse a subtraction expression with identifiers', () => {
      const ast = parse('a - b');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '-',
        left: { type: 'Identifier', name: 'a', location: createLocation(0, 1) },
        right: { type: 'Identifier', name: 'b', location: createLocation(4, 5) },
        location: createLocation(0, 5),
      });
    });

    it('should handle operator precedence (multiplication before addition)', () => {
      const ast = parse('1 + 2 * 3');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'Literal', value: 1, raw: '1', location: createLocation(0, 1) },
        right: {
          type: 'BinaryExpression',
          operator: '*',
          left: { type: 'Literal', value: 2, raw: '2', location: createLocation(4, 5) },
          right: { type: 'Literal', value: 3, raw: '3', location: createLocation(8, 9) },
          location: createLocation(4, 9),
        },
        location: createLocation(0, 9),
      });
    });

    it('should handle operator precedence with parentheses', () => {
      const ast = parse('(1 + 2) * 3');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '*',
        left: {
          type: 'BinaryExpression',
          operator: '+',
          left: { type: 'Literal', value: 1, raw: '1', location: createLocation(1, 2) },
          right: { type: 'Literal', value: 2, raw: '2', location: createLocation(5, 6) },
          location: createLocation(1, 6),
        },
        right: { type: 'Literal', value: 3, raw: '3', location: createLocation(10, 11) },
        location: createLocation(0, 11),
      });
    });

    it('should parse a simple power expression: 2 ^ 3', () => {
      const ast = parse('2 ^ 3');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '^',
        left: { type: 'Literal', value: 2, raw: '2', location: createLocation(0, 1) },
        right: { type: 'Literal', value: 3, raw: '3', location: createLocation(4, 5) },
        location: createLocation(0, 5),
      });
    });

    it('should handle right-associativity for power operator: 2 ^ 3 ^ 2', () => {
      const ast = parse('2 ^ 3 ^ 2');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '^',
        left: { type: 'Literal', value: 2, raw: '2', location: createLocation(0, 1) },
        right: {
          type: 'BinaryExpression',
          operator: '^',
          left: { type: 'Literal', value: 3, raw: '3', location: createLocation(4, 5) },
          right: { type: 'Literal', value: 2, raw: '2', location: createLocation(8, 9) },
          location: createLocation(4, 9),
        },
        location: createLocation(0, 9),
      });
    });

    it('should handle power operator with higher precedence multiplication: 2 * 3 ^ 2', () => {
      const ast = parse('2 * 3 ^ 2');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '*',
        left: { type: 'Literal', value: 2, raw: '2', location: createLocation(0, 1) },
        right: {
          type: 'BinaryExpression',
          operator: '^',
          left: { type: 'Literal', value: 3, raw: '3', location: createLocation(4, 5) },
          right: { type: 'Literal', value: 2, raw: '2', location: createLocation(8, 9) },
          location: createLocation(4, 9),
        },
        location: createLocation(0, 9),
      });
    });

    it('should handle power operator with lower precedence addition: 2 ^ 3 + 4', () => {
      const ast = parse('2 ^ 3 + 4');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '+',
        left: {
          type: 'BinaryExpression',
          operator: '^',
          left: { type: 'Literal', value: 2, raw: '2', location: createLocation(0, 1) },
          right: { type: 'Literal', value: 3, raw: '3', location: createLocation(4, 5) },
          location: createLocation(0, 5),
        },
        right: { type: 'Literal', value: 4, raw: '4', location: createLocation(8, 9) },
        location: createLocation(0, 9),
      });
    });

    it('should handle power operator with parentheses: (2 + 3) ^ 2', () => {
      const ast = parse('(2 + 3) ^ 2');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '^',
        left: {
          type: 'BinaryExpression',
          operator: '+',
          left: { type: 'Literal', value: 2, raw: '2', location: createLocation(1, 2) },
          right: { type: 'Literal', value: 3, raw: '3', location: createLocation(5, 6) },
          location: createLocation(1, 6),
        },
        right: { type: 'Literal', value: 2, raw: '2', location: createLocation(10, 11) },
        location: createLocation(0, 11),
      });
    });
  });

  describe('Unary Expressions', () => {
    it('should parse a negation expression', () => {
      const ast = parse('-5');
      expect(ast).toEqual({
        type: 'UnaryExpression',
        operator: '-',
        prefix: true,
        arg: { type: 'Literal', value: 5, raw: '5', location: createLocation(1, 2) },
        location: createLocation(0, 2),
      });
    });

    it('should parse a logical NOT expression', () => {
      const ast = parse('!true');
      expect(ast).toEqual({
        type: 'UnaryExpression',
        operator: '!',
        prefix: true,
        arg: { type: 'Literal', value: true, raw: 'true', location: createLocation(1, 5) },
        location: createLocation(0, 5),
      });
    });

    it('should parse "not x" as a unary NOT expression', () => {
      const ast = parse('not x');
      expect(ast).toEqual({
        type: 'UnaryExpression',
        operator: 'not',
        prefix: true,
        arg: { type: 'Identifier', name: 'x', location: createLocation(4, 5) },
        location: createLocation(0, 5),
      });
    });

    it('should parse "not(x)" without space as a unary NOT expression', () => {
      const ast = parse('not(x)');
      expect(ast).toEqual({
        type: 'UnaryExpression',
        operator: 'not',
        prefix: true,
        arg: { type: 'Identifier', name: 'x', location: createLocation(4, 5) },
        location: createLocation(0, 6),
      });
    });

    it('should parse chained unary negation: --5', () => {
      const ast = parse('--5');
      expect(ast).toEqual({
        type: 'UnaryExpression',
        operator: '-',
        prefix: true,
        arg: {
          type: 'UnaryExpression',
          operator: '-',
          prefix: true,
          arg: { type: 'Literal', value: 5, raw: '5', location: createLocation(2, 3) },
          location: createLocation(1, 3),
        },
        location: createLocation(0, 3),
      });
    });

    it('should parse chained unary negation with space: - - 5', () => {
      const ast = parse('- - 5');
      expect(ast).toEqual({
        type: 'UnaryExpression',
        operator: '-',
        prefix: true,
        arg: {
          type: 'UnaryExpression',
          operator: '-',
          prefix: true,
          arg: { type: 'Literal', value: 5, raw: '5', location: createLocation(4, 5) },
          location: createLocation(2, 5),
        },
        location: createLocation(0, 5),
      });
    });

    it('should parse chained "not not true"', () => {
      const ast = parse('not not true');
      expect(ast).toEqual({
        type: 'UnaryExpression',
        operator: 'not',
        prefix: true,
        arg: {
          type: 'UnaryExpression',
          operator: 'not',
          prefix: true,
          arg: { type: 'Literal', value: true, raw: 'true', location: createLocation(8, 12) },
          location: createLocation(4, 12),
        },
        location: createLocation(0, 12),
      });
    });
  });

  describe('Function Calls', () => {
    it('should parse a function call with no arguments', () => {
      const ast = parse('myFunction()');
      expect(ast).toEqual({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'myFunction', location: createLocation(0, 10) },
        args: [],
        location: createLocation(0, 12),
      });
    });

    it('should parse a function call with one literal argument', () => {
      const ast = parse('myFunction(123)');
      expect(ast).toEqual({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'myFunction', location: createLocation(0, 10) },
        args: [{ type: 'Literal', value: 123, raw: '123', location: createLocation(11, 14) }],
        location: createLocation(0, 15),
      });
    });

    it('should parse a function call with multiple arguments', () => {
      const ast = parse('myFunction(1, "test", true)');
      expect(ast).toEqual({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'myFunction', location: createLocation(0, 10) },
        args: [
          { type: 'Literal', value: 1, raw: '1', location: createLocation(11, 12) },
          { type: 'Literal', value: 'test', raw: '"test"', location: createLocation(14, 20) },
          { type: 'Literal', value: true, raw: 'true', location: createLocation(22, 26) },
        ],
        location: createLocation(0, 27),
      });
    });

    it('should parse a function call with an expression as an argument', () => {
      const ast = parse('myFunction(1 + 2)');
      expect(ast).toEqual({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'myFunction', location: createLocation(0, 10) },
        args: [
          {
            type: 'BinaryExpression',
            operator: '+',
            left: { type: 'Literal', value: 1, raw: '1', location: createLocation(11, 12) },
            right: { type: 'Literal', value: 2, raw: '2', location: createLocation(15, 16) },
            location: createLocation(11, 16),
          },
        ],
        location: createLocation(0, 17),
      });
    });

    it('should parse a function call with a function call without arguments as an argument', () => {
      const ast = parse('myFunction(nestedFunction())');
      expect(ast).toEqual({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'myFunction', location: createLocation(0, 10) },
        args: [
          {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'nestedFunction', location: createLocation(11, 25) },
            args: [],
            location: createLocation(11, 27),
          },
        ],
        location: createLocation(0, 28),
      });
    });

    it('should parse a function call with a function call with arguments as an argument', () => {
      const ast = parse('myFunction(nestedFunction(1 + 2))');
      expect(ast).toEqual({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'myFunction', location: createLocation(0, 10) },
        args: [
          {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'nestedFunction', location: createLocation(11, 25) },
            args: [
              {
                type: 'BinaryExpression',
                operator: '+',
                left: { type: 'Literal', value: 1, raw: '1', location: createLocation(26, 27) },
                right: { type: 'Literal', value: 2, raw: '2', location: createLocation(30, 31) },
                location: createLocation(26, 31),
              },
            ],
            location: createLocation(11, 32),
          },
        ],
        location: createLocation(0, 33),
      });
    });
  });

  describe('Member Expressions', () => {
    it('should parse a call expression on a member', () => {
      const ast = parse('object.property()');
      expect(ast).toEqual({
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'object', location: createLocation(0, 6) },
          property: { type: 'Identifier', name: 'property', location: createLocation(7, 15) },
          computed: false,
          location: createLocation(0, 17),
        },
        args: [],
        location: createLocation(0, 17),
      });
    });

    it('should parse a call expression on a member with an argument', () => {
      const ast = parse('object.property(arg1)');
      expect(ast).toEqual({
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'object', location: createLocation(0, 6) },
          property: { type: 'Identifier', name: 'property', location: createLocation(7, 15) },
          computed: false,
          location: createLocation(0, 21),
        },
        args: [
          { type: 'Identifier', name: 'arg1', location: createLocation(16, 20) },
        ],
        location: createLocation(0, 21),
      });
    });

    it('should throw SyntaxError when parsing a member expression with dot notation', () => {
      expect(() => {
        parse('object.property');
      }).toThrow('Expected function \'property()\' to be called. [6,15]');
    });

    it('should throw SyntaxError when parsing a member expression with bracket notation (string literal)', () => {
      expect(() => {
        parse('object["property"]');
      }).toThrow('Expected end of input but "[" found. [6,7]');
    });

    it('should throw SyntaxError when parsing a member expression with bracket notation (identifier)', () => {
      expect(() => {
        parse('object[prop]');
      }).toThrow('Expected end of input but "[" found. [6,7]');
    });

    it('should parse a chained member function expression with dot notation (object.prop1().prop2())', () => {
      const ast = parse('object.prop1().prop2()');
      expect(ast).toEqual({
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: { type: 'Identifier', name: 'object', location: createLocation(0, 6) },
              property: { type: 'Identifier', name: 'prop1', location: createLocation(7, 12) },
              computed: false,
              location: createLocation(0, 22),
            },
            args: [],
            location: createLocation(0, 22),
          },
          property: { type: 'Identifier', name: 'prop2', location: createLocation(15, 20) },
          computed: false,
          location: createLocation(0, 22),
        },
        args: [],
        location: createLocation(0, 22),
      });
    });

    it('should throw SyntaxError when parsing a chained member expression with dot notation', () => {
      expect(() => {
        parse('object.prop1.prop2');
      }).toThrow('Expected function \'prop1()\' to be called. [6,12]');
    });
  });

  describe('Array Expressions', () => {
    it('should parse an empty array', () => {
      const ast = parse('[]');
      expect(ast).toEqual({
        type: 'ArrayExpression',
        elements: [],
        location: createLocation(0, 2),
      });
    });

    it('should parse an array with literals', () => {
      const ast = parse('[1, "two", true]');
      expect(ast).toEqual({
        type: 'ArrayExpression',
        elements: [
          { type: 'Literal', value: 1, raw: '1', location: createLocation(1, 2) },
          { type: 'Literal', value: 'two', raw: '"two"', location: createLocation(4, 9) },
          { type: 'Literal', value: true, raw: 'true', location: createLocation(11, 15) },
        ],
        location: createLocation(0, 16),
      });
    });

    it('should parse an array with expressions', () => {
      const ast = parse('[1 + 2, myVar]');
      expect(ast).toEqual({
        type: 'ArrayExpression',
        elements: [
          {
            type: 'BinaryExpression',
            operator: '+',
            left: { type: 'Literal', value: 1, raw: '1', location: createLocation(1, 2) },
            right: { type: 'Literal', value: 2, raw: '2', location: createLocation(5, 6) },
            location: createLocation(1, 6),
          },
          { type: 'Identifier', name: 'myVar', location: createLocation(8, 13) },
        ],
        location: createLocation(0, 14),
      });
    });
  });

  describe('Conditional Expressions (ternary)', () => {
    it('should parse a simple conditional expression', () => {
      const ast = parse('a > b ? 1 : 0');
      expect(ast).toEqual({
        type: 'ConditionalExpression',
        test: {
          type: 'BinaryExpression',
          operator: '>',
          left: { type: 'Identifier', name: 'a', location: createLocation(0, 1) },
          right: { type: 'Identifier', name: 'b', location: createLocation(4, 5) },
          location: createLocation(0, 5),
        },
        consequent: { type: 'Literal', value: 1, raw: '1', location: createLocation(8, 9) },
        alternate: { type: 'Literal', value: 0, raw: '0', location: createLocation(12, 13) },
        location: createLocation(0, 13),
      });
    });

    it('should parse a nested conditional expression', () => {
      const ast = parse('a ? (b ? 1 : 2) : 3');
      expect(ast).toEqual({
        type: 'ConditionalExpression',
        test: { type: 'Identifier', name: 'a', location: createLocation(0, 1) },
        consequent: {
          type: 'ConditionalExpression',
          test: { type: 'Identifier', name: 'b', location: createLocation(5, 6) },
          consequent: { type: 'Literal', value: 1, raw: '1', location: createLocation(9, 10) },
          alternate: { type: 'Literal', value: 2, raw: '2', location: createLocation(13, 14) },
          location: createLocation(5, 14),
        },
        alternate: { type: 'Literal', value: 3, raw: '3', location: createLocation(18, 19) },
        location: createLocation(0, 19),
      });
    });
  });

  describe('Word boundary for keyword operators', () => {
    it('should parse "nothing" as an identifier, not "not" + "hing"', () => {
      const ast = parse('nothing');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'nothing',
        location: createLocation(0, 7),
      });
    });

    it('should parse "android" as an identifier, not "and" + "roid"', () => {
      const ast = parse('android');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'android',
        location: createLocation(0, 7),
      });
    });

    it('should parse "orange" as an identifier, not "or" + "ange"', () => {
      const ast = parse('orange');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'orange',
        location: createLocation(0, 6),
      });
    });

    it('should parse "inside" as an identifier, not "in" + "side"', () => {
      const ast = parse('inside');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'inside',
        location: createLocation(0, 6),
      });
    });

    it('should parse "notify" as an identifier, not "not" + "ify"', () => {
      const ast = parse('notify');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'notify',
        location: createLocation(0, 6),
      });
    });

    it('should parse "inArray" as an identifier, not "in" + "Array"', () => {
      const ast = parse('inArray');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'inArray',
        location: createLocation(0, 7),
      });
    });

    it('should still parse "a or b" as a logical OR expression', () => {
      const ast = parse('a or b');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: 'or',
        left: { type: 'Identifier', name: 'a', location: createLocation(0, 1) },
        right: { type: 'Identifier', name: 'b', location: createLocation(5, 6) },
        location: createLocation(0, 6),
      });
    });

    it('should still parse "a and b" as a logical AND expression', () => {
      const ast = parse('a and b');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: 'and',
        left: { type: 'Identifier', name: 'a', location: createLocation(0, 1) },
        right: { type: 'Identifier', name: 'b', location: createLocation(6, 7) },
        location: createLocation(0, 7),
      });
    });

    it('should still parse "x in y" as an "in" expression', () => {
      const ast = parse('x in y');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: 'in',
        left: { type: 'Identifier', name: 'x', location: createLocation(0, 1) },
        right: { type: 'Identifier', name: 'y', location: createLocation(5, 6) },
        location: createLocation(0, 6),
      });
    });
  });

  describe('Number literal extensions', () => {
    it('should parse scientific notation: 1e10', () => {
      const ast = parse('1e10');
      expect(ast).toEqual({
        type: 'Literal',
        value: 1e10,
        raw: '1e10',
        location: createLocation(0, 4),
      });
    });

    it('should parse scientific notation with decimal: 1.5e2', () => {
      const ast = parse('1.5e2');
      expect(ast).toEqual({
        type: 'Literal',
        value: 150,
        raw: '1.5e2',
        location: createLocation(0, 5),
      });
    });

    it('should parse scientific notation with negative exponent: 1.5e-2', () => {
      const ast = parse('1.5e-2');
      expect(ast).toEqual({
        type: 'Literal',
        value: 0.015,
        raw: '1.5e-2',
        location: createLocation(0, 6),
      });
    });

    it('should parse shorthand decimal: .5', () => {
      const ast = parse('.5');
      expect(ast).toEqual({
        type: 'Literal',
        value: 0.5,
        raw: '.5',
        location: createLocation(0, 2),
      });
    });

    it.each([
      { formula: '1.', location: createLocation(0, 2) },
      { formula: '1. ', location: createLocation(0, 2) },
    ])('should parse a number with a trailing dot as JavaScript does: "$formula"', ({ formula, location }) => {
      expect(parse(formula)).toEqual({ type: 'Literal', value: 1, raw: '1.', location });
    });

    it('should parse a trailing dot before an operator as part of the number', () => {
      expect(parse('1. + 2')).toMatchObject({ type: 'BinaryExpression', operator: '+', left: { type: 'Literal', value: 1, raw: '1.' } });
    });

    it('should call a method on a number with a trailing dot: 1..round()', () => {
      expect(parse('1..round()')).toMatchObject({ type: 'CallExpression', callee: { object: { type: 'Literal', value: 1, raw: '1.' }, property: { name: 'round' } } });
    });

    it('should keep a dot followed by a name as a method call: 1. round()', () => {
      expect(parse('1. round()')).toMatchObject({ type: 'CallExpression', callee: { object: { type: 'Literal', value: 1, raw: '1' }, property: { name: 'round' } } });
    });

    it('should parse capital E in scientific notation: 2E3', () => {
      const ast = parse('2E3');
      expect(ast).toEqual({
        type: 'Literal',
        value: 2000,
        raw: '2E3',
        location: createLocation(0, 3),
      });
    });
  });

  describe('Escape sequences', () => {
    it.each([
      { source: '"\\x41"', value: 'A' },
      { source: '"\\u{1F600}"', value: '\u{1F600}' },
      { source: '"\\u{41}"', value: 'A' },
      { source: '"\\0"', value: '\0' },
      { source: '"a\\\nb"', value: 'ab' },
      { source: '"a\\\r\nb"', value: 'ab' },
    ])('should read $source as JavaScript does', ({ source, value }) => {
      expect(parse(source)).toMatchObject({ type: 'Literal', value, raw: source });
    });

    it.each([
      { source: '"\\u12"', message: 'Invalid Unicode escape sequence. [1,5]' },
      { source: '"\\u{110000}"', message: 'Invalid Unicode escape sequence. [1,11]' },
      { source: '"\\u{41"', message: 'Invalid Unicode escape sequence. [1,6]' },
      { source: '"\\xZ1"', message: 'Invalid hexadecimal escape sequence. [1,3]' },
      { source: '"(a)\\1"', message: 'Escape sequence \\1 is not allowed; write \\\\1 for a backslash followed by 1. [4,6]' },
      { source: '"\\7"', message: 'Escape sequence \\7 is not allowed; write \\\\7 for a backslash followed by 7. [1,3]' },
      { source: '"\\8"', message: 'Escape sequence \\8 is not allowed; write \\\\8 for a backslash followed by 8. [1,3]' },
      { source: '"\\9"', message: 'Escape sequence \\9 is not allowed; write \\\\9 for a backslash followed by 9. [1,3]' },
      { source: '"\\01"', message: 'Escape sequence \\0 is not allowed before a digit; write \\\\0 for a backslash followed by 0. [1,3]' },
    ])('should reject the malformed escape in $source', ({ source, message }) => {
      expect(() => parse(source)).toThrow(message);
    });

    it.each([
      { source: '"abc', message: 'Unterminated string. [0,4]' },
      { source: '"\\', message: 'Unterminated string. [0,2]' },
      { source: '\'a\\', message: 'Unterminated string. [0,3]' },
    ])('should point at the whole text of the unterminated string $source', ({ source, message }) => {
      expect(() => parse(source)).toThrow(message);
    });
  });

  describe('Unicode escape sequences', () => {
    it('should parse a string with unicode escape \\u0041 as "A"', () => {
      const ast = parse('"\\u0041"');
      expect(ast).toEqual({
        type: 'Literal',
        value: 'A',
        raw: '"\\u0041"',
        location: createLocation(0, 8),
      });
    });

    it('should parse a string with unicode escape \\u0048\\u0049 as "HI"', () => {
      const ast = parse('"\\u0048\\u0049"');
      expect(ast).toEqual({
        type: 'Literal',
        value: 'HI',
        raw: '"\\u0048\\u0049"',
        location: createLocation(0, 14),
      });
    });
  });

  describe('Regular expression literals', () => {
    it('should parse a pattern with flags without doubling backslashes', () => {
      const ast = parse('/\\d[a-z]/gi');
      expect(ast).toEqual({
        type: 'Literal',
        value: /\d[a-z]/gi,
        raw: '/\\d[a-z]/gi',
        location: createLocation(0, 11),
      });
    });

    it('should parse a pattern without flags', () => {
      const ast = parse('/a.c/');
      expect(ast).toEqual({
        type: 'Literal',
        value: /a.c/,
        raw: '/a.c/',
        location: createLocation(0, 5),
      });
    });

    it('should keep an unescaped slash inside a character class in the pattern', () => {
      const ast = parse('/[/a]/');
      expect(ast).toMatchObject({ type: 'Literal', value: /[/a]/, raw: '/[/a]/' });
    });

    it('should keep an escaped slash in the pattern', () => {
      const ast = parse('/a\\/b/');
      expect(ast).toMatchObject({ type: 'Literal', value: /a\/b/, raw: '/a\\/b/' });
    });

    it('should parse a literal as a method argument', () => {
      const ast = parse('s.test(/a/i)');
      expect(ast).toMatchObject({
        type: 'CallExpression',
        args: [{ type: 'Literal', value: /a/i, location: createLocation(7, 11) }],
      });
    });

    it('should parse a method call on a literal', () => {
      const ast = parse('/a/.format()');
      expect(ast).toMatchObject({
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { type: 'Literal', value: /a/ },
          property: { name: 'format' },
        },
      });
    });

    it('should parse a slash after an operand as division and a slash in operand position as a literal', () => {
      const ast = parse('a / /b/');
      expect(ast).toMatchObject({
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'Identifier', name: 'a' },
        right: { type: 'Literal', value: /b/, location: createLocation(4, 7) },
      });
    });

    it('should keep chained division as division', () => {
      const ast = parse('a / b / c');
      expect(ast).toMatchObject({
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'BinaryExpression', operator: '/' },
        right: { type: 'Identifier', name: 'c' },
      });
    });

    it.each([
      { desc: 'missing closing slash', formula: '/abc', message: 'Unterminated regular expression. [0,4]' },
      { desc: 'closing slash only inside a character class', formula: '/[/', message: 'Unterminated regular expression. [0,3]' },
      { desc: 'escaped closing slash', formula: '/a\\/', message: 'Unterminated regular expression. [0,4]' },
      { desc: 'line break inside the pattern', formula: '/a\nb/', message: 'Unterminated regular expression. [0,2]' },
      { desc: 'empty pattern', formula: '//', message: 'Empty regular expression. [0,2]' },
      { desc: 'duplicated flag', formula: '/a/gg', message: 'Invalid regular expression flags "gg". [3,5]' },
      { desc: 'unknown flag', formula: '/a/x', message: 'Invalid regular expression flags "x". [3,4]' },
      { desc: 'invalid pattern', formula: '/(/', message: 'Invalid regular expression: /(/: Unterminated group. [0,3]' },
    ])('should throw SyntaxError for $desc', ({ formula, message }) => {
      expect(() => {
        parse(formula);
      }).toThrow(message);
    });
  });

  describe('Let expressions', () => {
    it('should parse names, their values and the body with exact locations', () => {
      expect(parse('let a = 1, b = a in a + b')).toEqual({
        type: 'LetExpression',
        declarations: [
          {
            name: { type: 'Identifier', name: 'a', location: createLocation(4, 5) },
            value: { type: 'Literal', value: 1, raw: '1', location: createLocation(8, 9) },
            location: createLocation(4, 9),
          },
          {
            name: { type: 'Identifier', name: 'b', location: createLocation(11, 12) },
            value: { type: 'Identifier', name: 'a', location: createLocation(15, 16) },
            location: createLocation(11, 16),
          },
        ],
        body: {
          type: 'BinaryExpression',
          operator: '+',
          left: { type: 'Identifier', name: 'a', location: createLocation(20, 21) },
          right: { type: 'Identifier', name: 'b', location: createLocation(24, 25) },
          location: createLocation(20, 25),
        },
        location: createLocation(0, 25),
      });
    });

    it('should extend the body as far as the expression goes', () => {
      expect(withoutPositions(parse('let a = 1 in a ? b : c'))).toEqual(withoutPositions(parse('let a = 1 in (a ? b : c)')));
    });

    it('should parse a let as a call argument, with the commas around it separating arguments', () => {
      expect(withoutPositions(parse('f(let a = 1 in a, 2)'))).toEqual({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'f' },
        args: [
          withoutPositions(parse('let a = 1 in a')),
          { type: 'Literal', value: 2 },
        ],
      });
    });

    it('should end the inner body at the "in" that ends the outer list', () => {
      expect(withoutPositions(parse('let a = let b = 1 in b in a'))).toEqual({
        type: 'LetExpression',
        declarations: [{ name: { type: 'Identifier', name: 'a' }, value: withoutPositions(parse('let b = 1 in b')) }],
        body: { type: 'Identifier', name: 'a' },
      });
    });

    it.each([
      { formula: 'let a = (k in o) in a', part: 'parentheses' },
      { formula: 'let a = has(k in o) in a', part: 'call arguments' },
      { formula: 'let a = [k in o] in a', part: 'a list' },
      { formula: 'let a = c ? k in o : 1 in a', part: 'the middle of "? :"' },
    ])('should read "in" in $part inside a value as the operator', ({ formula }) => {
      expect(JSON.stringify(withoutPositions(parse(formula)))).toContain('"operator":"in"');
    });

    it.each([
      { formula: 'let + 1', expected: { type: 'BinaryExpression', operator: '+', left: { type: 'Identifier', name: 'let' }, right: { type: 'Literal', value: 1 } } },
      { formula: 'let or x', expected: { type: 'BinaryExpression', operator: 'or', left: { type: 'Identifier', name: 'let' }, right: { type: 'Identifier', name: 'x' } } },
      { formula: 'let in x', expected: { type: 'BinaryExpression', operator: 'in', left: { type: 'Identifier', name: 'let' }, right: { type: 'Identifier', name: 'x' } } },
      { formula: 'let(x)', expected: { type: 'CallExpression', callee: { type: 'Identifier', name: 'let' }, args: [{ type: 'Identifier', name: 'x' }] } },
      { formula: 'const', expected: { type: 'Identifier', name: 'const' } },
    ])('should read "$formula" without a declaration, as before', ({ formula, expected }) => {
      expect(withoutPositions(parse(formula))).toEqual(expected);
    });

    it('should let a declared name match a function name', () => {
      expect(() => parse('let sum = sum([1]) in sum')).not.toThrow();
    });

    it.each([
      { formula: 'let a = 1 in a in b', error: 'Put "in" inside a "let" body in parentheses: "(a in b)". [15,17]' },
      { formula: 'let a 1 in a', error: 'Expected "=" after "a". [6,6]' },
      { formula: 'let a == 1 in a', error: 'Expected "=" after "a". [6,6]' },
      { formula: 'let a = 1', error: 'Expected "," or "in". [9,9]' },
      { formula: 'let a = 1; a', error: 'Expected "," or "in". [9,9]' },
      { formula: 'let a = 1, in a', error: '"in" cannot be a variable name. [11,13]' },
      { formula: 'let true = 1 in 1', error: '"true" cannot be a variable name. [4,8]' },
      { formula: 'let let = 1 in 1', error: '"let" cannot be a variable name. [4,7]' },
      { formula: 'let a = 1, a = 2 in a', error: 'Variable "a" is already declared in this "let". [11,12]' },
      { formula: 'let a = a in a', error: 'Variable "a" is used before its declaration. [8,9]' },
      { formula: 'let a = b, b = 1 in a', error: 'Variable "b" is used before its declaration. [8,9]' },
      { formula: 'let a = f(b.g()), b = 1 in a', error: 'Variable "b" is used before its declaration. [10,11]' },
      { formula: 'let b = 1 in let a = b, b = 2 in a', error: 'Variable "b" is used before its declaration. [21,22]' },
      { formula: 'const x = 1 in x', error: '"const" is reserved; declare names with "let". [0,5]' },
    ])('should reject "$formula"', ({ formula, error }) => {
      expect(() => parse(formula)).toThrow(error);
    });
  });

  describe('Syntax Errors', () => {
    it('should throw SyntaxError for an incomplete expression', () => {
      expect(() => {
        parse('1 +');
      }).toThrow('Expected end of input but "+" found. [2,3]');
    });

    it('should throw SyntaxError for an unexpected token', () => {
      expect(() => {
        parse('1 $ 2');
      }).toThrow('Expected end of input but "$" found. [2,3]');
    });

    it('should throw SyntaxError for empty parentheses', () => {
      expect(() => {
        parse('()');
      }).toThrow('Empty parentheses "()" are not a valid expression. [0,2]');
    });

    it('should throw SyntaxError for trailing comma in function call: func(a,)', () => {
      expect(() => {
        parse('func(a,)');
      }).toThrow('Unexpected comma or missing argument in function call. [6,7]');
    });

    it('should throw SyntaxError for leading comma in function call: func(,a)', () => {
      expect(() => {
        parse('func(,a)');
      }).toThrow('Arguments cannot start with a comma. [5,6]');
    });

    it('should throw SyntaxError for double comma in function call: func(a,,b)', () => {
      expect(() => {
        parse('func(a,,b)');
      }).toThrow('Unexpected comma or missing argument in function call. [6,7]');
    });

    it('should throw SyntaxError for standalone member access without function call', () => {
      expect(() => {
        parse('user.name');
      }).toThrow('Expected function \'name()\' to be called. [4,9]');
    });

    it('should throw SyntaxError for unclosed parentheses for direct function call', () => {
      expect(() => {
        parse('name(');
      }).toThrow('Expected token ")". [4,5]');
    });

    it('should throw SyntaxError for unclosed parentheses for member function call', () => {
      expect(() => {
        parse('user.name(');
      }).toThrow('Expected token ")". [9,10]');
    });

    it('should throw SyntaxError for unclosed parentheses with arguments for direct function call', () => {
      expect(() => {
        parse('name("abc"');
      }).toThrow('Expected token ")". [4,10]');
    });

    it('should throw SyntaxError for unclosed parentheses with arguments for member function call', () => {
      expect(() => {
        parse('user.name("abc"');
      }).toThrow('Expected token ")". [9,15]');
    });

    it('should throw SyntaxError for unexpected token after closing parentheses', () => {
      expect(() => {
        parse('name("abc")x');
      }).toThrow('Expected end of input but "x" found. [11,12]');
    });
  });
});

function createLocation(start: number, end: number): Location {
  return {
    start: { offset: start, line: 1, column: start + 1 },
    end: { offset: end, line: 1, column: end + 1 },
  };
}

/** Reasons the location breaks the text: offsets outside it, or a line and column that do not match the offset. */
function locationProblems(formula: string, location: Location): string[] {
  const { start, end } = location;
  const problems: string[] = [];

  if (start.offset < 0 || start.offset > end.offset || end.offset > formula.length) {
    problems.push(`[${start.offset},${end.offset}] is outside a text of length ${formula.length}`);
  }

  for (const point of [start, end]) {
    const expected = positionAt(formula, point.offset);

    if (point.line !== expected.line || point.column !== expected.column) {
      problems.push(`offset ${point.offset} is at ${expected.line}:${expected.column}, not ${point.line}:${point.column}`);
    }
  }

  return problems;
}

/** Location problems of every node, plus nodes that reach outside their parent. */
function spanProblems(formula: string, node: AstNode, parent?: Location): string[] {
  const { location } = node;
  const outside = parent !== undefined && (location.start.offset < parent.start.offset || location.end.offset > parent.end.offset);
  const own = [...locationProblems(formula, location), ...(outside ? [`${node.type} at [${location.start.offset},${location.end.offset}] is outside its parent`] : [])];

  return [...own, ...childrenOf(node).flatMap((child) => spanProblems(formula, child, location))];
}

function childrenOf(node: AstNode): AstNode[] {
  switch (node.type) {
    case 'UnaryExpression':
      return [node.arg];
    case 'BinaryExpression':
      return [node.left, node.right];
    case 'CallExpression':
      return [node.callee, ...node.args];
    case 'MemberExpression':
      return [node.object, node.property];
    case 'ConditionalExpression':
      return [node.test, node.consequent, node.alternate];
    case 'ArrayExpression':
      return node.elements;
    case 'LetExpression':
      return [...node.declarations.flatMap(({ name, value }) => [name, value]), node.body];
    case 'Identifier':
    case 'Literal':
      return [];
  }
}

function positionAt(formula: string, offset: number): { readonly line: number; readonly column: number } {
  const before = formula.slice(0, offset);
  const lineStart = before.lastIndexOf('\n') + 1;

  return { line: before.split('\n').length, column: offset - lineStart + 1 };
}

/** The tree without locations and source text, to compare trees parsed from differently spaced formulas. */
function withoutPositions(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutPositions);
  }

  if (value === null || typeof value !== 'object' || value instanceof RegExp) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'location' && key !== 'raw').map(([key, item]) => [key, withoutPositions(item)]));
}

function group(tokens: readonly string[]): string[] {
  return tokens.length === 1 ? [...tokens] : ['(', ...tokens, ')'];
}

function commaSeparated(groups: readonly (readonly string[])[]): string[] {
  return groups.flatMap((tokens, index) => (index === 0 ? [...tokens] : [',', ...tokens]));
}
