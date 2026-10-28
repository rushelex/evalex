import { isTimeZone } from '../../time-zone';
import { arg } from '../arguments';

/** The arguments of a date formatted by a pattern, shared by `formatDate` and the date form of `format`. */
export const DATE_PATTERN_SIGNATURE = [
  arg.dateTime('date'),
  arg.string('pattern'),
  arg.string('timezone', {
    optional: true,
    validation: (timezone) => (isTimeZone(timezone.value)
      ? undefined
      : {
          message: 'Expected a time zone name such as "Europe/Berlin" or an offset such as "+05:00".',
          expected: ['time zone'],
          actual: timezone.value,
        }),
  }),
] as const;
