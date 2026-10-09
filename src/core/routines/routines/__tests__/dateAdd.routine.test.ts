import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const base = Temporal.ZonedDateTime.from('2025-06-01T10:00:00Z[UTC]');

const context = {
  d: new FormulaDate(Temporal.ZonedDateTime.from({ timeZone: 'UTC', year: 2024, month: 7, day: 28 })),
  duration: new FormulaDuration(Temporal.Duration.from({ years: 2, months: 5, days: 10, hours: 12, minutes: 30, seconds: 15 })),
};

describe('"dateAdd" function routine', new RoutineTester('dateAdd').examples({
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

describe('"add" method routine', new RoutineTester('add').examples({
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
      method: {
        message: 'Expected "years", "months", "weeks", "days", "hours", "minutes", "seconds".',
        location: [31, 37],
      },
    },
  },
  {
    formula: 'd.add(w)',
    context: {
      d: new FormulaDate(base),
      w: new FormulaDuration(Temporal.Duration.from({ weeks: 1 })),
    },
    expected: new FormulaDate(base.add({ weeks: 1 })),
  },
  {
    formula: 'd.add(2, "days")',
    context: {
      d: new FormulaDate(base),
    },
    expected: new FormulaDate(base.add({ days: 2 })),
  },
  {
    formula: 'd.add(duration, "hours")',
    context,
    expected: {
      method: {
        message: 'Expected type Number.',
        location: [6, 14],
      },
    },
  },
  {
    formula: 'd.add(1)',
    context,
    expected: {
      method: {
        message: 'Arguments don\'t match. Pattern 1: Expected type Duration.; Pattern 2: Expected at least 2 argument(s).',
        location: [2, 5],
      },
    },
  },
  {
    formula: 'd.add(1, "minute")',
    context,
    expected: {
      method: {
        message: 'Expected "years", "months", "weeks", "days", "hours", "minutes", "seconds".',
        location: [9, 17],
      },
    },
  },
]));
