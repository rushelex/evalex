import type { FormulaString } from '../../data-types';
import type { ProcessedArgument } from '../arguments';

import { FormulaDate } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('"2023-07-10"'),
    result: () => FormulaDate.from('2023-07-10'),
  },
  {
    formula: (name) => name('"2023-07-10T17:35Z"'),
    result: () => FormulaDate.from('2023-07-10T17:35Z'),
  },
]);

routinesRegistry.registerFunction('parseDate', {
  description: 'Returns the date parsed according to the ISO 8601 standard.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument('string', {
      name: 'date',
      validation: (value) => {
        try {
          FormulaDate.from(value.value);
        }
        catch {
          return 'Expected valid date string.';
        }
      },
    }),
  ]),
  handler: ({ args }) => {
    const [dateStringArg] = args as [ProcessedArgument<FormulaString>];
    return FormulaDate.from(dateStringArg.dataType.value);
  },
});
