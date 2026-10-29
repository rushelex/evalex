import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('["a", "b", "c"]', 'current == "b"'),
    result: () => new FormulaNumber(1),
  },
  {
    formula: (name) => name('[1, 2, 3]', 'current > 100'),
    result: () => new FormulaNumber(-1),
  },
];

const T = type.variable('T');

routinesRegistry.registerRoutine('findIndex', {
  description: 'Returns the index of the first item matching the condition.',
  examples: routineExamples,
  arguments: [
    arg('list', type.array(T)),
    arg.eachItem('predicate', { item: T, returns: type.boolean }),
  ],
  returns: type.number,
  handler: ({ subject, args: [predicate] }) => new FormulaNumber(subject.value
    .findIndex((current, index) => predicate.execute({ current, index: new FormulaNumber(index) }).value)),
});
