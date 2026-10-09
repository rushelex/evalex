import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('month', {
  description: 'Returns the month of the date (1-12).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(7),
    },
  ],
  arguments: [arg.date('date')],
  handler: ({ subject }) => new FormulaNumber(subject.value.month),
});
