import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNumber } from '../../data-types';
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
];

routinesRegistry.registerRoutine('sum', {
  description: 'Returns the sum of its arguments.',
  examples: routineExamples,
  arguments: [arg('numbers', type.union(type.array(type.any), type.number), { repeatable: true })],
  returns: type.number,
  handler: ({ subject, args, location }) => {
    const numbers = collectNumbers({ values: [subject, ...args], location });

    return numbers.reduce(decimalArithmetic.add, FormulaNumber.from(0));
  },
});
