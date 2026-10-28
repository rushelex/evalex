import { FormulaDateTime } from '../../data-types';
import { routinesRegistry } from '../registry';

routinesRegistry.registerFunction('today', {
  description: 'Returns the current date without the time.',
  examples: [
    {
      formula: (name) => name(),
      result: () => FormulaDateTime.from(Temporal.ZonedDateTime.from({
        year: 2025,
        month: 8,
        day: 2,
        timeZone: 'UTC',
      })),
    },
  ],
  arguments: [],
  volatile: true,
  handler: ({ visitor }) => FormulaDateTime.from(Temporal.Now.zonedDateTimeISO(visitor.timeZone).startOfDay()),
});
