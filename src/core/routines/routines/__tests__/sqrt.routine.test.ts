import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('sqrt');

describe('sqrt routine', tester.examples([
  {
    formula: '0.sqrt()',
    expected: new FormulaNumber(0),
  },
  {
    formula: '(2.25).sqrt()',
    expected: new FormulaNumber(1.5),
  },
  {
    formula: '(-4).sqrt()',
    expected: {
      function: {
        message: 'Expected non-negative number.',
        location: [6, 8],
      },
      method: {
        message: 'Expected non-negative number.',
        location: [5, 9],
      },
    },
  },
]));
