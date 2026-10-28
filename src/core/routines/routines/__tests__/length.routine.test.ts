import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('length');

describe('length routine', tester.examples([
  {
    formula: '"hello".length()',
    expected: new FormulaNumber(5),
  },
  {
    formula: '"".length()',
    expected: new FormulaNumber(0),
  },
  {
    formula: '"привет".length()',
    expected: new FormulaNumber(6),
  },
  {
    formula: '"😀".length()',
    expected: new FormulaNumber(1),
  },
  {
    formula: '"👨‍👩‍👧".length()',
    expected: new FormulaNumber(1),
  },
  {
    formula: '"é".length()',
    expected: new FormulaNumber(1),
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
        message: 'Expected type String | Array.',
        location: [7, 8],
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
        message: 'Expected type String | Array.',
        location: [7, 10],
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
