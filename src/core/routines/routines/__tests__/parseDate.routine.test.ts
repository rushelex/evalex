import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-test-runner';

const tester = new RoutineTester('parseDate');

describe('parseDate routine', tester.testSuites([
  {
    formula: 'parseDate("2024-07-28")',
    expected: new FormulaDate(Temporal.ZonedDateTime.from({
      timeZone: 'UTC',
      year: 2024,
      month: 7,
      day: 28,
    })),
  },
  {
    formula: 'parseDate("2024-07-28T17:35Z")',
    expected: new FormulaDate(Temporal.ZonedDateTime.from({
      timeZone: 'UTC',
      year: 2024,
      month: 7,
      day: 28,
      hour: 17,
      minute: 35,
    })),
  },
  {
    formula: 'parseDate("2024-07-28T17:35:42.456Z")',
    expected: new FormulaDate(Temporal.ZonedDateTime.from({
      timeZone: 'UTC',
      year: 2024,
      month: 7,
      day: 28,
      hour: 17,
      minute: 35,
      second: 42,
      millisecond: 456,
    })),
  },
  {
    formula: 'parseDate()',
    expected: {
      function: {
        message: 'Expected at least 1 argument(s).',
        location: [0, 11],
      },
    },
  },
  {
    formula: 'parseDate(1)',
    expected: {
      function: {
        message: 'Expected type string.',
        location: [10, 11],
      },
    },
  },
  {
    formula: 'parseDate(d)',
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
    expected: {
      function: {
        message: 'Expected type string.',
        location: [10, 11],
      },
    },
  },
  {
    formula: 'parseDate("invalid-date")',
    expected: {
      function: {
        message: 'Expected valid date string.',
        location: [10, 24],
      },
    },
  },
  {
    formula: 'parseDate("2024-13-01")',
    expected: {
      function: {
        message: 'Expected valid date string.',
        location: [10, 22],
      },
    },
  },
  {
    formula: 'parseDate("")',
    expected: {
      function: {
        message: 'Expected valid date string.',
        location: [10, 12],
      },
    },
  },
], {
  skipMethod: true,
}));
