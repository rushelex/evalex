import { FormulaDate, FormulaNumber } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaDate, 'day', {
  description: 'Returns the day of the week of the date, between 1 (Monday) and 7 (Sunday).',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(1),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.dayOfWeek);
  },
});
