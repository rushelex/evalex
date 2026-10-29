import type { RoutineExampleOptions } from '../routine-example';

import { FormulaBoolean, FormulaNumber, Kind } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]', 'current == 2'),
    result: () => new FormulaBoolean(true),
  },
  {
    formula: (name) => name('[]', 'current == 2'),
    result: () => new FormulaBoolean(false),
  },
];

routinesRegistry.registerRoutine('some', {
  description: 'Returns true if the condition is true for any item in the list.',
  examples: routineExamples,
  arguments: [
    arg.array('list'),
    arg.eachItem('predicate', { returns: Kind.Boolean }),
  ],
  returns: type.boolean,
  handler: ({ subject, args: [predicate] }) => new FormulaBoolean(subject.value
    .some((current, index) => predicate.execute({ current, index: new FormulaNumber(index) }).value)),
});
