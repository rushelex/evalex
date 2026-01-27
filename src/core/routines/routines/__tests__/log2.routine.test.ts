import { FormulaNumber } from '../../../data-types';
import { RoutineTestRunner } from '../../test-helpers/routine-test-runner';

const runner = new RoutineTestRunner('log2');

describe('log2 routine', runner.testSuites([
  {
    formula: '1.log2()',
    expected: new FormulaNumber(0),
  },
  {
    formula: '8.log2()',
    expected: new FormulaNumber(3),
  },
  {
    formula: 'log2()',
    expected: {
      function: {
        message: 'Expected at least 1 argument(s).',
        location: [0, 6],
      },
    },
  },
  {
    formula: '0.log2()',
    expected: {
      function: {
        message: 'Expected positive number.',
        location: [5, 6],
      },
      method: {
        message: 'Expected positive number.',
        location: [2, 6],
      },
    },
  },
  {
    formula: '(-1).log2()',
    expected: {
      function: {
        message: 'Expected positive number.',
        location: [6, 8],
      },
      method: {
        message: 'Expected positive number.',
        location: [5, 9],
      },
    },
  },
]));
