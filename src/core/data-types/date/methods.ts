import type { ProcessedArgument } from '../../routines/arguments';
import type { FormulaString } from '../string';

import { Temporal } from 'temporal-polyfill';

import { Argument, createRoutineArguments } from '../../routines/arguments';
import { routinesRegistry } from '../../routines/registry';
import { createRoutineExamples } from '../../routines/routine-examples';
import { defineCoreMethods } from '../core-methods';
import { FormulaDuration } from '../duration';
import { Kind } from '../kind';
import { FormulaNull } from '../null';
import { FormulaNumber } from '../number';
import { FormulaDate } from './FormulaDate';

defineCoreMethods(FormulaDate);

const routineUnitExamples = createRoutineExamples([
  {
    formula: (name) => name('parseDate("2023-07-10T17:35Z")'),
    result: () => new FormulaNumber(2023),
  },
]);

routinesRegistry.registerMethod(FormulaDate, 'year', {
  description: 'Returns the year of the date (4 digits).',
  examples: routineUnitExamples,
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.year);
  },
});

routinesRegistry.registerMethod(FormulaDate, 'month', {
  description: 'Returns the month of the date (1-12).',
  examples: routineUnitExamples,
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.month);
  },
});

routinesRegistry.registerMethod(FormulaDate, 'week', {
  description: 'Returns the ISO week of the year of the date (1-53).',
  examples: routineUnitExamples,
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return instance.value.weekOfYear === undefined ? new FormulaNull() : new FormulaNumber(instance.value.weekOfYear);
  },
});

routinesRegistry.registerMethod(FormulaDate, 'date', {
  description: 'Returns the day of the month from the date (1-31).',
  examples: routineUnitExamples,
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.day);
  },
});

routinesRegistry.registerMethod(FormulaDate, 'day', {
  description: 'Returns the day of the week of the date, between 1 (Monday) and 7 (Sunday).',
  examples: routineUnitExamples,
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.dayOfWeek);
  },
});

routinesRegistry.registerMethod(FormulaDate, 'hour', {
  description: 'Returns the hour of the date (0-23).',
  examples: routineUnitExamples,
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.hour);
  },
});

routinesRegistry.registerMethod(FormulaDate, 'minute', {
  description: 'Returns the minute of the date (0-59).',
  examples: routineUnitExamples,
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.minute);
  },
});

const DURATION_UNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'] as const;

routinesRegistry.registerMethod(FormulaDate, 'subtract', {
  description: 'Subtracts a duration or a date from the date.',
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
            return 'Expected "years", "months", "weeks", "days", "hours", "minutes", "seconds".';
          }
        },
      }),
    ],
  ]),
  handler: ({ instance, args }) => {
    const [firstArg, secondArg] = args as [ProcessedArgument<FormulaDuration>] | [ProcessedArgument<FormulaNumber>, ProcessedArgument<FormulaString>];

    if (firstArg.dataType instanceof FormulaDuration) {
      return new FormulaDate(instance.value.subtract(firstArg.dataType.value));
    }

    return new FormulaDate(instance.value.subtract({ [secondArg!.dataType.value]: firstArg.dataType.value }));
  },
});
