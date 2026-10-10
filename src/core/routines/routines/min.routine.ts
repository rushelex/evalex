import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNull, FormulaNumber, Kind } from '../../data-types';
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
  arguments: [arg.oneOf('numbers', [Kind.Array, Kind.Number], { repeatable: true })],
  handler: ({ subject, args, location }) => {
    const numbers = collectNumbers({ values: [subject, ...args], location });

    return numbers.length === 0 ? new FormulaNull() : numbers.reduce((smallest, number) => (number.value < smallest.value ? number : smallest));
  },
});
