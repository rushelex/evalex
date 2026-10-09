import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('64'),
    result: () => new FormulaNumber(4),
  },
  {
    formula: (name) => name('-27'),
    result: () => new FormulaNumber(-3),
  },
];

routinesRegistry.registerRoutine('cbrt', {
  description: 'Returns the cube root of the number.',
  examples: routineExamples,
  arguments: [arg.number('number')],
  handler: ({ subject }) => FormulaNumber.from(Math.cbrt(subject.value)),
});
