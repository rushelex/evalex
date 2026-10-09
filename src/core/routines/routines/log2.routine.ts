import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('4'),
    result: () => new FormulaNumber(2),
  },
  {
    formula: (name) => name('1024'),
    result: () => new FormulaNumber(10),
  },
];

routinesRegistry.registerRoutine('log2', {
  description: 'Returns the base 2 logarithm of the number.',
  examples: routineExamples,
  arguments: [
    arg.number('number', {
      validation: (number) => (number.value > 0 ? undefined : { message: 'Expected positive number.', expected: ['positive number'], actual: number.value }),
    }),
  ],
  handler: ({ subject }) => new FormulaNumber(Math.log2(subject.value)),
});
