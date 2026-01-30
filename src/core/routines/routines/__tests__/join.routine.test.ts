import { FormulaArray, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('join');

describe('join routine', tester.examples([
  {
    formula: '[1, 2, 3].join()',
    expected: new FormulaString('123'),
  },
  {
    formula: '[1, 2, 3].join(", ")',
    expected: new FormulaString('1, 2, 3'),
  },
  {
    formula: 'persons.join(" | ")',
    context: {
      persons: FormulaArray.from([
        { id: 'u1', name: 'Alice', age: 30 },
        { id: 'u2', name: 'Bob', age: 24 },
        { id: 'u3', name: 'Charlie', age: 35 },
      ]),
    },
    expected: new FormulaString('{ id: "u1", name: "Alice", age: 30 } | { id: "u2", name: "Bob", age: 24 } | { id: "u3", name: "Charlie", age: 35 }'),
  },
  {
    formula: '[1, 2, 3].join(" | ", "arg3")',
    expected: {
      function: {
        message: 'Expected at most 2 argument(s).',
        location: [0, 30],
      },
      method: {
        message: 'Expected at most 1 argument(s).',
        location: [10, 14],
      },
    },
  },
  {
    formula: '[1, 2, 3].join(3)',
    expected: {
      function: {
        message: 'Expected type String.',
        location: [16, 17],
      },
      method: {
        message: 'Expected type String.',
        location: [15, 16],
      },
    },
  },
]));
