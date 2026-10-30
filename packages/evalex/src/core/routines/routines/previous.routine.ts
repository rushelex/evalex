import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray } from '../../data-types';
import { Errors } from '../../errors';
import { type } from '../../types';
import { routinesRegistry } from '../registry';
import { neighborHandler } from './neighbor-routine';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => `${name('total', '0')} + amount`,
    records: { cell: 'total', list: [{ amount: 10 }, { amount: 5 }, { amount: 20 }] },
    result: () => FormulaArray.from([10, 15, 35]),
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
  returns: type.any,
  handler: neighborHandler(-1),
});
