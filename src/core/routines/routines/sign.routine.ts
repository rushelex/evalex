import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('-10'),
    result: () => new FormulaNumber(-1),
  },
  {
    formula: (name) => name('0'),
    result: () => new FormulaNumber(0),
  },
];

routinesRegistry.registerRoutine('sign', {
  description: 'Returns 1, -1 or 0 for a positive, negative or zero number.',
  examples: routineExamples,
  arguments: [arg.number('number')],
  handler: ({ subject }) => FormulaNumber.from(Math.sign(subject.value)),
});
