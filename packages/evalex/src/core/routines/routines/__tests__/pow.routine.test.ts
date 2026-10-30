import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('pow');

describe('pow routine', tester.examples([
  {
    formula: '(2).pow(-1)',
    expected: new FormulaNumber(0.5),
  },
  {
    formula: '(9).pow(0.5)',
    expected: new FormulaNumber(3),
  },
]));
