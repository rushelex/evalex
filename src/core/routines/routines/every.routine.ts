import type { RoutineExampleOptions } from '../routine-example';

import { FormulaBoolean, FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]', 'current > 0'),
    result: () => new FormulaBoolean(true),
  },
  {
    formula: (name) => name('[]', 'current > 0'),
    result: () => new FormulaBoolean(true),
  },
];

const T = type.variable('T');

routinesRegistry.registerRoutine('every', {
  description: 'Returns true if the condition is true for every item in the list.',
  examples: routineExamples,
  arguments: [
    arg('list', type.array(T)),
    arg.eachItem('predicate', { item: T, returns: type.boolean }),
  ],
  returns: type.boolean,
  handler: ({ subject, args: [predicate] }) => new FormulaBoolean(subject.value
    .every((current, index) => predicate.execute({ current, index: new FormulaNumber(index) }).value)),
});
