import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { expectInteger } from './expect-integer';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]', '1', '2'),
    result: () => FormulaArray.from([2]),
  },
  {
    formula: (name) => name('["a", "b", "c"]', '1'),
    result: () => FormulaArray.from(['b', 'c']),
  },
  {
    formula: (name) => name('[1, 2, 3]', '-2'),
    result: () => FormulaArray.from([2, 3]),
  },
];

routinesRegistry.registerRoutine('slice', {
  description: 'Returns the items from the start index up to the end index.',
  examples: routineExamples,
  arguments: [
    arg.array('list'),
    arg.number('start', { validation: expectInteger }),
    arg.number('end', { optional: true, validation: expectInteger }),
  ],
  handler: ({ subject, args: [start, end] }) => new FormulaArray(subject.value.slice(start.value, end?.value)),
});
