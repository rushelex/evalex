import { FormulaDate } from '../../data-types';
import { type } from '../../types';
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
  returns: type.date,
  volatile: true,
  handler: ({ visitor }) => new FormulaDate(Temporal.Now.zonedDateTimeISO(visitor.timeZone).toPlainDate()),
});
