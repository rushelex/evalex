import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray } from '../../data-types';
import { Errors } from '../../errors';
import { routinesRegistry } from '../registry';
import { neighborHandler } from './neighbor-routine';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => `${name('rest', '0')} + amount`,
    records: { cell: 'rest', list: [{ amount: 10 }, { amount: 5 }, { amount: 20 }] },
    result: () => FormulaArray.from([35, 25, 20]),
  },
  {
    formula: () => 'next(rest)',
    error: {
      type: Errors.Argument.ExactCount,
      message: 'Expected 2 arguments.',
      location: { function: [0, 10] },
    },
  },
];

routinesRegistry.registerFunction('next', {
  description: 'Evaluates the expression over the next record of the list.',
  examples: routineExamples,
  handler: neighborHandler(1),
});
