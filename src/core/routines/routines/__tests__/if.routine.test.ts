import { FormulaArray, FormulaNumber, FormulaObject, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('if');

describe('if routine', tester.examples({
  skipMethod: true,
}, [
  {
    formula: 'if(true, 1, 2)',
    expected: new FormulaNumber(1),
  },
  {
    formula: 'if(false, 1, 2)',
    expected: new FormulaNumber(2),
  },
  {
    formula: 'if("", "a", "b")',
    expected: new FormulaString('b'),
  },
  {
    formula: 'if((users.map(current.age()).length() >= 3 ? "many" : "a few") == "a few", "a", "b")',
    context: {
      users: new FormulaArray([
        new FormulaObject({ name: new FormulaString('John'), age: new FormulaNumber(42) }),
        new FormulaObject({ name: new FormulaString('Jane'), age: new FormulaNumber(101) }),
      ]),
    },
    expected: new FormulaString('a'),
  },
  {
    formula: 'if(true, 1)',
    expected: {
      function: {
        message: 'Expected 3 arguments.',
        location: [0, 11],
      },
    },
  },
]));
