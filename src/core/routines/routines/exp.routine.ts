import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('1'),
    result: () => new FormulaNumber(Math.E),
  },
];

routinesRegistry.registerRoutine('exp', {
  description: 'Returns e raised to the power of the number.',
  examples: routineExamples,
  arguments: [arg.number('number')],
  handler: ({ subject }) => FormulaNumber.from(Math.exp(subject.value)),
});
