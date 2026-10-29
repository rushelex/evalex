import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[[1, 2], [3, 4]]'),
    result: () => FormulaArray.from([1, 2, 3, 4]),
  },
  {
    formula: (name) => name('[1, [2, [3]]]'),
    result: () => FormulaArray.from([1, 2, [3]]),
  },
];

routinesRegistry.registerRoutine('flat', {
  description: 'Returns the items of nested lists in one list, one level deep.',
  examples: routineExamples,
  arguments: [arg.array('list')],
  returns: type.array(type.any),
  handler: ({ subject }) => new FormulaArray(subject.value.flatMap((item) => (FormulaArray.isOfType(item) ? item.value : [item]))),
});
