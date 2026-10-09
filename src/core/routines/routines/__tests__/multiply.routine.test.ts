import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('multiply');

describe('multiply routine', tester.examples([
  {
    formula: '(-2).multiply(3)',
    expected: new FormulaNumber(-6),
  },
  {
    formula: '(0.1).multiply(3)',
    expected: new FormulaNumber(0.1 * 3),
  },
]));
