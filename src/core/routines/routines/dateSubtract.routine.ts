import type { FormulaNumber, FormulaString } from '../../data-types';
import type { ProcessedArgument } from '../arguments';

import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const DURATION_UNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'] as const;

routinesRegistry.registerRoutine({ function: 'dateSubtract', method: 'subtract' }, {
  on: [FormulaDate],
  description: 'Subtracts a duration or a number of units from the date.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('parseDate("2023-07-10T17:35Z")', '1', '"years"'),
      result: () => {
        const date = Temporal.ZonedDateTime.from({ year: 2023, month: 7, day: 10, hour: 17, minute: 35, timeZone: 'UTC' });
        return new FormulaDate(date.subtract({ years: 1 }));
      },
    },
  ]),
  arguments: createRoutineArguments([
    [
      new Argument(Kind.Date, { name: 'date' }),
      new Argument(Kind.Duration, { name: 'duration' }),
    ],
    [
      new Argument(Kind.Date, { name: 'date' }),
      new Argument(Kind.Number, { name: 'number' }),
      new Argument(Kind.String, {
        name: 'unit',
        validation: (dataType) => {
          if (!DURATION_UNITS.includes(dataType.value)) {
            return {
              message: 'Expected "years", "months", "weeks", "days", "hours", "minutes", "seconds".',
              actual: dataType.value,
              expected: DURATION_UNITS,
              argumentPosition: 2,
              argumentName: 'unit',
            };
          }
        },
      }),
    ],
  ]),
  handler: ({ subject, args }) => {
    const [firstArg, secondArg] = args as [ProcessedArgument<FormulaDuration>] | [ProcessedArgument<FormulaNumber>, ProcessedArgument<FormulaString>];

    if (firstArg.dataType instanceof FormulaDuration) {
      return new FormulaDate(subject.value.subtract(firstArg.dataType.value));
    }

    return new FormulaDate(subject.value.subtract({ [secondArg!.dataType.value]: firstArg.dataType.value }));
  },
});
