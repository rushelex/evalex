import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { expectInteger } from './expect-integer';

const DURATION_UNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'] as const;

routinesRegistry.registerRoutine({ function: 'dateSubtract', method: 'subtract' }, {
  description: 'Subtracts a duration or a number of units from the date.',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")', '1', '"years"'),
      result: () => {
        const date = Temporal.ZonedDateTime.from({ year: 2023, month: 7, day: 10, hour: 17, minute: 35, timeZone: 'UTC' });
        return new FormulaDate(date.subtract({ years: 1 }));
      },
    },
  ],
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
    const duration: Temporal.DurationLike = amount instanceof FormulaDuration ? amount.value : { [unit!.value]: amount.value };

    try {
      return FormulaDate.from(subject.value.subtract(duration));
    }
    catch (error) {
      // With whole amounts, Temporal fails only when the duration or the resulting date leaves its range.
      throw Errors.Arithmetic.DateOutOfRange.create({ value: subject.toString() }, { location: locations[0], cause: error instanceof Error ? error : undefined });
    }
  },
});
