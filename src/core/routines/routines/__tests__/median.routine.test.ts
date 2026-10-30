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
        message: 'Expected type Number, or lists of it.',
        location: [7, 15],
      },
      method: {
        message: 'Expected type Number, or lists of it.',
        location: [9, 15],
      },
    },
  },
]));
