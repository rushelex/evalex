import type { RoutineExampleOptions } from '../routine-example';

import { FormulaString } from '../../data-types';
import { Errors } from '../../errors';
import { routinesRegistry } from '../registry';
import { DATE_PATTERN_SIGNATURE } from './date-pattern-signature';
import { formatDateText } from './format-date-text';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('parseDate("2023-08-30T14:05Z")', '"MMMM D, YYYY h:mm A"'),
    result: () => new FormulaString('August 30, 2023 2:05 PM'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30T23:30Z")', '"DD.MM.YYYY HH:mm"', '"Europe/Berlin"'),
    result: () => new FormulaString('31.08.2023 01:30'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '"dddd, [week] W"'),
    result: () => new FormulaString('Wednesday, week W'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '"LLLL YYYY"'),
    result: () => new FormulaString('August 2023'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '"YYYY"', '"Mars/Base"'),
    error: {
      type: Errors.Argument.Validation,
      message: 'Expected a time zone name such as "Europe/Berlin" or an offset such as "+05:00".',
      location: { function: [44, 55], method: [43, 54] },
    },
  },
];

routinesRegistry.registerRoutine('formatDate', {
  description: 'Returns the date as text built from a pattern such as "MMMM D".',
  examples: routineExamples,
  arguments: DATE_PATTERN_SIGNATURE,
  handler: ({ subject, args: [pattern, timezone], visitor }) => new FormulaString(formatDateText({
    date: subject.value.withTimeZone(timezone?.value ?? visitor.timeZone),
    pattern: pattern.value,
    names: visitor.format?.names,
  })),
});
