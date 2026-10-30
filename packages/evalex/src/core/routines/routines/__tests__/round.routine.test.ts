import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('round');

describe('round routine', tester.examples([
  {
    formula: '(2.5).round()',
    expected: new FormulaNumber(3),
  },
  {
    formula: '(-2.5).round()',
    expected: new FormulaNumber(-2),
  },
  {
    formula: '(-0.4).round()',
    expected: new FormulaNumber(0),
  },
  {
    formula: '(1.005).round(2)',
    expected: new FormulaNumber(1.01),
  },
  {
    formula: '1250.round(-2)',
    expected: new FormulaNumber(1300),
  },
  {
    formula: '(0.000001234).round(8)',
    expected: new FormulaNumber(0.00000123),
  },
  {
    formula: '(1.5).round(400)',
    expected: new FormulaNumber(1.5),
  },
  {
    formula: '1234.round(-400)',
    expected: new FormulaNumber(0),
  },
  {
    formula: '1.round(0.5)',
    expected: {
      function: {
        message: 'Expected integer.',
        location: [9, 12],
      },
      method: {
        message: 'Expected integer.',
        location: [8, 11],
      },
    },
  },
]));
