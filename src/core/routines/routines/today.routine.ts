import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerFunction('today', {
  description: 'Returns the current date without the time.',
  examples: createRoutineExamples([
    {
      formula: (name) => name(),
      result: () => FormulaDate.from(Temporal.ZonedDateTime.from({
        year: 2025,
        month: 8,
        day: 2,
        timeZone: 'UTC',
      })),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: () => {
    return FormulaDate.from(Temporal.Now.zonedDateTimeISO('UTC').startOfDay());
  },
});
