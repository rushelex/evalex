import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNumber } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('5', '10'),
    result: () => new FormulaNumber(9765625),
  },
  {
    formula: (name) => name('-8', '1 / 3'),
    error: {
      type: Errors.Arithmetic.NotARealNumber,
      message: 'Result is not a real number.',
      location: { function: [0, 14], method: [0, 15] },
    },
  },
];

routinesRegistry.registerRoutine('pow', {
  description: 'Returns the result of a base number raised to an exponent power.',
  examples: routineExamples,
  arguments: [arg.number('base'), arg.number('exponent')],
  handler: ({ subject, args: [exponent] }) => decimalArithmetic.power(subject, exponent),
});
