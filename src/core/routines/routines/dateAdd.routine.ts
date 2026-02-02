import type { FormulaNumber, FormulaString } from '../../data-types';
import type { ProcessedArgument } from '../arguments';

import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('now()', '1', '"days"'),
    result: () => FormulaDate.from(Temporal.Now.zonedDateTimeISO('UTC').add({ days: 1 })),
  },
  {
    formula: (name) => name('now()', '2', '"months"'),
    result: () => FormulaDate.from(Temporal.Now.zonedDateTimeISO('UTC').add({ months: 2 })),
  },
  {
    formula: (name) => name('now()', '3', '"years"'),
    result: () => FormulaDate.from(Temporal.Now.zonedDateTimeISO('UTC').add({ years: 3 })),
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
  description: 'Adds time to the date. The unit argument can be one of: “years”, “months”, “weeks”, “days”, “hours”, “minutes”, or “seconds”.',
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
  description: 'Adds time to the date. The unit argument can be one of: “years”, “months”, “weeks”, “days”, “hours”, “minutes”, or “seconds”.',
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
