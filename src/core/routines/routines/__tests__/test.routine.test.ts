import { FormulaBoolean } from '../../../data-types';
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
    formula: '"Hello".test("hello", "i")',
    expected: new FormulaBoolean(true),
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
