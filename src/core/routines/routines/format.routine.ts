import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDate, FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { DATE_PATTERN_SIGNATURE } from './date-pattern-signature';
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
];

routinesRegistry.registerRoutine('format', {
  description: 'Returns the value formatted as text.',
  examples: routineExamples,
  arguments: [DATE_PATTERN_SIGNATURE, [arg.any('value')]],
  handler: ({ subject, args: [pattern, timezone] }) => {
    if (subject instanceof FormulaDate && pattern) {
      return new FormulaString(formatDateText({
        date: subject.value.withTimeZone(timezone?.value ?? 'UTC'),
        pattern: pattern.value,
      }));
    }

    return new FormulaString(subject.toString());
  },
});
