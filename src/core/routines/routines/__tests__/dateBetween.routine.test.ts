import { FormulaDate, FormulaDuration } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"dateBetween" function routine', new RoutineTester('dateBetween').examples({
  skipMethod: true,
}, [
  {
    formula: 'dateBetween(parseDate("2025-08-23"), parseDate("2023-08-23"), "years")',
    expected: FormulaDuration.from(Temporal.Duration.from({ years: 2 })),
  },
  {
    formula: 'dateBetween(parseDate("2025-08-23"), parseDate("2023-08-23"), "hour")',
    expected: {
      function: {
        message: 'Expected "years", "months", "weeks", "days", "hours", "minutes".',
        location: [62, 68],
      },
    },
  },
]));

describe('"between" method routine', new RoutineTester('between').examples({
  skipFunction: true,
}, [
  {
    formula: 'parseDate("2025-08-23").between(parseDate("2023-08-23"), "years")',
    expected: FormulaDuration.from(Temporal.Duration.from({ years: 2 })),
  },
  {
    formula: 'parseDate("2025-08-23").between(parseDate("2023-08-23"), "hour")',
    expected: {
      method: {
        message: 'Expected "years", "months", "weeks", "days", "hours", "minutes".',
        location: [57, 63],
      },
    },
  },
  {
    formula: 'start.between(end, "days")',
    context: {
      start: new FormulaDate(Temporal.ZonedDateTime.from({ year: 2024, month: 7, day: 1, timeZone: 'UTC' })),
      end: new FormulaDate(Temporal.ZonedDateTime.from({ year: 2024, month: 7, day: 15, timeZone: 'UTC' })),
    },
    expected: new FormulaDuration(Temporal.Duration.from('-P14D')),
  },
  {
    formula: 'later.between(earlier, "days")',
    context: {
      later: new FormulaDate(Temporal.ZonedDateTime.from({ year: 2024, month: 7, day: 15, timeZone: 'UTC' })),
      earlier: new FormulaDate(Temporal.ZonedDateTime.from({ year: 2024, month: 7, day: 1, timeZone: 'UTC' })),
    },
    expected: new FormulaDuration(Temporal.Duration.from('P14D')),
  },
]));
