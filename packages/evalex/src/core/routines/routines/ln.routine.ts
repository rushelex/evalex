import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('10'),
    result: () => new FormulaNumber(Math.LN10),
  },
];

routinesRegistry.registerRoutine('ln', {
  description: 'Returns the natural logarithm of the number.',
  examples: routineExamples,
  arguments: [
    arg.number('number', {
      validation: (number) => (number.value > 0 ? undefined : { message: 'Expected positive number.', expected: ['positive number'], actual: number.value }),
    }),
  ],
  returns: type.number,
  handler: ({ subject }) => FormulaNumber.from(Math.log(subject.value)),
});
