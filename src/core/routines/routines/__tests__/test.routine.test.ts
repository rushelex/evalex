import { FormulaBoolean, FormulaRegExp } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"test" method routine', new RoutineTester('test').examples({
  skipFunction: true,
}, [
  {
    formula: '"Hello 123".test("\\\\d+")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"Hello world".test("\\\\d+")',
    expected: new FormulaBoolean(false),
  },
  {
    formula: '"Hello".test("hello")',
    expected: new FormulaBoolean(false),
  },
  {
    formula: '"Hello".test("hello", "i")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"abc".test("a.c")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"Hello".test(regexp)',
    context: {
      regexp: new FormulaRegExp('hello', 'i'),
    },
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"a1".test(regexp)',
    context: {
      regexp: new FormulaRegExp('\\d', 'g'),
    },
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"Hello".test(regexp, "i")',
    context: {
      regexp: new FormulaRegExp('hello', ''),
    },
    expected: {
      method: {
        message: 'Expected type String.',
        location: [13, 19],
      },
    },
  },
  {
    formula: '"abc".test("b", "z")',
    expected: {
      method: {
        message: 'Invalid flags supplied to RegExp constructor \'z\'.',
        location: [6, 10],
      },
    },
  },
  {
    formula: '"test".test("[")',
    expected: {
      method: {
        message: 'Invalid regular expression: /[/: Unterminated character class.',
        location: [7, 11],
      },
    },
  },
]));
