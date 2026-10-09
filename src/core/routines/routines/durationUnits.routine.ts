import { Temporal } from 'temporal-polyfill';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const DURATION_UNITS = [
  'years',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds',
] as const;

const EXAMPLE_END = '2025-09-01T06:42:30.100Z';

const EXAMPLE_START = '2022-10-08T00:00Z';

for (const unit of DURATION_UNITS) {
  // Durations balanced up to years never carry weeks, so the weeks example balances up to weeks
  const largestUnit = unit === 'weeks' ? 'weeks' : 'years';

  routinesRegistry.registerRoutine(unit, {
    description: `Returns the number of ${unit} in the duration.`,
    examples: [
      {
        formula: (name) => name(`parseDate("${EXAMPLE_END}").between(parseDate("${EXAMPLE_START}"), "${largestUnit}")`),
        result: () => {
          const end = Temporal.Instant.from(EXAMPLE_END).toZonedDateTimeISO('UTC');
          const start = Temporal.Instant.from(EXAMPLE_START).toZonedDateTimeISO('UTC');
          return new FormulaNumber(end.since(start, { largestUnit })[unit]);
        },
      },
    ],
    arguments: [
      arg.duration('duration'),
    ],
    handler: ({ subject }) => new FormulaNumber(subject.value[unit]),
  });
}
