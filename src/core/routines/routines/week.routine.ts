import { FormulaDate, FormulaNull, FormulaNumber } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaDate, 'week', {
  description: 'Returns the ISO week of the year of the date (1-53).',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(28),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return instance.value.weekOfYear === undefined ? new FormulaNull() : new FormulaNumber(instance.value.weekOfYear);
  },
});
