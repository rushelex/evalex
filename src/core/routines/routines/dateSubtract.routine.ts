import { FormulaDate, FormulaDateTime } from '../../data-types';
import { routinesRegistry } from '../registry';
import { DATE_SHIFT_SIGNATURES, shiftDate } from './date-shift';

routinesRegistry.registerRoutine({ function: 'dateSubtract', method: ['subtract', 'dateSubtract'] }, {
  description: 'Subtracts a duration or a number of units from the date.',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10")', '1', '"weeks"'),
      result: () => FormulaDate.from('2023-07-03'),
    },
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")', '1', '"years"'),
      result: () => FormulaDateTime.from('2022-07-10T17:35Z'),
    },
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")', '2', '"quarters"'),
      result: () => FormulaDateTime.from('2023-01-10T17:35Z'),
    },
  ],
  arguments: DATE_SHIFT_SIGNATURES,
  handler: ({ subject, args: [amount, unit], locations, visitor }) => shiftDate({
    date: subject,
    amount,
    unit,
    sign: -1,
    timeZone: visitor.timeZone,
    location: locations[0],
  }),
});
