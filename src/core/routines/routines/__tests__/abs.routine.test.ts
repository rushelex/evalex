import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('abs');

describe('abs routine', tester.examples([
  {
    formula: '(-2.5).abs()',
    expected: new FormulaNumber(2.5),
  },
  {
    formula: '3.abs()',
    expected: new FormulaNumber(3),
  },
]));
