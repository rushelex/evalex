import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDate, FormulaDateTime } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('"2023-07-10"'),
    result: () => FormulaDate.from('2023-07-10'),
  },
  {
    formula: (name) => name('"2023-07-10T17:35Z"'),
    result: () => FormulaDateTime.from('2023-07-10T17:35Z'),
  },
];

routinesRegistry.registerRoutine('parseDate', {
  description: 'Returns the date parsed according to the ISO 8601 standard.',
  examples: routineExamples,
  arguments: [
    arg.string('date', {
      validation: (value) => {
        try {
          FormulaDateTime.from(value.value);
        }
        catch {
          return { message: 'Expected valid date string.', expected: ['valid date string'], actual: value.value };
        }
      },
    }),
  ],
  returns: type.union(type.date, type.dateTime),
  // Text without a time is a date, so a date written as text never turns into midnight of some time zone.
  handler: ({ subject, visitor }) => (FormulaDate.isDayText(subject.value)
    ? FormulaDate.from(subject.value)
    : FormulaDateTime.from(subject.value, { timeZone: visitor.timeZone })),
});
