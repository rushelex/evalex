import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDate, FormulaDateTime, FormulaDuration } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const DATE_UNITS = ['years', 'months', 'weeks', 'days'] as const;

const DATE_TIME_UNITS = [...DATE_UNITS, 'hours', 'minutes'] as const;

const SINGULAR_DATE_UNITS = {
  years: 'year',
  months: 'month',
  weeks: 'week',
  days: 'day',
} as const satisfies Record<typeof DATE_UNITS[number], string>;

const SINGULAR_UNITS = {
  ...SINGULAR_DATE_UNITS,
  hours: 'hour',
  minutes: 'minute',
} as const satisfies Record<typeof DATE_TIME_UNITS[number], string>;

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('parseDate("2023-08-30")', 'parseDate("2022-09-07")', '"days"'),
    result: () => FormulaDuration.from(Temporal.Duration.from({ days: 357 })),
  },
  {
    formula: (name) => name('parseDate("2030-01-01")', 'parseDate("2023-08-30")', '"years"'),
    result: () => FormulaDuration.from(Temporal.Duration.from({ years: 6, months: 4, days: 2 })),
  },
  {
    formula: (name) => name('parseDate("2023-08-30T18:00Z")', 'parseDate("2023-08-30T09:30Z")', '"hours"'),
    result: () => FormulaDuration.from(Temporal.Duration.from({ hours: 8, minutes: 30 })),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', 'parseDate("2023-08-29T09:30Z")', '"days"'),
    error: {
      type: Errors.Argument.TypeMismatch,
      message: 'Expected type Date.',
      location: { function: [37, 67], method: [32, 62] },
    },
  },
];

routinesRegistry.registerRoutine({ function: 'dateBetween', method: ['between', 'dateBetween'] }, {
  description: 'Returns the difference between two dates in the given unit.',
  examples: routineExamples,
  arguments: [
    [arg.date('date1'), arg.date('date2'), arg.choice('unit', DATE_UNITS)],
    [arg.dateTime('date1'), arg.dateTime('date2'), arg.choice('unit', DATE_TIME_UNITS)],
  ],
  handler: ({ subject, args: [other, unit], visitor }) => {
    // The signatures pair two dates with a date unit, or two dates and times with any unit.
    if (subject instanceof FormulaDate && other instanceof FormulaDate && isDateUnit(unit.value)) {
      return new FormulaDuration(subject.value.since(other.value, { largestUnit: SINGULAR_DATE_UNITS[unit.value] }));
    }

    if (subject instanceof FormulaDateTime && other instanceof FormulaDateTime) {
      return new FormulaDuration(subject.value.withTimeZone(visitor.timeZone).since(other.value.withTimeZone(visitor.timeZone), { largestUnit: SINGULAR_UNITS[unit.value] }));
    }

    throw new TypeError('dateBetween takes two dates with a date unit or two dates and times.');
  },
});

function isDateUnit(unit: string): unit is typeof DATE_UNITS[number] {
  return Object.hasOwn(SINGULAR_DATE_UNITS, unit);
}
