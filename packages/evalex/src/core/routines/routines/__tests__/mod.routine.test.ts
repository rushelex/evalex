import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('mod');

describe('mod routine', tester.examples([
  {
    formula: '(-7).mod(3)',
    expected: new FormulaNumber(-1),
  },
  {
    formula: '(7.5).mod(2)',
    expected: new FormulaNumber(1.5),
  },
  {
    formula: '(7).mod(0)',
    expected: {
      function: {
        message: 'Division by zero (modulo).',
        location: [9, 10],
      },
      method: {
        message: 'Division by zero (modulo).',
        location: [8, 9],
      },
    },
  },
]));
