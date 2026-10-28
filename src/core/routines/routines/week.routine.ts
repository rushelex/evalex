import { FormulaNull, FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('week', {
  description: 'Returns the ISO week of the year of the date (1-53).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(28),
    },
  ],
  arguments: [arg.dateTime('date')],
  handler: ({ subject, visitor }) => {
    const { weekOfYear } = subject.value.withTimeZone(visitor.timeZone);

    return weekOfYear === undefined ? new FormulaNull() : new FormulaNumber(weekOfYear);
  },
});
