import { FormulaRegExp, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('replaceAll routine', new RoutineTester('replaceAll').examples([
  {
    formula: '"Hello 123 world 456".replaceAll("\\\\d+", "XXX")',
    expected: new FormulaString('Hello XXX world XXX'),
  },
  {
    formula: '"foo bar foo baz".replaceAll("foo", "qux")',
    expected: new FormulaString('qux bar qux baz'),
  },
  {
    formula: '"Hello HELLO hello".replaceAll(/hello/i, "hi")',
    expected: new FormulaString('hi hi hi'),
  },
  {
    formula: '"Hello HELLO hello".replaceAll("hello", "hi", "i")',
    expected: {
      method: {
        message: 'Expected 2 arguments.',
        location: [20, 30],
      },
    },
  },
  {
    formula: '"Hello world".replaceAll("\\\\d+", "XXX")',
    expected: new FormulaString('Hello world'),
  },
  {
    formula: '"a.b.c".replaceAll(".", "-")',
    expected: new FormulaString('-----'),
  },
  {
    formula: '"a.b.c".replaceAll("\\\\.", "-")',
    expected: new FormulaString('a-b-c'),
  },
  {
    formula: '"abc".replaceAll("", "-")',
    expected: new FormulaString('-a-b-c-'),
  },
  {
    formula: '"a1 b2".replaceAll("([a-z])(\\\\d)", "$2$1")',
    expected: new FormulaString('1a 2b'),
  },
  {
    formula: '"aXbx".replaceAll(regexp, "-")',
    context: {
      regexp: new FormulaRegExp('x', 'i'),
    },
    expected: new FormulaString('a-b-'),
  },
  {
    formula: '"test".replaceAll("[", "replacement")',
    expected: {
      method: {
        message: 'Invalid regular expression: /[/: Unterminated character class.',
        location: [7, 17],
      },
    },
  },
]));
