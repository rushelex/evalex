import { FormulaNull, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('mean');

describe('mean routine', tester.examples([
  {
    formula: '[1, 2].mean()',
    expected: new FormulaNumber(1.5),
  },
  {
    formula: '(-4).mean([4, [6]])',
    expected: new FormulaNumber(2),
  },
  {
    formula: '[].mean()',
    expected: new FormulaNull(),
  },
  {
    formula: '["a", 1].mean()',
    expected: {
      function: {
        message: 'All arguments must be numbers.',
        location: [0, 14],
      },
      method: {
        message: 'All arguments must be numbers.',
        location: [9, 13],
      },
    },
  },
]));
