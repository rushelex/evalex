import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('hour', {
  description: 'Returns the hour of the date (0-23).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(17),
    },
  ],
  arguments: [arg.dateTime('date')],
  handler: ({ subject }) => new FormulaNumber(subject.value.hour),
});
