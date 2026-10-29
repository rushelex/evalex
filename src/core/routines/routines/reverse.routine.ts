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

routinesRegistry.registerRoutine('reverse', {
  description: 'Returns the items of the list in reverse order.',
  examples: routineExamples,
  arguments: [arg.array('list')],
  returns: type.array(type.any),
  handler: ({ subject }) => new FormulaArray(subject.value.toReversed()),
});
