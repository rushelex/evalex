import { FormulaNumber } from '../../../data-types';
import { RoutineTestRunner } from '../../test-helpers/routine-test-runner';

const runner = new RoutineTestRunner('e');

describe('e routine', runner.testSuites([
  {
    formula: 'e()',
    expected: new FormulaNumber(Math.E),
  },
  {
    formula: 'e(1)',
    expected: {
      function: {
        message: 'Expected 0 argument(s).',
        location: [0, 4],
      },
    },
  },
]));
