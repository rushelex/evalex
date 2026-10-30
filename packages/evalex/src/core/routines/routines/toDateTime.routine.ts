import { FormulaDateTime } from '../../data-types';
import { Errors } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { TIME_ZONE_ARGUMENT } from './time-zone-argument';

// Hours and minutes, with optional seconds and their fraction, as `PlainTime.from` would otherwise also take a whole date and time
const TIME_TEXT = /^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;

routinesRegistry.registerRoutine('toDateTime', {
  description: 'Returns the start of the date, or the given time on it.',
  examples: [
    {
      formula: (name) => name('parseDate("2023-08-30")'),
      result: () => FormulaDateTime.from('2023-08-30T00:00Z'),
    },
    {
      formula: (name) => name('parseDate("2023-08-30")', '"13:30"'),
      result: () => FormulaDateTime.from('2023-08-30T13:30Z'),
    },
    {
      formula: (name) => name('parseDate("2023-08-30")', '"13:30"', '"Europe/Berlin"'),
      result: () => FormulaDateTime.from('2023-08-30T11:30Z'),
    },
    {
      formula: (name) => name('parseDate("2023-08-30")', '"1:30 pm"'),
      error: {
        type: Errors.Argument.Validation,
        message: 'Expected a time such as "13:30" or "09:05:30".',
        location: { function: [36, 45], method: [35, 44] },
      },
    },
  ],
  arguments: [
    arg.date('date'),
    arg.string('time', {
      optional: true,
      validation: (time) => (readTime(time.value)
        ? undefined
        : { message: 'Expected a time such as "13:30" or "09:05:30".', expected: ['time'], actual: time.value }),
    }),
    TIME_ZONE_ARGUMENT,
  ],
  returns: type.dateTime,
  handler: ({ subject, args: [time, timezone], visitor, location }) => {
    const timeZone = timezone?.value ?? visitor.timeZone;
    const plainTime = time === undefined ? undefined : readTime(time.value);

    try {
      // Without a time the day starts at its first instant, which is not midnight where the clocks skip it
      const moment = plainTime === undefined ? subject.value.toZonedDateTime(timeZone) : subject.value.toZonedDateTime({ timeZone, plainTime });

      return new FormulaDateTime(moment.withTimeZone('UTC'));
    }
    catch (error) {
      // The first and the last days a date holds reach past the instants a date and time holds
      throw Errors.Arithmetic.DateOutOfRange.create({ value: subject.toString() }, { location, cause: error instanceof Error ? error : undefined });
    }
  },
});

function readTime(text: string): Temporal.PlainTime | undefined {
  if (!TIME_TEXT.test(text)) {
    return undefined;
  }

  try {
    return Temporal.PlainTime.from(text, { overflow: 'reject' });
  }
  catch {
    return undefined;
  }
}
