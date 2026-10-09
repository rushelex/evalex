import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDate } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('"2023-07-10"'),
    result: () => FormulaDate.from('2023-07-10'),
  },
  {
    formula: (name) => name('"2023-07-10T17:35Z"'),
    result: () => FormulaDate.from('2023-07-10T17:35Z'),
  },
];

routinesRegistry.registerFunction('parseDate', {
  description: 'Returns the date parsed according to the ISO 8601 standard.',
  examples: routineExamples,
  arguments: [
    arg.string('date', {
      validation: (value) => {
        try {
          FormulaDate.from(value.value);
        }
        catch {
          return { message: 'Expected valid date string.', expected: ['valid date string'], actual: value.value };
        }
      },
    }),
  ],
  handler: ({ args: [date] }) => FormulaDate.from(date.value),
});
