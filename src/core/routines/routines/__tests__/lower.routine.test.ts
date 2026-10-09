import { FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"lower" method routine', new RoutineTester('lower').examples({
  skipFunction: true,
}, [
  {
    formula: '"HELLO".lower()',
    expected: new FormulaString('hello'),
  },
  {
    formula: '"".lower()',
    expected: new FormulaString(''),
  },
  {
    formula: '"ÀÉ ПРИВЕТ".lower()',
    expected: new FormulaString('àé привет'),
  },
  {
    formula: '"hello".lower("arg")',
    expected: {
      method: {
        message: 'Expected no arguments.',
        location: [8, 13],
      },
    },
  },
]));
