import { Temporal } from 'temporal-polyfill';

import { createRoutineArguments } from '../../routines/arguments';
import { routinesRegistry } from '../../routines/registry';
import { createRoutineExamples } from '../../routines/routine-examples';
import { defineCoreMethods } from '../core-methods';
import { FormulaNumber } from '../number';
import { FormulaDuration } from './FormulaDuration';

defineCoreMethods(FormulaDuration);

const DURATION_UNITS = [
  'years',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds',
] as const;

for (const unit of DURATION_UNITS) {
  routinesRegistry.registerMethod(FormulaDuration, unit, {
    description: `Returns the number of ${unit} in the duration.`,
    examples: createRoutineExamples([
      {
        formula: (name) => name('duration'),
        result: () => {
          const duration = Temporal.Duration.from({ years: 2, months: 10, weeks: 3, days: 5, hours: 6, minutes: 42, seconds: 30, milliseconds: 100 });
          return new FormulaNumber(duration[unit]);
        },
      },
    ]),
    arguments: createRoutineArguments([]),
    handler: ({ instance }) => {
      return new FormulaNumber(instance.value[unit]);
    },
  });
}
