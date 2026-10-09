import { FormulaNull, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('min');

describe('min routine', tester.examples([
  {
    formula: 'min(3, 1, 2)',
    expected: new FormulaNumber(1),
  },
  {
    formula: '[3, [1, 2]].min()',
    expected: new FormulaNumber(1),
  },
  {
    formula: '5.min([7, -2])',
    expected: new FormulaNumber(-2),
  },
  {
    formula: '[].min()',
    expected: new FormulaNull(),
  },
  {
    formula: '["a", 1].min()',
    expected: {
      function: {
        message: 'All arguments must be numbers.',
        location: [0, 13],
      },
      method: {
        message: 'All arguments must be numbers.',
        location: [9, 12],
      },
    },
  },
]));
