import { FormulaArray, FormulaNumber, FormulaObject, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('map');

describe('map routine', tester.examples([
  {
    formula: '[].map(current + 1)',
    expected: new FormulaArray([]),
  },
  {
    formula: '[1, 2, 3].map(current * current)',
    expected: new FormulaArray([
      new FormulaNumber(1),
      new FormulaNumber(4),
      new FormulaNumber(9),
    ]),
  },
  {
    formula: '[1, 2, 3].map(current + index)',
    expected: new FormulaArray([
      new FormulaNumber(1),
      new FormulaNumber(3),
      new FormulaNumber(5),
    ]),
  },
  {
    formula: 'persons.map(current.name())',
    context: {
      persons: new FormulaArray([
        FormulaObject.from({ id: 'u1', name: 'Alice', age: 30 }),
        FormulaObject.from({ id: 'u2', name: 'Bob', age: 24 }),
        FormulaObject.from({ id: 'u3', name: 'Charlie', age: 35 }),
      ]),
    },
    expected: new FormulaArray([
      new FormulaString('Alice'),
      new FormulaString('Bob'),
      new FormulaString('Charlie'),
    ]),
  },
]));
