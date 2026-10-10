import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNull, FormulaNumber, FormulaString, Kind } from '../../data-types';
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

routinesRegistry.registerRoutine('find', {
  description: 'Returns the first item for which the condition is true.',
  examples: routineExamples,
  arguments: [
    arg.array('list'),
    arg.eachItem('predicate', { returns: Kind.Boolean }),
  ],
  handler: ({ subject, args: [predicate] }) => subject.value
    .find((current, index) => predicate.execute({ current, index: new FormulaNumber(index) }).value) ?? FormulaNull.instance(),
});
