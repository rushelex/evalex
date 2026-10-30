import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDate, FormulaDateTime, FormulaString } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { DATE_PATTERN_SIGNATURE, DATE_TIME_PATTERN_SIGNATURE } from './date-pattern-signature';
import { formatDateText } from './format-date-text';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('1234'),
    result: () => new FormulaString('1234'),
  },
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaString('1, 2, 3'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '"MM/DD/YYYY"'),
    result: () => new FormulaString('08/30/2023'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30T14:05Z")', '"MM/DD/YYYY HH:mm"'),
    result: () => new FormulaString('08/30/2023 14:05'),
  },
];

routinesRegistry.registerRoutine('format', {
  description: 'Returns the value formatted as text.',
  examples: routineExamples,
  arguments: [DATE_PATTERN_SIGNATURE, DATE_TIME_PATTERN_SIGNATURE, [arg.any('value')]],
  returns: [type.string, type.string, type.string],
  handler: ({ subject, args: [pattern, timezone], visitor }) => {
    if (subject instanceof FormulaDate && pattern) {
      return new FormulaString(formatDateText({ date: subject.value, pattern: pattern.value, names: visitor.format?.names }));
    }

    if (subject instanceof FormulaDateTime && pattern) {
      return new FormulaString(formatDateText({
        date: subject.value.withTimeZone(timezone?.value ?? visitor.timeZone),
        pattern: pattern.value,
        names: visitor.format?.names,
      }));
    }

    return new FormulaString(subject.toString({ format: visitor.format }));
  },
});
