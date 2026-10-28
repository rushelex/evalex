import { FormulaDate } from '../../data-types';
import { routinesRegistry } from '../registry';

routinesRegistry.registerFunction('today', {
  description: 'Returns the current date without the time.',
  examples: [
    {
      formula: (name) => name(),
      result: () => FormulaDate.from('2025-08-02'),
    },
  ],
  arguments: [],
  volatile: true,
  handler: ({ visitor }) => new FormulaDate(Temporal.Now.zonedDateTimeISO(visitor.timeZone).toPlainDate()),
});
