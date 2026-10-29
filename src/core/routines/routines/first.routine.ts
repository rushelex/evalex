import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNull, FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaNumber(1),
  },
  {
    formula: (name) => name('[]'),
    result: () => FormulaNull.instance(),
  },
];

routinesRegistry.registerRoutine('first', {
  description: 'Returns the first item in the list.',
  examples: routineExamples,
  arguments: [arg.array('list')],
  returns: type.any,
  handler: ({ subject }) => subject.value.at(0) ?? FormulaNull.instance(),
});
