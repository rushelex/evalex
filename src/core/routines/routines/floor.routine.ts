import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('-0.6'),
    result: () => new FormulaNumber(-1),
  },
  {
    formula: (name) => name('1.8'),
    result: () => new FormulaNumber(1),
  },
];

routinesRegistry.registerRoutine('floor', {
  description: 'Returns the largest integer less than or equal to the number.',
  examples: routineExamples,
  arguments: [arg.number('number')],
  handler: ({ subject }) => FormulaNumber.from(Math.floor(subject.value)),
});
