import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('year', {
  description: 'Returns the year of the date (4 digits).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(2023),
    },
  ],
  arguments: [arg.dateTime('date')],
  handler: ({ subject }) => new FormulaNumber(subject.value.year),
});
