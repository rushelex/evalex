import { FormulaDate, FormulaNumber, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('date', {
  on: [FormulaDate],
  description: 'Returns the day of the month from the date (1-31).',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(10),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.Date, { name: 'date' }),
  ]),
  handler: ({ subject }) => {
    return new FormulaNumber(subject.value.day);
  },
});
