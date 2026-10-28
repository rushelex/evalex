import { arg } from '../arguments';
import { timeTokensIn } from './format-date-text';
import { TIME_ZONE_ARGUMENT } from './time-zone-argument';

/** The arguments of a date without a time formatted by a pattern, which shows no time and takes no time zone. */
export const DATE_PATTERN_SIGNATURE = [
  arg.date('date'),
  arg.string('pattern', {
    validation: (pattern) => {
      const tokens = timeTokensIn(pattern.value);

      return tokens.length === 0
        ? undefined
        : { message: `Expected a pattern without a time for a date without a time; found ${tokens.join(', ')}.`, expected: ['pattern of date tokens'], actual: pattern.value };
    },
  }),
] as const;

/** The arguments of a date and time formatted by a pattern, shared by `formatDate` and the date form of `format`. */
export const DATE_TIME_PATTERN_SIGNATURE = [
  arg.dateTime('date'),
  arg.string('pattern'),
  TIME_ZONE_ARGUMENT,
] as const;
