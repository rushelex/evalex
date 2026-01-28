import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('pi');

describe('pi routine', tester.examples([
  {
    formula: 'pi()',
    expected: new FormulaNumber(Math.PI),
  },
  {
    formula: 'pi(1)',
    expected: {
      function: {
        message: 'Expected 0 argument(s).',
        location: [0, 5],
      },
    },
  },
]));
