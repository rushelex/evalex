import type { FormulaDateTime } from '../../data-types';

import { FormulaDate, Kind } from '../../data-types';
import { arg } from '../arguments';

/** The argument of a routine that reads the calendar parts of a date or of a date and time. */
export const CALENDAR_DATE = arg.oneOf('date', [Kind.Date, Kind.DateTime]);

/** The day a date stands for, or the day a date and time falls on in `timeZone`, the zone of the scope. */
export function calendarDay({ date, timeZone }: { date: FormulaDate | FormulaDateTime; timeZone: string }): Temporal.PlainDate {
  return date instanceof FormulaDate ? date.value : date.value.withTimeZone(timeZone).toPlainDate();
}
