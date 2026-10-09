import { FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"trim" method routine', new RoutineTester('trim').examples({
  skipFunction: true,
}, [
  {
    formula: '"  hello  ".trim()',
    expected: new FormulaString('hello'),
  },
  {
    formula: '"hello".trim()',
    expected: new FormulaString('hello'),
  },
  {
    formula: '"".trim()',
    expected: new FormulaString(''),
  },
  {
    formula: '"\\n\\t hello world \\n".trim()',
    expected: new FormulaString('hello world'),
  },
  {
    formula: '" hello ".trim()',
    expected: new FormulaString('hello'),
  },
  {
    formula: '"hello".trim("arg")',
    expected: {
      method: {
        message: 'Expected no arguments.',
        location: [8, 12],
      },
    },
  },
]));
