import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"dateBetween" function routine', new RoutineTester('dateBetween').examples.only({
  skipMethod: true,
}, [
  {
    formula: 'dateBetween(parseDate("2025-08-23"), parseDate("2023-08-23"), "years")',
    expected: FormulaDuration.from(Temporal.Duration.from({ years: 2 })),
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

// TODO: Replace "add" tests with "between"
describe('"between" method routine', new RoutineTester('between').examples.only({
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
