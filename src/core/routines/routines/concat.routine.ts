import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2]', '[3, 4]'),
    result: () => FormulaArray.from([1, 2, 3, 4]),
  },
  {
    formula: (name) => name('[1]', '["a"]', '[[2]]'),
    result: () => FormulaArray.from([1, 'a', [2]]),
  },
];

routinesRegistry.registerRoutine('concat', {
  description: 'Returns the items of all the lists in one list.',
  examples: routineExamples,
  arguments: [arg.array('lists', { repeatable: true })],
  handler: ({ subject, args }) => new FormulaArray([subject, ...args].flatMap((list) => list.value)),
});
