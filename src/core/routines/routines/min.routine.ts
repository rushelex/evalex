import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNull, FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { collectNumbers } from './collect-numbers';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaNumber(1),
  },
  {
    formula: (name) => name('4', '[2, 8]'),
    result: () => new FormulaNumber(2),
  },
];

routinesRegistry.registerRoutine('min', {
  description: 'Returns the smallest number of the arguments.',
  examples: routineExamples,
  arguments: [arg('numbers', type.union(type.array(type.any), type.number), { repeatable: true })],
  returns: type.union(type.number, type.null),
  handler: ({ subject, args, location }) => {
    const numbers = collectNumbers({ values: [subject, ...args], location });

    return numbers.length === 0 ? new FormulaNull() : numbers.reduce((smallest, number) => (number.value < smallest.value ? number : smallest));
  },
});
