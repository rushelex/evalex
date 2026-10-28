import { FormulaNumber } from '../../data-types';
import { routinesRegistry } from '../registry';
import { CALENDAR_DATE, calendarDay } from './calendar-day';

routinesRegistry.registerRoutine('day', {
  description: 'Returns the day of the week, from 1 (Monday) to 7 (Sunday).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10")'),
      result: () => new FormulaNumber(1),
    },
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(1),
    },
  ],
  arguments: [CALENDAR_DATE],
  handler: ({ subject, visitor }) => new FormulaNumber(calendarDay({ date: subject, timeZone: visitor.timeZone }).dayOfWeek),
});
