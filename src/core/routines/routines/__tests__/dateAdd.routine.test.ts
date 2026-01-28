import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"dateAdd" function routine', new RoutineTester('dateAdd').examples.only({
  skipMethod: true,
}, [
  {
    formula: 'dateAdd(parseDate("2025-08-23"), 1, "days")',
    expected: FormulaDate.from(Temporal.ZonedDateTime.from({
      year: 2025,
      month: 8,
      day: 24,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      timeZone: 'UTC',
    })),
  },
  {
    formula: 'dateAdd(parseDate("2025-08-23"), duration)',
    context: {
      duration: new FormulaDuration(Temporal.Duration.from({ years: 1 })),
    },
    expected: FormulaDate.from(Temporal.ZonedDateTime.from({
      year: 2026,
      month: 8,
      day: 23,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      timeZone: 'UTC',
    })),
  },
  {
    formula: 'dateAdd(parseDate("2025-08-23"), 1, "hour")',
    expected: {
      function: {
        message: 'Expected "years", "months", "weeks", "days", "hours", "minutes", "seconds".',
        location: [36, 42],
      },
    },
  },
]));

describe('"add" method routine', new RoutineTester('add').examples.only({
  skipFunction: true,
}, [
  {
    formula: 'parseDate("2025-08-23").add(1, "days")',
    expected: FormulaDate.from(Temporal.ZonedDateTime.from({
      year: 2025,
      month: 8,
      day: 24,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      timeZone: 'UTC',
    })),
  },
  {
    formula: 'parseDate("2025-08-23").add(duration)',
    context: {
      duration: new FormulaDuration(Temporal.Duration.from({ years: 1 })),
    },
    expected: FormulaDate.from(Temporal.ZonedDateTime.from({
      year: 2026,
      month: 8,
      day: 23,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      timeZone: 'UTC',
    })),
  },
  {
    formula: 'parseDate("2025-08-23").add(1, "hour")',
    expected: {
      function: {
        message: 'Expected "years", "months", "weeks", "days", "hours", "minutes", "seconds".',
        location: [31, 37],
      },
    },
  },
]));
