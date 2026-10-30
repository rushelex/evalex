import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNull, FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { collectNumbers } from './collect-numbers';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('1', '2', '3'),
    result: () => new FormulaNumber(3),
  },
  {
    formula: (name) => name('4', '[2, 8]'),
    result: () => new FormulaNumber(8),
  },
];

routinesRegistry.registerRoutine('max', {
  description: 'Returns the largest number of the arguments.',
  examples: routineExamples,
  arguments: [arg('numbers', type.nested(type.number), { repeatable: true })],
  returns: type.union(type.number, type.null),
  handler: ({ subject, args }) => {
    const numbers = collectNumbers([subject, ...args]);

    return numbers.length === 0 ? new FormulaNull() : numbers.reduce((largest, number) => (number.value > largest.value ? number : largest));
  },
});
