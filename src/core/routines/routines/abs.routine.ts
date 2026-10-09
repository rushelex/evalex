import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('-10'),
    result: () => new FormulaNumber(10),
  },
];

routinesRegistry.registerRoutine('abs', {
  description: 'Returns the absolute value of the number.',
  examples: routineExamples,
  arguments: [arg.number('number')],
  handler: ({ subject }) => FormulaNumber.from(Math.abs(subject.value)),
});
