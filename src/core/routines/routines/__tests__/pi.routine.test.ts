import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-test-runner';

const tester = new RoutineTester('pi');

describe('pi routine', tester.testSuites([
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
