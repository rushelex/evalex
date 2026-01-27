import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name(),
    result: () => FormulaDate.from(Temporal.Now.zonedDateTimeISO('UTC')),
  },
]);

routinesRegistry.registerFunction('now', {
  description: 'Returns the current date and time.',
  examples: routineExamples,
  arguments: createRoutineArguments([]),
  handler: () => {
    return FormulaDate.from(Temporal.Now.zonedDateTimeISO('UTC'));
  },
});
