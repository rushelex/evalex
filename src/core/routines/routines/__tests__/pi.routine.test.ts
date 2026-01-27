import { FormulaNumber } from '../../../data-types';
import { RoutineTestRunner } from '../../test-helpers/routine-test-runner';

const runner = new RoutineTestRunner('pi');

describe('pi routine', runner.testSuites([
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
