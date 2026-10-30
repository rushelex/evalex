import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('e');

describe('e routine', tester.examples([
  {
    formula: 'e()',
    expected: new FormulaNumber(Math.E),
  },
  {
    formula: 'e(1)',
    expected: {
      function: {
        message: 'Expected no arguments.',
        location: [0, 4],
      },
    },
  },
]));
