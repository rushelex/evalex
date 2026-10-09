import { FormulaBoolean } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('equal routine', new RoutineTester('equal').examples([
  {
    formula: 'true.equal(true)',
    expected: new FormulaBoolean(true),
  },
  {
    formula: 'true.equal(false)',
    expected: new FormulaBoolean(false),
  },
  {
    formula: '"1".equal("1")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '1.equal("1")',
    expected: new FormulaBoolean(false),
  },
]));
