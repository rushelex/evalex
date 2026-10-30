import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNumber } from '../../data-types';
import { Errors } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { collectNumbers } from './collect-numbers';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaNumber(6),
  },
  {
    formula: (name) => name('1', '2', '3'),
    result: () => new FormulaNumber(6),
  },
  {
    formula: (name) => name('1', '[2, 3, [4, 5]]'),
    result: () => new FormulaNumber(15),
  },
  {
    formula: (name) => name('1', '[2, ["3"]]'),
    error: {
      type: Errors.Argument.NestedTypeMismatch,
      message: 'Expected type Number, or lists of it.',
      location: { function: [7, 17], method: [6, 16] },
    },
  },
];

routinesRegistry.registerRoutine('sum', {
  description: 'Returns the sum of its arguments.',
  examples: routineExamples,
  arguments: [arg('numbers', type.nested(type.number), { repeatable: true })],
  returns: type.number,
  handler: ({ subject, args }) => {
    const numbers = collectNumbers([subject, ...args]);

    return numbers.reduce(decimalArithmetic.add, FormulaNumber.from(0));
  },
});
