import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-test-runner';

const tester = new RoutineTester('log10');

describe('log10 routine', tester.testSuites([
  {
    formula: '1.log10()',
    expected: new FormulaNumber(0),
  },
  {
    formula: '100.log10()',
    expected: new FormulaNumber(2),
  },
  {
    formula: 'log10()',
    expected: {
      function: {
        message: 'Expected at least 1 argument(s).',
        location: [0, 7],
      },
    },
  },
  {
    formula: '0.log10()',
    expected: {
      function: {
        message: 'Expected positive number.',
        location: [6, 7],
      },
      method: {
        message: 'Expected positive number.',
        location: [2, 7],
      },
    },
  },
  {
    formula: '(-1).log10()',
    expected: {
      function: {
        message: 'Expected positive number.',
        location: [7, 9],
      },
      method: {
        message: 'Expected positive number.',
        location: [5, 10],
      },
    },
  },
]));
