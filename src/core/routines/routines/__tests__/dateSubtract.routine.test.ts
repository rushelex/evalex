import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const base = Temporal.ZonedDateTime.from('2025-06-01T10:00:00Z[UTC]');

const context = {
  d: new FormulaDate(Temporal.ZonedDateTime.from({ timeZone: 'UTC', year: 2024, month: 7, day: 28 })),
  duration: new FormulaDuration(Temporal.Duration.from({ years: 2, months: 5, days: 10, hours: 12, minutes: 30, seconds: 15 })),
};

describe('"dateSubtract" function routine', new RoutineTester('dateSubtract').examples({
  skipMethod: true,
}, [
  {
    formula: 'dateSubtract(d, 2, "days")',
    context: {
      d: new FormulaDate(base),
    },
    expected: new FormulaDate(base.subtract({ days: 2 })),
  },
  {
    formula: 'dateSubtract(d, duration)',
    context,
    expected: new FormulaDate(context.d.value.subtract(context.duration.value)),
  },
  {
    formula: 'dateSubtract(d, 1, "minute")',
    context,
    expected: {
      function: {
        message: 'Expected "years", "quarters", "months", "weeks", "days", "hours", "minutes", "seconds".',
        location: [19, 27],
      },
    },
  },
]));

describe('"subtract" method routine', new RoutineTester('subtract').examples({
  skipFunction: true,
}, [
  {
    formula: 'd.subtract(w)',
    context: {
      d: new FormulaDate(base),
      w: new FormulaDuration(Temporal.Duration.from({ weeks: 1 })),
    },
    expected: new FormulaDate(base.subtract({ weeks: 1 })),
  },
  {
    formula: 'd.subtract(2, "days")',
    context: {
      d: new FormulaDate(base),
    },
    expected: new FormulaDate(base.subtract({ days: 2 })),
  },
  {
    formula: 'd.subtract(duration, "hours")',
    context,
    expected: {
      method: {
        message: 'Expected type Number.',
        location: [11, 19],
      },
    },
  },
  {
    formula: 'd.subtract(1)',
    context,
    expected: {
      method: {
        message: 'Expected type Duration.',
        location: [11, 12],
      },
    },
  },
  {
    formula: 'd.subtract(1, "minute")',
    context,
    expected: {
      method: {
        message: 'Expected "years", "quarters", "months", "weeks", "days", "hours", "minutes", "seconds".',
        location: [14, 22],
      },
    },
  },
  {
    formula: 'd.subtract(300000, "years")',
    context,
    expected: {
      method: {
        message: 'Date is out of the supported range.',
        location: [11, 17],
      },
    },
  },
  {
    formula: 'd.subtract(far)',
    context: {
      ...context,
      far: new FormulaDuration(Temporal.Duration.from({ years: 300000 })),
    },
    expected: {
      method: {
        message: 'Date is out of the supported range.',
        location: [11, 14],
      },
    },
  },
  {
    formula: 'd.subtract(1.5, "days")',
    context,
    expected: {
      method: {
        message: 'Expected integer.',
        location: [11, 14],
      },
    },
  },
]));
