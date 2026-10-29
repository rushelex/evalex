import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNumber } from '../../data-types';
import { Errors } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('5', '10'),
    result: () => new FormulaNumber(0.5),
  },
  {
    formula: (name) => name('5', '0'),
    error: {
      type: Errors.Arithmetic.DivisionByZero,
      message: 'Division by zero.',
      location: { function: [10, 11], method: [9, 10] },
    },
  },
];

routinesRegistry.registerRoutine('divide', {
  description: 'Returns the quotient of two numbers.',
  examples: routineExamples,
  arguments: [arg.number('dividend'), arg.number('divisor')],
  returns: type.number,
  handler: ({ subject, args: [divisor], locations }) => {
    if (divisor.value === 0) {
      throw Errors.Arithmetic.DivisionByZero.create({ dividend: subject.value }, { location: locations[0] });
    }

    return decimalArithmetic.divide(subject, divisor);
  },
});
