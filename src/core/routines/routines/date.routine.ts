import { FormulaNumber } from '../../data-types';
import { routinesRegistry } from '../registry';
import { CALENDAR_DATE, calendarDay } from './calendar-day';

routinesRegistry.registerRoutine('date', {
  description: 'Returns the day of the month from the date (1-31).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10")'),
      result: () => new FormulaNumber(10),
    },
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(10),
    },
  ],
  arguments: [CALENDAR_DATE],
  handler: ({ subject, visitor }) => new FormulaNumber(calendarDay({ date: subject, timeZone: visitor.timeZone }).day),
});
