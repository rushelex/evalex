import { FormulaNumber, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('add');

describe('add routine', tester.examples([
  {
    formula: '(0.1).add(0.2)',
    expected: new FormulaNumber(0.1 + 0.2),
  },
  {
    formula: '(-5).add(5)',
    expected: new FormulaNumber(0),
  },
  {
    formula: '"Formula".add(" 2.0")',
    expected: new FormulaString('Formula 2.0'),
  },
  {
    formula: '(1).add("1")',
    expected: {
      function: {
        message: 'Expected type Number.',
        location: [9, 12],
      },
      method: {
        message: 'Expected type Number.',
        location: [8, 11],
      },
    },
  },
]));
