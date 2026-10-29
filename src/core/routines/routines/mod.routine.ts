import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNumber } from '../../data-types';
import { Errors } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('5', '10'),
    result: () => new FormulaNumber(5),
  },
  {
    formula: (name) => name('5', '0'),
    error: {
      type: Errors.Arithmetic.ModuloByZero,
      message: 'Division by zero (modulo).',
      location: { function: [7, 8], method: [6, 7] },
    },
  },
];

routinesRegistry.registerRoutine('mod', {
  description: 'Returns the first number modulo the second number.',
  examples: routineExamples,
  arguments: [arg.number('dividend'), arg.number('divisor')],
  returns: type.number,
  handler: ({ subject, args: [divisor], locations }) => {
    if (divisor.value === 0) {
      throw Errors.Arithmetic.ModuloByZero.create({ dividend: subject.value }, { location: locations[0] });
    }

    return decimalArithmetic.remainder(subject, divisor);
  },
});
