import type { Location } from './ast';

import { parse } from './parse';

describe(parse, () => {
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

  describe('Unicode escape sequences', () => {
    it('should parse a string with unicode escape \\u0041 as "A"', () => {
      const ast = parse('"\\u0041"');
      expect(ast).toEqual({
        type: 'Literal',
        value: 'A',
        raw: '"A"',
        location: createLocation(0, 8),
      });
    });

    it('should parse a string with unicode escape \\u0048\\u0049 as "HI"', () => {
      const ast = parse('"\\u0048\\u0049"');
      expect(ast).toEqual({
        type: 'Literal',
        value: 'HI',
        raw: '"HI"',
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
