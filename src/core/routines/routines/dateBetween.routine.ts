import type { FormulaString } from '../../data-types';
import type { ProcessedArgument } from '../arguments';

import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaDuration, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const DURATION_UNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes'] as const;

const SINGULAR_UNITS = {
  years: 'year',
  months: 'month',
  weeks: 'week',
  days: 'day',
  hours: 'hour',
  minutes: 'minute',
} as const satisfies Record<typeof DURATION_UNITS[number], string>;

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('parseDate("2023-08-30")', 'parseDate("2022-09-07")', '"days"'),
    result: () => FormulaDuration.from(Temporal.Duration.from({ days: 357 })),
  },
  {
    formula: (name) => name('parseDate("2030-01-01")', 'parseDate("2023-08-30")', '"years"'),
    result: () => FormulaDuration.from(Temporal.Duration.from({ years: 6, months: 4, days: 2 })),
  },
]);

const routineArguments = createRoutineArguments([
  new Argument(Kind.Date, { name: 'date1' }),
  new Argument(Kind.Date, { name: 'date2' }),
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
]);

routinesRegistry.registerFunction('dateBetween', {
  description: 'Returns the difference between two dates. The unit argument can be one of: “years”, “months”, “weeks”, “days”, “hours”, or “minutes”.',
  examples: routineExamples,
  arguments: routineArguments,
  handler: ({ args }) => {
    const [date1Arg, date2Arg, unitArg] = args as [ProcessedArgument<FormulaDate>, ProcessedArgument<FormulaDate>, ProcessedArgument<FormulaString>];
    return new FormulaDuration(date1Arg.dataType.value.since(date2Arg.dataType.value, { largestUnit: SINGULAR_UNITS[unitArg.dataType.value as typeof DURATION_UNITS[number]] }));
  },
});

routinesRegistry.registerMethod(FormulaDate, 'between', {
  description: 'Returns the difference between two dates. The unit argument can be one of: “years”, “months”, “weeks”, “days”, “hours”, or “minutes”.',
  examples: routineExamples,
  arguments: routineArguments,
  handler: ({ instance, args }) => {
    const [dateArg, unitArg] = args as [ProcessedArgument<FormulaDate>, ProcessedArgument<FormulaString>];
    return new FormulaDuration(instance.value.since(dateArg.dataType.value, { largestUnit: SINGULAR_UNITS[unitArg.dataType.value as typeof DURATION_UNITS[number]] }));
  },
});
