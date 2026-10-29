import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('5', '10'),
    result: () => new FormulaNumber(-5),
  },
];

routinesRegistry.registerRoutine('subtract', {
  description: 'Returns the difference of two numbers.',
  examples: routineExamples,
  arguments: [arg.number('a'), arg.number('b')],
  returns: type.number,
  handler: ({ subject, args: [b] }) => decimalArithmetic.subtract(subject, b),
});
