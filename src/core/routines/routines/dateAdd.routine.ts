import type { RoutineExampleOptions } from '../routine-example';

import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { expectInteger } from './expect-integer';
import { unitDuration } from './unit-duration';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('parseDate("2023-08-30")', '1', '"days"'),
    result: () => FormulaDate.from(Temporal.ZonedDateTime.from({ year: 2023, month: 8, day: 31, timeZone: 'UTC' })),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '2', '"months"'),
    result: () => FormulaDate.from(Temporal.ZonedDateTime.from({ year: 2023, month: 10, day: 30, timeZone: 'UTC' })),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '1', '"quarters"'),
    result: () => FormulaDate.from(Temporal.ZonedDateTime.from({ year: 2023, month: 11, day: 30, timeZone: 'UTC' })),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '3', '"years"'),
    result: () => FormulaDate.from(Temporal.ZonedDateTime.from({ year: 2026, month: 8, day: 30, timeZone: 'UTC' })),
  },
];

const DURATION_UNITS = ['years', 'quarters', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'] as const;

routinesRegistry.registerRoutine({ function: 'dateAdd', method: ['add', 'dateAdd'] }, {
  description: 'Adds a duration or a number of units to the date.',
  examples: routineExamples,
  arguments: [
    [arg.date('date'), arg.duration('duration')],
    [
      arg.date('date'),
      arg.number('number', {
        validation: expectInteger,
      }),
      arg.choice('unit', DURATION_UNITS),
    ],
  ],
  handler: ({ subject, args: [amount, unit], locations }) => {
    const duration: Temporal.DurationLike = amount instanceof FormulaDuration ? amount.value : unitDuration({ unit: unit!.value, amount: amount.value });

    try {
      return FormulaDate.from(subject.value.add(duration));
    }
    catch (error) {
      // With whole amounts, Temporal fails only when the duration or the resulting date leaves its range.
      throw Errors.Arithmetic.DateOutOfRange.create({ value: subject.toString() }, { location: locations[0], cause: error instanceof Error ? error : undefined });
    }
  },
});
