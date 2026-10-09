import { FormulaDate, FormulaNumber } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaDate, 'date', {
  description: 'Returns the day of the month from the date (1-31).',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(10),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.day);
  },
});
