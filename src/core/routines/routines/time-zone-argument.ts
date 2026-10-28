import { isTimeZone } from '../../time-zone';
import { arg } from '../arguments';

/** The optional time zone of a routine that reads or writes a date and time, the zone of the scope when left out. */
export const TIME_ZONE_ARGUMENT = arg.string('timezone', {
  optional: true,
  validation: (timezone) => (isTimeZone(timezone.value)
    ? undefined
    : {
        message: 'Expected a time zone name such as "Europe/Berlin" or an offset such as "+05:00".',
        expected: ['time zone'],
        actual: timezone.value,
      }),
});
