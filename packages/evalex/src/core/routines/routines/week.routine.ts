import { FormulaNull, FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { routinesRegistry } from '../registry';
import { CALENDAR_DATE, calendarDay } from './calendar-day';

routinesRegistry.registerRoutine('week', {
  description: 'Returns the ISO week of the year of the date (1-53).',
  examples: [
    {
      formula: (name) => name('parseDate("2023-07-10")'),
      result: () => new FormulaNumber(28),
    },
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
      result: () => new FormulaNumber(28),
    },
  ],
  arguments: [CALENDAR_DATE],
  returns: type.union(type.number, type.null),
  handler: ({ subject, visitor }) => {
    const { weekOfYear } = calendarDay({ date: subject, timeZone: visitor.timeZone });

    return weekOfYear === undefined ? new FormulaNull() : new FormulaNumber(weekOfYear);
  },
});
