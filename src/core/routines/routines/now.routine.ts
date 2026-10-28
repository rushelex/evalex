import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDateTime } from '../../data-types';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name(),
    result: () => FormulaDateTime.from(Temporal.Now.zonedDateTimeISO('UTC')),
  },
];

routinesRegistry.registerFunction('now', {
  description: 'Returns the current date and time.',
  examples: routineExamples,
  arguments: [],
  volatile: true,
  handler: () => FormulaDateTime.from(Temporal.Now.zonedDateTimeISO('UTC')),
});
