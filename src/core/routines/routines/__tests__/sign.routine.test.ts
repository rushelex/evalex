import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('sign');

describe('sign routine', tester.examples([
  {
    formula: '(0.5).sign()',
    expected: new FormulaNumber(1),
  },
  {
    formula: '(-0.5).sign()',
    expected: new FormulaNumber(-1),
  },
  {
    formula: '(-0).sign()',
    expected: new FormulaNumber(0),
  },
]));
