import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('-0.6'),
    result: () => new FormulaNumber(0),
  },
  {
    formula: (name) => name('1.2'),
    result: () => new FormulaNumber(2),
  },
];

routinesRegistry.registerRoutine('ceil', {
  description: 'Returns the smallest integer greater than or equal to the number.',
  examples: routineExamples,
  arguments: [arg.number('number')],
  handler: ({ subject }) => FormulaNumber.from(Math.ceil(subject.value)),
});
