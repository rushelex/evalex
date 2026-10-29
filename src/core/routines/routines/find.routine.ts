import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNull, FormulaNumber, FormulaString } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('["a", "b", "c"]', 'current == "b"'),
    result: () => new FormulaString('b'),
  },
  {
    formula: (name) => name('[1, 2, 3]', 'current > 100'),
    result: () => FormulaNull.instance(),
  },
];

const T = type.variable('T');

routinesRegistry.registerRoutine('find', {
  description: 'Returns the first item for which the condition is true.',
  examples: routineExamples,
  arguments: [
    arg('list', type.array(T)),
    arg.eachItem('predicate', { item: T, returns: type.boolean }),
  ],
  returns: type.union(T, type.null),
  handler: ({ subject, args: [predicate] }) => subject.value
    .find((current, index) => predicate.execute({ current, index: new FormulaNumber(index) }).value) ?? FormulaNull.instance(),
});
