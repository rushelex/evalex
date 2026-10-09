import { FormulaDate, FormulaNull, FormulaNumber, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('week', {
  on: [FormulaDate],
  description: 'Returns the ISO week of the year of the date (1-53).',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(28),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.Date, { name: 'date' }),
  ]),
  handler: ({ subject }) => {
    return subject.value.weekOfYear === undefined ? new FormulaNull() : new FormulaNumber(subject.value.weekOfYear);
  },
});
