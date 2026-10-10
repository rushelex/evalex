import type { RoutineExampleOptions } from '../routine-example';

import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../../data-types';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name(),
    result: () => FormulaDate.from(Temporal.Now.zonedDateTimeISO('UTC')),
  },
];

routinesRegistry.registerFunction('now', {
  description: 'Returns the current date and time.',
  examples: routineExamples,
  arguments: [],
  volatile: true,
  handler: () => FormulaDate.from(Temporal.Now.zonedDateTimeISO('UTC')),
});
