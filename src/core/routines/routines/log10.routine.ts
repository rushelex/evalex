import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('10'),
    result: () => new FormulaNumber(1),
  },
  {
    formula: (name) => name('100000'),
    result: () => new FormulaNumber(5),
  },
];

routinesRegistry.registerRoutine('log10', {
  description: 'Returns the base 10 logarithm of the number.',
  examples: routineExamples,
  arguments: [
    arg.number('number', {
      validation: (number) => (number.value > 0 ? undefined : { message: 'Expected positive number.', expected: ['positive number'], actual: number.value }),
    }),
  ],
  handler: ({ subject }) => new FormulaNumber(Math.log10(subject.value)),
});
