import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('4'),
    result: () => new FormulaNumber(2),
  },
];

routinesRegistry.registerRoutine('sqrt', {
  description: 'Returns the positive square root of the number.',
  examples: routineExamples,
  arguments: [
    arg.number('number', {
      validation: (number) => (number.value >= 0 ? undefined : { message: 'Expected non-negative number.', expected: ['non-negative number'], actual: number.value }),
    }),
  ],
  handler: ({ subject }) => FormulaNumber.from(Math.sqrt(subject.value)),
});
