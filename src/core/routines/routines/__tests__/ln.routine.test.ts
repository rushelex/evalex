import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('ln');

describe('ln routine', tester.examples([
  {
    formula: '1.ln()',
    expected: new FormulaNumber(0),
  },
  {
    formula: 'e().ln()',
    expected: new FormulaNumber(1),
  },
  {
    formula: '0.ln()',
    expected: {
      function: {
        message: 'Expected positive number.',
        location: [3, 4],
      },
      method: {
        message: 'Expected positive number.',
        location: [2, 4],
      },
    },
  },
]));
