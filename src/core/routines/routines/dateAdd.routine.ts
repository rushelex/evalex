import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDate, FormulaDateTime } from '../../data-types';
import { Errors } from '../../errors';
import { routinesRegistry } from '../registry';
import { DATE_SHIFT_SIGNATURES, shiftDate } from './date-shift';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('parseDate("2023-08-30")', '1', '"days"'),
    result: () => FormulaDate.from('2023-08-31'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '2', '"months"'),
    result: () => FormulaDate.from('2023-10-30'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '1', '"quarters"'),
    result: () => FormulaDate.from('2023-11-30'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '3', '"years"'),
    result: () => FormulaDate.from('2026-08-30'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30T22:15Z")', '3', '"hours"'),
    result: () => FormulaDateTime.from('2023-08-31T01:15Z'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '3', '"hours"'),
    error: {
      type: Errors.Argument.Validation,
      message: 'Expected "years", "quarters", "months", "weeks", "days".',
      location: { function: [36, 43], method: [31, 38] },
    },
  },
];

routinesRegistry.registerRoutine({ function: 'dateAdd', method: ['add', 'dateAdd'] }, {
  description: 'Adds a duration or a number of units to the date.',
  examples: routineExamples,
  arguments: DATE_SHIFT_SIGNATURES,
  handler: ({ subject, args: [amount, unit], locations, visitor }) => shiftDate({
    date: subject,
    amount,
    unit,
    sign: 1,
    timeZone: visitor.timeZone,
    location: locations[0],
  }),
});
