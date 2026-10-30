import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('subtract');

describe('subtract routine', tester.examples([
  {
    formula: '(0.3).subtract(0.1)',
    expected: new FormulaNumber(0.3 - 0.1),
  },
  {
    formula: '(-5).subtract(-5)',
    expected: new FormulaNumber(0),
  },
]));
