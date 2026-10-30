import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNull, FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { collectNumbers } from './collect-numbers';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]', '4', '5'),
    result: () => new FormulaNumber(3),
  },
];

routinesRegistry.registerRoutine('mean', {
  description: 'Returns the arithmetic average of its arguments.',
  examples: routineExamples,
  arguments: [arg('numbers', type.nested(type.number), { repeatable: true })],
  returns: type.union(type.number, type.null),
  handler: ({ subject, args }) => {
    const numbers = collectNumbers([subject, ...args]);

    return numbers.length === 0 ? new FormulaNull() : decimalArithmetic.divide(numbers.reduce(decimalArithmetic.add, FormulaNumber.from(0)), FormulaNumber.from(numbers.length));
  },
});
