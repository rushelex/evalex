import { FormulaDate, FormulaNumber, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('minute', {
  on: [FormulaDate],
  description: 'Returns the minute of the date (0-59).',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(35),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.Date, { name: 'date' }),
  ]),
  handler: ({ subject }) => {
    return new FormulaNumber(subject.value.minute);
  },
});
