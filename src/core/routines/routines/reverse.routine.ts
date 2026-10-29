import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('["green", "eggs", "ham"]'),
    result: () => FormulaArray.from(['ham', 'eggs', 'green']),
  },
];

const T = type.variable('T');

routinesRegistry.registerRoutine('reverse', {
  description: 'Returns the items of the list in reverse order.',
  examples: routineExamples,
  arguments: [arg('list', type.array(T))],
  returns: type.array(T),
  handler: ({ subject }) => new FormulaArray(subject.value.toReversed()),
});
