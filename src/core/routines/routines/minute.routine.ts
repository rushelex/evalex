import { FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('minute', {
  description: 'Returns the minute of the date (0-59).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(35),
    },
  ],
  arguments: [arg.dateTime('date')],
  returns: type.number,
  handler: ({ subject, visitor }) => new FormulaNumber(subject.value.withTimeZone(visitor.timeZone).minute),
});
