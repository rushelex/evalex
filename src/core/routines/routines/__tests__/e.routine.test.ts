import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-test-runner';

const tester = new RoutineTester('e');

describe('e routine', tester.testSuites([
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
