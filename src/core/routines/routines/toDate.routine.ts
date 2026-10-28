import { FormulaDate } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { TIME_ZONE_ARGUMENT } from './time-zone-argument';

routinesRegistry.registerRoutine('toDate', {
  description: 'Returns the date a date and time falls on, without the time.',
  examples: [
    {
      formula: (name) => name('parseDate("2023-08-30T22:30Z")'),
      result: () => FormulaDate.from('2023-08-30'),
    },
    {
      formula: (name) => name('parseDate("2023-08-30T22:30Z")', '"Europe/Berlin"'),
      result: () => FormulaDate.from('2023-08-31'),
    },
    {
      formula: (name) => name('parseDate("2023-08-30T22:30Z")', '"Mars/Base"'),
      error: {
        type: Errors.Argument.Validation,
        message: 'Expected a time zone name such as "Europe/Berlin" or an offset such as "+05:00".',
        location: { function: [39, 50], method: [38, 49] },
      },
    },
  ],
  arguments: [arg.dateTime('date'), TIME_ZONE_ARGUMENT],
  handler: ({ subject, args: [timezone], visitor }) => new FormulaDate(subject.value.withTimeZone(timezone?.value ?? visitor.timeZone).toPlainDate()),
});
