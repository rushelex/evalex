import { FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"replace" method routine', new RoutineTester('replace').examples({
  skipFunction: true,
}, [
  {
    formula: '"Hello world".replace("world", "universe")',
    expected: new FormulaString('Hello universe'),
  },
  {
    formula: '"Hello 123 world 456".replace("\\\\d+", "XXX")',
    expected: new FormulaString('Hello XXX world 456'),
  },
  {
    formula: '"Hello WORLD".replace("world", "universe", "i")',
    expected: new FormulaString('Hello universe'),
  },
  {
    formula: '"Hello world".replace("\\\\d+", "XXX")',
    expected: new FormulaString('Hello world'),
  },
  {
    formula: '"test".replace("[", "replacement")',
    expected: {
      method: {
        message: 'Invalid regular expression: /[/: Unterminated character class.',
        location: [7, 14],
      },
    },
  },
]));
