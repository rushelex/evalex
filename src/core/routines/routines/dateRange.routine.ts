import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDateRange } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('parseDate("2022-09-07")', 'parseDate("2023-09-07")'),
    result: () => FormulaDateRange.from({ start: '2022-09-07', end: '2023-09-07' }),
  },
  {
    formula: (name) => name('parseDate("2023-09-07")', 'parseDate("2022-09-07")'),
    error: {
      type: Errors.Argument.Validation,
      message: 'Expected an end date that is not before the start date.',
      location: { function: [35, 58], method: [30, 53] },
    },
  },
];

routinesRegistry.registerRoutine({ function: 'dateRange', method: ['range', 'dateRange'] }, {
  description: 'Returns the date range from the start date to the end date.',
  examples: routineExamples,
  arguments: [arg.dateTime('start'), arg.dateTime('end')],
  handler: ({ subject, args: [end], locations }) => {
    if (Temporal.ZonedDateTime.compare(subject.value, end.value) > 0) {
      throw Errors.Argument.Validation.create({
        message: 'Expected an end date that is not before the start date.',
        expected: ['date not before the start'],
        actual: end.toString(),
        argumentPosition: 2,
      }, { location: locations[0] });
    }

    return new FormulaDateRange({ start: subject.value, end: end.value });
  },
});
