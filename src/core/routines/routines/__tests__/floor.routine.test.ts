import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('floor');

describe('floor routine', tester.examples([
  {
    formula: '(1.8).floor()',
    expected: new FormulaNumber(1),
  },
  {
    formula: '(-0.6).floor()',
    expected: new FormulaNumber(-1),
  },
]));
