import { FormulaDate, FormulaNumber, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('month', {
  on: [FormulaDate],
  description: 'Returns the month of the date (1-12).',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(7),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.Date, { name: 'date' }),
  ]),
  handler: ({ subject }) => {
    return new FormulaNumber(subject.value.month);
  },
});
