import { FormulaBoolean } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"contains" method routine', new RoutineTester('contains').examples({
  skipFunction: true,
}, [
  {
    formula: '"Hello world".contains("wor")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"Hello world".contains("\\\\d+")',
    expected: new FormulaBoolean(false),
  },
  {
    formula: '"Hello 123".contains("\\\\d+")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"Hello".contains("hello", "i")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"test".contains("[")',
    expected: {
      method: {
        message: 'Invalid regular expression: /[/: Unterminated character class.',
        location: [7, 15],
      },
    },
  },
]));
