import { FormulaBoolean } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"equal" method routine', new RoutineTester('equal').examples({
  skipFunction: true,
}, [
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
