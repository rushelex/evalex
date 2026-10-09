import { FormulaNumber } from '../../data-types';
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
  arguments: [arg.date('date')],
  handler: ({ subject }) => new FormulaNumber(subject.value.minute),
});
