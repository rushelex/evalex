import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../../data-types';
import { routinesRegistry } from '../registry';

routinesRegistry.registerFunction('today', {
  description: 'Returns the current date without the time.',
  examples: [
    {
      formula: (name) => name(),
      result: () => FormulaDate.from(Temporal.ZonedDateTime.from({
        year: 2025,
        month: 8,
        day: 2,
        timeZone: 'UTC',
      })),
    },
  ],
  arguments: [],
  volatile: true,
  handler: () => FormulaDate.from(Temporal.Now.zonedDateTimeISO('UTC').startOfDay()),
});
