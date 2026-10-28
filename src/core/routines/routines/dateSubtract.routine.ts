import { FormulaDateTime, FormulaDuration } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { expectInteger } from './expect-integer';
import { unitDuration } from './unit-duration';

const DURATION_UNITS = ['years', 'quarters', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'] as const;

routinesRegistry.registerRoutine({ function: 'dateSubtract', method: ['subtract', 'dateSubtract'] }, {
  description: 'Subtracts a duration or a number of units from the date.',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")', '1', '"years"'),
      result: () => {
        const date = Temporal.ZonedDateTime.from({ year: 2023, month: 7, day: 10, hour: 17, minute: 35, timeZone: 'UTC' });
        return new FormulaDateTime(date.subtract({ years: 1 }));
      },
    },
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")', '2', '"quarters"'),
      result: () => FormulaDateTime.from(Temporal.ZonedDateTime.from({ year: 2023, month: 1, day: 10, hour: 17, minute: 35, timeZone: 'UTC' })),
    },
  ],
  arguments: [
    [arg.dateTime('date'), arg.duration('duration')],
    [
      arg.dateTime('date'),
      arg.number('number', {
        validation: expectInteger,
      }),
      arg.choice('unit', DURATION_UNITS),
    ],
  ],
  handler: ({ subject, args: [amount, unit], locations, visitor }) => {
    const duration: Temporal.DurationLike = amount instanceof FormulaDuration ? amount.value : unitDuration({ unit: unit!.value, amount: amount.value });

    try {
      // Days and months follow the calendar of the scope's zone, as in `dateAdd`.
      return FormulaDateTime.from(subject.value.withTimeZone(visitor.timeZone).subtract(duration));
    }
    catch (error) {
      // With whole amounts, Temporal fails only when the duration or the resulting date leaves its range.
      throw Errors.Arithmetic.DateOutOfRange.create({ value: subject.toString() }, { location: locations[0], cause: error instanceof Error ? error : undefined });
    }
  },
});
