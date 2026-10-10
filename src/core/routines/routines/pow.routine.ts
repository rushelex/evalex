import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('5', '10'),
    result: () => new FormulaNumber(9765625),
  },
];

routinesRegistry.registerRoutine('pow', {
  description: 'Returns the result of a base number raised to an exponent power.',
  examples: routineExamples,
  arguments: [arg.number('base'), arg.number('exponent')],
  handler: ({ subject, args: [exponent] }) => decimalArithmetic.power(subject, exponent),
});
