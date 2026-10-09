import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNull, FormulaNumber, Kind } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { collectNumbers } from './collect-numbers';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]', '4'),
    result: () => new FormulaNumber(2.5),
  },
  {
    formula: (name) => name('[3, 1, 2]'),
    result: () => new FormulaNumber(2),
  },
];

routinesRegistry.registerRoutine('median', {
  description: 'Returns the middle value of its arguments.',
  examples: routineExamples,
  arguments: [arg.oneOf('numbers', [Kind.Array, Kind.Number], { repeatable: true })],
  handler: ({ subject, args, location }) => {
    const numbers = collectNumbers({ values: [subject, ...args], location });

    return numbers.length === 0 ? new FormulaNull() : new FormulaNumber(median(numbers));
  },
});

function median(numbers: readonly number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
