import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('divide');

describe('divide routine', tester.examples([
  {
    formula: '(1).divide(3)',
    expected: new FormulaNumber(1 / 3),
  },
  {
    formula: '(-6).divide(4)',
    expected: new FormulaNumber(-1.5),
  },
  {
    formula: '(6).divide(0)',
    expected: {
      function: {
        message: 'Division by zero.',
        location: [12, 13],
      },
      method: {
        message: 'Division by zero.',
        location: [11, 12],
      },
    },
  },
]));
