import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNull, FormulaNumber, Kind } from '../../data-types';
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
  arguments: [arg.oneOf('numbers', [Kind.Array, Kind.Number], { repeatable: true })],
  handler: ({ subject, args, location }) => {
    const numbers = collectNumbers({ values: [subject, ...args], location });

    return numbers.length === 0 ? new FormulaNull() : decimalArithmetic.divide(numbers.reduce(decimalArithmetic.add, FormulaNumber.from(0)), FormulaNumber.from(numbers.length));
  },
});
