import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('exp');

describe('exp routine', tester.examples([
  {
    formula: '0.exp()',
    expected: new FormulaNumber(1),
  },
  {
    formula: '(-1).exp()',
    expected: new FormulaNumber(Math.exp(-1)),
  },
]));
