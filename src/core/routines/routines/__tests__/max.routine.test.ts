import { FormulaNull, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('max');

describe('max routine', tester.examples([
  {
    formula: 'max(1, 3, 2)',
    expected: new FormulaNumber(3),
  },
  {
    formula: '[1, [3, 2]].max()',
    expected: new FormulaNumber(3),
  },
  {
    formula: '(-5).max([-7, -2])',
    expected: new FormulaNumber(-2),
  },
  {
    formula: '[].max()',
    expected: new FormulaNull(),
  },
  {
    formula: '["a", 1].max()',
    expected: {
      function: {
        message: 'Expected type Number, or lists of it.',
        location: [4, 12],
      },
      method: {
        message: 'Expected type Number, or lists of it.',
        location: [9, 12],
      },
    },
  },
]));
