import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('cbrt');

describe('cbrt routine', tester.examples([
  {
    formula: '(-27).cbrt()',
    expected: new FormulaNumber(-3),
  },
  {
    formula: '(0.125).cbrt()',
    expected: new FormulaNumber(0.5),
  },
]));
