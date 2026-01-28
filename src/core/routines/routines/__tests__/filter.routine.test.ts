import { FormulaArray, FormulaNumber, FormulaObject, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-test-runner';

const tester = new RoutineTester('filter');

describe('filter routine', tester.testSuites([
  {
    formula: 'numbers.filter(current % 2 == 0)',
    context: {
      numbers: new FormulaArray([
        new FormulaNumber(1),
        new FormulaNumber(2),
        new FormulaNumber(3),
      ]),
    },
    expected: new FormulaArray([
      new FormulaNumber(2),
    ]),
  },
  {
    formula: 'persons.filter(current.name() == "Alice")',
    context: {
      persons: new FormulaArray([
        FormulaObject.from({ id: 'u1', name: 'Alice', age: 30 }),
        FormulaObject.from({ id: 'u2', name: 'Bob', age: 24 }),
        FormulaObject.from({ id: 'u3', name: 'Charlie', age: 35 }),
      ]),
    },
    expected: new FormulaArray([
      new FormulaObject({
        id: new FormulaString('u1'),
        name: new FormulaString('Alice'),
        age: new FormulaNumber(30),
      }),
    ]),
  },
  {
    formula: 'empty.filter(current + 1)',
    context: {
      empty: new FormulaArray([], 'number'),
    },
    expected: new FormulaArray([]),
  },
  {
    formula: 'numbers.filter(current + index == 3)',
    context: {
      numbers: new FormulaArray([
        new FormulaNumber(1),
        new FormulaNumber(2),
        new FormulaNumber(3),
      ]),
    },
    expected: new FormulaArray([
      new FormulaNumber(2),
    ]),
  },
]));
