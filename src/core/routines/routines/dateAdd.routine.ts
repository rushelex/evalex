import type { FormulaNumber, FormulaString } from '../../data-types';
import type { ProcessedArgument } from '../arguments';

import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('parseDate("2023-08-30")', '1', '"days"'),
    result: () => FormulaDate.from(Temporal.ZonedDateTime.from({ year: 2023, month: 8, day: 31, timeZone: 'UTC' })),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '2', '"months"'),
    result: () => FormulaDate.from(Temporal.ZonedDateTime.from({ year: 2023, month: 10, day: 30, timeZone: 'UTC' })),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")', '3', '"years"'),
    result: () => FormulaDate.from(Temporal.ZonedDateTime.from({ year: 2026, month: 8, day: 30, timeZone: 'UTC' })),
  },
]);

const DURATION_UNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'] as const;

const routineArguments = createRoutineArguments([
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
            message: `Expected ${DURATION_UNITS.map((u) => `"${u}"`).join(', ')}.`,
            actual: dataType.value,
            expected: DURATION_UNITS,
            argumentPosition: 2,
          };
        }
      },
    }),
  ],
]);

routinesRegistry.registerFunction('dateAdd', {
  description: 'Adds a duration or a number of units to the date.',
  examples: routineExamples,
  arguments: routineArguments,
  handler: ({ args }) => {
    const [dateArg, firstArg, secondArg] = args as [ProcessedArgument<FormulaDate>, ProcessedArgument<FormulaDuration>] | [ProcessedArgument<FormulaDate>, ProcessedArgument<FormulaNumber>, ProcessedArgument<FormulaString>];

    const durationToAdd: Temporal.DurationLike = firstArg.dataType instanceof FormulaDuration
      ? firstArg.dataType.value
      : { [secondArg!.dataType.value]: firstArg.dataType.value };

    return FormulaDate.from(dateArg.dataType.value.add(durationToAdd));
  },
});

routinesRegistry.registerMethod(FormulaDate, 'add', {
  description: 'Adds a duration or a number of units to the date.',
  examples: routineExamples,
  arguments: routineArguments,
  handler: ({ instance, args }) => {
    const [firstArg, secondArg] = args as [ProcessedArgument<FormulaDuration>] | [ProcessedArgument<FormulaNumber>, ProcessedArgument<FormulaString>];

    const durationToAdd: Temporal.DurationLike = firstArg.dataType instanceof FormulaDuration
      ? firstArg.dataType.value
      : { [secondArg!.dataType.value]: firstArg.dataType.value };

    return new FormulaDate(instance.value.add(durationToAdd));
  },
});
