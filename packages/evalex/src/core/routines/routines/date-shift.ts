import type { AST } from '../../../parser';
import type { FormulaNumber } from '../../data-types';
import type { ArgumentValidationFailure, ChoiceValue } from '../arguments';

import { FormulaDate, FormulaDateTime, FormulaDuration } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { expectInteger } from './expect-integer';
import { unitDuration } from './unit-duration';

const DATE_UNITS = ['years', 'quarters', 'months', 'weeks', 'days'] as const;

const DATE_TIME_UNITS = [...DATE_UNITS, 'hours', 'minutes', 'seconds'] as const;

/** The arguments of `dateAdd` and `dateSubtract`: a date takes whole days and longer units, a date and time any unit. */
export const DATE_SHIFT_SIGNATURES = [
  [arg.date('date'), arg.duration('duration', { validation: expectDateDuration })],
  [arg.date('date'), arg.number('number', { validation: expectInteger }), arg.choice('unit', DATE_UNITS)],
  [arg.dateTime('date'), arg.duration('duration')],
  [arg.dateTime('date'), arg.number('number', { validation: expectInteger }), arg.choice('unit', DATE_TIME_UNITS)],
] as const;

interface DateShift {
  readonly date: FormulaDate | FormulaDateTime;
  readonly amount: FormulaDuration | FormulaNumber;
  readonly unit: ChoiceValue<typeof DATE_TIME_UNITS[number]> | undefined;
  /** `1` to add, `-1` to subtract. */
  readonly sign: 1 | -1;
  readonly timeZone: string;
  /** Where the date sits in the formula, for the error of a result out of range. */
  readonly location: AST.Location;
}

/**
 * Moves a date by a duration or a number of units. A date and time moves by the calendar of `timeZone`, so a day across
 * a daylight saving change keeps the time of day.
 *
 * @throws `DateOutOfRange` when the result falls outside the supported dates.
 */
export function shiftDate({ date, amount, unit, sign, timeZone, location }: DateShift): FormulaDate | FormulaDateTime {
  try {
    const duration = Temporal.Duration.from(amount instanceof FormulaDuration ? amount.value : unitDuration({ unit: unit!.value, amount: amount.value }));
    const signed = sign === 1 ? duration : duration.negated();

    return date instanceof FormulaDate
      ? new FormulaDate(date.value.add(signed))
      : FormulaDateTime.from(date.value.withTimeZone(timeZone).add(signed));
  }
  catch (error) {
    // With whole amounts, Temporal fails only when the duration or the resulting date leaves its range.
    throw Errors.Arithmetic.DateOutOfRange.create({ value: date.toString() }, { location, cause: error instanceof Error ? error : undefined });
  }
}

/** Fails a duration with hours or shorter units, which a date without a time cannot move by. */
function expectDateDuration(duration: FormulaDuration): ArgumentValidationFailure | undefined {
  const { hours, minutes, seconds, milliseconds, microseconds, nanoseconds } = duration.value;

  return [hours, minutes, seconds, milliseconds, microseconds, nanoseconds].every((part) => part === 0)
    ? undefined
    : { message: 'Expected a duration of whole days for a date without a time.', expected: ['duration of whole days'], actual: duration.toString() };
}
