import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDate, FormulaDateRange, FormulaDateTime } from '../../data-types';
import { Errors } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('parseDate("2022-09-07")', 'parseDate("2023-09-07")'),
    result: () => FormulaDateRange.from({ start: '2022-09-07', end: '2023-09-07' }),
  },
  {
    formula: (name) => name('parseDate("2022-09-07T10:00Z")', 'parseDate("2022-09-07T18:00Z")'),
    result: () => FormulaDateRange.from({ start: '2022-09-07T10:00Z', end: '2022-09-07T18:00Z' }),
  },
  {
    formula: (name) => name('parseDate("2023-09-07")', 'parseDate("2022-09-07")'),
    error: {
      type: Errors.Argument.Validation,
      message: 'Expected an end date that is not before the start date.',
      location: { function: [35, 58], method: [30, 53] },
    },
  },
  {
    formula: (name) => name('parseDate("2022-09-07")', 'parseDate("2023-09-07T18:00Z")'),
    error: {
      type: Errors.Argument.TypeMismatch,
      message: 'Expected type Date.',
      location: { function: [35, 65], method: [30, 60] },
    },
  },
];

routinesRegistry.registerRoutine({ function: 'dateRange', method: ['range', 'dateRange'] }, {
  description: 'Returns the date range from the start date to the end date.',
  examples: routineExamples,
  arguments: [[arg.date('start'), arg.date('end')], [arg.dateTime('start'), arg.dateTime('end')]],
  returns: [type.dateRange, type.dateRange],
  handler: ({ subject, args: [end], locations }) => {
    // The signatures pair two dates or two dates and times, never one of each.
    const endsFirst = (subject instanceof FormulaDate && end instanceof FormulaDate && Temporal.PlainDate.compare(subject.value, end.value) > 0)
      || (subject instanceof FormulaDateTime && end instanceof FormulaDateTime && Temporal.ZonedDateTime.compare(subject.value, end.value) > 0);

    if (endsFirst) {
      throw Errors.Argument.Validation.create({
        message: 'Expected an end date that is not before the start date.',
        expected: ['date not before the start'],
        actual: end.toString(),
        argumentPosition: 2,
      }, { location: locations[0] });
    }

    return FormulaDateRange.from({ start: subject.value, end: end.value });
  },
});
