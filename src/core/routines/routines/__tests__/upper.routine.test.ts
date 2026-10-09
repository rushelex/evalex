import { FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('upper routine', new RoutineTester('upper').examples([
  {
    formula: '"hello".upper()',
    expected: new FormulaString('HELLO'),
  },
  {
    formula: '"".upper()',
    expected: new FormulaString(''),
  },
  {
    formula: '"straße привет".upper()',
    expected: new FormulaString('STRASSE ПРИВЕТ'),
  },
  {
    formula: '"hello".upper("arg")',
    expected: {
      method: {
        message: 'Expected no arguments.',
        location: [8, 13],
      },
    },
  },
]));
