import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNull, FormulaNumber, Kind } from '../../data-types';
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

    return numbers.length === 0 ? new FormulaNull() : median(numbers);
  },
});

function median(numbers: readonly FormulaNumber[]): FormulaNumber {
  const sorted = [...numbers].sort((a, b) => a.value - b.value);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[middle];
  }

  return decimalArithmetic.divide(decimalArithmetic.add(sorted[middle - 1], sorted[middle]), FormulaNumber.from(2));
}
