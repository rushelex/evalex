import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('ceil');

describe('ceil routine', tester.examples([
  {
    formula: '(1.2).ceil()',
    expected: new FormulaNumber(2),
  },
  {
    formula: '(-0.6).ceil()',
    expected: new FormulaNumber(0),
  },
]));
