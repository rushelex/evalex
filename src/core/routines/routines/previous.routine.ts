import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { Errors } from '../../errors';
import { routinesRegistry } from '../registry';
import { neighborHandler } from './neighbor-routine';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('total', '0'),
    result: () => new FormulaNumber(0),
  },
  {
    formula: () => 'previous(total)',
    error: {
      type: Errors.Argument.ExactCount,
      message: 'Expected 2 arguments.',
      location: { function: [0, 15] },
    },
  },
];

routinesRegistry.registerFunction('previous', {
  description: 'Evaluates the expression over the previous record of the list.',
  examples: routineExamples,
  handler: neighborHandler(-1),
});
