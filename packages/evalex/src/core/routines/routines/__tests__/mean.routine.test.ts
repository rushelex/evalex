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
        message: 'Expected type Number, or lists of it.',
        location: [5, 13],
      },
      method: {
        message: 'Expected type Number, or lists of it.',
        location: [9, 13],
      },
    },
  },
]));
