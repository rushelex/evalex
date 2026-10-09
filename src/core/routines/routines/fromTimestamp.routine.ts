import type { RoutineExampleOptions } from '../routine-example';

import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

// The range of instants a date can hold.
const MAX_TIMESTAMP = 8_640_000_000_000_000;

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('1689024900000'),
    result: () => FormulaDate.from(Temporal.ZonedDateTime.from({ year: 2023, month: 7, day: 10, hour: 21, minute: 35, timeZone: 'UTC' })),
  },
];

routinesRegistry.registerRoutine('fromTimestamp', {
  description: 'Returns the UTC date of a Unix timestamp in milliseconds.',
  examples: routineExamples,
  arguments: [
    arg.number('timestamp', {
      validation: (timestamp) => (Math.abs(timestamp.value) <= MAX_TIMESTAMP
        ? undefined
        : {
            message: `Expected timestamp between -${MAX_TIMESTAMP} and ${MAX_TIMESTAMP}.`,
            expected: [`timestamp between -${MAX_TIMESTAMP} and ${MAX_TIMESTAMP}`],
            actual: timestamp.value,
          }),
    }),
  ],
  handler: ({ subject }) => FormulaDate.from(
    Temporal.Instant.fromEpochMilliseconds(Math.floor(subject.value))
      .toZonedDateTimeISO('UTC')
      .round({ smallestUnit: 'minute', roundingMode: 'floor' }),
  ),
});
