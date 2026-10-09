import { FormulaDate, FormulaNumber, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('hour', {
  on: [FormulaDate],
  description: 'Returns the hour of the date (0-23).',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(17),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.Date, { name: 'date' }),
  ]),
  handler: ({ subject }) => {
    return new FormulaNumber(subject.value.hour);
  },
});
