import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-test-runner';

const tester = new RoutineTester('sum');

describe('sum routine', tester.testSuites([
  {
    formula: 'sum(1, 2, 3)',
    expected: new FormulaNumber(6),
  },
  {
    formula: 'sum(1)',
    expected: new FormulaNumber(1),
  },
  {
    formula: 'sum(0)',
    expected: new FormulaNumber(0),
  },
  {
    formula: 'sum(-1)',
    expected: new FormulaNumber(-1),
  },
  {
    formula: '1.sum(2)',
    expected: new FormulaNumber(3),
  },
  {
    formula: '1.sum(2, 3)',
    expected: new FormulaNumber(6),
  },
  {
    formula: '1.sum([2, 3])',
    expected: new FormulaNumber(6),
  },
  {
    formula: '1.sum([])',
    expected: new FormulaNumber(1),
  },
  {
    formula: '1.sum([2, 3, [4, 5]])',
    expected: new FormulaNumber(15),
  },
  {
    formula: '[1, 2, 3].sum()',
    expected: new FormulaNumber(6),
  },
  {
    formula: '[1, [2, 3, [4, 5]]].sum()',
    expected: new FormulaNumber(15),
  },
  {
    formula: 'sum("1", 2, 3)',
    expected: {
      function: {
        message: 'Expected type array | number.',
        location: [4, 7],
      },
    },
  },
  {
    formula: 'sum([1, 2], "3", 4, 5)',
    expected: {
      function: {
        message: 'Expected type array | number.',
        location: [12, 15],
      },
    },
  },
  {
    formula: 'sum(1, "2", 3)',
    expected: {
      function: {
        message: 'Expected type array | number.',
        location: [7, 10],
      },
    },
  },
]));
