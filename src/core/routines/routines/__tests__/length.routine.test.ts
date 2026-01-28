import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-test-runner';

const tester = new RoutineTester('length');

describe('length routine', tester.testSuites([
  {
    formula: '"hello".length()',
    expected: new FormulaNumber(5),
  },
  {
    formula: '"".length()',
    expected: new FormulaNumber(0),
  },
  {
    formula: '[1, 2, 3].length()',
    expected: new FormulaNumber(3),
  },
  {
    formula: '[].length()',
    expected: new FormulaNumber(0),
  },
  {
    formula: '0.length()',
    expected: {
      function: {
        message: 'Arguments don\'t match. Pattern 1: Expected type string.; Pattern 2: Expected type array.',
        location: [0, 9],
      },
      method: {
        message: 'Method "length" is not defined.',
        location: [2, 8],
      },
    },
  },
  {
    formula: '123.length()',
    expected: {
      function: {
        message: 'Arguments don\'t match. Pattern 1: Expected type string.; Pattern 2: Expected type array.',
        location: [0, 11],
      },
      method: {
        message: 'Method "length" is not defined.',
        location: [4, 10],
      },
    },
  },
  {
    formula: 'length()',
    expected: {
      function: {
        message: 'Expected at least 1 argument(s).',
        location: [0, 8],
      },
    },
  },
]));
