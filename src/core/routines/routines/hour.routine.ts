import { FormulaDate, FormulaNumber } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaDate, 'hour', {
  description: 'Returns the hour of the date (0-23).',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(17),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.hour);
  },
});
