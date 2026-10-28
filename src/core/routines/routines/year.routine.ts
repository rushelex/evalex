import { FormulaNumber } from '../../data-types';
import { routinesRegistry } from '../registry';
import { CALENDAR_DATE, calendarDay } from './calendar-day';

routinesRegistry.registerRoutine('year', {
  description: 'Returns the year of the date (4 digits).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10")'),
      result: () => new FormulaNumber(2023),
    },
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(2023),
    },
  ],
  arguments: [CALENDAR_DATE],
  handler: ({ subject, visitor }) => new FormulaNumber(calendarDay({ date: subject, timeZone: visitor.timeZone }).year),
});
