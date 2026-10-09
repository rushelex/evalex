import { FormulaArray, FormulaRegExp, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"match" method routine', new RoutineTester('match').examples({
  skipFunction: true,
}, [
  {
    formula: '"Hello 42 world 101".match("\\\\d+", "g")',
    expected: new FormulaArray([new FormulaString('42'), new FormulaString('101')]),
  },
  {
    formula: '"Hello 42 world 101".match("\\\\d+")',
    expected: new FormulaArray([new FormulaString('42'), new FormulaString('101')]),
  },
  {
    formula: '"a1b2".match("([a-z])(\\\\d)")',
    expected: new FormulaArray([new FormulaString('a1'), new FormulaString('b2')]),
  },
  {
    formula: '"a1b2".match(regexp)',
    context: {
      regexp: new FormulaRegExp('[a-z]', ''),
    },
    expected: new FormulaArray([new FormulaString('a'), new FormulaString('b')]),
  },
  {
    formula: '"Hello world".match("\\\\d+")',
    expected: new FormulaArray([]),
  },
  {
    formula: '"Hello WORLD".match("hello", "i")',
    expected: new FormulaArray([new FormulaString('Hello')]),
  },
  {
    formula: '"test".match(42)',
    expected: {
      method: {
        message: 'Arguments don\'t match. Pattern 1: Expected type String.; Pattern 2: Expected type RegExp.',
        location: [7, 12],
      },
    },
  },
  {
    formula: '"test".match(regexp, "g")',
    context: {
      regexp: new FormulaRegExp('test', 'i'),
    },
    expected: {
      method: {
        message: 'Expected type String.',
        location: [13, 19],
      },
    },
  },
  {
    formula: '"test".match("[")',
    expected: {
      method: {
        message: 'Invalid regular expression: /[/: Unterminated character class.',
        location: [7, 12],
      },
    },
  },
]));
