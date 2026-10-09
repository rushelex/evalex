import { FormulaNull, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('median');

describe('median routine', tester.examples([
  {
    formula: '[3, 1, 2].median()',
    expected: new FormulaNumber(2),
  },
  {
    formula: '10.median([1, 2, 3])',
    expected: new FormulaNumber(2.5),
  },
  {
    formula: '5.median()',
    expected: new FormulaNumber(5),
  },
  {
    formula: '[].median()',
    expected: new FormulaNull(),
  },
  {
    formula: '["a", 1].median()',
    expected: {
      function: {
        message: 'All arguments must be numbers.',
        location: [0, 16],
      },
      method: {
        message: 'All arguments must be numbers.',
        location: [9, 15],
      },
    },
  },
]));
