import { FormulaBoolean, FormulaDateTime, FormulaObject } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('empty');

describe('empty routine', tester.examples([
  {
    formula: 'true.empty()',
    expected: new FormulaBoolean(false),
  },
  {
    formula: 'false.empty()',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '[].empty()',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '[1, 2, 3].empty()',
    expected: new FormulaBoolean(false),
  },
  {
    formula: 'd.empty()',
    context: {
      d: new FormulaDateTime(
        Temporal.ZonedDateTime.from({
          timeZone: 'UTC',
          year: 2024,
          month: 7,
          day: 28,
        }),
      ),
    },
    expected: new FormulaBoolean(false),
  },
  {
    formula: 'null.empty()',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '0.empty()',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '42.empty()',
    expected: new FormulaBoolean(false),
  },
  {
    formula: 'emptyObj.empty()',
    context: {
      emptyObj: FormulaObject.from({}),
    },
    expected: new FormulaBoolean(true),
  },
  {
    formula: 'nonEmptyObj.empty()',
    context: {
      nonEmptyObj: FormulaObject.from({
        a: 1,
        b: 2,
      }),
    },
    expected: new FormulaBoolean(false),
  },
  {
    formula: '"".empty()',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"hello".empty()',
    expected: new FormulaBoolean(false),
  },
  {
    formula: 'empty()',
    expected: {
      function: {
        message: 'Expected at least 1 argument(s).',
        location: [0, 7],
      },
    },
  },
]));
