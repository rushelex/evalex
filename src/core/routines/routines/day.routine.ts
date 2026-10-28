import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('day', {
  description: 'Returns the day of the week, from 1 (Monday) to 7 (Sunday).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(1),
    },
  ],
  arguments: [arg.dateTime('date')],
  handler: ({ subject, visitor }) => new FormulaNumber(subject.value.withTimeZone(visitor.timeZone).dayOfWeek),
});
