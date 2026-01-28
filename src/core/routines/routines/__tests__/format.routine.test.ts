import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaObject, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-test-runner';

const tester = new RoutineTester('format');

describe('format routine', tester.testSuites([
  {
    formula: '[1, 2, 3].format()',
    expected: new FormulaString('1, 2, 3'),
  },
  {
    formula: '["Alice", "Bob"].format()',
    expected: new FormulaString('Alice, Bob'),
  },
  {
    formula: '[person1, person2].format()',
    context: {
      person1: FormulaObject.from({ id: 'u1', name: 'Alice' }),
      person2: FormulaObject.from({ id: 'u2', name: 'Bob' }),
    },
    expected: new FormulaString('{ id: "u1", name: "Alice" }, { id: "u2", name: "Bob" }'),
  },
  {
    formula: 'true.format()',
    expected: new FormulaString('true'),
  },
  {
    formula: 'false.format()',
    expected: new FormulaString('false'),
  },
  {
    formula: 'd.format()',
    context: {
      d: new FormulaDate(
        Temporal.ZonedDateTime.from({
          timeZone: 'UTC',
          year: 2024,
          month: 7,
          day: 28,
        }),
      ),
    },
    expected: new FormulaString('7/28/2024, 12:00:00 AM UTC'),
  },
  {
    formula: 'null.format()',
    expected: new FormulaString(''),
  },
  {
    formula: '0.format()',
    expected: new FormulaString('0'),
  },
  {
    formula: '42.format()',
    expected: new FormulaString('42'),
  },
  {
    formula: 'emptyObj.format()',
    context: {
      emptyObj: FormulaObject.from({}),
    },
    expected: new FormulaString('{}'),
  },
  {
    formula: 'nonEmptyObj.format()',
    context: {
      nonEmptyObj: FormulaObject.from({
        a: 1,
        b: 2,
      }),
    },
    expected: new FormulaString('{ a: 1, b: 2 }'),
  },
  {
    formula: '"".format()',
    expected: new FormulaString(''),
  },
  {
    formula: '"hello".format()',
    expected: new FormulaString('hello'),
  },
  {
    formula: 'format()',
    expected: {
      function: {
        message: 'Expected at least 1 argument(s).',
        location: [0, 8],
      },
    },
  },
]));
