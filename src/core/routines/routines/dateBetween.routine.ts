import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDuration } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const DURATION_UNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes'] as const;

const SINGULAR_UNITS = {
  years: 'year',
  months: 'month',
  weeks: 'week',
  days: 'day',
  hours: 'hour',
  minutes: 'minute',
} as const satisfies Record<typeof DURATION_UNITS[number], string>;

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('parseDate("2023-08-30")', 'parseDate("2022-09-07")', '"days"'),
    result: () => FormulaDuration.from(Temporal.Duration.from({ days: 357 })),
  },
  {
    formula: (name) => name('parseDate("2030-01-01")', 'parseDate("2023-08-30")', '"years"'),
    result: () => FormulaDuration.from(Temporal.Duration.from({ years: 6, months: 4, days: 2 })),
  },
];

routinesRegistry.registerRoutine({ function: 'dateBetween', method: ['between', 'dateBetween'] }, {
  description: 'Returns the difference between two dates in the given unit.',
  examples: routineExamples,
  arguments: [arg.date('date1'), arg.date('date2'), arg.choice('unit', DURATION_UNITS)],
  handler: ({ subject, args: [other, unit] }) => new FormulaDuration(subject.value.since(other.value, { largestUnit: SINGULAR_UNITS[unit.value] })),
});
