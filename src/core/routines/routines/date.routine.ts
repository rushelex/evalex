import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('date', {
  description: 'Returns the day of the month from the date (1-31).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(10),
    },
  ],
  arguments: [arg.date('date')],
  handler: ({ subject }) => new FormulaNumber(subject.value.day),
});
